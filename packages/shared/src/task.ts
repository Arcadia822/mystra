import { z } from "zod";

export const taskIssueProviderSchema = z.enum(["github", "linear"]);
export type TaskIssueProvider = z.infer<typeof taskIssueProviderSchema>;

export const taskTitleSchema = z.string().trim().min(1).max(500);
export const taskDescriptionSchema = z.string().trim().max(100_000).nullable();
export const taskProductionStatusSchema = z.enum([
  "pending",
  "in_progress",
  "blocked",
  "waiting_for_review",
  "done",
  "canceled",
]);
export type TaskProductionStatus = z.infer<typeof taskProductionStatusSchema>;

export const taskStatusActorKindSchema = z.enum(["system", "human", "agent"]);
export type TaskStatusActorKind = z.infer<typeof taskStatusActorKindSchema>;

export const taskStatusActorSchema = z.object({
  kind: taskStatusActorKindSchema,
  actorId: z.string().trim().min(1).max(500).nullable(),
  agentId: z.string().uuid().nullable(),
  harnessId: z.string().uuid().nullable(),
  sessionId: z.string().uuid().nullable(),
}).strict();
export type TaskStatusActor = z.infer<typeof taskStatusActorSchema>;

export const taskStatusNoteSchema = z.string().trim().min(1).max(20_000);
export const taskStatusIdempotencyKeySchema = z.string().trim().min(1).max(500);

export type TaskTransitionActor = "assign" | "human" | "agent";

const AGENT_TRANSITIONS: Record<TaskProductionStatus, readonly TaskProductionStatus[]> = {
  pending: [],
  in_progress: ["blocked", "waiting_for_review"],
  blocked: ["in_progress"],
  waiting_for_review: [],
  done: [],
  canceled: [],
};

const HUMAN_TRANSITIONS: Record<TaskProductionStatus, readonly TaskProductionStatus[]> = {
  pending: ["canceled"],
  in_progress: ["canceled"],
  blocked: ["in_progress", "canceled"],
  waiting_for_review: ["in_progress", "done", "canceled"],
  done: [],
  canceled: [],
};

export function allowedTaskProductionTransitions(
  actor: TaskTransitionActor,
  from: TaskProductionStatus,
): TaskProductionStatus[] {
  if (actor === "assign") return from === "pending" ? ["in_progress"] : [];
  return [...(actor === "agent" ? AGENT_TRANSITIONS[from] : HUMAN_TRANSITIONS[from])];
}

export function isTaskProductionTransitionAllowed(
  actor: TaskTransitionActor,
  from: TaskProductionStatus,
  to: TaskProductionStatus,
): boolean {
  return allowedTaskProductionTransitions(actor, from).includes(to);
}

export const taskStatusTransitionRequestSchema = z.object({
  status: taskProductionStatusSchema,
  expectedRevision: z.number().int().positive(),
  idempotencyKey: taskStatusIdempotencyKeySchema,
  note: taskStatusNoteSchema.optional(),
}).strict().superRefine((value, context) => {
  if ((value.status === "blocked" || value.status === "waiting_for_review") && !value.note) {
    context.addIssue({
      code: "custom",
      path: ["note"],
      message: `${value.status} requires a non-empty note`,
    });
  }
});
export type TaskStatusTransitionRequest = z.infer<typeof taskStatusTransitionRequestSchema>;

export const taskIssueReferenceSchema = z
  .object({
    provider: taskIssueProviderSchema,
    connectionId: z.string().uuid(),
    scopeExternalId: z.string().trim().min(1).max(1_000),
    externalId: z.string().trim().min(1).max(1_000),
    identifier: z.string().trim().min(1).max(500),
  })
  .strict();
export type TaskIssueReference = z.infer<typeof taskIssueReferenceSchema>;

