import { createHash, randomUUID } from "node:crypto";

import {
  taskExecutionContextSchema,
  taskStartRequestSchema,
  taskStatusTransitionSchema,
  type TaskExecutionContext,
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
  | "getExecutionContextByTaskId"
  | "listTaskStatusTransitions"
  | "updateExecutionContext"
>;

export class TaskProductionService {
  readonly #db: ProductionDb;
  readonly #workspace: Pick<TaskWorkspaceService, "setup" | "get">;
  readonly #sessions: Pick<SessionService, "launchExecutionContext">;
  readonly #now: () => string;
  readonly #newId: () => string;

  constructor(input: {
    db: ProductionDb;
    workspace: Pick<TaskWorkspaceService, "setup" | "get">;
    sessions: Pick<SessionService, "launchExecutionContext">;
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
      const replay = await this.#db.getExecutionContextByTaskId(task.id, { teamId: input.actor.teamId });
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
        executionContext: await this.#prepareAfterCommit(input.actor.teamId, replay),
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
    const executionContextId = this.#newId();
    const executionContext = taskExecutionContextSchema.parse({
      id: executionContextId,
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
        executionContextId,
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
        executionContext,
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

    const preparedExecutionContext = await this.#prepareAfterCommit(input.actor.teamId, assigned.executionContext);
    return { ...assigned, executionContext: preparedExecutionContext };
  }

  async continueAfterWorkspaceReady(input: { teamId: string; taskId: string }): Promise<TaskExecutionContext | undefined> {
    const executionContext = await this.#db.getExecutionContextByTaskId(input.taskId, { teamId: input.teamId });
    if (!executionContext) return undefined;
    const workspace = await this.#workspace.get({
      actor: { teamId: input.teamId },
      taskId: input.taskId,
      runtimeId: executionContext.runtimeId,
    });
    if (!workspace || workspace.state !== "ready") return executionContext;
    let current = executionContext.workspaceId === workspace.id
      ? executionContext
      : await this.#db.updateExecutionContext({ executionContextId: executionContext.id, teamId: input.teamId, workspaceId: workspace.id }) ?? executionContext;
    if (current.sessionId) return current;
    try {
      const launched = await this.#sessions.launchExecutionContext({
        actor: { actorId: `executionContext:${current.id}`, teamId: input.teamId, roles: ["owner"] },
        executionContext: current,
      });
      current = await this.#db.updateExecutionContext({
        executionContextId: current.id,
        teamId: input.teamId,
        workspaceId: workspace.id,
        sessionId: launched.session.id,
        setupFailureCode: null,
        setupFailureMessage: null,
      }) ?? current;
      return current;
    } catch {
      return await this.#db.updateExecutionContext({
        executionContextId: current.id,
        teamId: input.teamId,
        workspaceId: workspace.id,
        setupFailureCode: "session_launch_failed",
        setupFailureMessage: "Workspace is ready but the TaskExecutionContext Session could not be launched",
      }) ?? current;
    }
  }

  async #prepareAfterCommit(teamId: string, executionContext: TaskExecutionContext): Promise<TaskExecutionContext> {
    try {
      const setup = await this.#workspace.setup({
        actor: { teamId },
        taskId: executionContext.taskId,
        runtimeId: executionContext.runtimeId,
        idempotencyKey: executionContext.id,
      });
      const bound = await this.#db.updateExecutionContext({
        executionContextId: executionContext.id,
        teamId,
        workspaceId: setup.workspace.id,
        setupFailureCode: null,
        setupFailureMessage: null,
      }) ?? executionContext;
      return setup.workspace.state === "ready"
        ? await this.continueAfterWorkspaceReady({ teamId, taskId: executionContext.taskId }) ?? bound
        : bound;
    } catch {
      return await this.#db.updateExecutionContext({
        executionContextId: executionContext.id,
        teamId,
        setupFailureCode: "workspace_setup_failed",
        setupFailureMessage: "Task Workspace setup could not be requested",
      }) ?? executionContext;
    }
  }
}

function fingerprint(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
