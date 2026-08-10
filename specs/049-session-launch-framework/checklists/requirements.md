# 规格质量：Session 发起、多消息执行与状态回报

**评审日期**: 2026-08-10
**状态**: 待重新核验

## Owner 裁决已反映

- [x] 不存在 Turn/turnId/SessionTurn 领域合同。
- [x] launch 原子持久化 Session、system prompt、first user message。
- [x] Provider 调用位于事务提交之后。
- [x] ready 不是终态，idle Session 不占用当前执行槽。
- [x] capacity 当前不限制，未来归 Runtime capability。
- [x] 049 launch 必须有 Task；Project-only/standalone Session 延后且不得预建第二套 Workspace 类型。
- [x] Session-scoped typed event history 已纳入 MVP 边界。

## 进入 tasks 前

- [ ] 全部 FR 可测试且错误码与 048 一致。
- [ ] data model、三个 contracts、plan、research 与 spec 无矛盾。
- [ ] SQLite/PostgreSQL 验证矩阵完整。
- [ ] `plan-eng-review` 已重新通过。
