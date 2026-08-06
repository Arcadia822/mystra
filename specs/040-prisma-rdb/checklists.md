# 评审清单：Prisma 多数据库 RDB

## Owner 评审

- [x] 用户已明确要求实现 PostgreSQL、Supabase、切换配置与 Installation 文档。
- [x] 已将 hosted RDB 从排除项修订为批准部署目标。
- [ ] 确认 Supabase 复用 PostgreSQL provider，而不是引入 Supabase Data API CRUD。
- [ ] 确认切换只在进程启动时发生，不支持运行中热切库。
- [ ] 确认 `RdbProvider` 内部异步化；除遗留删除面与 Integration capability 修订外，其他外部 payload 不变。
- [x] Owner 已要求 Prisma 第一期只采用 3 张业务表，并删除 `sessions`、`context_bundles`、`runners`、`session_events`、`artifacts`、`mystra_schema`。
- [x] Owner 已明确 IntegrationConnection 只表达通用连接；repository、issue、PR、code review、CI、deploy 是零到多项 capability。
- [x] Owner 已否决 capability 联动表；第一期使用 `integration_connections.capabilities` 单一 JSON 字段。
- [ ] 确认 capability JSON 的统一 envelope 与枚举：`state=enabled|disabled|unavailable`。
- [ ] 确认删除 event-derived Session coordination summary，不增加 phase/summary 替代字段。
- [ ] 确认删除 `ExecutionContractReference.artifactId`，并将 `ExecutionSpecArtifact` 改为
  `ExecutionSpecSnapshot`，不设置替代 Artifact identity。
- [x] Owner 已要求 `projects.base_branch` 改为 `repository_base_branch`。
- [x] Owner 已要求删除 Project 的 `default_agent`、`runtime_config`、`prewarm_config`。
- [x] Owner 已要求 ContextBundle 与 Runner 表退出第一期并等待重新设计。
- [x] Owner 已要求 Session 表、关系、状态机与 CRUD 退出第一期并等待重新设计。
- [x] Owner 已批准删除 `projects.repository_snapshot`，改存 stable `repository_external_id`。
- [x] Owner 已要求删除 Task 的 `source`、`objective`、`issue_snapshot`、`repository_snapshot`，并将
  `dispatch_key` 改名为 `issue_dispatch_key`；Issue/Repository cache 留给后续 Integration 规格。
- [x] Owner 已明确 Repo Info 获取、缓存、TTL、刷新和失效不属于 040。
- [x] Owner 已明确批准删除面造成的既有功能报错不在 040 修复，只记录后续适配清单。

## Spec 就绪度

- [x] 技术场景和 actor 已定义。
- [x] SQLite 接管、PG/Supabase、配置、合同与安装均可独立验证。
- [x] 数据保留、幂等、连接秘密与 fail-closed 行为已定义。
- [x] `main@10750ca` 的 039/041 schema dependency 已记录。
- [x] 当前 schema 84 个业务列完成机器审计；第四轮三表 ER、30 个候选字段及逐字段说明已提交 owner 评审。
- [x] Project stable Repository identity 已纳入逐字段 ER，三表总字段数为 30；无 Session、snapshot 或 cache 实体/任务。
- [x] UI prototype 不适用：本功能没有 UI/experience surface。

## 后续工程检查

- [x] `/speckit.plan` 锁定 Prisma 版本与双 schema/migration 结构。
- [ ] `plan-eng-review` 审查 CRITICAL 异步化 blast radius、事务、迁移恢复、pool lifecycle 与性能。
- [ ] GitNexus 逐项分析 `RdbProvider`、`getDb`、provider factory、事务方法和全部消费者。
- [ ] `/speckit.tasks` 仅在 owner ER approval、main sync 与 engineering re-review 后生成。
- [ ] SQLite 与真实 PostgreSQL 运行同一 contract suite。
- [ ] Supabase 外部 connectivity 若缺少 project credentials，证据必须明确标记未执行。
