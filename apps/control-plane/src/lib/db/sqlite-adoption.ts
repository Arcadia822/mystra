import { spawnSync } from "node:child_process";
import { existsSync, renameSync, unlinkSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import Database from "better-sqlite3";

type AdoptionCounts = {
  integrationConnections: number;
  projects: number;
  tasks: number;
};

export type SqliteAdoptionInspection = {
  state: "schema-v5" | "prisma" | "unknown";
  counts?: AdoptionCounts;
};

export type SqliteAdoptionResult = {
  state: "adopted" | "already-adopted" | "dry-run";
  counts: AdoptionCounts;
  backupPath?: string;
};

type Row = Record<string, unknown>;

const schemaV5Columns: Record<string, string[]> = {
  mystra_schema: ["id", "version"],
  integration_connections: [
    "id", "integration", "provider", "connection_type", "external_id", "display_name",
    "account", "repository_selection", "permissions", "access_summary", "credential_ref",
    "credential_state", "status", "created_at", "updated_at",
  ],
  projects: [
    "id", "name", "slug", "repository_connection_id", "repository_snapshot", "base_branch",
    "default_agent", "runtime", "prewarm_config", "metadata", "archived_at", "created_at", "updated_at",
  ],
  context_bundles: [
    "id", "slug", "display_name", "source", "access_mode", "mount_path", "freshness",
    "failure_mode", "metadata", "archived_at", "created_at", "updated_at",
  ],
  tasks: [
    "id", "project_id", "source", "objective", "issue_snapshot", "dispatch_key",
    "repository_snapshot", "metadata", "created_at", "updated_at",
  ],
  runners: [
    "id", "name", "credential_hash", "capabilities", "max_concurrency", "stale_after_seconds",
    "eligible_project_ids", "eligible_runtime_providers", "last_heartbeat_at", "created_at", "updated_at",
  ],
  sessions: [
    "id", "task_id", "initial_dispatch_key", "title", "objective", "agent", "branch",
    "repository_key", "merge_request", "runtime_override", "resolved_runtime", "state",
    "assigned_runner_id", "result", "failure_reason", "cancellation_request", "stale_reason",
    "stale_marked_at", "metadata", "created_at", "updated_at", "started_at", "finished_at",
  ],
  session_events: ["id", "session_id", "task_id", "type", "severity", "data", "created_at"],
  artifacts: ["id", "session_id", "task_id", "kind", "name", "uri", "metadata", "created_at"],
};

const prismaPersistedColumns: Record<string, string[]> = {
  integration_connections: [
    "id", "team_id", "integration", "provider", "auth_method", "provider_external_id", "display_name",
    "provider_subject", "connection_config", "capabilities", "credential_ref", "credential_state",
    "status", "created_at", "updated_at",
  ],
  projects: [
    "id", "team_id", "name", "slug", "repository_connection_id", "repository_external_id",
    "repository_base_branch", "metadata", "archived_at", "created_at", "updated_at",
  ],
  tasks: [
    "id", "team_id", "title", "description", "project_id", "idempotency_key", "issue_provider",
    "issue_connection_id", "issue_scope_external_id", "issue_external_id", "issue_identifier",
    "created_at", "updated_at",
  ],
  agents: [
    "id", "team_id", "name", "system_prompt", "revision", "status", "archived_at",
    "created_at", "updated_at",
  ],
  runtimes: ["id", "name", "type", "metadata", "created_at", "updated_at"],
  runtime_providers: [
    "id", "runtime_id", "provider", "discovered", "available", "source", "resolved_path",
    "version", "unavailable_reason",
  ],
  secret_envelopes: [
    "reference", "version", "algorithm", "key_id", "ciphertext", "ciphertext_iv",
    "ciphertext_auth_tag", "wrapped_data_key", "wrapped_data_key_iv",
    "wrapped_data_key_auth_tag", "created_at",
  ],
  users: [
    "id", "username", "display_username", "display_name", "status", "require_password_change",
    "created_at", "updated_at",
  ],
  auth_accounts: [
    "id", "user_id", "password_hash", "password_salt", "password_params", "created_at", "updated_at",
  ],
  auth_sessions: [
    "id", "user_id", "token_hash", "active_team_id", "expires_at", "ip_address", "user_agent",
    "created_at", "updated_at",
  ],
  teams: ["id", "display_name", "status", "archived_at", "created_at", "updated_at"],
  team_memberships: [
    "id", "team_id", "user_id", "role", "status", "created_at", "updated_at",
  ],
};

export function inspectSqliteAdoption(databasePath: string): SqliteAdoptionInspection {
  const database = new Database(databasePath, { readonly: true, fileMustExist: true });
  try {
    const tables = userTables(database);
    if (sameSet(tables, Object.keys(schemaV5Columns)) && hasExactColumns(database, schemaV5Columns)) {
      const version = database.prepare("SELECT version FROM mystra_schema WHERE id = 1").pluck().get();
      if (version === 5) {
        return { state: "schema-v5", counts: readCounts(database) };
      }
    }
    if (
      sameSet(tables, ["_prisma_migrations", ...Object.keys(prismaPersistedColumns)])
      && hasExactColumns(database, prismaPersistedColumns)
    ) {
      return { state: "prisma", counts: readCounts(database) };
    }
    return { state: "unknown" };
  } finally {
    database.close();
  }
}

export async function adoptSqliteDatabase(
  databasePath: string,
  options: { dryRun?: boolean; now?: () => string } = {},
): Promise<SqliteAdoptionResult> {
  const inspection = inspectSqliteAdoption(databasePath);
  if (inspection.state === "prisma") {
    return { state: "already-adopted", counts: inspection.counts! };
  }
  if (inspection.state === "schema-v5") {
    throw new Error("SQLITE_ADOPTION_REFUSED: obsolete schema-v5 lacks required Team scope");
  }
  throw new Error("SQLITE_ADOPTION_REFUSED: unknown SQLite schema");
  if (existsSync(`${databasePath}-wal`) || existsSync(`${databasePath}-shm`)) {
    throw new Error("SQLITE_ADOPTION_REFUSED: database appears to be open; stop Mystra before adoption");
  }

  const source = new Database(databasePath, { readonly: true, fileMustExist: true });
  let transformed: ReturnType<typeof readTransformedRows>;
  try {
    transformed = readTransformedRows(source);
  } finally {
    source.close();
  }
  if (options.dryRun) {
    return { state: "dry-run", counts: inspection.counts! };
  }

  const now = options.now?.() ?? new Date().toISOString();
  const suffix = now.replace(/[-:.]/gu, "");
  const backupPath = `${databasePath}.prisma-v5-backup-${suffix}.db`;
  const temporaryPath = `${databasePath}.prisma-adoption-${process.pid}.tmp`;
  if (existsSync(backupPath) || existsSync(temporaryPath)) {
    throw new Error("SQLITE_ADOPTION_REFUSED: backup or temporary target already exists");
  }

  const backupSource = new Database(databasePath, { readonly: true, fileMustExist: true });
  try {
    await backupSource.backup(backupPath);
  } finally {
    backupSource.close();
  }

  try {
    deployPrismaMigration(temporaryPath);
    writeTransformedRows(temporaryPath, transformed);
    const targetInspection = inspectSqliteAdoption(temporaryPath);
    if (
      targetInspection.state !== "prisma"
      || JSON.stringify(targetInspection.counts) !== JSON.stringify(inspection.counts)
    ) {
      throw new Error("SQLITE_ADOPTION_FAILED: transformed row counts do not match source");
    }
    renameSync(temporaryPath, databasePath);
    return { state: "adopted", counts: inspection.counts!, backupPath };
  } catch (error) {
    if (existsSync(temporaryPath)) {
      unlinkSync(temporaryPath);
    }
    throw error;
  }
}

function readTransformedRows(database: Database.Database) {
  const integrationConnections = (database.prepare(
    "SELECT * FROM integration_connections ORDER BY created_at, id",
  ).all() as Row[]).map((row) => ({
    id: stringField(row, "id"),
    integration: stringField(row, "integration"),
    provider: stringField(row, "provider"),
    authMethod: stringField(row, "connection_type"),
    providerExternalId: stringField(row, "external_id"),
    displayName: nullableStringField(row, "display_name"),
    providerSubject: jsonObjectField(row, "account"),
    connectionConfig: {},
    capabilities: {
      repositories: {
        state: "enabled",
        config: { selection: stringField(row, "repository_selection") },
        permissions: jsonObjectField(row, "permissions"),
        accessSummary: jsonObjectField(row, "access_summary"),
        verifiedAt: null,
      },
    },
    credentialRef: nullableStringField(row, "credential_ref"),
    credentialState: stringField(row, "credential_state"),
    status: stringField(row, "status"),
    createdAt: stringField(row, "created_at"),
    updatedAt: stringField(row, "updated_at"),
  }));

  const projects = (database.prepare("SELECT * FROM projects ORDER BY created_at, id").all() as Row[])
    .map((row) => {
      const repository = jsonObjectField(row, "repository_snapshot");
      const repositoryExternalId = repository.externalId;
      if (typeof repositoryExternalId !== "string" || repositoryExternalId.trim() === "") {
        throw new Error(`SQLITE_ADOPTION_REFUSED: Project ${stringField(row, "id")} has no repository external ID`);
      }
      return {
        id: stringField(row, "id"),
        name: stringField(row, "name"),
        slug: stringField(row, "slug"),
        repositoryConnectionId: stringField(row, "repository_connection_id"),
        repositoryExternalId,
        repositoryBaseBranch: stringField(row, "base_branch"),
        metadata: jsonObjectField(row, "metadata"),
        archivedAt: nullableStringField(row, "archived_at"),
        createdAt: stringField(row, "created_at"),
        updatedAt: stringField(row, "updated_at"),
      };
    });

  // Pre-0.1 Task rows are intentionally not transformed. They have no reliable
  // 047 title or exact Issue identity and must not be converted by inference.
  return { integrationConnections, projects };
}

function writeTransformedRows(
  databasePath: string,
  transformed: ReturnType<typeof readTransformedRows>,
): void {
  const database = new Database(databasePath);
  database.pragma("foreign_keys = ON");
  try {
    database.transaction(() => {
      const insertConnection = database.prepare(`
        INSERT INTO integration_connections (
          id, integration, provider, auth_method, provider_external_id, display_name,
          provider_subject, connection_config, capabilities, credential_ref, credential_state,
          status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const row of transformed.integrationConnections) {
        insertConnection.run(
          row.id, row.integration, row.provider, row.authMethod, row.providerExternalId, row.displayName,
          JSON.stringify(row.providerSubject), JSON.stringify(row.connectionConfig),
          JSON.stringify(row.capabilities), row.credentialRef, row.credentialState, row.status,
          row.createdAt, row.updatedAt,
        );
      }
      const insertProject = database.prepare(`
        INSERT INTO projects (
          id, name, slug, repository_connection_id, repository_external_id,
          repository_base_branch, metadata, archived_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const row of transformed.projects) {
        insertProject.run(
          row.id, row.name, row.slug, row.repositoryConnectionId, row.repositoryExternalId,
          row.repositoryBaseBranch, JSON.stringify(row.metadata), row.archivedAt, row.createdAt, row.updatedAt,
        );
      }
    })();
    const violations = database.pragma("foreign_key_check") as unknown[];
    if (violations.length > 0) {
      throw new Error("SQLITE_ADOPTION_FAILED: foreign key check failed");
    }
  } finally {
    database.close();
  }
}

function deployPrismaMigration(databasePath: string): void {
  const controlPlaneRoot = fileURLToPath(new URL("../../../", import.meta.url));
  const prismaCli = path.join(controlPlaneRoot, "node_modules", "prisma", "build", "index.js");
  const result = spawnSync(process.execPath, [
    prismaCli,
    "migrate",
    "deploy",
    "--config",
    "prisma/sqlite/prisma.config.ts",
  ], {
    cwd: controlPlaneRoot,
    env: {
      ...process.env,
      MYSTRA_PRISMA_SQLITE_URL: `file:${databasePath}`,
      RUST_LOG: "info",
    },
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error("SQLITE_ADOPTION_FAILED: Prisma migration could not initialize the temporary database");
  }
}

function readCounts(database: Database.Database): AdoptionCounts {
  return {
    integrationConnections: count(database, "integration_connections"),
    projects: count(database, "projects"),
    tasks: count(database, "tasks"),
  };
}

function count(database: Database.Database, table: string): number {
  return database.prepare(`SELECT COUNT(*) FROM ${table}`).pluck().get() as number;
}

function userTables(database: Database.Database): string[] {
  return (database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").pluck().all() as string[])
    .filter((name) => !name.startsWith("sqlite_"));
}

function hasExactColumns(database: Database.Database, expected: Record<string, string[]>): boolean {
  return Object.entries(expected).every(([table, names]) => {
    const actual = (database.pragma(`table_info(${table})`) as Array<{ name: string }>).map(({ name }) => name);
    return sameSet(actual, names);
  });
}

function sameSet(actual: string[], expected: string[]): boolean {
  const values = new Set(actual);
  return actual.length === expected.length && expected.every((value) => values.has(value));
}

function stringField(row: Row, name: string): string {
  const value = row[name];
  if (typeof value !== "string") {
    throw new Error(`SQLITE_ADOPTION_REFUSED: invalid ${name}`);
  }
  return value;
}

function nullableStringField(row: Row, name: string): string | null {
  const value = row[name];
  if (value === null) {
    return null;
  }
  return stringField(row, name);
}

function jsonObjectField(row: Row, name: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(stringField(row, name));
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error(`SQLITE_ADOPTION_REFUSED: invalid JSON object in ${name}`);
  }
  return parsed as Record<string, unknown>;
}
