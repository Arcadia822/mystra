# Engineering Review：Prisma 多数据库 RDB

**Reviewed**: 2026-08-06
**Plan**: [plan.md](../plan.md)
**Status**: CLEAR，task decomposition approved

## Step 0：Scope Challenge

### What already exists

- `RdbProvider` 已经是正确的领域 seam；保留并异步化。
- `SqliteRdbProvider` 与 tests 是行为 oracle；先转为共享 contract suite，再删除实现。
- `ensureCurrentSchema` 的 fingerprint 思路可复用于显式 adoption preflight，但不继续拥有 runtime migration。
- Next.js route handlers 已为 async；内部 await propagation 不改变外部 payload。
- `main@10750ca` 已包含 039/041 的 IntegrationConnection/schema v5/SecretProvider contracts；040
  feature branch 尚未同步该稳定 baseline。

### Minimum complete scope

用户明确要求 SQLite、PostgreSQL、Supabase、切换配置和 Installation。已删除的非必要复杂度：

- 无 runtime hot switch；
- 无 SQLite-to-PG 自动搬迁；
- 无 Supabase Data API/第二套 ORM；
- 无 public multi-tenancy/RLS；
- 一个业务 provider 实现，不复制两份 CRUD。

计划会修改超过 8 个文件，但这是 35 个同步方法、27 条执行流异步化的真实 blast radius，不是新增
服务层的冲动。新增核心 class/service 限制为 provider implementation 与 client/config factory。

**Scope verdict**: 接受用户明确范围；通过分 slice 降低风险，不删减交付内容。Completeness 10/10。

## Architecture Review

### A1 [P0] 040 尚未同步稳定 main baseline，confidence 10/10

040 HEAD `712f685` 只有 schema v3；`main@10750ca` 已增加 IntegrationConnection、Project FK、
SecretProvider reference 和 schema v5。现在生成 Prisma baseline 会永久遗漏已批准合同。

**Resolution**: Owner 已批准 ER，040 已 merge `main@10750ca`；039/041 contracts 已复核。

### A2 [P1] 双 generated client 共享实现需要三层 parity，confidence 9/10

单纯把 PostgreSQL client cast 成 SQLite client 会隐藏 schema drift。计划已修订为：model section
byte parity、delegate compile-time assignability、双库 runtime contract suite。无未验证 cast。

**Resolution**: 已写入 plan。

### A3 [P1] Prisma CLI config 不得用 placeholder migration URL，confidence 9/10

clean build 需要在无 PG credentials 时 generate，但可连接的假 URL 可能让错误 migrate 命令打到本机
或错误 database。provider config 无 URL 时省略 datasource；Mystra migration wrapper 在调用 CLI 前
校验真实 direct URL。

**Resolution**: 已写入 plan。

### A4 [P1] 异步 conflict mapping 会被 Promise rejection 绕过，confidence 10/10

`apps/control-plane/src/lib/integrations/dispatch.ts` 当前在 `try` 中直接 return 同步调用。迁移为 Promise
后必须 `return await`，否则 `catch` 不会将 `DISPATCH_CONFLICT` 转成 `IntegrationFailure`。

**Resolution**: 已加入 regression test 和实施说明。

### A5 [P0] IntegrationConnection 被 repository 字段固化，confidence 10/10

当前表要求每条 connection 都持有 `repository_selection`、repository-oriented permissions 与 access
summary；这与代码中 optional `IntegrationPlugin.capabilities` 矛盾，也不能表达 Linear issue-only 或
Jenkins CI/deployment-only connection。

**Owner-approved revision**: 保留单一 provider-neutral `integration_connections`，以
Zod-validated `capabilities` JSON 保存所有 capability envelope，不建立联动表。现有 GitHub repository
fields 在 adoption 中无损合并；Project repository binding 增加 enabled `repositories` capability guard。
同时移除 Project execution defaults、ContextBundle/Runner persistence。该修订再次改变
plan/schema/API shape；最终复审未发现新的结构决策。

### A6 [P1] Project Repository snapshot 会制造 Provider 同步义务，confidence 10/10

Project 保存名称、URL、default branch、visibility 和 archive 状态后，Provider rename/delete/permission
change 都需要回写数据库，否则所谓 snapshot 只是一个悄悄腐烂的副本。

**Owner-corrected revision**: Project 只保存 connection ID + stable repository external ID；Task source、
objective 与 Issue/Repository snapshots 也已删除。040 不实现 Issue/Repo Info query、RepoProvider stable-ID
resolve 或任何 cache/TTL/invalidation。
由删除面引发的上层功能失败仅记录后续适配清单。

### A7 [P0] Session persistence 已被 owner 整体延后，confidence 10/10

此前 review 对 Session partial index、lifecycle transaction 与 Task child-Session projection 的结论已失效。
040 只保留 IntegrationConnection、Project 与 Task；Session model、字段、关系、CRUD、状态机和迁移全部
删除，受影响调用者进入后续适配清单。

**Owner-corrected revision**: 三表 schema 不启用 `partialIndexes` preview feature；不迁移 Session rows，
不为 Session 功能保留旧 SQL 或兼容表。未来 Session persistence 必须由独立规格重新设计。

### A8 [P0] Task 业务字段等待 Integration 重做，confidence 10/10

