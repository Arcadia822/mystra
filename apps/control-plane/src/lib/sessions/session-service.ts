import { randomUUID } from "node:crypto";

import {
  sessionLaunchRequestSchema,
  sessionSendMessageRequestSchema,
  sessionSchema,
  taskSessionLaunchInputSchema,
  type RuntimeView,
  type TaskExecutionContext,
  type ResolvedAgentSnapshot,
  type Session,
  type SessionEvent,
  type SessionEventInput,
  type SessionLaunchRequest,
  type SessionSubject,
  type SessionWorkspaceAttachment,
  type TaskSessionLaunchInput,
  type TaskRecord,
  type TaskWorkspaceView,
} from "@mystra/shared";

import type { RdbProvider } from "../db/rdb-provider";
import { RdbError } from "../db/prisma-errors";
import { TaskWorkspaceFailure } from "../task-workspaces/task-workspace-errors";
import { assembleTaskExecutionContextSystemPrompt, assembleSystemPrompt } from "./system-prompt-assembler";
import { SessionFailure } from "./session-errors";

type SessionDb = Pick<RdbProvider,
  "getTask" | "getProjectById" | "resolveActiveAgent" | "getRuntime" | "createSessionWithEvents" |
  "getSession" | "listSessions" | "appendSessionEvents" | "listSessionEvents"
>;

type WorkspaceResolver = {
  get(input: { actor: { teamId: string }; taskId: string; runtimeId: string }): Promise<TaskWorkspaceView | undefined>;
  resolveSessionAttachment(input: { teamId: string; taskId: string; requestedRuntimeId: string }): Promise<SessionWorkspaceAttachment>;
};

export class SessionService {
  readonly #db: SessionDb;
  readonly #workspace: WorkspaceResolver;
  readonly #runtimeResolver: (id: string) => Promise<RuntimeView | undefined>;
  readonly #now: () => string;
  readonly #newId: () => string;

  constructor(input: {
    db: SessionDb;
    workspace: WorkspaceResolver;
    runtimeResolver?: (id: string) => Promise<RuntimeView | undefined>;
    now?: () => string;
    newId?: () => string;
  }) {
    this.#db = input.db;
    this.#workspace = input.workspace;
    this.#runtimeResolver = input.runtimeResolver ?? ((id) => input.db.getRuntime(id));
    this.#now = input.now ?? (() => new Date().toISOString());
    this.#newId = input.newId ?? randomUUID;
  }

