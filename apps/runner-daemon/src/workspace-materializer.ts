import { spawn } from "node:child_process";
import { lstat, mkdir, readFile, realpath, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  workspacePreparationClaimSchema,
  workspacePreparationReportSchema,
  type WorkspacePreparationClaim,
  type WorkspacePreparationReport,
} from "@mystra/shared";
import { z } from "zod";

export type WorkspaceGitCommandRequest = {
  args: string[];
  timeoutMs: number;
  credential?: { username: string; secret: string };
};

type WorkspaceGitCommandResult = { status: number; stdout: string; stderr?: string };
type WorkspaceGitCommandRunner = (
  request: WorkspaceGitCommandRequest,
) => Promise<WorkspaceGitCommandResult>;

type MaterializationErrorCode =
  | "workspace_ref_invalid"
  | "publish_target_exists"
  | "branch_collision"
  | "git_failed"
  | "verification_failed"
  | "publish_failed"
  | "workspace_missing";

const workspaceMarkerSchema = z.object({
  version: z.literal(1),
  workspaceId: z.string().uuid(),
  baseCommit: z.string().regex(/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/u),
  branchName: z.string().min(1),
}).strict();

export class WorkspaceMaterializationError extends Error {
  readonly code: MaterializationErrorCode;

  constructor(code: MaterializationErrorCode, message: string) {
    super(message);
    this.name = "WorkspaceMaterializationError";
    this.code = code;
  }
}

export class WorkspaceMaterializer {
  readonly #root: string;
  readonly #runGit: WorkspaceGitCommandRunner;

  constructor(input: { root: string; runGit?: WorkspaceGitCommandRunner }) {
    if (!path.isAbsolute(input.root)) {
      throw new Error("Workspace root must be absolute");
    }
    this.#root = path.resolve(input.root);
    this.#runGit = input.runGit ?? runWorkspaceGitCommand;
  }

  async materialize(
    untrustedClaim: WorkspacePreparationClaim,
    runnerId: string,
  ): Promise<WorkspacePreparationReport> {
    let temporary = "";
    try {
      const claim = workspacePreparationClaimSchema.parse(untrustedClaim);
      if (claim.workspaceRef !== `host-task-workspace:${claim.workspaceId}`) {
        throw new WorkspaceMaterializationError(
          "workspace_ref_invalid",
          "Workspace reference does not match Workspace identity",
        );
      }
      await mkdir(this.#root, { recursive: true, mode: 0o700 });
      const safeRoot = await realpath(this.#root);
      const final = childPath(safeRoot, claim.workspaceId);
      temporary = childPath(safeRoot, `.${claim.workspaceId}.${claim.attemptId}.tmp`);
      if (await exists(final)) {
        const existing = await this.resolveReadyWorkspace(claim.workspaceRef).catch(() => undefined);
        if (
          existing?.baseCommit === claim.repository.baseCommit
          && existing.currentCommit === claim.repository.baseCommit
          && existing.branchName === claim.branch.name
        ) {
          return workspacePreparationReportSchema.parse({
            runnerId,
            attemptSequence: claim.attemptSequence,
            status: "succeeded",
            workspaceRef: claim.workspaceRef,
            observed: {
              baseCommit: existing.baseCommit,
              branchName: existing.branchName,
            },
          });
        }
        throw new WorkspaceMaterializationError(
          "publish_target_exists",
          "Workspace publish target exists but does not match the frozen intent",
        );
      }
      await rm(temporary, { recursive: true, force: true });
      const credential = { username: "x-access-token", secret: claim.credential.secret };

      await this.#requireGitSuccess({
        args: [
          "clone",
          "--no-checkout",
          "--filter=blob:none",
          claim.repository.transport.endpoint,
          temporary,
        ],
        credential,
      });
      const actualTemporary = await realpath(temporary);
      requireDescendant(safeRoot, actualTemporary);
      await this.#requireGitSuccess({
        args: ["-C", actualTemporary, "fetch", "--no-tags", "origin", claim.repository.baseCommit],
        credential,
      });
      await this.#requireGitSuccess({
        args: ["-C", actualTemporary, "cat-file", "-e", `${claim.repository.baseCommit}^{commit}`],
      });
      const branchCollision = await this.#runGit({
        args: [
          "-C", actualTemporary, "ls-remote", "--refs", "--exit-code", "--quiet",
          "origin", `refs/heads/${claim.branch.name}`,
        ],
        timeoutMs: 300_000,
        credential,
      });
      if (branchCollision.status === 0) {
        throw new WorkspaceMaterializationError(
          "branch_collision",
          "Workspace branch already exists on the remote",
        );
      }
      if (branchCollision.status !== 2) {
        throw new WorkspaceMaterializationError("git_failed", "Remote branch check failed");
      }
      await this.#requireGitSuccess({
        args: ["-C", actualTemporary, "switch", "-c", claim.branch.name, claim.repository.baseCommit],
      });
      const observedCommit = (await this.#requireGitSuccess({
        args: ["-C", actualTemporary, "rev-parse", "HEAD"],
      })).stdout.trim();
      const observedBranch = (await this.#requireGitSuccess({
        args: ["-C", actualTemporary, "symbolic-ref", "--short", "HEAD"],
      })).stdout.trim();
      if (observedCommit !== claim.repository.baseCommit || observedBranch !== claim.branch.name) {
        throw new WorkspaceMaterializationError(
          "verification_failed",
          "Materialized Workspace did not match the frozen intent",
        );
      }
      await writeFile(path.join(actualTemporary, ".mystra-workspace.json"), JSON.stringify({
        version: 1,
        workspaceId: claim.workspaceId,
        baseCommit: observedCommit,
        branchName: observedBranch,
      }), { encoding: "utf8", mode: 0o600 });
      try {
        await rename(actualTemporary, final);
      } catch {
        throw new WorkspaceMaterializationError("publish_failed", "Workspace publish failed");
      }
      temporary = "";
      return workspacePreparationReportSchema.parse({
        runnerId,
        attemptSequence: claim.attemptSequence,
        status: "succeeded",
        workspaceRef: claim.workspaceRef,
        observed: { baseCommit: observedCommit, branchName: observedBranch },
      });
    } catch (error) {
      if (temporary) await rm(temporary, { recursive: true, force: true }).catch(() => undefined);
      if (error instanceof WorkspaceMaterializationError) throw error;
      throw new WorkspaceMaterializationError("git_failed", "Workspace materialization failed");
    }
  }

  async resolveReadyWorkspace(workspaceRef: string): Promise<{
    directory: string;
    baseCommit: string;
    currentCommit: string;
    branchName: string;
  }> {
    try {
      const match = /^host-task-workspace:([0-9a-f-]{36})$/iu.exec(workspaceRef);
      if (!match) throw new Error("invalid Workspace reference");
      await mkdir(this.#root, { recursive: true, mode: 0o700 });
      const safeRoot = await realpath(this.#root);
      const directory = childPath(safeRoot, match[1]!);
      const actual = await realpath(directory);
      requireDescendant(safeRoot, actual);
      const marker = workspaceMarkerSchema.parse(JSON.parse(
        await readFile(path.join(actual, ".mystra-workspace.json"), "utf8"),
      ));
      if (marker.workspaceId !== match[1] || !(await exists(path.join(actual, ".git")))) {
        throw new Error("Workspace repository is missing");
      }
      const currentCommit = (await this.#requireGitSuccess({
        args: ["-C", actual, "rev-parse", "HEAD"],
      })).stdout.trim();
      const branch = (await this.#requireGitSuccess({
        args: ["-C", actual, "symbolic-ref", "--short", "HEAD"],
      })).stdout.trim();
      const containsBase = await this.#runGit({
        args: ["-C", actual, "merge-base", "--is-ancestor", marker.baseCommit, "HEAD"],
        timeoutMs: 300_000,
      });
      if (branch !== marker.branchName || containsBase.status !== 0) {
        throw new Error("Workspace repository observation changed");
      }
      return {
        directory: actual,
        baseCommit: marker.baseCommit,
        currentCommit,
        branchName: branch,
      };
    } catch {
      throw new WorkspaceMaterializationError(
        "workspace_missing",
        "Task Workspace directory or repository is unavailable",
      );
    }
  }

  async #requireGitSuccess(input: Omit<WorkspaceGitCommandRequest, "timeoutMs">) {
    const result = await this.#runGit({ ...input, timeoutMs: 300_000 });
    if (result.status !== 0) {
      throw new WorkspaceMaterializationError("git_failed", "Git Workspace operation failed");
    }
    return result;
  }
}

