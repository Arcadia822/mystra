import { describe, expect, it, vi } from "vitest";

import type { WorkspacePreparationClaim, WorkspacePreparationReport } from "@mystra/shared";

import { WorkspaceMaterializationError } from "./workspace-materializer.js";
import {
  WorkspaceLoopHttpError,
  processNextWorkspace,
  resolveTaskWorkspaceForSession,
  runWorkspaceLoop,
} from "./workspace-loop.js";

const runnerId = "00000000-0000-4000-8000-000000000001";
const claim: WorkspacePreparationClaim = {
  workspaceId: "00000000-0000-4000-8000-000000000002",
  attemptId: "00000000-0000-4000-8000-000000000003",
  attemptSequence: 1,
  leaseExpiresAt: "2027-08-10T00:01:00.000Z",
  workspaceRef: "host-task-workspace:00000000-0000-4000-8000-000000000002",
  repository: {
    provider: "github",
    connectionId: "00000000-0000-4000-8000-000000000004",
    repositoryExternalId: "42",
    baseRef: "refs/heads/main",
    baseCommit: "0123456789abcdef0123456789abcdef01234567",
    transport: { kind: "https", endpoint: "https://github.com/example/mystra.git" },
  },
  branch: { name: "mystra/task-12345678-000", strategy: "mystra-task-fallback-v1" },
  credential: { kind: "http-basic-token", secret: "transient-token" },
};
const success: WorkspacePreparationReport = {
  runnerId,
  attemptSequence: 1,
  status: "succeeded",
  workspaceRef: claim.workspaceRef,
  observed: { baseCommit: claim.repository.baseCommit, branchName: claim.branch.name },
};

describe("workspace loop", () => {
  it("claims, materializes, and reports one fenced attempt", async () => {
    const client = {
      claim: vi.fn(async () => claim),
      report: vi.fn(async () => undefined),
    };
    const materializer = { materialize: vi.fn(async () => success) };

    await expect(processNextWorkspace({
      runnerId,
      client,
      materializer,
      waitSeconds: 25,
      retryIntervalSeconds: 5,
      signal: new AbortController().signal,
      sleep: vi.fn(async () => undefined),
    })).resolves.toBe(true);

    expect(client.claim).toHaveBeenCalledWith(runnerId, 25);
    expect(materializer.materialize).toHaveBeenCalledWith(claim, runnerId);
    expect(client.report).toHaveBeenCalledWith(claim.workspaceId, claim.attemptId, success);
  });

  it("reports a safe failure when materialization fails", async () => {
    const client = {
      claim: vi.fn(async () => claim),
      report: vi.fn(async () => undefined),
    };
    const materializer = {
      materialize: vi.fn(async () => {
        throw new WorkspaceMaterializationError("git_failed", "secret provider stderr");
      }),
    };

    await processNextWorkspace({
      runnerId,
      client,
      materializer,
      waitSeconds: 0,
      retryIntervalSeconds: 1,
      signal: new AbortController().signal,
      sleep: vi.fn(async () => undefined),
    });

    expect(client.report).toHaveBeenCalledWith(claim.workspaceId, claim.attemptId, {
      runnerId,
      attemptSequence: 1,
      status: "failed",
      failure: { code: "materialization_failed", message: "Workspace materialization failed (git_failed)" },
    });
    expect(JSON.stringify(client.report.mock.calls)).not.toContain("secret provider stderr");
  });

  it("treats a 409 report as a stale lease and does not retry it", async () => {
    const report = vi.fn(async () => {
      throw new WorkspaceLoopHttpError(409, "stale_workspace_attempt");
    });
    await processNextWorkspace({
      runnerId,
      client: { claim: vi.fn(async () => claim), report },
      materializer: { materialize: vi.fn(async () => success) },
      waitSeconds: 0,
      retryIntervalSeconds: 1,
      signal: new AbortController().signal,
      sleep: vi.fn(async () => undefined),
    });
    expect(report).toHaveBeenCalledTimes(1);
  });

  it("backs off after claim failure and exits gracefully on abort", async () => {
    const controller = new AbortController();
    const claimRemote = vi.fn(async () => {
      controller.abort(new Error("stopped"));
      throw new WorkspaceLoopHttpError(503, "unavailable");
    });
    const sleep = vi.fn(async () => undefined);

    await expect(runWorkspaceLoop({
      runnerId,
      client: { claim: claimRemote, report: vi.fn() },
      materializer: { materialize: vi.fn() },
      waitSeconds: 0,
      retryIntervalSeconds: 1,
      signal: controller.signal,
      sleep,
    })).resolves.toBeUndefined();
    expect(claimRemote).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("reports workspace_missing when Session resolution cannot verify the directory", async () => {
    const reportMissing = vi.fn(async () => undefined);
    await expect(resolveTaskWorkspaceForSession({
      workspaceRef: claim.workspaceRef,
      runnerId,
      client: { reportMissing },
      materializer: {
        resolveReadyWorkspace: vi.fn(async () => {
          throw new WorkspaceMaterializationError("workspace_missing", "missing");
        }),
      },
    })).rejects.toMatchObject({ code: "workspace_missing" });
    expect(reportMissing).toHaveBeenCalledWith(claim.workspaceId, runnerId);
  });
});
