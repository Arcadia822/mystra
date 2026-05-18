---
name: mystra-check-task-status
description: Retrieve human-readable Mystra task status and result data through the MCP endpoint using the persisted task record id.
---

# Mystra Check Task Status

Use this skill when an agent needs to inspect the state of a previously
submitted Mystra task without manually crafting the raw `mystra_get_task`
JSON-RPC call.

## Required Input

- `id`

## Validation Rules

- Do not call MCP if `id` is empty.
- If the endpoint is unreachable, report the connection failure clearly and
  stop.
- If the task is missing, surface the returned `task_not_found` error directly.

## MCP Call

Use `${MYSTRA_MCP_URL:-http://127.0.0.1:3000/api/mcp}` and submit:

```json
{
  "jsonrpc": "2.0",
    "id": "task-status",
  "method": "tools/call",
  "params": {
    "name": "mystra_get_task",
    "arguments": {
      "id": "<id>"
    }
  }
}
```

## Expected Result

Summarize:

- task id
- run state
- result status and summary when present
- workflow status when present
- MR/PR URL when present

Prefer a short human-readable summary plus the key identifiers needed for
follow-up review.
