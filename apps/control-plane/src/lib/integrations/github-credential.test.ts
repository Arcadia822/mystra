import { describe, expect, it } from "vitest";

import type {
  IntegrationConnectionRecord,
  SecretEnvelopeWrite,
} from "../db/rdb-provider";
import type { SecretProvider } from "../secrets/secret-provider";
import { GitHubCredentialResolver } from "./github-credential";

class MemorySecrets implements SecretProvider {
  constructor(readonly values: Map<string, string>) {}
  seal(): SecretEnvelopeWrite { throw new Error("not used by resolver"); }
  async put(reference: string, plaintext: string) { this.values.set(reference, plaintext); }
  async get(reference: string) {
    const value = this.values.get(reference);
    if (!value) throw new Error("missing");
    return value;
  }
  async delete(reference: string) { this.values.delete(reference); }
}

class ConnectionDb {
  constructor(readonly records: IntegrationConnectionRecord[]) {}
  async getIntegrationConnectionRecord(id: string) {
    return this.records.find((record) => record.id === id);
  }
  async listIntegrationConnectionRecords(options: { integration?: string } = {}) {
    return options.integration
      ? this.records.filter((record) => record.integration === options.integration)
      : [...this.records];
  }
}

function connection(input: {
  id: string;
  authMethod: "github-app" | "personal-access-token";
  providerExternalId: string;
  credentialRef?: string;
  status?: "active" | "inactive";
}): IntegrationConnectionRecord {
  return {
    id: input.id,
    teamId: "00000000-0000-4000-8000-000000000040",
    integration: "github",
    provider: "github",
    authMethod: input.authMethod,
    providerExternalId: input.providerExternalId,
    displayName: null,
    providerSubject: { externalId: "42", login: "arcadia", type: "User" },
    connectionConfig: {},
    capabilities: {},
    credentialState: "ready",
    status: input.status ?? "active",
    createdAt: "2026-08-06T00:00:00.000Z",
    updatedAt: "2026-08-06T00:00:00.000Z",
    ...(input.credentialRef ? { credentialRef: input.credentialRef } : {}),
  };
}

const app = connection({
  id: "00000000-0000-4000-8000-000000000041",
  authMethod: "github-app",
  providerExternalId: "18492",
});

describe("GitHubCredentialResolver", () => {
  it("dispatches an App connection to the installation credential source", async () => {
    const resolver = new GitHubCredentialResolver({
      db: new ConnectionDb([app]),
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
      connection: { id: app.id, authMethod: "github-app" },
      credential: { secret: "ghs_18492" },
    });
  });

  it("rejects App credentials by default even when an App service is injected", async () => {
    const resolver = new GitHubCredentialResolver({
      db: new ConnectionDb([app]),
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
  });

  it("dispatches a PAT connection only through its immutable secret reference", async () => {
    const reference = "github-pat/00000000-0000-4000-8000-000000000042/00000000-0000-4000-8000-000000000043";
    const pat = connection({
      id: "00000000-0000-4000-8000-000000000042",
      authMethod: "personal-access-token",
      providerExternalId: "pat:hash",
      credentialRef: reference,
    });
    const resolver = new GitHubCredentialResolver({
      db: new ConnectionDb([pat]),
      secrets: new MemorySecrets(new Map([[reference, "github_pat_exact"]])),
      now: () => new Date("2026-08-06T10:00:00.000Z"),
    });

    await expect(resolver.resolve(pat.id)).resolves.toMatchObject({
      connection: { id: pat.id, authMethod: "personal-access-token" },
      credential: {
        provider: "github",
        username: "x-access-token",
        secret: "github_pat_exact",
        expiresAt: "2026-08-06T10:05:00.000Z",
      },
    });
  });

  it("requires selection for multiple active connections and never falls back", async () => {
    const second = connection({
      id: "00000000-0000-4000-8000-000000000044",
      authMethod: "github-app",
      providerExternalId: "20001",
    });
    const resolver = new GitHubCredentialResolver({ db: new ConnectionDb([app, second]) });
    await expect(resolver.resolve()).rejects.toMatchObject({
      code: "INTEGRATION_CONNECTION_SELECTION_REQUIRED",
    });

    const inactive = connection({
      id: app.id,
      authMethod: "github-app",
      providerExternalId: app.providerExternalId,
      status: "inactive",
    });
    await expect(new GitHubCredentialResolver({ db: new ConnectionDb([inactive]) }).resolve(inactive.id))
      .rejects.toMatchObject({ code: "INTEGRATION_CREDENTIAL_UNAVAILABLE" });
  });
});
