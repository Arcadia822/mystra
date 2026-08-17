import { describe, expect, it } from "vitest";

import { taskIssueLabel, taskTitle } from "./task-view";

const task = {
  id: "00000000-0000-4000-8000-000000000040",
  teamId: "00000000-0000-4000-8000-000000000042",
  title: "Repair build",
  description: null,
  projectId: null,
  issue: null,
  status: "pending" as const,
  metadata: {},
  runtimeId: null,
  statusRevision: 1,
  statusNote: null,
  statusUpdatedAt: "2026-08-07T00:00:00.000Z",
  statusActor: { kind: "system" as const, actorId: null, agentId: null, executionContextId: null, sessionId: null },
  createdAt: "2026-08-07T00:00:00.000Z",
  updatedAt: "2026-08-07T00:00:00.000Z",
};

describe("Task view projection", () => {
  it("uses explicit Task-owned title and exact Issue identifier", () => {
    expect(taskTitle(task)).toBe("Repair build");
    expect(taskIssueLabel(task)).toBe("none");
    expect(taskIssueLabel({ ...task, issue: {
      provider: "linear", connectionId: task.teamId, scopeExternalId: "team", externalId: "issue", identifier: "ENG-42",
    } })).toBe("ENG-42");
  });
});
