import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";

import { createSqlitePrismaClient } from "../db/prisma-client";
import { PrismaRdbProvider } from "../db/prisma-provider";
import { RdbSecretProvider } from "../secrets/rdb-secret-provider";
import { IntegrationFailure } from "./errors";
import { GitHubPatConnectionService } from "./github-pat-service";

const tempDirectories: string[] = [];
const migrations = [
  "20260806182000_init",
  "20260806210000_secret_envelopes",
  "20260807150000_identity_team_rbac",
].map((directory) => readFileSync(
  path.join(process.cwd(), `prisma/sqlite/migrations/${directory}/migration.sql`),
  "utf8",
));

function openDb() {
  const directory = mkdtempSync(path.join(tmpdir(), "mystra-pat-service-"));
  tempDirectories.push(directory);
  const databasePath = path.join(directory, "mystra.db");
  const database = new Database(databasePath);
  for (const migration of migrations) database.exec(migration);
  database.close();
  return {
    databasePath,
    db: new PrismaRdbProvider(createSqlitePrismaClient({ databaseUrl: `file:${databasePath}` })),
  };
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

async function createTeam(db: PrismaRdbProvider) {
  return (await db.registerLocalUser({
    username: "operator",
    displayName: "Operator",
    passwordHash: "hash",
    passwordSalt: "salt",
    passwordParams: "params",
    initialTeamDisplayName: "Operator Team",
    tokenHash: "test-token-hash",
    expiresAt: "2026-08-08T00:00:00.000Z",
  })).initialTeam;
}

afterEach(() => {
  while (tempDirectories.length > 0) rmSync(tempDirectories.pop()!, { recursive: true, force: true });
});

describe("GitHubPatConnectionService", () => {
  it("stores only an envelope in RDB and returns no credential reference", async () => {
    const { db, databasePath } = openDb();
    const team = await createTeam(db);
    const secrets = new RdbSecretProvider({ db, key: Buffer.alloc(32, 7), keyId: "test-v1" });
    const service = new GitHubPatConnectionService({
      db,
      teamId: team.id,
      secrets,
      validate: validation,
      newId: () => "00000000-0000-4000-8000-000000000041",
      newCredentialId: () => "00000000-0000-4000-8000-000000000042",
    });

    const connection = await service.create({ token: "github_pat_create", displayName: "Delivery" });
    const record = await db.getIntegrationConnectionRecord(connection.id);

    expect(connection).toMatchObject({
      id: "00000000-0000-4000-8000-000000000041",
      teamId: team.id,
      authMethod: "personal-access-token",
      displayName: "Delivery",
      credentialState: "ready",
    });
    expect(connection).not.toHaveProperty("credentialRef");
    expect(record?.credentialRef).toBe(
      "github-pat/00000000-0000-4000-8000-000000000041/00000000-0000-4000-8000-000000000042",
    );
    expect(await secrets.get(record!.credentialRef!)).toBe("github_pat_create");
    expect(readFileSync(databasePath)).not.toContain(Buffer.from("github_pat_create"));
    await db.close();
  });

  it("validates before replacement and atomically removes the old envelope", async () => {
    const { db } = openDb();
    const team = await createTeam(db);
    const secrets = new RdbSecretProvider({ db, key: Buffer.alloc(32, 8), keyId: "test-v1" });
    const credentialIds = [
      "00000000-0000-4000-8000-000000000042",
      "00000000-0000-4000-8000-000000000043",
    ];
    const service = new GitHubPatConnectionService({
      db,
      teamId: team.id,
      secrets,
      validate: validation,
      newId: () => "00000000-0000-4000-8000-000000000041",
      newCredentialId: () => credentialIds.shift()!,
    });
    const connection = await service.create({ token: "github_pat_old" });
    const oldReference = (await db.getIntegrationConnectionRecord(connection.id))!.credentialRef!;

    await expect(service.replace(connection.id, { token: "invalid" })).rejects.toMatchObject({
      code: "INTEGRATION_CREDENTIAL_INVALID",
    });
    expect(await secrets.get(oldReference)).toBe("github_pat_old");

    await service.replace(connection.id, { token: "github_pat_new" });
    const newReference = (await db.getIntegrationConnectionRecord(connection.id))!.credentialRef!;
    expect(newReference).not.toBe(oldReference);
    await expect(secrets.get(oldReference)).rejects.toThrow("Secret is unavailable");
    expect(await secrets.get(newReference)).toBe("github_pat_new");
    await db.close();
  });
});
