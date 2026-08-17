import { describe, expect, it } from "vitest";

import {
  SESSION_STATE_LABELS,
  TASK_DETAIL_MAIN_FIXTURE,
  TASK_STATUS_LABELS,
  WORKSPACE_STATE_LABELS,
} from "./task-detail-main-model";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const isoDateTimePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;

describe("054 Task detail main fixture", () => {
  it("uses the feature 054 five-state Task vocabulary", () => {
    expect(Object.keys(TASK_STATUS_LABELS)).toEqual([
      "pending",
      "in_progress",
      "blocked",
      "done",
      "canceled",
    ]);
    expect(TASK_STATUS_LABELS.blocked).toBe("Needs handoff");
    expect(TASK_STATUS_LABELS).not.toHaveProperty("waiting_for_review");
  });

  it("keeps Session execution states distinct from Task business state", () => {
    expect(Object.keys(SESSION_STATE_LABELS)).toEqual([
      "queued",
      "dispatched",
      "message_pending",
      "running",
      "ready",
      "interrupted",
      "waiting_for_handoff",
      "closed",
      "failed",
    ]);
    expect(SESSION_STATE_LABELS.ready).toBe("Ready to continue");
    expect(TASK_DETAIL_MAIN_FIXTURE.task.status).toBe("in_progress");
    expect(TASK_DETAIL_MAIN_FIXTURE.sessions.some(({ state }) => state === "failed")).toBe(true);
  });

  it("supports the three independent-state acceptance combinations", () => {
    const combinations = [
      { task: "in_progress", session: "failed", workspace: "ready" },
      { task: "blocked", session: "ready", workspace: "ready" },
      { task: "in_progress", session: "running", workspace: "failed" },
    ] as const;

    expect(combinations.map(({ task }) => TASK_STATUS_LABELS[task])).toEqual([
      "In progress",
      "Needs handoff",
      "In progress",
    ]);
    expect(combinations.map(({ session }) => SESSION_STATE_LABELS[session])).toEqual([
      "Failed",
      "Ready to continue",
      "Running",
    ]);
    expect(combinations.map(({ workspace }) => WORKSPACE_STATE_LABELS[workspace])).toEqual([
      "Ready",
      "Ready",
      "Failed",
    ]);
  });

  it("uses canonical identities, relations, timestamps, and public Workspace fields", () => {
    const { attempt, sessions, task, workspace } = TASK_DETAIL_MAIN_FIXTURE;
    expect(task.id).toMatch(uuidPattern);
    expect(task.teamId).toMatch(uuidPattern);
    expect(task.projectId).toMatch(uuidPattern);
    expect(task.statusUpdatedAt).toMatch(isoDateTimePattern);

    expect(attempt).not.toBeNull();
    expect(attempt?.id).toMatch(uuidPattern);
    expect(attempt?.taskId).toBe(task.id);
    expect(attempt?.workspaceId).toBe(workspace?.id);
    expect(sessions.map(({ id }) => id)).toContain(attempt?.sessionId);

    expect(workspace?.taskId).toBe(task.id);
    expect(workspace?.state).toBe("ready");
    expect(workspace?.sharingMode).toBe("shared-mutable");
    expect(workspace?.baseRef).toBe("refs/heads/main");
    expect(workspace?.baseCommit).toMatch(/^[0-9a-f]{40}$/u);
    expect(workspace?.readyAt).toMatch(isoDateTimePattern);
    expect(WORKSPACE_STATE_LABELS[workspace?.state ?? "queued"]).toBe("Ready");

    for (const session of sessions) {
      expect(session.id).toMatch(uuidPattern);
      expect(session.taskId).toBe(task.id);
      expect(session.createdAt).toMatch(isoDateTimePattern);
      expect(session.updatedAt).toMatch(isoDateTimePattern);
      expect(session.agentId === null).toBe(session.agentRevision === null);
    }
  });

  it("does not invent current attempt or current Session fields", () => {
    expect(TASK_DETAIL_MAIN_FIXTURE.task).not.toHaveProperty("currentAttempt");
    expect(TASK_DETAIL_MAIN_FIXTURE.task).not.toHaveProperty("currentSessionId");
    expect(TASK_DETAIL_MAIN_FIXTURE.attempt).not.toHaveProperty("status");
    expect(TASK_DETAIL_MAIN_FIXTURE.workspace).not.toHaveProperty("workspaceRef");
    expect(TASK_DETAIL_MAIN_FIXTURE.workspace).not.toHaveProperty("repositoryFullName");
    for (const session of TASK_DETAIL_MAIN_FIXTURE.sessions) expect(session).not.toHaveProperty("title");
  });
});
