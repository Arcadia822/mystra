import { describe, expect, it } from "vitest";

import {
  gitRemoteRefAdvertisementSchema,
  projectRepositoryBranchQuerySchema,
  sessionWorkspaceAttachmentSchema,
  taskWorkspaceSetupRequestSchema,
  taskWorkspaceTrustedSchema,
  taskWorkspaceViewSchema,
  workspacePreparationClaimSchema,
  workspacePreparationClaimRequestSchema,
  workspacePreparationReportSchema,
} from "./task-workspace.js";

const ids = {
  workspace: "00000000-0000-4000-8000-000000000001",
  task: "00000000-0000-4000-8000-000000000002",
  project: "00000000-0000-4000-8000-000000000003",
  runtime: "00000000-0000-4000-8000-000000000004",
  connection: "00000000-0000-4000-8000-000000000005",
  attempt: "00000000-0000-4000-8000-000000000006",
  runner: "00000000-0000-4000-8000-000000000007",
  key: "00000000-0000-4000-8000-000000000009",
} as const;

const timestamp = "2026-08-10T04:00:00.000Z";

const workspace = {
  id: ids.workspace,
  teamId: "00000000-0000-4000-8000-000000000010",
  taskId: ids.task,
  projectId: ids.project,
  runtimeId: ids.runtime,
  state: "ready",
  sharingMode: "shared-mutable",
  connectionId: ids.connection,
  repositoryExternalId: "R_kgDOFixture",
  configuredBaseBranch: "main",
  issueProvider: "github",
  issueConnectionId: ids.connection,
  issueScopeExternalId: "R_kgDOFixture",
  issueExternalId: "I_kwDOFixture",
  baseRef: "refs/heads/main",
  baseCommit: "0123456789abcdef0123456789abcdef01234567",
  branchName: "mystra/github-gh-42-workspace",
  branchStrategy: "github-issue-v1",
  workspaceRef: "host-task-workspace:00000000-0000-4000-8000-000000000001",
  activeAttemptSequence: 1,
  failureCode: null,
  failureMessage: null,
  createdAt: timestamp,
  updatedAt: timestamp,
  readyAt: timestamp,
} as const;

