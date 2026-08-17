import { randomUUID } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import { createGitRemoteAccess } from "../git/remote-access.js";
import { TaskWorkspaceFailure } from "./task-workspace-errors.js";
import { TaskWorkspaceService } from "./task-workspace-service.js";

const teamId = "00000000-0000-4000-8000-000000000001";
const projectId = "00000000-0000-4000-8000-000000000002";
const connectionId = "00000000-0000-4000-8000-000000000003";
const taskId = "12345678-0000-4000-8000-000000000004";
const runtimeId = "00000000-0000-4000-8000-000000000005";
const workspaceId = "00000000-0000-4000-8000-000000000006";
const attemptId = "00000000-0000-4000-8000-000000000007";
const sha = "0123456789abcdef0123456789abcdef01234567";

const project = {
  id: projectId, teamId, name: "Mystra", slug: "mystra",
  repositoryConnectionId: connectionId, repositoryExternalId: "42", repositoryBaseBranch: "main",
  metadata: {}, archivedAt: null, createdAt: "2026-08-10T00:00:00.000Z", updatedAt: "2026-08-10T00:00:00.000Z",
};
const issue = {
  provider: "github" as const,
  connectionId,
  scopeExternalId: "42",
  externalId: "101",
  identifier: "7",
};
const task = {
  id: taskId, teamId, title: "Prepare repository", description: null, projectId, issue,
  runtimeId,
  createdAt: "2026-08-10T00:00:00.000Z", updatedAt: "2026-08-10T00:00:00.000Z",
};
const runtime = {
  id: runtimeId,
  name: "Host",
  type: "host" as const,
  metadata: {
    runnerId: "host-runner",
    workspaceMaterialization: {
      version: 1 as const,
      kinds: ["task-repository"] as const,
      sharingModes: ["shared-mutable"] as const,
    },
  },
  status: "online" as const,
  lastSeenAt: "2026-08-10T00:00:00.000Z",
  providers: [],
  createdAt: "2026-08-10T00:00:00.000Z",
  updatedAt: "2026-08-10T00:00:00.000Z",
};
const workspace = {
  id: workspaceId,
  teamId,
  taskId,
  projectId,
  runtimeId,
  state: "queued" as const,
  sharingMode: "shared-mutable" as const,
  connectionId,
  repositoryExternalId: "42",
  configuredBaseBranch: "main",
  issueProvider: "github" as const,
  issueConnectionId: connectionId,
  issueScopeExternalId: "42",
  issueExternalId: "101",
  baseRef: "refs/heads/main",
  baseCommit: sha,
  branchName: "mystra/github-7-prepare-repository-12345678",
  branchStrategy: "github-issue-identifier-title-task-v1",
  workspaceRef: null,
  activeAttemptSequence: 1,
  failureCode: null,
  failureMessage: null,
  createdAt: "2026-08-10T00:00:00.000Z",
  updatedAt: "2026-08-10T00:00:00.000Z",
  readyAt: null,
};
const attempt = {
  id: attemptId, workspaceId, sequence: 1, state: "queued" as const, runnerId: null,
  leaseExpiresAt: null, claimedAt: null, completedAt: null, failureCode: null,
  createdAt: "2026-08-10T00:00:00.000Z",
};

function fixture(overrides: {
  task?: typeof task | undefined;
  project?: typeof project | undefined;
  runtime?: typeof runtime | undefined;
  existing?: typeof workspace | undefined;
  branchName?: string;
} = {}) {
  const access = createGitRemoteAccess({ endpoint: "https://github.com/example/mystra.git" });
  const db = {
    getTask: vi.fn(async () => "task" in overrides ? overrides.task : task),
    getProjectById: vi.fn(async () => "project" in overrides ? overrides.project : project),
    getRuntime: vi.fn(async () => "runtime" in overrides ? overrides.runtime : runtime),
    getTaskWorkspace: vi.fn(async () => overrides.existing),
    createTaskWorkspace: vi.fn(async (input) => ({
      workspace: { ...workspace, ...input },
      attempt,
      created: true,
    })),
    retryTaskWorkspace: vi.fn(async () => ({
      workspace: { ...workspace, state: "queued", activeAttemptSequence: 2 },
      attempt: { ...attempt, sequence: 2 },
    })),
  };
  const repositoryAccess = { resolve: vi.fn(async () => access) };
  const repositoryReader = {
    resolveBranch: vi.fn(async () => ({ name: "main", ref: "refs/heads/main", commit: sha })),
  };
  const issueBranches = {
    resolve: vi.fn(async () => ({
      branchName: overrides.branchName ?? workspace.branchName,
      strategy: workspace.branchStrategy,
      source: "issue-provider" as const,
    })),
  };
  return {
    service: new TaskWorkspaceService({
      db: db as never,
      repositoryAccess,
      repositoryReader: repositoryReader as never,
      issueBranches,
    }),
    db,
    repositoryAccess,
    repositoryReader,
    issueBranches,
  };
}

