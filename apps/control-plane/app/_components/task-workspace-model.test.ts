import { describe, expect, it } from "vitest";

import { taskWorkspacePresentation } from "./task-workspace-model";

const workspace = {
  id: "00000000-0000-4000-8000-000000000001",
  taskId: "00000000-0000-4000-8000-000000000002",
  projectId: "00000000-0000-4000-8000-000000000003",
  runtimeId: "00000000-0000-4000-8000-000000000004",
  state: "queued" as const,
  sharingMode: "shared-mutable" as const,
  configuredBaseBranch: "main",
  baseRef: "refs/heads/main",
  baseCommit: "a".repeat(40),
  branchName: "mystra/task-12345678-000",
  branchStrategy: "mystra-task-fallback-v1",
  failure: null,
  createdAt: "2026-08-10T00:00:00.000Z",
  updatedAt: "2026-08-10T00:00:00.000Z",
  readyAt: null,
};

describe("Task Workspace presentation", () => {
  it("models absent, queued, preparing, ready, failed, and unavailable states", () => {
    expect(taskWorkspacePresentation(undefined, true)).toMatchObject({ state: "absent", canSetup: true, canStartSession: false });
    expect(taskWorkspacePresentation(workspace, true)).toMatchObject({ state: "queued", canSetup: false, canStartSession: false });
    expect(taskWorkspacePresentation({ ...workspace, state: "preparing" }, true)).toMatchObject({ state: "preparing", canStartSession: false });
    expect(taskWorkspacePresentation({ ...workspace, state: "ready", readyAt: workspace.updatedAt }, true)).toMatchObject({ state: "ready", canStartSession: true, runtimeLocked: true });
    expect(taskWorkspacePresentation({ ...workspace, state: "failed", failure: { code: "materialization_failed", message: "failed" } }, true)).toMatchObject({ state: "failed", canRetry: true, canStartSession: false });
    expect(taskWorkspacePresentation({ ...workspace, state: "unavailable", failure: { code: "workspace_missing", message: "missing" } }, true)).toMatchObject({ state: "unavailable", canRetry: false, canStartSession: false });
  });

  it("does not offer setup when Task lacks Project context", () => {
    expect(taskWorkspacePresentation(undefined, false)).toMatchObject({
      state: "absent",
      canSetup: false,
      reason: "task_project_required",
    });
  });
});
