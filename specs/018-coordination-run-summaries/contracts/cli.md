# CLI Contract: Coordination Run Summaries

## Command

`pnpm job:status -- --job-id <job-id> [--wait] [--poll-seconds <n>] [--control-plane-url <url>]`

## Purpose

Fetch the compact coordinator-facing run summary from the local control plane and print it as JSON.

## Expected Output

The command prints the same top-level payload shape used by HTTP API and MCP:

```json
{
  "summary": {
    "jobId": "uuid",
    "runId": "uuid",
    "attempt": 1,
    "taskId": "TASK-123",
    "runState": "succeeded",
    "phase": "terminal",
    "headline": "Created the requested pull request",
    "milestone": {
      "key": "terminal",
      "label": "Completed",
      "observedAt": "2026-05-17T01:10:00.000Z"
    },
    "updatedAt": "2026-05-17T01:10:00.000Z",
    "terminal": {
      "status": "succeeded",
      "summary": "Created the requested pull request"
    },
    "links": {
      "branch": "mystra/TASK-123-summary",
      "reviewUrl": "https://example.test/pr/42",
      "reviewDisplayId": "#42"
    }
  }
}
```

## Exit Codes

| Code | Meaning |
|---|---|
| `0` | One-shot fetch succeeded, or wait mode reached `succeeded` |
| `1` | Wait mode reached a failure-like terminal status (`failed`, `canceled`, `timed_out`, `needs_human_review`) |
| `3` | Job not found |
| `2` | Invalid arguments |
| `124` | Wait mode timed out |

## Notes

- `--wait` polls the compact summary route until terminal state.
- Existing `pnpm job:submit` may reuse the same summary route internally for wait-mode reporting.
- Root `package.json` must add a `job:status` script as part of the implementation slice.