  async launch(input: {
    actor: SessionSubject;
    request: SessionLaunchRequest;
    frozenAgent?: ResolvedAgentSnapshot | null;
    frozenTask?: TaskRecord;
    executionContextBootstrap?: boolean;
  }): Promise<{ session: Session; created: boolean }> {
    const request = sessionLaunchRequestSchema.parse(input.request);
    const [task, agent, runtime, project] = await Promise.all([
      this.#db.getTask(request.context.taskId, { teamId: input.actor.teamId }),
      input.frozenAgent !== undefined
        ? Promise.resolve(input.frozenAgent)
        : request.agentId === null
          ? Promise.resolve(null)
          : this.#db.resolveActiveAgent(request.agentId, { teamId: input.actor.teamId }).catch((error: unknown) => {
          if (error instanceof RdbError && error.code === "AGENT_ARCHIVED") return undefined;
          throw error;
        }),
      this.#runtimeResolver(request.runtimeId),
      request.context.projectId
        ? this.#db.getProjectById(request.context.projectId, { teamId: input.actor.teamId })
        : Promise.resolve(undefined),
    ]);
    if (!task) throw new SessionFailure("task_not_found", "Task was not found");
    if (request.agentId !== null && !agent) throw new SessionFailure("agent_unavailable", "Agent is unavailable");
    if ((agent?.agentId ?? null) !== request.agentId) {
      throw new SessionFailure("agent_unavailable", "Frozen Agent Context does not match request");
    }
    this.#validateProject(request, task, project);
    this.#validateRuntime(request, runtime);

    let workspace: SessionWorkspaceAttachment;
    try {
      workspace = await this.#workspace.resolveSessionAttachment({
        teamId: input.actor.teamId,
        taskId: task.id,
        requestedRuntimeId: request.runtimeId,
      });
    } catch (error) {
      if (error instanceof TaskWorkspaceFailure && (
        error.code === "workspace_not_ready"
        || error.code === "workspace_missing"
        || error.code === "workspace_runtime_mismatch"
      )) {
        throw new SessionFailure(error.code, error.message);
      }
      throw new SessionFailure("workspace_unavailable", "Ready Task Workspace is unavailable");
    }
    const agentContext = agent ? {
      agentId: agent.agentId,
      name: agent.name,
      revision: agent.revision,
      systemPrompt: agent.systemPrompt,
    } : null;
    const prompt = input.executionContextBootstrap
      ? assembleTaskExecutionContextSystemPrompt({ runtime: runtime!, providerKey: request.providerKey, agentContext })
      : assembleSystemPrompt({
          runtime: runtime!,
          providerKey: request.providerKey,
          agentContext,
          task: input.frozenTask ?? task,
          project: project ?? null,
          ...(request.context.manual ? { manualContext: request.context.manual } : {}),
        });
    const timestamp = this.#now();
    const session = sessionSchema.parse({
      id: request.sessionId,
      teamId: input.actor.teamId,
      taskId: task.id,
      projectId: request.context.projectId ?? null,
      runtimeId: request.runtimeId,
      providerKey: request.providerKey,
      agentId: agent?.agentId ?? null,
      agentRevision: agent?.revision ?? null,
      state: "queued",
      activeMessageId: request.firstUserMessage.messageId,
      lastMessageId: null,
      interruptKind: null,
      continuationMode: null,
      failureCode: null,
      metadata: request.metadata,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    const events = this.#initialEvents(session, request, prompt, workspace, timestamp);
    try {
      return await this.#db.createSessionWithEvents({ session, launchRequest: request, events });
    } catch (error) {
      if (error instanceof RdbError && error.code === "RDB_CONFLICT") {
        throw new SessionFailure("session_conflict", "sessionId was reused with different launch inputs");
      }
      throw error;
    }
  }

  async launchExecutionContext(input: {
    actor: SessionSubject;
    executionContext: TaskExecutionContext;
  }): Promise<{ session: Session; created: boolean }> {
    return this.launch({
      actor: input.actor,
      executionContextBootstrap: true,
      frozenAgent: input.executionContext.agentId === null ? null : {
        agentId: input.executionContext.agentId,
        name: input.executionContext.agentName!,
        revision: input.executionContext.agentRevision!,
        systemPrompt: input.executionContext.agentSystemPrompt!,
      },
      request: {
        sessionId: input.executionContext.plannedSessionId,
        runtimeId: input.executionContext.runtimeId,
        providerKey: input.executionContext.providerKey,
        agentId: input.executionContext.agentId,
        context: {
          taskId: input.executionContext.taskId,
          projectId: input.executionContext.projectId,
          ...(input.executionContext.manualContextText
            ? { manual: { text: input.executionContext.manualContextText } }
            : {}),
        },
        firstUserMessage: {
          messageId: input.executionContext.firstMessageId,
          content: [{ type: "text", text: "Complete this Task: implement the code change, self-test it, create the PR with gh, and report the Task production status." }],
        },
        metadata: { executionContextId: input.executionContext.id, mode: "goal-autopilot" },
      },
    });
  }

  async launchForTask(input: {
    actor: SessionSubject;
    taskId: string;
    request: TaskSessionLaunchInput;
  }): Promise<{ session: Session; created: boolean }> {
    const request = taskSessionLaunchInputSchema.parse(input.request);
    const task = await this.#db.getTask(input.taskId, { teamId: input.actor.teamId });
    if (!task) throw new SessionFailure("task_not_found", "Task was not found");
    if (!task.runtimeId) {
      throw new SessionFailure("workspace_missing", "Task Runtime Context is not initialized");
    }
    const workspace = await this.#workspace.get({
      actor: { teamId: input.actor.teamId },
      taskId: task.id,
      runtimeId: task.runtimeId,
    });
    if (!workspace || workspace.state === "unavailable") {
      throw new SessionFailure("workspace_missing", "Task Workspace has not been set up");
    }
    if (workspace.state !== "ready") throw new SessionFailure("workspace_not_ready", "Task Workspace is not ready");
    return this.launch({
      actor: input.actor,
      request: {
        sessionId: request.sessionId,
        runtimeId: workspace.runtimeId,
        providerKey: request.providerKey,
        agentId: request.agentId,
        context: {
          taskId: task.id,
          ...(task.projectId ? { projectId: task.projectId } : {}),
          ...(request.manualContext ? { manual: { text: request.manualContext.text } } : {}),
        },
        firstUserMessage: {
          messageId: this.#newId(),
          content: [{
            type: "text",
            text: "Execute this Task using its frozen context and Workspace. Complete the requested work and report the result.",
          }],
        },
        metadata: {},
      },
    });
  }

  async get(input: { actor: SessionSubject; sessionId: string }): Promise<Session> {
    const session = await this.#db.getSession(input.sessionId, { teamId: input.actor.teamId });
    if (!session) throw new SessionFailure("session_not_found", "Session was not found");
    return session;
  }

  async list(input: { actor: SessionSubject; taskId?: string; limit?: number; cursor?: string }): Promise<Session[]> {
    if (input.taskId && !await this.#db.getTask(input.taskId, { teamId: input.actor.teamId })) {
      throw new SessionFailure("task_not_found", "Task was not found");
    }
    return this.#db.listSessions({ teamId: input.actor.teamId, ...input.taskId ? { taskId: input.taskId } : {}, ...input.limit ? { limit: input.limit } : {}, ...input.cursor ? { cursor: input.cursor } : {} });
  }

  async listEvents(input: {
    actor: SessionSubject;
    sessionId: string;
    afterSequence?: number;
    beforeSequence?: number;
    order?: "asc" | "desc";
    messageId?: string;
    limit?: number;
  }) {
    return this.#db.listSessionEvents({
      sessionId: input.sessionId,
      teamId: input.actor.teamId,
      ...(input.afterSequence !== undefined ? { afterSequence: input.afterSequence } : {}),
      ...(input.beforeSequence !== undefined ? { beforeSequence: input.beforeSequence } : {}),
      ...(input.order ? { order: input.order } : {}),
      ...(input.messageId ? { messageId: input.messageId } : {}),
      ...(input.limit ? { limit: input.limit } : {}),
    });
  }

  async sendMessage(input: { actor: SessionSubject; sessionId: string; request: unknown }): Promise<{ session: Session; created: boolean }> {
    const request = sessionSendMessageRequestSchema.parse(input.request);
    const session = await this.get({ actor: input.actor, sessionId: input.sessionId });
    const page = await this.#db.listSessionEvents({ sessionId: session.id, teamId: input.actor.teamId, messageId: request.messageId, limit: 2 });
    const previous = page.events.find((event) => event.kind === "session.user_message_submitted" && event.messageId === request.messageId);
    if (previous) {
      if (JSON.stringify(previous.payload) === JSON.stringify({ content: request.content, ...(request.inReplyToMessageId ? { inReplyToMessageId: request.inReplyToMessageId } : {}) })) {
        return { session, created: false };
      }
      throw new SessionFailure("session_conflict", "messageId was reused with different content");
    }
    if (session.state === "closed" || session.state === "failed") {
      throw new SessionFailure("session_terminal", "Terminal Session cannot accept messages");
    }
    if (session.state !== "ready" && !(session.state === "interrupted" && session.continuationMode === "new_message")) {
      throw new SessionFailure("session_busy", "Session is already processing a message");
    }
    const event: SessionEventInput = {
      eventId: this.#newId(),
      sessionId: session.id,
      sourceId: `control-plane:message:${request.messageId}`,
      sourceSequence: 1,
      kind: "session.user_message_submitted",
      version: 1,
      messageId: request.messageId,
      payload: { content: request.content, ...(request.inReplyToMessageId ? { inReplyToMessageId: request.inReplyToMessageId } : {}) },
      metadata: {},
      occurredAt: this.#now(),
    };
    try {
      return {
        session: (await this.#db.appendSessionEvents({ sessionId: session.id, teamId: input.actor.teamId, events: [event] })).session,
        created: true,
      };
    } catch (error) {
      if (error instanceof RdbError && error.code === "RDB_CONFLICT") {
        throw new SessionFailure("session_conflict", "Session message conflicted with concurrent state");
      }
      throw error;
    }
  }

  async close(input: { actor: SessionSubject; sessionId: string; reason?: string }): Promise<Session> {
    const session = await this.get({ actor: input.actor, sessionId: input.sessionId });
    if (session.state === "closed" || session.state === "failed") return session;
    const timestamp = this.#now();
    const sourceId = `control-plane:close:${session.id}`;
    const events: SessionEventInput[] = [
      { eventId: this.#newId(), sessionId: session.id, sourceId, sourceSequence: 1, kind: "session.close_requested", version: 1, payload: input.reason ? { reason: input.reason } : {}, metadata: {}, occurredAt: timestamp },
      { eventId: this.#newId(), sessionId: session.id, sourceId, sourceSequence: 2, kind: "session.closed", version: 1, payload: input.reason ? { reason: input.reason } : {}, metadata: {}, occurredAt: timestamp },
    ];
    return (await this.#db.appendSessionEvents({ sessionId: session.id, teamId: input.actor.teamId, events })).session;
  }

  #validateProject(
    request: SessionLaunchRequest,
    task: TaskRecord,
    project: Awaited<ReturnType<RdbProvider["getProjectById"]>>,
  ): void {
    if ((request.context.projectId ?? null) !== task.projectId) {
      throw new SessionFailure("task_project_mismatch", "Session Project must match the Task Project");
    }
    if (request.context.projectId && !project) {
      throw new SessionFailure("project_not_found", "Project was not found");
    }
  }

  #validateRuntime(request: SessionLaunchRequest, runtime: RuntimeView | undefined): void {
    if (!runtime || runtime.status !== "online") throw new SessionFailure("runtime_unavailable", "Runtime is unavailable");
    const provider = runtime.providers.find((candidate) => candidate.provider === request.providerKey);
    if (!provider?.available) throw new SessionFailure("provider_unavailable", "Provider is unavailable on Runtime");
  }

  #initialEvents(
    session: Session,
    request: SessionLaunchRequest,
    prompt: ReturnType<typeof assembleSystemPrompt>,
    workspace: SessionWorkspaceAttachment,
    timestamp: string,
  ): SessionEvent[] {
    const definitions: Array<{ kind: SessionEvent["kind"]; messageId?: string; payload: SessionEvent["payload"] }> = [
      { kind: "session.created", payload: { runtimeId: session.runtimeId, providerKey: session.providerKey, agentContext: prompt.agentContext, taskId: session.taskId, projectId: session.projectId, context: { taskId: request.context.taskId, ...(request.context.projectId ? { projectId: request.context.projectId } : {}), ...(request.context.manual ? { manual: request.context.manual } : {}) } } },
      { kind: "session.system_prompt_configured", payload: prompt },
      { kind: "session.workspace_attached", payload: workspace },
      { kind: "session.user_message_submitted", messageId: request.firstUserMessage.messageId, payload: { content: request.firstUserMessage.content } },
    ];
    return definitions.map((definition, index) => ({
      eventId: this.#newId(), sessionId: session.id, sourceId: "control-plane", sourceSequence: index + 1,
      globalSequence: index + 1, kind: definition.kind, version: 1, ...(definition.messageId ? { messageId: definition.messageId } : {}),
      payload: definition.payload, metadata: {}, occurredAt: timestamp, acceptedAt: timestamp,
    }));
  }
}
