import {
  fixedWorkflowDefinitionSchema,
  type FixedWorkflowDefinition,
  type WorkflowActionDefinition,
  type WorkflowActionId,
  type WorkflowStageId,
} from "@mystra/shared";

export const FIXED_WORKFLOW_BASE_PROMPT = [
  "This Task uses the fixed Mystra workflow.",
  "Before beginning or resuming work, run \"$MYSTRA_AGENT_PATH\" workflow current.",
  "Treat that command as the authority for the current Stage, instructions, required Skills, and available Actions.",
  "After completing the Stage, run \"$MYSTRA_AGENT_PATH\" workflow transition <action-id> with an Action returned by current.",
  "Do not infer, select, or directly modify Workflow state.",
].join("\n");

export const FIXED_WORKFLOW_DEFINITION: FixedWorkflowDefinition = fixedWorkflowDefinitionSchema.parse({
  id: "mystra.workflow",
  name: "Mystra Workflow",
  prompt: FIXED_WORKFLOW_BASE_PROMPT,
  globalSkillNames: ["repository-development-guide"],
  initialStageId: "understand",
  stages: [
    {
      id: "understand",
      name: "Understand",
      instructions: "Establish the intended outcome, current behavior, evidence, constraints, and affected execution paths before changing implementation.",
      skillNames: ["idea-refine"],
      actions: [{ id: "understanding-complete", label: "Understanding complete", toStageId: "implement" }],
    },
    {
      id: "implement",
      name: "Implement",
      instructions: "Implement the smallest complete change that satisfies the authoritative specification and preserve verification evidence.",
      skillNames: ["incremental-implementation"],
      actions: [{ id: "implementation-complete", label: "Implementation complete", toStageId: "verify" }],
    },
    {
      id: "verify",
      name: "Verify",
      instructions: "Verify the original outcome, relevant regression paths, contracts, and runtime evidence before reporting completion.",
      skillNames: ["code-review-and-quality"],
      actions: [
        { id: "verification-failed", label: "Verification failed", toStageId: "implement" },
        { id: "verification-passed", label: "Verification passed", toStageId: "completed" },
      ],
    },
    {
      id: "completed",
      name: "Completed",
      instructions: "The fixed Workflow is complete. Preserve the final verification evidence; do not infer a Task or Session state change.",
      skillNames: [],
      actions: [],
    },
  ],
});

export function resolveFixedWorkflowAction(
  stageId: WorkflowStageId,
  actionId: WorkflowActionId,
): WorkflowActionDefinition | undefined {
  return FIXED_WORKFLOW_DEFINITION.stages
    .find((stage) => stage.id === stageId)
    ?.actions.find((action) => action.id === actionId);
}
