# Mystra MVP Specification

## Product objective

Mystra accepts durable coding intent, executes independently scoped Agent work
inside sandboxes, and returns reviewable repository evidence. API is canonical;
MCP, CLI, and Web are thin clients.

## Business objects

### Task

Task stores durable intent:

- stable ID, Project ID, source, and objective
- immutable Repository snapshot
- optional immutable Issue snapshot and dispatch key
- metadata and timestamps

Task has no state, Agent, branch, runtime allocation, Runner assignment, or
result. It remains valid with zero Sessions.

### Session

Session belongs to exactly one Task. A Task may have zero or many Sessions.
Each Session independently owns:

- title and subtask objective
- Agent and branch
- optional policy-limited runtime override and resolved runtime
- lifecycle, cancellation, stale failure, and timestamps
- terminal result and review evidence
- optional assigned stable Runner ID

Creating another execution always creates another Session. There is no attempt
counter or overwrite semantics, and sibling lifecycle transitions do not couple.

### Runner

Runner is stable execution capacity. It stores identity, declared capabilities,
eligibility, health, heartbeat, concurrency, credential digest, and current
Task/Session assignments. Enrollment by the same name preserves identity and
rotates credentials.

Protocol bookkeeping and internal execution facts are not business objects.
Their IDs and collection are absent from public management surfaces. Public
activity-timeline semantics are deferred.

## Canonical APIs

```text
GET|POST /api/tasks
GET      /api/tasks/:id
GET|POST /api/tasks/:id/sessions
GET      /api/sessions/:id
POST     /api/sessions/:id/cancel
GET      /api/sessions/:id/summary
GET      /api/runners
GET      /api/runners/:id

POST     /api/runner/register
POST     /api/runner/heartbeat
POST     /api/runner/sessions
GET      /api/runner/sessions/:id
POST     /api/runner/sessions/:id/events
POST     /api/runner/sessions/:id/result
```

The last two protocol endpoints persist internal facts and completion evidence.
Fact writes return only `{ "accepted": true }`; they do not expose public event
objects or stable event IDs.

## MCP tools

```text
mystra_create_task
mystra_list_tasks
mystra_get_task
mystra_create_session
mystra_list_sessions
mystra_get_session
mystra_cancel_session
mystra_get_session_summary
mystra_list_runners
mystra_get_runner
mystra_health
```

## Persistence

SQLite schema version 3 uses `tasks`, `sessions`, `runners`, internal
`session_events`, Projects, context bundles, and artifacts. Issue dispatch
atomically creates or reuses one Task/initial Session pair. Branch uniqueness is
enforced among active Sessions in the same Project.

Fresh databases are created directly. A precisely recognized obsolete local
development schema is destroyed and rebuilt transactionally. Unknown or mixed
schemas fail closed and retain all data. No aliases, dual reads, or data
preservation are provided.

## Execution

1. Runner enrolls with the shared registration secret and receives its stable ID
   plus a rotated bearer credential.
2. Runner heartbeats current Session assignments and available capacity.
3. Runner atomically claims an eligible queued Session.
4. Control plane returns parent Task context, Session contract, Project facts,
   and resolved runtime.
5. Runner executes sandbox, clone, Agent, test, build, preview, commit, push, and
   review delivery.
6. Terminal completion persists Session result and releases capacity in one
   transaction.

## MVP exclusions

Caller auth, logs persistence/API, retry API, callbacks, quality-fix loops,
public activity timeline, Claude CLI, Kubernetes, shared cross-Runner caches,
per-Repository secret management, hosted RDB implementation, public Team
administration, and platform orchestration above the Agent remain excluded.
