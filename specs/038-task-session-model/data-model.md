# Data Model: Task / Session / Runner

## Relationship overview

```text
projects 1 ───── * tasks 1 ───── * sessions * ───── 0..1 runners
                         │                 │
                         │                 ├──── * session_events (internal)
                         │                 └──── * artifacts
                         └──── optional issue_snapshot + unique dispatch_key
```

Task deletion/archive behavior is not introduced. Session cannot be moved between Tasks. Runner deletion is not introduced; health is derived from its last heartbeat and configured threshold.

## Task

| Field | Type | Rules |
|---|---|---|
| `id` | UUID | generated, immutable, primary key |
| `projectId` | UUID | required FK to existing non-archived Project at creation |
| `source` | enum | `api`, `mcp`, `issue` |
| `objective` | string | required, non-empty high-level work objective |
| `issue` | IssueSnapshot? | optional; present for Issue dispatch |
| `dispatchKey` | string? | unique when present; canonical integration + issue identity |
| `repository` | RepositorySnapshot | required immutable copy from Project |
| `metadata` | JSON object | caller/product metadata, secrets forbidden |
| `createdAt` | datetime | generated |
| `updatedAt` | datetime | generated; only mutable Task fields may advance it |

### Task validation and invariants

- Task may exist with zero Sessions.
- Project and repository identity are immutable after creation.
- `source=issue` requires both `issue` and `dispatchKey`.
- Non-Issue Task creation cannot smuggle a caller clone URL or local path; repository is copied from Project after provider resolution.
- Task has no lifecycle `state`, `result`, Runner assignment, branch or runtime.
- A management projection may return `sessionCount`, `activeSessionCount` and `latestSession`, none of which are stored Task state.

## Session

| Field | Type | Rules |
|---|---|---|
| `id` | UUID | generated, immutable, primary key |
| `taskId` | UUID | required FK to Task, immutable |
| `initialDispatchKey` | string? | unique when created by Issue dispatch; absent for manual child Sessions |
| `title` | string | required child-subtask label |
| `objective` | string | required, may be narrower than Task objective |
| `agent` | enum | selected adapter, defaults from Project if omitted |
| `branch` | string | required after resolution, valid repository branch name |
| `runtimeOverride` | object? | validated only against Project override policy |
| `resolvedRuntime` | ResolvedRuntimeContract? | set before/at claim; immutable after execution begins |
| `state` | SessionState | required lifecycle state |
| `assignedRunnerId` | UUID? | FK to stable Runner; only present after claim |
| `result` | SessionResult? | terminal/review evidence |
| `failureReason` | string? | required for failed/stale failure outcomes |
| `cancellationRequest` | object? | explicit caller request metadata |
| `staleReason` | string? | set only when stale handling changes an active Session |
| `staleMarkedAt` | datetime? | paired with stale reason |
| `createdAt` / `updatedAt` | datetime | generated |
| `startedAt` / `finishedAt` | datetime? | lifecycle timestamps |

### Session states

```text
queued ──claim──> assigned ──execution──> active
  │                   │                     │
  ├─cancel─────────────┼─────────────────────┼──> canceled
  │                   │                     ├──> failed
  │                   │                     ├──> timed_out
  │                   │                     ├──> succeeded
  │                   │                     └──> waiting_for_review
  │                   └─runner stale──────────> failed (stale metadata)
  └─no automatic retry; a new explicit request creates another Session
```

Exact state names will reuse the current lifecycle meanings where valid, but every exported type and event value uses Session language.

### Session validation and invariants

- Session creation fails if Task does not exist or its frozen context is invalid.
- Input cannot contain `projectId` or `repository`; these are read through Task.
- `taskId` cannot change.
- Terminal Session records are not re-queued or overwritten.
- `result` belongs only to the Session and validates against `SessionResult`.
- State transition and its internal fact append occur in one transaction.
- A resolved runtime does not permit overrides forbidden by Project policy.
- Active branch ownership within the same repository is conflict-checked.

## Runner

| Field | Type | Rules |
|---|---|---|
| `id` | UUID | generated once, stable primary key |
| `name` | string | stable unique business name |
| `credentialHash` | string | internal only; never returned by management API |
| `capabilities` | PlatformCapabilities | validated shared schema |
| `maxConcurrency` | positive int | required |
| `eligibleProjectIds` | UUID[]? | optional allowlist |
| `eligibleRuntimeProviders` | string[]? | optional allowlist |
| `staleAfterSeconds` | positive int | health threshold |
| `lastHeartbeatAt` | datetime | updated on register/heartbeat |
| `createdAt` / `updatedAt` | datetime | generated |

### Runner projections

Public Runner output includes stable identity, capabilities, capacity, eligibility, `activeSessionCount`, health and current Task/Session references. It excludes raw credential/token, credential hash, internal lease and heartbeat samples.

### Runner invariants

- Registration first validates the shared runner-registration secret; re-registering the same name then updates the same ID.
- Registration rotates the credential atomically; the prior credential no longer authenticates.
- Heartbeat authenticates and updates the same Runner.
- Claim refuses when active assignments reach capacity or eligibility does not match.
- Stale processing modifies only Sessions assigned to that Runner in active states.

## SessionEvent (internal)

| Field | Type | Rules |
|---|---|---|
| `id` | integer/UUID | internal row identity; not a public contract |
| `sessionId` | UUID | required FK to Session |
| `type` | internal enum/string | Session/execution fact vocabulary |
| `severity` | enum | debug/info/warn/error |
| `data` | JSON object | structured fact data, no raw secret/log persistence |
| `createdAt` | datetime | generated |

- No management list/detail route returns SessionEvent rows in this feature.
- Runner event ingestion is an authenticated internal protocol operation.
- Retention, stable event IDs and timeline projection are deliberately undefined.

## SessionResult

`SessionResult` is the renamed and reconciled review handoff contract. It retains tested artifact, preview, branch/commit and pull-request evidence that the existing delivery path already produces. It has no Task-level aggregation and no event collection.

## Database constraints and indexes

- `tasks(project_id)` FK and index.
- unique non-null `tasks(dispatch_key)`.
- `sessions(task_id)` FK and `(task_id, created_at)` index.
- unique non-null `sessions(initial_dispatch_key)`.
- claim index over state/created time and eligibility lookup inputs.
- `sessions(assigned_runner_id, state)` index for capacity/health processing.
- active branch conflict constraint enforced transactionally and, where SQLite predicate semantics permit, by a partial unique index using repository identity + branch for active states.
- `session_events(session_id, created_at)` FK/index.
- artifacts reference Session and may denormalize Task ID only if existing query requirements prove it useful; Session FK remains authoritative.

## Legacy reset recognition

The reset accepts only:

1. an empty/new database with no Mystra business tables;
2. the exact current schema marker/version; or
3. the exact known legacy fingerprint containing the expected tables and required identifying columns.

Any partial, mixed or unknown schema fails closed. The implementation drops only an explicit child-to-parent list of known legacy tables and immediately creates the current schema in the same controlled reset operation.
