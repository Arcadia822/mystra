# API Contract: Coordination Run Summaries

## Endpoint

`GET /api/jobs/{jobId}/summary`

## Purpose

Return a compact coordinator-facing summary for one Mystra job/run without returning the full diagnostic snapshot.

## Response Shape

```json
{
  "summary": {
    "jobId": "uuid",
    "runId": "uuid",
    "taskId": "TASK-123",
    "projectSlug": "local-fixture",
    "runState": "running",
    "phase": "running",
    "headline": "Workflow is executing the current node",
    "milestone": {
      "key": "workflow_started",
      "label": "Workflow running",
      "observedAt": "2026-05-17T01:00:00.000Z"
    },
    "startedAt": "2026-05-17T01:00:00.000Z",
    "updatedAt": "2026-05-17T01:00:05.000Z",
    "currentNodeId": "agent.execute",
    "links": {
      "branch": "mystra/TASK-123-summary"
    }
  }
}
```

Terminal runs may also include:

```json
{
  "summary": {
    "terminal": {
      "status": "succeeded",
      "summary": "Created the requested pull request"
    },
    "links": {
      "branch": "mystra/TASK-123-summary",
      "reviewUrl": "https://example.test/pr/42",
      "reviewDisplayId": "#42"
    },
    "finishedAt": "2026-05-17T01:10:00.000Z"
  }
}
```

## Errors

| Status | Body | Meaning |
|---|---|---|
| `404` | `{ "error": "job_not_found" }` | No job for the given id |
| `500` | existing route error behavior | Unexpected control-plane failure |

## Notes

- The route is additive; `GET /api/jobs/{jobId}` still returns the full diagnostic snapshot.
- The route must not return the full `events` array or workflow node execution history.
