# Control Plane DB Provider

This module owns Mystra's `RdbProvider` boundary for the control plane.

## Rules

- Routes and MCP handlers depend on `RdbProvider`, not on SQLite APIs.
- `SqliteRdbProvider` may use `better-sqlite3`, but exported provider methods return domain types only.
- JSON columns are parsed and stringified at this boundary.
- JSON parse failures must include the field name and record id to make corrupt local state diagnosable.
- SQLite WAL mode is enabled during provider initialization.

## Commands

```sh
pnpm --filter @mystra/control-plane test
pnpm --filter @mystra/control-plane typecheck
```

## Configuration

`getDb()` reads `MYSTRA_DB_PATH`. If unset, local development uses `./data/mystra.db`.
