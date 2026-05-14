# Control Plane DB Provider

This module owns Mystra's `RdbProvider` boundary for the control plane.

## Rules

- Routes and MCP handlers depend on `RdbProvider`, not on SQLite APIs.
- `SqliteRdbProvider` may use `better-sqlite3`, but exported provider methods return domain types only.
- JSON columns are parsed and stringified at this boundary.
- JSON parse failures must include the field name and record id to make corrupt local state diagnosable.
- SQLite WAL mode is enabled during provider initialization.
- Runner-owned cancellation is stored as desired-state metadata plus a
  `cancellation.requested` event; it does not create a new run state.
- Runner cleanup, timeout, canceled, failed, and succeeded observations are
  stored as events plus existing terminal run states.
- Stale evaluation marks active runner-owned work `failed` with stale reason
  metadata and a `run.stale_marked` event. It does not retry, requeue, or
  reassign the work.

## Commands

```sh
pnpm --filter @mystra/control-plane test
pnpm --filter @mystra/control-plane typecheck
```

## Configuration

`getDb()` reads `MYSTRA_DB_PATH`. If unset, local development uses `./data/mystra.db`.
