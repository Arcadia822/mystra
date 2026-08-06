# Implementation Plan: Prisma 多数据库 RDB

**Branch**: `040-prisma-rdb` | **Date**: 2026-08-06 | **Spec**: [spec.md](./spec.md)
**Input**: Prisma 接管 SQLite/PostgreSQL，Supabase 作为 PostgreSQL deployment profile，增加
启动切换配置与根目录 Installation 文档。

## Summary

将 control-plane 的同步、手写 `better-sqlite3` persistence 替换为 Prisma 7.9.1。SQLite 和
PostgreSQL 使用独立 Prisma schema/config/generated client/migration history；Supabase 复用
PostgreSQL 资产，通过 pooled runtime URL 与 direct migration URL 配置。现有 `RdbProvider`
领域方法全面异步化，所有内部调用者显式 `await`。除明确删除 Session persistence、event-derived
Session summary、`artifactId`、Project execution defaults、Project Repository snapshot persistence、ContextBundle/Runner persistence，并修订
IntegrationConnection capability payload 外，未删除的外部 payload 不变。

实现前强制同步 `main@10750ca` 中 039/041 的最终 IntegrationConnection、Project 与 SecretProvider
contracts。SQLite 既有数据库
通过显式 fingerprint + backup + Prisma baseline adoption 接管；生产应用启动不隐式运行迁移。

## Technical Context

**Language/Version**: TypeScript 5.9，Node.js 24.14.0
**Primary Dependencies**: Prisma ORM/Client 7.9.1，`@prisma/adapter-better-sqlite3` 7.9.1，`@prisma/adapter-pg` 7.9.1，`pg`，Zod 4，Next.js 16
**Storage**: SQLite；PostgreSQL；Supabase-backed PostgreSQL
**Testing**: Vitest 4，provider contract suite，SQLite adoption fixtures，真实 PostgreSQL integration database
**Target Platform**: local macOS/Linux development，Node.js control-plane container/VM，Supabase network endpoint
**Project Type**: pnpm monorepo，Next.js web service + MCP/CLI clients；Session/Runner persistence integration deferred
**Performance Goals**: provider change不增加 N+1；PostgreSQL pool 有界；Task dispatch 维持原子性；常规单记录操作不超过现有查询数量级
**Constraints**: 除已批准合同修订外 payload 不变；Prisma/driver types 不越界；SQLite 三张候选表获批字段无损，backfill connection capabilities JSON，并将 Project snapshot 的 stable external ID 提升为列；未知 schema fail closed；owner ER approval 与 main baseline sync 必须先完成
**Scale/Scope**: 3 张业务表；移除 Session、event/summary/artifact、ContextBundle/Runner persistence、Project execution defaults 和 Project Repository snapshot；Repo Info 获取/缓存不在本功能；三种启动 profiles

## Constitution Check

### Pre-research gate

- **I. Specification Owns Product Boundaries**: PASS。constitution 2.3.0 已在 2026-08-06 显式批准 PostgreSQL 与 Supabase-backed PostgreSQL，同时继续排除 public multi-tenancy。
- **II. Typed Contracts**: PASS。配置由内部 Zod discriminated union 校验；domain objects 保持 `@mystra/shared`。
- **III. Replaceable Providers**: PASS。保留 `RdbProvider`；Supabase 不成为第二条 Data API persistence path。
- **IV. Secret Hygiene**: PASS。URL 只从环境注入，错误和日志必须 sanitize。
- **V. Verification/Documentation**: PASS。计划包含双 provider contract suite、migration/adoption evidence、`INSTALLATION.md` 和 module docs。

### Post-design gate

PASS with two hard gates：owner 尚未批准 ER；040 当前 HEAD 尚未同步已落在
`main@10750ca` 的 039/041 persistence/shared-contract changes。baseline generation 与代码
implementation 在两项解决前不得开始。

## Architecture

### Startup and runtime data flow

```text
process.env
    │
    ▼
parseRdbConfiguration() ──invalid──> sanitized startup error, no connection
    │
    ├── sqlite ─────> SQLite generated client ─> BetterSqlite3 adapter ─> .db file
    │
    ├── postgresql ─> PG generated client ─────> PrismaPg / pg pool ───> PostgreSQL
    │
    └── supabase ───> PG generated client ─────> PrismaPg / pooler ────> Supabase PG
                              │
                              ▼
                     PrismaRdbProvider
                              │
                              ▼
                  Promise<RdbProvider domain types>
                              │
                    API / MCP / Integration
```

