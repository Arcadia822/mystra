import { createHash, randomUUID } from "node:crypto";

import {
  taskExecutionAttemptSchema,
  taskStartRequestSchema,
  taskStatusTransitionSchema,
  type TaskExecutionAttempt,
  type TaskStartResult,
} from "@mystra/shared";

import type { RdbProvider } from "../db/rdb-provider";
import { RdbError } from "../db/prisma-errors";
import type { SessionService } from "../sessions/session-service";
import type { TaskWorkspaceService } from "../task-workspaces/task-workspace-service";
import { withDerivedHostLiveness } from "../runtime/runtime-liveness";
import { TaskProductionFailure } from "./task-production-errors";

type ProductionDb = Pick<RdbProvider,
  | "getTask"
  | "getProjectById"
  | "getRuntime"
  | "startTaskProduction"
  | "getExecutionAttemptByTaskId"
  | "listTaskStatusTransitions"
  | "updateExecutionAttempt"
>;

export class TaskProductionService {
  readonly #db: ProductionDb;
  readonly #workspace: Pick<TaskWorkspaceService, "setup" | "get">;
  readonly #sessions: Pick<SessionService, "launchAttempt">;
  readonly #now: () => string;
  readonly #newId: () => string;

  constructor(input: {
    db: ProductionDb;
    workspace: Pick<TaskWorkspaceService, "setup" | "get">;
    sessions: Pick<SessionService, "launchAttempt">;
    now?: () => string;
    newId?: () => string;
  }) {
    this.#db = input.db;
    this.#workspace = input.workspace;
    this.#sessions = input.sessions;
    this.#now = input.now ?? (() => new Date().toISOString());
    this.#newId = input.newId ?? randomUUID;
  }