export const taskSchema = z
  .object({
    id: z.string().uuid(),
    teamId: z.string().uuid(),
    title: taskTitleSchema,
    description: taskDescriptionSchema,
    projectId: z.string().uuid().nullable(),
    issue: taskIssueReferenceSchema.nullable(),
    productionStatus: taskProductionStatusSchema,
    statusRevision: z.number().int().positive(),
    statusNote: taskStatusNoteSchema.nullable(),
    statusUpdatedAt: z.string().datetime(),
    statusActor: taskStatusActorSchema,
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict();
export type Task = z.infer<typeof taskSchema>;

export const manualTaskCreateRequestSchema = z
  .object({
    title: taskTitleSchema,
    description: taskDescriptionSchema.default(null),
    projectId: z.string().uuid().nullable().default(null),
    idempotencyKey: z.string().uuid(),
  })
  .strict();
export type ManualTaskCreateRequest = z.input<typeof manualTaskCreateRequestSchema>;
export type ParsedManualTaskCreateRequest = z.infer<typeof manualTaskCreateRequestSchema>;

export const taskCreateSchema = manualTaskCreateRequestSchema
  .extend({ teamId: z.string().uuid() })
  .strict();
export type TaskCreate = z.infer<typeof taskCreateSchema>;

export const taskCreateFromIssueSchema = z
  .object({
    teamId: z.string().uuid(),
    projectId: z.string().uuid(),
    title: taskTitleSchema,
    description: taskDescriptionSchema.default(null),
    issue: taskIssueReferenceSchema,
  })
  .strict();
export type TaskCreateFromIssue = z.infer<typeof taskCreateFromIssueSchema>;

export const taskUpdateRequestSchema = z
  .object({
    title: taskTitleSchema.optional(),
    description: taskDescriptionSchema.optional(),
  })
  .strict()
  .refine((value) => value.title !== undefined || value.description !== undefined, {
    message: "At least one of title or description is required",
  });
export type TaskUpdateRequest = z.input<typeof taskUpdateRequestSchema>;
export type ParsedTaskUpdateRequest = z.infer<typeof taskUpdateRequestSchema>;

export const taskIssueResolutionSchema = z.discriminatedUnion("status", [
  z
    .object({
      status: z.literal("available"),
      title: z.string().trim().min(1).max(500),
      identifier: z.string().trim().min(1).max(500),
      url: z.string().url(),
    })
    .strict(),
  z.object({ status: z.literal("unavailable") }).strict(),
]);
export type TaskIssueResolution = z.infer<typeof taskIssueResolutionSchema>;

export const issueTaskCreateRequestSchema = z
  .object({
    externalId: z.string().trim().min(1).max(1_000),
    identifier: z.string().trim().min(1).max(500),
  })
  .strict();
export type IssueTaskCreateRequest = z.infer<typeof issueTaskCreateRequestSchema>;

export const taskStatusTransitionSchema = z.object({
  id: z.string().uuid(),
  teamId: z.string().uuid(),
  taskId: z.string().uuid(),
  fromStatus: taskProductionStatusSchema,
  toStatus: taskProductionStatusSchema,
  revision: z.number().int().positive(),
  actor: taskStatusActorSchema,
  note: taskStatusNoteSchema.nullable(),
  idempotencyKey: taskStatusIdempotencyKeySchema,
  requestFingerprint: z.string().regex(/^[a-f0-9]{64}$/u),
  occurredAt: z.string().datetime(),
}).strict();
export type TaskStatusTransition = z.infer<typeof taskStatusTransitionSchema>;

export const taskStatusTransitionResultSchema = z.object({
  taskId: z.string().uuid(),
  productionStatus: taskProductionStatusSchema,
  statusRevision: z.number().int().positive(),
  statusUpdatedAt: z.string().datetime(),
  transitionId: z.string().uuid(),
}).strict();
export type TaskStatusTransitionResult = z.infer<typeof taskStatusTransitionResultSchema>;

export const taskStatusViewSchema = z.object({
  taskId: z.string().uuid(),
  productionStatus: taskProductionStatusSchema,
  statusRevision: z.number().int().positive(),
  statusNote: taskStatusNoteSchema.nullable(),
  statusUpdatedAt: z.string().datetime(),
  allowedTransitions: z.array(taskProductionStatusSchema),
}).strict();
export type TaskStatusView = z.infer<typeof taskStatusViewSchema>;
