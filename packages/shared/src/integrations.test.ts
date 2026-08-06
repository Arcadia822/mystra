import { describe, expect, it } from "vitest";

import {
  integrationConnectionActivationSchema,
  integrationConnectionMethodSchema,
  integrationConnectionSchema,
  integrationProviderStatusSchema,
  personalAccessTokenConnectionInputSchema,
} from "./integrations.js";

const connection = {
  id: "00000000-0000-4000-8000-000000000039",
  integration: "github",
  provider: "github",
  connectionType: "github-app",
  externalId: "18492",
  account: {
    externalId: "42",
    login: "arcadia",
    type: "User",
    avatarUrl: "https://avatars.githubusercontent.com/u/42?v=4",
  },
  repositorySelection: "selected",
  permissions: { contents: "write", pull_requests: "write" },
  credentialState: "ready",
  status: "active",
  createdAt: "2026-08-05T08:00:00.000Z",
  updatedAt: "2026-08-05T08:00:00.000Z",
} as const;

describe("integration connection schemas", () => {
  it("accepts only non-secret installation metadata", () => {
    expect(integrationConnectionSchema.parse(connection)).toEqual(connection);
    expect(integrationConnectionActivationSchema.parse({
      integration: connection.integration,
      provider: connection.provider,
      connectionType: connection.connectionType,
      externalId: connection.externalId,
      account: connection.account,
      repositorySelection: connection.repositorySelection,
      permissions: connection.permissions,
      credentialState: connection.credentialState,
    }).externalId).toBe("18492");
  });

  it("accepts a PAT connection without exposing its fingerprint or secret reference", () => {
    const patConnection = {
      ...connection,
      id: "00000000-0000-4000-8000-000000000041",
      connectionType: "personal-access-token",
      displayName: "Arcadia delivery",
      externalId: undefined,
      repositorySelection: "token",
      permissions: { contents: "write", pull_requests: "unverified" },
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
