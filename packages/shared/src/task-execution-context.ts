import { z } from "zod";

import { agentDisplayNameSchema, agentSystemPromptSchema } from "./agent.js";
import { providerNameSchema } from "./schemas.js";
import {
  taskDescriptionSchema,
  taskIssueReferenceSchema,
  taskStatusSchema,
  taskStatusIdempotencyKeySchema,
  taskStatusNoteSchema,
  taskTitleSchema,
  taskStatusTransitionSchema,
} from "./task.js";

export const workloadCapabilitySchema = z.enum([
  "context:read",
  "task-status:read",
  "task-status:transition",
]);
export type WorkloadCapability = z.infer<typeof workloadCapabilitySchema>;
export const DEFAULT_WORKLOAD_CAPABILITIES = [
  "context:read",
  "task-status:read",
  "task-status:transition",
] as const satisfies readonly WorkloadCapability[];

export const agentContextSnapshotSchema = z.object({
  agentId: z.string().uuid(),
  name: agentDisplayNameSchema,
  revision: z.number().int().positive(),
  systemPrompt: agentSystemPromptSchema,
}).strict();
export type AgentContextSnapshot = z.infer<typeof agentContextSnapshotSchema>;

export const agentContextIdentitySchema = agentContextSnapshotSchema.pick({
  agentId: true,
  name: true,
  revision: true,
}).strict();
export type AgentContextIdentity = z.infer<typeof agentContextIdentitySchema>;

export const taskExecutionContextSchema = z.object({
  id: z.string().uuid(),
  teamId: z.string().uuid(),
  taskId: z.string().uuid(),
  projectId: z.string().uuid(),
  agentId: z.string().uuid().nullable(),
  agentName: agentDisplayNameSchema.nullable(),
  agentRevision: z.number().int().positive().nullable(),
  agentSystemPrompt: agentSystemPromptSchema.nullable(),
  taskTitle: taskTitleSchema,
  taskDescription: taskDescriptionSchema,
  taskIssue: taskIssueReferenceSchema.nullable(),
  manualContextText: z.string().trim().min(1).max(64 * 1024).nullable().default(null),
  runtimeId: z.string().uuid(),
  providerKey: providerNameSchema,
  workspaceId: z.string().uuid().nullable(),
  plannedSessionId: z.string().uuid(),
  sessionId: z.string().uuid().nullable(),
  firstMessageId: z.string().uuid(),
  assignIdempotencyKey: taskStatusIdempotencyKeySchema,
  assignRequestFingerprint: z.string().regex(/^[a-f0-9]{64}$/u),
  capabilityRevokedAt: z.string().datetime().nullable(),
  setupFailureCode: z.string().trim().min(1).max(200).nullable(),
  setupFailureMessage: z.string().trim().min(1).max(2_000).nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
}).strict().superRefine((value, context) => {
  const snapshot = [value.agentId, value.agentName, value.agentRevision, value.agentSystemPrompt];
  const present = snapshot.filter((item) => item !== null).length;
  if (present !== 0 && present !== snapshot.length) {
    context.addIssue({
      code: "custom",
      path: ["agentId"],
      message: "TaskExecutionContext Agent Context must be wholly present or absent",
    });
  }
});
export type TaskExecutionContext = z.infer<typeof taskExecutionContextSchema>;

export const taskStartRequestSchema = z.object({
  agentId: z.string().uuid().nullish().transform((value) => value ?? null),
  runtimeId: z.string().uuid(),
  providerKey: providerNameSchema,
  expectedRevision: z.number().int().positive(),
  idempotencyKey: taskStatusIdempotencyKeySchema,
}).strict();
export type TaskStartRequest = z.input<typeof taskStartRequestSchema>;
export type ParsedTaskStartRequest = z.output<typeof taskStartRequestSchema>;

