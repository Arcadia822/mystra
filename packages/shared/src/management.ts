import { z } from "zod";

import {
  contextBundleRefSchema,
  contextBundleSchema,
  projectRuntimeConfigSchema,
  projectSchema,
  resolvedRuntimeContractSchema,
} from "./schemas.js";
import { integrationConnectionSchema, integrationProviderStatusSchema } from "./integrations.js";
import { taskIssueResolutionSchema, taskSchema } from "./task.js";

export * from "./skill.js";

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
  "invalid_content_type",
  "content_length_required",
  "skill_zip_too_large",
  "invalid_skill_zip",
  "skill_name_conflict",
  "skill_not_found",
  "skill_revision_not_found",
  "skill_file_not_found",
  "skill_file_not_previewable",
  "skill_archived",
  "skill_name_mismatch",
  "revision_conflict",
  "skill_storage_unavailable",
  "skill_storage_misconfigured",
  "skill_storage_integrity_error",
  "skill_storage_integrity_conflict",
  "publication_failed",
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

export const taskRecordSchema = taskSchema;
export type TaskRecord = z.infer<typeof taskRecordSchema>;

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
  .object({ task: taskRecordSchema, issueResolution: taskIssueResolutionSchema.optional() })
  .strict();
export type TaskDetailResponse = z.infer<typeof taskDetailResponseSchema>;

export const taskCreateResponseSchema = z
  .object({ task: taskRecordSchema, created: z.boolean() })
  .strict();
export type TaskCreateResponse = z.infer<typeof taskCreateResponseSchema>;

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
