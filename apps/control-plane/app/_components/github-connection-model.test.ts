import { describe, expect, it } from "vitest";

import {
  githubConnectionAccountLogin,
  githubConnectionRepositorySelection,
  githubConnectionView,
} from "./github-connection-model";

const connection = {
  id: "00000000-0000-4000-8000-000000000039",
  teamId: "00000000-0000-4000-8000-000000000038",
  integration: "github",
  provider: "github",
  authMethod: "github-app",
  providerExternalId: "18492",
  displayName: null,
  providerSubject: { externalId: "42", login: "arcadia", type: "User" },
  connectionConfig: {},
  capabilities: {
    repositories: {
      state: "enabled" as const,
      config: { selection: "selected" },
      permissions: {},
      accessSummary: {},
      verifiedAt: null,
    },
  },
  credentialState: "ready" as const,
  status: "active" as const,
  createdAt: "2026-08-05T08:00:00.000Z",
  updatedAt: "2026-08-05T08:00:00.000Z",
};

describe("githubConnectionView", () => {
  it("projects loading, disconnected, connected and error states", () => {
    expect(githubConnectionView(null, null, true).state).toBe("loading");
    expect(githubConnectionView({ providers: [{
      integration: "github", methods: [{ type: "github-app", configured: true, connectUrl: "/connect" }],
    }], connections: [] }, null, false)).toMatchObject({ state: "disconnected", action: "connect" });
    expect(githubConnectionView({ providers: [{
      integration: "github", methods: [{ type: "github-app", configured: true, connectUrl: "/connect" }],
    }], connections: [connection] }, null, false)).toMatchObject({
      state: "connected",
      action: "reconnect",
      accountLogin: "arcadia",
      repositorySelection: "selected",
    });
    expect(githubConnectionView(null, "failed", false)).toMatchObject({ state: "error", action: "retry" });
  });

  it("projects display metadata from providerSubject and repository capability JSON", () => {
    expect(githubConnectionAccountLogin(connection)).toBe("arcadia");
    expect(githubConnectionRepositorySelection(connection)).toBe("selected");
    expect(githubConnectionAccountLogin({ ...connection, providerSubject: {} })).toBe("18492");
    expect(githubConnectionRepositorySelection({
      ...connection,
      capabilities: { repositories: { ...connection.capabilities.repositories, config: {} } },
    })).toBeUndefined();
  });
});
