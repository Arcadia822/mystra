---
name: mystra-check-job-status
description: Retrieve human-readable Mystra job status and result data through the MCP endpoint using a job id.
metadata:
  priority: 4
  promptSignals:
    phrases:
      - "check Mystra job"
      - "job status"
      - "mystra_get_job"
      - "run state"
---

# Mystra Check Job Status

Use this skill when an agent needs to inspect the state of a previously
submitted Mystra job without manually crafting the raw `mystra_get_job`
JSON-RPC call.

## Required Input

- `jobId`

## Validation Rules

- Do not call MCP if `jobId` is empty.
- If the endpoint is unreachable, report the connection failure clearly and
  stop.
- If the job is missing, surface the returned `job_not_found` error directly.

## MCP Call

Use `${MYSTRA_MCP_URL:-http://127.0.0.1:3000/api/mcp}` and submit:

```json
{
  "jsonrpc": "2.0",
  "id": "job-status",
  "method": "tools/call",
  "params": {
    "name": "mystra_get_job",
    "arguments": {
      "jobId": "<jobId>"
    }
  }
}
```

## Expected Result

Summarize:

- job id / task id
- run state
- result status and summary when present
- workflow status when present
- MR/PR URL when present

Prefer a short human-readable summary plus the key identifiers needed for
follow-up review.
