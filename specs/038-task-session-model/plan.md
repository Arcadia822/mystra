# Implementation Plan: Task / Session 业务模型迁移

**Branch**: `038-task-session-model` | **Date**: 2026-08-03 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/038-task-session-model/spec.md`

## Summary

将 Mystra 的活动业务模型一次性切换为 `Task`、`Session`、`Runner`：Task 是可独立存在且没有执行状态机的长期工作容器，Session 是 Task 下可由人或 Agent 显式创建的独立子任务/执行单元，Runner 是稳定资源。迁移复用现有 Issue intake、repository snapshot、runtime resolution、sandbox、Agent adapter、review delivery 和 SQLite provider 边界，但替换 shared contracts、RDB schema/provider、HTTP API、runner protocol、MCP、CLI、Web 与耐久文档。旧本地开发数据库仅在精确识别 legacy Mystra schema 后，在单个事务内删除已知旧表并建立新 schema；不保留 alias、双读、双写或历史数据迁移。

## Technical Context

**Language/Version**: TypeScript 5.9, Node.js 24.14.0
**Primary Dependencies**: Next.js 16 Route Handlers, React 19, Zod 4, Vitest 4, `better-sqlite3`, Node `child_process`, existing provider/adapters
**Storage**: SQLite through `RdbProvider`; schema remains dialect-neutral at the provider contract
**Testing**: Vitest unit/contract/integration tests, focused route/SQLite/runner tests, TypeScript typecheck, ESLint, Next.js build, Spec-Kit doctor/analyze
**Target Platform**: Local-first macOS/Linux control plane and outbound runner daemon; Docker single-machine sandbox path
**Project Type**: pnpm monorepo with shared TypeScript contracts, Next.js control plane (including MCP route), root operator CLI script and runner-daemon application
**Performance Goals**: Claim one eligible queued Session atomically without N+1 reads; list/detail projections remain bounded by existing local MVP load; Task detail with ten Sessions completes in one provider read path
**Constraints**: Fully breaking migration; exact legacy DB reset only; no public event/timeline contract; no retry API; no hosted RDB implementation; Runner credentials must not enter public projections
**Scale/Scope**: One local control plane, multiple stable Runners, dozens of Projects, Tasks with 0..N Sessions; broad contract migration across shared, control-plane, runner, CLI, MCP and 5xP/spec documents

## Constitution Check

*GATE: Passed before Phase 0 and re-checked after Phase 1 design.*

- **Specification owns boundaries**: PASS. `spec.md` explicitly defers activity timeline, public events, retry, callbacks, logs, workflow graphs and hosted multi-tenancy.
- **Typed service contracts**: PASS. All Task, Session, Runner, management, runner-protocol, CLI and MCP payloads use shared TypeScript/Zod schemas.
- **Replaceable providers**: PASS. The migration changes `RdbProvider` semantics but retains the provider seam and does not leak SQLite SQL into public contracts.
- **Runner isolation and secret hygiene**: PASS. Runner credentials remain internal; Session execution reuses the existing outbound runner and sandbox isolation model.
- **Verification and documentation**: PASS. The plan includes contract, persistence, route, protocol, adapter, UI, destructive-reset and terminology audit tests plus 5xP/Spec-Kit reconciliation.
- **Required amendment**: The constitution and 5xP files still name the superseded model and shell labels. They are included in the same change because the feature explicitly amends the product boundary; this is reconciliation, not an incidental scope expansion.

## Architecture

### Business ownership

```text
Project ──────── 1 ──────── * Task ──────── 1 ──────── * Session
   │                               │                         │
   │ immutable repository          │ issue/source identity   │ goal + agent + branch
   │ runtime policy                │ high-level objective     │ state + runtime + result
   │                               │ no execution state       │ optional Runner assignment
   │                               │                         │
   └──────────────────────── inherited context ──────────────┘

Runner ───── 0..capacity ───── active Session assignments
  stable identity
  internal credential + heartbeat

SessionEvent ── internal implementation record only
  no public resource, route, collection, navigation or stable product contract
```

### Canonical issue dispatch

```text
Issue dispatch request
       │ validate integration + Project + frozen Repository
       ▼
BEGIN IMMEDIATE / provider transaction
       │
       ├─ find Task by unique dispatchKey
       │      ├─ exists: validate immutable source identity
       │      └─ absent: create Task
       │
       ├─ find/create exactly one initial Session by initialDispatchKey
       ├─ append internal creation facts
       └─ commit Task + Session atomically
       ▼
