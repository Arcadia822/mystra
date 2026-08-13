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
        title: execution.harness.taskTitle,
        description: execution.harness.taskDescription,
        issue: execution.harness.taskIssue,
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
      teamId: execution.harness.teamId,
      taskId: execution.harness.taskId,
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
      teamId: execution.harness.teamId,
      taskId: execution.harness.taskId,
      actorPolicy: "agent",
      actor: {
        kind: "agent",
        actorId: null,
        agentId: execution.harness.agentId,
        harnessId: execution.harness.id,
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
      resolved.harness.sessionId !== resolved.session.id
      || resolved.harness.workspaceId !== resolved.workspace.id
      || resolved.harness.teamId !== resolved.session.teamId
      || resolved.harness.taskId !== resolved.session.taskId
      || resolved.harness.projectId !== resolved.session.projectId
      || resolved.harness.runtimeId !== resolved.session.runtimeId
      || resolved.harness.providerKey !== resolved.session.providerKey
      || resolved.harness.agentId !== resolved.session.agentId
      || resolved.harness.agentRevision !== resolved.session.agentRevision
      || resolved.harness.taskId !== resolved.task.id
      || resolved.harness.projectId !== resolved.project.id
      || resolved.harness.taskId !== resolved.workspace.taskId
      || resolved.harness.projectId !== resolved.workspace.projectId
      || resolved.harness.runtimeId !== resolved.workspace.runtimeId
    ) {
      throw new TaskProductionFailure("scope_mismatch", "Execution capability scope no longer matches the attempt");
    }
    return resolved;
  }
}

function executionIdentity(execution: ResolvedWorkloadExecution) {
  return {
    teamId: execution.harness.teamId,
    taskId: execution.harness.taskId,
    harnessId: execution.harness.id,
    sessionId: execution.session.id,
    agentContext: execution.harness.agentId === null ? null : {
      agentId: execution.harness.agentId,
      name: execution.harness.agentName!,
      revision: execution.harness.agentRevision!,
    },
    expiresAt: execution.executionCodeExpiresAt,
  };
}
