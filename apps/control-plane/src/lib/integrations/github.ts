import {
  issueListResponseSchema,
  issueSchema,
  repositoryListResponseSchema,
  repositorySnapshotSchema,
  type Issue,
  type IssueGetRequest,
  type IssueListRequest,
  type IssueListResponse,
  type RepositoryListRequest,
  type RepositoryListResponse,
  type RepositorySnapshot,
} from "@mystra/shared";
import { z } from "zod";

import { IntegrationFailure } from "./errors";
import type {
  IntegrationPlugin,
  IssueProvider,
  RepoProvider,
} from "./types";

const GITHUB_API_URL = "https://api.github.com";
const DEFAULT_TIMEOUT_MS = 15_000;

const rawRepositorySchema = z.object({
  id: z.union([z.number().int(), z.string().min(1)]),
  full_name: z.string().min(1),
  html_url: z.string().url(),
  clone_url: z.string().url(),
  default_branch: z.string().min(1),
  visibility: z.enum(["private", "public", "internal"]),
  archived: z.boolean(),
}).passthrough();

const rawIssueSchema = z.object({
  id: z.union([z.number().int(), z.string().min(1)]),
  number: z.number().int().positive(),
  title: z.string().min(1),
  body: z.string().nullable(),
  html_url: z.string().url(),
  state: z.enum(["open", "closed"]),
  state_reason: z.string().nullable().optional(),
  assignee: z.object({
    id: z.union([z.number().int(), z.string().min(1)]),
    login: z.string().min(1),
  }).passthrough().nullable(),
  labels: z.array(z.object({
    id: z.union([z.number().int(), z.string().min(1)]),
    name: z.string().min(1),
  }).passthrough()),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  pull_request: z.unknown().optional(),
}).passthrough();

type Fetch = typeof fetch;

function retryAfterSeconds(response: Response): number | undefined {
  const raw = response.headers.get("retry-after");
  if (!raw) {
    return undefined;
  }
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : undefined;
}

