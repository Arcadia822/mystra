# Control Plane DB Provider

This module owns Mystra's `RdbProvider` boundary for the control plane.

## Rules

- Routes and MCP handlers depend on `RdbProvider`, not on SQLite APIs.
- `SqliteRdbProvider` may use `better-sqlite3`, but exported provider methods return domain types only.
- JSON columns are parsed and stringified at this boundary.
- JSON parse failures must include the field name and record id to make corrupt local state diagnosable.
- Issue-driven jobs persist an immutable normalized `issue_snapshot` and a
  unique `dispatch_key`; provider-native payloads and credentials never enter
  the database.
- Projects persist one provider-resolved `repository_snapshot`. Job creation
  freezes that snapshot; later Project changes cannot mutate an existing Job.
- Public Project requests never persist selectors, paths, or arbitrary clone
  URLs. Resolution completes before the atomic create/update call.
- The active local schema is clean-rebuild only. Historical orchestration rows
  are not migrated or dual-read. A legacy Project/Job `repo` schema is removed
  and rebuilt once at startup; no historical repository data is retained.
- SQLite WAL mode is enabled during provider initialization.
- Runner-owned cancellation is stored as desired-state metadata plus a
  `cancellation.requested` event; it does not create a new run state.
- Runner cleanup, timeout, canceled, failed, succeeded, and
  `waiting_for_review` observations are
  stored as events plus existing terminal run states.
- `waiting_for_review` releases runner capacity, has no failure reason, and
  stores the structured Issue, quality, preview, sandbox, Agent, commit, and PR
  handoff in the canonical Run result.
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