`getDb()` 缓存初始化 promise，而不是只缓存 resolved instance，防止并发 route 首次访问创建多个
PostgreSQL pools。初始化失败清除 cache；`resetDbForTests()` await disconnect 后清除。

### Migration flow

```text
MYSTRA_RDB_PROVIDER
    │
    ├── sqlite ─────> prisma/sqlite/prisma.config.ts
    │                   ├── fresh: migrate deploy
    │                   └── existing: fingerprint -> backup -> resolve baseline -> deploy -> verify
    │
    └── postgresql/supabase
                        └── prisma/postgresql/prisma.config.ts
                              └── DIRECT URL -> migrate deploy -> verify
```

runtime URL 永不被 Prisma CLI 隐式选作 Supabase migration connection。CLI config 显式选择 direct
URL；普通 PostgreSQL 缺省允许 direct=runtime。

Provider-specific `prisma.config.ts` 在连接 URL 不存在时省略 `datasource`，使 `prisma generate`
可以在无数据库的 clean install/build 中运行。所有 migrate/status/resolve 命令通过 Mystra wrapper
先校验真实 URL，再传入 `--config`；不设置“看起来能用”的 placeholder URL。

### Persistence implementation

`PrismaRdbProvider` 只实现一份 domain CRUD、mapping、transactions 和 error normalization。
SQLite/PG factory 注入对应 generated client。因为 Prisma schema 只能有一个 datasource，两套 generated
client 必须存在；其共同 delegate surface 只在 DB module 内使用，并由三层门证明等价：两份 schema
的 model section 逐字 parity、PostgreSQL generated delegates 对 SQLite internal client surface 的
compile-time assignability、同一 runtime provider contract suite 在两库通过。禁止无校验 `as unknown as`。

关键 transaction 用 Prisma interactive transaction。Issue dispatch 不依赖“先读后写”的乐观幻想：

```text
resolve Issue + dispatch key
    │
    ▼
upsert Task in one transaction
    │
    ├── same key/same input -> return existing Task
    └── same key/conflicting input -> stable conflict
```

dispatch 使用 transaction、unique constraint normalization 与必要的 Prisma `P2034` 有界重试。
运行时业务路径禁止 provider-local raw query。

## Project Structure

### Documentation (this feature)

```text
specs/040-prisma-rdb/
├── spec.md
├── features.md
├── checklists.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── rdb-configuration.md
│   └── rdb-provider.md
└── tasks.md
```

### Source Code (repository root)

```text
INSTALLATION.md
README.md
package.json
pnpm-lock.yaml

apps/control-plane/
├── package.json
├── prisma/
│   ├── sqlite/
│   │   ├── schema.prisma
│   │   ├── prisma.config.ts
│   │   └── migrations/
│   └── postgresql/
│       ├── schema.prisma
│       ├── prisma.config.ts
│       └── migrations/
├── scripts/
│   ├── adopt-sqlite.ts
│   ├── check-prisma-parity.ts
│   └── verify-database.ts
├── src/generated/prisma/
│   ├── sqlite/
│   └── postgresql/
├── src/lib/db/
│   ├── config.ts
│   ├── config.test.ts
│   ├── client-factory.ts
│   ├── index.ts
│   ├── prisma-provider.ts
│   ├── provider-contract.test.ts
│   ├── sqlite-adoption.test.ts
│   ├── rdb-provider.ts
│   └── README.md
└── app/api/**/route.ts
```

Generated client output由 `pnpm db:generate` 创建并纳入 build 前置门；是否提交 generated source 在
implementation 前按仓库 build/deploy可重复性验证决定，默认不提交并由 `postinstall/prebuild` 生成。

**Structure Decision**: 保持所有 ORM 和 driver imports 在 control-plane DB module 与 migration
scripts。不开新 workspace package，不建立第二个 repository abstraction。两个 Prisma asset trees 是
Prisma datasource/migration 限制导致的必要复杂度。

## Implementation Phases

### Phase 0：冻结 baseline 与工具链

