---
name: mystra-submit-implementation-request
description: Submit an implementation request to Mystra MCP using spec/task context instead of a hand-written raw create-job payload.
metadata:
  priority: 4
  promptSignals:
    phrases:
      - "submit implementation request"
      - "specReference"
      - "task scope"
      - "mystra_create_job"
---

# Mystra Submit Implementation Request

Use this skill when an agent has already produced requirements, a spec, or a
task scope and wants Mystra to execute the implementation.

## Required Inputs

- `projectId`
- `taskId`
- `branchName`
- `specReference`
- `taskScope`

## Optional Inputs

- `agent`
- `baseBranch`
- `planReference`
- `constraints`
- `metadata`

## Validation Rules

- Do not call MCP if any required field is empty.
- If the endpoint is unreachable, report the connection failure clearly and
  stop.
- Stay inside the current MCP contract. Use `mystra_create_job`; do not invent
  extra top-level fields.

## Prompt Shape

Build the Mystra job prompt in this form:

```text
Implement the requested scope in the target project.

Spec reference: <specReference>
Plan reference: <optional planReference>
Task scope: <taskScope>

Constraints:
<optional constraints>
```

## MCP Call

Use `${MYSTRA_MCP_URL:-http://127.0.0.1:3000/api/mcp}` and submit a JSON-RPC
request like:

```json
{
  "jsonrpc": "2.0",
  "id": "implementation-submit",
  "method": "tools/call",
  "params": {
    "name": "mystra_create_job",
    "arguments": {
      "taskId": "<taskId>",
      "source": "mcp",
      "projectId": "<projectId>",
      "branchName": "<branchName>",
      "agent": "<agent>",
      "baseBranch": "<baseBranch>",
      "prompt": "<generated prompt>",
      "metadata": {
        "submissionKind": "implementation-request",
        "specReference": "<specReference>",
        "planReference": "<optional planReference>"
      }
    }
  }
}
```

## Expected Result

Return the created job identifier, current run state, and any immediately
available branch or review URL from the MCP response.
