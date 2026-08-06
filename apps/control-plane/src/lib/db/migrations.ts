import type Database from "better-sqlite3";

export const currentSchemaVersion = 5;

export const sqliteMigrations = `
CREATE TABLE mystra_schema (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  version INTEGER NOT NULL
);
INSERT INTO mystra_schema (id, version) VALUES (1, ${currentSchemaVersion});

CREATE TABLE integration_connections (
  id TEXT PRIMARY KEY,
  integration TEXT NOT NULL,
  provider TEXT NOT NULL,
  connection_type TEXT NOT NULL CHECK (connection_type IN ('github-app', 'personal-access-token')),
  external_id TEXT NOT NULL,
  display_name TEXT,
  account TEXT NOT NULL,
  repository_selection TEXT NOT NULL CHECK (repository_selection IN ('all', 'selected', 'token')),
  permissions TEXT NOT NULL DEFAULT '{}',
  access_summary TEXT NOT NULL DEFAULT '{}',
  credential_ref TEXT,
  credential_state TEXT NOT NULL CHECK (credential_state IN ('ready', 'missing', 'invalid')),
  status TEXT NOT NULL CHECK (status IN ('active', 'inactive')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(integration, external_id),
  CHECK (
    (connection_type = 'github-app' AND credential_ref IS NULL) OR
    (connection_type = 'personal-access-token' AND credential_ref IS NOT NULL)
  )
);

CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  repository_connection_id TEXT NOT NULL REFERENCES integration_connections(id) ON DELETE RESTRICT,
  repository_snapshot TEXT NOT NULL,
  base_branch TEXT NOT NULL DEFAULT 'main',
  default_agent TEXT NOT NULL CHECK (default_agent IN ('codex', 'copilot')),
  runtime TEXT NOT NULL,
  prewarm_config TEXT NOT NULL DEFAULT '{}',
  metadata TEXT NOT NULL DEFAULT '{}',
  archived_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE context_bundles (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT '{}',
  access_mode TEXT NOT NULL,
  mount_path TEXT,
  freshness TEXT NOT NULL DEFAULT '{}',
  failure_mode TEXT NOT NULL,
  metadata TEXT NOT NULL DEFAULT '{}',
  archived_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  source TEXT NOT NULL CHECK (source IN ('mcp', 'api', 'issue')),
  objective TEXT NOT NULL,
  issue_snapshot TEXT,
  dispatch_key TEXT UNIQUE,
  repository_snapshot TEXT NOT NULL,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE runners (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  credential_hash TEXT NOT NULL UNIQUE,
  capabilities TEXT NOT NULL,
  max_concurrency INTEGER NOT NULL CHECK (max_concurrency > 0),
  stale_after_seconds INTEGER NOT NULL CHECK (stale_after_seconds > 0),
  eligible_project_ids TEXT,
  eligible_runtime_providers TEXT,
  last_heartbeat_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  initial_dispatch_key TEXT UNIQUE,
  title TEXT NOT NULL,
  objective TEXT NOT NULL,
  agent TEXT NOT NULL CHECK (agent IN ('codex', 'copilot')),
  branch TEXT NOT NULL,
  repository_key TEXT NOT NULL,
  merge_request TEXT,
  runtime_override TEXT,
  resolved_runtime TEXT,
  state TEXT NOT NULL DEFAULT 'queued' CHECK (state IN (
    'queued', 'dispatching', 'assigned', 'starting', 'running',
    'succeeded', 'failed', 'canceled', 'timed_out', 'waiting_for_review'
  )),
  assigned_runner_id TEXT REFERENCES runners(id) ON DELETE SET NULL,
  result TEXT,
  failure_reason TEXT,
  cancellation_request TEXT,
  stale_reason TEXT,
  stale_marked_at TEXT,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  started_at TEXT,
  finished_at TEXT
);

CREATE TABLE session_events (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info',
  data TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

CREATE TABLE artifacts (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  name TEXT NOT NULL,
  uri TEXT NOT NULL,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

CREATE INDEX idx_projects_slug ON projects(slug);
CREATE UNIQUE INDEX idx_integration_connections_identity
  ON integration_connections(integration, external_id);
CREATE INDEX idx_integration_connections_status
  ON integration_connections(integration, status);
CREATE INDEX idx_context_bundles_slug ON context_bundles(slug);
CREATE INDEX idx_tasks_project_id ON tasks(project_id);
CREATE INDEX idx_tasks_created_at ON tasks(created_at, id);
CREATE INDEX idx_sessions_task_created ON sessions(task_id, created_at, id);
CREATE INDEX idx_sessions_state_created ON sessions(state, created_at, id);
CREATE INDEX idx_sessions_runner_state ON sessions(assigned_runner_id, state);
CREATE UNIQUE INDEX idx_sessions_active_repository_branch
  ON sessions(repository_key, branch)
  WHERE state IN ('queued', 'dispatching', 'assigned', 'starting', 'running');
CREATE INDEX idx_session_events_session_created ON session_events(session_id, created_at, id);
CREATE INDEX idx_runners_last_heartbeat ON runners(last_heartbeat_at);
`;

