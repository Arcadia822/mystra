import { z } from "zod";

import { taskIssueProviderSchema } from "./task.js";

export const taskWorkspaceStateSchema = z.enum([
  "queued",
  "preparing",
  "ready",
  "failed",
  "unavailable",
]);
export type TaskWorkspaceState = z.infer<typeof taskWorkspaceStateSchema>;

export const taskWorkspaceFailureCodeSchema = z.enum([
  "task_project_required",
  "repository_unavailable",
  "repository_branches_unavailable",
  "issue_branch_unavailable",
  "branch_invalid",
  "runtime_unavailable",
  "workspace_capability_unavailable",
  "workspace_already_prepared",
  "workspace_not_ready",
  "workspace_missing",
  "workspace_runtime_mismatch",
  "materialization_failed",
  "stale_workspace_attempt",
]);
export type TaskWorkspaceFailureCode = z.infer<typeof taskWorkspaceFailureCodeSchema>;

const gitCommitSchema = z.string().regex(/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/);
export function isValidGitBranchName(branch: string): boolean {
  if (
    branch.length < 1
    || new TextEncoder().encode(branch).byteLength > 244
    || branch !== branch.trim()
    || branch === "@"
    || branch.startsWith("-")
    || branch.startsWith("/")
    || branch.endsWith("/")
    || branch.endsWith(".")
    || branch.includes("..")
    || branch.includes("@{")
    || /[\x00-\x20\x7f~^:?*\[\\]/u.test(branch)
  ) return false;
  return branch.split("/").every((part) => (
    part.length > 0
    && !part.startsWith(".")
    && !part.endsWith(".lock")
  ));
}

export const gitBranchNameSchema = z.string().refine(isValidGitBranchName, {
  message: "Invalid Git branch name",
});
const gitHeadRefSchema = z.string().regex(/^refs\/heads\/.+$/);
const opaqueWorkspaceRefSchema = z
  .string()
  .min(1)
  .max(500)
  .regex(/^[a-z][a-z0-9-]*:[A-Za-z0-9._-]+$/);

export const taskWorkspaceSetupRequestSchema = z
  .object({
    runtimeId: z.string().uuid(),
    idempotencyKey: z.string().uuid(),
  })
  .strict();
export type TaskWorkspaceSetupRequest = z.infer<typeof taskWorkspaceSetupRequestSchema>;

export const taskWorkspaceFailureSchema = z
  .object({
    code: taskWorkspaceFailureCodeSchema,
    message: z.string().trim().min(1).max(1_000).nullable(),
  })
  .strict();
export type TaskWorkspaceFailure = z.infer<typeof taskWorkspaceFailureSchema>;

const taskWorkspacePublicFields = {
  id: z.string().uuid(),
  taskId: z.string().uuid(),
  projectId: z.string().uuid(),
  runtimeId: z.string().uuid(),
  state: taskWorkspaceStateSchema,
  sharingMode: z.literal("shared-mutable"),
  configuredBaseBranch: gitBranchNameSchema,
  baseRef: gitHeadRefSchema,
  baseCommit: gitCommitSchema,
  branchName: gitBranchNameSchema,
  branchStrategy: z.string().trim().min(1).max(200),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  readyAt: z.string().datetime().nullable(),
} as const;

export const taskWorkspaceViewSchema = z
  .object({
    ...taskWorkspacePublicFields,
    failure: taskWorkspaceFailureSchema.nullable(),
  })
  .strict()
  .superRefine((workspace, ctx) => {
    if (workspace.state === "ready" && workspace.readyAt === null) {
      ctx.addIssue({ code: "custom", path: ["readyAt"], message: "A ready Workspace requires readyAt" });
    }
    if (workspace.state !== "ready" && workspace.readyAt !== null) {
      ctx.addIssue({ code: "custom", path: ["readyAt"], message: "Only a ready Workspace may have readyAt" });
    }
    if ((workspace.state === "failed" || workspace.state === "unavailable") && workspace.failure === null) {
      ctx.addIssue({ code: "custom", path: ["failure"], message: "A failed or unavailable Workspace requires failure" });
    }
  });
export type TaskWorkspaceView = z.infer<typeof taskWorkspaceViewSchema>;

export const taskWorkspaceTrustedSchema = z
  .object({
    ...taskWorkspacePublicFields,
    teamId: z.string().uuid(),
    connectionId: z.string().uuid(),
    repositoryExternalId: z.string().trim().min(1).max(1_000),
    issueProvider: taskIssueProviderSchema.nullable(),
    issueConnectionId: z.string().uuid().nullable(),
    issueScopeExternalId: z.string().trim().min(1).max(1_000).nullable(),
    issueExternalId: z.string().trim().min(1).max(1_000).nullable(),
    workspaceRef: opaqueWorkspaceRefSchema.nullable(),
    activeAttemptSequence: z.number().int().positive(),
    failureCode: taskWorkspaceFailureCodeSchema.nullable(),
    failureMessage: z.string().trim().min(1).max(1_000).nullable(),
  })
  .strict()
  .superRefine((workspace, ctx) => {
    const isReady = workspace.state === "ready";
    if (isReady !== (workspace.workspaceRef !== null)) {
      ctx.addIssue({
        code: "custom",
        path: ["workspaceRef"],
        message: "workspaceRef must be present exactly when the Workspace is ready",
      });
    }
    if (isReady !== (workspace.readyAt !== null)) {
      ctx.addIssue({
        code: "custom",
        path: ["readyAt"],
        message: "readyAt must be present exactly when the Workspace is ready",
      });
    }
    const issueValues = [
      workspace.issueProvider,
      workspace.issueConnectionId,
      workspace.issueScopeExternalId,
      workspace.issueExternalId,
    ];
    if (issueValues.some((value) => value !== null) && issueValues.some((value) => value === null)) {
      ctx.addIssue({ code: "custom", path: ["issueProvider"], message: "Issue provenance is all-or-none" });
    }
    const requiresFailure = workspace.state === "failed" || workspace.state === "unavailable";
    if (requiresFailure !== (workspace.failureCode !== null)) {
      ctx.addIssue({ code: "custom", path: ["failureCode"], message: "Failure code does not match Workspace state" });
    }
    if (workspace.failureCode === null && workspace.failureMessage !== null) {
      ctx.addIssue({ code: "custom", path: ["failureMessage"], message: "Failure message requires a failure code" });
    }
  });
export type TaskWorkspaceTrusted = z.infer<typeof taskWorkspaceTrustedSchema>;

export const workspacePreparationAttemptStateSchema = z.enum([
  "queued",
  "claimed",
  "succeeded",
  "failed",
  "expired",
]);
export type WorkspacePreparationAttemptState = z.infer<typeof workspacePreparationAttemptStateSchema>;

export const workspacePreparationAttemptSchema = z
  .object({
    id: z.string().uuid(),
    workspaceId: z.string().uuid(),
    sequence: z.number().int().positive(),
    state: workspacePreparationAttemptStateSchema,
    runnerId: z.string().uuid().nullable(),
    leaseExpiresAt: z.string().datetime().nullable(),
    claimedAt: z.string().datetime().nullable(),
    completedAt: z.string().datetime().nullable(),
    failureCode: taskWorkspaceFailureCodeSchema.nullable(),
    createdAt: z.string().datetime(),
  })
  .strict();
export type WorkspacePreparationAttempt = z.infer<typeof workspacePreparationAttemptSchema>;

export const gitRemoteRefSchema = z
  .object({
    name: gitBranchNameSchema,
    ref: gitHeadRefSchema,
    commit: gitCommitSchema,
  })
  .strict()
  .refine((value) => value.ref === `refs/heads/${value.name}`, {
    message: "Remote branch name and ref must match",
    path: ["ref"],
  });
export type GitRemoteRef = z.infer<typeof gitRemoteRefSchema>;

export const gitRemoteRefAdvertisementSchema = z
  .object({
    head: gitRemoteRefSchema.nullable(),
    branches: z.array(gitRemoteRefSchema).max(10_000),
  })
  .strict();
export type GitRemoteRefAdvertisement = z.infer<typeof gitRemoteRefAdvertisementSchema>;

export const projectRepositoryBranchQuerySchema = z
  .object({
    first: z.coerce.number().int().min(1).max(100).default(50),
    after: z.string().min(1).max(2_000).optional(),
    query: z.string().trim().min(1).max(200).optional(),
  })
  .strict();
export type ProjectRepositoryBranchQuery = z.infer<typeof projectRepositoryBranchQuerySchema>;

export const projectRepositoryBranchPageSchema = z
  .object({
    branches: z.array(gitRemoteRefSchema).max(100),
    head: gitRemoteRefSchema.nullable(),
    pageInfo: z
      .object({ hasNextPage: z.boolean(), endCursor: z.string().min(1).nullable() })
      .strict(),
  })
  .strict();
export type ProjectRepositoryBranchPage = z.infer<typeof projectRepositoryBranchPageSchema>;

export const workspaceBranchDecisionSchema = z
  .object({
    branchName: gitBranchNameSchema,
    strategy: z.string().trim().min(1).max(200),
    source: z.enum(["issue-provider", "task-fallback"]),
  })
  .strict();
export type WorkspaceBranchDecision = z.infer<typeof workspaceBranchDecisionSchema>;

export const sessionWorkspaceAttachmentSchema = z
  .object({
    kind: z.literal("task"),
    taskWorkspaceId: z.string().uuid(),
    runtimeId: z.string().uuid(),
    workspaceRef: opaqueWorkspaceRefSchema,
    sharingMode: z.literal("shared-mutable"),
  })
  .strict();
export type SessionWorkspaceAttachment = z.infer<typeof sessionWorkspaceAttachmentSchema>;

const repositoryPreparationSchema = z
  .object({
    provider: z.string().trim().min(1).max(100),
    connectionId: z.string().uuid(),
    repositoryExternalId: z.string().trim().min(1).max(1_000),
    baseRef: gitHeadRefSchema,
    baseCommit: gitCommitSchema,
    transport: z.object({ kind: z.literal("https"), endpoint: z.string().url().startsWith("https://") }).strict(),
  })
  .strict();

export const workspacePreparationClaimRequestSchema = z
  .object({
    runnerId: z.string().uuid(),
    waitSeconds: z.coerce.number().int().min(0).max(25).default(0),
  })
  .strict();
export type WorkspacePreparationClaimRequest = z.infer<
  typeof workspacePreparationClaimRequestSchema
>;

export const workspacePreparationClaimSchema = z
  .object({
    workspaceId: z.string().uuid(),
    attemptId: z.string().uuid(),
    attemptSequence: z.number().int().positive(),
    leaseExpiresAt: z.string().datetime(),
    workspaceRef: opaqueWorkspaceRefSchema,
    repository: repositoryPreparationSchema,
    branch: z.object({ name: gitBranchNameSchema, strategy: z.string().trim().min(1).max(200) }).strict(),
    credential: z
      .object({ kind: z.literal("http-basic-token"), secret: z.string().min(1).max(16_384) })
      .strict(),
  })
  .strict();
export type WorkspacePreparationClaim = z.infer<typeof workspacePreparationClaimSchema>;

export const workspacePreparationReportSchema = z.discriminatedUnion("status", [
  z
    .object({
      runnerId: z.string().uuid(),
      attemptSequence: z.number().int().positive(),
      status: z.literal("succeeded"),
      workspaceRef: opaqueWorkspaceRefSchema,
      observed: z.object({ baseCommit: gitCommitSchema, branchName: gitBranchNameSchema }).strict(),
    })
    .strict(),
  z
    .object({
      runnerId: z.string().uuid(),
      attemptSequence: z.number().int().positive(),
      status: z.literal("failed"),
      failure: taskWorkspaceFailureSchema,
    })
    .strict(),
]);
export type WorkspacePreparationReport = z.infer<typeof workspacePreparationReportSchema>;

export const workspaceAvailabilityReportSchema = z
  .object({
    runnerId: z.string().uuid(),
    status: z.literal("missing"),
    failure: z.object({
      code: z.literal("workspace_missing"),
      message: z.string().trim().min(1).max(1_000),
    }).strict(),
  })
  .strict();
export type WorkspaceAvailabilityReport = z.infer<typeof workspaceAvailabilityReportSchema>;
