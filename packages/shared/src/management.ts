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
} from "./schemas.js";
import { integrationConnectionSchema, integrationProviderStatusSchema } from "./integrations.js";
import { sessionStateSchema } from "./state.js";

const jsonObjectSchema = z.record(z.string(), z.unknown());

export const managementErrorCodeSchema = z.enum([
  "AGENT_NOT_FOUND",
  "AGENT_ARCHIVED",
  "AGENT_REVISION_CONFLICT",
  "INVALID_AGENT",
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
  "GITHUB_APP_NOT_CONFIGURED",
  "GITHUB_OAUTH_INVALID",
  "GITHUB_INSTALLATION_UNVERIFIED",
  "INTEGRATION_CONNECTION_NOT_FOUND",
  "INTEGRATION_CONNECTION_MISMATCH",
  "INTEGRATION_CONNECTION_SELECTION_REQUIRED",
  "INTEGRATION_CONNECTION_IN_USE",
  "INTEGRATION_CONNECTION_METHOD_DISABLED",
  "INTEGRATION_CONNECTION_METHOD_UNAVAILABLE",
  "INTEGRATION_CONNECTION_DELETE_INCOMPLETE",
  "INTEGRATION_CREDENTIAL_INVALID",
  "INTEGRATION_CREDENTIAL_UNAVAILABLE",
  "INTEGRATION_TIMEOUT",
  "INTEGRATION_RATE_LIMITED",
  "INTEGRATION_UPSTREAM_ERROR",
  "REPOSITORY_CREDENTIAL_UNAVAILABLE",
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
    teamId: true,
    name: true,
    slug: true,
    repositoryConnectionId: true,
    repositoryExternalId: true,
    repositoryBaseBranch: true,
    archivedAt: true,
    createdAt: true,
    updatedAt: true,
  })
  .strict();
export type ProjectSelectionView = z.infer<typeof projectSelectionViewSchema>;

export const laneInspectionViewSchema = z
  .object({
    repositoryConnectionId: projectSelectionViewSchema.shape.repositoryConnectionId,
    repositoryExternalId: projectSelectionViewSchema.shape.repositoryExternalId,
    repositoryBaseBranch: projectSelectionViewSchema.shape.repositoryBaseBranch,
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
    teamId: true,
    name: true,
    slug: true,
    repositoryConnectionId: true,
    repositoryExternalId: true,
    repositoryBaseBranch: true,
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
    repositoryConnectionId: projectSelectionViewSchema.shape.repositoryConnectionId,
    repositoryExternalId: projectSelectionViewSchema.shape.repositoryExternalId,
    repositoryBaseBranch: projectSelectionViewSchema.shape.repositoryBaseBranch,
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
    teamId: z.string().uuid(),
    projectId: z.string().uuid(),
    issueDispatchKey: z.string().min(1).max(1_000).optional(),
    metadata: jsonObjectSchema.default({}),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict();
export type TaskRecord = z.infer<typeof taskRecordSchema>;

export const sessionRecordSchema = z
  .object({
    id: z.string().uuid(),
    taskId: z.string().uuid(),
    initialDispatchKey: z.string().min(1).max(1_000).optional(),
    title: z.string().min(1),
    objective: z.string().min(1),
    provider: z.enum(["codex", "copilot"]),
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
    provider: true,
    branch: true,
    assignedRunnerId: true,
    createdAt: true,
    updatedAt: true,
    startedAt: true,
    finishedAt: true,
  })
  .strict();
export type SessionSummaryItem = z.infer<typeof sessionSummaryItemSchema>;

export const taskListItemSchema = taskRecordSchema;
export type TaskListItem = z.infer<typeof taskListItemSchema>;

export const projectListResponseSchema = z.object({ projects: z.array(projectSelectionViewSchema) }).strict();
export type ProjectListResponse = z.infer<typeof projectListResponseSchema>;

export const projectDetailResponseSchema = z.object({ project: executionContextViewSchema }).strict();
export type ProjectDetailResponse = z.infer<typeof projectDetailResponseSchema>;

export const projectCreateResponseSchema = z.object({ project: projectSchema }).strict();
export type ProjectCreateResponse = z.infer<typeof projectCreateResponseSchema>;

export const integrationConnectionListResponseSchema = z
  .object({
    providers: z.array(integrationProviderStatusSchema),
    connections: z.array(integrationConnectionSchema),
  })
  .strict();
export type IntegrationConnectionListResponse = z.infer<typeof integrationConnectionListResponseSchema>;

export const integrationConnectionResponseSchema = z
  .object({ connection: integrationConnectionSchema })
  .strict();
export type IntegrationConnectionResponse = z.infer<typeof integrationConnectionResponseSchema>;

export const contextBundleCreateResponseSchema = z.object({ contextBundle: contextBundleSchema }).strict();
export type ContextBundleCreateResponse = z.infer<typeof contextBundleCreateResponseSchema>;

export const contextBundleListResponseSchema = z.object({ contextBundles: z.array(contextBundleSchema) }).strict();
export type ContextBundleListResponse = z.infer<typeof contextBundleListResponseSchema>;

export const taskListResponseSchema = z.object({ tasks: z.array(taskListItemSchema) }).strict();
export type TaskListResponse = z.infer<typeof taskListResponseSchema>;

export const taskDetailResponseSchema = z
  .object({ task: taskRecordSchema })
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
    project: projectSchema.pick({ id: true, slug: true }).strict(),
    runtime: resolvedRuntimeContractSchema,
  })
  .strict();
export type RunnerClaimResponse = z.infer<typeof runnerClaimResponseSchema>;

export const runnerRepositoryCredentialRequestSchema = z
  .object({ purpose: z.enum(["clone", "push", "review"]) })
  .strict();
export type RunnerRepositoryCredentialRequest = z.infer<typeof runnerRepositoryCredentialRequestSchema>;

export const ephemeralRepositoryCredentialSchema = z
  .object({
    provider: z.literal("github"),
    username: z.literal("x-access-token"),
    secret: z.string().min(1),
    expiresAt: z.string().datetime(),
  })
  .strict();
export type EphemeralRepositoryCredential = z.infer<typeof ephemeralRepositoryCredentialSchema>;

export const runnerRepositoryCredentialResponseSchema = z
  .object({ credential: ephemeralRepositoryCredentialSchema })
  .strict();
export type RunnerRepositoryCredentialResponse = z.infer<typeof runnerRepositoryCredentialResponseSchema>;

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