const currentTables = new Set([
  "artifacts",
  "context_bundles",
  "integration_connections",
  "mystra_schema",
  "projects",
  "runners",
  "session_events",
  "sessions",
  "tasks",
]);

const schemaV3Tables = new Set([
  "artifacts",
  "context_bundles",
  "mystra_schema",
  "projects",
  "runners",
  "session_events",
  "sessions",
  "tasks",
]);

const schemaV3Columns: Record<string, Set<string>> = {
  mystra_schema: new Set(["id", "version"]),
  projects: new Set([
    "id", "name", "slug", "repository_snapshot", "base_branch", "default_agent", "runtime",
    "prewarm_config", "metadata", "archived_at", "created_at", "updated_at",
  ]),
  context_bundles: new Set([
    "id", "slug", "display_name", "source", "access_mode", "mount_path", "freshness",
    "failure_mode", "metadata", "archived_at", "created_at", "updated_at",
  ]),
  tasks: new Set([
    "id", "project_id", "source", "objective", "issue_snapshot", "dispatch_key",
    "repository_snapshot", "metadata", "created_at", "updated_at",
  ]),
  runners: new Set([
    "id", "name", "credential_hash", "capabilities", "max_concurrency", "stale_after_seconds",
    "eligible_project_ids", "eligible_runtime_providers", "last_heartbeat_at", "created_at", "updated_at",
  ]),
  sessions: new Set([
    "id", "task_id", "initial_dispatch_key", "title", "objective", "agent", "branch",
    "repository_key", "merge_request", "runtime_override", "resolved_runtime", "state",
    "assigned_runner_id", "result", "failure_reason", "cancellation_request", "stale_reason",
    "stale_marked_at", "metadata", "created_at", "updated_at", "started_at", "finished_at",
  ]),
  session_events: new Set(["id", "session_id", "task_id", "type", "severity", "data", "created_at"]),
  artifacts: new Set(["id", "session_id", "task_id", "kind", "name", "uri", "metadata", "created_at"]),
};

const schemaV4Columns: Record<string, Set<string>> = {
  ...schemaV3Columns,
  integration_connections: new Set([
    "id", "integration", "provider", "external_id", "account", "repository_selection",
    "permissions", "status", "created_at", "updated_at",
  ]),
  projects: new Set([
    "id", "name", "slug", "repository_connection_id", "repository_snapshot", "base_branch",
    "default_agent", "runtime", "prewarm_config", "metadata", "archived_at", "created_at", "updated_at",
  ]),
};

const schemaV5Columns: Record<string, Set<string>> = {
  ...schemaV4Columns,
  integration_connections: new Set([
    "id", "integration", "provider", "connection_type", "external_id", "display_name",
    "account", "repository_selection", "permissions", "access_summary", "credential_ref",
    "credential_state", "status", "created_at", "updated_at",
  ]),
};

const legacyTables = new Set([
  "artifacts",
  "context_bundles",
  // legacy-term-audit: allow -- exact destructive-reset fingerprint.
  "jobs",
  "projects",
  // legacy-term-audit: allow -- exact destructive-reset fingerprint.
  "run_events",
  // legacy-term-audit: allow -- exact destructive-reset fingerprint.
  "runner_sessions",
  // legacy-term-audit: allow -- exact destructive-reset fingerprint.
  "runs",
]);

