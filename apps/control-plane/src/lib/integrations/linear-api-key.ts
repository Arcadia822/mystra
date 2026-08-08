import { linearTeamListResponseSchema, type LinearTeamListResponse } from "@mystra/shared";
import { z } from "zod";

import { IntegrationFailure } from "./errors";

const LINEAR_GRAPHQL_URL = "https://api.linear.app/graphql";
const DEFAULT_TIMEOUT_MS = 15_000;

const teamSchema = z.object({
  id: z.string().min(1),
  key: z.string().min(1),
  name: z.string().min(1),
  archivedAt: z.string().datetime().nullable(),
}).strict();

const pageInfoSchema = z.object({
  hasNextPage: z.boolean(),
  endCursor: z.string().min(1).nullable().optional(),
}).strict();

const validationDataSchema = z.object({
  viewer: z.object({ id: z.string().min(1), name: z.string().min(1) }).strict(),
  organization: z.object({ id: z.string().min(1), name: z.string().min(1) }).strict(),
  teams: z.object({ nodes: z.array(teamSchema), pageInfo: pageInfoSchema }).strict(),
  issues: z.object({ nodes: z.array(z.object({ id: z.string().min(1) }).strict()) }).strict(),
}).strict();

const teamsDataSchema = z.object({
  teams: z.object({ nodes: z.array(teamSchema), pageInfo: pageInfoSchema }).strict(),
}).strict();

const envelopeSchema = z.object({
  data: z.unknown().optional(),
  errors: z.array(z.object({ message: z.string() }).passthrough()).optional(),
}).passthrough();

const validationQuery = `
  query MystraValidateLinearConnection {
    viewer { id name }
    organization { id name }
    teams(first: 100) {
      nodes { id key name archivedAt }
      pageInfo { hasNextPage endCursor }
    }
    issues(first: 1) { nodes { id } }
  }
`;

const teamsQuery = `
  query MystraLinearTeams($first: Int!, $after: String) {
    teams(first: $first, after: $after) {
      nodes { id key name archivedAt }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

const teamQuery = `
  query MystraLinearTeam($id: String!) {
    team(id: $id) { id key name archivedAt }
  }
`;

const teamDataSchema = z.object({ team: teamSchema.nullable() }).strict();

type Fetch = typeof fetch;
type Options = { fetchImpl?: Fetch; timeoutMs?: number };

export type LinearApiKeyValidation = {
  providerExternalId: string;
  viewer: { id: string; name: string };
  workspace: { id: string; name: string };
  teamCount: number;
};

export async function validateLinearApiKey(
  apiKey: string,
  options: Options = {},
): Promise<LinearApiKeyValidation> {
  const envelope = await requestLinear(apiKey, validationQuery, {}, options);
  if (envelope.errors?.length) {
    throw new IntegrationFailure({
      code: "INTEGRATION_UNAUTHORIZED",
      message: "Linear rejected the configured API key",
    });
  }
  const parsed = validationDataSchema.safeParse(envelope.data);
  if (!parsed.success) {
    throw invalidResponse();
  }
  return {
    providerExternalId: parsed.data.viewer.id,
    viewer: parsed.data.viewer,
    workspace: parsed.data.organization,
    teamCount: parsed.data.teams.nodes.length,
  };
}

export async function listLinearTeams(
  apiKey: string,
  input: { first: number; after?: string },
  options: Options = {},
): Promise<LinearTeamListResponse> {
  const envelope = await requestLinear(apiKey, teamsQuery, {
    first: input.first,
    ...(input.after ? { after: input.after } : {}),
  }, options);
  if (envelope.errors?.length) {
    throw new IntegrationFailure({
      code: "INTEGRATION_UPSTREAM_ERROR",
      message: "Linear Team discovery failed",
    });
  }
  const parsed = teamsDataSchema.safeParse(envelope.data);
  if (!parsed.success) throw invalidResponse();
  return linearTeamListResponseSchema.parse({
    teams: parsed.data.teams.nodes,
    pageInfo: parsed.data.teams.pageInfo,
  });
}

export async function getLinearTeam(
  apiKey: string,
  id: string,
  options: Options = {},
) {
  const envelope = await requestLinear(apiKey, teamQuery, { id }, options);
  if (envelope.errors?.length) {
    throw new IntegrationFailure({ code: "ISSUE_SCOPE_UNAVAILABLE", message: "Linear Team is unavailable" });
  }
  const parsed = teamDataSchema.safeParse(envelope.data);
  if (!parsed.success) throw invalidResponse();
  if (!parsed.data.team) {
    throw new IntegrationFailure({ code: "ISSUE_SCOPE_UNAVAILABLE", message: "Linear Team is unavailable" });
  }
  return teamSchema.parse(parsed.data.team);
}

async function requestLinear(
  apiKey: string,
  query: string,
  variables: Record<string, unknown>,
  options: Options,
): Promise<z.infer<typeof envelopeSchema>> {
  let response: Response;
  try {
    response = await (options.fetchImpl ?? globalThis.fetch)(LINEAR_GRAPHQL_URL, {
      method: "POST",
      headers: { authorization: apiKey, "content-type": "application/json" },
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    });
  } catch (error) {
    if (
      (error instanceof DOMException && error.name === "AbortError")
      || (error instanceof Error && error.name === "TimeoutError")
    ) {
      throw new IntegrationFailure({ code: "INTEGRATION_TIMEOUT", message: "Linear request timed out" });
    }
    throw new IntegrationFailure({ code: "INTEGRATION_UPSTREAM_ERROR", message: "Linear request failed" });
  }
  if (response.status === 401 || response.status === 403) {
    throw new IntegrationFailure({ code: "INTEGRATION_UNAUTHORIZED", message: "Linear rejected the configured API key" });
  }
  if (response.status === 429) {
    const retryAfter = Number(response.headers.get("retry-after"));
    throw new IntegrationFailure({
      code: "INTEGRATION_RATE_LIMITED",
      message: "Linear rate limit exceeded",
      ...(Number.isInteger(retryAfter) && retryAfter >= 0 ? { retryAfterSeconds: retryAfter } : {}),
    });
  }
  if (!response.ok) {
    throw new IntegrationFailure({ code: "INTEGRATION_UPSTREAM_ERROR", message: `Linear request failed with HTTP ${response.status}` });
  }
  const envelope = envelopeSchema.safeParse(await response.json());
  if (!envelope.success) throw invalidResponse();
  return envelope.data;
}

function invalidResponse(): IntegrationFailure {
  return new IntegrationFailure({
    code: "INTEGRATION_INVALID_RESPONSE",
    message: "Linear returned an invalid response",
  });
}