describe("Task Workspace contracts", () => {
  it("bounds runner claim polling", () => {
    expect(workspacePreparationClaimRequestSchema.parse({ runnerId: ids.runner })).toEqual({
      runnerId: ids.runner,
      waitSeconds: 0,
    });
    expect(() => workspacePreparationClaimRequestSchema.parse({
      runnerId: ids.runner,
      waitSeconds: 26,
    })).toThrow();
  });

  it("keeps the operator setup request narrow and strict", () => {
    expect(taskWorkspaceSetupRequestSchema.parse({
      runtimeId: ids.runtime,
      idempotencyKey: ids.key,
    })).toEqual({ runtimeId: ids.runtime, idempotencyKey: ids.key });

    for (const forbidden of [
      { branchName: "caller/branch" },
      { baseRef: "refs/heads/main" },
      { cloneUrl: "https://example.invalid/repo.git" },
      { workspacePath: "/tmp/repo" },
    ]) {
      expect(() => taskWorkspaceSetupRequestSchema.parse({
        runtimeId: ids.runtime,
        idempotencyKey: ids.key,
        ...forbidden,
      })).toThrow();
    }
  });

  it("separates the public view from the trusted opaque reference", () => {
    expect(taskWorkspaceTrustedSchema.parse(workspace).workspaceRef).toBe(workspace.workspaceRef);

    const { teamId: _teamId, connectionId: _connectionId, repositoryExternalId: _repositoryExternalId,
      issueProvider: _issueProvider, issueConnectionId: _issueConnectionId,
      issueScopeExternalId: _issueScopeExternalId, issueExternalId: _issueExternalId,
      activeAttemptSequence: _activeAttemptSequence,
      failureCode, failureMessage, workspaceRef: _workspaceRef, ...publicFields } = workspace;
    const view = taskWorkspaceViewSchema.parse({
      ...publicFields,
      failure: failureCode === null ? null : { code: failureCode, message: failureMessage },
    });

    expect(view.state).toBe("ready");
    expect("workspaceRef" in view).toBe(false);
    expect("connectionId" in view).toBe(false);
  });

  it("requires an opaque reference exactly when a trusted Workspace is ready", () => {
    expect(() => taskWorkspaceTrustedSchema.parse({ ...workspace, workspaceRef: null })).toThrow();
    expect(() => taskWorkspaceTrustedSchema.parse({
      ...workspace,
      state: "failed",
      workspaceRef: workspace.workspaceRef,
      readyAt: null,
      failureCode: "materialization_failed",
      failureMessage: "Git checkout failed",
    })).toThrow();
  });

  it("models only the ready Task Workspace attachment without paths", () => {
    const taskAttachment = sessionWorkspaceAttachmentSchema.parse({
      kind: "task",
      taskWorkspaceId: ids.workspace,
      runtimeId: ids.runtime,
      workspaceRef: workspace.workspaceRef,
      sharingMode: "shared-mutable",
    });

    expect(taskAttachment.kind).toBe("task");
    expect(() => sessionWorkspaceAttachmentSchema.parse({
      ...taskAttachment,
      workspacePath: "/var/lib/mystra/workspace",
    })).toThrow();
  });

  it("parses a bounded standard Git ref advertisement", () => {
    const parsed = gitRemoteRefAdvertisementSchema.parse({
      head: {
        name: "main",
        ref: "refs/heads/main",
        commit: workspace.baseCommit,
      },
      branches: [
        { name: "main", ref: "refs/heads/main", commit: workspace.baseCommit },
        { name: "release/0.1", ref: "refs/heads/release/0.1", commit: "f".repeat(40) },
      ],
    });
    expect(parsed.head?.name).toBe("main");
    expect(() => gitRemoteRefAdvertisementSchema.parse({
      head: null,
      branches: [{ name: "tag", ref: "refs/tags/v1", commit: workspace.baseCommit }],
    })).toThrow();
  });

  it("defaults branch pagination and rejects unbounded queries", () => {
    expect(projectRepositoryBranchQuerySchema.parse({})).toEqual({ first: 50 });
    expect(projectRepositoryBranchQuerySchema.parse({ first: "100", query: " release " })).toEqual({
      first: 100,
      query: "release",
    });
    expect(() => projectRepositoryBranchQuerySchema.parse({ first: 101 })).toThrow();
    expect(() => projectRepositoryBranchQuerySchema.parse({ query: "x".repeat(201) })).toThrow();
  });

  it("keeps credentials transient in claim and forbids them in reports", () => {
    const claim = workspacePreparationClaimSchema.parse({
      workspaceId: ids.workspace,
      attemptId: ids.attempt,
      attemptSequence: 1,
      leaseExpiresAt: timestamp,
      workspaceRef: workspace.workspaceRef,
      repository: {
        provider: "github",
        connectionId: ids.connection,
        repositoryExternalId: workspace.repositoryExternalId,
        baseRef: workspace.baseRef,
        baseCommit: workspace.baseCommit,
        transport: { kind: "https", endpoint: "https://github.com/example/repo.git" },
      },
      branch: { name: workspace.branchName, strategy: workspace.branchStrategy },
      credential: { kind: "http-basic-token", secret: "transient-token" },
    });
    expect(claim.credential.secret).toBe("transient-token");

    expect(workspacePreparationReportSchema.parse({
      runnerId: ids.runner,
      attemptSequence: 1,
      status: "succeeded",
      workspaceRef: workspace.workspaceRef,
      observed: { baseCommit: workspace.baseCommit, branchName: workspace.branchName },
    }).status).toBe("succeeded");
    expect(() => workspacePreparationReportSchema.parse({
      runnerId: ids.runner,
      attemptSequence: 1,
      status: "failed",
      failure: { code: "materialization_failed", message: "safe" },
      credential: { secret: "must-not-return" },
    })).toThrow();
  });
});
