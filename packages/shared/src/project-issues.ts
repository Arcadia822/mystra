import { z } from "zod";

const httpsUrlSchema = z.string().url().refine((value) => new URL(value).protocol === "https:", {
  message: "Provider URL must use HTTPS",
});

export const projectIssuePageInfoSchema = z.object({
  hasNextPage: z.boolean(),
  endCursor: z.string().min(1).nullable().optional(),
}).strict();

const projectIssueListRequestBase = {
  first: z.coerce.number().int().min(1).max(100).default(25),
  after: z.string().min(1).optional(),
};

export const githubIssueListRequestSchema = z.object({
  ...projectIssueListRequestBase,
  state: z.enum(["open", "closed", "all"]).default("open"),
  assignee: z.string().trim().min(1).max(255).optional(),
  label: z.string().trim().min(1).max(255).optional(),
  milestone: z.string().trim().min(1).max(255).optional(),
}).strict();
export type GitHubIssueListRequest = z.infer<typeof githubIssueListRequestSchema>;

export const linearIssueListRequestSchema = z.object({
  ...projectIssueListRequestBase,
  status: z.string().trim().min(1).max(255).optional(),
  priority: z.coerce.number().int().min(0).max(4).optional(),
  assignee: z.string().trim().min(1).max(255).optional(),
  cycle: z.string().trim().min(1).max(255).optional(),
}).strict();
export type LinearIssueListRequest = z.infer<typeof linearIssueListRequestSchema>;

const githubAssigneeSchema = z.object({
  id: z.string().min(1),
  login: z.string().min(1),
  avatarUrl: httpsUrlSchema.nullable().default(null),
}).strict();

const githubLabelSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  color: z.string().regex(/^[0-9a-fA-F]{6}$/u),
}).strict();

export const githubIssueListItemSchema = z.object({
  externalId: z.string().min(1),
  number: z.number().int().positive(),
  title: z.string().trim().min(1).max(500),
  state: z.enum(["open", "closed"]),
  assignees: z.array(githubAssigneeSchema).max(100),
  labels: z.array(githubLabelSchema).max(100),
  milestone: z.object({ id: z.string().min(1), title: z.string().min(1) }).strict().nullable(),
  updatedAt: z.string().datetime(),
  url: httpsUrlSchema,
}).strict();
export type GitHubIssueListItem = z.infer<typeof githubIssueListItemSchema>;

export const linearIssueListItemSchema = z.object({
  externalId: z.string().min(1),
  identifier: z.string().trim().min(1).max(255),
  title: z.string().trim().min(1).max(500),
  status: z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    type: z.string().min(1).optional(),
  }).strict(),
  priority: z.object({ value: z.number().int(), label: z.string().min(1) }).strict().nullable(),
  assignee: z.object({ id: z.string().min(1), name: z.string().min(1) }).strict().nullable(),
  cycle: z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    number: z.number().int().positive().nullable().default(null),
  }).strict().nullable(),
  updatedAt: z.string().datetime(),
  url: httpsUrlSchema,
}).strict();
export type LinearIssueListItem = z.infer<typeof linearIssueListItemSchema>;

export const githubIssueListResponseSchema = z.object({
  provider: z.literal("github"),
  items: z.array(githubIssueListItemSchema),
  pageInfo: projectIssuePageInfoSchema,
}).strict();
export type GitHubIssueListResponse = z.infer<typeof githubIssueListResponseSchema>;

export const linearIssueListResponseSchema = z.object({
  provider: z.literal("linear"),
  items: z.array(linearIssueListItemSchema),
  pageInfo: projectIssuePageInfoSchema,
}).strict();
export type LinearIssueListResponse = z.infer<typeof linearIssueListResponseSchema>;

export const projectIssueListResponseSchema = z.discriminatedUnion("provider", [
  githubIssueListResponseSchema,
  linearIssueListResponseSchema,
]);
export type ProjectIssueListResponse = z.infer<typeof projectIssueListResponseSchema>;

export const projectIssueSourceSchema = z.object({
  id: z.string().uuid(),
  teamId: z.string().uuid(),
  projectId: z.string().uuid(),
  integration: z.literal("linear"),
  connectionId: z.string().uuid(),
  scopeType: z.literal("linear-team"),
  scopeExternalId: z.string().trim().min(1).max(1_000),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
}).strict();
export type ProjectIssueSource = z.infer<typeof projectIssueSourceSchema>;

export const projectIssueSourceUpsertSchema = z.object({
  connectionId: z.string().uuid(),
  linearTeamExternalId: z.string().trim().min(1).max(1_000),
}).strict();
export type ProjectIssueSourceUpsert = z.infer<typeof projectIssueSourceUpsertSchema>;

const issueSourceAvailabilitySchema = z.enum(["available", "unavailable"]);

export const projectIssueSourcesResponseSchema = z.object({
  github: z.object({
    integration: z.literal("github"),
    connectionId: z.string().uuid(),
    repositoryExternalId: z.string().min(1),
    availability: issueSourceAvailabilitySchema,
  }).strict(),
  linear: z.object({
    integration: z.literal("linear"),
    connectionId: z.string().uuid(),
    linearTeamExternalId: z.string().min(1),
    team: z.object({ id: z.string().min(1), key: z.string().min(1), name: z.string().min(1) }).strict().optional(),
    availability: issueSourceAvailabilitySchema,
  }).strict().nullable(),
}).strict();
export type ProjectIssueSourcesResponse = z.infer<typeof projectIssueSourcesResponseSchema>;
