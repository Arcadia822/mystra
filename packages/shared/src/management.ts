import { z } from "zod";

import { runEventSchema } from "./events.js";
import { runResultSchema } from "./result.js";
import {
  cancellationRequestMetadataSchema,
  cancelJobOutcomeSchema,
  contextBundleSchema,
  contextBundleRefSchema,
  jobSpecSchema,
  platformCapabilitiesSchema,
  projectRuntimeConfigSchema,
  projectSchema,
  resolvedRuntimeContractSchema,
} from "./schemas.js";
import { runStateSchema } from "./state.js";
import { workflowExecutionSnapshotSchema } from "./workflow.js";

const jsonObjectSchema = z.record(z.string(), z.unknown());

export const managementErrorCodeSchema = z.enum([
  "PROJECT_NOT_FOUND",
  "PROJECT_ARCHIVED",
  "INVALID_PROJECT",
  "PROJECT_SLUG_CONFLICT",
  "INVALID_SUBMISSION",
  "JOB_NOT_FOUND",
  "RUN_NOT_FOUND",
  "JOB_CANCEL_CONFLICT",
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
  .object({
    error: managementErrorSchema,
  })
  .strict();
export type ManagementErrorResponse = z.infer<typeof managementErrorResponseSchema>;

export const projectSelectionViewSchema = projectSchema
  .pick({
    id: true,
    name: true,
    slug: true,
    repo: true,
    baseBranch: true,
    defaultAgent: true,
    archivedAt: true,
    createdAt: true,
    updatedAt: true,
  })
  .strict();
export type ProjectSelectionView = z.infer<typeof projectSelectionViewSchema>;

export const projectLaneWorkflowHintSchema = z
  .object({
    provider: z.string().min(1).optional(),
    blueprintName: z.string().min(1).optional(),
    blueprintVersion: z.string().min(1).optional(),
  })
  .strict();
export type ProjectLaneWorkflowHint = z.infer<typeof projectLaneWorkflowHintSchema>;

export const laneInspectionViewSchema = z
  .object({
    repo: projectSelectionViewSchema.shape.repo,
    baseBranch: projectSelectionViewSchema.shape.baseBranch,
    defaultAgent: projectSelectionViewSchema.shape.defaultAgent,
    runtime: projectRuntimeConfigSchema,
    contextBundleRefs: z.array(contextBundleRefSchema),
    prewarmConfig: jsonObjectSchema.default({}),
    workflow: projectLaneWorkflowHintSchema.optional(),
    metadata: jsonObjectSchema.default({}),
  })
  .strict();
export type LaneInspectionView = z.infer<typeof laneInspectionViewSchema>;

export const executionContextViewSchema = projectSchema
  .pick({
    id: true,
    name: true,
    slug: true,
    repo: true,
    baseBranch: true,
    defaultAgent: true,
    runtime: true,
    prewarmConfig: true,
    metadata: true,
    archivedAt: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    lane: laneInspectionViewSchema,
  })
  .strict();
export type ExecutionContextView = z.infer<typeof executionContextViewSchema>;

export const runProjectViewSchema = z
  .object({
    id: projectSelectionViewSchema.shape.id,
    name: projectSelectionViewSchema.shape.name,
    slug: projectSelectionViewSchema.shape.slug,
    repo: projectSelectionViewSchema.shape.repo,
    baseBranch: projectSelectionViewSchema.shape.baseBranch,
    defaultAgent: projectSelectionViewSchema.shape.defaultAgent,
    runtime: projectRuntimeConfigSchema,
    prewarmConfig: jsonObjectSchema.default({}),
    metadata: jsonObjectSchema.default({}),
    archivedAt: projectSelectionViewSchema.shape.archivedAt,
    createdAt: projectSelectionViewSchema.shape.createdAt,
    updatedAt: projectSelectionViewSchema.shape.updatedAt,
    lane: laneInspectionViewSchema,
  })
  .strict();
export type RunProjectView = z.infer<typeof runProjectViewSchema>;

export const submittedLaneSnapshotSchema = z
  .object({
    projectId: projectSelectionViewSchema.shape.id,
    projectSlug: projectSelectionViewSchema.shape.slug,
    repo: projectSelectionViewSchema.shape.repo,
    baseBranch: projectSelectionViewSchema.shape.baseBranch,
    defaultAgent: projectSelectionViewSchema.shape.defaultAgent,
    runtime: resolvedRuntimeContractSchema,
    contextBundleRefs: z.array(contextBundleRefSchema),
    prewarmConfig: jsonObjectSchema.default({}),
    workflow: projectLaneWorkflowHintSchema.optional(),
    metadata: jsonObjectSchema.default({}),
    submittedAt: z.string().datetime(),
  })
  .strict();
export type SubmittedLaneSnapshot = z.infer<typeof submittedLaneSnapshotSchema>;

export const jobRecordSchema = z
  .object({
    id: z.string().uuid(),
    spec: jobSpecSchema,
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict();
export type JobRecord = z.infer<typeof jobRecordSchema>;

export const runRecordSchema = z
  .object({
    id: z.string().uuid(),
    jobId: z.string().uuid(),
    state: runStateSchema,
    attempt: z.number().int().positive(),
    assignedRunnerSessionId: z.string().uuid().optional(),
    resolvedRuntime: resolvedRuntimeContractSchema.optional(),
    result: runResultSchema.optional(),
    failureReason: z.string().min(1).optional(),
    cancellationRequest: cancellationRequestMetadataSchema.optional(),
    staleReason: z.string().min(1).optional(),
    staleMarkedAt: z.string().datetime().optional(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    startedAt: z.string().datetime().optional(),
    finishedAt: z.string().datetime().optional(),
  })
  .strict();
export type RunRecord = z.infer<typeof runRecordSchema>;

export const canonicalRunSnapshotSchema = z
  .object({
    job: jobRecordSchema,
    run: runRecordSchema,
    events: z.array(runEventSchema),
    workflow: workflowExecutionSnapshotSchema.optional(),
    project: runProjectViewSchema.optional(),
    lane: submittedLaneSnapshotSchema.optional(),
    runtime: resolvedRuntimeContractSchema.optional(),
  })
  .strict();
export type CanonicalRunSnapshot = z.infer<typeof canonicalRunSnapshotSchema>;

export const projectListResponseSchema = z
  .object({
    projects: z.array(projectSelectionViewSchema),
  })
  .strict();
export type ProjectListResponse = z.infer<typeof projectListResponseSchema>;

export const projectDetailResponseSchema = z
  .object({
    project: executionContextViewSchema,
  })
  .strict();
export type ProjectDetailResponse = z.infer<typeof projectDetailResponseSchema>;

export const projectCreateResponseSchema = z
  .object({
    project: projectSchema,
  })
  .strict();
export type ProjectCreateResponse = z.infer<typeof projectCreateResponseSchema>;

export const contextBundleCreateResponseSchema = z
  .object({
    contextBundle: contextBundleSchema,
  })
  .strict();
export type ContextBundleCreateResponse = z.infer<typeof contextBundleCreateResponseSchema>;

export const contextBundleListResponseSchema = z
  .object({
    contextBundles: z.array(contextBundleSchema),
  })
  .strict();
export type ContextBundleListResponse = z.infer<typeof contextBundleListResponseSchema>;

export const publicRunnerSessionSchema = z
  .object({
    id: z.string().uuid(),
    runnerName: z.string().min(1),
    capabilities: platformCapabilitiesSchema,
    maxConcurrency: z.number().int().positive(),
    activeRunCount: z.number().int().nonnegative(),
    staleAfterSeconds: z.number().int().positive(),
    eligibleProjectIds: z.array(z.string().uuid()).optional(),
    eligibleRuntimeProviders: z.array(z.string()).optional(),
    lastHeartbeatAt: z.string().datetime(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict();
export type PublicRunnerSession = z.infer<typeof publicRunnerSessionSchema>;

export const runnerListResponseSchema = z
  .object({
    runners: z.array(publicRunnerSessionSchema),
  })
  .strict();
export type RunnerListResponse = z.infer<typeof runnerListResponseSchema>;

export const jobListResponseSchema = z
  .object({
    jobs: z.array(canonicalRunSnapshotSchema),
  })
  .strict();
export type JobListResponse = z.infer<typeof jobListResponseSchema>;

export const cancelJobResponseSchema = z.intersection(
  cancelJobOutcomeSchema,
  z
    .object({
      snapshot: canonicalRunSnapshotSchema,
    })
    .strict(),
);
export type CancelJobResponse = z.infer<typeof cancelJobResponseSchema>;
