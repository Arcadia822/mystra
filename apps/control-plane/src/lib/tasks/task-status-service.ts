import { createHash, randomUUID } from "node:crypto";

import {
  isTaskStatusTransitionAllowed,
  taskStatusTransitionRequestSchema,
  type TaskStatus,
  type TaskStatusActor,
  type TaskStatusTransition,
  type TaskStatusTransitionResult,
  type TaskTransitionActor,
} from "@mystra/shared";

import type { RdbProvider } from "../db/rdb-provider";
import { RdbError } from "../db/prisma-errors";
import { TaskProductionFailure } from "./task-production-errors";

type TaskStatusDb = Pick<RdbProvider,
  "getTask" | "transitionTaskStatus" | "listTaskStatusTransitions"
>;

export class TaskStatusService {
  readonly #db: TaskStatusDb;
  readonly #now: () => string;
  readonly #newId: () => string;

  constructor(input: { db: TaskStatusDb; now?: () => string; newId?: () => string }) {
    this.#db = input.db;
    this.#now = input.now ?? (() => new Date().toISOString());
    this.#newId = input.newId ?? randomUUID;
  }

  async get(input: { teamId: string; taskId: string; actorPolicy: TaskTransitionActor }) {
    const task = await this.#db.getTask(input.taskId, { teamId: input.teamId });
    if (!task) throw new TaskProductionFailure("task_not_found", "Task was not found");
    return {
      taskId: task.id,
      status: task.status,
      statusRevision: task.statusRevision,
      statusNote: task.statusNote,
      statusUpdatedAt: task.statusUpdatedAt,
      allowedTransitions: taskTransitions(input.actorPolicy, task.status),
    };
  }

  async transition(input: {
    teamId: string;
    taskId: string;
    actorPolicy: Exclude<TaskTransitionActor, "assign">;
    actor: TaskStatusActor;
    request: unknown;
  }): Promise<TaskStatusTransitionResult> {
    const parsed = taskStatusTransitionRequestSchema.safeParse(input.request);
    if (!parsed.success) {
      const missingNote = parsed.error.issues.some((issue) => issue.path[0] === "note");
      throw new TaskProductionFailure(
        missingNote ? "missing_status_note" : "invalid_request",
        missingNote ? "A non-empty status note is required" : "Task status request is invalid",
      );
    }
    const task = await this.#db.getTask(input.taskId, { teamId: input.teamId });
    if (!task) throw new TaskProductionFailure("task_not_found", "Task was not found");
    if (
      task.statusRevision === parsed.data.expectedRevision
      && !isTaskStatusTransitionAllowed(input.actorPolicy, task.status, parsed.data.status)
    ) {
      throw new TaskProductionFailure("invalid_transition", "Task status transition is not allowed");
    }
    const occurredAt = this.#now();
    const requestFingerprint = fingerprint({
      actorPolicy: input.actorPolicy,
      actor: input.actor,
      status: parsed.data.status,
      expectedRevision: parsed.data.expectedRevision,
      note: parsed.data.note ?? null,
    });
    const transition: TaskStatusTransition = {
      id: this.#newId(),
      teamId: input.teamId,
      taskId: task.id,
      fromStatus: task.status,
      toStatus: parsed.data.status,
      revision: parsed.data.expectedRevision + 1,
      actor: input.actor,
      note: parsed.data.note ?? null,
      idempotencyKey: parsed.data.idempotencyKey,
      requestFingerprint,
      occurredAt,
    };
    try {
      const result = await this.#db.transitionTaskStatus({
        teamId: input.teamId,
        taskId: task.id,
        actorPolicy: input.actorPolicy,
        expectedRevision: parsed.data.expectedRevision,
        transition,
      });
      return {
        taskId: task.id,
        status: result.transition.toStatus,
        statusRevision: result.transition.revision,
        statusUpdatedAt: result.transition.occurredAt,
        transitionId: result.transition.id,
      };
    } catch (error) {
      if (error instanceof RdbError && error.code === "RDB_CONFLICT") {
        throw new TaskProductionFailure("task_status_conflict", "Task status changed or idempotency input conflicted");
      }
      throw error;
    }
  }

  listHistory(input: { teamId: string; taskId: string; limit?: number }) {
    return this.#db.listTaskStatusTransitions(input);
  }
}

function fingerprint(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function taskTransitions(
  actor: TaskTransitionActor,
  from: TaskStatus,
): TaskStatus[] {
  const candidates: TaskStatus[] = [
    "pending", "in_progress", "blocked", "done", "canceled",
  ];
  return candidates.filter((to) => isTaskStatusTransitionAllowed(actor, from, to));
}
