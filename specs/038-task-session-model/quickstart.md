# Quickstart: 验证 Task / Session 迁移

## Prerequisites

```bash
fnm install 24.14.0
fnm use 24.14.0
corepack use pnpm@10.25.0
pnpm install
```

Use a disposable, explicitly configured test database. Do not point destructive-reset tests at an arbitrary SQLite file.

## 1. Focused contract and persistence checks

```bash
pnpm vitest run packages/shared apps/control-plane/src/lib/db
```

Verify:

- Task creation succeeds without a Session.
- Ten Sessions can be added to one Task and remain independent.
- Session input cannot override Task Project/Repository.
- repeated Issue dispatch returns the same Task and initial Session.
- stable Runner re-registration preserves ID and rotates authentication.
- two concurrent claims assign a queued Session at most once.
- internal fact failure rolls back the associated state change.

## 2. Destructive-reset safety

Run focused SQLite tests covering three fixtures:

1. a fresh empty database creates the current schema;
2. an exact legacy Mystra schema is rebuilt;
3. partial or unrelated tables fail closed and retain their contents.

Confirm the implementation never deletes the database file or any parent directory and runs `foreign_key_check` after schema creation.

## 3. HTTP contract

Start the control plane with the disposable database, then verify:

```text
POST /api/tasks
GET  /api/tasks
GET  /api/tasks/:id
POST /api/tasks/:id/sessions
GET  /api/tasks/:id/sessions
GET  /api/sessions/:id
POST /api/sessions/:id/cancel
GET  /api/sessions/:id/summary
GET  /api/runners
GET  /api/runners/:id
```

Old resource routes must not exist. There are no redirects or compatibility responses.

## 4. Runner path

Register one runner, heartbeat it, create a Session and verify the internal protocol:

```text
POST /api/runner/register
POST /api/runner/heartbeat
POST /api/runner/sessions
GET  /api/runner/sessions/:id
POST /api/runner/sessions/:id/events
POST /api/runner/sessions/:id/result
```

The runner uses `runnerId`, `taskId` and `sessionId`. Management output exposes stable Runner data, never credential or connection resources.

## 5. CLI and MCP parity

```bash
pnpm operator:cli -- tasks list
pnpm operator:cli -- tasks inspect <task-id>
pnpm operator:cli -- sessions list --task <task-id>
pnpm operator:cli -- sessions inspect <session-id>
pnpm operator:cli -- sessions wait <session-id>
pnpm operator:cli -- sessions cancel <session-id>
pnpm operator:cli -- runners list
pnpm operator:cli -- runners inspect <runner-id>
```

Verify MCP provides the corresponding Task/Session/Runner operations and no old tool names.

## 6. Web behavior

- Task list and detail read real Task resources.
- A zero-Session Task has an explicit empty state.
- Task detail can create and list child Sessions.
- Session detail displays execution/review state without a public activity timeline.
- Runner detail remains stable across re-registration.
- 025 navigation reads `New Task` and `Recent Sessions`.

## 7. Full verification

```bash
pnpm typecheck
pnpm test
pnpm lint
pnpm build
sh .specify/extensions/doctor/scripts/bash/doctor.sh --json
git diff --check
```

Run the terminology audit defined in `tasks.md` against active code, packages, routes, tests, scripts and durable current-contract documents. Historical closed specs may contain superseded terminology only when clearly marked and excluded from active references.
