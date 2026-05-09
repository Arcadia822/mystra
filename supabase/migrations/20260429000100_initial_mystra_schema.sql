create extension if not exists pgcrypto;

create type run_state as enum (
  'queued',
  'dispatching',
  'assigned',
  'starting',
  'running',
  'succeeded',
  'failed',
  'canceled',
  'timed_out',
  'needs_human_review'
);

create type run_event_severity as enum (
  'debug',
  'info',
  'warn',
  'error'
);

create table jobs (
  id uuid primary key default gen_random_uuid(),
  task_id text not null,
  source text not null check (source in ('mcp', 'api')),
  repo text not null,
  base_branch text not null default 'main',
  agent text not null check (agent in ('codex', 'copilot')),
  prompt text not null,
  callback_url text,
  metadata jsonb not null default '{}'::jsonb,
  spec jsonb not null,
  idempotency_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index jobs_idempotency_key_unique
  on jobs (idempotency_key)
  where idempotency_key is not null;

create index jobs_task_id_idx on jobs (task_id);
create index jobs_created_at_idx on jobs (created_at desc);

create table runs (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references jobs (id) on delete cascade,
  state run_state not null default 'queued',
  attempt integer not null default 1 check (attempt > 0),
  assigned_runner_session_id uuid,
  timeout_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  result jsonb,
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index runs_job_attempt_unique on runs (job_id, attempt);
create index runs_state_created_at_idx on runs (state, created_at);
create index runs_job_id_idx on runs (job_id);

create table runner_sessions (
  id uuid primary key default gen_random_uuid(),
  runner_name text not null,
  session_token_hash text not null unique,
  capabilities jsonb not null default '{}'::jsonb,
  max_concurrency integer not null default 1 check (max_concurrency > 0),
  active_run_count integer not null default 0 check (active_run_count >= 0),
  last_heartbeat_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table runs
  add constraint runs_assigned_runner_session_fk
  foreign key (assigned_runner_session_id)
  references runner_sessions (id)
  on delete set null;

create index runner_sessions_expires_at_idx on runner_sessions (expires_at);
create index runner_sessions_last_heartbeat_at_idx on runner_sessions (last_heartbeat_at desc);

create table run_events (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references runs (id) on delete cascade,
  job_id uuid not null references jobs (id) on delete cascade,
  type text not null,
  severity run_event_severity not null default 'info',
  data jsonb not null default '{}'::jsonb,
  log_offset bigint,
  created_at timestamptz not null default now()
);

create index run_events_run_id_created_at_idx on run_events (run_id, created_at);
create index run_events_job_id_created_at_idx on run_events (job_id, created_at);
create index run_events_type_idx on run_events (type);

create table run_logs (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references runs (id) on delete cascade,
  job_id uuid not null references jobs (id) on delete cascade,
  stream text not null check (stream in ('stdout', 'stderr', 'system')),
  sequence integer not null check (sequence >= 0),
  content text not null,
  byte_length integer not null check (byte_length >= 0),
  redacted boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index run_logs_run_stream_sequence_unique
  on run_logs (run_id, stream, sequence);

create index run_logs_run_id_sequence_idx on run_logs (run_id, sequence);
create index run_logs_job_id_created_at_idx on run_logs (job_id, created_at);

create table artifacts (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references runs (id) on delete cascade,
  job_id uuid not null references jobs (id) on delete cascade,
  kind text not null,
  name text not null,
  uri text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index artifacts_run_id_idx on artifacts (run_id);
create index artifacts_job_id_idx on artifacts (job_id);

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger jobs_set_updated_at
  before update on jobs
  for each row execute function set_updated_at();

create trigger runs_set_updated_at
  before update on runs
  for each row execute function set_updated_at();

create trigger runner_sessions_set_updated_at
  before update on runner_sessions
  for each row execute function set_updated_at();

alter table jobs enable row level security;
alter table runs enable row level security;
alter table runner_sessions enable row level security;
alter table run_events enable row level security;
alter table run_logs enable row level security;
alter table artifacts enable row level security;

comment on table jobs is 'Normalized Mystra task requests. Access through control-plane service role only.';
comment on table runs is 'Run attempts and state machine terminal status.';
comment on table runner_sessions is 'Registered pull-based runner sessions. Stores token hashes only.';
comment on table run_events is 'Structured append-only run events.';
comment on table run_logs is 'Redacted append-only log chunks.';
comment on table artifacts is 'Pointers to run artifacts such as MR links and result files.';