1. owner 批准 ER 后，将 `main@10750ca` merge/rebase 到 040；再次审计 039/041 的
   IntegrationConnection、Project FK、SecretProvider ref 与 schema v5。
2. 锁定 Prisma/adapter/pg 版本与 pnpm lockfile。
3. 建立 SQLite/PostgreSQL schema、provider-specific config、generated outputs 和 parity script。
4. 从最终 3 表模型生成并审查两套 baseline migrations；SQLite adoption 将现有 connection 的
   repository fields 无损 backfill 到 `capabilities.repositories`，并将每个 Project
   `repository_snapshot.externalId` 提升为 `repository_external_id` 后删除 Project snapshot；缺失或无效
   external ID 时 fail closed。Task adoption 将 `dispatch_key` 改名为 `issue_dispatch_key`，删除 source、
   objective 与 Issue/Repository snapshots，不把它们转存到 metadata。Session 表及其 branch partial index 不进入新 schema；CHECK/FK actions
   在 provider-specific migration 中验证。

Verification: Prisma validate/generate、parity check、migration SQL review、空库 replay。

### Phase 1：先异步化 contract，再替换实现

1. `RdbProvider` 全方法变为 `Promise`。
2. 删除 Session persistence、Task child-Session projection 与 event-derived Session coordination summary
   surface，并把受影响调用者记入后续适配清单。
3. 对保留的 route/MCP/integration/test 迁移 `await`，保持现有 SQLite provider 暂时以 async wrapper 实现。
   `dispatchIssue()` 必须在 `try` 内 `return await db.dispatchIssue(...)`，确保 rejection 被现有 conflict
   normalization 捕获。
4. 运行可执行的 scoped typecheck/test 并生成受影响功能适配清单；批准删除面造成的全仓失败不在本期修复。

这是“make the change easy” slice。它不同时改变查询实现，避免结构变更和 ORM 行为变更互相掩护。

### Phase 2：Prisma provider 与事务

1. 实现 domain/model mappers、统一错误归一化和 provider lifecycle。
2. 依功能群迁移 IntegrationConnection、Project、Task；不建立 capability 子表、Session、ContextBundle、
   Runner、SessionEvent 或 Artifact model。
3. 将 Project 的完整 snapshot 映射改为 stable `repositoryExternalId`，不在本期新增 RepoProvider 方法、
   Repo Info query service 或 cache。
4. 为 capabilities 原子更新与 Task dispatch 建立 transaction/竞争测试。
5. 上述三表所有业务 CRUD 只用 Prisma Client API；静态审计禁止运行时 raw SQL。

Verification: shared provider contract suite 先 SQLite，后真实 PostgreSQL。

### Phase 3：配置、迁移和 Supabase profile

1. 实现 `RdbConfiguration` Zod union 与 sanitized errors。
2. `getDb()` 改为 async singleton promise factory，支持三种 provider profile。
3. 实现 SQLite adoption command 和 verify command。
4. 增加 provider-specific generate/migrate/deploy/drift/test scripts。
5. 使用 local PostgreSQL 验证 PG/Supabase protocol path；若有 Supabase credentials，执行 cloud smoke。

### Phase 4：删除旧 owner 与文档

1. 删除 `sqlite-provider.ts`、`migrations.ts` 和不再使用的手写 CRUD/schema version tests。
2. 保留 `better-sqlite3` 仅作为 Prisma adapter/adoption verifier 所需依赖，不允许业务代码 direct import。
3. 创建 `INSTALLATION.md`，更新 README、PLATFORM、PRODUCT、AGENTS、DB module README 与相关旧 docs。
4. 运行静态 boundary audit、focused/full tests、typecheck、lint、build、migration replay。

全仓命令仍用于收集证据，但批准删除面导致的失败只记录到后续适配清单，不阻断 040 数据层交付。
这不是允许保留旧 schema 或旧 SQL 的委婉表达；旧 owner 必须删除。

## What Already Exists

