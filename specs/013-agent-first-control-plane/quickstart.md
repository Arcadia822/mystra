# Quickstart: Agent-First Control Plane

## Goal

Verify that Mystra can evolve into an agent-first control plane where project
inspection, work submission, run observation, and result retrieval are all
available through one canonical management contract before being packaged into
coordinating skills, CLI, MCP, or UI surfaces.

## Recommended Execution Order

1. Freeze the canonical management contract in `014-management-api-truth`.
2. Add multi-project lane identity in `015-multi-project-lanes`.
3. Build the coordinating skill surface in `016-agent-runtime-skills` and operator CLI in
   `017-operator-cli-surface`.
4. Add milestone/failure/result projections in
   `018-coordination-run-summaries`.

## Focused Verification Sequence

1. Run shared-contract tests after any schema or result-shape change:

   ```sh
   pnpm --filter @mystra/shared test
   ```

2. Run control-plane tests after any route, response-envelope, or adapter change:

   ```sh
   pnpm --filter @mystra/control-plane test
   ```

3. Run runner-daemon tests when run/result changes affect durable runner-facing
   state:

   ```sh
   pnpm --filter @mystra/runner-daemon test
   ```

4. Run workspace-wide type safety after cross-package changes:

   ```sh
   pnpm typecheck
   ```

## Manual Contract Check

Use one deployment with at least two configured projects:

```text
project 1: mystra
project 2: skrya
control plane: Debian-hosted Mystra
coordination client: external OpenClaw-style agent
```

Expected behavior:

1. A canonical programmatic surface can list and distinguish both projects.
2. The selected project's execution context is inspectable without opening the
   UI.
3. Work submission returns a durable handle that supports restart-safe polling.
4. Run observation returns structured state without requiring raw log scraping.
5. Final result retrieval returns a structured summary and delivery reference.
6. Derived skill and CLI behavior consume the same facts rather than inventing new
   semantics.

## Edge Verification

- Missing or archived project selection
- Invalid submission payload
- Run polled after control-plane restart
- Final result not yet available
- Two project lanes active on the same host
- MCP and UI still consuming the canonical contract instead of drifting away
