import { describe, expect, it } from "vitest";

import { SqliteRdbProvider } from "../db/sqlite-provider";
import type { SecretProvider } from "../secrets/secret-provider";
import { GitHubCredentialResolver } from "./github-credential";

class MemorySecrets implements SecretProvider {
  constructor(readonly values: Map<string, string>) {}
  async put(reference: string, plaintext: string) { this.values.set(reference, plaintext); }
  async get(reference: string) {
    const value = this.values.get(reference);
    if (!value) throw new Error("missing");
    return value;
  }
  async delete(reference: string) { this.values.delete(reference); }
}

function appConnection(db: SqliteRdbProvider, externalId = "18492") {
  return db.activateIntegrationConnection({
    integration: "github",
    provider: "github",
    externalId,
    account: { externalId: "42", login: "arcadia", type: "User" },
    repositorySelection: "selected",
    permissions: { contents: "write", pull_requests: "write" },
  });
}

describe("GitHubCredentialResolver", () => {
  it("dispatches an App connection to the installation credential source", async () => {
    const db = new SqliteRdbProvider();
    const app = appConnection(db);
    const resolver = new GitHubCredentialResolver({
      db,
      appService: {
        async getInstallationCredential(installationId) {
          return {
            provider: "github",
            username: "x-access-token",
            secret: `ghs_${installationId}`,
            expiresAt: "2026-08-06T12:00:00.000Z",
          };
        },
      },
      githubAppAvailable: true,
    });

    await expect(resolver.resolve(app.id)).resolves.toMatchObject({
      connection: { id: app.id, connectionType: "github-app" },
      credential: { secret: "ghs_18492" },
    });
    db.close();
  });

  it("rejects App credentials by default even when an App service is injected", async () => {
    const db = new SqliteRdbProvider();
    const app = appConnection(db);
    const resolver = new GitHubCredentialResolver({
      db,
      appService: {
        async getInstallationCredential() {
          return {
            provider: "github",
            username: "x-access-token",
            secret: "must-not-be-issued",
            expiresAt: "2026-08-06T12:00:00.000Z",
          };
        },
      },
    });

    await expect(resolver.resolve(app.id)).rejects.toMatchObject({
      code: "INTEGRATION_CONNECTION_METHOD_UNAVAILABLE",
      details: { reasonCode: "HOSTED_ONLY" },
    });
    db.close();
  });

  it("dispatches a PAT connection only through its secret reference", async () => {
    const db = new SqliteRdbProvider();
    const pat = db.upsertIntegrationConnection({
      id: "00000000-0000-4000-8000-000000000041",
      integration: "github",
      provider: "github",
      connectionType: "personal-access-token",
      providerExternalId: "pat:hash",
      account: { externalId: "42", login: "arcadia", type: "User" },
      repositorySelection: "token",
      permissions: { contents: "write", pull_requests: "unverified" },
      credentialState: "ready",
      credentialRef: "github-pat/00000000-0000-4000-8000-000000000041",
    });
    const resolver = new GitHubCredentialResolver({
      db,
      secrets: new MemorySecrets(new Map([[pat.credentialRef!, "github_pat_exact"]])),
      now: () => new Date("2026-08-06T10:00:00.000Z"),
    });

    await expect(resolver.resolve(pat.id)).resolves.toMatchObject({
      connection: { id: pat.id, connectionType: "personal-access-token" },
      credential: {
        provider: "github",
        username: "x-access-token",
        secret: "github_pat_exact",
        expiresAt: "2026-08-06T10:05:00.000Z",
      },
    });
    db.close();
  });

  it("requires selection for multiple active connections and never falls back", async () => {
    const db = new SqliteRdbProvider();
    const first = appConnection(db, "18492");
    appConnection(db, "20001");
    const resolver = new GitHubCredentialResolver({ db });

    await expect(resolver.resolve()).rejects.toMatchObject({
      code: "INTEGRATION_CONNECTION_SELECTION_REQUIRED",
    });
    db.setIntegrationConnectionStatus(first.id, "inactive", "invalid");
    await expect(resolver.resolve(first.id)).rejects.toMatchObject({
      code: "INTEGRATION_CREDENTIAL_UNAVAILABLE",
    });
    db.close();
  });
});
