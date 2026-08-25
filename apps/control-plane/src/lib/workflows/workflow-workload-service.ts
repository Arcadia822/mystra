import { createHash, randomUUID } from "node:crypto";

import {
  workflowCurrentResponseSchema,
  workflowTransitionRequestSchema,
  workflowTransitionResponseSchema,
  type TaskWorkflowState,
  type WorkflowCurrentResponse,
  type WorkflowRequiredSkill,
  type WorkflowTransitionResponse,
  type WorkspaceSkillProjection,
} from "@mystra/shared";

import type { RdbProvider } from "../db/rdb-provider";
import { RdbError } from "../db/prisma-errors";
import type { AgentExecutionService } from "../tasks/agent-execution-service";
import type { FixedWorkflowRuntime } from "./fixed-workflow-runtime";
import { WorkflowFailure } from "./workflow-errors";
import { WorkflowSkillProjectionService, type ResolvedWorkflowSkills } from "./workflow-skill-projection-service";

type WorkloadDb = Pick<RdbProvider, "transitionTaskWorkflow">;

export class WorkflowWorkloadService {
  readonly #db: WorkloadDb;
  readonly #execution: Pick<AgentExecutionService, "resolveWorkflowExecution">;
  readonly #runtime: FixedWorkflowRuntime;
  readonly #skills: WorkflowSkillProjectionService;
  readonly #now: () => string;
  readonly #newId: () => string;

  constructor(input: {
    db: WorkloadDb;
    execution: Pick<AgentExecutionService, "resolveWorkflowExecution">;
    runtime: FixedWorkflowRuntime;
    skills: WorkflowSkillProjectionService;
    now?: () => string;
    newId?: () => string;
  }) {
    this.#db = input.db;
    this.#execution = input.execution;
    this.#runtime = input.runtime;
    this.#skills = input.skills;
    this.#now = input.now ?? (() => new Date().toISOString());
    this.#newId = input.newId ?? randomUUID;
  }

