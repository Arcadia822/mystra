import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { SqliteRdbProvider } from "../db/sqlite-provider";
import type { SecretProvider } from "../secrets/secret-provider";
import { IntegrationFailure } from "./errors";
import { GitHubPatConnectionService } from "./github-pat-service";

class MemorySecretProvider implements SecretProvider {
  readonly values = new Map<string, string>();

  async put(reference: string, plaintext: string): Promise<void> {
    this.values.set(reference, plaintext);
  }

  async get(reference: string): Promise<string> {
    const value = this.values.get(reference);
    if (!value) throw new Error("missing");
    return value;
  }

  async delete(reference: string): Promise<void> {
    this.values.delete(reference);
  }
}

function validation(token: string) {
  if (token === "invalid") {
    throw new IntegrationFailure({
      code: "INTEGRATION_CREDENTIAL_INVALID",
      message: "GitHub rejected the personal access token",
    });
  }
  return Promise.resolve({
    providerExternalId: `pat:${createHash("sha256").update(token).digest("hex")}`,
    account: { externalId: "42", login: "arcadia", type: "User" },
    repositorySelection: "token" as const,
    permissions: { contents: "write", pull_requests: "unverified" },
    accessSummary: { repositoryCountAtLeast: 1, pullRequests: "unverified" },
  });
}

describe("GitHubPatConnectionService", () => {
  it("stores plaintext only in SecretProvider and returns a public connection", async () => {
    const db = new SqliteRdbProvider();
    const secrets = new MemorySecretProvider();
    const service = new GitHubPatConnectionService({
      db,
      secrets,
      validate: validation,
      newId: () => "00000000-0000-4000-8000-000000000041",
    });

    const connection = await service.create({ token: "github_pat_create", displayName: "Delivery" });

    expect(connection).toMatchObject({
      id: "00000000-0000-4000-8000-000000000041",
      connectionType: "personal-access-token",
      displayName: "Delivery",
      credentialState: "ready",
    });
    expect(connection.externalId).toBeUndefined();
    expect(secrets.values.get("github-pat/00000000-0000-4000-8000-000000000041"))
      .toBe("github_pat_create");
    expect(JSON.stringify(db.listIntegrationConnectionRecords())).not.toContain("github_pat_create");
    db.close();
  });

  it("validates replacement before writing and keeps the old credential after failure", async () => {
    const db = new SqliteRdbProvider();
    const secrets = new MemorySecretProvider();
    const service = new GitHubPatConnectionService({
      db,
      secrets,
      validate: validation,
      newId: () => "00000000-0000-4000-8000-000000000041",
    });
    const connection = await service.create({ token: "github_pat_old" });

    await expect(service.replace(connection.id, { token: "invalid" })).rejects.toMatchObject({
      code: "INTEGRATION_CREDENTIAL_INVALID",
    });
    expect(secrets.values.get("github-pat/00000000-0000-4000-8000-000000000041"))
      .toBe("github_pat_old");

    const replaced = await service.replace(connection.id, { token: "github_pat_new" });
    expect(replaced.id).toBe(connection.id);
    expect(secrets.values.get("github-pat/00000000-0000-4000-8000-000000000041"))
      .toBe("github_pat_new");
    db.close();
  });
});
