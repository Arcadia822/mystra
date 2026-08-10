import { mkdir, mkdtemp, readdir, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  WorkspaceMaterializationError,
  WorkspaceMaterializer,
  type WorkspaceGitCommandRequest,
} from "./workspace-materializer.js";

const workspaceId = "00000000-0000-4000-8000-000000000001";
const attemptId = "00000000-0000-4000-8000-000000000002";
const runnerId = "00000000-0000-4000-8000-000000000003";
const sha = "0123456789abcdef0123456789abcdef01234567";
const laterSha = "89abcdef0123456789abcdef0123456789abcdef";
const branchName = "mystra/task-12345678-000";
const token = "token-that-must-not-leak";

const claim = {
  workspaceId,
  attemptId,
  attemptSequence: 1,
  leaseExpiresAt: "2027-08-10T00:01:00.000Z",
  workspaceRef: `host-task-workspace:${workspaceId}`,
  repository: {
    provider: "github",
    connectionId: "00000000-0000-4000-8000-000000000004",
    repositoryExternalId: "42",
    baseRef: "refs/heads/main",
    baseCommit: sha,
    transport: { kind: "https" as const, endpoint: "https://github.com/example/mystra.git" },
  },
  branch: { name: branchName, strategy: "mystra-task-fallback-v1" },
  credential: { kind: "http-basic-token" as const, secret: token },
};

const tempDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirectories.splice(0).map((directory) => (
    rm(directory, { recursive: true, force: true })
  )));
});

async function root(): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), "mystra-materializer-"));
  tempDirectories.push(directory);
  return path.join(directory, "workspaces");
}

function successfulGit() {
  return vi.fn(async (request: WorkspaceGitCommandRequest) => {
    if (request.args[0] === "clone") {
      await mkdir(request.args.at(-1)!, { recursive: true });
      await mkdir(path.join(request.args.at(-1)!, ".git"));
    }
    if (request.args.includes("ls-remote")) return { status: 2, stdout: "" };
    if (request.args.includes("rev-parse")) return { status: 0, stdout: `${sha}\n` };
    if (request.args.includes("symbolic-ref")) return { status: 0, stdout: `${branchName}\n` };
    return { status: 0, stdout: "" };
  });
}

