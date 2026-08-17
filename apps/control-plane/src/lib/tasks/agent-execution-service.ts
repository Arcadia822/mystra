import { createHash } from "node:crypto";

import {
  DEFAULT_WORKLOAD_CAPABILITIES,
  agentTaskStatusSetRequestSchema,
  taskExecutionContextPayloadSchema,
  workloadWhoamiSchema,
} from "@mystra/shared";

import type { RdbProvider, ResolvedWorkloadExecution } from "../db/rdb-provider";
import { TaskProductionFailure } from "./task-production-errors";
import { TaskStatusService } from "./task-status-service";

type AgentExecutionDb = Pick<RdbProvider, "resolveWorkloadExecution" | "getTask" | "transitionTaskStatus" | "listTaskStatusTransitions">;

export class AgentExecutionService {
  readonly #db: AgentExecutionDb;
  readonly #status: TaskStatusService;
  readonly #now: () => Date;

  constructor(input: { db: AgentExecutionDb; now?: () => Date }) {
    this.#db = input.db;
    this.#status = new TaskStatusService({ db: input.db });
    this.#now = input.now ?? (() => new Date());
  }

  async whoami(code: string) {
    const execution = await this.#resolve(code);
    return workloadWhoamiSchema.parse({
      version: 1,
      execution: executionIdentity(execution),
      capabilities: DEFAULT_WORKLOAD_CAPABILITIES,
    });
  }

  async context(code: string) {
    const execution = await this.#resolve(code);
    return taskExecutionContextPayloadSchema.parse({
      version: 1,
      execution: executionIdentity(execution),
      task: {
        title: execution.executionContext.taskTitle,
        description: execution.executionContext.taskDescription,
        issue: execution.executionContext.taskIssue,
      },
      project: {
        id: execution.project.id,
        repositoryConnectionId: execution.project.repositoryConnectionId,
        repositoryExternalId: execution.project.repositoryExternalId,
        repositoryBaseBranch: execution.project.repositoryBaseBranch,
      },
      workspace: {
        id: execution.workspace.id,
        branch: execution.workspace.branchName,
      },
      capabilities: DEFAULT_WORKLOAD_CAPABILITIES,
    });
  }

  async taskStatus(code: string) {
    const execution = await this.#resolve(code);
    return this.#status.get({
      teamId: execution.executionContext.teamId,
      taskId: execution.executionContext.taskId,
      actorPolicy: "agent",
    });
  }

  async setTaskStatus(code: string, request: unknown) {
    const execution = await this.#resolve(code);
    const parsed = agentTaskStatusSetRequestSchema.safeParse(request);
    if (!parsed.success) {
      const missingNote = parsed.error.issues.some((issue) => issue.path[0] === "note");
      throw new TaskProductionFailure(
        missingNote ? "missing_status_note" : "invalid_request",
        missingNote ? "A non-empty status note is required" : "Task status request is invalid",
      );
    }
    return this.#status.transition({
      teamId: execution.executionContext.teamId,
      taskId: execution.executionContext.taskId,
      actorPolicy: "agent",
      actor: {
        kind: "agent",
        actorId: null,
        agentId: execution.executionContext.agentId,
        executionContextId: execution.executionContext.id,
        sessionId: execution.session.id,
      },
      request: parsed.data,
    });
  }

  async #resolve(code: string): Promise<ResolvedWorkloadExecution> {
    if (!code.trim()) throw new TaskProductionFailure("capability_expired", "Execution capability is missing or expired");
    const resolved = await this.#db.resolveWorkloadExecution(
      createHash("sha256").update(code).digest("hex"),
    );
    if (!resolved || resolved.executionCodeExpiresAt <= this.#now().toISOString()) {
      throw new TaskProductionFailure("capability_expired", "Execution capability is missing or expired");
    }
    if (
      resolved.executionContext.workspaceId !== resolved.workspace.id
      || resolved.executionContext.teamId !== resolved.session.teamId
      || resolved.executionContext.taskId !== resolved.session.taskId
      || resolved.executionContext.projectId !== resolved.session.projectId
      || resolved.executionContext.runtimeId !== resolved.session.runtimeId
      || resolved.executionContext.taskId !== resolved.task.id
      || resolved.executionContext.projectId !== resolved.project.id
      || resolved.executionContext.taskId !== resolved.workspace.taskId
      || resolved.executionContext.projectId !== resolved.workspace.projectId
      || resolved.executionContext.runtimeId !== resolved.workspace.runtimeId
    ) {
      throw new TaskProductionFailure("scope_mismatch", "Execution capability scope no longer matches the executionContext");
    }
    return resolved;
  }
}

function executionIdentity(execution: ResolvedWorkloadExecution) {
  return {
    teamId: execution.executionContext.teamId,
    taskId: execution.executionContext.taskId,
    executionContextId: execution.executionContext.id,
    sessionId: execution.session.id,
    agentContext: execution.executionContext.agentId === null ? null : {
      agentId: execution.executionContext.agentId,
      name: execution.executionContext.agentName!,
      revision: execution.executionContext.agentRevision!,
    },
    expiresAt: execution.executionCodeExpiresAt,
  };
}
