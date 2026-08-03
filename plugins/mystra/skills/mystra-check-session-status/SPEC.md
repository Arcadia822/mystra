# Mystra Check Session Status Specification

## Intent

Provide a compact, read-only MCP workflow for one canonical Mystra Session.

## Scope

- In scope: Session detail, parent Task identity, state, result, review URL.
- Out of scope: Task-wide status, internal execution facts, retries, mutation.

## Trigger Context

- Trigger for requests to inspect a known Mystra Session ID.
- Do not trigger for general Task discovery or Runner health.

## Runtime Contract

- Require `sessionId` and call `mystra_get_session` once.
- Report missing resources and transport failure explicitly.
- Never present internal facts as independent objects.

## Validation

- Pass Agent Skills structural validation.
- Verify tool name and arguments against the current MCP route tests.

## Maintenance

Update when the canonical Session detail contract or MCP tool name changes.