describe("WorkspaceMaterializer", () => {
  it("materializes exact commit and branch under the safe root, then atomically publishes", async () => {
    const workspaceRoot = await root();
    const runGit = successfulGit();
    const materializer = new WorkspaceMaterializer({ root: workspaceRoot, runGit });

    const report = await materializer.materialize(claim, runnerId);

    expect(report).toEqual({
      runnerId,
      attemptSequence: 1,
      status: "succeeded",
      workspaceRef: claim.workspaceRef,
      observed: { baseCommit: sha, branchName },
    });
    expect(await readdir(workspaceRoot)).toEqual([workspaceId]);
    const calls = runGit.mock.calls.map(([request]) => request.args);
    expect(calls[0]).toEqual([
      "clone", "--no-checkout", "--filter=blob:none",
      "https://github.com/example/mystra.git",
      expect.stringContaining(`.${workspaceId}.${attemptId}.tmp`),
    ]);
    expect(calls).toContainEqual(["-C", expect.any(String), "fetch", "--no-tags", "origin", sha]);
    expect(calls).toContainEqual(["-C", expect.any(String), "switch", "-c", branchName, sha]);
    expect(JSON.stringify(calls)).not.toContain(token);
  });

  it("reuses an intact owned publish after a lost success report", async () => {
    const workspaceRoot = await root();
    const runGit = successfulGit();
    const materializer = new WorkspaceMaterializer({ root: workspaceRoot, runGit });
    await materializer.materialize(claim, runnerId);
    const callsAfterPublish = runGit.mock.calls.length;

    await expect(materializer.materialize({
      ...claim,
      attemptId: "00000000-0000-4000-8000-000000000005",
      attemptSequence: 2,
    }, runnerId)).resolves.toEqual({
      runnerId,
      attemptSequence: 2,
      status: "succeeded",
      workspaceRef: claim.workspaceRef,
      observed: { baseCommit: sha, branchName },
    });
    expect(runGit.mock.calls.slice(callsAfterPublish).map(([request]) => request.args)).toEqual([
      ["-C", expect.any(String), "rev-parse", "HEAD"],
      ["-C", expect.any(String), "symbolic-ref", "--short", "HEAD"],
      ["-C", expect.any(String), "merge-base", "--is-ancestor", sha, "HEAD"],
    ]);
  });

  it("fails closed on a remote branch collision and removes the partial clone", async () => {
    const workspaceRoot = await root();
    const runGit = successfulGit();
    runGit.mockImplementation(async (request) => {
      if (request.args[0] === "clone") await mkdir(request.args.at(-1)!, { recursive: true });
      if (request.args.includes("ls-remote")) return { status: 0, stdout: `${sha}\trefs/heads/${branchName}\n` };
      return { status: 0, stdout: "" };
    });
    const materializer = new WorkspaceMaterializer({ root: workspaceRoot, runGit });

    await expect(materializer.materialize(claim, runnerId)).rejects.toMatchObject({
      code: "branch_collision",
    });
    expect(await readdir(workspaceRoot)).toEqual([]);
  });

  it("cleans up partial state and redacts credentials when Git fails", async () => {
    const workspaceRoot = await root();
    const runGit = successfulGit();
    runGit.mockImplementation(async (request) => {
      if (request.args[0] === "clone") {
        await mkdir(request.args.at(-1)!, { recursive: true });
        return { status: 0, stdout: "" };
      }
      return { status: 128, stdout: "", stderr: `fatal: ${token}` };
    });
    const materializer = new WorkspaceMaterializer({ root: workspaceRoot, runGit });

    const failure = await materializer.materialize(claim, runnerId).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(WorkspaceMaterializationError);
    expect(String(failure)).not.toContain(token);
    expect(await readdir(workspaceRoot)).toEqual([]);
  });

  it("rejects unsafe roots, forged opaque refs, and pre-existing publish targets", async () => {
    const workspaceRoot = await root();
    expect(() => new WorkspaceMaterializer({ root: "relative/workspaces", runGit: successfulGit() }))
      .toThrow(/absolute/u);
    const materializer = new WorkspaceMaterializer({ root: workspaceRoot, runGit: successfulGit() });
    await expect(materializer.materialize({
      ...claim,
      workspaceRef: "host-task-workspace:00000000-0000-4000-8000-000000000099",
    }, runnerId)).rejects.toMatchObject({ code: "workspace_ref_invalid" });

    await mkdir(path.join(workspaceRoot, workspaceId), { recursive: true });
    await expect(materializer.materialize(claim, runnerId)).rejects.toMatchObject({
      code: "publish_target_exists",
    });
  });

  it("resolves only an intact directory, repository, base ancestry, and branch", async () => {
    const workspaceRoot = await root();
    const runGit = successfulGit();
    const materializer = new WorkspaceMaterializer({ root: workspaceRoot, runGit });
    await materializer.materialize(claim, runnerId);

    await expect(materializer.resolveReadyWorkspace(claim.workspaceRef)).resolves.toMatchObject({
      directory: await realpath(path.join(workspaceRoot, workspaceId)),
      baseCommit: sha,
      branchName,
    });

    await expect(materializer.resolveReadyWorkspace(
      "host-task-workspace:00000000-0000-4000-8000-000000000099",
    )).rejects.toMatchObject({ code: "workspace_missing" });

    const brokenRoot = await root();
    const brokenDirectory = path.join(brokenRoot, workspaceId);
    await mkdir(brokenDirectory, { recursive: true });
    await writeFile(path.join(brokenDirectory, ".mystra-workspace.json"), JSON.stringify({
      version: 1, workspaceId, baseCommit: sha, branchName,
    }));
    await expect(new WorkspaceMaterializer({ root: brokenRoot, runGit })
      .resolveReadyWorkspace(claim.workspaceRef)).rejects.toMatchObject({ code: "workspace_missing" });
  });

  it("keeps a shared-mutable Workspace available after its branch advances", async () => {
    const workspaceRoot = await root();
    const runGit = successfulGit();
    const materializer = new WorkspaceMaterializer({ root: workspaceRoot, runGit });
    await materializer.materialize(claim, runnerId);
    runGit.mockImplementation(async (request) => {
      if (request.args.includes("rev-parse")) return { status: 0, stdout: `${laterSha}\n` };
      if (request.args.includes("symbolic-ref")) return { status: 0, stdout: `${branchName}\n` };
      if (request.args.includes("merge-base")) return { status: 0, stdout: "" };
      return { status: 0, stdout: "" };
    });

    await expect(materializer.resolveReadyWorkspace(claim.workspaceRef)).resolves.toMatchObject({
      baseCommit: sha,
      currentCommit: laterSha,
      branchName,
    });
  });
});
