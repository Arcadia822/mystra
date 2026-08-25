import { z } from "zod";
import { skillManifestEntrySchema } from "./skill.js";

export const FIXED_WORKFLOW_ID = "mystra.workflow" as const;
export const WORKFLOW_SKILL_PATH_PREFIX = ".mystra/skills/" as const;

export const workflowStageIdSchema = z.enum(["understand", "implement", "verify", "completed"]);
export type WorkflowStageId = z.infer<typeof workflowStageIdSchema>;

export const workflowActionIdSchema = z.enum([
  "understanding-complete",
  "implementation-complete",
  "verification-failed",
  "verification-passed",
]);
export type WorkflowActionId = z.infer<typeof workflowActionIdSchema>;

const boundedTextSchema = z.string().trim().min(1).max(4_000);
const skillNameSchema = z.string().trim().min(1).max(128).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u);

export const workflowActionDefinitionSchema = z.object({
  id: workflowActionIdSchema,
  label: z.string().trim().min(1).max(200),
  toStageId: workflowStageIdSchema,
}).strict();
export type WorkflowActionDefinition = z.infer<typeof workflowActionDefinitionSchema>;

export const workflowStageDefinitionSchema = z.object({
  id: workflowStageIdSchema,
  name: z.string().trim().min(1).max(200),
  instructions: boundedTextSchema,
  skillNames: z.array(skillNameSchema).max(4),
  actions: z.array(workflowActionDefinitionSchema).max(2),
}).strict();
export type WorkflowStageDefinition = z.infer<typeof workflowStageDefinitionSchema>;

const expectedEdges: Readonly<Record<WorkflowStageId, Readonly<Record<string, WorkflowStageId>>>> = {
  understand: { "understanding-complete": "implement" },
  implement: { "implementation-complete": "verify" },
  verify: { "verification-failed": "implement", "verification-passed": "completed" },
  completed: {},
};

export const fixedWorkflowDefinitionSchema = z.object({
  id: z.literal(FIXED_WORKFLOW_ID),
  name: z.literal("Mystra Workflow"),
  prompt: boundedTextSchema,
  globalSkillNames: z.array(skillNameSchema).min(1).max(4),
  initialStageId: z.literal("understand"),
  stages: z.array(workflowStageDefinitionSchema).length(4),
}).strict().superRefine((definition, context) => {
  const expectedStages: WorkflowStageId[] = ["understand", "implement", "verify", "completed"];
  if (JSON.stringify(definition.stages.map(({ id }) => id)) !== JSON.stringify(expectedStages)) {
    context.addIssue({ code: "custom", path: ["stages"], message: "Fixed Workflow stages are out of order or incomplete" });
    return;
  }
  for (const [index, stage] of definition.stages.entries()) {
    const expected = expectedEdges[stage.id];
    const actual = Object.fromEntries(stage.actions.map((action) => [action.id, action.toStageId]));
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      context.addIssue({ code: "custom", path: ["stages", index, "actions"], message: `Fixed Workflow actions for ${stage.id} are invalid` });
    }
  }
});
export type FixedWorkflowDefinition = z.infer<typeof fixedWorkflowDefinitionSchema>;

export const workflowProjectionStatusSchema = z.enum(["pending", "ready", "failed"]);
export type WorkflowProjectionStatus = z.infer<typeof workflowProjectionStatusSchema>;

