# 数据模型：Session 发起、多消息执行与状态回报

## 关系概览

```text
Team 1 ── * Session 1 ── * SessionEvent
                    1 ── * SessionDispatchLease
                    1 ── * SessionEventStream
                    1 ── 1 SessionEventHead
                    1 ── 1 SessionWorkspaceAttachment (event payload; 049 来源为 TaskWorkspace)
```

不存在 Turn、SessionTurn 或独立 message 表。`messageId` 是 user message 命令及相关事件的幂等/关联字段，不是业务对象 ID 或外键。

## Session

| 字段 | 类型 | 约束 |
| --- | --- | --- |
| `id` | UUID | 主键；调用方生成 |
| `teamId` | UUID | 必填；tenant boundary |
| `runtimeId` | UUID | 必填；显式选择 |
| `providerKey` | string | 必填；选定 Runtime 的 available capability |
| `agentId` | UUID | 必填；同 Team active Agent |
| `projectId` | UUID? | 独立可选引用 |
| `taskId` | UUID? | 北极星模型允许可选；049 launch 必填，保留可空只为后续独立规格 |
| `state` | enum | 当前状态投影 |
| `activeMessageId` | UUID? | 当前待执行/运行/恢复的 user message ID |
| `lastMessageId` | UUID? | 最近已结束的 user message ID |
| `interruptKind` | enum? | 中断原因 |
| `continuationMode` | enum? | `resume_message | new_message` |
| `failureCode` | string? | 稳定机器码；详情在事件 |
| `metadata` | JSON object | 有界扩展信息 |
| `updatedAt` | timestamp | 排序与并发可见性 |

Session 不保存 system prompt、消息正文、result、providerSessionId、workspaceRef、capacity/slot、stopReason、事件游标或状态时间戳。

### 状态约束

| state | activeMessageId | 语义 |
| --- | --- | --- |
| `queued` | 必填 | Session 与首条消息已入库，等待 claim |
| `dispatched` | 必填 | Runtime 已取得 lease |
| `message_pending` | 必填 | Provider 尚未开始响应 |
| `running` | 必填 | Provider 正在响应 |
| `ready` | 空 | 无当前执行，可接收下一条消息 |
| `interrupted` | 依 continuationMode | 可恢复当前消息或接收新消息 |
| `waiting_for_handoff` | 通常必填 | 人类接管当前工作 |
| `closed` | 空 | 正常终态 |
| `failed` | 可空 | 不可恢复终态 |

`response_completed | response_canceled` 把 activeMessageId 复制到 lastMessageId 后清空，并把 Session 置为 ready。ready 是稳定态，不是终态；此时 Runtime 当前执行占用已释放。

## SessionEvent

| 字段 | 类型 | 约束 |
| --- | --- | --- |
| `id` | UUID | Runtime/Control Plane 生成的稳定事件 ID |
| `sessionId` | UUID | 必填 |
| `messageId` | UUID? | user message 及其派生事件的关联 ID |
| `sequence` | bigint | Session 全局连续序号；`(sessionId,sequence)` 唯一 |
| `sourceId` | string | `control-plane` 或稳定 Runtime stream ID |
| `sourceSequence` | bigint | 来源连续序号；`(sessionId,sourceId,sourceSequence)` 唯一 |
| `kind` | enum/string | v1 类型目录 |
| `version` | integer | schema 版本 |
| `payload` | JSON object | schema 校验、限长、脱敏后的内容 |
| `metadata` | JSON object | 有界扩展信息 |
| `occurredAt` | timestamp | 来源发生时间 |
| `receivedAt` | timestamp | Control Plane 接收时间 |

约束：

- `session.user_message_submitted` 对 `(sessionId,messageId)` 唯一；相同 payload 是重放，不同 payload 是 `session_message_conflict`。
- message/response/tool/usage 事件的 messageId 必须等于当前 activeMessageId；Session 生命周期事件可为空。
- 事件与对应 Session 投影在一个 RDB 事务中更新。
- 每事件、每批次和每字段都有 schema 大小上限；二进制仅保存 Artifact 引用。
- Team 授权读取按 `(sessionId,sequence)` 游标分页；不提供全局事件搜索或日志 API。

## 初始事务

`SessionService.launch` 先完成所有外部读取与参数规范化，然后开启一个短 RDB 事务：

1. 插入 Session，state=`queued`，activeMessageId=`firstUserMessage.messageId`。
2. 插入 `session.created`。
3. 插入 `session.system_prompt_configured`。
4. 插入 `session.user_message_submitted`。
5. 提交。

Runtime claim、Workspace ref resolution、Provider process 启动和网络调用都发生在事务提交之后。数据库事务绝不等待 Runtime/provider I/O。

## SessionDispatchLease

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | UUID | 主键 |
| `sessionId` | UUID | Session 引用 |
| `runtimeId` | UUID | ownership 主体 |
| `tokenHash` | bytes/string | 原始 token 只返回一次 |
| `claimedAt` | timestamp | 领取时间 |
| `expiresAt` | timestamp | 租约期限 |
| `releasedAt` | timestamp? | 释放时间 |
| `providerSessionId` | string? | 该 lease 的 Provider 执行引用 |

Lease 只证明 Runtime 对执行与事件上报的 ownership/auth。它不是 capacity reservation，不保存 slot，也不重新定义 Workspace identity。Runtime capacity 当前不限制、不持久化；未来能力不得反向改变 049 的 Session 语义。

## Workspace

`session.workspace_attached` 持久化：

- `taskWorkspaceId`
- `runtimeId`
- opaque `workspaceRef`
- `sharingMode: shared-mutable`

该证据必须与 feature 048 的 ready TaskWorkspace 一致。049 不创建 clone、worktree 或 Session 子目录。当前 launch 的 taskId 必填；Project-only 与 standalone Session 延后。

长期方向只有一个 Workspace/SessionWorkspaceAttachment 合同。未来非 Task 上下文可以有不同的 Workspace 准备策略，但不得创建与 Task Workspace 平行的 `temporary` attachment 类型；该策略及字段不在 049 定义。

## EventStream / EventHead

- `SessionEventStream(sessionId,sourceId,nextExpectedSourceSequence)`：至少一次上报的来源幂等头。
- `SessionEventHead(sessionId,nextSequence)`：在事务中分配 Session 全局 sequence。
- event batch 必须验证 lease、Team、source 连续性、状态转换与 activeMessageId；任一失败整批回滚。

## 不变量

1. Session、Agent、Task、Project 都是 Team-scoped 同级对象。
2. Runtime、Provider、Agent、Context 是四个独立 launch 输入。
3. 首条 user message 与 Session/system prompt 同事务持久化。
4. 一次 Session 最多一个 activeMessageId；没有 Turn 状态机。
5. 完成一条 response 不关闭 Session，并立即释放当前执行占用。
6. 049 的每个 Session 都必须有来自 ready TaskWorkspace 的统一 attachment。
7. SessionEvent 是 Session 历史，不是跨 Session 活动流或任意日志存储。
