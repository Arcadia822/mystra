# CLI Contract Evidence

Date: 2026-07-23

## RED

The focused CLI suite first failed with usage exit code 2 for all new Issue and
Run wait commands. Existing Run inspection also still printed a workflow
projection.

## GREEN

```text
fnm exec --using 24.14.0 corepack pnpm --filter @mystra/control-plane exec vitest run src/lib/operator-cli.test.ts
Test Files  1 passed (1)
Tests       19 passed (19)
```

The injected-fetch tests prove:

- Issue list forwards limit and opaque cursor to the canonical API.
- Issue get uses the canonical Integration route.
- Issue dispatch resolves a Project slug through HTTP, then sends exactly one
  JSON POST with `projectId`, `agent`, and `branchName`.
- stable server errors and transport failures map to stable CLI exit codes.
- Run inspect exposes no workflow projection.
- Run wait polls the canonical Job endpoint, treats `waiting_for_review` as
  success, prints Issue/quality/preview/review/sandbox/image/Agent handoff data,
  and returns exit code 7 for a local timeout.

The CLI source imports only Node's `pathToFileURL`; it has no Linear, SQLite,
Integration implementation, or runner import.
