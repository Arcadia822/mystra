# 功能规格：Session 发起、多消息执行与状态回报

**功能分支**: `049-session-launch-framework`
**创建日期**: 2026-08-09
**修订日期**: 2026-08-10
**状态**: 已实现
**输入**: Control Plane 在一个数据库事务中创建 Session、冻结 system prompt 与第一条 user message；事务提交后由指定 Runtime 通过 Provider 执行；Session 支持后续串行 user message；全部经过校验、限长和脱敏的 Session 领域事件持久化。

## 合同摘要

Session 是 Team-scoped、独立于 Task 与 Project 的持久化会话。一次发起明确选择 Runtime、Provider、Agent、Context 四个互不推导的执行输入，并同时提供第一条 user message。

Mystra 不定义 `Turn`、`turnId`、`SessionTurn` 或 Turn CRUD。每条 user message 具有消息身份 `messageId`，只用于命令幂等及关联该消息触发的 response、tool、usage、interrupt 和 result 事件；它不是独立业务对象或外键目标。首条消息与 Session 使用同一个创建事务；后续消息通过 `sendMessage` 追加。

| 输入 | 所有者 | 发起时冻结的内容 | system prompt 贡献 |
| --- | --- | --- | --- |
| Runtime | 平台/Runtime | Runtime ID、类型、执行能力快照 | workspace 与执行环境约束 |
| Provider | Runtime capability | Provider key、协议/adapter 能力快照 | Provider 能力、限制与交互约束 |
| Agent | Team | Agent ID、revision、system prompt 快照 | Agent 定义的行为指令 |
| Context | Session | 可选 Project、Task（含 exact optional Issue reference）与手工上下文快照 | 作为转义后的不可信业务上下文数据；Provider Agent 可用 Issue reference 读取 source-authoritative 内容 |

这里的 `launch` 是 Control Plane 的 canonical application command `SessionService.launch`：它校验参数，解析 feature 048 attachment，组装 system prompt，并在一个数据库事务中写入 Session、`session.created`、`session.system_prompt_configured`、`session.workspace_attached` 和第一条 `session.user_message_submitted`，然后返回 `queued`。Runtime claim 与 Provider 网络调用只能在该事务提交后发生，数据库事务不得跨 Runtime/provider I/O。

049 当前只支持 Task-bound Session。launch 必须绑定 feature 048 已准备的共享 Task Workspace，并持久化统一的 Workspace attachment 证据。Project-only Session 与既不引用 Task 也不引用 Project 的 Session 延后；未来它们仍使用同一 Workspace/attachment 合同，只是 Workspace 准备逻辑不同，049 不提前定义该逻辑。

`Session.state` 是当前查询投影；`SessionEvent` 是 Session-scoped、类型化、不可变事实历史。它不是全局活动流或通用日志平台。

## 使用场景与测试

### 场景 1：原子创建 Session、system prompt 与第一条 user message（P1）

1. Runtime online、Provider available、Agent active、Task Workspace ready 且 Team 边界有效时，`launch` 必须在一个事务内写入 Session、`session.created`、`session.system_prompt_configured`、`session.workspace_attached` 与 `session.user_message_submitted`，并把 Session 置为 `queued`、`activeMessageId` 指向首条消息。
2. 相同 `sessionId` 与完全相同的 launch payload 重试时返回原 Session 与 `created:false`；不同 payload 返回稳定冲突。
3. 任一校验或事务写入失败时不得留下部分 Session 或事件。
4. 数据库事务提交后，指定 Runtime 才能 claim；其他 Runtime 不得领取。
5. Runtime/Provider 失败不回滚已提交的创建事实，而以 SessionEvent 更新 Session 为 `failed`。

### 场景 2：同一 Session 串行接收后续 user message（P1）

1. Session 为 `ready` 时，`sendMessage(messageId, content)` 原子追加 `session.user_message_submitted`，并更新为 `message_pending`。
2. 相同 `(sessionId,messageId)` 与相同内容重试是幂等重放；不同内容是冲突。
3. 同一 Session 同时只允许一个 active message/response；`message_pending | running | waiting_for_handoff` 不接收无关联的新消息。
4. 同一有效 lease 内，后续消息复用 Provider session；lease 切换可产生新的 Provider session，但不改变 Session 身份。
5. 消息完成、取消或可恢复失败后，如没有下一条 user message，Session 回到 `ready`，Runtime 当前执行槽立即让出。

### 场景 3：冻结且可审计的 system prompt（P1）

