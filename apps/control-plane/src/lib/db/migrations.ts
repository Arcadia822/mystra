export const sqliteMigrations = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
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

CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
  task_id TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('mcp', 'api', 'issue')),
  repository_snapshot TEXT NOT NULL,
  base_branch TEXT NOT NULL DEFAULT 'main',
  branch_name TEXT NOT NULL,
  agent TEXT NOT NULL CHECK (agent IN ('codex', 'copilot')),
  prompt TEXT NOT NULL,
  issue_snapshot TEXT,
  dispatch_key TEXT,
  mr_title TEXT,
  mr_body TEXT,
  runtime_override TEXT,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS runs (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  state TEXT NOT NULL DEFAULT 'queued',
  attempt INTEGER NOT NULL DEFAULT 1,
  assigned_runner_session_id TEXT REFERENCES runner_sessions(id) ON DELETE SET NULL,
  resolved_runtime TEXT,
  started_at TEXT,
  finished_at TEXT,
  result TEXT,
  failure_reason TEXT,
  cancellation_request TEXT,
  stale_reason TEXT,
  stale_marked_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS runner_sessions (
  id TEXT PRIMARY KEY,
  runner_name TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  capabilities TEXT NOT NULL DEFAULT '{}',
  max_concurrency INTEGER NOT NULL DEFAULT 1,
  active_run_count INTEGER NOT NULL DEFAULT 0,
  stale_after_seconds INTEGER NOT NULL DEFAULT 90,
  eligible_project_ids TEXT,
  eligible_runtime_providers TEXT,
  last_heartbeat_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS run_events (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info',
  data TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS context_bundles (
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

CREATE TABLE IF NOT EXISTS artifacts (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  name TEXT NOT NULL,
  uri TEXT NOT NULL,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_projects_slug ON projects(slug);
CREATE INDEX IF NOT EXISTS idx_context_bundles_slug ON context_bundles(slug);
CREATE INDEX IF NOT EXISTS idx_jobs_project_id ON jobs(project_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_jobs_dispatch_key ON jobs(dispatch_key) WHERE dispatch_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_runs_job_id ON runs(job_id);
CREATE INDEX IF NOT EXISTS idx_runs_state ON runs(state);
CREATE INDEX IF NOT EXISTS idx_runs_assigned_runner ON runs(assigned_runner_session_id);
CREATE INDEX IF NOT EXISTS idx_runs_cancellation_request ON runs(cancellation_request);
CREATE INDEX IF NOT EXISTS idx_runs_stale_marked_at ON runs(stale_marked_at);
CREATE INDEX IF NOT EXISTS idx_run_events_job_id ON run_events(job_id);
CREATE INDEX IF NOT EXISTS idx_run_events_run_id ON run_events(run_id);
CREATE INDEX IF NOT EXISTS idx_runner_sessions_last_heartbeat ON runner_sessions(last_heartbeat_at);
`;
