# Implementation Impact Ledger

## Baseline

**Branch**: `038-task-session-model`
**Baseline commit**: `e094938`
**Captured**: 2026-08-03

## GitNexus pre-change impact

### `RdbProvider`

- Risk: **CRITICAL**
- Impacted symbols: 52
- Direct dependents: 6
- Execution processes affected: 23
- Modules affected: 5
- Direct dependents include `SqliteRdbProvider`, DB initialization, integration dispatch, coordination summary and the MCP route.
- Affected entry points include Project routes, Task/legacy execution routes, runner claim/events/result/register/heartbeat, Runner management, Integration dispatch, MCP and control-plane summary.

Required handling:

1. Freeze shared Task/Session/Runner contracts before changing provider consumers.
2. Migrate `RdbProvider` and `SqliteRdbProvider` as the blocking foundation.
3. Run shared/SQLite focused tests before any downstream route/adaptor migration.
4. Re-run impact for every route handler and key symbol before editing.
5. Run `gitnexus_detect_changes()` before commit and compare actual processes with this baseline.

### Shared schemas

- `jobSpecSchema`: GitNexus reported LOW/0 upstream graph edges.
- `canonicalRunSnapshotSchema`: GitNexus reported LOW/0 upstream graph edges.

This is a graph visibility limitation, not evidence of low real impact. Direct imports and fixtures are present in MCP, routes, runner daemon, UI and tests. `RdbProvider` impact plus text/LSP references is the authoritative scope.

### HTTP routes

- `/api/jobs` family: four handlers, eight indexed execution flows.
- `/api/jobs/[id]/cancel`: MEDIUM API impact with one direct Task-detail consumer and detected response-shape mismatches.
- `/api/runner/jobs` family: four handlers, 23 indexed execution flows.
- `/api/mcp`: five indexed execution flows; tool-map extraction currently reports no tool definitions because tools are constructed inline.

Required handling:

- Remove old route directories only after canonical Task/Session routes and negative absence tests exist.
- Rebind the Task detail consumer to Session cancellation/result evidence before route deletion.
- Treat MCP as a manually audited contract because the current graph does not extract its inline tool registry.

## Risk warnings communicated

- The user was warned before implementation that `RdbProvider` is CRITICAL.
- Stable Runner same-name upsert without enrollment authentication was identified as a takeover risk; the plan requires the existing shared runner-registration secret.
- Destructive database reset must fail closed on an unknown/mixed schema and must never delete the SQLite file or parent directory.

## Pre-commit detect-changes

2026-08-03 evidence:

- Refreshed the index with the MCP-compatible GitNexus 1.6.5 runtime after the
  installed 1.6.9 CLI produced a newer LadybugDB storage format.
- `gitnexus_detect_changes(scope=all)` completed with **CRITICAL** aggregate
  risk: 693 changed symbols, 152 affected symbols, 109 changed files.
- Affected flows cover the expected breaking-migration surface: Task/Session
  management routes, Issue dispatch, SQLite initialization and provider calls,
  Runner enrollment/claim/execution/completion, MCP, operator CLI, Web resource
  views, and 025 rendering helpers.
- No unrelated product execution flow was identified. Documentation-only and
  generated GitNexus context sections account for part of the high symbol count.
- `gitnexus_shape_check()` reported one `/api/projects` mismatch, but direct
  inspection showed it is a graph-attribution false positive: the same component
  reads `integrations` and `items` from two integration endpoints and reads
  `project` from `/api/projects`. The changed `/api/tasks/[id]/sessions` consumer
  has no mismatch.

The CRITICAL result is expected for replacement of the central `RdbProvider`
contract and every execution surface. It matches the pre-change blast-radius
warning and is bounded by the full typecheck/test/lint/build plus browser and
terminology evidence in `verification.md`.