function repositoryPath(identifier: string): string {
  return identifier
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function nextPage(response: Response): string | undefined {
  const link = response.headers.get("link");
  if (!link) {
    return undefined;
  }
  const next = link
    .split(",")
    .map((part) => part.trim())
    .find((part) => part.endsWith('rel="next"'));
  const url = next?.match(/^<([^>]+)>/)?.[1];
  if (!url) {
    return undefined;
  }
  return new URL(url).searchParams.get("page") ?? undefined;
}

function normalizeRepository(
  raw: z.infer<typeof rawRepositorySchema>,
  fetchedAt: string,
): RepositorySnapshot {
  return repositorySnapshotSchema.parse({
    integration: "github",
    provider: "github",
    externalId: String(raw.id),
    fullName: raw.full_name,
    url: raw.html_url,
    cloneUrl: raw.clone_url,
    defaultBranch: raw.default_branch,
    visibility: raw.visibility,
    isArchived: raw.archived,
    fetchedAt,
  });
}

function normalizeIssue(
  raw: z.infer<typeof rawIssueSchema>,
  repository: RepositorySnapshot,
  fetchedAt: string,
): Issue {
  const stateName = raw.state === "open" ? "Open" : "Closed";
  return issueSchema.parse({
    reference: {
      integration: "github",
      provider: "github",
      externalId: String(raw.id),
      identifier: String(raw.number),
      url: raw.html_url,
      repository: {
        integration: repository.integration,
        provider: repository.provider,
        externalId: repository.externalId,
        fullName: repository.fullName,
        url: repository.url,
      },
    },
    title: raw.title,
    description: raw.body,
    state: {
      id: raw.state,
      name: stateName,
      type: raw.state_reason ?? raw.state,
    },
    priority: null,
    assignee: raw.assignee
      ? { id: String(raw.assignee.id), name: raw.assignee.login }
      : null,
    labels: raw.labels.map((label) => ({
      id: String(label.id),
      name: label.name,
    })),
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
    fetchedAt,
  });
}

export class GitHubIntegrationProvider implements RepoProvider, IssueProvider {
  readonly providerName = "github";
  readonly repositoryScope = "required";
  private readonly token: string | undefined;
  private readonly fetchImpl: Fetch;
  private readonly timeoutMs: number;

  constructor(input: {
    token: string | undefined;
    fetchImpl?: Fetch;
    timeoutMs?: number;
  }) {
    this.token = input.token;
    this.fetchImpl = input.fetchImpl ?? globalThis.fetch;
    this.timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  async listRepositories(input: RepositoryListRequest): Promise<RepositoryListResponse> {
    const page = input.after ?? "1";
    const response = await this.request(
      `/user/repos?per_page=${input.first}&page=${encodeURIComponent(page)}&sort=updated`,
    );
    const raw = await this.parseJson(z.array(rawRepositorySchema), response);
    const fetchedAt = new Date().toISOString();
    const endCursor = nextPage(response);
    return repositoryListResponseSchema.parse({
      items: raw.map((repository) => normalizeRepository(repository, fetchedAt)),
      pageInfo: {
        hasNextPage: endCursor !== undefined,
        ...(endCursor ? { endCursor } : {}),
      },
    });
  }

  async getRepository(identifier: string): Promise<RepositorySnapshot | undefined> {
    const response = await this.request(
      `/repos/${repositoryPath(identifier)}`,
      { allowNotFound: true },
    );
    if (response.status === 404) {
      return undefined;
    }
    const raw = await this.parseJson(rawRepositorySchema, response);
    return normalizeRepository(raw, new Date().toISOString());
  }

  async listIssues(input: IssueListRequest): Promise<IssueListResponse> {
    const repository = this.requireRepository(input.repository);
    const page = input.after ?? "1";
    const response = await this.request(
      `/repos/${repositoryPath(repository.fullName)}/issues`
      + `?state=all&per_page=${input.first}&page=${encodeURIComponent(page)}`,
    );
    const raw = await this.parseJson(z.array(rawIssueSchema), response);
    const fetchedAt = new Date().toISOString();
    const endCursor = nextPage(response);
    return issueListResponseSchema.parse({
      items: raw
        .filter((issue) => issue.pull_request === undefined)
        .map((issue) => normalizeIssue(issue, repository, fetchedAt)),
      pageInfo: {
        hasNextPage: endCursor !== undefined,
        ...(endCursor ? { endCursor } : {}),
      },
    });
  }

  async getIssue(input: IssueGetRequest): Promise<Issue | undefined> {
    const repository = this.requireRepository(input.repository);
    const response = await this.request(
      `/repos/${repositoryPath(repository.fullName)}/issues/`
      + encodeURIComponent(input.identifier),
      { allowNotFound: true },
    );
    if (response.status === 404) {
      return undefined;
    }
    const raw = await this.parseJson(rawIssueSchema, response);
    if (raw.pull_request !== undefined) {
      return undefined;
    }
    return normalizeIssue(raw, repository, new Date().toISOString());
  }

  private requireRepository(
    repository: RepositorySnapshot | undefined,
  ): RepositorySnapshot {
    if (!repository || repository.integration !== "github" || repository.provider !== "github") {
      throw new IntegrationFailure({
        code: "REPOSITORY_SCOPE_REQUIRED",
        message: "GitHub Issues require a GitHub Repository scope",
      });
    }
    return repository;
  }

  private async parseJson<T extends z.ZodType>(
    schema: T,
    response: Response,
  ): Promise<z.infer<T>> {
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new IntegrationFailure({
        code: "INTEGRATION_INVALID_RESPONSE",
        message: "GitHub returned invalid JSON",
      });
    }
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      throw new IntegrationFailure({
        code: "INTEGRATION_INVALID_RESPONSE",
        message: "GitHub returned an invalid response",
      });
    }
    return parsed.data;
  }

  private async request(
    path: string,
    options: { allowNotFound?: boolean } = {},
  ): Promise<Response> {
    if (!this.token) {
      throw new IntegrationFailure({
        code: "INTEGRATION_NOT_CONFIGURED",
        message: "GitHub Integration is not configured",
      });
    }

    let response: Response;
    try {
      response = await this.fetchImpl(`${GITHUB_API_URL}${path}`, {
        headers: {
          accept: "application/vnd.github+json",
          authorization: `Bearer ${this.token}`,
          "x-github-api-version": "2022-11-28",
        },
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      if (
        (error instanceof DOMException && error.name === "AbortError")
        || (error instanceof Error && error.name === "TimeoutError")
      ) {
        throw new IntegrationFailure({
          code: "INTEGRATION_TIMEOUT",
          message: "GitHub request timed out",
        });
      }
      throw new IntegrationFailure({
        code: "INTEGRATION_UPSTREAM_ERROR",
        message: "GitHub request failed",
      });
    }

    if (options.allowNotFound && response.status === 404) {
      return response;
    }
    if (response.status === 429 || (
      response.status === 403
      && response.headers.get("x-ratelimit-remaining") === "0"
    )) {
      const retryAfter = retryAfterSeconds(response);
      throw new IntegrationFailure({
        code: "INTEGRATION_RATE_LIMITED",
        message: "GitHub rate limit exceeded",
        ...(retryAfter !== undefined ? { retryAfterSeconds: retryAfter } : {}),
      });
    }
    if (response.status === 401 || response.status === 403) {
      throw new IntegrationFailure({
        code: "INTEGRATION_UNAUTHORIZED",
        message: "GitHub rejected the configured credentials",
      });
    }
    if (!response.ok) {
      throw new IntegrationFailure({
        code: "INTEGRATION_UPSTREAM_ERROR",
        message: `GitHub request failed with HTTP ${response.status}`,
      });
    }
    return response;
  }
}

export function createGitHubIntegration(input: {
  token: string | undefined;
  fetchImpl?: Fetch;
  timeoutMs?: number;
}): IntegrationPlugin {
  const provider = new GitHubIntegrationProvider(input);
  return {
    descriptor: {
      name: "github",
      provider: "github",
      capabilities: ["repositories", "issues"],
    },
    capabilities: {
      repositories: provider,
      issues: provider,
    },
  };
}
