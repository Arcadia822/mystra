import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import Database from "better-sqlite3";
import { afterAll, describe } from "vitest";

import { createSqlitePrismaClient } from "./prisma-client";
import { PrismaRdbProvider } from "./prisma-provider";
import { runRdbProviderContract } from "./rdb-provider.contract";

const tempDirectory = mkdtempSync(path.join(tmpdir(), "mystra-prisma-contract-"));
const migrations = [
  "20260806182000_init",
  "20260806210000_secret_envelopes",
].map((directory) => readFileSync(
  path.join(process.cwd(), `prisma/sqlite/migrations/${directory}/migration.sql`),
  "utf8",
));

function createDatabasePath(): string {
  const databasePath = path.join(tempDirectory, `${crypto.randomUUID()}.db`);
  const database = new Database(databasePath);
  for (const migration of migrations) database.exec(migration);
  database.close();
  return databasePath;
}

describe("PrismaRdbProvider SQLite contract", () => {
  runRdbProviderContract(async () => {
    let tick = 0;
    return new PrismaRdbProvider(createSqlitePrismaClient({
      databaseUrl: `file:${createDatabasePath()}`,
    }), {
      now: () => new Date(Date.UTC(2026, 7, 6, 0, 0, 0, tick++)).toISOString(),
    });
  });
});

afterAll(() => {
  rmSync(tempDirectory, { recursive: true, force: true });
});
