import { z } from "zod";

export const taskIssueProviderSchema = z.enum(["github", "linear"]);
export type TaskIssueProvider = z.infer<typeof taskIssueProviderSchema>;

export const taskTitleSchema = z.string().trim().min(1).max(500);
export const taskDescriptionSchema = z.string().trim().max(100_000).nullable();
export const taskStatusSchema = z.enum([
  "pending",
  "in_progress",
  "blocked",
  "done",
  "canceled",
]);
export type TaskStatus = z.infer<typeof taskStatusSchema>;

export const taskMetadataSchema = z.record(z.string(), z.json());
export type TaskMetadata = z.infer<typeof taskMetadataSchema>;

export const taskStatusActorKindSchema = z.enum(["system", "human", "agent"]);
export type TaskStatusActorKind = z.infer<typeof taskStatusActorKindSchema>;

export const taskStatusActorSchema = z.object({
  kind: taskStatusActorKindSchema,
  actorId: z.string().trim().min(1).max(500).nullable(),
  agentId: z.string().uuid().nullable(),
  attemptId: z.string().uuid().nullable(),
  sessionId: z.string().uuid().nullable(),
}).strict();
export type TaskStatusActor = z.infer<typeof taskStatusActorSchema>;

export const taskStatusNoteSchema = z.string().trim().min(1).max(20_000);
export const taskStatusIdempotencyKeySchema = z.string().trim().min(1).max(500);

export type TaskTransitionActor = "assign" | "human" | "agent";

const AGENT_TRANSITIONS: Record<TaskStatus, readonly TaskStatus[]> = {
  pending: [],
  in_progress: ["blocked"],
  blocked: ["in_progress"],
  done: [],
  canceled: [],
};

const HUMAN_TRANSITIONS: Record<TaskStatus, readonly TaskStatus[]> = {
  pending: ["canceled"],
  in_progress: ["canceled"],
  blocked: ["in_progress", "done", "canceled"],
  done: [],
  canceled: [],
};

export function allowedTaskStatusTransitions(
  actor: TaskTransitionActor,
  from: TaskStatus,
): TaskStatus[] {
  if (actor === "assign") return from === "pending" ? ["in_progress"] : [];
  return [...(actor === "agent" ? AGENT_TRANSITIONS[from] : HUMAN_TRANSITIONS[from])];
}

export function isTaskStatusTransitionAllowed(
  actor: TaskTransitionActor,
  from: TaskStatus,
  to: TaskStatus,
): boolean {
  return allowedTaskStatusTransitions(actor, from).includes(to);
}

export const taskStatusTransitionRequestSchema = z.object({
  status: taskStatusSchema,
  expectedRevision: z.number().int().positive(),
  idempotencyKey: taskStatusIdempotencyKeySchema,
  note: taskStatusNoteSchema.optional(),
}).strict().superRefine((value, context) => {
  if (value.status === "blocked" && !value.note) {
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
    status: taskStatusSchema,
    metadata: taskMetadataSchema,
    runtimeId: z.string().uuid().nullable().default(null),
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
    metadata: taskMetadataSchema.default({}),
    idempotencyKey: z.string().uuid(),
  })
  .strict();
export type ManualTaskCreateRequest = z.input<typeof manualTaskCreateRequestSchema>;
export type ParsedManualTaskCreateRequest = z.infer<typeof manualTaskCreateRequestSchema>;

export const taskCreateSchema = manualTaskCreateRequestSchema
  .extend({ teamId: z.string().uuid() })
  .strict();
export type TaskCreate = z.input<typeof taskCreateSchema>;
export type ParsedTaskCreate = z.output<typeof taskCreateSchema>;

export const taskCreateFromIssueSchema = z
  .object({
    teamId: z.string().uuid(),
    projectId: z.string().uuid(),
    title: taskTitleSchema,
    description: taskDescriptionSchema.default(null),
    issue: taskIssueReferenceSchema,
    metadata: taskMetadataSchema.default({}),
  })
  .strict();
export type TaskCreateFromIssue = z.input<typeof taskCreateFromIssueSchema>;
export type ParsedTaskCreateFromIssue = z.output<typeof taskCreateFromIssueSchema>;

export const taskUpdateRequestSchema = z
  .object({
    title: taskTitleSchema.optional(),
    description: taskDescriptionSchema.optional(),
    metadata: taskMetadataSchema.optional(),
  })
  .strict()
  .refine((value) => value.title !== undefined || value.description !== undefined || value.metadata !== undefined, {
    message: "At least one of title, description, or metadata is required",
  });
export type TaskUpdateRequest = z.input<typeof taskUpdateRequestSchema>;
export type ParsedTaskUpdateRequest = z.infer<typeof taskUpdateRequestSchema>;

export const taskPageSortSchema = z.enum(["updatedAt", "createdAt", "title", "status"]);
export type TaskPageSort = z.infer<typeof taskPageSortSchema>;

export const taskPageDirectionSchema = z.enum(["asc", "desc"]);
export type TaskPageDirection = z.infer<typeof taskPageDirectionSchema>;

export const taskPageQuerySchema = z.object({
  cursor: z.string().trim().min(1).max(4_096).nullable().default(null),
  limit: z.number().int().min(1).max(100).default(50),
  query: z.string().trim().min(1).max(500).nullable().default(null),
  statuses: z.array(taskStatusSchema).max(taskStatusSchema.options.length).default([])
    .refine((values) => new Set(values).size === values.length, "Task statuses must be unique"),
  sort: taskPageSortSchema.default("updatedAt"),
  direction: taskPageDirectionSchema.default("desc"),
}).strict();
export type TaskPageQuery = z.input<typeof taskPageQuerySchema>;
export type ParsedTaskPageQuery = z.output<typeof taskPageQuerySchema>;

export const taskWorkbenchProjectReferenceSchema = z.object({
  provider: z.literal("github"),
  repositoryExternalId: z.string().trim().min(1).max(1_000),
}).strict();
export type TaskWorkbenchProjectReference = z.infer<typeof taskWorkbenchProjectReferenceSchema>;

export const taskWorkbenchItemSchema = taskSchema.extend({
  projectReference: taskWorkbenchProjectReferenceSchema.nullable(),
}).strict();
export type TaskWorkbenchItem = z.infer<typeof taskWorkbenchItemSchema>;

export const taskWorkbenchPageSchema = z.object({
  items: z.array(taskWorkbenchItemSchema),
  nextCursor: z.string().min(1).max(4_096).nullable(),
}).strict();
export type TaskWorkbenchPage = z.infer<typeof taskWorkbenchPageSchema>;

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
  fromStatus: taskStatusSchema,
  toStatus: taskStatusSchema,
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
  status: taskStatusSchema,
  statusRevision: z.number().int().positive(),
  statusUpdatedAt: z.string().datetime(),
  transitionId: z.string().uuid(),
}).strict();
export type TaskStatusTransitionResult = z.infer<typeof taskStatusTransitionResultSchema>;

export const taskStatusViewSchema = z.object({
  taskId: z.string().uuid(),
  status: taskStatusSchema,
  statusRevision: z.number().int().positive(),
  statusNote: taskStatusNoteSchema.nullable(),
  statusUpdatedAt: z.string().datetime(),
  allowedTransitions: z.array(taskStatusSchema),
}).strict();
export type TaskStatusView = z.infer<typeof taskStatusViewSchema>;
