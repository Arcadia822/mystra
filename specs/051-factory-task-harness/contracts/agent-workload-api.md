# Contract：Agent workload API

所有端点只接受：

```http
Authorization: Bearer <MYSTRA_EXECUTION_CODE>
```

不接受 Human cookie、generic API token、Task ID query/body 或 Agent ID override。成功/错误均 `cache-control: no-store`，不得记录 Authorization header/body code。

## GET `/api/agent-execution/whoami`

```json
{
  "version": 1,
  "execution": {
    "teamId": "uuid",
    "taskId": "uuid",
    "harnessId": "uuid",
    "sessionId": "uuid",
    "agentId": "uuid",
    "agentRevision": 3,
    "expiresAt": "date-time"
  },
  "capabilities": ["context:read", "task-status:read", "task-status:transition"]
}
```

## GET `/api/agent-execution/context`

Control Plane logical response：

```json
{
  "version": 1,
  "execution": { "taskId": "uuid", "harnessId": "uuid", "sessionId": "uuid", "agentId": "uuid", "agentRevision": 3 },
  "task": { "title": "Frozen title", "description": "Frozen description", "issue": { "provider": "linear", "connectionId": "uuid", "scopeExternalId": "team", "externalId": "issue", "identifier": "ENG-123" } },
  "project": { "id": "uuid", "repositoryConnectionId": "uuid", "repositoryExternalId": "owner/repo", "repositoryBaseBranch": "main" },
  "workspace": { "id": "uuid", "branch": "eng-123-fix" },
  "capabilities": ["context:read", "task-status:read", "task-status:transition"]
}
```

CLI 添加 `workspace.root=process.cwd()` 后输出最终 TaskExecutionContext。响应不含 Linear/GitHub body、clone credential、PAT/App token、repository secret 或 execution code。

## GET `/api/agent-execution/task-status`

```json
{
  "taskId": "uuid",
  "productionStatus": "in_progress",
  "statusRevision": 2,
  "statusNote": null,
  "statusUpdatedAt": "date-time",
  "allowedTransitions": ["blocked", "waiting_for_review"]
}
```

## POST `/api/agent-execution/task-status`

```json
{
  "status": "blocked",
  "expectedRevision": 2,
  "idempotencyKey": "agent-status-1",
  "note": "linctl is not authenticated"
}
```

Request 不含 taskId/harnessId/sessionId/agentId；这些全部来自 capability resolution。

Success:

```json
{
  "taskId": "uuid",
  "productionStatus": "blocked",
  "statusRevision": 3,
  "statusUpdatedAt": "date-time",
  "transitionId": "uuid"
}
```

## Stable errors

| code | HTTP | 语义 |
| --- | --- | --- |
| `capability_expired` | 401 | code absent、unknown、expired、revoked |
| `scope_mismatch` | 403 | resolved objects/revisions不再匹配；不返回 context |
| `invalid_transition` | 409 | Agent actor不允许该迁移 |
| `task_status_conflict` | 409 | stale revision/idempotency conflict |
| `missing_status_note` | 400 | blocked/waiting_for_review note缺失 |
| `invalid_request` | 400 | schema/limits失败 |
