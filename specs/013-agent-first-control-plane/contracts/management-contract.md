# Contract: Canonical Management Contract

## Purpose

Reserve the stable action set and envelope vocabulary for Mystra's agent-first
management path. `014-management-api-truth` will freeze the concrete route and
payload details, but `013` defines the required contract ownership and action
surface now.

## Required Actions

| Action | Purpose | Minimum output |
|---|---|---|
| List projects | Distinguish available coordination targets | Project identifiers plus enough metadata to choose the right target |
| Get project | Inspect execution context for one project | Repository identity, base branch, runtime contract inputs, context/workflow facts |
| Submit work | Start execution for a selected project | Durable handle plus initial state |
| Get run | Poll current run state | Structured queued/running/terminal snapshot |
| Get result | Retrieve terminal outcome | Final summary plus any branch/review artifact reference |

## Canonical Envelope Rules

### Success

All canonical management actions must return machine-readable typed payloads
derived from shared Zod schemas. Transport-specific formatting layers may wrap
these payloads, but the underlying contract must stay typed and stable.

### Error

All canonical management actions must return one consistent structured error
envelope:

```json
{
  "error": {
    "code": "PROJECT_NOT_FOUND",
    "message": "Requested project does not exist",
    "details": {
      "project": "skrya"
    }
  }
}
```

Required characteristics:

- `code` is machine-readable and stable
- `message` is human-readable
- `details` is optional structured context
- transport adapters may map status codes or JSON-RPC codes, but they must not
  flatten the underlying management error into ad hoc text

## Ownership Rules

1. The canonical management contract is owned by the control-plane API plus
   shared contract schemas.
2. The coordinating skill surface must derive from the canonical management
   contract and shared envelopes.
3. The operator CLI must derive from the same contract and express failures
   without inventing a separate truth.
4. MCP may adapt the canonical contract to tool calls, but must not become a
   competing semantic owner.
5. UI pages may consume the canonical contract, but UI-only availability does
   not count as feature completion.

## Non-Goals

- This document does not freeze exact route names; that belongs to `014`.
- This document does not define coordination-summary projection details; that
  belongs to `018`.
- This document does not redefine existing durable `Project`, `Job`, `Run`, or
  `RunResult` storage ownership.
