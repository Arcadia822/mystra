# Research：Feature 049 关键裁决

**日期**: 2026-08-10

## D1. Session 创建包含第一条 user message

**决定**：canonical `SessionService.launch` 同时接收 Runtime、Provider、Agent、Context 与 `firstUserMessage`。服务先完成读取、授权、feature 048 attachment 解析、规范化与 system prompt 组装，再在一个短 RDB 事务中写入 Session 和四个初始事件：created、system prompt、workspace attachment、first user message。

**边界**：事务提交后才允许 Runtime claim/Provider 调用。把远程 I/O 放进数据库事务会造成长事务、锁竞争和不可判定回滚，因此不采用。

## D2. 没有 Turn 领域概念

**决定**：Mystra 不定义 Turn、turnId、SessionTurn、Turn state 或 CRUD。messageId 只标识 user message 命令，并关联其 response/tool/usage/result 事件。ACP 的 prompt turn 只存在于 adapter 内部。

## D3. ready 是稳定态，不是终态

**决定**：response 完成或取消后 Session 回到 ready；closed/failed 才是终态。若没有下一条消息，Runtime 当前执行调用已经返回并让出执行占用。

## D4. 049 不拥有 Runtime capacity

**决定**：claim 无 availableSlots；lease 无 slot/capacity 字段；平台不设默认并发 1，也不把 idle Session 视作容量预留。capacity 是未来 Runtime capability。

## D5. 只有一个 Workspace 合同，049 只做 Task-bound

**决定**：049 launch 必须绑定 Task 并持久化 feature 048 attachment 证据。Project-only 与 standalone Session 延后。未来非 Task 场景仍复用同一 Workspace/attachment 合同，只允许准备逻辑不同，不定义 `temporary` 平行类型。

## D6. SessionEvent 是允许的 Session 历史

**决定**：保存全部经共享 schema 校验、限长、脱敏的 lifecycle、user-message、response、provider、tool、usage、interrupt、handoff、error 与 result 事件，并提供 Team 授权、Session-scoped 分页读取。

它不是通用日志：不保存任意 stdout/stderr，不提供跨 Session 搜索/活动流，不内嵌二进制。

## D7. Session 是 projection，SessionEvent 是事实账本

Session 仅保存当前 state、activeMessageId/lastMessageId 与少量 reason projection。完整 system prompt、消息、结果、stopReason 和错误在事件中。事件追加与 projection 更新同事务。

## D8. Provider adapter 构造串行 CLI continuation

adapter 为首条消息构造 start command，为后续消息构造 continuation command。Runtime 每次运行一个有界 child process，同一 Session 复用 lease 中的 providerSessionId，不并行 response。结束原因由 Runtime 规范化为 typed event，refusal 不推断 handoff。

## D9. 至少一次上报，恰好一次持久化

Runtime 为事件提供稳定 eventId/sourceSequence；Control Plane 在事务中校验 lease、连续性、幂等、状态转换和 activeMessageId。重复批次不新增事件。

## D10. System prompt 四组件固定顺序

Runtime、Provider、Agent、Context 分别贡献组件；Project/Task/Manual 是明确标记的不可信 Context 数据。完整渲染结果事件化，后续消息复用。

## D11. 当前 concrete session adapter 覆盖 Codex/Copilot CLI

继续使用并扩展 `@mystra/agent-adapters`。GitHub 官方 Copilot CLI reference 提供 `--session-id`、`--resume`/`--continue` 与 JSONL output，可作为 durable providerSessionId continuation。Codex adapter 从 CLI JSON event 取得 provider session identity，并用显式 continuation command 继续；安装版本不支持时 fail closed 为 `provider_unavailable`，不得把多个独立进程伪装成同一 Provider session。

本地 `codex` wrapper 当前因安装路径缺失返回 ENOENT，因此真实 Codex execution 不能标记为已验证。fake process contract 与 Copilot command contract仍需确定性验证。当前 enabled Provider 不要求引入 ACP SDK/transport。

## 被否决方向

| 方向 | 原因 |
| --- | --- |
| 空 Session 创建后再发送首消息 | 产生半创建窗口和第二次调用失败面 |
| 数据库事务内调用 Provider | 跨网络长事务无法安全回滚 |
| Turn/SessionTurn | 第二套状态、结果与 API，无必要 |
| Host Runtime 默认 capacity=1 | 未经需求授权；未来 Runtime capability 才拥有 |
| 为非 Task 预建 temporary Workspace 类型 | 当前无需求且会制造平行合同；后续应复用统一 Workspace，只改变准备逻辑 |
| 只保存最终摘要 | 无法审计状态与 provider 过程 |
| 任意 stdout/stderr 日志持久化 | 会扩张成日志产品 |
| 在 runner 内复制 Codex/Copilot command policy | 破坏现有 adapter ownership 并导致 continuation 漂移 |
| 为当前未启用 Provider 引入 ACP transport | 扩大依赖与验证面，不服务当前 Codex/Copilot MVP |
