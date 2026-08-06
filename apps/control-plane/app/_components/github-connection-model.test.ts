import { describe, expect, it } from "vitest";

import { githubConnectionView } from "./github-connection-model";

describe("githubConnectionView", () => {
  it("projects loading, disconnected, connected and error states", () => {
    expect(githubConnectionView(null, null, true).state).toBe("loading");
    expect(githubConnectionView({ providers: [{
      integration: "github", methods: [{ type: "github-app", configured: true, connectUrl: "/connect" }],
    }], connections: [] }, null, false)).toMatchObject({ state: "disconnected", action: "connect" });
    expect(githubConnectionView({ providers: [{
      integration: "github", methods: [{ type: "github-app", configured: true, connectUrl: "/connect" }],
    }], connections: [{
      id: "00000000-0000-4000-8000-000000000039",
      integration: "github", provider: "github", connectionType: "github-app", externalId: "18492",
      account: { externalId: "42", login: "arcadia", type: "User" },
      repositorySelection: "selected", permissions: {}, credentialState: "ready", status: "active",
      createdAt: "2026-08-05T08:00:00.000Z", updatedAt: "2026-08-05T08:00:00.000Z",
    }] }, null, false)).toMatchObject({ state: "connected", action: "reconnect", accountLogin: "arcadia" });
    expect(githubConnectionView(null, "failed", false)).toMatchObject({ state: "error", action: "retry" });
  });
});
