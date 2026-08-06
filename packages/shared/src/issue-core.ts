import { z } from "zod";

import {
  repositoryReferenceSchema,
  repositorySnapshotSchema,
} from "./repository.js";

export const issueReferenceSchema = z
  .object({
    integration: z.string().trim().min(1),
    provider: z.string().trim().min(1),
    externalId: z.string().trim().min(1),
    identifier: z.string().trim().min(1).max(255),
    url: z.string().url(),
    repository: repositoryReferenceSchema.optional(),
  })
  .strict();
export type IssueReference = z.infer<typeof issueReferenceSchema>;

export const issueStateSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    type: z.string().min(1).optional(),
  })
  .strict();
export type IssueState = z.infer<typeof issueStateSchema>;

export const issuePrioritySchema = z
  .object({
    value: z.number().int(),
    label: z.string().min(1),
  })
  .strict();
export type IssuePriority = z.infer<typeof issuePrioritySchema>;

export const issueAssigneeSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
  })
  .strict();
export type IssueAssignee = z.infer<typeof issueAssigneeSchema>;

export const issueLabelSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
  })
  .strict();
export type IssueLabel = z.infer<typeof issueLabelSchema>;

export const issueSchema = z
  .object({
    reference: issueReferenceSchema,
    title: z.string().trim().min(1).max(500),
    description: z.string().max(100_000).nullable(),
    state: issueStateSchema,
    priority: issuePrioritySchema.nullable(),
    assignee: issueAssigneeSchema.nullable(),
    labels: z.array(issueLabelSchema).max(100),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    fetchedAt: z.string().datetime(),
  })
  .strict();
export type Issue = z.infer<typeof issueSchema>;

export const issueSnapshotSchema = issueSchema.readonly();
export type IssueSnapshot = z.infer<typeof issueSnapshotSchema>;

export const issuePageInfoSchema = z
  .object({
    hasNextPage: z.boolean(),
    endCursor: z.string().min(1).nullable().optional(),
  })
  .strict();
export type IssuePageInfo = z.infer<typeof issuePageInfoSchema>;

export const issueListRequestSchema = z
  .object({
    first: z.number().int().min(1).max(100).default(25),
    after: z.string().min(1).optional(),
    repository: repositorySnapshotSchema.optional(),
  })
  .strict();
export type IssueListRequest = z.infer<typeof issueListRequestSchema>;

export const issueGetRequestSchema = z
  .object({
    identifier: z.string().trim().min(1).max(255),
    repository: repositorySnapshotSchema.optional(),
  })
  .strict();
export type IssueGetRequest = z.infer<typeof issueGetRequestSchema>;

export const issueListResponseSchema = z
  .object({
    items: z.array(issueSchema),
    pageInfo: issuePageInfoSchema,
  })
  .strict();
export type IssueListResponse = z.infer<typeof issueListResponseSchema>;

export const integrationCapabilitySchema = z.enum(["repositories", "issues"]);
export type IntegrationCapability = z.infer<typeof integrationCapabilitySchema>;

export const integrationDescriptorSchema = z
  .object({
    name: z.string().trim().min(1),
    provider: z.string().trim().min(1),
    capabilities: z.array(integrationCapabilitySchema).min(1),
  })
  .strict()
  .superRefine((integration, ctx) => {
    if (new Set(integration.capabilities).size !== integration.capabilities.length) {
      ctx.addIssue({
        code: "custom",
        message: "Integration capabilities must be unique",
        path: ["capabilities"],
      });
    }
  });
export type IntegrationDescriptor = z.infer<typeof integrationDescriptorSchema>;

export const integrationErrorCodeSchema = z.enum([
  "INTEGRATION_NOT_FOUND",
  "INTEGRATION_CONNECTION_NOT_FOUND",
  "INTEGRATION_CONNECTION_MISMATCH",
  "INTEGRATION_CONNECTION_INACTIVE",
  "INTEGRATION_CONNECTION_SELECTION_REQUIRED",
  "INTEGRATION_CONNECTION_IN_USE",
  "INTEGRATION_CONNECTION_METHOD_DISABLED",
  "INTEGRATION_CONNECTION_METHOD_UNAVAILABLE",
  "INTEGRATION_CONNECTION_DELETE_INCOMPLETE",
  "INTEGRATION_CREDENTIAL_INVALID",
  "INTEGRATION_CREDENTIAL_UNAVAILABLE",
  "GITHUB_APP_NOT_CONFIGURED",
  "GITHUB_OAUTH_INVALID",
  "GITHUB_INSTALLATION_UNVERIFIED",
  "REPOSITORY_CAPABILITY_UNAVAILABLE",
  "ISSUE_CAPABILITY_UNAVAILABLE",
  "REPOSITORY_NOT_FOUND",
  "REPOSITORY_SCOPE_REQUIRED",
  "ISSUE_NOT_FOUND",
  "INTEGRATION_NOT_CONFIGURED",
  "INTEGRATION_UNAUTHORIZED",
  "INTEGRATION_RATE_LIMITED",
  "INTEGRATION_TIMEOUT",
  "INTEGRATION_UPSTREAM_ERROR",
  "INTEGRATION_INVALID_RESPONSE",
  "DISPATCH_CONFLICT",
]);
export type IntegrationErrorCode = z.infer<typeof integrationErrorCodeSchema>;

export const integrationErrorSchema = z
  .object({
    code: integrationErrorCodeSchema,
    message: z.string().min(1),
    retryAfterSeconds: z.number().int().nonnegative().optional(),
    details: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();
export type IntegrationError = z.infer<typeof integrationErrorSchema>;

export const integrationErrorResponseSchema = z
  .object({
    error: integrationErrorSchema,
  })
  .strict();
export type IntegrationErrorResponse = z.infer<typeof integrationErrorResponseSchema>;
