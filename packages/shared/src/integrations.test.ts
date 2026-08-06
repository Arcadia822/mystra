import { describe, expect, it } from "vitest";

import {
  integrationConnectionActivationSchema,
  integrationConnectionSchema,
} from "./integrations.js";

const connection = {
  id: "00000000-0000-4000-8000-000000000039",
  integration: "github",
  provider: "github",
  externalId: "18492",
  account: {
    externalId: "42",
    login: "arcadia",
    type: "User",
    avatarUrl: "https://avatars.githubusercontent.com/u/42?v=4",
  },
  repositorySelection: "selected",
  permissions: { contents: "write", pull_requests: "write" },
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
      externalId: connection.externalId,
      account: connection.account,
      repositorySelection: connection.repositorySelection,
      permissions: connection.permissions,
    }).externalId).toBe("18492");
  });

  it("rejects OAuth, installation and private-key material", () => {
    for (const leaked of [
      { oauthToken: "ghu_secret" },
      { installationToken: "ghs_secret" },
      { privateKey: "-----BEGIN PRIVATE KEY-----" },
    ]) {
      expect(() => integrationConnectionSchema.parse({ ...connection, ...leaked })).toThrow();
    }
  });
});