function userTables(db: Database.Database): string[] {
  return (db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all() as Array<{ name: string }>)
    .map((row) => row.name)
    .filter((name) => !name.startsWith("sqlite_"));
}

function sameSet(values: string[], expected: Set<string>): boolean {
  return values.length === expected.size && values.every((value) => expected.has(value));
}

function columns(db: Database.Database, table: string): Set<string> {
  return new Set((db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>).map((row) => row.name));
}

function isExactSchemaV3Fingerprint(db: Database.Database, tables: string[]): boolean {
  if (!sameSet(tables, schemaV3Tables)) {
    return false;
  }
  const version = db.prepare("SELECT version FROM mystra_schema WHERE id = 1").pluck().get();
  return version === 3 && Object.entries(schemaV3Columns).every(([table, expected]) => (
    sameSet([...columns(db, table)], expected)
  ));
}

function hasExactColumns(
  db: Database.Database,
  expectedByTable: Record<string, Set<string>>,
): boolean {
  return Object.entries(expectedByTable).every(([table, expected]) => (
    sameSet([...columns(db, table)], expected)
  ));
}

function isExactSchemaV4Fingerprint(db: Database.Database, tables: string[]): boolean {
  if (!sameSet(tables, currentTables)) {
    return false;
  }
  const version = db.prepare("SELECT version FROM mystra_schema WHERE id = 1").pluck().get();
  if (version !== 4 || !hasExactColumns(db, schemaV4Columns)) {
    return false;
  }
  const activeIndex = db.prepare(
    "SELECT sql FROM sqlite_master WHERE type = 'index' AND name = 'idx_integration_connections_active'",
  ).pluck().get();
  return typeof activeIndex === "string"
    && /CREATE\s+UNIQUE\s+INDEX/i.test(activeIndex)
    && /WHERE\s+status\s*=\s*'active'/i.test(activeIndex);
}

function isExactCurrentSchema(db: Database.Database, tables: string[]): boolean {
  if (!sameSet(tables, currentTables)) {
    return false;
  }
  const version = db.prepare("SELECT version FROM mystra_schema WHERE id = 1").pluck().get();
  return version === currentSchemaVersion && hasExactColumns(db, schemaV5Columns);
}

function isExactLegacyFingerprint(db: Database.Database, tables: string[]): boolean {
  if (!sameSet(tables, legacyTables)) {
    return false;
  }
  const projectColumns = columns(db, "projects");
  // legacy-term-audit: allow -- exact destructive-reset fingerprint.
  const jobColumns = columns(db, "jobs");
  // legacy-term-audit: allow -- exact destructive-reset fingerprint.
  const sessionColumns = columns(db, "runner_sessions");
  // legacy-term-audit: allow -- exact destructive-reset fingerprint.
  const executionColumns = columns(db, "runs");
  return projectColumns.has("id")
    && (projectColumns.has("repository_snapshot") || projectColumns.has("repo"))
    && jobColumns.has("task_id")
    && jobColumns.has("branch_name")
    && sessionColumns.has("runner_name")
    && sessionColumns.has("token")
    && executionColumns.has("job_id")
    && executionColumns.has("state");
}

function verifyForeignKeys(db: Database.Database): void {
  const violations = db.prepare("PRAGMA foreign_key_check").all();
  if (violations.length > 0) {
    throw new Error("DATABASE_FOREIGN_KEY_CHECK_FAILED");
  }
}

function createCurrentSchema(db: Database.Database): void {
  db.exec(sqliteMigrations);
  verifyForeignKeys(db);
}

