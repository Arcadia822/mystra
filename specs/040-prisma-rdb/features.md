# 功能说明：Prisma 多数据库 RDB

## 摘要

Prisma 成为 Mystra SQLite 与 PostgreSQL 持久化的 schema、migration、类型生成和运行时访问
所有者。Supabase 作为 PostgreSQL 部署 profile 复用同一 provider，并显式区分 runtime pooler
与 migration direct connection。`RdbProvider` 继续隔离全部数据库实现细节。

## 功能地图

- SQLite：默认本地 provider，支持既有数据库无损接管。
- PostgreSQL：通过 Prisma PostgreSQL client 和 `@prisma/adapter-pg` 提供完整持久化。
- Supabase：复用 PostgreSQL 实现，增加 pooled/direct URL 配置约束。
- 启动配置：`MYSTRA_RDB_PROVIDER=sqlite|postgresql|supabase`，启动前校验并 fail closed。
- 数据模型：第一期只管理 IntegrationConnection、Project、Task 三类实体；Connection 的
  repository/issue/CI/deploy 等能力保存在单一 `capabilities` JSON；删除待重做的 Project execution
  defaults、Session/ContextBundle/Runner persistence，以及遗留 Session events、Artifacts、event-derived
  Session summary 与 `artifactId`。Project 只保存 Connection + stable Repository external ID；Task 删除
  source、objective 与 Issue/Repository snapshots，并将幂等键命名为 `issue_dispatch_key`。Issue/Repo Info
  cache 由后续 Integration 规格设计，不属于本功能。
- 合同迁移：`RdbProvider` 内部异步化；除上述删除面与 Integration capability payload 修订外，
  其他外部 payload 保持不变。
- 兼容边界：批准删除面造成的现有上层功能报错不在 040 修复；形成后续适配清单，不保留旧 SQL/旧表兜底。
- 安装交付：根目录 `INSTALLATION.md` 覆盖三种安装、迁移、验证与恢复。

## 边界

- 不删除 `RdbProvider`，不允许消费者直接访问 Prisma Client。
- 不把 Supabase Data API 或 `supabase-js` 作为第二条 RDB CRUD 路径。
- 不支持运行时热切库、自动跨库搬迁或 public hosted multi-tenancy。
- SQLite 和 PostgreSQL 使用独立 migration history，并以 parity tests 保持逻辑模型一致。

## 分阶段能力图

1. owner 确认三表 ER、Integration capabilities JSON、逐字段说明与删除面，并同步 `main@10750ca` 的 039/041 contracts。
2. 建立 SQLite/PostgreSQL Prisma schema、生成 client、迁移历史和 parity gate。
3. 将 `RdbProvider` 异步化并迁移全部调用者与事务行为。
4. 增加 provider config/factory、PostgreSQL 与 Supabase connection lifecycle。
5. 完成 SQLite 接管、真实 PostgreSQL contract tests、Installation 文档；全仓失败按批准删除面归因并
   输出后续适配清单，不作为数据层验收阻断项。
