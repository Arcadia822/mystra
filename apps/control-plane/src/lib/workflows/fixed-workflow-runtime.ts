import type {
  FixedWorkflowDefinition,
  WorkflowActionDefinition,
  WorkflowActionId,
  WorkflowStageDefinition,
  WorkflowStageId,
} from "@mystra/shared";

import { FIXED_WORKFLOW_DEFINITION } from "./fixed-workflow-definition";

export type WorkflowSkillContribution = {
  scope: "global" | `stage:${WorkflowStageId}`;
  name: string;
};

export interface FixedWorkflowRuntime {
  readonly definition: FixedWorkflowDefinition;
  stage(stageId: WorkflowStageId): WorkflowStageDefinition;
  action(actionId: WorkflowActionId): { fromStageId: WorkflowStageId; action: WorkflowActionDefinition } | undefined;
  skills(stageId: WorkflowStageId): WorkflowSkillContribution[];
}

export class ProgramOwnedFixedWorkflowRuntime implements FixedWorkflowRuntime {
  readonly definition = FIXED_WORKFLOW_DEFINITION;

  stage(stageId: WorkflowStageId): WorkflowStageDefinition {
    const stage = this.definition.stages.find(({ id }) => id === stageId);
    if (!stage) throw new Error(`Fixed Workflow Stage is missing: ${stageId}`);
    return stage;
  }

  action(actionId: WorkflowActionId) {
    for (const stage of this.definition.stages) {
      const action = stage.actions.find(({ id }) => id === actionId);
      if (action) return { fromStageId: stage.id, action };
    }
    return undefined;
  }

  skills(stageId: WorkflowStageId): WorkflowSkillContribution[] {
    return [
      ...this.definition.globalSkillNames.map((name) => ({ scope: "global" as const, name })),
      ...this.stage(stageId).skillNames.map((name) => ({ scope: `stage:${stageId}` as const, name })),
    ];
  }
}
