# Contract: Operator CLI Outcomes

## Exit Codes

| Exit code | Meaning |
|---|---|
| `0` | Success |
| `2` | Usage / invalid command |
| `3` | Transport or invalid response failure |
| `4` | Missing resource (`PROJECT_NOT_FOUND`, `JOB_NOT_FOUND`, `RUN_NOT_FOUND`) |
| `5` | Conflict / unavailable / archived (`PROJECT_ARCHIVED`, `JOB_CANCEL_CONFLICT`, `RESULT_UNAVAILABLE`) |
| `6` | Invalid submission or request shape |
| `7` | Not ready (`RESULT_NOT_READY`) |

## Error Mapping

| Source | CLI code | Exit |
|---|---|---|
| Management error `PROJECT_NOT_FOUND` | `PROJECT_NOT_FOUND` | `4` |
| Management error `JOB_NOT_FOUND` | `JOB_NOT_FOUND` | `4` |
| Management error `RUN_NOT_FOUND` | `RUN_NOT_FOUND` | `4` |
| Management error `PROJECT_ARCHIVED` | `PROJECT_ARCHIVED` | `5` |
| Management error `RESULT_UNAVAILABLE` | `RESULT_UNAVAILABLE` | `5` |
| Management error `INVALID_SUBMISSION` | `INVALID_SUBMISSION` | `6` |
| Derived active-run result check | `RESULT_NOT_READY` | `7` |
| Network / parse failure | `TRANSPORT_ERROR` | `3` |

## JSON Failure Shape

```json
{
  "ok": false,
  "code": "RESULT_NOT_READY",
  "message": "Run result is not ready yet.",
  "payload": {
    "jobId": "..."
  }
}
```

## Human Failure Shape

```text
ERROR RESULT_NOT_READY: Run result is not ready yet.
jobId: 1234
runState: running
```
