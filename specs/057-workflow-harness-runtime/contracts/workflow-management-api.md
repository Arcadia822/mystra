---
title: "Contract：固定 Workflow Management API"
taco_scope: plan
---

## Authorization

Canonical routes require authenticated active Team Owner/Admin。Member、workload、Runner、anonymous fail closed；Task必须属于active Team。

## Enable

`POST /api/tasks/{taskId}/workflow/enable`

```json
{ "commandId": "uuid" }
```

Success `200`:

```json
{
  "workflow": {
    "id": "mystra.workflow",
    "stateId": "uuid",
    "stageId": "understand",
    "stateVersion": 1,
    "active": true,
    "enabledAt": "RFC3339"
  }
}
```

创建前验证所有 fixed Skill names 可在 Task Team解析到active Skill/current ready Revision。缺失/archived/unready返回 `workflow_skill_resolution_failed`，不创建 state。Active时重复enable返回current state且不重置Stage；same command replay返回相同 lifecycle result。

## Disable

`POST /api/tasks/{taskId}/workflow/disable`

```json
{ "commandId": "uuid", "expectedStateVersion": 4 }
```

Success `200`:

```json
{
  "workflow": {
    "id": "mystra.workflow",
    "stateId": "uuid",
    "stageId": "verify",
    "stateVersion": 5,
    "active": false,
    "disabledAt": "RFC3339"
  },
  "projectionCleanup": { "status": "ready|pending|failed", "retryable": true }
}
```

Transaction先撤销exact Session capability并移除Workflow sources；external cleanup失败不能保留command authority。

## Thin adapters

- `mystra tasks workflow enable <task-id> --command-id <uuid> --json`
- `mystra tasks workflow disable <task-id> --expected-revision <n> --command-id <uuid> --json`
- Remote MCP映射同一service，only JSON-safe inputs/outputs。

No list/resource/create/update/archive/replace/switch surface。

## Stable failures

| Code | HTTP | Retry |
|---|---:|---|
| `workflow_task_not_found` | 404 | no |
| `workflow_forbidden` | 403 | no |
| `workflow_not_enabled` | 409 | no |
| `workflow_state_conflict` | 409 | refresh |
| `workflow_command_conflict` | 409 | fix identity |
| `workflow_skill_resolution_failed` | 422/503 | classified |
| `workflow_skill_projection_failed` | 503 | yes; state remains committed |

No response exposes object key、execution code、absolute path or cross-Team existence。
