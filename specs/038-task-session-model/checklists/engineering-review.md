# Engineering Review: Task / Session 业务模型迁移

**Branch**: `038-task-session-model`
**Date**: 2026-08-03
**Mode**: Full review
**Result**: CLEAR, no unresolved product or engineering decisions

## Step 0: Scope Challenge

### What already exists

- `apps/control-plane/src/lib/db/rdb-provider.ts` and `sqlite-provider.ts` already centralize persistence and atomic claim/state behavior. Reuse the seam; do not build a second store.
- `packages/shared` already owns Zod schemas for control-plane, runner, CLI and MCP boundaries. Replace the canonical contract there once.
- Integration dispatch already resolves Issues, Projects and immutable Repository snapshots. Reuse the flow and move source ownership to Task.
- Runner daemon already executes the direct sandbox → Agent → test/build → preview/review path. Change its envelope from the superseded execution snapshot to Session.
- Existing object pages, CLI/MCP adapters and tests provide structures to migrate rather than parallel implementations.

### Minimum complete change

The plan touches more than eight files, which normally signals overbuilding. Here the breadth is forced by the explicit acceptance condition: no old public/persistence/adapter entry point may remain. The smallest complete version changes the canonical shared contract, `RdbProvider`/SQLite, every public/internal route, each thin adapter, current Web surfaces and durable boundary docs. It introduces no new service or package.

**Scope decision**: proceed with the broad cutover. A reduced UI-only rename or compatibility adapter would fail the user's no-compatibility decision. Activity timeline, workflow automation, retry, hosted RDB and visual redesign remain deferred.

### Search and prior-art check

- [Layer 1] SQLite's documented single-writer transaction model supports a short immediate write transaction for claim/idempotent dispatch.
- [Layer 1] SQLite documents foreign-key-sensitive `DROP TABLE`; the reset therefore controls FK handling outside the transaction and runs `foreign_key_check` afterward.
- [Layer 3] Deleting the whole file is simpler in lines of code but wrong for the actual safety boundary. Exact schema fingerprinting and allowlisted table drops are the correct first-principles boundary.
- No new artifact type or distribution pipeline is introduced.
- No repository `TODOS.md` exists, and no deferred item blocks this migration.

## 1. Architecture Review

### Finding 1: Shared persistence contract has CRITICAL blast radius

`[P0] (confidence: 10/10) apps/control-plane/src/lib/db/rdb-provider.ts — GitNexus reports 54 affected symbols, 23 execution processes and 6 modules for the RdbProvider migration.`

**Resolution**: foundation-first sequence. Shared schemas and RDB tests become green before any route/adapter work; downstream code is migrated against one frozen Task/Session contract. No dual-provider bridge.

### Finding 2: Stable Runner upsert can become identity takeover

`[P1] (confidence: 9/10) apps/control-plane/app/api/runner/register/route.ts — current registration is anonymous; same-name upsert plus credential rotation would let another process replace an existing Runner.`

**Resolution**: require the existing architecture's shared runner-registration secret for registration/re-registration, retain stable `runnerName` identity, rotate the issued operational credential, and reject the previous credential. This restores the documented enrollment boundary without adding caller auth.

### Finding 3: Task state aggregation would recreate orchestration

`[P1] (confidence: 10/10) specs/038-task-session-model/spec.md — sibling Sessions may be queued, active, failed or waiting for review independently; a single Task state has no deterministic meaning.`

**Resolution**: Task stores no lifecycle state. Counts/latest child are explicitly named projections. Cancellation, result and failure remain Session operations.

### Finding 4: Internal facts can accidentally become the deferred public timeline

`[P1] (confidence: 9/10) packages/shared/src/events.ts — the current exported event record is part of management snapshots; a direct rename would preserve events as a public business resource.`

**Resolution**: keep internal `session_events` for transactional execution facts but remove them from management schemas and routes. Runner ingestion is internal/authenticated and does not return a stable public event resource.

### Finding 5: Destructive reset could damage an unrelated SQLite file

`[P0] (confidence: 9/10) apps/control-plane/src/lib/db/migrations.ts — a permissive table-name check or file deletion would exceed the user's authorization.`

**Resolution**: accept only empty/current/exact-known-legacy fingerprints; enumerate dropped tables; fail closed on mixed/unknown schema; never delete the file/directory; verify new foreign keys before commit.

**Architecture result**: 5 issues found, all resolved in the plan.

## 2. Code Quality Review

### Finding 6: Mechanical renaming would preserve the wrong object boundaries

