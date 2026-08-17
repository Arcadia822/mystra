import { mkdirSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";
import { afterAll, describe, expect, it } from "vitest";

import { createSqlitePrismaClient } from "./prisma-client";
import { PrismaRdbProvider } from "./prisma-provider";
import { runRdbProviderContract } from "./rdb-provider.contract";

const tempDirectory = path.join(process.cwd(), `.test-prisma-contract-${process.pid}`);
rmSync(tempDirectory, { recursive: true, force: true });
mkdirSync(tempDirectory, { recursive: true });
const migrations = [
  "20260806182000_init",
  "20260806210000_secret_envelopes",
  "20260807150000_identity_team_rbac",
  "20260807181000_runtime_provider",
  "20260808173000_project_issue_sources",
  "20260808180000_agent_definition",
  "20260808200000_task_context",
  "20260810130000_task_workspace_setup",
  "20260810160000_session_launch_framework",
  "20260811210000_factory_task_execution_context",
  "20260812090000_standard_agent_context",
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

describe("PrismaRdbProvider Task workbench performance", () => {
  it("returns a filtered first page from 10k Team Tasks within 500ms", async () => {
    const databasePath = createDatabasePath();
    const database = new Database(databasePath);
    const teamId = "00000000-0000-4000-8000-000000000001";
    const timestamp = "2026-08-17T00:00:00.000Z";
    database.prepare("INSERT INTO teams (id, display_name, status, archived_at, created_at, updated_at) VALUES (?, ?, ?, NULL, ?, ?)")
      .run(teamId, "Performance Team", "active", timestamp, timestamp);
    const insert = database.prepare(`INSERT INTO tasks (
      id, team_id, title, description, project_id, idempotency_key,
      issue_provider, issue_connection_id, issue_scope_external_id, issue_external_id, issue_identifier,
      status, metadata, status_revision, status_note, status_updated_at, status_actor, created_at, updated_at
    ) VALUES (?, ?, ?, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, ?, ?, 1, NULL, ?, ?, ?, ?)`);
    database.transaction(() => {
      for (let index = 0; index < 10_000; index += 1) {
        const id = `00000000-0000-4000-8000-${String(index + 2).padStart(12, "0")}`;
        const searchable = index % 100 === 0;
        insert.run(
          id,
          teamId,
          `Task ${String(index).padStart(5, "0")}`,
          index % 5 === 0 ? "blocked" : "pending",
          JSON.stringify(searchable ? { Area: "FrontEnd" } : {}),
          timestamp,
          JSON.stringify({ kind: "system", actorId: null, agentId: null, executionContextId: null, sessionId: null }),
          timestamp,
          timestamp,
        );
      }
    })();
    database.close();

    const client = createSqlitePrismaClient({ databaseUrl: `file:${databasePath}` });
    const provider = new PrismaRdbProvider(client);
    const samples: number[] = [];
    for (let sample = 0; sample < 5; sample += 1) {
      const startedAt = performance.now();
      const page = await provider.listTaskPage({ teamId, query: "frontend", statuses: ["blocked"], limit: 50 });
      samples.push(performance.now() - startedAt);
      expect(page.items).toHaveLength(50);
    }
    samples.sort((left, right) => left - right);
    expect(samples[4]).toBeLessThan(500);
  });
});

afterAll(() => {
  rmSync(tempDirectory, { recursive: true, force: true });
});
