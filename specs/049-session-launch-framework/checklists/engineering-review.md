# 工程评审：Session 发起、多消息执行与状态回报

**评审日期**: 2026-08-10
**状态**: 待重新评审

2026-08-10 owner 裁决已替换首消息时序、Turn、终态、capacity、Workspace 分叉与 event scope 设计。049 当前只支持 Task-bound Session；旧评审结论作废。

## 新版评审必须验证

- [ ] launch 的外部读取/规范化、RDB transaction、Runtime/provider I/O 分段正确。
- [ ] sessionId/messageId 并发幂等不依赖 fingerprint 固定列。
- [ ] queued 首消息不会在 provider_started 后错误进入 ready。
- [ ] response 完成后 current execution release 与 Provider handle 生命周期可实现。
- [ ] lease 是 ownership/auth，不暗含 capacity reservation。
- [ ] 缺少 Task 的 launch 失败关闭，且没有 parallel temporary Workspace 类型。
- [ ] Task attachment 与 048 affinity/共享可变语义一致。
- [ ] SessionEvent schema/size/redaction/Team authorization 足以阻止日志产品扩张。
- [ ] SQLite/PostgreSQL unique/transaction/keyset 行为一致。
- [ ] 测试矩阵覆盖 1 万事件、并发重放、Runtime loss、中断/handoff 与安全边界。

本文件不得在上述项目完成前解释为 `plan-eng-review passed`。
