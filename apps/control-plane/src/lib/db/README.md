# Control Plane DB Provider

This module owns Mystra's async `RdbProvider` boundary and the complete first-phase relational
model: `IntegrationConnection`, `Project`, and `Task`.

## Invariants

- Business callers depend on `RdbProvider`; Prisma, adapters, pools, URLs, and driver errors do
  not cross this directory.
- SQLite uses `@prisma/adapter-better-sqlite3`. PostgreSQL and Supabase use the same PostgreSQL
  generated client through `@prisma/adapter-pg`.
- Supabase is a deployment profile, not a second persistence API.
- All JSON objects are serialized explicitly and parsed through shared Zod contracts before
  leaving the provider.
- Project stores stable Repository identity only. Mutable repository names, URLs, issue data,
  and repository snapshots belong in provider caches, not these tables.
- Task stores six fields only. `issue_dispatch_key` provides nullable unique dispatch identity.
- Session, Runner, ContextBundle, event, artifact, and derived summary persistence are absent.
- The provider singleton caches the initialization promise, clears failed initialization, and
  awaits disconnect during reset or shutdown.
- Prisma Migrate owns schema history. Runtime startup never creates or mutates schema.

## Configuration

`MYSTRA_RDB_PROVIDER` is `sqlite` (default), `postgresql`, or `supabase`.

- SQLite: `MYSTRA_DB_PATH`.
- PostgreSQL/Supabase runtime: `MYSTRA_DATABASE_URL`.
- Migration: `MYSTRA_DIRECT_DATABASE_URL`; required for Supabase.
- Pool: `MYSTRA_DB_POOL_MAX`, `MYSTRA_DB_CONNECTION_TIMEOUT_MS`,
  `MYSTRA_DB_IDLE_TIMEOUT_MS`.

See the root [Installation guide](../../../../../INSTALLATION.md) for commands, adoption,
backup, and recovery.

## Commands

```sh
pnpm db:validate
pnpm db:generate
pnpm db:migrate:deploy
pnpm db:migrate:status
pnpm db:adopt:sqlite -- --database ./data/mystra.db --dry-run
```
