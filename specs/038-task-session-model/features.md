# 功能说明：Task / Session 业务模型迁移

## 摘要

Mystra 将长期工作目标建模为 Task，将每次独立子任务和 Agent 执行建模为 Session。
一个 Task 可以没有 Session，也可以由人或 Agent 创建多个 Session。Runner 是稳定资源；
连接 lease 与执行事件只是内部运行记录。

## 功能地图

- Task：Project、Issue/来源、高层目标、冻结 Repository context。
- Session：Task 下的子任务、Agent、branch、runtime、执行状态和 Review evidence。
- Runner：稳定身份、能力、容量、eligibility 与健康状态。
- 管理面：API 为 canonical；MCP、CLI 与 Web 只使用 Task/Session/Runner。
- runner protocol：claim 和完成 Session，不再消费 Job/Run。

## 边界

- 不保留 Job/Run API、payload、CLI、MCP、schema 或 alias。
- 不迁移旧开发数据；只允许精确识别目标后的 schema 重建。
- 不把 Session event 或 runner lease 提升为业务对象。
- 不决定 activity timeline、事件查询或事件 retention。
- 不引入 Task orchestration、Session graph 或自动 retry。

## 分阶段能力图

1. 冻结 Task、Session、Runner 与内部记录的合同边界。
2. 迁移 shared contracts、RDB 与 SQLite schema。
3. 迁移 API、runner protocol、MCP、CLI 和 Web。
4. 对齐 025 UI、耐久文档和历史 superseded 标记。
5. 完成静态、合同、持久化、runtime 与真实 Review 路径验证。