1. 四个选择按固定顺序渲染，组件快照与最终文本写入 `session.system_prompt_configured`。
2. Project、Task 与手工 Context 只是显式标记的不可信数据，不得覆盖系统指令。
3. Task 带 Issue 时，Context 必须冻结该 Task 已持久化的 exact Issue reference，包括 provider、connection、scope、external ID 与 identifier；049 不复制或实时解析外部 Issue 正文。
4. launch 后 Agent、Project 或 Task 更新不改变该 Session 已冻结的 system prompt。
5. 第一条 user message 是独立事件，不拼入 system prompt，也不需要二次 `sendMessage`。

### 场景 4：Runtime 使用 Task Workspace 并通过 Provider 执行（P1）

1. Session 只能使用 ready TaskWorkspace 的 `runtimeId/taskWorkspaceId/workspaceRef/shared-mutable`，不得创建 Session 专属目录。
2. Runtime 解析 attachment 后启动 Provider，并执行 launch 已持久化的首条 user message。
3. launch 不引用 Task 时必须失败关闭；不得临时发明第二套 Workspace 类型或准备路径。
4. 当前 concrete adapter 必须覆盖已启用的 Codex/Copilot CLI Provider，并保留 provider-neutral session boundary；未来外部协议即使使用 prompt turn，也不得把它引入 Mystra 领域合同。

### 场景 5：状态与 Runtime 资源释放（P1）

1. `queued -> dispatched` 表示 Runtime 已取得 ownership lease。
2. 首条消息在 launch 时已等待执行，因此 `session.provider_started` 后进入 `message_pending` 或直接 `running`，不得先错误地投影为 `ready`。
3. `session.response_started` 使 Session 进入 `running`。
4. `session.response_completed | session.response_canceled` 清空 `activeMessageId`、记录 `lastMessageId`，使 Session 回到稳定态 `ready`。
5. `ready` 不是终态；它表示 Provider 会话可以继续接收消息，但当前没有执行占用。
6. `closed | failed` 才是 Session 终态。Runtime 丢失且无法恢复时失败关闭，不自动迁移。
7. 049 不持久化、配置或执行 Runtime capacity/slot 限制；capacity 是未来 Runtime capability。lease 只表达执行 ownership 与鉴权，不是容量预留。

### 场景 6：类型化 SessionEvent 历史（P1）

1. Runtime 以至少一次方式回报 lifecycle、provider、response、tool、usage、interrupt、handoff、error 与 result 事件。
2. Control Plane 按 event ID/source sequence 幂等追加，并在同一事务中更新 Session 投影。
3. 每个事件与每批请求必须通过共享 Zod schema、大小上限与脱敏规则；二进制内容使用 Artifact 引用。
4. Team 授权调用方可分页读取一个 Session 的全部已接受事件；不提供跨 Session 搜索、全局活动流、任意 stdout/stderr 存储或日志 API。

## Session 状态模型

```text
launch(first message)
  -> queued -> dispatched -> message_pending -> running -> ready
                                    |              |        |
                                    |              +-> interrupted
                                    |                      |-> running (resume_message)
                                    |                      +-> message_pending (new_message)
                                    +-----------------> waiting_for_handoff

ready + sendMessage -> message_pending
任意非终态 -> closed | failed
```

| state | 含义 |
| --- | --- |
| `queued` | Session 与首条消息已持久化，等待指定 Runtime claim |
| `dispatched` | Runtime 已取得 lease，尚未确认 Provider 可执行 |
| `message_pending` | user message 已持久化，等待 Provider 开始响应 |
| `running` | Runtime/Provider 正在处理 `activeMessageId` |
| `ready` | 当前消息已结束，可接收下一条消息；当前执行槽已释放 |
| `interrupted` | 当前 response 等待输入、审批或外部动作，或因 refusal/limit 停止 |
| `waiting_for_handoff` | 人类接管工作所有权 |
| `closed` | Session 已正常关闭 |
| `failed` | Session 无法继续的不可恢复错误 |

## 功能需求

