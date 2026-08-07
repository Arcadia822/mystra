CREATE TABLE mystra_schema (id INTEGER PRIMARY KEY, version INTEGER NOT NULL);
INSERT INTO mystra_schema (id, version) VALUES (1, 5);

CREATE TABLE integration_connections (
  id TEXT PRIMARY KEY, integration TEXT NOT NULL, provider TEXT NOT NULL,
  connection_type TEXT NOT NULL, external_id TEXT NOT NULL, display_name TEXT,
  account TEXT NOT NULL, repository_selection TEXT NOT NULL, permissions TEXT NOT NULL,
  access_summary TEXT NOT NULL, credential_ref TEXT, credential_state TEXT NOT NULL,
  status TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE projects (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, slug TEXT NOT NULL,
  repository_connection_id TEXT NOT NULL, repository_snapshot TEXT NOT NULL,
  base_branch TEXT NOT NULL, default_agent TEXT NOT NULL, runtime TEXT NOT NULL,
  prewarm_config TEXT NOT NULL, metadata TEXT NOT NULL, archived_at TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE tasks (
  id TEXT PRIMARY KEY, project_id TEXT NOT NULL, source TEXT NOT NULL,
  objective TEXT NOT NULL, issue_snapshot TEXT, dispatch_key TEXT,
  repository_snapshot TEXT NOT NULL, metadata TEXT NOT NULL,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE context_bundles (
  id TEXT PRIMARY KEY, slug TEXT NOT NULL, display_name TEXT NOT NULL, source TEXT NOT NULL,
  access_mode TEXT NOT NULL, mount_path TEXT, freshness TEXT NOT NULL, failure_mode TEXT NOT NULL,
  metadata TEXT NOT NULL, archived_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE runners (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, credential_hash TEXT NOT NULL, capabilities TEXT NOT NULL,
  max_concurrency INTEGER NOT NULL, stale_after_seconds INTEGER NOT NULL, eligible_project_ids TEXT,
  eligible_runtime_providers TEXT, last_heartbeat_at TEXT NOT NULL, created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE sessions (
  id TEXT PRIMARY KEY, task_id TEXT NOT NULL, initial_dispatch_key TEXT, title TEXT NOT NULL,
  objective TEXT NOT NULL, agent TEXT NOT NULL, branch TEXT NOT NULL, repository_key TEXT NOT NULL,
  merge_request TEXT, runtime_override TEXT, resolved_runtime TEXT, state TEXT NOT NULL,
  assigned_runner_id TEXT, result TEXT, failure_reason TEXT, cancellation_request TEXT,
  stale_reason TEXT, stale_marked_at TEXT, metadata TEXT NOT NULL, created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL, started_at TEXT, finished_at TEXT
);
CREATE TABLE session_events (
  id TEXT PRIMARY KEY, session_id TEXT NOT NULL, task_id TEXT NOT NULL, type TEXT NOT NULL,
  severity TEXT NOT NULL, data TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE artifacts (
  id TEXT PRIMARY KEY, session_id TEXT NOT NULL, task_id TEXT NOT NULL, kind TEXT NOT NULL,
  name TEXT NOT NULL, uri TEXT NOT NULL, metadata TEXT NOT NULL, created_at TEXT NOT NULL
);