export const taskStartResultSchema = z.object({
  task: z.object({
    id: z.string().uuid(),
    status: taskStatusSchema,
    statusRevision: z.number().int().positive(),
  }).passthrough(),
  transition: taskStatusTransitionSchema,
  executionContext: taskExecutionContextSchema,
  created: z.boolean(),
}).strict();
export type TaskStartResult = z.infer<typeof taskStartResultSchema>;

export const workloadExecutionIdentitySchema = z.object({
  teamId: z.string().uuid(),
  taskId: z.string().uuid(),
  executionContextId: z.string().uuid(),
  sessionId: z.string().uuid(),
  agentContext: agentContextIdentitySchema.nullable(),
  expiresAt: z.string().datetime(),
}).strict();
export type WorkloadExecutionIdentity = z.infer<typeof workloadExecutionIdentitySchema>;

export const workloadWhoamiSchema = z.object({
  version: z.literal(1),
  execution: workloadExecutionIdentitySchema,
  capabilities: z.array(workloadCapabilitySchema),
}).strict();
export type WorkloadWhoami = z.infer<typeof workloadWhoamiSchema>;

const taskExecutionContextBaseSchema = z.object({
  version: z.literal(1),
  execution: workloadExecutionIdentitySchema,
  task: z.object({
    title: taskTitleSchema,
    description: taskDescriptionSchema,
    issue: taskIssueReferenceSchema.nullable(),
  }).strict(),
  project: z.object({
    id: z.string().uuid(),
    repositoryConnectionId: z.string().uuid(),
    repositoryExternalId: z.string().trim().min(1).max(1_000),
    repositoryBaseBranch: z.string().trim().min(1).max(500),
  }).strict(),
  capabilities: z.array(workloadCapabilitySchema),
});

export const taskExecutionContextPayloadSchema = taskExecutionContextBaseSchema.extend({
  workspace: z.object({
    id: z.string().uuid(),
    branch: z.string().trim().min(1).max(500),
  }).strict(),
}).strict();
export type TaskExecutionContextPayload = z.infer<typeof taskExecutionContextPayloadSchema>;

export const workloadExecutionContextSchema = taskExecutionContextBaseSchema.extend({
  workspace: z.object({
    id: z.string().uuid(),
    root: z.string().trim().min(1).max(4_096),
    branch: z.string().trim().min(1).max(500),
  }).strict(),
}).strict();
export type WorkloadExecutionContext = z.infer<typeof workloadExecutionContextSchema>;

export const sessionExecutionCapabilitySchema = z.object({
  code: z.string().min(32).max(1_024),
  expiresAt: z.string().datetime(),
  capabilities: z.array(workloadCapabilitySchema),
}).strict();
export type SessionExecutionCapability = z.infer<typeof sessionExecutionCapabilitySchema>;

export const agentTaskStatusSetRequestSchema = z.object({
  status: z.enum(["blocked", "in_progress"]),
  expectedRevision: z.number().int().positive(),
  idempotencyKey: taskStatusIdempotencyKeySchema,
  note: taskStatusNoteSchema.optional(),
}).strict().superRefine((value, context) => {
  if (value.status === "blocked" && !value.note) {
    context.addIssue({ code: "custom", path: ["note"], message: "blocked requires note" });
  }
});
export type AgentTaskStatusSetRequest = z.infer<typeof agentTaskStatusSetRequestSchema>;

export const taskProductionErrorCodeSchema = z.enum([
  "task_not_found",
  "task_not_eligible",
  "agent_unavailable",
  "runtime_unavailable",
  "invalid_transition",
  "task_status_conflict",
  "missing_status_note",
  "scope_mismatch",
  "capability_expired",
  "invalid_request",
  "control_plane_unavailable",
]);
export type TaskProductionErrorCode = z.infer<typeof taskProductionErrorCodeSchema>;

export const taskProductionErrorResponseSchema = z.object({
  error: z.object({ code: taskProductionErrorCodeSchema, message: z.string().min(1).max(2_000) }).strict(),
}).strict();