return { task, session }
```

### Runner execution

```text
register stable Runner ── heartbeat ── claim queued Session atomically
                                                │
                                                ▼
                                    resolved runtime + Task context
                                                │
                                                ▼
                           sandbox → Agent → tests/build → preview/review
                                                │
                                                ▼
                            internal events + terminal Session result
```

### Destructive local schema reset

```text
open configured SQLite file
       │
       ├─ no business tables: create current schema
       ├─ exact current schema marker: verify and continue
       ├─ exact legacy Mystra table fingerprint:
       │      disable FK outside transaction → BEGIN IMMEDIATE
       │      drop only enumerated legacy child/parent tables
       │      create current schema + marker → foreign_key_check → commit
       └─ unknown/mixed schema: fail closed with actionable error
```

The reset never deletes a database file or directory. It does not use `writable_schema`, and it does not interpret a partial name match as authorization to drop tables.

## Design Decisions

1. **Task has no lifecycle state.** List/detail responses may contain `sessionCount`, `activeSessionCount` and `latestSession`, explicitly typed as projections.
2. **Session is not an execution attempt.** Explicit rerun creates a new Session with a new ID and immutable prior evidence; there is no `attempt` field.
3. **Task owns Project, Issue/source and frozen Repository.** Session owns its child objective, Agent, branch, resolved runtime, state, Runner assignment and result. Session creation cannot override Project/Repository.
4. **Runner identity is stable by unique `runnerName`.** Registration first validates the existing shared runner-registration secret, then upserts the same Runner and rotates its internal credential. A stale prior credential immediately stops authenticating.
5. **Claim is a write transaction.** Eligibility/capacity selection and assignment occur in one provider transaction to prevent two runners claiming the same Session. `SQLITE_BUSY` is surfaced as a retryable internal runner response, never as duplicate assignment.
6. **Internal facts are atomic with state changes.** Provider methods update Session state and append their corresponding internal fact in one transaction. No public timeline schema is created.
7. **Issue dispatch owns idempotency.** Task `dispatchKey` and initial Session `initialDispatchKey` are unique. Repeated identical dispatch returns the same pair; mismatched immutable content returns a stable conflict.
8. **Branch is Session-owned and must be explicit after default resolution.** Two Sessions under one Task may not silently target the same branch if both are active; a unique partial index/transactional conflict protects active branch ownership within a repository.
9. **Task creation and Session creation are separate canonical operations.** Manual Task creation may stop with zero Sessions; Issue dispatch is the only operation that atomically creates the initial pair.
10. **The public object graph stops at Runner.** Credential, lease, heartbeat samples and internal event row IDs are implementation fields, not separate managed resources.

## Implementation Phases

### Phase A: Contracts and persistence foundation

- Replace shared schemas and types with Task, Session, Runner, SessionResult, SessionState, cancellation and summary contracts.
- Define explicit API/protocol error codes such as `TASK_NOT_FOUND`, `SESSION_NOT_FOUND`, `SESSION_CANCEL_CONFLICT`, `RUNNER_NOT_FOUND` and dispatch conflict.
- Replace SQLite tables and `RdbProvider` methods; implement exact legacy fingerprint/reset and current schema marker.
- Add transaction-level invariants for Task/Session ownership, idempotent dispatch, claim, internal facts, terminal completion and stale Runner handling.

### Phase B: Canonical HTTP and integrations

- Replace management routes with `/api/tasks`, `/api/tasks/:id`, `/api/tasks/:id/sessions`, `/api/sessions/:id`, `/api/sessions/:id/cancel`, `/api/sessions/:id/summary`, `/api/runners` and `/api/runners/:id`.
- Replace internal runner routes with `/api/runner/sessions` and `/api/runner/sessions/:id/{events,result}` while retaining `/api/runner/register` and `/api/runner/heartbeat` under stable Runner semantics.
- Update GitHub/Linear Issue dispatch to return an idempotent Task/initial Session pair.
- Remove old route directories rather than leaving redirect handlers.

### Phase C: Runner, MCP, CLI and Web adapters

- Migrate runner polling/execution/result submission to Session payloads and stable `runnerId`.
- Expose MCP tools only for Task, Session, Runner and health operations.
- Expose CLI groups only as `tasks`, `sessions` and `runners`; cancellation/result/failure belong to Session.
- Rebind current Task pages to real Task responses, add child Session list/creation and Session inspection, and render stable Runner projections.
- Reconcile 025 shell labels and exploration artifacts to `New Task` and `Recent Sessions` without inventing the deferred timeline.

### Phase D: Durable naming cleanup and verification

- Update constitution, PRODUCT, PLATFORM, PROCESS/README/module docs and active specs to the new current contract; mark closed historical specs as superseded where they retain historical terminology.
- Remove old identifiers from active code, routes, tests, fixtures, scripts, package exports and generated documentation.
- Run focused tests after each slice, then full typecheck, test, lint, build, Spec-Kit doctor/analyze and an explicit terminology audit.

## Test Strategy

```text
CONTRACT
├─ Task can exist with zero Sessions
├─ Session always belongs to exactly one Task
├─ Session rejects Project/Repository override
├─ Runner public view excludes credential/internal lease
└─ old payload and command names fail validation / do not exist

