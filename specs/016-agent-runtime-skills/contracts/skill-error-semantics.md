# Contract: Coordinating Skill Error Semantics

## Purpose

Define how the local Mystra coordinating skills should talk about failure
without inventing a second error model.

`008-mcp-skills` remains the durable home of the skill surface. `016` uses these
rules to verify that the existing local skills still preserve canonical failure
meaning after the management API changes in `014` and `015`.

## Error Classes

### 1. Invalid local input

The skill was called with missing or malformed required inputs.

**Rules**

- fail before transport use
- say which required field or constraint is missing
- do not silently drop invalid values

### 2. Transport failure

The MCP endpoint is unreachable or the request cannot be completed.

**Rules**

- report it clearly as a connection / endpoint failure
- do not rewrite it as a business success or business error
- do not silently retry in the first slice

### 3. Canonical business failure

Mystra returned a structured failure such as `PROJECT_NOT_FOUND`,
`INVALID_SUBMISSION`, or `JOB_NOT_FOUND`.

**Rules**

- preserve the returned machine-readable meaning
- preserve the human-readable message
- summarize it for agents without flattening it into an unrelated generic error

## Summary Expectations

| Flow | Minimum successful summary | Minimum failure summary |
|---|---|---|
| Implementation request | `jobId`, `run.state`, branch / review handle when available | missing-input, transport-failure, or returned business error |
| User journey request | `jobId`, `run.state`, branch / review handle when available | missing-input, transport-failure, or returned business error |
| Job status | `jobId`, `taskId`, `run.state`, result / review handle when available | missing-job, transport-failure, or returned business error |

These expectations should be checked with explicit test fixtures against the
live canonical snapshot and error contracts.

## Non-Goals

- This document does not define a new error envelope.
- This document does not replace the canonical management error vocabulary in
  `packages/shared`.
- This document does not require a shared runtime helper or SDK abstraction.
