# MCP Contract: Coordination Run Summaries

## Tool

`mystra_get_job_summary`

## Purpose

Return a compact coordinator-facing run summary for one job, using the same shared contract as the HTTP summary route.

## Input Schema

```json
{
  "type": "object",
  "required": ["jobId"],
  "properties": {
    "jobId": {
      "type": "string"
    }
  },
  "additionalProperties": false
}
```

## Result Shape

```json
{
  "summary": {
    "jobId": "uuid",
    "runId": "uuid",
    "taskId": "TASK-123",
    "runState": "queued",
    "phase": "queued",
    "headline": "Waiting for runner assignment",
    "milestone": {
      "key": "queued",
      "label": "Queued",
      "observedAt": "2026-05-17T01:00:00.000Z"
    },
    "updatedAt": "2026-05-17T01:00:00.000Z",
    "links": {
      "branch": "mystra/TASK-123-summary"
    }
  }
}
```

## Error Behavior

- Unknown job id returns the same structured not-found behavior as the HTTP summary route.
- The existing `mystra_get_job` tool remains available for full diagnostic snapshots.

## Lifecycle Notes

- The summary tool is for polling-friendly coordination output.
- Lifecycle metadata on the raw tool may remain richer; the summary tool should focus on current phase and terminal outcome rather than full event history.
