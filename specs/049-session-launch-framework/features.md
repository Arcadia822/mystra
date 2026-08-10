# Feature 049 摘要

- `launch` 在一个 RDB 事务中创建 Session、system prompt 与第一条 user message；提交后再由 Runtime/Provider 执行。
- 领域合同没有 Turn、turnId、SessionTurn 或 Turn API；messageId 仅用于消息幂等和事件关联。
- Session 串行支持后续 `sendMessage`，同一有效 lease 复用 Provider session。
- `ready` 是一条 response 结束后的可继续稳定态，不是终态；此时 Runtime 当前执行占用已释放。
- 049 不限制或持久化 Runtime capacity/slot；lease 只表达 ownership/auth。
- 049 只支持 Task-bound Session，复用 feature 048 的统一 Workspace attachment；Project-only 与 standalone Session 延后，未来只允许准备逻辑不同，不新增 temporary Workspace 类型。
- Team 授权调用方可以读取 Session-scoped、类型化、限长、脱敏的完整 SessionEvent 历史。
- 不提供跨 Session 活动流、日志 API、任意 stdout/stderr、Turn、并行消息、自动重试或跨 Runtime 迁移。
