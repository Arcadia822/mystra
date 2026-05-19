# Contract: MCP Error Boundary

## Purpose

Define where transport errors stop and canonical management business errors
begin in Mystra's MCP adapter.

## Transport Errors

These remain JSON-RPC / MCP-local:

- invalid request envelope
- invalid tool arguments
- unknown method
- unknown tool

**Rules**

- return JSON-RPC error objects
- include transport-local context such as `tool` or `issues` when helpful
- do not rewrite these as management business failures

## Business Errors

These remain canonical management failures transported through MCP:

- `PROJECT_NOT_FOUND`
- `PROJECT_ARCHIVED`
- `INVALID_SUBMISSION`
- `JOB_NOT_FOUND`
- `JOB_CANCEL_CONFLICT`

**Rules**

- preserve canonical machine-readable error code
- preserve canonical human-readable message
- return them inside the MCP success/result wrapper when the transport itself is valid

## Compatibility Rule

Transport wrapping may stay text-based for compatibility. The thinness contract is
about preserving meaning, not forcing a new wrapper shape before clients need it.