`[P1] (confidence: 10/10) packages/shared/src/management.ts — the current canonical snapshot nests one Job, one Run and public events, so text substitution cannot produce Task with 0..N Sessions.`

**Resolution**: define independent `TaskRecord`, `SessionRecord`, Task detail/list projections and Runner views. Remove attempt and public event arrays instead of renaming them.

### Finding 7: Source identity currently collides with the new Task identity

`[P1] (confidence: 9/10) packages/shared/src/schemas.ts — the current execution spec carries a field named as task identity inside the old Job envelope; retaining it would create two competing Task IDs.`

**Resolution**: Task ID is generated by Mystra. External Issue identity belongs to Task source/Issue snapshot and unique dispatch key. Session contains only its Task FK.

### Finding 8: Adapter-specific schemas invite drift

`[P2] (confidence: 8/10) apps/control-plane/app/api, apps/control-plane/app/api/mcp/route.ts, scripts/operator-cli.mjs — broad migration can produce three slightly different payloads if each adapter defines local objects.`

**Resolution**: all adapters import the same shared request/response schemas; parity tests validate CLI JSON and MCP payloads against management contracts.

### Finding 9: Historical documents can pollute the active terminology audit

`[P2] (confidence: 9/10) specs/ — closed specs intentionally retain historical language while active 5xP and 025 still define current shell/product terms.`

**Resolution**: audit active code/tests/scripts/current-contract docs strictly; retain historical wording only in closed artifacts marked superseded and not referenced as the current contract. Reconcile 025 and 5xP in this feature.

**Code quality result**: 4 issues found, all resolved in the plan.

## 3. Test Review

Vitest 4 is the existing framework. No prompt/LLM eval surface changes.

```text
CODE PATH COVERAGE PLAN
=======================
[+] Shared contracts
    ├── [REQUIRED ★★★] Task with zero Sessions
    ├── [REQUIRED ★★★] 0..N ownership and immutable Task FK
    ├── [REQUIRED ★★★] Project/Repository override rejected
    ├── [REQUIRED ★★★] Session terminal/result invariants
    └── [REQUIRED ★★★] Runner public projection excludes secrets

[+] SQLite provider
    ├── [REQUIRED ★★★] fresh schema
    ├── [REQUIRED ★★★] exact legacy reset
    ├── [REQUIRED ★★★] unknown/mixed schema fails without data loss
    ├── [REQUIRED ★★★] duplicate Issue dispatch returns same pair
    ├── [REQUIRED ★★★] ten sibling Sessions stay independent
    ├── [REQUIRED ★★★] concurrent claim has one winner
    ├── [REQUIRED ★★★] fact-write failure rolls back state
    ├── [REQUIRED ★★★] stable re-registration + credential rotation
    └── [REQUIRED ★★★] stale Runner touches only active assignments

[+] HTTP / integration
    ├── [REQUIRED ★★★] Task create/list/detail
    ├── [REQUIRED ★★★] Session create/list/detail/cancel/summary
    ├── [REQUIRED ★★★] Runner list/detail
    ├── [REQUIRED ★★★] Issue dispatch atomic/idempotent pair [→E2E]
    ├── [REQUIRED ★★★] invalid/archived/missing ownership errors
    └── [REQUIRED ★★★] old routes absent

[+] Runner daemon
    ├── [REQUIRED ★★★] authenticated register/heartbeat/claim
    ├── [REQUIRED ★★★] execution envelope uses Task + Session
    ├── [REQUIRED ★★★] cancellation and terminal completion
    └── [REQUIRED ★★★] sandbox → Agent → review handoff [→E2E]

[+] MCP / CLI / Web
    ├── [REQUIRED ★★★] canonical schema parity
    ├── [REQUIRED ★★★] removed commands/tools undiscoverable
    ├── [REQUIRED ★★★] zero-Session Task empty state
    ├── [REQUIRED ★★★] Session inspection error/loading/result states
    └── [REQUIRED ★★★] stable Runner re-registration projection

USER FLOW COVERAGE PLAN
=======================
[+] Create empty Task → inspect → add three distinct Sessions [→E2E]
[+] Dispatch Issue twice → same Task/initial Session [→E2E]
[+] Execute one Session → review evidence; siblings unchanged [→E2E]
[+] Re-register Runner → same visible identity, old credential rejected
[+] Open Task with no Sessions / API error → explicit recoverable UI state
[+] Request removed route/command/tool → absent, no redirect

PLANNED COVERAGE: 32/32 identified behavior/failure branches
QUALITY TARGET: all critical paths ★★★; 4 end-to-end paths
REGRESSION RULE: every rewritten existing path receives a behavior regression test
```

