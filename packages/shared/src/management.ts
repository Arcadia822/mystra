import { z } from "zod";

import { sessionResultSchema } from "./result.js";
import {
  cancellationRequestMetadataSchema,
  contextBundleRefSchema,
  contextBundleSchema,
  mergeRequestSpecSchema,
  platformCapabilitiesSchema,
  projectRuntimeConfigSchema,
  projectSchema,
  resolvedRuntimeContractSchema,
  sessionRuntimeOverrideSchema,
  taskSourceSchema,
} from "./schemas.js";
import { issueSnapshotSchema } from "./issue-core.js";
import { repositorySnapshotSchema } from "./repository.js";
import { sessionStateSchema } from "./state.js";

const jsonObjectSchema = z.record(z.string(), z.unknown());

export const managementErrorCodeSchema = z.enum([
  "PROJECT_NOT_FOUND",
  "PROJECT_ARCHIVED",
  "INVALID_PROJECT",
  "PROJECT_SLUG_CONFLICT",
  "INVALID_TASK",
  "TASK_NOT_FOUND",
  "INVALID_SESSION",
  "SESSION_NOT_FOUND",
  "SESSION_CANCEL_CONFLICT",
  "SESSION_BRANCH_CONFLICT",
  "RUNTIME_POLICY_VIOLATION",
  "RUNNER_NOT_FOUND",
  "DISPATCH_CONFLICT",
  "RESULT_NOT_READY",
  "RESULT_UNAVAILABLE",
]);
export type ManagementErrorCode = z.infer<typeof managementErrorCodeSchema>;

export const managementErrorSchema = z
  .object({
    code: managementErrorCodeSchema,
    message: z.string().min(1),
    details: jsonObjectSchema.optional(),
  })
  .strict();
export type ManagementError = z.infer<typeof managementErrorSchema>;

export const managementErrorResponseSchema = z
  .object({ error: managementErrorSchema })
  .strict();
export type ManagementErrorResponse = z.infer<typeof managementErrorResponseSchema>;

export const projectSelectionViewSchema = projectSchema
  .pick({
    id: true,
    name: true,
    slug: true,
    repository: true,
    baseBranch: true,
    defaultAgent: true,
    archivedAt: true,
    createdAt: true,
    updatedAt: true,
  })
  .strict();
export type ProjectSelectionView = z.infer<typeof projectSelectionViewSchema>;

export const laneInspectionViewSchema = z
  .object({
    repository: projectSelectionViewSchema.shape.repository,
    baseBranch: projectSelectionViewSchema.shape.baseBranch,
    defaultAgent: projectSelectionViewSchema.shape.defaultAgent,
    runtime: projectRuntimeConfigSchema,
    contextBundleRefs: z.array(contextBundleRefSchema),
    prewarmConfig: jsonObjectSchema.default({}),
    metadata: jsonObjectSchema.default({}),
  })
  .strict();
export type LaneInspectionView = z.infer<typeof laneInspectionViewSchema>;