旧 review 假设 Task 继续保存 source、objective 与 Issue/Repository snapshots。Owner 已明确否决该假设：
三者全部退出 040，`dispatch_key` 按命名规范改为 `issue_dispatch_key`；当前信息未来走 cache，但 cache
本身不属于 040。

**Owner-corrected revision**: Task model 收缩为 6 个字段；adoption 只无损迁移幂等键并删除其余旧字段，
不得把 snapshots 藏入 metadata，也不得在 040 新增 cache 表或 service。

## Code Quality Review

### Q1 [P1] 禁止复制两份约 35-method provider，confidence 9/10

SQLite/PG 分别实现 CRUD 会迅速产生排序、错误和事务 drift。保持一个 `PrismaRdbProvider`，仅 client
factory/migration SQL provider-specific。

### Q2 [P1] 错误 redaction 必须先于 MCP catch，confidence 9/10

MCP 当前将 `Error.message` 返回 JSON-RPC。所有 Prisma/pg errors 必须在 DB boundary 归一化并 sanitize，
测试使用包含 password/host/query 的 synthetic cause 验证零泄漏。

### Q3 [P2] provider singleton 必须缓存 Promise，confidence 9/10

并发首次 route 请求若只缓存 resolved client，会创建多个 pg pools。`getDb()` 缓存 initialization promise；
失败清除，test reset await close。

## Test Review

```text
CONFIG
├── valid sqlite/postgresql/supabase                  [planned]
├── invalid/missing URL and pool values               [planned]
└── secret redaction                                  [planned]

MIGRATION
├── SQLite fresh + non-empty adoption + idempotency   [planned]
├── SQLite unknown/mixed/corrupt fail closed          [planned]
├── PostgreSQL fresh + repeated deploy                [planned, real DB]
└── CHECK/FK                                          [planned, both DBs]

RUNTIME CONTRACT
├── all CRUD/not-found/ordering                       [planned, both DBs]
├── capability update/Task dispatch concurrency       [planned, both DBs]
├── rollback and error normalization                  [planned, both DBs]
├── async dispatch rejection mapping                  [added regression]
├── removed Session persistence/projections           [added negative regression]
└── removed Session summary/artifactId                [added negative regression]

SURFACES
├── HTTP/MCP fixture parity                            [planned]
├── removed ContextBundle/Runner negative regression  [planned]
├── boundary import audit                             [planned]
└── Installation command walkthrough                  [planned]
```

**Coverage gaps after revision**: 0 known silent paths。外部 Supabase cloud connectivity 仍取决于 owner
credentials；缺失时必须标记为未执行，不能用 local PG 冒充。

## Performance Review

### P1 [SUPERSEDED] Task child-Session projection N+1

Session persistence 与 Task child-Session projection 已整体退出 040，因此不再新增
`listAllSessions()`。现有调用者失败只记录为后续适配项。

### P2 [P1] `pg` 默认无限 connect timeout 不适合启动失败语义，confidence 9/10

配置有限 `connectionTimeoutMillis`、有界 `max` 和 `idleTimeoutMillis`；pool 大小按实例数由
Installation 文档说明。transaction 内禁止 external network I/O。

## Failure Mode Audit

plan 的 Failure Modes 表覆盖 config、singleton、adoption、migration、client mismatch、Task dispatch、
capability update、pool timeout 和 shutdown。每条均有 planned test、error handling 与 operator-visible result。

**Critical silent gaps**: 0。

## NOT in scope

- runtime hot switch；
- SQLite-to-PostgreSQL 自动数据搬迁；
- Supabase Auth/Storage/Realtime/Data API；
- public multi-tenancy/RLS；
- 自动 provision external database；
- database admin UI；
- 无生产指标支撑的深度 pool/query tuning。

## TODO Review

仓库不存在 `TODOS.md`。本 review 没有建议把必要工作推迟为 TODO；全部必要项留在 040 plan。

## Parallelization

主体 DB/API 改造共享同一模块，顺序实施。Installation 草稿可独立进行，但最终命令验证依赖 config/
migration implementation。两 lane，1 个主体 sequential，1 个有限 parallel。

## Completion Summary

- Step 0: scope accepted as explicit owner scope，已排除非必要 hosted features。
- Architecture Review: 8 findings，all resolved/superseded in plan；0 open。
- Code Quality Review: 3 findings，all incorporated。
- Test Review: diagram produced，0 unhandled gaps。
- Performance Review: 2 findings，all incorporated。
- NOT in scope: written。
- What already exists: written。
- TODOS.md updates: 0。
- Failure modes: 0 critical silent gaps。
- Outside voice: skipped，当前 reviewer 即 Codex 且 multi-agent delegation 未获授权。
- Parallelization: 2 lanes，1 limited parallel / core sequential。
- Lake Score: 8/8 actionable recommendations use complete option。

## Verdict

**CLEAR**。最终三表模型已获 Owner 批准并同步主线；GitNexus 复审确认 `RdbProvider` 影响 95 个符号、
39 条执行流、6 个模块，属于预期 CRITICAL blast radius。计划已经把保留的三表/Integration 凭据链列为
核心验收，并把 Session/Runtime/Runner/ContextBundle/event/artifact 等批准删除面造成的失败限定为适配
清单。0 unresolved decisions，0 critical silent gaps；可生成 implementation tasks。
