# 实施计划：Session 发起、多消息执行与状态回报

**分支**: `049-session-launch-framework` | **日期**: 2026-08-10 | **规格**: [spec.md](./spec.md)

## 摘要

049 建立 canonical Session execution path。`SessionService.launch` 校验 Runtime、Provider、Agent、Context 与 TaskWorkspace，组装 system prompt，并在一个短 RDB 事务中创建 Session、system prompt 与第一条 user message。事务提交后，指定 Runtime claim、准备 workspace、启动 Provider，并执行首条消息。后续 `sendMessage` 串行复用同一 Provider session。

领域模型没有 Turn/SessionTurn。messageId 仅承担消息幂等与事件关联。049 当前只支持 Task-bound Session，并复用 feature 048 的统一 Workspace attachment。Project-only 与 standalone Session 延后；未来仍使用同一 Workspace 合同，只允许准备逻辑不同。SessionEvent 作为 Team 授权、Session-scoped、类型化历史持久化，不成为通用日志平台。

## 技术上下文

- TypeScript 5.9、Node.js 24.14.0、Zod 4、Prisma 7.9.1、Next.js 16 Route Handlers、Vitest 4、Node child_process；concrete ACP adapter 需要时加入 ACP SDK。
- SQLite 与 PostgreSQL/Supabase-backed PostgreSQL 经 `RdbProvider`。
- 依赖 044 Runtime/Provider capability、046 Agent、047 Task Context、048 Task Workspace。
- 无 Turn、无 capacity/slot 合同、无第二套 temporary workspace、无跨 Session 活动流。

## 关键数据流

```text
Caller
  -> SessionService.launch(sessionId, runtime, provider, agent, context, firstUserMessage)
      -> authorize + validate + assemble system prompt
      -> RDB transaction:
           Session(queued, activeMessageId)
           session.created
           session.system_prompt_configured
           session.user_message_submitted
      -> commit and return

Runtime
  -> claim(runtimeId) [ownership lease, no capacity input]
  -> resolve feature 048 Task workspace attachment
  -> start ProviderSessionAdapter
  -> execute first message
  -> append typed SessionEvents
  -> response completes; Session ready; current execution slot released

Caller -> sendMessage(messageId, content) -> event + message_pending -> Runtime executes
```

数据库事务与 Runtime/provider I/O 明确分段。provider 调用失败通过后续事件收敛，不回滚已提交的 Session 创建事实。

## 模块边界

| 责任 | 目标位置 |
| --- | --- |
| Session domain schema/events/state machine | `packages/shared/src/sessions/*` |
| RdbProvider domain operations | `packages/db/src/contracts/*`, Prisma providers |
| launch/sendMessage/read | `apps/control-plane/src/lib/sessions/session-service.ts` |
| system prompt assembly | `apps/control-plane/src/lib/sessions/system-prompt-assembler.ts` |
| claim/lease/event ingest | `apps/control-plane/src/lib/sessions/runtime-session-service.ts` |
| Runtime dispatcher registry | `apps/control-plane/src/lib/sessions/runtime-dispatchers/*` |
| Provider adapter registry | `apps/runner-daemon/src/session/providers/*` |
| host execution and Workspace ref resolution | `apps/runner-daemon/src/session/*` |

## 状态与事件

首条消息使 Session 从创建起就有 activeMessageId：

`queued -> dispatched -> message_pending -> running -> ready`

后续 `sendMessage`：

`ready -> message_pending -> running -> ready`

`ready` 是可继续对话的稳定态，不是终态。response 完成/取消后 Runtime execute 调用返回并释放当前执行占用。`closed | failed` 才终结 Session。

核心事件：`created`、`system_prompt_configured`、`user_message_submitted`、`runtime_dispatched`、`workspace_attached`、`provider_started`、`response_started`、typed streaming/tool/usage、`interrupted|resumed`、handoff、`response_completed|canceled|failed`、`closed|failed`。

## Workspace

- 049 launch 必须引用 Task，并在事务中冻结 feature 048 attachment 证据。Runtime 必须匹配，使用同一个 opaque workspaceRef，不创建 Session 专属目录。
- 缺少 Task 的 launch 失败关闭。Project-only 与 standalone Session 的 Workspace 准备策略延后，但未来仍复用同一 Workspace/attachment contract，不新增 parallel temporary model。

这里的 launch 指 SessionService application command；“prepare workspace”和“start provider”才是 Runtime 动作。

## Runtime ownership 与 capacity

`SessionDispatchLease` 只解决多个执行进程竞争同一 Session、事件上报鉴权与失联判断。claim 请求没有 `availableSlots`，lease 没有 slot 字段。049 不限制 Runtime capacity；未来 capacity capability 可控制 Runtime 何时 claim，但不得改变 Session 状态或把 idle Session 解释为占用槽位。

## Provider adapter

```ts
interface ProviderSessionAdapter {
  start(input: ProviderStartInput): Promise<ProviderSessionHandle>;
}

interface ProviderSessionHandle {
  executeMessage(input: ProviderMessageInput, emit: Emit, signal: AbortSignal): Promise<ProviderResponseResult>;
  resumeMessage(messageId: string, response: JsonObject, emit: Emit, signal: AbortSignal): Promise<ProviderResponseResult>;
  cancelCurrent(): Promise<void>;
  close(): Promise<void>;
}
```

ACP adapter 内部使用 ACP protocol 名称，但输出统一 messageId 关联事件，不向领域层暴露 ACP turn。

## 持久化顺序

1. Session/Event/EventHead 同事务创建与追加。
2. `session.user_message_submitted` 对 `(sessionId,messageId)` 唯一。
3. Event batch 事务验证 lease、source sequence、activeMessageId 与状态转换。
4. SessionDispatchLease 保存 runtimeId/tokenHash/times/providerSessionId，不保存 capacity 或 workspaceRef。
5. SQLite/PostgreSQL 使用相同领域合同；Prisma 类型不越过 RdbProvider。

## 实施顺序

1. 共享 Session/SessionEvent/Zod schema 与状态 reducer。
2. SQLite/PostgreSQL Session/Event/Lease/EventStream/EventHead schema 与 provider tests。
3. canonical SessionService launch/read/sendMessage/close。
4. Runtime claim/event-ingest/lease lifecycle。
5. Task attachment resolution 与 Runtime Workspace ref resolution。
6. provider adapter registry、fake adapter、ACP concrete adapter。
7. host runner execution loop 与 typed event mapping。
8. E2E：launch 首消息、三条后续消息、中断/恢复/handoff、close/failure、事件重放。

## 验证

- RDB：20 路 sessionId/messageId 并发重放与冲突；1 万事件；projection 原子性；无 Turn/capacity/parallel temporary-workspace schema。
- Domain：全部合法/非法状态转换；ready 稳定态与 closed/failed 终态。
- Runtime：无 capacity 参数 claim；Task attachment affinity；缺少 Task 拒绝 launch；response 后释放执行占用。
- Provider：同 handle 串行多 message；ACP mapping 不泄漏 turn 概念。
- Security：Team boundary、lease token、schema limit、redaction、Artifact 引用。

## 工程评审状态

原评审因首消息时序、终态措辞、capacity、Workspace 分叉与 event scope 阻塞。2026-08-10 owner 裁决已写入本计划：049 只支持 Task-bound Session，非 Task 准备策略延后且未来复用统一 Workspace 合同。仍需在 `/speckit.tasks` 前重新运行 `plan-eng-review`。
