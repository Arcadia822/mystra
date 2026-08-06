import { createHash } from "node:crypto";

import { z } from "zod";

import { IntegrationFailure } from "./errors";

const GITHUB_API_URL = "https://api.github.com";
const DEFAULT_TIMEOUT_MS = 15_000;

type Fetch = typeof fetch;

const githubUserSchema = z.object({
  id: z.union([z.number().int().positive(), z.string().min(1)]),
  login: z.string().min(1),
  type: z.string().min(1),
  avatar_url: z.string().url().optional(),
}).passthrough();

const githubRepositoryAccessSchema = z.object({
  id: z.union([z.number().int().positive(), z.string().min(1)]),
  full_name: z.string().min(1),
  permissions: z.object({
    pull: z.boolean().optional(),
    push: z.boolean().optional(),
    admin: z.boolean().optional(),
    maintain: z.boolean().optional(),
    triage: z.boolean().optional(),
  }).passthrough().optional(),
}).passthrough();

export interface GitHubPatValidation {
  providerExternalId: string;
  account: {
    externalId: string;
    login: string;
    type: string;
    avatarUrl?: string;
  };
  repositorySelection: "token";
  permissions: Record<string, string>;
  accessSummary: Record<string, unknown>;
}

function retryAfterSeconds(response: Response): number | undefined {
  const raw = response.headers.get("retry-after");
  const value = raw === null ? Number.NaN : Number(raw);
  return Number.isInteger(value) && value >= 0 ? value : undefined;
}

function isTimeout(error: unknown): boolean {
  return (error instanceof DOMException && error.name === "AbortError")
    || (error instanceof Error && error.name === "TimeoutError");
}

async function githubPatRequest(
  url: string,
  token: string,
  fetchImpl: Fetch,
  timeoutMs: number,
): Promise<Response> {
  let response: Response;
  try {
    response = await fetchImpl(url, {
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${token}`,
        "x-github-api-version": "2022-11-28",
      },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    if (isTimeout(error)) {
      throw new IntegrationFailure({
        code: "INTEGRATION_TIMEOUT",
        message: "GitHub credential validation timed out",
      });
    }
    throw new IntegrationFailure({
      code: "INTEGRATION_UPSTREAM_ERROR",
      message: "GitHub credential validation failed",
    });
  }
  if (response.status === 429 || (
    response.status === 403 && response.headers.get("x-ratelimit-remaining") === "0"
  )) {
    const retryAfter = retryAfterSeconds(response);
    throw new IntegrationFailure({
      code: "INTEGRATION_RATE_LIMITED",
      message: "GitHub rate limit exceeded while validating the credential",
      ...(retryAfter !== undefined ? { retryAfterSeconds: retryAfter } : {}),
    });
  }
  if (response.status === 401 || response.status === 403) {
    throw new IntegrationFailure({
      code: "INTEGRATION_CREDENTIAL_INVALID",
      message: "GitHub rejected the personal access token",
    });
  }
  if (!response.ok) {
    throw new IntegrationFailure({
      code: "INTEGRATION_UPSTREAM_ERROR",
      message: `GitHub credential validation failed with HTTP ${response.status}`,
    });
  }
  return response;
}

async function parseJson<T extends z.ZodType>(schema: T, response: Response): Promise<z.infer<T>> {
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new IntegrationFailure({
      code: "INTEGRATION_INVALID_RESPONSE",
      message: "GitHub returned an invalid credential validation response",
    });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new IntegrationFailure({
      code: "INTEGRATION_INVALID_RESPONSE",
      message: "GitHub returned an invalid credential validation response",
    });
  }
  return parsed.data;
}

export async function validateGitHubPat(
  token: string,
  options: { fetchImpl?: Fetch; timeoutMs?: number } = {},
): Promise<GitHubPatValidation> {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const userResponse = await githubPatRequest(`${GITHUB_API_URL}/user`, token, fetchImpl, timeoutMs);
  const user = await parseJson(githubUserSchema, userResponse);
  const repositoriesResponse = await githubPatRequest(
    `${GITHUB_API_URL}/user/repos?per_page=100&affiliation=owner%2Ccollaborator%2Corganization_member`,
    token,
    fetchImpl,
    timeoutMs,
  );
  const repositories = await parseJson(z.array(githubRepositoryAccessSchema), repositoriesResponse);
  if (repositories.length === 0) {
    throw new IntegrationFailure({
      code: "INTEGRATION_CREDENTIAL_INVALID",
      message: "The personal access token cannot access any repository",
    });
  }
  const canPush = repositories.some((repository) => (
    repository.permissions?.push === true || repository.permissions?.admin === true
  ));
  return {
    providerExternalId: `pat:${createHash("sha256").update(token).digest("hex")}`,
    account: {
      externalId: String(user.id),
      login: user.login,
      type: user.type,
      ...(user.avatar_url ? { avatarUrl: user.avatar_url } : {}),
    },
    repositorySelection: "token",
    permissions: {
      contents: canPush ? "write" : "read",
      pull_requests: "unverified",
    },
    accessSummary: {
      repositoryCountAtLeast: repositories.length,
      pullRequests: "unverified",
    },
  };
}