const workflowTimestampSchema = z.string().datetime();
export const taskWorkflowStateSchema = z.object({
  id: z.string().uuid(),
  teamId: z.string().uuid(),
  taskId: z.string().uuid(),
  workflowId: z.literal(FIXED_WORKFLOW_ID),
  stageId: workflowStageIdSchema,
  stateVersion: z.number().int().positive(),
  activeKey: z.literal(FIXED_WORKFLOW_ID).nullable(),
  enabledByUserId: z.string().uuid(),
  enableCommandId: z.string().uuid(),
  enabledAt: workflowTimestampSchema,
  disabledByUserId: z.string().uuid().nullable(),
  disableCommandId: z.string().uuid().nullable(),
  disabledAt: workflowTimestampSchema.nullable(),
  updatedAt: workflowTimestampSchema,
}).strict().superRefine((value, context) => {
  const auditCount = [value.disabledByUserId, value.disableCommandId, value.disabledAt]
    .filter((part) => part !== null).length;
  if ((value.activeKey === null && auditCount !== 3) || (value.activeKey !== null && auditCount !== 0)) {
    context.addIssue({ code: "custom", path: ["activeKey"], message: "Workflow active state and disable audit are inconsistent" });
  }
});
export type TaskWorkflowState = z.infer<typeof taskWorkflowStateSchema>;

export const taskWorkflowTransitionSchema = z.object({
  id: z.string().uuid(),
  workflowStateId: z.string().uuid(),
  teamId: z.string().uuid(),
  taskId: z.string().uuid(),
  sessionId: z.string().uuid(),
  commandId: z.string().uuid(),
  payloadHash: z.string().regex(/^[a-f0-9]{64}$/u),
  actionId: workflowActionIdSchema,
  fromStageId: workflowStageIdSchema,
  toStageId: workflowStageIdSchema,
  fromStateVersion: z.number().int().positive(),
  toStateVersion: z.number().int().positive(),
  occurredAt: workflowTimestampSchema,
}).strict().superRefine((value, context) => {
  if (value.toStateVersion !== value.fromStateVersion + 1) {
    context.addIssue({ code: "custom", path: ["toStateVersion"], message: "Workflow transition version must increment by one" });
  }
});
export type TaskWorkflowTransition = z.infer<typeof taskWorkflowTransitionSchema>;

export const sessionWorkflowCapabilitySchema = z.object({
  sessionId: z.string().uuid(),
  workflowStateId: z.string().uuid(),
  teamId: z.string().uuid(),
  taskId: z.string().uuid(),
  issuedAt: workflowTimestampSchema,
  revokedAt: workflowTimestampSchema.nullable(),
}).strict();
export type SessionWorkflowCapability = z.infer<typeof sessionWorkflowCapabilitySchema>;

export const workspaceSkillSourceSchema = z.object({
  workspaceId: z.string().uuid(),
  sourceKey: z.string().min(1).max(300).regex(/^workflow:mystra\.workflow:[0-9a-f-]{36}:(?:global|stage:[a-z-]+)$/u),
  skillId: z.string().uuid(),
  skillRevisionId: z.string().uuid(),
  relativePath: z.string().regex(/^\.mystra\/skills\/[0-9a-f-]{36}$/u),
  desiredGeneration: z.number().int().positive(),
  createdAt: workflowTimestampSchema,
  updatedAt: workflowTimestampSchema,
}).strict();
export type WorkspaceSkillSource = z.infer<typeof workspaceSkillSourceSchema>;

export const workspaceSkillProjectionSchema = z.object({
  workspaceId: z.string().uuid(),
  skillId: z.string().uuid(),
  skillRevisionId: z.string().uuid(),
  relativePath: z.string().regex(/^\.mystra\/skills\/[0-9a-f-]{36}$/u),
  desiredGeneration: z.number().int().positive(),
  appliedGeneration: z.number().int().positive().nullable(),
  status: workflowProjectionStatusSchema,
  failureCode: z.string().min(1).max(200).nullable(),
  updatedAt: workflowTimestampSchema,
}).strict().superRefine((value, context) => {
  if (value.status === "failed" && value.failureCode === null) {
    context.addIssue({ code: "custom", path: ["failureCode"], message: "Failed projection requires a failure code" });
  }
  if (value.status !== "failed" && value.failureCode !== null) {
    context.addIssue({ code: "custom", path: ["failureCode"], message: "Non-failed projection cannot carry a failure code" });
  }
});
export type WorkspaceSkillProjection = z.infer<typeof workspaceSkillProjectionSchema>;

