---
name: mystra-submit-user-journey
description: Submit a structured user journey to Mystra MCP by packaging actor, goal, acceptance criteria, and context into a local Mystra task.
---

# Mystra Submit User Journey

Use this skill when an agent has a user journey and wants Mystra to execute it
without hand-writing the raw `mystra_create_task` JSON-RPC payload.

## Required Inputs

- `projectId`
- `logicalTaskId`
- `branchName`
- `actor`
- `goal`
- `acceptanceCriteria` (one or more items)

## Optional Inputs

- `agent`
- `baseBranch`
- `context`
- `metadata`

## Validation Rules

- Do not call MCP if any required field is empty.
- Do not call MCP if `acceptanceCriteria` is missing or empty.
- If the endpoint is unreachable, report the connection failure clearly and
  stop; do not silently retry.
- Stay inside the current MCP contract. Use `mystra_create_task`; do not invent
  extra top-level fields.

## Prompt Shape

Build the Mystra task prompt in this form:

```text
Implement the following user journey.

Actor: <actor>
Goal: <goal>

Acceptance criteria:
- <criterion 1>
- <criterion 2>

Additional context:
<optional context>
```

## MCP Call

Use `${MYSTRA_MCP_URL:-http://127.0.0.1:3000/api/mcp}` and submit a JSON-RPC
request like:

```json
{
  "jsonrpc": "2.0",
  "id": "journey-submit",
  "method": "tools/call",
  "params": {
    "name": "mystra_create_task",
    "arguments": {
      "taskId": "<logicalTaskId>",
      "source": "mcp",
      "projectId": "<projectId>",
      "branchName": "<branchName>",
      "agent": "<agent>",
      "baseBranch": "<baseBranch>",
      "prompt": "<generated prompt>",
      "metadata": {
        "submissionKind": "user-journey",
        "actor": "<actor>",
        "goal": "<goal>"
      }
    }
  }
}
```

## Expected Result

Return the created task identifier (`task.id`), the submitted logical task key
(`task.spec.taskId`), current run state, and any immediately available branch
or review URL from the MCP response. Use `task.id` for later `mystra_get_task`
or `mystra_cancel_task` calls.