const setupInput = {
  actor: { teamId },
  taskId,
  runtimeId,
  idempotencyKey: "00000000-0000-4000-8000-000000000099",
};

describe("TaskWorkspaceService", () => {
  it("freezes the exact Project repository, base commit, Issue policy, and Runtime", async () => {
    const { service, db, repositoryAccess, repositoryReader, issueBranches } = fixture();

    const result = await service.setup(setupInput);

    expect(result).toMatchObject({ created: true, retried: false, workspace: { id: workspaceId, failure: null } });
    expect(repositoryAccess.resolve).toHaveBeenCalledWith(project);
    expect(repositoryReader.resolveBranch).toHaveBeenCalledWith(expect.objectContaining({
      branch: "main", timeoutMs: 30_000, maxRefs: 10_000, maxOutputBytes: 8 * 1024 * 1024,
    }));
    expect(issueBranches.resolve).toHaveBeenCalledWith(issue, taskId, teamId);
    expect(db.createTaskWorkspace).toHaveBeenCalledWith(expect.objectContaining({
      teamId, taskId, projectId, runtimeId, connectionId, repositoryExternalId: "42",
      configuredBaseBranch: "main", baseRef: "refs/heads/main", baseCommit: sha,
      issueProvider: "github", issueConnectionId: connectionId, issueScopeExternalId: "42", issueExternalId: "101",
    }));
  });

  it("uses the deterministic Task fallback only when the Task has no Issue", async () => {
    const noIssueTask = { ...task, issue: null };
    const { service, db, issueBranches } = fixture({ task: noIssueTask as never });

    await service.setup(setupInput);

    expect(issueBranches.resolve).not.toHaveBeenCalled();
    expect(db.createTaskWorkspace).toHaveBeenCalledWith(expect.objectContaining({
      issueProvider: null,
      issueConnectionId: null,
      issueScopeExternalId: null,
      issueExternalId: null,
      branchName: "mystra/task-12345678-000",
      branchStrategy: "mystra-task-fallback-v1",
    }));
  });

  it("fails closed for a missing Project and cross-Team Task", async () => {
    const missingProject = fixture({ task: { ...task, projectId: null } as never });
    await expect(missingProject.service.setup(setupInput)).rejects.toMatchObject({ code: "task_project_required" });
    expect(missingProject.repositoryAccess.resolve).not.toHaveBeenCalled();

    const hiddenTask = fixture({ task: undefined });
    await expect(hiddenTask.service.setup(setupInput)).rejects.toMatchObject({ code: "workspace_missing" });
    expect(hiddenTask.db.getTask).toHaveBeenCalledWith(taskId, { teamId });
  });

  it("requires an online Runtime with the declared Task repository materialization capability", async () => {
    for (const unavailableRuntime of [
      { ...runtime, status: "offline" as const },
      { ...runtime, metadata: { ...runtime.metadata, workspaceMaterialization: undefined } },
      undefined,
    ]) {
      const { service, repositoryAccess } = fixture({ runtime: unavailableRuntime as never });
      await expect(service.setup(setupInput)).rejects.toBeInstanceOf(TaskWorkspaceFailure);
      expect(repositoryAccess.resolve).not.toHaveBeenCalled();
    }
  });

  it("rejects invalid Issue branch output rather than substituting a fallback", async () => {
    const { service, db } = fixture({ branchName: "bad branch" });
    await expect(service.setup(setupInput)).rejects.toMatchObject({ code: "branch_invalid" });
    expect(db.createTaskWorkspace).not.toHaveBeenCalled();
  });

  it("converges twenty concurrent setup calls on one persisted Workspace identity", async () => {
    const { service } = fixture();
    const results = await Promise.all(Array.from({ length: 20 }, () => service.setup({
      ...setupInput,
      idempotencyKey: randomUUID(),
    })));
    expect(new Set(results.map((result) => result.workspace.id))).toEqual(new Set([workspaceId]));
  });

  it("returns an in-flight Workspace unchanged and retries only the same failed intent", async () => {
    const inFlight = fixture({ existing: workspace });
    await expect(inFlight.service.setup(setupInput)).resolves.toMatchObject({
      created: false,
      retried: false,
      workspace: { id: workspaceId, state: "queued" },
    });
    expect(inFlight.repositoryAccess.resolve).not.toHaveBeenCalled();

    const failedWorkspace = {
      ...workspace,
      state: "failed" as const,
      failureCode: "materialization_failed" as const,
      failureMessage: "checkout failed",
    };
    const failed = fixture({ existing: failedWorkspace as never });
    await expect(failed.service.setup(setupInput)).resolves.toMatchObject({
      created: false,
      retried: true,
      workspace: { id: workspaceId, state: "queued" },
    });
    expect(failed.db.retryTaskWorkspace).toHaveBeenCalledWith({ workspaceId, teamId, runtimeId });

    await expect(failed.service.setup({ ...setupInput, runtimeId: randomUUID() }))
      .rejects.toMatchObject({ code: "workspace_runtime_mismatch" });
  });

  it("resolves the same ready Task attachment repeatedly without repository or Issue side effects", async () => {
    const ready = {
      ...workspace,
      state: "ready" as const,
      workspaceRef: `host-task-workspace:${workspaceId}`,
      readyAt: "2026-08-10T00:02:00.000Z",
    };
    const { service, repositoryAccess, issueBranches, db } = fixture({ existing: ready as never });
    const input = { teamId, taskId, requestedRuntimeId: runtimeId };

    const attachments = await Promise.all(Array.from({ length: 3 }, () => (
      service.resolveSessionAttachment(input)
    )));

    expect(new Set(attachments.map((attachment) => JSON.stringify(attachment))).size).toBe(1);
    expect(attachments[0]).toEqual({
      kind: "task",
      taskWorkspaceId: workspaceId,
      runtimeId,
      workspaceRef: ready.workspaceRef,
      sharingMode: "shared-mutable",
    });
    expect(repositoryAccess.resolve).not.toHaveBeenCalled();
    expect(issueBranches.resolve).not.toHaveBeenCalled();
    expect(db.createTaskWorkspace).not.toHaveBeenCalled();

    const offline = fixture({
      existing: ready as never,
      runtime: { ...runtime, status: "offline" } as never,
    });
    await expect(offline.service.resolveSessionAttachment(input))
      .rejects.toMatchObject({ code: "runtime_unavailable" });
  });

  it("fails attachment resolution for missing, non-ready, unavailable, cross-Team, and Runtime mismatch", async () => {
    const cases = [
      { existing: undefined, runtime: runtimeId, code: "workspace_missing" },
      { existing: workspace, runtime: runtimeId, code: "workspace_not_ready" },
      {
        existing: { ...workspace, state: "unavailable", failureCode: "workspace_missing", failureMessage: "missing" },
        runtime: runtimeId,
        code: "workspace_missing",
      },
      {
        existing: { ...workspace, state: "ready", workspaceRef: `host-task-workspace:${workspaceId}`, readyAt: workspace.updatedAt },
        runtime: "00000000-0000-4000-8000-000000000099",
        code: "workspace_runtime_mismatch",
      },
    ];
    for (const value of cases) {
      const { service, db } = fixture({ existing: value.existing as never });
      await expect(service.resolveSessionAttachment({
        teamId,
        taskId,
        requestedRuntimeId: value.runtime,
      })).rejects.toMatchObject({ code: value.code });
      expect(db.createTaskWorkspace).not.toHaveBeenCalled();
    }

    const crossTeam = fixture({ existing: undefined });
    await expect(crossTeam.service.resolveSessionAttachment({
      teamId: "00000000-0000-4000-8000-000000000099",
      taskId,
      requestedRuntimeId: runtimeId,
    })).rejects.toMatchObject({ code: "workspace_missing" });
  });
});