- **FR-001**：提供 canonical `launch`、`sendMessage`、Session read、close 与 SessionEvent read；具体 Web/CLI/MCP 入口由后续规格拥有。
- **FR-002**：launch 必须显式给出调用方生成的 `sessionId`、Runtime、Provider、Agent、包含必填 `taskId` 的 Context，以及 `firstUserMessage { messageId, content }`。
- **FR-003**：Session 是 Team-scoped 同级对象，不归属于 Project、Task、Agent 或 Runtime。
- **FR-004**：Runtime 必须 online，Provider 必须 available，Agent 必须 active 且同 Team；Task-bound Runtime 还必须匹配 feature 048 Workspace affinity。
- **FR-005**：Project/Task 分别按 Team 校验；不得从 Task 推导 Session Project。
- **FR-006**：launch 必须先规范化全部输入，再在一个 RDB 事务中写入 Session 与四个初始事件；事务不得包含 Runtime/provider 网络 I/O。
- **FR-007**：相同 `sessionId` 与相同 launch payload是重放；不同 payload 冲突；不增加 fingerprint/hash 固定字段。
- **FR-008**：launch 成功立即返回 `queued`，不等待 Runtime。
- **FR-009**：Mystra 领域合同不得出现 `Turn`、`turnId`、`SessionTurn` 或 Turn CRUD。
- **FR-010**：每条 user message 使用 `messageId` 作幂等和事件关联；它不是业务实体或外键。
- **FR-011**：Session 原生支持串行多次 `sendMessage`；相同 `(sessionId,messageId)` 同 payload 重放、不同 payload 冲突。
- **FR-012**：首期不得并行处理两条 user message；后续 message 只允许在 `ready` 或允许 `new_message` 的 `interrupted` 状态提交。
- **FR-013**：Control Plane 通过按 Runtime type 注册的 dispatcher 投递；host runner 只是 Runtime 实现。
- **FR-014**：claim 只返回请求 `runtimeId` 对应的 queued Session，并用原子 lease 防止重复执行。
- **FR-015**：`SessionDispatchLease` 只保存 ownership/auth 所需数据；不得包含 capacity slot。Workspace identity 来自统一 attachment 合同，不由 lease 重新定义。
- **FR-016**：049 不定义 Runtime capacity 数字、默认并发值、平台限制或调度配额。
- **FR-017**：Runtime 必须重新确认 Provider available/capability；不兼容时失败，不静默回退。
- **FR-018**：Provider execution 必须通过 ProviderSessionAdapter；当前 concrete adapter 覆盖已启用的 Codex/Copilot CLI，同一有效 lease 内保持一个 Provider session 并串行处理消息。
- **FR-019**：每个 adapter 必须显式生成 start 与 continuation command；system prompt 只在 start command 与首条 user message 一起交付，continuation 不得重复注入 system prompt。
- **FR-020**：system prompt 四部分按固定顺序生成；Context component 必须把 Project repository identity 与 Task exact optional Issue reference 作为非秘密、不可信数据交付给 Provider Agent，完整内容只保存在类型化事件中。049 不复制或实时解析外部 Issue 正文。
- **FR-021**：launch 必须持久化 `session.workspace_attached`，引用 feature 048 的 `taskWorkspaceId/runtimeId/workspaceRef/shared-mutable`。
- **FR-022**：049 必须拒绝缺少 Task 的 launch。Project-only Session 与 standalone Session 延后；未来必须复用同一 Workspace/attachment 合同，只允许准备逻辑不同，不得新增 parallel temporary-workspace model。
- **FR-023**：Runtime 为上报事件生成稳定 event ID 与来源流连续序号，并至少一次重试。
- **FR-024**：Control Plane 持久化所有经 schema 校验、限长、脱敏的 Session 领域事件，并提供 Team 授权的 Session-scoped 分页读取。
- **FR-025**：SessionEvent 保存 `sessionId`、可选 `messageId`、全局/source sequence、kind/version、payload/metadata 与时间戳。
- **FR-026**：事件追加事务必须完成 lease 校验、幂等去重、序号连续性、状态转换、Session 投影更新与插入。
- **FR-027**：Session 行只物化 state、activeMessageId、lastMessageId、interruptKind、continuationMode、failureCode、metadata 与 updatedAt；不保存 providerSessionId、workspaceRef、stopReason、完整 prompt/result/error 或事件游标。
- **FR-028**：response 完成/取消后必须释放 Runtime 当前执行占用并回到 `ready`；idle Session 不构成 049 的 capacity reservation。
- **FR-029**：`interrupted` 使用 `resume_message | new_message` 指示下一动作；`waiting_for_handoff` 专门表示人类接管。
- **FR-030**：Runtime 把 Provider 结束原因规范化到 result/interruption 事件，不投影成 Session 固定字段。
- **FR-031**：租约过期且 Runtime offline 时追加失败事件，不自动迁移、回退或重试。
- **FR-032**：跨 Team、错误 Runtime/lease/Session 的回报失败关闭，不泄漏其他 Team 对象。
- **FR-033**：pre-0.1 旧 Session/Turn/单轮结果合同直接替换，不保留兼容路径。

## 核心实体

- **Session**：唯一会话业务对象；保存执行选择引用和当前状态投影。
- **SessionEvent**：Session-scoped 类型化事实账本；user message、response、过程与结果均在此表达。
- **SessionDispatchLease**：Runtime 的执行 ownership/auth 操作记录；不是 capacity reservation。
- **SessionWorkspaceAttachment**：launch 的持久化 Workspace 选择证据；049 的唯一来源是 feature 048 TaskWorkspace。
- **SessionEventStream / SessionEventHead**：来源幂等游标与 Session 全局事件序号头。
- **ProviderSessionAdapter**：生成 Provider start/continue command 并解析 process result；Runtime worker 把结果转换为统一 SessionEvent。
- **RuntimeSessionDispatcher**：向不同 Runtime 类型投递 Session 的边界。