export const executionContextViewSchema = projectSchema
  .pick({
    id: true,
    name: true,
    slug: true,
    repository: true,
    baseBranch: true,
    defaultAgent: true,
    runtime: true,
    prewarmConfig: true,
    metadata: true,
    archivedAt: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({ lane: laneInspectionViewSchema })
  .strict();
export type ExecutionContextView = z.infer<typeof executionContextViewSchema>;

export const sessionProjectViewSchema = executionContextViewSchema;
export type SessionProjectView = z.infer<typeof sessionProjectViewSchema>;

export const submittedLaneSnapshotSchema = z
  .object({
    projectId: projectSelectionViewSchema.shape.id,
    projectSlug: projectSelectionViewSchema.shape.slug,
    repository: projectSelectionViewSchema.shape.repository,
    baseBranch: projectSelectionViewSchema.shape.baseBranch,
    defaultAgent: projectSelectionViewSchema.shape.defaultAgent,
    runtime: resolvedRuntimeContractSchema,
    contextBundleRefs: z.array(contextBundleRefSchema),
    prewarmConfig: jsonObjectSchema.default({}),
    metadata: jsonObjectSchema.default({}),
    submittedAt: z.string().datetime(),
  })
  .strict();
export type SubmittedLaneSnapshot = z.infer<typeof submittedLaneSnapshotSchema>;

export const taskRecordSchema = z
  .object({
    id: z.string().uuid(),
    projectId: z.string().uuid(),
    source: taskSourceSchema,
    objective: z.string().min(1),
    issue: issueSnapshotSchema.optional(),
    dispatchKey: z.string().min(1).max(1_000).optional(),
    repository: repositorySnapshotSchema,
    metadata: jsonObjectSchema.default({}),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict()
  .superRefine((task, ctx) => {
    if (task.source === "issue" && (!task.issue || !task.dispatchKey)) {
      ctx.addIssue({
        code: "custom",
        message: "Issue-driven Tasks require issue and dispatchKey",
        path: ["issue"],
      });
    }
    if (task.source !== "issue" && (task.issue || task.dispatchKey)) {
      ctx.addIssue({
        code: "custom",
        message: "Only Issue-driven Tasks may include issue or dispatchKey",
        path: ["source"],
      });
    }
  });
export type TaskRecord = z.infer<typeof taskRecordSchema>;

export const sessionRecordSchema = z
  .object({
    id: z.string().uuid(),
    taskId: z.string().uuid(),
    initialDispatchKey: z.string().min(1).max(1_000).optional(),
    title: z.string().min(1),
    objective: z.string().min(1),
    agent: z.enum(["codex", "copilot"]),
    branch: z.string().min(1),
    mergeRequest: mergeRequestSpecSchema.optional(),
    runtimeOverride: sessionRuntimeOverrideSchema.optional(),
    state: sessionStateSchema,
    assignedRunnerId: z.string().uuid().optional(),
    resolvedRuntime: resolvedRuntimeContractSchema.optional(),
    result: sessionResultSchema.optional(),
    failureReason: z.string().min(1).optional(),
    cancellationRequest: cancellationRequestMetadataSchema.optional(),
    staleReason: z.string().min(1).optional(),
    staleMarkedAt: z.string().datetime().optional(),
    metadata: jsonObjectSchema.default({}),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    startedAt: z.string().datetime().optional(),
    finishedAt: z.string().datetime().optional(),
  })
  .strict();
export type SessionRecord = z.infer<typeof sessionRecordSchema>;

export const sessionSummaryItemSchema = sessionRecordSchema
  .pick({
    id: true,
    taskId: true,
    title: true,
    state: true,
    agent: true,
    branch: true,
    assignedRunnerId: true,
    createdAt: true,
    updatedAt: true,
    startedAt: true,
    finishedAt: true,
  })
  .strict();
export type SessionSummaryItem = z.infer<typeof sessionSummaryItemSchema>;

export const taskSessionSummarySchema = z
  .object({
    sessionCount: z.number().int().nonnegative(),
    activeSessionCount: z.number().int().nonnegative(),
    latestSession: sessionSummaryItemSchema.optional(),
  })
  .strict()
  .superRefine((summary, ctx) => {
    if (summary.activeSessionCount > summary.sessionCount) {
      ctx.addIssue({
        code: "custom",
        message: "activeSessionCount cannot exceed sessionCount",
        path: ["activeSessionCount"],
      });
    }
    if (summary.latestSession && summary.sessionCount === 0) {
      ctx.addIssue({
        code: "custom",
        message: "latestSession requires a non-empty Session collection",
        path: ["latestSession"],
      });
    }
  });
export type TaskSessionSummary = z.infer<typeof taskSessionSummarySchema>;

export const taskListItemSchema = taskRecordSchema
  .and(taskSessionSummarySchema)
  .transform((value) => ({ ...value }));
export type TaskListItem = z.infer<typeof taskListItemSchema>;

export const projectListResponseSchema = z.object({ projects: z.array(projectSelectionViewSchema) }).strict();
export type ProjectListResponse = z.infer<typeof projectListResponseSchema>;

export const projectDetailResponseSchema = z.object({ project: executionContextViewSchema }).strict();
export type ProjectDetailResponse = z.infer<typeof projectDetailResponseSchema>;

export const projectCreateResponseSchema = z.object({ project: projectSchema }).strict();
export type ProjectCreateResponse = z.infer<typeof projectCreateResponseSchema>;

export const contextBundleCreateResponseSchema = z.object({ contextBundle: contextBundleSchema }).strict();
export type ContextBundleCreateResponse = z.infer<typeof contextBundleCreateResponseSchema>;

export const contextBundleListResponseSchema = z.object({ contextBundles: z.array(contextBundleSchema) }).strict();
export type ContextBundleListResponse = z.infer<typeof contextBundleListResponseSchema>;

export const taskListResponseSchema = z.object({ tasks: z.array(taskListItemSchema) }).strict();
export type TaskListResponse = z.infer<typeof taskListResponseSchema>;

export const taskDetailResponseSchema = z
  .object({ task: taskRecordSchema, sessionSummary: taskSessionSummarySchema })
  .strict();
export type TaskDetailResponse = z.infer<typeof taskDetailResponseSchema>;

export const taskCreateResponseSchema = z.object({ task: taskRecordSchema }).strict();
export type TaskCreateResponse = z.infer<typeof taskCreateResponseSchema>;

export const sessionListResponseSchema = z
  .object({ taskId: z.string().uuid(), sessions: z.array(sessionRecordSchema) })
  .strict();
export type SessionListResponse = z.infer<typeof sessionListResponseSchema>;

export const sessionDetailResponseSchema = z
  .object({ session: sessionRecordSchema, task: taskRecordSchema, project: sessionProjectViewSchema.optional() })
  .strict();
export type SessionDetailResponse = z.infer<typeof sessionDetailResponseSchema>;

export const sessionCreateResponseSchema = z.object({ session: sessionRecordSchema }).strict();
export type SessionCreateResponse = z.infer<typeof sessionCreateResponseSchema>;

export const runnerClaimResponseSchema = z
  .object({
    task: taskRecordSchema,
    session: sessionRecordSchema,
    project: projectSchema.pick({ id: true, slug: true, runtime: true, prewarmConfig: true }).strict(),
    runtime: resolvedRuntimeContractSchema,
  })
  .strict();
export type RunnerClaimResponse = z.infer<typeof runnerClaimResponseSchema>;

export const cancelSessionResponseSchema = z
  .object({ outcome: z.enum(["canceled", "cancellation_requested"]), session: sessionRecordSchema })
  .strict();
export type CancelSessionResponse = z.infer<typeof cancelSessionResponseSchema>;

export const runnerAssignmentSchema = z
  .object({ taskId: z.string().uuid(), sessionId: z.string().uuid() })
  .strict();
export type RunnerAssignment = z.infer<typeof runnerAssignmentSchema>;

export const publicRunnerSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string().min(1),
    capabilities: platformCapabilitiesSchema,
    maxConcurrency: z.number().int().positive(),
    activeSessionCount: z.number().int().nonnegative(),
    health: z.enum(["healthy", "stale"]),
    staleAfterSeconds: z.number().int().positive(),
    eligibleProjectIds: z.array(z.string().uuid()).optional(),
    eligibleRuntimeProviders: z.array(z.string().min(1)).optional(),
    currentAssignments: z.array(runnerAssignmentSchema).default([]),
    lastHeartbeatAt: z.string().datetime(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict()
  .superRefine((runner, ctx) => {
    if (runner.activeSessionCount > runner.maxConcurrency) {
      ctx.addIssue({
        code: "custom",
        message: "activeSessionCount cannot exceed maxConcurrency",
        path: ["activeSessionCount"],
      });
    }
    if (runner.currentAssignments.length !== runner.activeSessionCount) {
      ctx.addIssue({
        code: "custom",
        message: "currentAssignments must match activeSessionCount",
        path: ["currentAssignments"],
      });
    }
  });
export type PublicRunner = z.infer<typeof publicRunnerSchema>;

export const runnerListResponseSchema = z.object({ runners: z.array(publicRunnerSchema) }).strict();
export type RunnerListResponse = z.infer<typeof runnerListResponseSchema>;

export const runnerDetailResponseSchema = z.object({ runner: publicRunnerSchema }).strict();
export type RunnerDetailResponse = z.infer<typeof runnerDetailResponseSchema>;
