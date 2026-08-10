# Contract：Canonical Session Application API

```ts
type SessionSubject = {
  actorId: string;
  teamId: string;
  roles: Array<"owner" | "admin" | "member">;
};

type UserMessageInput = {
  messageId: string;
  content: Array<{ type: "text"; text: string } | { type: "artifact"; artifactId: string }>;
};

type SessionLaunchRequest = {
  sessionId: string;
  runtimeId: string;
  providerKey: string;
  agentId: string;
  context: {
    projectId?: string;
    taskId: string;
    manual?: Record<string, unknown>;
  };
  firstUserMessage: UserMessageInput;
  metadata?: Record<string, unknown>;
};

type SessionLaunchResponse = { session: Session; created: boolean };

type SendMessageRequest = UserMessageInput & { inReplyToMessageId?: string };
type SendMessageResponse = { session: Session; created: boolean };

interface SessionService {
  launch(subject: SessionSubject, request: SessionLaunchRequest): Promise<SessionLaunchResponse>;
  sendMessage(subject: SessionSubject, sessionId: string, request: SendMessageRequest): Promise<SendMessageResponse>;
  get(subject: SessionSubject, sessionId: string): Promise<Session>;
  listEvents(
    subject: SessionSubject,
    sessionId: string,
    query: { afterSequence?: number; limit?: number; messageId?: string },
  ): Promise<{ events: SessionEvent[]; nextAfterSequence?: number }>;
  close(subject: SessionSubject, sessionId: string): Promise<Session>;
}
```

没有 Turn、SessionTurn 或 Turn API。`messageId` 只标识一条 user message 命令并关联事件。

## launch 语义

`launch` 是 Control Plane application command，不是 Runtime 动作。服务先完成授权、Runtime/Provider/Agent/Context/Workspace 校验和 system prompt 组装，再执行一个短数据库事务：

- insert Session；
- append `session.created`；
- append `session.system_prompt_configured`；
- append `session.user_message_submitted`；
- commit and return queued Session。

Runtime claim 和 Provider 调用只允许在 commit 之后开始。

相同 sessionId + 同 launch payload 返回 `created:false`；不同 payload 返回 `session_launch_conflict`。

## sendMessage 语义

- 允许状态：`ready` 或 `interrupted + new_message`。
- 相同 `(sessionId,messageId)` 与相同 payload 返回 `created:false`；不同 payload 返回 `session_message_conflict`。
- 成功后 state=`message_pending`，activeMessageId=messageId。
- 同时只允许一个 active message/response。

## 读取与授权

- Session 与 SessionEvent 均按 subject.teamId 隔离。
- events 按 sequence 升序、afterSequence 游标分页；limit 有服务端上限。
- messageId 过滤只返回相关事件切片，不产生 Message/Turn 对象。
- 不提供跨 Session 搜索、全局活动流或日志 API。

## 稳定错误码

- `session_not_found`
- `session_launch_conflict`
- `session_message_conflict`
- `session_invalid_state`
- `runtime_unavailable`
- `provider_unavailable`
- `agent_unavailable`
- `workspace_not_ready`
- `workspace_missing`
- `workspace_runtime_mismatch`
- `session_task_required`
- `team_boundary_violation`
- `event_payload_invalid`
