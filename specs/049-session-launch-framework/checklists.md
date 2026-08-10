# Feature 049 Readiness Checklist

- [x] launch 同事务创建 Session、system prompt 与第一条 user message。
- [x] Runtime/provider I/O 明确发生在事务提交后。
- [x] 领域合同无 Turn/SessionTurn；messageId 只用于幂等与事件关联。
- [x] ready/closed/failed 语义及 response 后执行占用释放明确。
- [x] Runtime capacity/slot 明确排除并留给未来 Runtime capability。
- [x] 049 只支持 Task-bound Session；未来非 Task 仍复用统一 Workspace 合同。
- [x] Session-scoped typed event history 与日志/全局活动流边界明确。
- [ ] requirements checklist 按新版 spec 重新核验。
- [ ] plan-eng-review 按新版 plan 重新执行并通过。
- [ ] `/speckit.tasks` 仅在工程评审通过后生成。
