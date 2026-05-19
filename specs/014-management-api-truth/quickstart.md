# Quickstart: Management API Truth

## Goal

Verify that Mystra's canonical HTTP management API is the product truth for
project inspection, work submission, run observation, and result retrieval.

## Focused Verification Sequence

1. Run shared contract tests after any management schema change:

   ```sh
   pnpm --filter @mystra/shared test
   ```

2. Run control-plane route and MCP parity tests after any API change:

   ```sh
   pnpm --filter @mystra/control-plane test
   ```

3. Run runner-daemon tests when restart/result behavior is asserted through the
   canonical snapshot:

   ```sh
   pnpm --filter @mystra/runner-daemon test
   ```

4. Run broad type safety after cross-package changes:

   ```sh
   pnpm typecheck
   ```

## Manual Contract Check

Use one trusted local deployment with at least two configured projects:

```text
project 1: mystra
project 2: skrya
control plane: localhost or trusted internal network only
```

Expected behavior:

1. `GET /api/projects` returns enough structured data to distinguish both
   projects.
2. `GET /api/projects/{slug}` returns execution context without UI lookups.
3. `POST /api/jobs` returns a durable initial snapshot or a structured error.
4. `GET /api/jobs/{id}` returns one canonical run snapshot, not an incomplete
   fragment that forces client-side fan-out.
5. HTTP and MCP business-failure paths both use the same structured management
   error vocabulary for missing, archived, invalid, and not-found cases.
6. After restart, the latest durable terminal snapshot and `run.result` remain
   retrievable.
7. Concurrent `mystra` and `skrya` runs remain distinguishable through the
   embedded project lane identity in each snapshot.

## Edge Verification

- missing project
- archived project
- invalid submission payload
- result not ready yet is represented by non-terminal `run.state` with no `run.result`
- result missing vs run missing
- restart during polling
- concurrent `mystra` and `skrya` runs stay attributable

## Trust Boundary

This first-slice API is a **private-ops** surface only. It is intended for
localhost or a trusted internal network until caller auth exists.
