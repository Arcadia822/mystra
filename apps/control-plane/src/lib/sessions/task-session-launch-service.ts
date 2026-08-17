import {
  taskSessionLaunchInputSchema,
  type RuntimeView,
  type SessionSubject,
  type TaskSessionLaunchInput,
  type TaskSessionLaunchResponse,
} from "@mystra/shared";

import type { RdbProvider } from "../db/rdb-provider";
import { withDerivedHostLiveness } from "../runtime/runtime-liveness";
import type { TaskWorkspaceService } from "../task-workspaces/task-workspace-service";
import type { TaskProductionService } from "../tasks/task-production-service";
import { TaskWorkspaceFailure } from "../task-workspaces/task-workspace-errors";
import { SessionFailure } from "./session-errors";
import type { SessionService } from "./session-service";

type LaunchDb = Pick<
  RdbProvider,
  "getTask" | "listRuntimes" | "getExecutionContextByTaskId" | "getSession"
>;

export class TaskSessionLaunchService {
  readonly #db: LaunchDb;
  readonly #workspace: Pick<TaskWorkspaceService, "setup">;
  readonly #sessions: Pick<SessionService, "launchForTask">;
  readonly #production: Pick<TaskProductionService, "start" | "continueAfterWorkspaceReady">;
  readonly #deriveRuntime: (runtime: RuntimeView) => RuntimeView;

  constructor(input: {
    db: LaunchDb;
    workspace: Pick<TaskWorkspaceService, "setup">;
    sessions: Pick<SessionService, "launchForTask">;
    production: Pick<TaskProductionService, "start" | "continueAfterWorkspaceReady">;
    deriveRuntime?: (runtime: RuntimeView) => RuntimeView;
  }) {
    this.#db = input.db;
    this.#workspace = input.workspace;
    this.#sessions = input.sessions;
    this.#production = input.production;
    this.#deriveRuntime = input.deriveRuntime ?? withDerivedHostLiveness;
  }

  async launch(input: {
    actor: SessionSubject;
    taskId: string;
    request: TaskSessionLaunchInput;
  }): Promise<TaskSessionLaunchResponse> {
    const request = taskSessionLaunchInputSchema.parse(input.request);
    const task = await this.#db.getTask(input.taskId, { teamId: input.actor.teamId });
    if (!task) throw new SessionFailure("task_not_found", "Task was not found");
    if (!task.projectId || task.status === "blocked" || task.status === "done" || task.status === "canceled") {
      throw new SessionFailure("task_not_eligible", "Task is not eligible for a new Session");
    }

    const executionContext = await this.#db.getExecutionContextByTaskId(task.id, { teamId: input.actor.teamId });

    if (executionContext?.plannedSessionId === request.sessionId) {
      if (
        task.runtimeId !== executionContext.runtimeId
        || executionContext.providerKey !== request.providerKey
        || executionContext.agentId !== request.agentId
        || executionContext.manualContextText !== (request.manualContext?.text ?? null)
      ) {
        throw new SessionFailure("session_conflict", "sessionId was reused with different launch inputs");
      }
      if (executionContext.sessionId) return this.#ready(executionContext.sessionId, input.actor.teamId, false);
      const runtimes = (await this.#db.listRuntimes()).map((candidate) => this.#deriveRuntime(candidate));
      this.#requireRuntime(runtimes, executionContext.runtimeId, request.providerKey);
      const continued = await this.#production.continueAfterWorkspaceReady({
        teamId: input.actor.teamId,
        taskId: task.id,
      });
      return this.#resolveExecutionContext(continued, request.sessionId, input.actor.teamId, false);
    }

