# 技术研究：Prisma 多数据库 RDB

## 结论摘要

锁定 Prisma ORM `7.9.1`。SQLite 使用 `@prisma/adapter-better-sqlite3`，PostgreSQL 与
Supabase 使用 `@prisma/adapter-pg`。Supabase 不形成第三套 ORM/provider，它是 PostgreSQL
runtime 的部署 profile。SQLite 与 PostgreSQL 必须有独立 Prisma schema/config/client 和
migration history；两者通过 schema parity gate 与同一 provider contract suite 保持一致。

## Decision 1：锁定 Prisma 7.9.1

**Decision**: `prisma`、`@prisma/client`、`@prisma/adapter-pg` 和
`@prisma/adapter-better-sqlite3` 同步锁定 `7.9.1`，不使用 range。

**Rationale**:

- npm registry 显示 7.9.1 支持 Node `>=24.0`，与仓库 Node 24.14.0 匹配。
- Prisma 7 要求生成 client 显式 `output`，并使用 driver adapter；这与本功能选择一致。
- 同版本锁定避免 CLI、generated client 和 adapter protocol 漂移。

**Alternatives considered**:

- Prisma 6：减少 v7 迁移认知，但会引入即将淘汰的 datasource URL 和连接池配置方式。
- 浮动 `^7.9.1`：升级便利，但数据库工具链不应在普通 install 时获得未经审查的行为变化。

**Sources**:

- [Prisma 7 upgrade guide](https://www.prisma.io/docs/guides/upgrade-prisma-orm/v7)
- [Prisma PostgreSQL connector](https://docs.prisma.io/docs/orm/v6/overview/databases/postgresql)

## Decision 2：使用两套 provider-specific Prisma 资产

**Decision**: 建立 `prisma/sqlite/` 与 `prisma/postgresql/` 两套 schema、config、generated
client 和 migration history。Supabase 复用 `postgresql/`。模型字段、关系、table/column map
由 parity script 比较；允许差异只存在于 datasource、generator output、migration SQL 和已记录
的 native/constraint 表达。

**Rationale**:

- Prisma 官方明确一个 Prisma schema 只能有一个 datasource，datasource provider 不是运行时
  环境变量。
- migration history 包含 `migration_lock.toml`，用于检测 provider 变更；SQLite migration SQL
  不能安全部署到 PostgreSQL。
- 两个 generated clients 是 Prisma 官方多数据库做法。Mystra 仅在内部 factory 选择其中一个，
  并保持一个 `RdbProvider` 领域实现层。

**Alternatives considered**:

- 单 schema 动态 provider：Prisma 不支持。
- 一套 migration history 手工分支 SQL：破坏 Prisma provider lock，并使 drift 检测失真。
- 完全复制两份业务 provider：会复制约 35 个方法和事务语义，维护风险高。

**Sources**:

- [Prisma data sources](https://docs.prisma.io/docs/orm/v6/prisma-schema/overview/data-sources)
- [Prisma multiple databases](https://www.prisma.io/docs/guides/database/multiple-databases)
- [Migration histories](https://www.prisma.io/docs/orm/prisma-migrate/understanding-prisma-migrate/migration-histories)

## Decision 3：Supabase 是 PostgreSQL deployment profile

**Decision**: `MYSTRA_RDB_PROVIDER=supabase` 选择 PostgreSQL Prisma client。runtime 使用
`MYSTRA_DATABASE_URL`；Prisma CLI migration 使用必填的
`MYSTRA_DIRECT_DATABASE_URL`。不使用 Supabase Data API 或 `supabase-js` 承担 RDB CRUD。

**Rationale**:

- Supabase 官方将数据库暴露为 PostgreSQL direct、session pooler 和 transaction pooler 连接。
- direct connection 适合 migration、backup 和长连接；pooler 适合应用流量。
- Supabase transaction pooler 不支持 prepared statements。Mystra 不把“必须使用 transaction
  mode”写死；Installation 文档按持久进程、IPv4-only 与短生命周期部署分别说明选择。

**Alternatives considered**:

- 单 URL 同时供 runtime/migration：在 pooler 模式下可能导致 migration lock 或 session 语义失败。
- Supabase JS/Data API：形成第二条持久化合同，无法复用 Prisma transaction 与 migration。

**Sources**:

- [Supabase connection modes](https://supabase.com/docs/guides/database/connecting-to-postgres)
- [Prisma database connections](https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/databases-connections)

## Decision 4：配置为启动时 discriminated union

**Decision**: 新增 Zod-validated `RdbConfiguration`：

```text
sqlite      -> MYSTRA_DB_PATH? (默认 ./data/mystra.db)
postgresql  -> MYSTRA_DATABASE_URL + MYSTRA_DIRECT_DATABASE_URL?
supabase    -> MYSTRA_DATABASE_URL + MYSTRA_DIRECT_DATABASE_URL (必填)
```

`MYSTRA_RDB_PROVIDER` 缺省为 `sqlite`。URL 仅接受 `postgres:`/`postgresql:`，错误输出只包含
变量名和错误类型，不打印 URL。provider 在 singleton 初始化后固定，测试通过 `resetDbForTests`
关闭 client/pool 并清理状态。

**Rationale**:

- 环境变量是现有部署合同，Zod 是仓库 service-boundary 标准。
- 启动时选择可避免一个进程内跨库状态、连接和 migration 混合。

**Alternatives considered**:

- runtime hot switch：需要 drain、缓存失效、跨库一致性和在线数据复制，完全超出当前目标。
- 自动从 URL 推断 provider：隐藏配置意图，且无法区分普通 PostgreSQL 与 Supabase 运维规则。

## Decision 5：`RdbProvider` 全面异步化

**Decision**: 所有方法返回 `Promise`，`close()` 返回 `Promise<void>`。所有 control-plane route、
MCP handler、integration dispatch 和测试显式 `await`。除已批准的遗留删除面与 Integration
capability JSON、Project execution defaults、Project Repository snapshot persistence、ContextBundle/Runner persistence 等获批删除面外，其他外部
payload、状态码和错误 code 保持不变。

**Rationale**:

- Prisma Client 和 driver adapters 是异步 API；同步 facade 无法正确封装网络 PostgreSQL。
- Next.js route handlers 已为 async，内部传播直接且可被 TypeScript 检查。

**Alternatives considered**:

- 保持同步接口并阻塞事件循环：Node 没有可接受的通用同步等待机制，且 PostgreSQL I/O 本质异步。
- 并行保留旧同步 provider：制造两套行为合同，违背接管目标。

**Evidence**: GitNexus 对 `RdbProvider` 的 upstream impact 为 CRITICAL：4 个直接依赖、27 条
执行流、5 个模块。计划必须以 contract-first 顺序迁移，并在每个 slice 保持 typecheck 可解释。

## Decision 6：一个业务实现层，两个 generated clients

**Decision**: `PrismaRdbProvider` 只实现一次领域操作。provider factory 创建正确的 generated
client/adapter，并在持久化模块内部适配为经 parity tests 证明等价的 client surface。禁止把该
内部 client surface 导出到 `RdbProvider` 或 shared packages。

**Rationale**:

- SQLite/PostgreSQL 的逻辑模型刻意使用 `String` 保存 ISO timestamp 和 serialized JSON，减少
  生成 API 差异并保持现有 payload 精确性。
- 事务、排序、domain mapping 和错误归一化只维护一份。

**Alternatives considered**:

- 两份手写 provider：直接产生行为 drift。
- 重新发明完整 repository abstraction：只是把 Prisma 包装成另一套 ORM，文件更多而保证更少。

## Decision 7：SQLite 既有数据库采用 fingerprint + backup + replacement

**Decision**: 提供显式 `db:adopt:sqlite` 流程：

1. 只读检查受支持的 `main@10750ca` schema v5 fingerprint 和 foreign keys。
2. 拒绝 open WAL，并使用 SQLite backup API 生成一致性备份。
3. 在同目录临时文件上执行已提交的 Prisma SQLite baseline migration。
4. 验证并映射获批三表数据，不把已删除字段转存到 `metadata`。
5. 核对三表行数与 foreign keys 后，以原子 rename 替换源数据库；成功后重复执行应报告已接管。

未知/混合 schema 在第 1 步停止。生产 app startup 不自动运行 adoption 或 migration。

**Rationale**:

- 旧 v5 与最终三表 schema 都需要破坏性删表/删列和字段提升；在 Prisma 初始化的临时数据库中
  显式复制获批数据，比在原文件上伪造 migration history 更容易验证和恢复。
- 分离 adoption 与 runtime 避免普通重启意外改写用户数据库。

**Alternatives considered**:

- 在 constructor 中自动迁移：连接时副作用过大，失败恢复不透明。
- 在原数据库上 `migrate resolve --applied`：不会执行所需的数据转换，也会把未实际匹配 baseline
  的 schema 标记为已应用。

**Sources**:

- [Add Prisma to existing SQLite](https://www.prisma.io/docs/prisma-orm/add-to-existing-project/sqlite)
- [Prisma Migrate](https://docs.prisma.io/docs/orm/prisma-migrate)

## Decision 8：三表 schema 使用标准约束，运行时零 raw SQL

**Decision**: IntegrationConnection、Project 与 Task 使用 Prisma 7.9.1 的标准关系、唯一性和索引表达。
Session 及其 active-branch partial unique index 整体延后，因此 040 不启用 `partialIndexes` preview
feature。domain input/output 仍由现有 Zod schemas 验证。第一期三表的所有运行时 CRUD 使用 Prisma Client API；禁止 `$queryRaw`、
`$executeRaw`、`pg.query` 和 direct `better-sqlite3` 业务查询。

**Rationale**:

- 当前三表不需要 partial index；未来 Session persistence 必须在其独立规格中重新确定 branch 并发不变量。
- CHECK constraints、SQLite pragmas 与旧库 fingerprint 可在 provider-specific migration/adoption
  tooling 中审查；它们不得进入应用请求路径。

**Sources**:

- [Prisma Migrate overview](https://docs.prisma.io/docs/orm/prisma-migrate)
- [Prisma indexes](https://www.prisma.io/docs/orm/prisma-schema/data-model/indexes)

## Decision 9：PostgreSQL pool 显式限制与关闭

**Decision**: `@prisma/adapter-pg` 配置有限 `max`、`connectionTimeoutMillis` 和
`idleTimeoutMillis`，默认值由 Mystra 配置层给出并可通过受校验环境变量调整。测试和 shutdown
调用 `$disconnect()`；Next.js dev 复用模块级 singleton。

**Rationale**:

- Prisma 7 的 pool 由 `pg` 管理，旧 `connection_limit` URL 参数不再是正确配置面。
- 默认 `pg` acquire/connect timeout 为无限等待，不适合作为失败可观察的 SaaS 默认值。

**Sources**:

- [Prisma 7 connection pool](https://docs.prisma.io/docs/orm/prisma-client/setup-and-configuration/databases-connections/connection-pool)

## Decision 10：IntegrationConnection 使用单一 capabilities JSON

**Decision**: `integration_connections` 保存 provider-neutral connection identity、auth method、
provider subject、non-secret connection config、credential reference、lifecycle 与一个经过 Zod 校验的
`capabilities` serialized JSON。每个 capability value 使用统一
`state/config/permissions/accessSummary/verifiedAt` envelope。

**Rationale**:

- 当前代码的 `IntegrationPlugin.capabilities` 已将 `repositories` 与 `issues` 定义为可选 provider；
  Linear 可以只有 issues。当前 RDB 却要求每条 connection 都有 `repository_selection`，合同相互矛盾。
- 一条 provider connection 可以同时授权 repository、issue、change request、code review、CI 与
  deployment；这些模块共享 credential，但拥有不同 scope、permissions 与可用状态。
- capability 使用可扩展 string，使新增 provider module 只需要 code contract 与 JSON key，不要求
  修改 Connection 表、增加物理列或扩充数据库 enum。
- 本期继续保留 `Project.repository_connection_id` 这一 role-specific binding；未来 issue/CI/deploy 的
  Project/Team binding cardinality 尚未定义，不提前伪造 `project_integration_bindings`。

**Alternatives considered**:

- Connection + capability 子表：能够独立查询与更新，但当前没有独立生命周期、独立 credential、
  relationship target 或高并发分模块写入需求；提前规范化增加无收益联动表。
- 为 repository/issue/CI/deploy 分别加列：每增加模块都需要 schema migration，并迫使不支持该模块的
  provider 携带无意义字段。
- 现在增加通用 `project_integration_bindings`：未来方向可能合理，但 Team/Project scope、单选/多选、
  role 与优先级尚未有产品合同，本期不凭空决定。

## Decision 11：Project 只保存稳定 Repository identity，Task snapshots 与 cache 行为延后

**Decision**: 删除 `projects.repository_snapshot`，改存 provider-defined opaque
`repository_external_id`。`repository_connection_id + repository_external_id` 是不可变 Project binding。
Repository 的名称、URL、clone URL、Provider default branch、visibility、archive/delete 状态和抓取时间
不进入 Project 表。Task 同时删除 source、objective、Issue/Repository snapshots，仅保留 identity、Project
relation、`issue_dispatch_key` 和 metadata。040 不新增 Issue/Repo Info query service、cache key、payload、
TTL、refresh 或 invalidation；这些合同等待 Linear/Issue/Repository Integration 规格。

**Rationale**:

- rename、transfer、archive、delete 和权限变化都属于 Provider 当前状态。把它们复制进 Project 会制造
  同步义务，而数据库快照又不能证明远端资源仍然存在或仍可访问。
- Project 真正需要持久化的是用户选择了哪个 connection 下的哪个 repository；stable external ID 才是
  该选择的业务事实。可读名称和 URL 不属于 040 的 RDB schema。
- Task 的来源、目标与外部对象当前信息将受 Linear/Issue Integration 设计影响，继续冻结旧字段只会把
  未完成的产品合同固化进 Prisma schema。
- 如何获取、缓存和失效当前 Issue/Repo Info 会影响 API rate limit、UI freshness、执行失败语义和 SaaS 多实例
  一致性，必须作为单独能力设计，不能伪装成删除一列的附带实现。

**Alternatives considered**:

- 继续保存完整 Project snapshot 并靠 webhook/polling 同步：为查询方便引入持续一致性负担，且仍会漏事件。
- 在 040 中实现任何 Repository cache：超出 Prisma RDB 接管范围，并提前决定单机/SaaS cache ownership。
- 在 040 中建立 repository cache 表：既扩大数据模型，又引入清理、TTL 和失效同步合同。
- 把删除的 Task snapshots 转存到 `metadata`：只是隐藏旧合同，不是删除，也会绕过类型边界。
- 以可变 `owner/name` 作为永久地址：rename/transfer 后失效，不满足用户批准的目标。

**Compatibility boundary**: 由表/字段删除造成的既有 UI、API、MCP、Runner 等功能失败只形成后续适配
清单，不在 040 内修复，也不得借此恢复旧字段、旧表或 raw SQL fallback。

## Open implementation gates

040 当前 branch 基于 commit `712f685`；稳定的 039/041 IntegrationConnection、Project
`repositoryConnectionId`、SecretProvider reference 与 schema v5 已在 `main@10750ca`。Prisma baseline
不能从旧 branch 生成。实现阶段必须先获得 owner 对三表 ER、Integration capabilities JSON、字段命名与删除面的批准，再 merge/rebase
该 main baseline；之后重跑 engineering review、tasks 与 consistency analysis。
