---
title: "Contract：Workflow Workload API 与 mystra-agent CLI"
taco_scope: plan
---

## Capability

Allowlist adds `workflow:read`、`workflow:transition`、`workflow:projection:read`、`workflow:projection:report` only when Session has a non-revoked exact capability whose state remains active。CLI binary presence grants nothing。

## Current

`GET /api/agent-execution/workflow/current`，使用现有 execution-code presentation；no IDs in query/body。

```json
{
  "workflow": { "id": "mystra.workflow", "name": "Mystra Workflow" },
  "state": { "stageId": "implement", "stateVersion": 2, "terminal": false },
  "stage": { "name": "Implement", "instructions": "Implement the smallest correct change and preserve evidence." },
  "requiredSkills": [{
    "skillId": "uuid", "revisionId": "uuid", "revision": 3,
    "path": ".mystra/skills/uuid", "zipSha256": "hex"
  }],
  "availableActions": [{
    "id": "implementation-complete", "label": "Implementation complete", "nextStageId": "verify"
  }],
  "projection": { "generation": 8, "status": "ready|pending|failed", "retryable": true }
}
```

`mystra-agent workflow current [--json]` obtains context, reconciles pending exact generation in current cwd, reports outcome, then prints authority。Parser不接受Task/Workflow/state/harness ID flags。

## Transition

`POST /api/agent-execution/workflow/transition`

```json
{ "commandId": "uuid", "actionId": "implementation-complete", "expectedStateVersion": 2 }
```

Success returns previous/current Stage、new version、full new context、exact Skill `added/removed/retained` and projection generation。CLI:

```text
mystra-agent workflow transition <action-id> --expected-revision <n> [--command-id <uuid>] [--json]
```

CLI generates one command ID per invocation and preserves it across HTTP/materialization retries。

## Concurrency and replay

- CAS uses expectedStateVersion；20 requests against one version yield at most one success。
- Losers return `workflow_state_conflict` + safe current context；server never retries Action on new Stage。
- Same command/payload returns original transition with replayed=true。
- Same command/different payload returns `workflow_command_conflict`。

## Errors and exits

| Code | Exit | Retry |
|---|---:|---|
| `workflow_not_enabled` | 4 | no |
| `workflow_action_not_allowed` | 5 | use returned Actions |
| `workflow_state_conflict` | 6 | current/refresh |
| `workflow_command_conflict` | 7 | fix identity |
| `workflow_skill_resolution_failed` | 8 | classified |
| `workflow_skill_projection_failed` | 9 | yes; Stage may be committed |
| `scope_mismatch` | 10 | no |
| `capability_expired` | 11 | new Session/claim |

Human stderr is bounded/redacted；`--json` has stable code/context and no stack/credentials。
