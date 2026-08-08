import { z } from "zod";

export const taskIssueProviderSchema = z.enum(["github", "linear"]);
export type TaskIssueProvider = z.infer<typeof taskIssueProviderSchema>;

export const taskTitleSchema = z.string().trim().min(1).max(500);
export const taskDescriptionSchema = z.string().trim().max(100_000).nullable();

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
