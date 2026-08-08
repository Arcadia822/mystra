import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import Database from "better-sqlite3";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createSqlitePrismaClient } from "../db/prisma-client";
import { PrismaRdbProvider } from "../db/prisma-provider";
import { RdbSecretProvider } from "../secrets/rdb-secret-provider";
import { IntegrationFailure } from "./errors";
import { LinearApiKeyConnectionService } from "./linear-api-key-service";

const tempDirectories: string[] = [];
const migrations = [
  "20260806182000_init",
  "20260806210000_secret_envelopes",
  "20260807150000_identity_team_rbac",
  "20260807181000_runtime_provider",
  "20260808173000_project_issue_sources",
].map((directory) => readFileSync(path.join(process.cwd(), `prisma/sqlite/migrations/${directory}/migration.sql`), "utf8"));

function openDb() {
  const directory = mkdtempSync(path.join(tmpdir(), "mystra-linear-service-"));
  tempDirectories.push(directory);
  const databasePath = path.join(directory, "mystra.db");
  const database = new Database(databasePath);
  for (const migration of migrations) database.exec(migration);
  database.close();
  return { databasePath, db: new PrismaRdbProvider(createSqlitePrismaClient({ databaseUrl: `file:${databasePath}` })) };
}

async function createTeam(db: PrismaRdbProvider) {
  return (await db.registerLocalUser({
    username: `operator_${crypto.randomUUID().replaceAll("-", "")}`,
    displayName: "Operator",
    passwordHash: "hash",
    passwordSalt: "salt",
    passwordParams: "params",
    initialTeamDisplayName: "Operator Team",
    tokenHash: crypto.randomUUID(),
    expiresAt: "2027-08-08T00:00:00.000Z",
  })).initialTeam;
}

function validate(apiKey: string) {
  if (apiKey === "invalid") {
    throw new IntegrationFailure({ code: "INTEGRATION_UNAUTHORIZED", message: "invalid" });
  }
  return Promise.resolve({
    providerExternalId: "viewer-1",
    viewer: { id: "viewer-1", name: "Ada" },
    workspace: { id: "workspace-1", name: "Mystra" },
    teamCount: 2,
  });
}

afterEach(() => {
  while (tempDirectories.length > 0) rmSync(tempDirectories.pop()!, { recursive: true, force: true });
});

describe("LinearApiKeyConnectionService", () => {
  it("stores only an encrypted envelope and returns secret-free metadata", async () => {
    const { db, databasePath } = openDb();
    const team = await createTeam(db);
    const secrets = new RdbSecretProvider({ db, key: Buffer.alloc(32, 9), keyId: "test-v1" });
    const service = new LinearApiKeyConnectionService({
      db,
      teamId: team.id,
      secrets,
      validate,
      newId: () => "00000000-0000-4000-8000-000000000041",
      newCredentialId: () => "00000000-0000-4000-8000-000000000042",
    });

    const connection = await service.create({ apiKey: "lin_secret", displayName: "Product" });
    const record = await db.getIntegrationConnectionRecord(connection.id);
    expect(connection).toMatchObject({ integration: "linear", authMethod: "api-key", displayName: "Product" });
    expect(connection).not.toHaveProperty("credentialRef");
    expect(await secrets.get(record!.credentialRef!)).toBe("lin_secret");
    expect(readFileSync(databasePath)).not.toContain(Buffer.from("lin_secret"));
    await db.close();
  });

  it("validates before replacement and preserves the old key on failure", async () => {
    const { db } = openDb();
    const team = await createTeam(db);
    const secrets = new RdbSecretProvider({ db, key: Buffer.alloc(32, 10), keyId: "test-v1" });
    const credentialIds = [
      "00000000-0000-4000-8000-000000000042",
      "00000000-0000-4000-8000-000000000043",
    ];
    const service = new LinearApiKeyConnectionService({
      db,
      teamId: team.id,
      secrets,
      validate,
      newId: () => "00000000-0000-4000-8000-000000000041",
      newCredentialId: () => credentialIds.shift()!,
    });
    const connection = await service.create({ apiKey: "lin_old" });
    const oldReference = (await db.getIntegrationConnectionRecord(connection.id))!.credentialRef!;

    await expect(service.replace(connection.id, { apiKey: "invalid" })).rejects.toMatchObject({ code: "INTEGRATION_UNAUTHORIZED" });
    expect(await secrets.get(oldReference)).toBe("lin_old");
    await service.replace(connection.id, { apiKey: "lin_new" });
    const newReference = (await db.getIntegrationConnectionRecord(connection.id))!.credentialRef!;
    expect(await secrets.get(newReference)).toBe("lin_new");
    await expect(secrets.get(oldReference)).rejects.toThrow("Secret is unavailable");
    await db.close();
  });

  it("blocks deletion while a Project Issue source references the connection", async () => {
    const id = "00000000-0000-4000-8000-000000000041";
    const teamId = "00000000-0000-4000-8000-000000000042";
    const remove = vi.fn();
    const service = new LinearApiKeyConnectionService({
      teamId,
      db: {
        getIntegrationConnectionRecord: vi.fn(async () => ({
          id, teamId, integration: "linear", provider: "linear", authMethod: "api-key",
          credentialRef: `linear-api-key/${id}/00000000-0000-4000-8000-000000000043`,
        })),
        listProjectIssueSourcesForConnection: vi.fn(async () => [{ id: "source-1" }]),
        deleteIntegrationConnectionWithSecret: remove,
      } as never,
    });
    await expect(service.delete(id)).rejects.toMatchObject({ code: "INTEGRATION_CONNECTION_IN_USE" });
    expect(remove).not.toHaveBeenCalled();
  });
});
