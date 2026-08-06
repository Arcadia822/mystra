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

该命令必须先生成一致性备份并完成行数/外键校验，未知 schema 直接停止。

## Local PostgreSQL

```sh
export MYSTRA_RDB_PROVIDER=postgresql
export MYSTRA_DATABASE_URL='postgresql://mystra:replace-me@127.0.0.1:5432/mystra'
export MYSTRA_DIRECT_DATABASE_URL="$MYSTRA_DATABASE_URL"
pnpm db:generate
pnpm db:migrate:deploy
pnpm db:test:postgresql
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
- owner 已批准完整三表 ER：Project 只保存 stable Repository identity；Task source/objective/snapshots
  已删除；Issue/Repo Info cache 不属于 040；Session persistence 已整体延后。

任一缺失时停止，不得从旧 v3 schema 生成 Prisma baseline。

## 2026-08-06 scoped evidence

- 双 schema validate/generate：通过。
- SQLite empty migration deploy/status：通过；重复 status 显示 up to date。
- SQLite provider、配置/生命周期、schema parity、安全错误与 adoption：26 项通过。
- Root migration/Installation 静态测试：5 项通过；`@mystra/shared`：131 项测试及 typecheck 通过。
- PostgreSQL contract：4 项已实现；本机未提供 `MYSTRA_TEST_POSTGRES_URL`，明确跳过。
- Supabase：配置与 direct migration fail-closed 已验证；未提供外部 project，未执行 cloud connectivity。
- 全仓测试进入 control-plane 后有 19 项批准删除面失败；control-plane typecheck 有 179 项同类上层错误，
  核心 DB 文件为 0 项。精确分类见 `implementation-impact.md`。
- 当前 Prisma 7.9.1 schema engine 在本机迁移子进程需要 `RUST_LOG=info`；wrapper 已局部设置，详见
  `implementation-impact.md`。

实现提交（独立 worktree `/Users/arcadia/.codex/worktrees/040-prisma-rdb`，未混入主 checkout 的 UI 变更）：

- `972ccf0` `feat(db): add Prisma RDB providers`
- `e1ca418` `feat(db): adopt legacy SQLite into Prisma`
- `ba147d7` `fix(db): harden Prisma transaction boundaries`
- `062507b` `test(shared): align fixtures with Prisma contracts`
