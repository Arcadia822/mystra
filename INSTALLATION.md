# Installation

Mystra requires Node.js `24.14.0`, pnpm `10.25.0`, and one relational database.
The supported RDB profiles are SQLite, PostgreSQL, and Supabase-backed PostgreSQL.
All three use Prisma ORM; Supabase does not use its Data API for relational CRUD.

## 1. Install the toolchain

```sh
fnm install 24.14.0
fnm use 24.14.0
corepack enable
corepack use pnpm@10.25.0
pnpm install
pnpm db:validate
pnpm db:generate
```

Copy `.env.example` to your local environment file or inject the same variables through
your process manager. Never commit database URLs or credentials.

## 2. SQLite

SQLite is the default and requires no external database server.

```sh
export MYSTRA_RDB_PROVIDER=sqlite
export MYSTRA_DB_PATH="$PWD/data/mystra.db"
pnpm db:migrate:deploy
pnpm db:migrate:status
pnpm dev:control-plane
```

### Upgrade an existing schema v5 database

Stop every Mystra process first. Preview the conversion, then run it explicitly:

```sh
pnpm db:adopt:sqlite -- --database "$MYSTRA_DB_PATH" --dry-run
pnpm db:adopt:sqlite -- --database "$MYSTRA_DB_PATH"
pnpm db:migrate:status
```

The adoption command accepts only an exact schema v5 fingerprint. It validates all retained
rows before writing, creates a consistent `*.prisma-v5-backup-*.db`, initializes a temporary
database from the committed Prisma migration, converts only `integration_connections`,
`projects`, and `tasks`, verifies counts and foreign keys, then atomically replaces the source.
Unknown, mixed, open-WAL, corrupt, or unmappable databases are rejected.

To recover, stop Mystra, preserve the failed database for diagnosis, and copy the reported
backup file back to the configured `MYSTRA_DB_PATH`. Adoption is idempotent after success.

## 3. Local PostgreSQL

Create an empty database and a role that can create tables, indexes, foreign keys, and Prisma's
migration history table. Runtime and migrations may use the same direct URL for a local install.

```sh
export MYSTRA_RDB_PROVIDER=postgresql
export MYSTRA_DATABASE_URL='postgresql://mystra:replace-me@127.0.0.1:5432/mystra'
export MYSTRA_DIRECT_DATABASE_URL="$MYSTRA_DATABASE_URL"
export MYSTRA_DB_POOL_MAX=10
export MYSTRA_DB_CONNECTION_TIMEOUT_MS=5000
export MYSTRA_DB_IDLE_TIMEOUT_MS=10000

pnpm db:migrate:deploy
pnpm db:migrate:status
MYSTRA_TEST_POSTGRES_URL="$MYSTRA_DIRECT_DATABASE_URL" pnpm db:test:postgresql
pnpm dev:control-plane
```

`MYSTRA_DB_POOL_MAX` is per application process. Budget the product of pool size and process
count against the database connection limit.

## 4. Supabase-backed PostgreSQL

Supabase reuses the PostgreSQL Prisma client and migrations. Configure two database URLs:

- `MYSTRA_DATABASE_URL`: runtime direct/session-pooler/transaction-pooler URL selected for the deployment.
- `MYSTRA_DIRECT_DATABASE_URL`: direct database URL used only by Prisma migration commands.

```sh
export MYSTRA_RDB_PROVIDER=supabase
export MYSTRA_DATABASE_URL='postgresql://runtime-user:replace-me@pooler.example:6543/postgres'
export MYSTRA_DIRECT_DATABASE_URL='postgresql://direct-user:replace-me@db.example:5432/postgres'
export MYSTRA_DB_POOL_MAX=10

pnpm db:migrate:deploy
pnpm db:migrate:status
pnpm dev:control-plane
```

The migration wrapper refuses a Supabase profile without an explicit direct URL. A Supabase
service-role key is not a database credential and is not required by Prisma. Check the selected
endpoint's IPv4/IPv6 reachability and TLS requirements from the actual deployment network.

## 5. Migration and upgrade rules

- Development schema changes use `pnpm db:migrate:dev`; production uses only
  `pnpm db:migrate:deploy`.
- Run `pnpm db:validate && pnpm db:generate` after checkout and after every schema change.
- Back up production data before deploy. Do not edit an already-applied migration.
- PostgreSQL and Supabase share `apps/control-plane/prisma/postgresql/migrations/`.
- Runtime reads `MYSTRA_DATABASE_URL`; migration commands read the direct URL contract above.

## 6. Persistence smoke check

```sh
pnpm db:validate
pnpm db:generate
pnpm --filter @mystra/control-plane exec vitest run \
  src/lib/db/prisma-provider.sqlite.test.ts \
  src/lib/db/rdb-config.test.ts \
  src/lib/db/index.test.ts \
  src/lib/db/sqlite-adoption.test.ts
```

The PostgreSQL contract test intentionally skips when `MYSTRA_TEST_POSTGRES_URL` is absent.
Do not point that variable at production or a shared schema.