| Existing surface | Reuse decision |
|---|---|
| `RdbProvider` domain contract | 保留并异步化，不新建 parallel port |
| `SqliteRdbProvider` 约 35 个行为及测试 | 作为行为 baseline 和 contract fixture 来源，最终实现删除 |
| `ensureCurrentSchema` fingerprints | 转换为显式 adoption preflight，不在 app startup 继续拥有 migration |
| shared Zod domain schemas | 继续作为 input/output validation owner |
| Next.js async route handlers | 直接传播 `await`，不改变 HTTP contract |
| `resetDbForTests()` | 扩展为 async disconnect/reset lifecycle |
| Session persistence 与 Task child-Session projection | 整体退出 040；受影响调用者进入后续适配清单 |
| event-derived Session summary | 删除 route/MCP/provider/shared projection，不迁移为字段 |
| IntegrationPlugin optional capabilities | 保留该抽象并扩展；持久化从 repository-specific 顶层列收敛为 Connection.capabilities JSON |
| Project/Task snapshots | Project 只提升 stable external ID；Task 删除 Issue/Repository snapshots、source 与 objective；cache 设计延后 |
| 039/041 main baseline | 必须吸收，不能从旧 v3 schema重建 |

## NOT in Scope

- runtime hot database switching：需要 drain、缓存一致性和跨库复制，非本需求。
- SQLite -> PostgreSQL 自动数据迁移：本功能只接管既有 SQLite 和初始化 PG。
- Supabase Auth/Storage/Realtime/Data API：与 RDB provider 无关。
- public Team multi-tenancy/RLS：数据库可 hosted 不等于产品已具备 tenancy contract。
- 自动创建 Supabase/PostgreSQL infrastructure：Installation 只连接用户提供的数据库。
- database admin UI/Prisma Studio product surface：无用户需求且扩大秘密与权限面。
- Issue/Repo Info query、provider re-resolution、cache key/payload/TTL/refresh/invalidation 与相关 UI/执行适配：另立 Integration 规格。
- Session persistence、字段、关系、状态机、CRUD、迁移与上层适配：后续另立规格重新设计。
- 修复由批准删除的表/字段造成的既有上层功能报错：记录适配清单，后续按新设计恢复，不在 040 伪造兼容层。
- provider-specific性能调优 beyond bounded pool/critical indexes：需实际负载数据后单独处理。

## Failure Modes and Controls

| Path | Production failure | Test | Handling | Operator visibility |
|---|---|---|---|---|
| config parse | URL/pool missing or invalid | config matrix | fail before connect, sanitize | clear variable-level error |
| provider singleton | concurrent first requests create multiple pools | concurrency unit | cache initialization promise | startup error once |
| SQLite adoption | unknown schema or interrupted backup | fingerprint/failure fixtures | fail closed, checksum backup | exact failed phase |
| migration deploy | pooled URL/session lock failure | config + local PG integration | use direct URL only | Prisma migration error, no secret echo |
| client/schema mismatch | wrong generated client loaded | parity/generate tests | provider-tag assertion at factory | startup error |
| dispatch | duplicate key race | concurrent contract test | transaction + unique conflict normalization | stable conflict/idempotent result |
| dispatch async catch | rejected Promise 跳过 conflict mapping | route/integration regression | `return await` inside try | stable IntegrationFailure |
| capability update | invalid or lost whole-object write | SQLite/PG concurrency test | single owner + whole-object Zod validation/atomic update | valid complete envelope or rollback |
| pool exhaustion | no free PG connection | timeout integration test | finite timeout, bounded pool | sanitized database unavailable error |
| shutdown/test reset | pool remains open | lifecycle test | `$disconnect()` and await reset | no hanging test/process |

No listed path is allowed to fail silently without test and error handling.

## Test Strategy