function rebuildExactLegacySchema(db: Database.Database): void {
  db.pragma("foreign_keys = OFF");
  const rebuild = db.transaction(() => {
    for (const table of [
      "artifacts",
      // legacy-term-audit: allow -- allowlisted child-first destructive reset.
      "run_events",
      // legacy-term-audit: allow -- allowlisted child-first destructive reset.
      "runs",
      // legacy-term-audit: allow -- allowlisted child-first destructive reset.
      "jobs",
      // legacy-term-audit: allow -- allowlisted child-first destructive reset.
      "runner_sessions",
      "context_bundles",
      "projects",
    ]) {
      db.exec(`DROP TABLE ${table}`);
    }
    createCurrentSchema(db);
  });
  try {
    rebuild.immediate();
  } finally {
    db.pragma("foreign_keys = ON");
  }
  verifyForeignKeys(db);
}

function rebuildExactSchemaV3(db: Database.Database): void {
  db.pragma("foreign_keys = OFF");
  const rebuild = db.transaction(() => {
    for (const table of [
      "artifacts",
      "session_events",
      "sessions",
      "tasks",
      "runners",
      "context_bundles",
      "projects",
      "mystra_schema",
    ]) {
      db.exec(`DROP TABLE ${table}`);
    }
    createCurrentSchema(db);
  });
  try {
    rebuild.immediate();
  } finally {
    db.pragma("foreign_keys = ON");
  }
  verifyForeignKeys(db);
}

function migrateExactSchemaV4(db: Database.Database): void {
  db.pragma("foreign_keys = OFF");
  const migrate = db.transaction(() => {
    db.exec(`
      CREATE TABLE integration_connections_v5 (
        id TEXT PRIMARY KEY,
        integration TEXT NOT NULL,
        provider TEXT NOT NULL,
        connection_type TEXT NOT NULL CHECK (connection_type IN ('github-app', 'personal-access-token')),
        external_id TEXT NOT NULL,
        display_name TEXT,
        account TEXT NOT NULL,
        repository_selection TEXT NOT NULL CHECK (repository_selection IN ('all', 'selected', 'token')),
        permissions TEXT NOT NULL DEFAULT '{}',
        access_summary TEXT NOT NULL DEFAULT '{}',
        credential_ref TEXT,
        credential_state TEXT NOT NULL CHECK (credential_state IN ('ready', 'missing', 'invalid')),
        status TEXT NOT NULL CHECK (status IN ('active', 'inactive')),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(integration, external_id),
        CHECK (
          (connection_type = 'github-app' AND credential_ref IS NULL) OR
          (connection_type = 'personal-access-token' AND credential_ref IS NOT NULL)
        )
      );
      INSERT INTO integration_connections_v5 (
        id, integration, provider, connection_type, external_id, display_name, account,
        repository_selection, permissions, access_summary, credential_ref, credential_state,
        status, created_at, updated_at
      )
      SELECT
        id, integration, provider, 'github-app', external_id, NULL, account,
        repository_selection, permissions, '{}', NULL, 'ready', status, created_at, updated_at
      FROM integration_connections;
      DROP TABLE integration_connections;
      ALTER TABLE integration_connections_v5 RENAME TO integration_connections;
      CREATE UNIQUE INDEX idx_integration_connections_identity
        ON integration_connections(integration, external_id);
      CREATE INDEX idx_integration_connections_status
        ON integration_connections(integration, status);
      UPDATE mystra_schema SET version = ${currentSchemaVersion} WHERE id = 1;
    `);
  });
  try {
    migrate.immediate();
  } finally {
    db.pragma("foreign_keys = ON");
  }
  verifyForeignKeys(db);
}

export function ensureCurrentSchema(db: Database.Database): void {
  const tables = userTables(db);
  if (tables.length === 0) {
    const create = db.transaction(() => createCurrentSchema(db));
    create.immediate();
    return;
  }
  if (isExactCurrentSchema(db, tables)) {
    verifyForeignKeys(db);
    return;
  }
  if (isExactSchemaV4Fingerprint(db, tables)) {
    migrateExactSchemaV4(db);
    return;
  }
  if (isExactSchemaV3Fingerprint(db, tables)) {
    rebuildExactSchemaV3(db);
    return;
  }
  if (isExactLegacyFingerprint(db, tables)) {
    rebuildExactLegacySchema(db);
    return;
  }
  throw new Error(`UNKNOWN_DATABASE_SCHEMA: refusing to modify tables [${tables.join(", ")}]`);
}
