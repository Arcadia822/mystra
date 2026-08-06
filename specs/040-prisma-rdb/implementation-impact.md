# Implementation impact

## Approved break surface

The first Prisma phase deliberately removes Session, Runner, ContextBundle, session event,
artifact, and summary persistence, plus obsolete Project execution defaults/snapshots and Task
source/objective/snapshots. No compatibility columns, tables, aliases, stubs, or raw SQL fallback
were added.

## Current compile impact

Evidence captured on 2026-08-06 after the three-table provider landed:

- `@mystra/shared` typecheck and all 131 shared tests pass after replacing legacy Project/Task/
  Connection fixtures and the Artifact-shaped execution-spec fixture.
- `@mystra/control-plane` typecheck reports 179 errors across approved upper break surfaces.
- full workspace tests reach control-plane and report 19 failures there; shared and
  agent-adapters pass (131 and 6 tests respectively). The failures are concentrated in legacy
  Project resolution, GitHub App/Connection API fixtures, and removed route behavior.
- API/MCP/Runner routes still call removed Session/Runner/ContextBundle/event/summary methods.
- several routes and the Integration registry still treat async `getDb()`/CRUD as synchronous.
- UI and onboarding code still read removed Project repository snapshots/execution defaults,
  Task objective/session summaries, and legacy IntegrationConnection top-level GitHub fields.
- old GitHub credential/PAT tests still import the deleted raw-SQL `SqliteRdbProvider`.

These failures are not evidence that Prisma CRUD is untested. The scoped persistence suite passes
schema parity, safe error normalization, config/lifecycle, SQLite and adoption contracts. The
upper surfaces require separate product redesign specifications; restoring deleted persistence to
silence them is prohibited.

## External database evidence

- SQLite empty migration `deploy + status`: executed successfully.
- SQLite Prisma provider contract: executed successfully.
- SQLite schema-v5 adoption and repeat-run behavior: executed successfully.
- PostgreSQL provider contract: implemented and explicitly skipped when
  `MYSTRA_TEST_POSTGRES_URL` is absent.
- Supabase configuration/direct-migration routing: unit/manual configuration validation only;
  cloud connectivity was not executed because no external project credentials were supplied.
- No local PostgreSQL server, `psql`, Docker daemon, or `MYSTRA_TEST_POSTGRES_URL` was available,
  so a live PostgreSQL migration/provider run could not be fabricated and remains external evidence.

## Tooling observation

On the current macOS/Node 24.14.0 workstation, Prisma 7.9.1's schema engine exited without a
diagnostic unless its migration subprocess had `RUST_LOG=info`. The migration wrapper scopes that
environment value to the child process; runtime Prisma clients are unaffected. This is an observed
toolchain behavior, not a domain contract.

`pnpm audit --prod` could not reach the configured Tencent npm mirror during this run. Dependency
audit therefore remains unverified; the failure was network resolution, not an empty vulnerability
report.

GitNexus `detect_changes` was run before commits as required, but the configured service indexes the
dirty main checkout rather than this isolated worktree. Its 65-file/198-symbol CRITICAL report was
dominated by unrelated UI/theme changes and cannot be attributed to 040; scoped git diffs and tests
are the authoritative change evidence for this branch.