## 事件目录 v1

| 事件 | `messageId` | 作用/Session 投影 |
| --- | --- | --- |
| `session.created` | 无 | 保存选择、引用与创建快照；`queued` |
| `session.system_prompt_configured` | 无 | 保存四组件与最终 system prompt |
| `session.user_message_submitted` | 必填 | 保存第一条或后续 user message；设置 activeMessageId |
| `session.runtime_dispatched` | 无 | Runtime 取得 lease；`dispatched` |
| `session.workspace_attached` | 无 | feature 048 TaskWorkspace attachment 证据 |
| `session.provider_started` | 无 | 当前 lease 保存 Provider Session ID；首条消息继续待执行 |
| `session.response_started` | 必填 | Provider 开始响应；`running` |
| `session.agent_message_chunk` / `session.agent_thought_chunk` | 必填 | 输出与思考流 |
| `session.plan_updated` | 必填 | 计划变化 |
| `session.tool_call` / `session.tool_call_updated` | 必填 | 工具调用与进展 |
| `session.usage_updated` | 必填 | token/成本用量 |
| `session.input_requested` / `session.input_received` | 必填 | 补充信息请求/响应 |
| `session.approval_requested` / `session.approval_resolved` | 必填 | 工具或权限审批 |
| `session.interrupted` / `session.resumed` | 必填 | 中断与恢复 |
| `session.handoff_requested` / `session.handoff_accepted` / `session.handoff_completed` | 必填 | 人工接手 |
| `session.response_completed` | 必填 | 响应完成；清空 activeMessageId，回到 `ready` |
| `session.response_canceled` | 必填 | 当前响应取消；可继续则回到 `ready` |
| `session.response_failed` | 必填 | 响应或 Session 不可恢复失败 |
| `session.close_requested` / `session.closed` | 无 | 主动关闭；`closed` |
| `session.runtime_lost` / `session.failed` | 可选 | Session 基础设施失败；`failed` |

## 假设与依赖

- 044 提供 Runtime enrollment、存活状态与 Provider discovery；048 提供 Task Workspace setup 与 Runtime materialization；046 提供 Agent；047 提供 Project/Task 数据。
- host runner 代表注册所得 `runtimeId` 实现 claim、Task Workspace ref resolution 与事件回报。
- Runtime capacity 当前不限制、不持久化、不作为 claim 输入；未来由 Runtime capability 规格定义。
- 已接受的类型化事件进入 Session 历史；归档、压缩与冷存储另行设计。

## 范围之外

- Web/CLI/MCP 具体入口与推荐策略。
- Project repository policy、Task Workspace clone/worktree、交付、preview 与 PR。
- prompt 效果优化、RAG、skills/knowledge/secret 注入。
- Turn/SessionTurn、并行消息、自动重试、跨 Runtime 迁移、工作流、多 Agent 编排。
- Project-only Session、既无 Task 也无 Project 的 Session，以及它们各自的 Workspace 准备策略；未来仍复用统一 Workspace/attachment 合同。
- Runtime capacity、slot、配额与调度策略。
- 跨 Session 活动流/搜索、任意 stdout/stderr 日志、日志产品、事件归档/导出。
- Hosted remote ACP transport。

## 成功标准

- **SC-001**：有效 launch 100% 产生唯一 Session 与四个初始事件；无效组合产生 0 条部分记录。
- **SC-002**：20 个相同 sessionId 并发 launch 只产生 1 条 Session；不同 payload 全部冲突。
- **SC-003**：首条 user message 无需二次 API 即被指定 Runtime/Provider 执行。
- **SC-004**：同一 Session 连续执行至少 3 个 messageId，Provider session 在有效 lease 内不变；数据库和 API 没有 Turn。
- **SC-005**：20 个相同 messageId 并发 sendMessage 只产生 1 个 user-message event 和 1 次执行。
- **SC-006**：response 完成/取消后 Session 回到 ready 且 Runtime 当前执行占用已释放；ready 仍可接收下一条消息。
- **SC-007**：Session 表没有 system prompt、message 内容、result、event cursor、workspaceRef 或 capacity 字段。
- **SC-008**：1 万条合法类型化事件与输入一一对应；全批重放新增行数为 0。
- **SC-009**：所有 049 launch 都引用 ready TaskWorkspace 并复用其 attachment；缺少 Task 的 launch 100% 失败关闭，且没有第二套 temporary workspace 类型。
- **SC-010**：SQLite/PostgreSQL 对 Session/Event/Lease 唯一性、事务与有序读取结果一致；未运行 PostgreSQL 时明确标记未验证。
