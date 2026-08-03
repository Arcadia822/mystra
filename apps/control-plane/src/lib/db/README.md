# Control Plane DB Provider

This module owns Mystra's `RdbProvider` boundary.

## Invariants

- Routes and MCP handlers depend on `RdbProvider`, never SQLite APIs.
- Task stores durable intent, Project ownership, an immutable Repository
  snapshot, and optional immutable Issue snapshot. It has no execution state.
- Session is an independently created child of exactly one Task. It owns its
  objective, Agent, branch, runtime resolution, lifecycle, cancellation, and
  review evidence. Sibling Sessions do not share lifecycle transitions.
- Runner has a stable identity. Registration by name rotates credentials while
  retaining the Runner ID; management responses expose health, capacity, and
  current Task/Session assignments only.
- Execution facts are internal persistence details. They are not exposed as a
  business collection or public identifiers.
- Issue dispatch atomically creates or reuses one Task and its initial Session
  using a unique dispatch key.
- The local schema is clean-rebuild only. Fresh schema is created directly;
  precisely recognized obsolete schemas are destroyed and rebuilt in one
  transaction; unknown or mixed schemas fail closed and preserve data.
- SQLite WAL and foreign-key enforcement are enabled during initialization.
- Terminal completion persists result, lifecycle transition, internal facts,
  and released Runner capacity transactionally.
- Stale evaluation fails active assigned Sessions without retry, requeue, or
  reassignment.

## Commands

```sh
pnpm --filter @mystra/control-plane test
pnpm --filter @mystra/control-plane typecheck
```

`getDb()` reads `MYSTRA_DB_PATH`; local development defaults to
`./data/mystra.db`.
