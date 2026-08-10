import { spawn } from "node:child_process";

import {
  gitRemoteRefAdvertisementSchema,
  gitRemoteRefSchema,
  isValidGitBranchName,
  type GitRemoteRef,
} from "@mystra/shared";

import {
  readGitRemoteAccess,
  type GitRemoteAccess,
  type GitRemoteCredential,
} from "./remote-access";

export type GitCommandRequest = {
  args: string[];
  timeoutMs: number;
  maxOutputBytes: number;
  credential?: GitRemoteCredential;
};

type GitCommandResult = {
  status: number;
  stdout: string;
  stderr?: string;
};

type GitCommandRunner = (request: GitCommandRequest) => Promise<GitCommandResult>;

type GitRemoteReadInput = {
  access: GitRemoteAccess;
  timeoutMs: number;
  maxRefs: number;
  maxOutputBytes: number;
};

type GitRemoteBranchResolveInput = GitRemoteReadInput & { branch: string };

export class GitRemoteRepositoryError extends Error {
  readonly code: "repository_branches_unavailable" | "repository_unavailable";

  constructor(
    code: "repository_branches_unavailable" | "repository_unavailable",
    message: string,
  ) {
    super(message);
    this.name = "GitRemoteRepositoryError";
    this.code = code;
  }
}

export class RemoteRepositoryReader {
  readonly #runGit: GitCommandRunner;

  constructor(options: { runGit?: GitCommandRunner } = {}) {
    this.#runGit = options.runGit ?? runGitCommand;
  }

  async inspectBranches(input: GitRemoteReadInput) {
    validateLimits(input);
    const access = readGitRemoteAccess(input.access);
    try {
      const result = await this.#runGit({
        args: ["ls-remote", "--symref", "--quiet", access.endpoint, "HEAD", "refs/heads/*"],
        timeoutMs: input.timeoutMs,
        maxOutputBytes: input.maxOutputBytes,
        ...(access.credential ? { credential: access.credential } : {}),
      });
      if (result.status !== 0) {
        throw new GitRemoteRepositoryError(
          "repository_branches_unavailable",
          "Remote repository branches are unavailable",
        );
      }
      return parseAdvertisement(result.stdout, input.maxRefs, input.maxOutputBytes);
    } catch (error) {
      if (error instanceof GitRemoteRepositoryError) throw error;
      throw new GitRemoteRepositoryError(
        "repository_branches_unavailable",
        "Remote repository branches are unavailable",
      );
    }
  }

  async resolveBranch(input: GitRemoteBranchResolveInput): Promise<GitRemoteRef> {
    validateLimits(input);
    if (!isValidGitBranchName(input.branch)) {
      throw new GitRemoteRepositoryError("repository_unavailable", "Configured repository branch is invalid");
    }
    const access = readGitRemoteAccess(input.access);
    const ref = `refs/heads/${input.branch}`;
    try {
      const result = await this.#runGit({
        args: ["ls-remote", "--refs", "--exit-code", "--quiet", access.endpoint, ref],
        timeoutMs: input.timeoutMs,
        maxOutputBytes: input.maxOutputBytes,
        ...(access.credential ? { credential: access.credential } : {}),
      });
      if (result.status === 2) {
        throw new GitRemoteRepositoryError(
          "repository_unavailable",
          "Configured repository branch does not exist",
        );
      }
      if (result.status !== 0) {
        throw new GitRemoteRepositoryError(
          "repository_unavailable",
          "Configured repository branch is unavailable",
        );
      }
      const advertisement = parseAdvertisement(result.stdout, 1, input.maxOutputBytes);
      const branch = advertisement.branches[0];
      if (!branch || branch.ref !== ref || advertisement.branches.length !== 1) {
        throw new GitRemoteRepositoryError(
          "repository_unavailable",
          "Configured repository branch did not resolve exactly",
        );
      }
      return branch;
    } catch (error) {
      if (error instanceof GitRemoteRepositoryError) throw error;
      throw new GitRemoteRepositoryError(
        "repository_unavailable",
        "Configured repository branch is unavailable",
      );
    }
  }
}

