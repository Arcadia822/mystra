import {
  issueListResponseSchema,
  issueSchema,
  linearIssueListRequestSchema,
  linearIssueListItemSchema,
  linearIssueListResponseSchema,
  type Issue,
  type IssueGetRequest,
  type IssueListRequest,
  type IssueListResponse,
  type LinearIssueListRequest,
  type LinearIssueListResponse,
  type LinearIssueListItem,
} from "@mystra/shared";
import { z } from "zod";

import { IntegrationFailure } from "./errors";
import type { IntegrationPlugin, IssueProvider } from "./types";

const LINEAR_GRAPHQL_URL = "https://api.linear.app/graphql";
const DEFAULT_TIMEOUT_MS = 15_000;

const issueFields = `
  id
  identifier
  title
  description
  url
  priority
  priorityLabel
  state { id name type }
  assignee { id name }
  labels { nodes { id name } }
  cycle { id name number }
  createdAt
  updatedAt
  team { id }
`;

const listQuery = `
  query MystraIssues($first: Int!, $after: String) {
    issues(first: $first, after: $after) {
      nodes { ${issueFields} }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

const projectListQuery = `
  query MystraProjectIssues($first: Int!, $after: String, $filter: IssueFilter) {
    issues(first: $first, after: $after, filter: $filter, orderBy: updatedAt) {
      nodes { ${issueFields} }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

const getQuery = `
  query MystraIssue($identifier: String!) {
    issue(id: $identifier) { ${issueFields} }
  }
`;

const rawIssueSchema = z
  .object({
    id: z.string().min(1),
    identifier: z.string().min(1),
    title: z.string().min(1),
    description: z.string().nullable(),
    url: z.string().url(),
    priority: z.number().int().nullable(),
    priorityLabel: z.string().min(1).nullable(),
    state: z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      type: z.string().min(1).optional(),
    }).strict(),
    assignee: z.object({
      id: z.string().min(1),
      name: z.string().min(1),
    }).strict().nullable(),
    labels: z.object({
      nodes: z.array(z.object({
        id: z.string().min(1),
        name: z.string().min(1),
      }).strict()),
    }).strict(),
    cycle: z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      number: z.number().int().positive().nullable(),
    }).strict().nullable().optional().default(null),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    team: z.object({ id: z.string().min(1) }).strict().optional(),
  })
  .strict();

const graphQlEnvelopeSchema = z
  .object({
    data: z.unknown().optional(),
    errors: z.array(z.object({ message: z.string() }).passthrough()).optional(),
  })
  .passthrough();

const listDataSchema = z.object({
  issues: z.object({
    nodes: z.array(rawIssueSchema),
    pageInfo: z.object({
      hasNextPage: z.boolean(),
      endCursor: z.string().min(1).nullable().optional(),
    }).strict(),
  }).strict(),
}).strict();

const getDataSchema = z.object({
  issue: rawIssueSchema.nullable(),
}).strict();

type Fetch = typeof fetch;

function retryAfterSeconds(response: Response): number | undefined {
  const raw = response.headers.get("retry-after");
  if (!raw) {
    return undefined;
  }
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : undefined;
}

function normalizeIssue(raw: z.infer<typeof rawIssueSchema>, fetchedAt: string): Issue {
  return issueSchema.parse({
    reference: {
      integration: "linear",
      provider: "linear",
      externalId: raw.id,
      identifier: raw.identifier,
      url: raw.url,
    },
    title: raw.title,
    description: raw.description,
    state: raw.state,
    priority: raw.priority === null || raw.priorityLabel === null
      ? null
      : { value: raw.priority, label: raw.priorityLabel },
    assignee: raw.assignee,
    labels: raw.labels.nodes,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    fetchedAt,
  });
}

export class LinearIssueProvider implements IssueProvider {
  readonly providerName = "linear";
  readonly repositoryScope = "unsupported";
  private readonly apiKey: string | undefined;
  private readonly fetchImpl: Fetch;
  private readonly timeoutMs: number;