function childPath(root: string, name: string): string {
  const candidate = path.resolve(root, name);
  requireDescendant(root, candidate);
  return candidate;
}

function requireDescendant(root: string, candidate: string): void {
  const relative = path.relative(root, candidate);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new WorkspaceMaterializationError("publish_failed", "Workspace path escaped its safe root");
  }
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await lstat(filePath);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

async function runWorkspaceGitCommand(
  request: WorkspaceGitCommandRequest,
): Promise<WorkspaceGitCommandResult> {
  return new Promise((resolve, reject) => {
    const environment: NodeJS.ProcessEnv = {
      ...process.env,
      GIT_TERMINAL_PROMPT: "0",
      GIT_ASKPASS: "",
      GCM_INTERACTIVE: "Never",
    };
    if (request.credential) {
      const authorization = Buffer
        .from(`${request.credential.username}:${request.credential.secret}`, "utf8")
        .toString("base64");
      environment.GIT_CONFIG_COUNT = "1";
      environment.GIT_CONFIG_KEY_0 = "http.extraHeader";
      environment.GIT_CONFIG_VALUE_0 = `Authorization: Basic ${authorization}`;
    }
    const child = spawn("git", request.args, {
      env: environment,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdout: Buffer[] = [];
    let bytes = 0;
    let exceeded = false;
    const timer = setTimeout(() => {
      exceeded = true;
      child.kill("SIGKILL");
    }, request.timeoutMs);
    child.stdout.on("data", (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > 1024 * 1024) {
        exceeded = true;
        child.kill("SIGKILL");
        return;
      }
      stdout.push(chunk);
    });
    child.stderr.resume();
    child.once("error", () => {
      clearTimeout(timer);
      reject(new Error("Git process could not start"));
    });
    child.once("close", (status) => {
      clearTimeout(timer);
      if (exceeded) {
        reject(new Error("Git process exceeded a configured bound"));
        return;
      }
      resolve({ status: status ?? 128, stdout: Buffer.concat(stdout).toString("utf8") });
    });
  });
}
