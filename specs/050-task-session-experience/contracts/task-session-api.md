# Contract：Task Session API

所有 route 都是 canonical services 的薄 adapter，subject.teamId 由认证服务端解析。

## List Task Sessions

```http
GET /api/tasks/{taskId}/sessions?cursor=<opaque>&limit=50
```

```ts
type TaskSessionsPage = {
  sessions: Session[]; // 直接复用 049 shared Session schema
  nextCursor?: string;
};
```

排序为 `updatedAt DESC,id DESC`。不返回 SessionSummary 或附加终态摘要。

## Launch Task Session

```http
POST /api/tasks/{taskId}/sessions
Content-Type: application/json
```

```ts
type TaskSessionLaunchInput = {
  sessionId: string;
  providerKey: string;
  agentId: string;
  manualContext?: { text: string };
};

type TaskSessionLaunchResponse = {
  session: Session;
  created: boolean;
};
```

服务端锁定 048 Workspace runtimeId，组装 Context/system prompt 与 canonical firstUserMessage，并调用 049 launch。响应不等待 Runtime/Provider。

## Read Session

```http
GET /api/sessions/{sessionId}
```

```ts
type SessionResponse = { session: Session };
```

直接返回 049 Session；不定义 SessionDetail。

## Read Events

```http
GET /api/sessions/{sessionId}/events?latest=100
GET /api/sessions/{sessionId}/events?beforeSequence=500&limit=100
GET /api/sessions/{sessionId}/events?afterSequence=500&limit=100
```

```ts
type SessionEventWindow = {
  events: SessionEvent[];
  olderCursor?: string;
  nextAfterSequence?: number;
};
```

同一请求只能选择一种窗口模式。limit 有服务端上限。所有事件直接符合 049 SessionEvent schema。

## 稳定错误码

- `task_not_found`
- `session_not_found`
- `workspace_missing`
- `workspace_not_ready`
- `workspace_runtime_mismatch`
- `runtime_unavailable`
- `provider_unavailable`
- `agent_unavailable`
- `team_boundary_violation`
- `session_conflict`
- `event_window_invalid`

认证/Team boundary 继续使用既有 authorization response，不伪造成第二个 SessionFailure code。不得增加大写别名或第二套 UI error taxonomy。
