import { randomUUID } from "node:crypto";

import {
  FIXED_WORKFLOW_ID,
  taskWorkflowStateSchema,
  workflowDisableCommandSchema,
  workflowDisableResponseSchema,
  workflowEnableResponseSchema,
  workflowManagementCommandSchema,
  type TeamRole,
  type WorkflowDisableResponse,
  type WorkflowEnableResponse,
} from "@mystra/shared";

import type { RdbProvider } from "../db/rdb-provider";
import { RdbError } from "../db/prisma-errors";
import { FIXED_WORKFLOW_DEFINITION } from "./fixed-workflow-definition";
import { WorkflowFailure } from "./workflow-errors";

type ManagementDb = Pick<RdbProvider,
  | "getTask"
  | "getActiveTaskWorkflowState"
  | "listSkillRecords"
  | "getSkillRevisionRecord"
  | "enableTaskWorkflow"
  | "disableTaskWorkflow"
>;

type WorkflowActor = { userId: string; role: TeamRole };

export class WorkflowManagementService {
  readonly #db: ManagementDb;
  readonly #now: () => string;
  readonly #newId: () => string;

  constructor(input: { db: ManagementDb; now?: () => string; newId?: () => string }) {
    this.#db = input.db;
    this.#now = input.now ?? (() => new Date().toISOString());
    this.#newId = input.newId ?? randomUUID;
  }

  async enable(input: {
    teamId: string; taskId: string; actor: WorkflowActor; request: unknown;
  }): Promise<WorkflowEnableResponse> {
    this.#requireManager(input.actor);
    const request = workflowManagementCommandSchema.safeParse(input.request);
    if (!request.success) throw new WorkflowFailure("invalid_request", "Workflow enable request is invalid");
    await this.#requireTask(input.teamId, input.taskId);
    const active = await this.#db.getActiveTaskWorkflowState(input.taskId, { teamId: input.teamId });
    if (active) return workflowEnableResponseSchema.parse({ workflow: managementView(active) });
    await this.#preflightSkills(input.teamId);
    const timestamp = this.#now();
    const state = taskWorkflowStateSchema.parse({
      id: this.#newId(), teamId: input.teamId, taskId: input.taskId,
      workflowId: FIXED_WORKFLOW_ID, stageId: FIXED_WORKFLOW_DEFINITION.initialStageId,
      stateVersion: 1, activeKey: FIXED_WORKFLOW_ID,
      enabledByUserId: input.actor.userId, enableCommandId: request.data.commandId,
      enabledAt: timestamp, disabledByUserId: null, disableCommandId: null,
      disabledAt: null, updatedAt: timestamp,
    });
    try {
      const result = await this.#db.enableTaskWorkflow({ state });
      return workflowEnableResponseSchema.parse({ workflow: managementView(result.state) });
    } catch (error) {
      throw mapPersistenceFailure(error);
    }
  }

  async disable(input: {
    teamId: string; taskId: string; actor: WorkflowActor; request: unknown;
  }): Promise<WorkflowDisableResponse> {
    this.#requireManager(input.actor);
    const request = workflowDisableCommandSchema.safeParse(input.request);
    if (!request.success) throw new WorkflowFailure("invalid_request", "Workflow disable request is invalid");
    await this.#requireTask(input.teamId, input.taskId);
    const active = await this.#db.getActiveTaskWorkflowState(input.taskId, { teamId: input.teamId });
    if (!active) throw new WorkflowFailure("workflow_not_enabled", "Workflow is not enabled");
    try {
      const result = await this.#db.disableTaskWorkflow({
        teamId: input.teamId, taskId: input.taskId, workflowStateId: active.id,
        expectedStateVersion: request.data.expectedStateVersion,
        disabledByUserId: input.actor.userId, disableCommandId: request.data.commandId,
        disabledAt: this.#now(),
      });
      return workflowDisableResponseSchema.parse({
        workflow: managementView(result.state),
        projectionCleanup: { status: "pending", retryable: true },
      });
    } catch (error) {
      throw mapPersistenceFailure(error);
    }
  }

  #requireManager(actor: WorkflowActor): void {
    if (actor.role !== "owner" && actor.role !== "admin") {
      throw new WorkflowFailure("workflow_forbidden", "Workflow management requires Owner or Admin");
    }
  }

  async #requireTask(teamId: string, taskId: string): Promise<void> {
    if (!await this.#db.getTask(taskId, { teamId })) {
      throw new WorkflowFailure("workflow_task_not_found", "Task was not found");
    }
  }

  async #preflightSkills(teamId: string): Promise<void> {
    const names = new Set([
      ...FIXED_WORKFLOW_DEFINITION.globalSkillNames,
      ...FIXED_WORKFLOW_DEFINITION.stages.flatMap(({ skillNames }) => skillNames),
    ]);
    for (const name of names) {
      const page = await this.#db.listSkillRecords({ teamId, query: name, limit: 100, includeArchived: false });
      const skill = page.items.find((candidate) => candidate.activeName === name && candidate.status === "active");
      if (!skill?.currentRevisionId) {
        throw new WorkflowFailure("workflow_skill_resolution_failed", `Required Workflow Skill is unavailable: ${name}`);
      }
      const revision = await this.#db.getSkillRevisionRecord({
        teamId, skillId: skill.id, revisionId: skill.currentRevisionId,
      });
      if (!revision || revision.publicationStatus !== "ready" || revision.sequence === null) {
        throw new WorkflowFailure("workflow_skill_resolution_failed", `Required Workflow Skill is unavailable: ${name}`);
      }
    }
  }
}

function managementView(state: ReturnType<typeof taskWorkflowStateSchema.parse>) {
  return {
    id: FIXED_WORKFLOW_ID,
    stateId: state.id,
    stageId: state.stageId,
    stateVersion: state.stateVersion,
    active: state.activeKey !== null,
    enabledAt: state.enabledAt,
    disabledAt: state.disabledAt,
  };
}

function mapPersistenceFailure(error: unknown): WorkflowFailure {
  if (error instanceof WorkflowFailure) return error;
  if (error instanceof RdbError) {
    if (error.code === "RDB_NOT_FOUND") return new WorkflowFailure("workflow_task_not_found", "Task was not found");
    if (error.code === "RDB_CONFLICT") return new WorkflowFailure("workflow_state_conflict", "Workflow state changed");
    if (error.code === "RDB_RELATION_CONFLICT") {
      return new WorkflowFailure("workflow_skill_resolution_failed", "Workflow dependency is unavailable");
    }
  }
  return new WorkflowFailure("control_plane_unavailable", "Workflow management is unavailable", true);
}