export const workflowSkillProjectionAssignmentSchema = z.object({
  workspaceId: z.string().uuid(),
  generation: z.number().int().positive(),
  entries: z.array(z.object({
    skillId: z.string().uuid(),
    revisionId: z.string().uuid(),
    relativePath: z.string().regex(/^\.mystra\/skills\/[0-9a-f-]{36}$/u),
    zipSha256: z.string().regex(/^[a-f0-9]{64}$/u),
    manifest: z.array(skillManifestEntrySchema).min(1).max(1_000),
    downloadPath: z.string().regex(/^\/api\/(?:runner\/sessions\/[0-9a-f-]{36}\/skills|agent-execution\/workflow\/skills)\/[0-9a-f-]{36}\/revisions\/[0-9a-f-]{36}\/download$/u),
  }).strict()).max(16),
  removals: z.array(z.string().regex(/^\.mystra\/skills\/[0-9a-f-]{36}$/u)).max(16),
}).strict();
export type WorkflowSkillProjectionAssignment = z.infer<typeof workflowSkillProjectionAssignmentSchema>;

export const workflowSkillProjectionReportSchema = z.object({
  workspaceId: z.string().uuid(),
  generation: z.number().int().positive(),
  results: z.array(z.object({
    skillId: z.string().uuid(),
    status: z.enum(["ready", "failed"]),
    failureCode: z.string().min(1).max(200).nullable(),
  }).strict().superRefine((value, context) => {
    if ((value.status === "failed") !== (value.failureCode !== null)) {
      context.addIssue({ code: "custom", path: ["failureCode"], message: "Projection failure code must match status" });
    }
  })).min(1).max(16),
}).strict();
export type WorkflowSkillProjectionReport = z.infer<typeof workflowSkillProjectionReportSchema>;

export const workflowRequiredSkillSchema = z.object({
  skillId: z.string().uuid(),
  revisionId: z.string().uuid(),
  revision: z.number().int().positive(),
  path: z.string().regex(/^\.mystra\/skills\/[0-9a-f-]{36}$/u),
  zipSha256: z.string().regex(/^[a-f0-9]{64}$/u),
}).strict();
export type WorkflowRequiredSkill = z.infer<typeof workflowRequiredSkillSchema>;

export const workflowAvailableActionSchema = z.object({
  id: workflowActionIdSchema,
  label: z.string().trim().min(1).max(200),
  nextStageId: workflowStageIdSchema,
}).strict();
export type WorkflowAvailableAction = z.infer<typeof workflowAvailableActionSchema>;

export const workflowProjectionHealthSchema = z.object({
  generation: z.number().int().positive(),
  status: workflowProjectionStatusSchema,
  retryable: z.boolean(),
}).strict();
export type WorkflowProjectionHealth = z.infer<typeof workflowProjectionHealthSchema>;

export const workflowCurrentResponseSchema = z.object({
  workflow: z.object({ id: z.literal(FIXED_WORKFLOW_ID), name: z.literal("Mystra Workflow") }).strict(),
  state: z.object({
    stageId: workflowStageIdSchema,
    stateVersion: z.number().int().positive(),
    terminal: z.boolean(),
  }).strict(),
  stage: z.object({ name: z.string().trim().min(1).max(200), instructions: boundedTextSchema }).strict(),
  requiredSkills: z.array(workflowRequiredSkillSchema).max(4),
  materialization: workflowSkillProjectionAssignmentSchema,
  availableActions: z.array(workflowAvailableActionSchema).max(2),
  projection: workflowProjectionHealthSchema,
}).strict().superRefine((value, context) => {
  if (value.state.terminal !== (value.state.stageId === "completed")) {
    context.addIssue({ code: "custom", path: ["state", "terminal"], message: "Workflow terminal flag does not match its Stage" });
  }
  if (value.projection.generation !== value.state.stateVersion || value.materialization.generation !== value.state.stateVersion) {
    context.addIssue({ code: "custom", path: ["projection", "generation"], message: "Workflow projection generation must match state version" });
  }
  const required = new Map(value.requiredSkills.map((skill) => [skill.skillId, skill]));
  if (value.materialization.entries.length !== required.size || value.materialization.entries.some((entry) => required.get(entry.skillId)?.revisionId !== entry.revisionId)) {
    context.addIssue({ code: "custom", path: ["materialization", "entries"], message: "Workflow materialization must match required Skills" });
  }
});
export type WorkflowCurrentResponse = z.infer<typeof workflowCurrentResponseSchema>;

