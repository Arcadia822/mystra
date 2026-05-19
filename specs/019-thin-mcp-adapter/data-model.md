# Data Model: Thin MCP Adapter

## Overview

`019` introduces no new persisted entities. It formalizes the boundary between
the existing MCP transport layer and the canonical management contract already
owned elsewhere.

## Entities

### ThinMcpAdapter

The route-local MCP surface implemented in `apps/control-plane/app/api/mcp/route.ts`.

**Responsibilities**

- accept JSON-RPC / MCP tool calls
- validate transport shape and tool arguments
- map valid tool calls to canonical management payloads
- keep transport failures transport-specific

### CanonicalManagementProjection

The embedded business payload returned through MCP after transport adaptation.

**Responsibilities**

- reuse canonical project, job, cancel, runner, and health meanings
- preserve shared machine-readable management errors for business failures
- avoid inventing route-local field names once a canonical management shape exists

### TransportError

An MCP- or JSON-RPC-level failure.

**Examples**

- invalid request envelope
- invalid tool arguments
- unknown method
- unknown tool

**Rules**

- stays in JSON-RPC error shape
- is not rewritten as a management business error

### ManagementErrorProjection

The shared business failure vocabulary transported through MCP.

**Examples**

- `PROJECT_NOT_FOUND`
- `PROJECT_ARCHIVED`
- `JOB_NOT_FOUND`
- `INVALID_SUBMISSION`

**Rules**

- preserves canonical code and message
- may remain embedded inside `content[].text` transport for compatibility
- must not be flattened into transport errors

## Relationships

```text
MCP client
  -> ThinMcpAdapter
    -> TransportError
    -> CanonicalManagementProjection
      -> ManagementErrorProjection (when business failure occurs)
```

## Invariants

1. The adapter owns transport envelopes, not business truth.
2. The adapter does not define a second project/job/run schema family.
3. Business payloads and business failures remain derivable from the canonical
   management contract.
4. Downstream skill and CLI surfaces should observe the same meanings whether
   they read through HTTP or MCP.
