# 接口契约：Session 续接与读取（HTTP / MCP / CLI）

**Feature**: `062-session-continuation-entrypoints`  
**Date**: 2026-09-22  

---

## 1. HTTP API 契约

### `POST /api/sessions/:id/messages`

追加用户消息到指定 Session。

#### 权限要求
- 需要有效的 Human Session 或系统鉴权。
- 必须具备目标 Team 的 `team.resource.access` 权限。

#### 请求体 Schema (`sessionSendMessageHttpInputSchema`)
```ts
{
  messageId?: string; // UUID, 可选。省略时由服务端自动生成
  content: string | Array<
    | { type: "text"; text: string }
    | { type: "artifact"; artifactId: string }
  >; // 字符串或符合 UserMessageContentPart 的数组
  inReplyToMessageId?: string; // UUID, 可选
}
```

#### 响应体 Schema (`sessionSendMessageResponseSchema`)
```ts
{
  session: Session;     // 包含最新状态的 Session 对象
  created: boolean;     // true 表示首次接受，false 表示显式 messageId 重放
  delivery: "dispatch" | "queue" | "steer"; // 实际 Provider 处理方式；当前仅产生 dispatch
  messageId: string;    // 本次消息的 messageId
}
```

#### 状态码映射
- `202 Accepted`：成功发送或显式 `messageId` 重放；通过 `created` 和 `delivery` 区分结果。
- `400 Bad Request`：参数校验错误或 Session 已处于终态（`session_terminal`）。
- `404 Not Found`：Session 不存在或不属于当前鉴权 Team。
- `409 Conflict`：Session busy 且 Provider 未适配原生 append（`session_busy`），或复用已有 `messageId` 但内容不一致（`session_conflict`）。
- Mystra 不实现自有消息队列；未来只有 Provider 原生能力可产生 `delivery: "queue" | "steer"`。

---

## 2. MCP 工具契约

### 2.1 `mystra_get_session`
获取单个 Session 的当前状态与运行时信息。
```json
{
  "name": "mystra_get_session",
  "description": "Inspect one Session, including runtime state, locked runtime, provider, and active/last messages.",
  "inputSchema": {
    "type": "object",
    "required": ["id"],
    "properties": {
      "id": { "type": "string", "format": "uuid", "description": "Session ID" }
    },
    "additionalProperties": false
  }
}
```

### 2.2 `mystra_list_task_sessions`
按 Task 列出会话。
```json
{
  "name": "mystra_list_task_sessions",
  "description": "List Sessions associated with a Task in the active Team.",
  "inputSchema": {
    "type": "object",
    "required": ["taskId"],
    "properties": {
      "taskId": { "type": "string", "format": "uuid", "description": "Task ID" },
      "limit": { "type": "integer", "minimum": 1, "maximum": 50, "default": 20 },
      "cursor": { "type": "string", "format": "uuid" }
    },
    "additionalProperties": false
  }
}
```

### 2.3 `mystra_send_session_message`
向 Session 追加新消息。
```json
{
  "name": "mystra_send_session_message",
  "description": "Send a follow-up user message when the Session is idle; active Providers currently reject append.",
  "inputSchema": {
    "type": "object",
    "required": ["sessionId", "content"],
    "properties": {
      "sessionId": { "type": "string", "format": "uuid", "description": "Session ID" },
      "content": {
        "oneOf": [
          { "type": "string", "description": "Message text" },
          { "type": "array", "items": { "type": "object" }, "description": "Standard content parts" }
        ]
      },
      "inReplyToMessageId": { "type": "string", "format": "uuid", "description": "Optional message ID being replied to" }
    },
    "additionalProperties": false
  }
}
```

---

## 3. Operator CLI 契约

### `mystra sessions send-message <id>`

```bash
# 基础文本追加
mystra sessions send-message <sessionId> --content "请根据评审意见补充单元测试"

# JSON 模式
mystra sessions send-message <sessionId> --content "..." --json

# 指定回复上一条消息
mystra sessions send-message <sessionId> --content "..." --in-reply-to <messageId>
```
- 输出结果展示 `created`、`delivery` 与 Session 状态；当前 `delivery` 为 `dispatch`。
