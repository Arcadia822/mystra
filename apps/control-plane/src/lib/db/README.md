# Control Plane DB Provider

This module owns Mystra's async `RdbProvider` boundary and the complete first-phase business
model: `IntegrationConnection`, `Project`, `ProjectIssueSource`, and `Task`. Feature 041 additionally uses one internal
`SecretEnvelope` persistence model for authenticated ciphertext and wrapped per-secret DEKs.
PAT plaintext and the KEK never enter Prisma or RDB; `SecretProvider` owns cryptography.

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
- `ProjectIssueSource` stores the optional exact Linear connection + provider-stable Team ID.
  GitHub Issue scope remains derived from the Project repository binding; Issue rows are never persisted.
- Task is owned by Team and stores Mystra-owned title/description plus optional immutable
  Project context and an all-or-none exact Issue fingerprint. Project is nullable and does not
  own Task. Manual retries use an internal Team-scoped idempotency key; an exact Issue can have
  at most one Task even when multiple Projects bind the same source.
- The pre-0.1 Task table is replaced destructively. Legacy rows are not adopted or backfilled,
  because inventing title or exact Issue identity would corrupt the new contract.
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
