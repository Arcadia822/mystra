import { describe, expect, it, vi } from "vitest";

import { RdbError } from "../db/prisma-errors";
import { TaskStatusService } from "./task-status-service";

const ids = {
  team: "00000000-0000-4000-8000-000000000001",
  task: "00000000-0000-4000-8000-000000000002",
  agent: "00000000-0000-4000-8000-000000000003",
  harness: "00000000-0000-4000-8000-000000000004",
  session: "00000000-0000-4000-8000-000000000005",
  transition: "00000000-0000-4000-8000-000000000006",
};

function task(status: "in_progress" | "blocked" = "in_progress", revision = 2) {
  return {
    id: ids.task, teamId: ids.team, title: "Task", description: null, projectId: null, issue: null,
    productionStatus: status, statusRevision: revision, statusNote: null,
    statusUpdatedAt: "2026-08-11T00:00:00.000Z",
    statusActor: { kind: "system" as const, actorId: null, agentId: null, harnessId: null, sessionId: null },
    createdAt: "2026-08-11T00:00:00.000Z", updatedAt: "2026-08-11T00:00:00.000Z",
  };
}

describe("TaskStatusService", () => {
  it("applies the Agent allowlist and returns transition identity", async () => {
    const transitionTaskStatus = vi.fn(async (input) => ({ task: task("blocked", 3), transition: input.transition, created: true }));
    const service = new TaskStatusService({
      db: { getTask: vi.fn(async () => task()), transitionTaskStatus, listTaskStatusTransitions: vi.fn() },
      now: () => "2026-08-11T00:01:00.000Z",
      newId: () => ids.transition,
    });
    await expect(service.transition({
      teamId: ids.team,
      taskId: ids.task,
      actorPolicy: "agent",
      actor: { kind: "agent", actorId: null, agentId: ids.agent, harnessId: ids.harness, sessionId: ids.session },
      request: { status: "blocked", expectedRevision: 2, idempotencyKey: "cmd-1", note: "Waiting" },
    })).resolves.toEqual({
      taskId: ids.task,
      productionStatus: "blocked",
      statusRevision: 3,
      statusUpdatedAt: "2026-08-11T00:01:00.000Z",
      transitionId: ids.transition,
    });
    expect(transitionTaskStatus).toHaveBeenCalledWith(expect.objectContaining({ actorPolicy: "agent", expectedRevision: 2 }));
  });

  it("rejects missing notes, forbidden transitions, and stale writes with stable errors", async () => {
    const db = {
      getTask: vi.fn(async () => task()),
      transitionTaskStatus: vi.fn(async () => { throw new RdbError("RDB_CONFLICT", "race"); }),
      listTaskStatusTransitions: vi.fn(),
    };
    const service = new TaskStatusService({ db });
    const actor = { kind: "agent" as const, actorId: null, agentId: ids.agent, harnessId: ids.harness, sessionId: ids.session };
    await expect(service.transition({ teamId: ids.team, taskId: ids.task, actorPolicy: "agent", actor, request: { status: "blocked", expectedRevision: 2, idempotencyKey: "cmd-1" } }))
      .rejects.toMatchObject({ code: "missing_status_note" });
    await expect(service.transition({ teamId: ids.team, taskId: ids.task, actorPolicy: "agent", actor, request: { status: "done", expectedRevision: 2, idempotencyKey: "cmd-2" } }))
      .rejects.toMatchObject({ code: "invalid_transition" });
    await expect(service.transition({ teamId: ids.team, taskId: ids.task, actorPolicy: "agent", actor, request: { status: "blocked", expectedRevision: 1, idempotencyKey: "cmd-3", note: "Waiting" } }))
      .rejects.toMatchObject({ code: "task_status_conflict" });
  });
});
