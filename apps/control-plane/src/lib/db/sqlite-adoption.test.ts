import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";

import { adoptSqliteDatabase, inspectSqliteAdoption } from "./sqlite-adoption";

const fixtureSql = readFileSync(path.join(process.cwd(), "src/lib/db/fixtures/schema-v5.sql"), "utf8");
const directories: string[] = [];
const timestamp = "2026-08-06T10:00:00.000Z";

afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function createV5Database(options: { repositoryExternalId?: string } = {}): string {
  const directory = mkdtempSync(path.join(tmpdir(), "mystra-adoption-"));
  directories.push(directory);
  const databasePath = path.join(directory, "mystra.db");
  const database = new Database(databasePath);
  database.exec(fixtureSql);
  database.prepare(`INSERT INTO integration_connections VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(
      "00000000-0000-4000-8000-000000000040", "github", "github", "personal-access-token",
      "pat:stable", "Primary", JSON.stringify({ login: "octocat" }), "token",
      JSON.stringify({ contents: "write" }), JSON.stringify({ repositoryCountAtLeast: 1 }),
      "github-pat/40", "ready", "active", timestamp, timestamp,
    );
  database.prepare(`INSERT INTO projects VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(
      "00000000-0000-4000-8000-000000000041", "Mystra", "mystra",
      "00000000-0000-4000-8000-000000000040",
      JSON.stringify({
        ...(options.repositoryExternalId === undefined
          ? { externalId: "R_kgDOMystra" }
          : options.repositoryExternalId ? { externalId: options.repositoryExternalId } : {}),
        fullName: "Arcadia822/mystra",
      }),
      "main", "codex", JSON.stringify({ provider: "docker" }), JSON.stringify({ image: "old" }),
      JSON.stringify({ retained: true }), null, timestamp, timestamp,
    );
  database.prepare(`INSERT INTO tasks VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(
      "00000000-0000-4000-8000-000000000042",
      "00000000-0000-4000-8000-000000000041", "issue", "removed objective",
      JSON.stringify({ title: "removed" }), "github:issue:42",
      JSON.stringify({ externalId: "R_kgDOMystra" }), JSON.stringify({ retained: true }),
      timestamp, timestamp,
    );
  database.close();
  return databasePath;
}

describe("SQLite schema v5 adoption", () => {
  it("refuses the obsolete schema-v5 without attempting to import rows", async () => {
    const databasePath = createV5Database();
    expect(inspectSqliteAdoption(databasePath)).toEqual({ state: "schema-v5", counts: {
      integrationConnections: 1,
      projects: 1,
      tasks: 1,
    } });

    await expect(adoptSqliteDatabase(databasePath, { now: () => timestamp }))
      .rejects.toThrow("obsolete schema-v5 lacks required Team scope");
    expect(existsSync(`${databasePath}.prisma-v5-backup-20260806T100000000Z.db`)).toBe(false);
    expect(inspectSqliteAdoption(databasePath).state).toBe("schema-v5");
  });

  it("refuses unknown schemas", async () => {
    const directory = mkdtempSync(path.join(tmpdir(), "mystra-adoption-unknown-"));
    directories.push(directory);
    const unknownPath = path.join(directory, "unknown.db");
    const unknown = new Database(unknownPath);
    unknown.exec("CREATE TABLE mystery (id TEXT PRIMARY KEY)");
    unknown.close();
    await expect(adoptSqliteDatabase(unknownPath)).rejects.toThrow("unknown SQLite schema");
  });

  it("refuses empty, mixed, and corrupt database fixtures", async () => {
    const directory = mkdtempSync(path.join(tmpdir(), "mystra-adoption-invalid-"));
    directories.push(directory);

    const emptyPath = path.join(directory, "empty.db");
    new Database(emptyPath).close();
    expect(inspectSqliteAdoption(emptyPath).state).toBe("unknown");
    await expect(adoptSqliteDatabase(emptyPath)).rejects.toThrow("unknown SQLite schema");

    const mixedPath = createV5Database();
    const mixed = new Database(mixedPath);
    mixed.exec("CREATE TABLE unexpected_table (id TEXT PRIMARY KEY)");
    mixed.close();
    expect(inspectSqliteAdoption(mixedPath).state).toBe("unknown");
    await expect(adoptSqliteDatabase(mixedPath)).rejects.toThrow("unknown SQLite schema");

    const corruptPath = path.join(directory, "corrupt.db");
    writeFileSync(corruptPath, "this is not a SQLite database");
    expect(() => inspectSqliteAdoption(corruptPath)).toThrow();
    await expect(adoptSqliteDatabase(corruptPath)).rejects.toThrow();
  });
});