export const workflowTransitionRequestSchema = z.object({
  commandId: z.string().uuid(),
  actionId: workflowActionIdSchema,
  expectedStateVersion: z.number().int().positive(),
}).strict();
export type WorkflowTransitionRequest = z.infer<typeof workflowTransitionRequestSchema>;

const workflowSkillIdentitySchema = workflowRequiredSkillSchema.pick({ skillId: true, revisionId: true }).strict();

export const workflowTransitionResponseSchema = z.object({
  transition: z.object({
    commandId: z.string().uuid(),
    actionId: workflowActionIdSchema,
    previousStageId: workflowStageIdSchema,
    currentStageId: workflowStageIdSchema,
    stateVersion: z.number().int().positive(),
    replayed: z.boolean(),
  }).strict(),
  current: workflowCurrentResponseSchema,
  skillChanges: z.object({
    added: z.array(workflowSkillIdentitySchema).max(4),
    removed: z.array(workflowSkillIdentitySchema).max(4),
    retained: z.array(workflowSkillIdentitySchema).max(4),
  }).strict(),
}).strict();
export type WorkflowTransitionResponse = z.infer<typeof workflowTransitionResponseSchema>;

export const workflowManagementCommandSchema = z.object({ commandId: z.string().uuid() }).strict();
export const workflowDisableCommandSchema = workflowManagementCommandSchema.extend({
  expectedStateVersion: z.number().int().positive(),
}).strict();

export const workflowManagementStateSchema = z.object({
  id: z.literal(FIXED_WORKFLOW_ID),
  stateId: z.string().uuid(),
  stageId: workflowStageIdSchema,
  stateVersion: z.number().int().positive(),
  active: z.boolean(),
  enabledAt: workflowTimestampSchema,
  disabledAt: workflowTimestampSchema.nullable(),
}).strict();
export type WorkflowManagementState = z.infer<typeof workflowManagementStateSchema>;

export const workflowEnableResponseSchema = z.object({ workflow: workflowManagementStateSchema }).strict();
export type WorkflowEnableResponse = z.infer<typeof workflowEnableResponseSchema>;

export const workflowDisableResponseSchema = z.object({
  workflow: workflowManagementStateSchema,
  projectionCleanup: z.object({
    status: z.enum(["ready", "pending", "failed"]),
    retryable: z.boolean(),
  }).strict(),
}).strict();
export type WorkflowDisableResponse = z.infer<typeof workflowDisableResponseSchema>;

export const workflowErrorCodeSchema = z.enum([
  "workflow_task_not_found",
  "workflow_forbidden",
  "workflow_not_enabled",
  "workflow_action_not_allowed",
  "workflow_state_conflict",
  "workflow_command_conflict",
  "workflow_skill_resolution_failed",
  "workflow_skill_projection_failed",
  "scope_mismatch",
  "capability_expired",
  "invalid_request",
  "control_plane_unavailable",
]);
export type WorkflowErrorCode = z.infer<typeof workflowErrorCodeSchema>;

export const workflowErrorResponseSchema = z.object({
  error: z.object({
    code: workflowErrorCodeSchema,
    message: z.string().trim().min(1).max(2_000),
    retryable: z.boolean(),
  }).strict(),
}).strict();
export type WorkflowErrorResponse = z.infer<typeof workflowErrorResponseSchema>;
