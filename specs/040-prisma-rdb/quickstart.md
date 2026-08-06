# Quickstart：开发与验收

本文件是 feature 验证入口，不替代最终根目录 `INSTALLATION.md`。

## 前置条件

```sh
fnm use 24.14.0
corepack use pnpm@10.25.0
pnpm install
```

PostgreSQL contract tests 需要可清理的 PostgreSQL test database。不得指向生产或共享 schema。

## SQLite

```sh
export MYSTRA_RDB_PROVIDER=sqlite
export MYSTRA_DB_PATH="$PWD/data/mystra.db"
pnpm db:generate
pnpm db:migrate:deploy
pnpm --filter @mystra/control-plane test
pnpm dev
```

既有 SQLite 只能通过显式 adoption command 接管：

```sh
pnpm db:adopt:sqlite -- --database "$MYSTRA_DB_PATH"
```

该命令必须先生成备份与 checksum，未知 schema 直接停止。

## Local PostgreSQL

```sh
export MYSTRA_RDB_PROVIDER=postgresql
export MYSTRA_DATABASE_URL='postgresql://mystra:mystra@127.0.0.1:5432/mystra'
export MYSTRA_DIRECT_DATABASE_URL="$MYSTRA_DATABASE_URL"
pnpm db:generate
pnpm db:migrate:deploy
pnpm test:db:postgresql
pnpm dev
```

## Supabase

从 Supabase Dashboard 的 Connect 页面复制适合 runtime 的连接字符串与 direct connection：

```sh
export MYSTRA_RDB_PROVIDER=supabase
export MYSTRA_DATABASE_URL='postgresql://...runtime-or-pooler...'
export MYSTRA_DIRECT_DATABASE_URL='postgresql://...direct:5432/postgres'
pnpm db:generate
pnpm db:migrate:deploy
pnpm dev
```

不要提交 `.env`。不要把 transaction pooler URL 传给 migration command。

## 全仓门

```sh
pnpm db:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Baseline and approval check

在生成 baseline 前，确认当前 branch 已包含：

- `IntegrationConnection` shared schema；
- `RdbProvider` 的 IntegrationConnection management methods；
- Project required `repositoryConnectionId`；
- SecretProvider-backed PAT credential reference；
- SQLite schema v5 的 `integration_connections` 与 FK/indexes；
- owner 已批准 Project stable Repository identity；Task source/objective/snapshots 已删除，Issue/Repo Info
  cache 不属于 040；Session persistence 已整体延后；完整三表 ER、其余
  字段与删除面仍需最终批准。

任一缺失时停止，不得从旧 v3 schema 生成 Prisma baseline。
