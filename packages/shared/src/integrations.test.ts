import { describe, expect, it } from "vitest";

import {
  integrationConnectionActivationSchema,
  integrationConnectionMethodSchema,
  integrationConnectionSchema,
  integrationProviderStatusSchema,
  linearApiKeyConnectionInputSchema,
  linearTeamListResponseSchema,
  personalAccessTokenConnectionInputSchema,
} from "./integrations.js";

const connection = {
  id: "00000000-0000-4000-8000-000000000039",
  teamId: "00000000-0000-4000-8000-000000000038",
  integration: "github",
  provider: "github",
  authMethod: "github-app",
  providerExternalId: "18492",
  displayName: null,
  providerSubject: {
    externalId: "42",
    login: "arcadia",
    type: "User",
    avatarUrl: "https://avatars.githubusercontent.com/u/42?v=4",
  },
  connectionConfig: {},
  capabilities: {
    repositories: {
      state: "enabled",
      config: { selection: "selected" },
      permissions: { contents: "write", pull_requests: "write" },
      accessSummary: { repositories: "selected" },
      verifiedAt: "2026-08-05T08:00:00.000Z",
    },
  },
  credentialState: "ready",
  status: "active",
  createdAt: "2026-08-05T08:00:00.000Z",
  updatedAt: "2026-08-05T08:00:00.000Z",
} as const;

describe("integration connection schemas", () => {
  it("accepts only non-secret installation metadata", () => {
    expect(integrationConnectionSchema.parse(connection)).toEqual(connection);
    expect(integrationConnectionActivationSchema.parse({
      teamId: connection.teamId,
      integration: connection.integration,
      provider: connection.provider,
      authMethod: connection.authMethod,
      providerExternalId: connection.providerExternalId,
      displayName: connection.displayName,
      providerSubject: connection.providerSubject,
      connectionConfig: connection.connectionConfig,
      capabilities: connection.capabilities,
      credentialState: connection.credentialState,
    }).providerExternalId).toBe("18492");
  });

  it("accepts a PAT connection without exposing its fingerprint or secret reference", () => {
    const patConnection = {
      ...connection,
      id: "00000000-0000-4000-8000-000000000041",
      authMethod: "personal-access-token",
      displayName: "Arcadia delivery",
      providerExternalId: "42",
      capabilities: {
        repositories: {
          state: "enabled",
          config: { selection: "token" },
          permissions: { contents: "write", pull_requests: "unverified" },
          accessSummary: {},
          verifiedAt: "2026-08-05T08:00:00.000Z",
        },
      },
    } as const;

    expect(integrationConnectionSchema.parse(patConnection)).toEqual(patConnection);
    for (const leaked of [
      { token: "github_pat_secret" },
      { credentialRef: "github-pat/00000000-0000-4000-8000-000000000041" },
      { fingerprint: "pat:hash" },
    ]) {
      expect(() => integrationConnectionSchema.parse({ ...patConnection, ...leaked })).toThrow();
    }
  });

  it("models explicit GitHub App and PAT methods without fallback", () => {
    expect(integrationConnectionMethodSchema.parse({
      type: "github-app",
      configured: true,
      connectUrl: "/api/integration-connections/github/connect",
    }).type).toBe("github-app");
    expect(integrationConnectionMethodSchema.parse({
      type: "personal-access-token",
      configured: false,
      createUrl: "/api/integration-connections/github/pat",
      disabledReason: "Secret store is not configured",
    }).type).toBe("personal-access-token");

    const provider = integrationProviderStatusSchema.parse({
      integration: "github",
      methods: [
        {
          type: "github-app",
          configured: true,
          connectUrl: "/api/integration-connections/github/connect",
        },
        {
          type: "personal-access-token",
          configured: false,
          createUrl: "/api/integration-connections/github/pat",
          disabledReason: "Secret store is not configured",
        },
      ],
    });

    expect(provider.methods).toHaveLength(2);
  });

  it("accepts PAT only as one-time management input", () => {
    expect(personalAccessTokenConnectionInputSchema.parse({
      token: "github_pat_example",
      displayName: "Arcadia delivery",
    })).toEqual({
      token: "github_pat_example",
      displayName: "Arcadia delivery",
    });
    expect(() => personalAccessTokenConnectionInputSchema.parse({ token: "  " })).toThrow();
  });

  it("accepts Linear API key only as one-time management input", () => {
    expect(linearApiKeyConnectionInputSchema.parse({
      apiKey: "lin_api_key_example",
      displayName: "Product workspace",
    })).toEqual({
      apiKey: "lin_api_key_example",
      displayName: "Product workspace",
    });
    expect(() => linearApiKeyConnectionInputSchema.parse({ apiKey: "  " })).toThrow();
  });

  it("validates secret-free, cursor-paginated Linear Teams", () => {
    const parsed = linearTeamListResponseSchema.parse({
      teams: [{ id: "team-id", key: "ENG", name: "Engineering", archivedAt: null }],
      pageInfo: { hasNextPage: true, endCursor: "opaque" },
    });
    expect(parsed.teams[0]?.key).toBe("ENG");
    for (const leaked of [{ apiKey: "secret" }, { credentialRef: "linear-api-key/ref" }]) {
      expect(() => linearTeamListResponseSchema.parse({ ...parsed, ...leaked })).toThrow();
    }
  });

  it("rejects OAuth, installation and private-key material", () => {
    for (const leaked of [
      { oauthToken: "ghu_secret" },
      { installationToken: "ghs_secret" },
      { privateKey: "-----BEGIN PRIVATE KEY-----" },
      { credentialRef: "github-pat/secret" },
    ]) {
      expect(() => integrationConnectionSchema.parse({ ...connection, ...leaked })).toThrow();
    }
  });
});
