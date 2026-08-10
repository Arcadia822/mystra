# 数据模型：Task Session Experience

050 不增加持久化业务实体，也不定义 `SessionSummary`、`SessionDetail`、`TaskWorkspaceSummary` 或 materialized view。所有业务数据直接复用 048/049 shared schemas。

## 复用合同

```ts
type TaskSessionsPage = {
  sessions: Session[]; // 049 Session
  nextCursor?: string;
};

type SessionResponse = { session: Session };

type SessionEventWindow = {
  events: SessionEvent[]; // 049 SessionEvent
  olderCursor?: string;
  nextAfterSequence?: number;
};
```

Task 列表查询按 subject.teamId/taskId 过滤，使用 049 已存在的 `updatedAt DESC,id DESC` keyset。050 不要求 createdAt、startedAt、finishedAt、objectiveLabel、terminalSummary 或 lastEventSequence 字段。

## 创建输入

```ts
type TaskSessionLaunchInput = {
  sessionId: string;
  providerKey: string;
  agentId: string;
  manualContext?: {
    text: string;
  };
};
```

服务端通过 URL taskId 与 subject.teamId 读取：

- Task 与其可选 Project；
- feature 048 ready TaskWorkspace 与固定 runtimeId；
- 044 available Provider capability；
- 046 active Agent。

然后映射为 049 `SessionLaunchRequest`，并生成：

```ts
firstUserMessage = {
  messageId: generatedMessageId,
  content: [{ type: "text", text: canonicalTaskExecutionMessage }],
};
```

system prompt 与第一条 user message 的具体内容由 049 assembler/launch policy 生成并在同一事务持久化。Manual 只是 Context 数据，不是直接 system instruction。

## UI 派生状态

```ts
type PresentedEvent = {
  eventId: string;
  globalSequence: number;
  category:
    | "lifecycle"
    | "user-message"
    | "response"
    | "thinking"
    | "plan"
    | "tool"
    | "usage"
    | "interrupt"
    | "handoff"
    | "error"
    | "result"
    | "unknown";
  title: string;
  body?: string;
  occurredAt: string;
};
```

`PresentedEvent` 是客户端纯函数结果，不持久化，不是 API view。输入始终是原始 049 SessionEvent；unknown kind 安全降级。

## 轮询状态

```ts
type EventPollingState = {
  afterSequence: number; // last accepted globalSequence
  inFlight: boolean;
  pageVisible: boolean;
  autoRefresh: boolean;
};
```

autoRefresh 仅在 `queued | dispatched | message_pending | running | interrupted | waiting_for_handoff` 且页面可见时开启。ready/closed/failed 停止自动刷新，保留手动刷新。ready 停止不是因为 Session 终结，而是 050 尚无后续消息输入。

## 索引与约束

- 复用/补充 RdbProvider 的 `(teamId,taskId,updatedAt,id)` Session 查询能力；返回实体仍是 Session。
- 复用 049 `(sessionId,globalSequence)` SessionEvent 索引与 Team authorization。
- 不增加 summary/detail 表、JSON snapshot、lastEventSequence 投影或终态摘要列。
