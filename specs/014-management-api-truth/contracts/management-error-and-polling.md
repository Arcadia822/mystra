# Contract: Management Error And Polling Semantics

## Shared Error Envelope

All canonical management errors must use one structured envelope:

```json
{
  "error": {
    "code": "PROJECT_NOT_FOUND",
    "message": "Project not found: skrya",
    "details": {
      "slug": "skrya"
    }
  }
}
```

## Required Error Codes

At minimum, this slice must normalize:

- `PROJECT_NOT_FOUND`
- `PROJECT_ARCHIVED`
- `INVALID_PROJECT`
- `PROJECT_SLUG_CONFLICT`
- `INVALID_SUBMISSION`
- `JOB_NOT_FOUND`
- `RUN_NOT_FOUND` (only if run-id reads remain distinct from job-id reads)
- `JOB_CANCEL_CONFLICT` (for example, a cancel request against a terminal job)
- `RESULT_NOT_READY`
- `RESULT_UNAVAILABLE`

Exact names may expand, but route-local ad hoc strings are not acceptable.

## Polling Semantics

The canonical polling contract is one read model:

```text
GET /api/jobs/{id}
  -> latest durable run snapshot
  -> includes terminal result at `run.result` when present
  -> includes enough project identity to keep attribution unambiguous
```

## Rules

1. Polling must not require multiple unrelated client-side reads.
2. Not-ready, missing, failed, and terminal-success cases must be distinct. For
   the single `GET /api/jobs/{id}` snapshot in `014`, "not ready yet" is
   represented by a non-terminal `run.state` and an absent `run.result`, rather
   than by a separate polling error response.
3. MCP may wrap the payload for transport, but must not invent a different
   polling meaning.
4. Future coordinating skills and CLI consumers, and any later SDK, must treat
   this canonical snapshot as their source of truth.
5. HTTP route changes and MCP semantic changes must ship together, or not ship at
   all, so agents never observe a mixed vocabulary window.
