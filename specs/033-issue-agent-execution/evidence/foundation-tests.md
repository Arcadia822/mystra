# Foundation Test Evidence

Date: 2026-07-23

## RED

The focused control-plane run failed before implementation with the expected
contract violations:

- `jobs` lacked `issue_snapshot` and `dispatch_key`.
- persisted execution specs still emitted `version: 1`.
- Issue-driven Jobs could not persist a dispatch identity.
- the MCP response schema still imported the removed workflow projection.

## GREEN

Executed with the repository-pinned runtime:

```text
fnm exec --using 24.14.0 corepack pnpm --filter @mystra/shared test
Test Files  11 passed (11)
Tests       126 passed (126)

fnm exec --using 24.14.0 corepack pnpm --filter @mystra/control-plane exec vitest run src/lib/db/sqlite-provider.test.ts
Test Files  1 passed (1)
Tests       30 passed (30)
```

The persistence tests prove:

- a newly initialized database contains `issue_snapshot` and a unique partial
  index over non-null `dispatch_key`;
- Issue snapshot and dispatch identity survive close/reopen;
- the frozen execution artifact is version 2 and contains the same Issue;
- a duplicate dispatch fails atomically with `DISPATCH_CONFLICT`;
- removed workflow events are rejected and Job snapshots expose no workflow
  projection;
- `waiting_for_review` persists the complete handoff, emits an informational
  terminal event, and releases runner capacity.

## Disposable database contract

Mystra resolves one exact SQLite target:

1. use `MYSTRA_DB_PATH` when it is set;
2. otherwise use `<control-plane process cwd>/data/mystra.db`.

The provider executes only the current clean schema. It does not alter legacy
tables, migrate workflow history, or dual-read old records. Before any
destructive local reset, the operator must resolve and print the exact path
using the rules above, verify that it is a regular SQLite file inside the
intended project/runtime data directory, and delete only that file plus its
same-basename `-wal` and `-shm` sidecars.

No `*.db`, `*.sqlite`, or `*.sqlite3` file existed in this isolated worktree
when this evidence was recorded, so no database file was deleted.
