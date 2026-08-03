# 评审清单：Task / Session 业务模型迁移

## Owner 评审

- [x] 一个 Task 可以创建多个 Session 承载不同子任务。
- [x] Task 与 Session 是松散一对多，不形成 workflow orchestration。
- [x] 不保留 Job/Run 兼容性，旧开发数据库允许重建。
- [x] Runner 是一等业务对象。
- [x] RunnerSession 与 RunEvent 不是业务对象。
- [x] activity timeline 暂缓决策。

## Spec 就绪度

- [x] Task、Session、Runner 的对象职责与归属明确。
- [x] API、MCP、CLI、runner、Web、schema 和文档迁移范围明确。
- [x] clean break 与精确重建安全边界明确。
- [x] 需求质量得分达到 97/100。
- [x] 可进入技术计划与工程评审。

## 后续插件检查

- [ ] activity timeline 与公开 Session event projection。
- [ ] Task completion/archive 产品语义。
- [ ] 多 Session 结果聚合或协作策略。
- [ ] 显式 retry 产品能力。
