# Contract：Human Task production API

所有端点使用现有 Human session/Team authorization，响应 `cache-control: no-store`。

## POST `/api/tasks/{taskId}/production/assign`

Request:

```json
{
  "agentId": "uuid",
  "runtimeId": "uuid",
  "providerKey": "codex",
  "expectedRevision": 1,
  "idempotencyKey": "assign-051-1"
}
```

Success `200`（created 或 replay）：

```json
{
  "task": { "id": "uuid", "productionStatus": "in_progress", "statusRevision": 2 },
  "transition": { "id": "uuid", "fromStatus": "pending", "toStatus": "in_progress", "revision": 2 },
  "harness": { "id": "uuid", "agentId": "uuid", "agentRevision": 3, "workspaceId": null, "plannedSessionId": "uuid", "sessionId": null },
  "created": true
}
```

服务在响应前只保证 Task/Harness transaction 已提交并已请求 Workspace setup；不保证 Session 已启动。重复相同 key/payload 返回同一对象与 `created:false`。

## GET `/api/tasks/{taskId}/production`

返回 Task production projection、Harness、status transition page、Workspace projection 与 latest Session projection。Agent note 字段必须带 `verified:false`/presentation label，不得表示 Mystra 已验真。

## POST `/api/tasks/{taskId}/production/status`

Human request:

```json
{
  "status": "done",
  "expectedRevision": 4,
  "idempotencyKey": "review-accept-1",
  "note": "Accepted"
}
```

Human transition allowlist：

- `blocked -> in_progress`
- `waiting_for_review -> in_progress|done`
- any nonterminal `-> canceled`

## Stable errors

| code | HTTP | 语义 |
| --- | --- | --- |
| `task_not_found` | 404 | Team scope 内不存在 |
| `task_not_eligible` | 409 | 缺 Project/Repository 或非 pending Assign |
| `agent_unavailable` | 409 | Agent foreign/archived |
| `runtime_unavailable` | 409 | Runtime offline/capability missing |
| `invalid_transition` | 409 | actor/from/to 不合法或 terminal |
| `task_status_conflict` | 409 | stale revision 或 idempotency payload conflict |
| `missing_status_note` | 400 | required note 缺失 |
| `invalid_request` | 400 | schema/limit 失败 |

错误体：`{"error":{"code":"...","message":"..."}}`。message 不泄漏 foreign Team 对象是否存在。