function validateLimits(input: GitRemoteReadInput): void {
  if (!Number.isInteger(input.timeoutMs) || input.timeoutMs < 1 || input.timeoutMs > 30_000) {
    throw new GitRemoteRepositoryError("repository_branches_unavailable", "Git timeout limit is invalid");
  }
  if (!Number.isInteger(input.maxRefs) || input.maxRefs < 1 || input.maxRefs > 10_000) {
    throw new GitRemoteRepositoryError("repository_branches_unavailable", "Git ref limit is invalid");
  }
  if (
    !Number.isInteger(input.maxOutputBytes)
    || input.maxOutputBytes < 1
    || input.maxOutputBytes > 8 * 1024 * 1024
  ) {
    throw new GitRemoteRepositoryError("repository_branches_unavailable", "Git output limit is invalid");
  }
}

function parseAdvertisement(stdout: string, maxRefs: number, maxOutputBytes: number) {
  if (Buffer.byteLength(stdout, "utf8") > maxOutputBytes) {
    throw new GitRemoteRepositoryError(
      "repository_branches_unavailable",
      "Remote repository advertisement exceeded its output limit",
    );
  }
  const branches = new Map<string, GitRemoteRef>();
  let symbolicHead: string | null = null;
  for (const line of stdout.split("\n")) {
    if (line === "") continue;
    const separator = line.indexOf("\t");
    if (separator <= 0 || separator !== line.lastIndexOf("\t")) {
      throw new GitRemoteRepositoryError(
        "repository_branches_unavailable",
        "Remote repository advertisement was malformed",
      );
    }
    const left = line.slice(0, separator);
    const right = line.slice(separator + 1);
    if (left.startsWith("ref: ")) {
      if (right !== "HEAD" || symbolicHead !== null || !left.startsWith("ref: refs/heads/")) {
        throw new GitRemoteRepositoryError(
          "repository_branches_unavailable",
          "Remote repository symbolic HEAD was malformed",
        );
      }
      symbolicHead = left.slice("ref: ".length);
      continue;
    }
    if (right === "HEAD") {
      if (!/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/u.test(left)) {
        throw new GitRemoteRepositoryError(
          "repository_branches_unavailable",
          "Remote repository HEAD was malformed",
        );
      }
      continue;
    }
    if (!right.startsWith("refs/heads/")) {
      throw new GitRemoteRepositoryError(
        "repository_branches_unavailable",
        "Remote repository returned an unexpected ref",
      );
    }
    const branch = gitRemoteRefSchema.parse({
      name: right.slice("refs/heads/".length),
      ref: right,
      commit: left,
    });
    const existing = branches.get(branch.ref);
    if (existing && existing.commit !== branch.commit) {
      throw new GitRemoteRepositoryError(
        "repository_branches_unavailable",
        "Remote repository returned conflicting refs",
      );
    }
    branches.set(branch.ref, branch);
    if (branches.size > maxRefs) {
      throw new GitRemoteRepositoryError(
        "repository_branches_unavailable",
        "Remote repository advertisement exceeded its ref limit",
      );
    }
  }
  const branchList = [...branches.values()];
  const head = symbolicHead ? branches.get(symbolicHead) ?? null : null;
  return gitRemoteRefAdvertisementSchema.parse({ head, branches: branchList });
}

async function runGitCommand(request: GitCommandRequest): Promise<GitCommandResult> {
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
    let stdoutBytes = 0;
    let stderrBytes = 0;
    const stderr: Buffer[] = [];
    let exceeded = false;
    const timer = setTimeout(() => {
      exceeded = true;
      child.kill("SIGKILL");
    }, request.timeoutMs);
    child.stdout.on("data", (chunk: Buffer) => {
      stdoutBytes += chunk.length;
      if (stdoutBytes > request.maxOutputBytes) {
        exceeded = true;
        child.kill("SIGKILL");
        return;
      }
      stdout.push(chunk);
    });
    child.stderr.on("data", (chunk: Buffer) => {
      if (stderrBytes >= 64 * 1024) return;
      stderrBytes += chunk.length;
      stderr.push(chunk.subarray(0, Math.max(0, 64 * 1024 - (stderrBytes - chunk.length))));
    });
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
      resolve({
        status: status ?? 128,
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
      });
    });
  });
}
