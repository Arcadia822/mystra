# Research: MCP Server Development

## Current Reality

The current MCP route already supports the nine tools named in `spec.md`:

1. `mystra_create_context_bundle`
2. `mystra_list_context_bundles`
3. `mystra_create_job`
4. `mystra_create_project`
5. `mystra_list_projects`
6. `mystra_get_project`
7. `mystra_get_job`
8. `mystra_cancel_job`
9. `mystra_list_runners`

This means the feature gap is not "build an MCP server from scratch". The gap is
targeted: missing health ergonomics, under-specified error semantics, and
missing backfilled Spec-Kit artifacts.

## Audit Findings

### Observation is mostly present already

- `mystra_get_job` already returns the persisted `JobSnapshot`, including job
  spec, run state, events, project/runtime context, and result when available.
- Existing route tests already cover cancellation requests, runner observation,
  lifecycle metadata, and MCP job creation.

### Health is the clearest missing tool

- `RdbProvider.listRunners()` exposes `lastHeartbeatAt`, `staleAfterSeconds`,
  `activeRunCount`, and runner capability metadata.
- `RdbProvider.markStaleRunners()` proves the persistence layer already encodes
  stale-runner semantics.
- No MCP tool currently exposes a quick "safe to submit work?" answer.

### Shared HTTP error handling should not be widened casually

GitNexus impact analysis shows:

- `textToolResult`: low blast radius
- `jsonError`: critical blast radius across multiple control-plane routes

Therefore the first implementation slice should localize MCP-specific error
handling in the MCP route instead of refactoring the shared HTTP helper.

## Deferred / Non-First-Slice Items

- **Workflow blueprint association**: mentioned in `spec.md`, but not honest to
  implement before `specs/005-workflow-blueprint/` lands concrete ownership.
- **Streaming observation**: the current spec mentions poll or stream. Polling is
  already supported by repeated `mystra_get_job`; streaming can remain future
  work unless the repository grows a real MCP streaming transport.