  constructor(input: {
    apiKey: string | undefined;
    fetchImpl?: Fetch;
    timeoutMs?: number;
  }) {
    this.apiKey = input.apiKey;
    this.fetchImpl = input.fetchImpl ?? globalThis.fetch;
    this.timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  async listIssues(input: IssueListRequest): Promise<IssueListResponse> {
    const envelope = await this.query(listQuery, {
      first: input.first,
      ...(input.after ? { after: input.after } : {}),
    });
    const parsed = this.parseData(listDataSchema, envelope.data);
    const fetchedAt = new Date().toISOString();
    return issueListResponseSchema.parse({
      items: parsed.issues.nodes.map((issue) => normalizeIssue(issue, fetchedAt)),
      pageInfo: parsed.issues.pageInfo,
    });
  }

  async listProjectIssues(
    input: LinearIssueListRequest & { linearTeamExternalId: string },
  ): Promise<LinearIssueListResponse> {
    const request = linearIssueListRequestSchema.parse({
      first: input.first,
      ...(input.after ? { after: input.after } : {}),
      ...(input.status ? { status: input.status } : {}),
      ...(input.priority !== undefined ? { priority: input.priority } : {}),
      ...(input.assignee ? { assignee: input.assignee } : {}),
      ...(input.cycle ? { cycle: input.cycle } : {}),
    });
    const filter = {
      team: { id: { eq: input.linearTeamExternalId } },
      ...(request.status ? { state: { id: { eq: request.status } } } : {}),
      ...(request.priority !== undefined ? { priority: { eq: request.priority } } : {}),
      ...(request.assignee ? { assignee: { id: { eq: request.assignee } } } : {}),
      ...(request.cycle ? { cycle: { id: { eq: request.cycle } } } : {}),
    };
    const envelope = await this.query(projectListQuery, {
      first: request.first,
      ...(request.after ? { after: request.after } : {}),
      filter,
    });
    const parsed = this.parseData(listDataSchema, envelope.data);
    return linearIssueListResponseSchema.parse({
      provider: "linear",
      items: parsed.issues.nodes.map((issue) => ({
        externalId: issue.id,
        identifier: issue.identifier,
        title: issue.title,
        status: issue.state,
        priority: issue.priority === null || issue.priorityLabel === null
          ? null
          : { value: issue.priority, label: issue.priorityLabel },
        assignee: issue.assignee,
        cycle: issue.cycle,
        updatedAt: issue.updatedAt,
        url: issue.url,
      })),
      pageInfo: parsed.issues.pageInfo,
    });
  }

  async getIssue(input: IssueGetRequest): Promise<Issue | undefined> {
    const envelope = await this.query(getQuery, { identifier: input.identifier });
    const parsed = this.parseData(getDataSchema, envelope.data);
    return parsed.issue ? normalizeIssue(parsed.issue, new Date().toISOString()) : undefined;
  }

  async getProjectIssue(input: {
    identifier: string;
    linearTeamExternalId: string;
  }): Promise<LinearIssueListItem | undefined> {
    const envelope = await this.query(getQuery, { identifier: input.identifier });
    const parsed = this.parseData(getDataSchema, envelope.data);
    if (!parsed.issue) return undefined;
    if (parsed.issue.team?.id !== input.linearTeamExternalId) {
      throw new IntegrationFailure({ code: "ISSUE_SCOPE_UNAVAILABLE", message: "Linear Issue is outside the configured Team" });
    }
    const issue = parsed.issue;
    return linearIssueListItemSchema.parse({
      externalId: issue.id,
      identifier: issue.identifier,
      title: issue.title,
      status: issue.state,
      priority: issue.priority === null || issue.priorityLabel === null
        ? null
        : { value: issue.priority, label: issue.priorityLabel },
      assignee: issue.assignee,
      cycle: issue.cycle,
      updatedAt: issue.updatedAt,
      url: issue.url,
    });
  }

  private parseData<T extends z.ZodType>(
    schema: T,
    data: unknown,
  ): z.infer<T> {
    const parsed = schema.safeParse(data);
    if (!parsed.success) {
      throw new IntegrationFailure({
        code: "INTEGRATION_INVALID_RESPONSE",
        message: "Linear returned an invalid response",
      });
    }
    return parsed.data;
  }

  private async query(
    query: string,
    variables: Record<string, unknown>,
  ): Promise<z.infer<typeof graphQlEnvelopeSchema>> {
    if (!this.apiKey) {
      throw new IntegrationFailure({
        code: "INTEGRATION_NOT_CONFIGURED",
        message: "Linear Integration is not configured",
      });
    }

    let response: Response;
    try {
      response = await this.fetchImpl(LINEAR_GRAPHQL_URL, {
        method: "POST",
        headers: {
          authorization: this.apiKey,
          "content-type": "application/json",
        },
        body: JSON.stringify({ query, variables }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      if (
        (error instanceof DOMException && error.name === "AbortError")
        || (error instanceof Error && error.name === "TimeoutError")
      ) {
        throw new IntegrationFailure({
          code: "INTEGRATION_TIMEOUT",
          message: "Linear request timed out",
        });
      }
      throw new IntegrationFailure({
        code: "INTEGRATION_UPSTREAM_ERROR",
        message: "Linear request failed",
      });
    }

    if (response.status === 401 || response.status === 403) {
      throw new IntegrationFailure({
        code: "INTEGRATION_UNAUTHORIZED",
        message: "Linear rejected the configured credentials",
      });
    }
    if (response.status === 429) {
      const retryAfter = retryAfterSeconds(response);
      throw new IntegrationFailure({
        code: "INTEGRATION_RATE_LIMITED",
        message: "Linear rate limit exceeded",
        ...(retryAfter !== undefined
          ? { retryAfterSeconds: retryAfter }
          : {}),
      });
    }
    if (!response.ok) {
      throw new IntegrationFailure({
        code: "INTEGRATION_UPSTREAM_ERROR",
        message: `Linear request failed with HTTP ${response.status}`,
      });
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new IntegrationFailure({
        code: "INTEGRATION_INVALID_RESPONSE",
        message: "Linear returned invalid JSON",
      });
    }
    const envelope = graphQlEnvelopeSchema.safeParse(body);
    if (!envelope.success) {
      throw new IntegrationFailure({
        code: "INTEGRATION_INVALID_RESPONSE",
        message: "Linear returned an invalid GraphQL envelope",
      });
    }
    if (envelope.data.errors && envelope.data.errors.length > 0) {
      throw new IntegrationFailure({
        code: "INTEGRATION_UPSTREAM_ERROR",
        message: "Linear GraphQL request failed",
      });
    }
    return envelope.data;
  }
}

export function createLinearIntegration(input: {
  apiKey: string | undefined;
  fetchImpl?: Fetch;
  timeoutMs?: number;
}): IntegrationPlugin {
  return {
    descriptor: {
      name: "linear",
      provider: "linear",
      capabilities: ["issues"],
    },
    capabilities: {
      issues: new LinearIssueProvider(input),
    },
  };
}