### Test gaps found and resolved

1. Destructive unknown-schema preservation was not explicit; added as a mandatory test.
2. Runner takeover/old-credential rejection was not explicit; added as a mandatory test.
3. State update/internal fact atomic rollback was not explicit at each terminal path; added fault-injection coverage.
4. Sibling independence at the requested scale of ten Sessions was not explicit; added provider and end-to-end assertions.
5. Removed surface behavior was not explicit across HTTP, CLI and MCP discovery; added negative contract tests.

**Test result**: coverage diagram produced, 5 gaps identified and incorporated; zero remaining critical gaps.

## 4. Performance Review

### Finding 10: Task projections can create N+1 database reads

`[P2] (confidence: 8/10) apps/control-plane/src/lib/db/sqlite-provider.ts — replacing one snapshot with Task plus child summaries can query Sessions once per Task if implemented naively.`

**Resolution**: list projections use one grouped query or one bounded secondary query. Add query-shape/performance regression coverage at representative local MVP volume.

### Finding 11: SQLite claim/dispatch transactions can hold the single writer too long

`[P1] (confidence: 9/10) apps/control-plane/src/lib/db/sqlite-provider.ts — SQLite has one concurrent writer; performing integration/network/runtime work inside the transaction can block all writes.`

**Resolution**: perform external resolution before the write boundary, keep immediate transactions to selection/validation/write/fact append, and surface busy as retryable runner behavior.

### Finding 12: Management endpoints could fetch unbounded internal facts

`[P2] (confidence: 9/10) packages/shared/src/management.ts — current snapshots include all events; carrying this forward makes Task/Session reads grow with execution duration.`

**Resolution**: management responses do not fetch/return internal facts. Timeline pagination/retention remains a future product decision.

**Performance result**: 3 issues found, all resolved in the plan.

## Failure Mode Audit

| Path | Failure | Test | Error handling | User visibility |
|---|---|---|---|---|
| Task create | missing/archived Project | yes | typed rejection, rollback | clear error |
| Session create | missing Task or invalid inheritance | yes | typed rejection, no row | clear error |
| Issue dispatch | concurrent duplicate | yes | unique key + idempotent readback | stable response/conflict |
| Runner registration | wrong enrollment secret/takeover | yes | 401/typed conflict | clear runner error |
| Claim | race/SQLite busy | yes | one winner + retryable result | runner retries |
| Completion | internal fact insert fails | yes | transaction rollback | clear retryable failure |
| Stale handling | terminal sibling selected accidentally | yes | active-state predicate | no unrelated change |
| Legacy reset | unknown schema | yes | fail closed, no drops | actionable startup error |
| Web Task detail | zero children/API error | yes | empty/error component state | explicit and recoverable |

**Critical silent gaps**: 0.

## NOT in Scope

- Activity timeline/public event API and retention, deferred by the user.
- Task workflow graph, automatic decomposition, scheduling, retry or result aggregation.
- Old data conversion/export and all compatibility aliases.
- Hosted RDB, caller auth, callbacks, logs API and quality-gate fix loops.
- Full 025 visual redesign or a new distribution artifact.

## TODO Review

No new `TODOS.md` item is proposed. The only obvious future work, public activity timeline semantics, is already explicitly recorded in `spec.md` as deferred and needs a separate future specification rather than a context-free TODO. Nothing deferred blocks the current migration.

## Parallelization Review

Four logical lanes exist after the shared foundation freezes: runner, CLI/MCP, Web/025 and durable docs. The current execution remains sequential because the user requested one goal in a shared worktree and did not request delegated agents; this avoids concurrent edits to shared contracts and generated context.

## Outside Voice

Skipped. The project-required engineering review is complete, no unresolved choice remains, and the user asked to proceed in Goal mode. No outside recommendation was silently incorporated.

## Completion Summary

- Step 0: Scope Challenge — scope accepted as-is based on the user's explicit complete-breaking-migration requirement
- Architecture Review: 5 issues found, 5 resolved
- Code Quality Review: 4 issues found, 4 resolved
- Test Review: diagram produced, 5 gaps identified and added
- Performance Review: 3 issues found, 3 resolved
- NOT in scope: written
- What already exists: written
- TODOS.md updates: 0 items proposed
- Failure modes: 0 critical gaps
- Outside voice: skipped
- Parallelization: 4 logical lanes, actual execution sequential
- Lake Score: 6/6 complete recommendations selected
- Unresolved decisions: 0

**Verdict**: CLEAR. Proceed to task decomposition and consistency analysis.