```text
CONFIG
├── sqlite default/path                    [unit]
├── postgresql runtime/direct fallback     [unit]
├── supabase runtime+required direct       [unit]
└── invalid provider/URL/pool + redaction  [unit]

SCHEMA / MIGRATION
├── SQLite fresh replay                    [integration]
├── SQLite v5 non-empty adoption           [integration]
├── unknown/mixed/corrupt fail closed      [integration]
├── PostgreSQL fresh replay + redeploy     [real DB integration]
├── schema parity/allowed dialect diff     [static + generated client]
└── CHECK/FK verification                  [real DB integration]

RDB PROVIDER CONTRACT (same assertions)
├── Project + IntegrationConnection JSON       [SQLite + PG]
├── Project stable repository identity         [SQLite + PG]
├── repository capability binding guard    [SQLite + PG]
├── dispatch idempotency/conflict          [SQLite + PG, concurrent]
└── ordering/not-found/error normalization [SQLite + PG]

SURFACES
├── route fixture regression               [Next route integration]
├── MCP tool fixture regression            [MCP integration]
├── removed ContextBundle/Runner surfaces  [negative regression]
├── async dispatch rejection normalization [integration regression]
├── removed Session persistence/projections [route/MCP/shared negative regression]
├── removed Session summary/artifact ID     [route/MCP/shared negative regression]
└── boundary import audit                  [static]

DEFERRED COMPATIBILITY
└── approved-removal failures inventory    [full commands, non-blocking for 040]

DOCUMENTATION
├── SQLite clean install                    [command walkthrough]
├── local PostgreSQL clean install         [command walkthrough]
└── Supabase configuration/connectivity    [config; cloud smoke if credentials]
```

## Performance and Capacity

- Preserve existing select ordering and avoid per-row follow-up queries；保留的三表 summary/list 使用
  batched reads 或 explicit relations。
- `pg` pool default：`max=10`、connect timeout 5s、idle timeout 10s；允许 validated env override。
- Supabase operators must budget `pool max × app instances` against project connection limits。
- Interactive transactions保持短小；不在 transaction 内进行 external GitHub/Linear/network calls。
- Concurrent Task dispatch retry 有界，不允许无限 spin。

## Security

- URLs only from environment；不保存、不打印、不序列化到 Sentry context。
- error sanitizer 处理 Prisma/pg messages 中可能包含的 host/user/database details。
- Supabase service role key不是数据库连接所需，不在 Installation 中要求。
- migration role需要 DDL 权限；runtime role最小权限方向记录，但 role provisioning 不自动化。

## Parallelization Strategy

由于 contract async migration、Prisma provider 和 route changes 共享 `apps/control-plane` DB/API
核心，主体按顺序实施。文档可在 baseline/config 稳定后独立编写，但最终命令验证依赖代码。

| Step | Modules touched | Depends on |
|---|---|---|
| A baseline/schema | control-plane/prisma, db contracts | owner ER approval + main sync |
| B async contract | control-plane/db, api, integrations, tests | A contract shape |
| C Prisma provider | control-plane/db, prisma, tests | A + B |
| D config/migration scripts | control-plane/db, scripts, prisma | A + C lifecycle |
| E Installation/docs | root docs, DB README | D commands/config |

Lane A: baseline → async contract → provider → config/migrations（sequential，共享 DB module）
Lane B: Installation draft（可在 D 稳定前并行，但最终 verification 等待 D）

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| 修改超过 8 个文件 | 同步 `RdbProvider` 有 27 条 execution flows；异步 I/O 必须传播到所有调用者 | 保持同步无法支持 PostgreSQL；并行旧/新接口会增加更多状态 |
| 两套 Prisma asset trees | Prisma schema 只能有一个 datasource，migration history provider-locked | 动态 provider/共享 SQL history 不受 Prisma 支持 |
| migration/adoption scripts | 既有 SQLite 要无损且未知 schema fail closed | constructor 自动迁移风险更大且不可恢复 |

新增核心 class/service 控制为两个：`PrismaRdbProvider` 与 provider client factory/config boundary。
其余均为 scripts、generated assets 或现有模块改造。

## Implementation Gate

**当前状态：CLOSED。** 解除条件：

1. owner 批准 `data-model.md` 中的 ER、字段改名与移除面；
2. 040 merge/rebase `main@10750ca` 后确认 schema v5 + 039/041 contracts；
3. 重新运行 GitNexus analyze/impact；
4. plan-eng-review 通过；
5. `/speckit.tasks` 与 `/speckit.analyze` 完成。

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|---|---|---|---:|---|---|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | — |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | — | 当前 reviewer 即 Codex，未启动未授权 sub-agent |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | RE_REVIEW_REQUIRED | Session 整表退出后的三表 ER 使旧 verdict 失效 |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | N/A | backend-only feature |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | Installation/quickstart 已纳入 eng review |

**UNRESOLVED:** 2，owner ER approval 与 main baseline sync。
**VERDICT:** design ready for owner ER review；implementation gate remains closed。