PERSISTENCE
├─ fresh schema creation
├─ exact legacy schema reset succeeds
├─ unknown or mixed schema fails closed
├─ duplicate Issue dispatch returns same Task + initial Session
├─ 10 sibling Sessions remain lifecycle-independent
├─ concurrent claim yields exactly one assignment
├─ state change + internal fact commit or roll back together
├─ stable Runner re-registration rotates credential without duplicate identity
└─ stale Runner affects only its active Sessions

SURFACES
├─ HTTP Task/Session/Runner route contract tests
├─ Issue → Task → Session integration test
├─ runner protocol execution/result test
├─ MCP and CLI parity tests
├─ Web object page and empty/error state tests
└─ old routes/tools/commands return absent behavior

SYSTEM
├─ fresh DB Issue → Task → Session → Runner → Review path
├─ pnpm typecheck / test / lint / build
├─ git diff --check + Spec-Kit doctor/analyze
└─ active-surface terminology audit with explicit historical exclusions
```

## Failure Modes and Handling

| Code path | Production failure | Handling | Required test |
|---|---|---|---|
| Manual Task create | archived/missing Project | fail with typed error, no partial Task | route + provider transaction test |
| Session create | Task missing or repository snapshot malformed | fail closed, no Session/event | contract + persistence test |
| Issue dispatch | concurrent duplicate dispatch | unique key + transaction returns existing identical pair | concurrent idempotency integration test |
| Runner register | anonymous process tries to take over an existing name | require shared registration secret, upsert identity, rotate credential, reject old credential | authentication test |
| Session claim | two runners race or DB is busy | one assignment; retryable busy response | concurrency test |
| Session completion | result valid but event insert fails | full transaction rollback | fault-injection persistence test |
| Runner stale | completed Session still assigned historically | update only active state set | stale-boundary test |
| Legacy reset | unrelated/partial schema resembles Mystra | fail closed; list detected tables | destructive-safety test |
| Web list/detail | Task has no Sessions or API fails | explicit empty/error state | component/route test |

No planned path is allowed to fail silently without both error handling and a test.

## Performance and Concurrency

- Add indexes for `sessions(task_id, created_at)`, claimable Session selection, active Runner assignments, unique dispatch keys and Task/session detail lookup.
- Task list uses aggregate projections in one SQL query or a bounded secondary query, never one query per Task.
- Runner claim uses one immediate write transaction. SQLite permits only one concurrent writer, so the critical section remains short and performs no network/runtime work.
- Internal Session facts remain append-only but are not fetched by Task/Session management endpoints in this feature.
- No new cache is introduced; current local MVP scale does not justify a second source of truth.

## What Already Exists

- `RdbProvider` and `SqliteRdbProvider`: reuse the provider seam and transaction helpers; replace the business contract and schema.
- GitHub/Linear Integration and Issue snapshots: reuse resolution and read-only intake; move identity ownership to Task.
- Remote Repository snapshots: reuse immutable Project repository identity and inheritance.
- Runtime resolution, sandbox providers and Agent adapters: reuse behavior; consume Session instead of the old execution snapshot.
- Review/preview/artifact delivery: reuse evidence generation; persist it on Session.
- Current Task/Runner object pages: reuse page structure and loading/error patterns; replace data contracts.
- Existing Vitest route, provider, runner, CLI and MCP tests: rewrite fixtures and assertions rather than create a parallel suite.

## NOT in Scope

- Activity timeline, public event collection, event IDs, event retention or event detail UI, deferred by explicit user decision.
- Automatic Task decomposition, ordering, dependency graph, orchestration, retry or result aggregation, incompatible with loose one-to-many ownership.
- Hosted Postgres/Supabase provider implementation, multi-tenant auth, callbacks, logs API or quality-fix loops, outside MVP.
- Migration or export of old local Job/Run data, explicitly rejected in favor of precise rebuild.
- Redesign of the full 025 visual system, only terminology and object-contract reconciliation are included.
- New artifact distribution pipeline, this feature changes existing monorepo applications/packages and creates no new distributable artifact type.

## Project Structure

### Documentation (this feature)

```text
specs/038-task-session-model/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── http-api.md
│   ├── runner-protocol.md
│   └── mcp-cli.md
├── checklists/
│   ├── requirements.md
│   └── engineering-review.md
└── tasks.md
```

### Source Code (repository root)

```text
packages/shared/src/                 # canonical Zod/domain/protocol contracts
scripts/operator-cli.mjs             # Task/Session/Runner operator CLI adapter
apps/control-plane/src/lib/db/       # RdbProvider + SQLite implementation/migrations
apps/control-plane/src/lib/integrations/
apps/control-plane/app/api/          # management, integration, MCP and runner routes
apps/control-plane/app/tasks/        # Task list/detail
apps/control-plane/app/sessions/     # Session detail
apps/control-plane/app/runners/      # stable Runner views
apps/runner/src/                     # Session claim and execution daemon
tests and colocated *.test.ts        # contract/integration/component evidence
```

**Structure Decision**: Keep the existing monorepo and provider/adaptor boundaries. This migration introduces no new service or package; it changes the canonical types once in `@mystra/shared`, then updates each existing adapter.

## Worktree Parallelization Strategy

Sequential implementation is preferred for the foundation because all downstream work depends on shared contracts and `RdbProvider`. After Phase A is green, adapters can be split.

| Step | Modules touched | Depends on |
|---|---|---|
| A. Contracts + persistence | `packages/shared/`, `apps/control-plane/src/lib/db/` | — |
| B. HTTP + integrations | `apps/control-plane/app/api/`, `apps/control-plane/src/lib/integrations/` | A |
| C1. Runner | `apps/runner/` | A, B runner routes |
| C2. MCP + CLI | `apps/control-plane/app/api/mcp/`, `scripts/` | A, B management routes |
| C3. Web + 025 | `apps/control-plane/app/`, `specs/025-webui/` | A, B management routes |
| D. Durable docs + audit | 5xP, constitution, module docs, active specs | A-C |

- **Lane A**: contracts/persistence → HTTP/integrations, sequential because they share canonical contracts.
- **Lane B**: runner, after runner HTTP contracts exist.
- **Lane C**: MCP + CLI, after management contracts exist.
- **Lane D**: Web + 025, after management contracts exist.
- Launch B, C and D in parallel only after A/B contract freeze; merge them before the final documentation audit. Since this goal is being executed in one shared worktree without delegated agents, the actual run remains sequential to avoid cross-module contract drift.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| More than eight files change | The old business nouns are embedded in every public adapter and persistence boundary; leaving any adapter unchanged would preserve a prohibited compatibility surface | A small rename limited to UI or aliases would fail the explicit no-compatibility requirement and keep two mental models |
| Destructive schema reset | Task/Session ownership and stable Runner identity cannot be represented safely by the current jobs/runs/runner_sessions schema without retaining the rejected model | In-place data conversion adds migration logic for disposable local development data and would preserve attempt/connection semantics the user explicitly removed |

## Post-Design Constitution Re-check

PASS. The resulting design keeps the existing provider architecture, runner isolation and secret boundaries; introduces no excluded MVP capability; preserves API as canonical with CLI/MCP adapters; and explicitly schedules the required constitution/5xP amendment and full verification. No `NEEDS CLARIFICATION` remains.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|---|---|---|---:|---|---|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | — |
| Codex Review | `/codex review` | Independent second opinion | 0 | — | — |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | CLEAR | 17 findings/gaps resolved, 0 critical gaps |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | — |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | — |

**UNRESOLVED**: 0
**VERDICT**: ENG CLEARED — ready for task decomposition. Local gstack review-log/dashboard binaries were unavailable; the durable review evidence is [checklists/engineering-review.md](./checklists/engineering-review.md).