  async start(input: {
    actor: { actorId: string; teamId: string };
    taskId: string;
    request: unknown;
    launch?: { sessionId: string; manualContextText: string | null };
  }): Promise<TaskStartResult> {
    const request = taskStartRequestSchema.parse(input.request);
    const task = await this.#db.getTask(input.taskId, { teamId: input.actor.teamId });
    if (!task) throw new TaskProductionFailure("task_not_found", "Task was not found");
    const requestFingerprint = fingerprint({
      teamId: input.actor.teamId,
      actorId: input.actor.actorId,
      taskId: task.id,
      agentId: request.agentId,
      runtimeId: request.runtimeId,
      providerKey: request.providerKey,
      expectedRevision: request.expectedRevision,
      plannedSessionId: input.launch?.sessionId ?? null,
      manualContextText: input.launch?.manualContextText ?? null,
    });
    if (!task.projectId || task.status !== "pending") {
      const replay = await this.#db.getExecutionAttemptByTaskId(task.id, { teamId: input.actor.teamId });
      if (!replay || replay.assignIdempotencyKey !== request.idempotencyKey) {
        throw new TaskProductionFailure("task_not_eligible", "Task is not eligible for production Start");
      }
      if (replay.assignRequestFingerprint !== requestFingerprint) {
        throw new TaskProductionFailure("task_status_conflict", "Start idempotency key was reused with different inputs");
      }
      const transition = (await this.#db.listTaskStatusTransitions({
        taskId: task.id,
        teamId: input.actor.teamId,
        limit: 100,
      })).find((candidate) => candidate.idempotencyKey === request.idempotencyKey);
      if (!transition) throw new TaskProductionFailure("task_status_conflict", "Start audit facts are incomplete");
      return {
        task,
        transition,
        attempt: await this.#prepareAfterCommit(input.actor.teamId, replay),
        created: false,
      };
    }
    const [project, rawRuntime] = await Promise.all([
      task.projectId
        ? this.#db.getProjectById(task.projectId, { teamId: input.actor.teamId })
        : Promise.resolve(undefined),
      this.#db.getRuntime(request.runtimeId),
    ]);
    if (!project || project.archivedAt) throw new TaskProductionFailure("task_not_eligible", "Active Project is required");
    const runtime = rawRuntime ? withDerivedHostLiveness(rawRuntime) : undefined;
    if (
      !runtime
      || runtime.status !== "online"
      || !runtime.providers.some((provider) => provider.provider === request.providerKey && provider.available)
    ) {
      throw new TaskProductionFailure("runtime_unavailable", "Runtime or Provider is unavailable");
    }

    const occurredAt = this.#now();
    const attemptId = this.#newId();
    const attempt = taskExecutionAttemptSchema.parse({
      id: attemptId,
      teamId: input.actor.teamId,
      taskId: task.id,
      projectId: project.id,
      agentId: null,
      agentName: null,
      agentRevision: null,
      agentSystemPrompt: null,
      taskTitle: task.title,
      taskDescription: task.description,
      taskIssue: task.issue,
      manualContextText: input.launch?.manualContextText ?? null,
      runtimeId: runtime.id,
      providerKey: request.providerKey,
      workspaceId: null,
      plannedSessionId: input.launch?.sessionId ?? this.#newId(),
      sessionId: null,
      firstMessageId: this.#newId(),
      assignIdempotencyKey: request.idempotencyKey,
      assignRequestFingerprint: requestFingerprint,
      capabilityRevokedAt: null,
      setupFailureCode: null,
      setupFailureMessage: null,
      createdAt: occurredAt,
      updatedAt: occurredAt,
    });
    const transition = taskStatusTransitionSchema.parse({
      id: this.#newId(),
      teamId: input.actor.teamId,
      taskId: task.id,
      fromStatus: "pending",
      toStatus: "in_progress",
      revision: request.expectedRevision + 1,
      actor: {
        kind: "human",
        actorId: input.actor.actorId,
        agentId: null,
        attemptId,
        sessionId: null,
      },
      note: null,
      idempotencyKey: request.idempotencyKey,
      requestFingerprint,
      occurredAt,
    });
    let assigned;
    try {
      assigned = await this.#db.startTaskProduction({
        teamId: input.actor.teamId,
        taskId: task.id,
        agentId: request.agentId,
        expectedRevision: request.expectedRevision,
        requestFingerprint,
        attempt,
        transition,
      });
    } catch (error) {
      if (error instanceof RdbError && error.code === "AGENT_UNAVAILABLE") {
        throw new TaskProductionFailure("agent_unavailable", "Agent Context is unavailable");
      }
      if (error instanceof RdbError && error.code === "RDB_CONFLICT") {
        throw new TaskProductionFailure("task_status_conflict", "Task production Start conflicted");
      }
      throw error;
    }

    const preparedAttempt = await this.#prepareAfterCommit(input.actor.teamId, assigned.attempt);
    return { ...assigned, attempt: preparedAttempt };
  }

  async continueAfterWorkspaceReady(input: { teamId: string; taskId: string }): Promise<TaskExecutionAttempt | undefined> {
    const attempt = await this.#db.getExecutionAttemptByTaskId(input.taskId, { teamId: input.teamId });
    if (!attempt) return undefined;
    const workspace = await this.#workspace.get({
      actor: { teamId: input.teamId },
      taskId: input.taskId,
      runtimeId: attempt.runtimeId,
    });
    if (!workspace || workspace.state !== "ready") return attempt;
    let current = attempt.workspaceId === workspace.id
      ? attempt
      : await this.#db.updateExecutionAttempt({ attemptId: attempt.id, teamId: input.teamId, workspaceId: workspace.id }) ?? attempt;
    if (current.sessionId) return current;
    try {
      const launched = await this.#sessions.launchAttempt({
        actor: { actorId: `attempt:${current.id}`, teamId: input.teamId, roles: ["owner"] },
        attempt: current,
      });
      current = await this.#db.updateExecutionAttempt({
        attemptId: current.id,
        teamId: input.teamId,
        workspaceId: workspace.id,
        sessionId: launched.session.id,
        setupFailureCode: null,
        setupFailureMessage: null,
      }) ?? current;
      return current;
    } catch {
      return await this.#db.updateExecutionAttempt({
        attemptId: current.id,
        teamId: input.teamId,
        workspaceId: workspace.id,
        setupFailureCode: "session_launch_failed",
        setupFailureMessage: "Workspace is ready but the TaskExecutionAttempt Session could not be launched",
      }) ?? current;
    }
  }

  async #prepareAfterCommit(teamId: string, attempt: TaskExecutionAttempt): Promise<TaskExecutionAttempt> {
    try {
      const setup = await this.#workspace.setup({
        actor: { teamId },
        taskId: attempt.taskId,
        runtimeId: attempt.runtimeId,
        idempotencyKey: attempt.id,
      });
      const bound = await this.#db.updateExecutionAttempt({
        attemptId: attempt.id,
        teamId,
        workspaceId: setup.workspace.id,
        setupFailureCode: null,
        setupFailureMessage: null,
      }) ?? attempt;
      return setup.workspace.state === "ready"
        ? await this.continueAfterWorkspaceReady({ teamId, taskId: attempt.taskId }) ?? bound
        : bound;
    } catch {
      return await this.#db.updateExecutionAttempt({
        attemptId: attempt.id,
        teamId,
        setupFailureCode: "workspace_setup_failed",
        setupFailureMessage: "Task Workspace setup could not be requested",
      }) ?? attempt;
    }
  }
}

function fingerprint(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