    const runtimes = (await this.#db.listRuntimes()).map((candidate) => this.#deriveRuntime(candidate));
    const runtime = task.runtimeId
      ? this.#requireRuntime(runtimes, task.runtimeId, request.providerKey)
      : this.#selectRuntime(runtimes, request.providerKey);

    if (task.status === "pending") {
      const started = await this.#production.start({
        actor: { actorId: input.actor.actorId, teamId: input.actor.teamId },
        taskId: task.id,
        request: {
          agentId: request.agentId,
          runtimeId: runtime.id,
          providerKey: request.providerKey,
          expectedRevision: task.statusRevision,
          idempotencyKey: request.sessionId,
        },
        launch: {
          sessionId: request.sessionId,
          manualContextText: request.manualContext?.text ?? null,
        },
      });
      return this.#resolveExecutionContext(started.executionContext, request.sessionId, input.actor.teamId, started.created);
    }

    if (!task.runtimeId) {
      throw new SessionFailure("runtime_unavailable", "Task Runtime Context is not initialized");
    }
    let setup;
    try {
      setup = await this.#workspace.setup({
        actor: { teamId: input.actor.teamId },
        taskId: task.id,
        runtimeId: task.runtimeId,
        idempotencyKey: request.sessionId,
      });
    } catch (error) {
      if (error instanceof TaskWorkspaceFailure) {
        throw new SessionFailure("workspace_unavailable", "Task Workspace could not be prepared");
      }
      throw error;
    }
    if (setup.workspace.state !== "ready") {
      return { state: "preparing", sessionId: request.sessionId };
    }
    const launched = await this.#sessions.launchForTask({
      actor: input.actor,
      taskId: task.id,
      request,
    });
    return { state: "ready", ...launched };
  }

  #selectRuntime(runtimes: RuntimeView[], providerKey: string): RuntimeView {
    const runtime = runtimes
      .filter((candidate) => this.#isEligible(candidate, providerKey))
      .sort((left, right) => left.id.localeCompare(right.id))[0];
    if (!runtime) throw new SessionFailure("runtime_unavailable", "No eligible Runtime provides the selected Provider");
    return runtime;
  }

  #requireRuntime(runtimes: RuntimeView[], runtimeId: string, providerKey: string): RuntimeView {
    const runtime = runtimes.find((candidate) => candidate.id === runtimeId);
    if (!runtime || runtime.status !== "online") {
      throw new SessionFailure("runtime_unavailable", "Task Runtime is unavailable");
    }
    if (!runtime.providers.some((provider) => provider.provider === providerKey && provider.available)) {
      throw new SessionFailure("provider_unavailable", "Provider is unavailable on the Task Runtime");
    }
    if (!this.#supportsTaskWorkspace(runtime)) {
      throw new SessionFailure("runtime_unavailable", "Task Runtime cannot materialize Task Workspaces");
    }
    return runtime;
  }

  #isEligible(runtime: RuntimeView, providerKey: string): boolean {
    return runtime.status === "online"
      && runtime.providers.some((provider) => provider.provider === providerKey && provider.available)
      && this.#supportsTaskWorkspace(runtime);
  }

  #supportsTaskWorkspace(runtime: RuntimeView): boolean {
    const capability = runtime.metadata.workspaceMaterialization;
    return Boolean(
      capability?.kinds.includes("task-repository")
      && capability.sharingModes.includes("shared-mutable"),
    );
  }

  async #ready(sessionId: string, teamId: string, created: boolean): Promise<TaskSessionLaunchResponse> {
    const session = await this.#db.getSession(sessionId, { teamId });
    if (!session) throw new SessionFailure("session_not_found", "Prepared Session was not found");
    return { state: "ready", session, created };
  }

  #resolveExecutionContext(
    executionContext: { sessionId: string | null; setupFailureCode: string | null } | null | undefined,
    plannedSessionId: string,
    teamId: string,
    created: boolean,
  ): Promise<TaskSessionLaunchResponse> | TaskSessionLaunchResponse {
    if (executionContext?.setupFailureCode) {
      throw new SessionFailure("workspace_unavailable", "Task Workspace or Session preparation failed");
    }
    return executionContext?.sessionId
      ? this.#ready(executionContext.sessionId, teamId, created)
      : { state: "preparing", sessionId: plannedSessionId };
  }
}