  async current(code: string): Promise<WorkflowCurrentResponse> {
    const resolved = await this.#execution.resolveWorkflowExecution(code);
    const desired = await this.#skills.reconcile({
      teamId: resolved.execution.session.teamId,
      workspaceId: resolved.execution.workspace.id,
      state: resolved.state,
    });
    return this.#current(resolved.state, desired, resolved.execution.workspace.id);
  }

  async transition(code: string, request: unknown): Promise<WorkflowTransitionResponse> {
    const parsed = workflowTransitionRequestSchema.safeParse(request);
    if (!parsed.success) throw new WorkflowFailure("invalid_request", "Workflow transition request is invalid");
    const resolved = await this.#execution.resolveWorkflowExecution(code);
    const edge = this.#runtime.action(parsed.data.actionId);
    if (!edge) throw new WorkflowFailure("workflow_action_not_allowed", "Workflow Action is not allowed");
    if (
      resolved.state.stateVersion === parsed.data.expectedStateVersion
      && resolved.state.stageId !== edge.fromStageId
    ) throw new WorkflowFailure("workflow_action_not_allowed", "Workflow Action is not allowed in the current Stage");
    const target = await this.#skills.resolve({
      teamId: resolved.execution.session.teamId,
      workspaceId: resolved.execution.workspace.id,
      workflowStateId: resolved.state.id,
      stageId: edge.action.toStageId,
      generation: parsed.data.expectedStateVersion + 1,
    });
    const previous = await this.#skills.resolve({
      teamId: resolved.execution.session.teamId,
      workspaceId: resolved.execution.workspace.id,
      workflowStateId: resolved.state.id,
      stageId: edge.fromStageId,
      generation: parsed.data.expectedStateVersion,
    });
    const occurredAt = this.#now();
    try {
      const result = await this.#db.transitionTaskWorkflow({
        teamId: resolved.execution.session.teamId,
        workflowStateId: resolved.state.id,
        expectedStateVersion: parsed.data.expectedStateVersion,
        transition: {
          id: this.#newId(), workflowStateId: resolved.state.id,
          teamId: resolved.execution.session.teamId, taskId: resolved.execution.session.taskId,
          sessionId: resolved.execution.session.id, commandId: parsed.data.commandId,
          payloadHash: fingerprint(parsed.data), actionId: parsed.data.actionId,
          fromStageId: edge.fromStageId, toStageId: edge.action.toStageId,
          fromStateVersion: parsed.data.expectedStateVersion,
          toStateVersion: parsed.data.expectedStateVersion + 1, occurredAt,
        },
        sources: target.sources,
      });
      const projections = await this.#skills.list(resolved.execution.session.teamId, resolved.execution.workspace.id);
      return workflowTransitionResponseSchema.parse({
        transition: {
          commandId: result.transition.commandId,
          actionId: result.transition.actionId,
          previousStageId: result.transition.fromStageId,
          currentStageId: result.transition.toStageId,
          stateVersion: result.transition.toStateVersion,
          replayed: !result.created,
        },
        current: this.#current(result.state, { ...target, projections }, resolved.execution.workspace.id),
        skillChanges: skillChanges(previous.requiredSkills, target.requiredSkills),
      });
    } catch (error) {
      throw mapTransitionFailure(error);
    }
  }

  #current(
    state: TaskWorkflowState,
    desired: ResolvedWorkflowSkills & { projections: WorkspaceSkillProjection[] },
    workspaceId: string,
  ): WorkflowCurrentResponse {
    const stage = this.#runtime.stage(state.stageId);
    const bySkill = new Map(desired.projections.map((projection) => [projection.skillId, projection]));
    const relevant = desired.requiredSkills.map(({ skillId }) => bySkill.get(skillId)).filter(Boolean) as WorkspaceSkillProjection[];
    const status = relevant.some((projection) => projection.status === "failed")
      ? "failed" : relevant.some((projection) => projection.status !== "ready") ? "pending" : "ready";
    return workflowCurrentResponseSchema.parse({
      workflow: { id: this.#runtime.definition.id, name: this.#runtime.definition.name },
      state: { stageId: state.stageId, stateVersion: state.stateVersion, terminal: state.stageId === "completed" },
      stage: { name: stage.name, instructions: stage.instructions },
      requiredSkills: desired.requiredSkills,
      materialization: {
        workspaceId, generation: state.stateVersion, removals: [],
        entries: desired.artifacts.map((artifact) => ({
          ...artifact,
          downloadPath: `/api/agent-execution/workflow/skills/${artifact.skillId}/revisions/${artifact.revisionId}/download`,
        })),
      },
      availableActions: stage.actions.map((action) => ({ id: action.id, label: action.label, nextStageId: action.toStageId })),
      projection: { generation: state.stateVersion, status, retryable: status !== "ready" },
    });
  }
}

function fingerprint(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function skillChanges(previous: WorkflowRequiredSkill[], current: WorkflowRequiredSkill[]) {
  const before = new Map(previous.map((skill) => [skill.skillId, skill]));
  const after = new Map(current.map((skill) => [skill.skillId, skill]));
  return {
    added: current.filter((skill) => !before.has(skill.skillId)).map(identity),
    removed: previous.filter((skill) => !after.has(skill.skillId)).map(identity),
    retained: current.filter((skill) => before.get(skill.skillId)?.revisionId === skill.revisionId).map(identity),
  };
}

function identity(skill: WorkflowRequiredSkill) {
  return { skillId: skill.skillId, revisionId: skill.revisionId };
}

function mapTransitionFailure(error: unknown): WorkflowFailure {
  if (error instanceof WorkflowFailure) return error;
  if (error instanceof RdbError) {
    if (error.code === "RDB_RELATION_CONFLICT") return new WorkflowFailure("workflow_skill_resolution_failed", "Workflow Skill dependency changed");
    if (error.code === "RDB_NOT_FOUND") return new WorkflowFailure("capability_expired", "Workflow capability is expired");
    if (error.code === "RDB_CONFLICT") {
      return error.message.includes("command id")
        ? new WorkflowFailure("workflow_command_conflict", "Workflow command identity was reused")
        : new WorkflowFailure("workflow_state_conflict", "Workflow state changed");
    }
  }
  return new WorkflowFailure("control_plane_unavailable", "Workflow transition is unavailable", true);
}
