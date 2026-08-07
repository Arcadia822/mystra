# Implementation impact

## Approved break surface

The first Prisma phase deliberately removes Session, Runner, ContextBundle, session event,
artifact, and summary persistence, plus obsolete Project execution defaults/snapshots and Task
source/objective/snapshots. No compatibility columns, tables, aliases, stubs, or raw SQL fallback
were added.

## Current upper-surface status

Evidence refreshed on 2026-08-07 after the owner authorized temporary upper-surface disablement:

- IntegrationConnection, Project, and Task HTTP/MCP callers now await the asynchronous
  `RdbProvider` contract and use the current three-table schemas.
- Session, Runner, ContextBundle, event, result, repository-credential, summary, and Task
  child-Session API routes are absent. MCP advertises only Task CRUD/health tools from this phase.
- direct `/sessions/:id` and `/runners/:id` Web routes remain reachable as explicit unavailable
  states; Inbox also reports that Session review persistence is unavailable. These pages issue no
  removed database calls and do not fabricate empty records.
- Project and Task pages render only retained relational identity/metadata. New Task intake stores
  a generic `metadata.title`; it does not restore source/objective/snapshot fields in metadata.
- the full workspace lint, typecheck, tests, build, both Prisma schema validations, and terminology
  audit pass. Runtime validation used a migrated temporary SQLite database and a production Next.js
  server; `/`, `/runners`, `/sessions/:id`, and `/inbox` rendered without browser console warnings
  or errors. Removed API paths returned 404 while retained Task/Project/control-plane paths returned
  200.

Future Session persistence, Runner capacity, Context delivery, and Issue-to-Session dispatch remain
separate redesign work. The explicit unavailable UI is a temporary product state, not a persistence
compatibility layer.

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

The configured Tencent npm mirror still cannot serve `pnpm audit`, but a retry against the official
npm registry completed. The existing lockfile reports 42 advisories: 23 high, 15 moderate, and 4
low. High findings include Next.js 16.2.4 and transitive Prisma tooling dependencies. No dependency
was added by this upper-surface cleanup; framework/toolchain remediation requires a separately
scoped dependency upgrade and regression pass.

GitNexus `detect_changes` was run before commits as required, but the configured service indexes the
dirty main checkout rather than this isolated worktree. Its 65-file/198-symbol CRITICAL report was
dominated by unrelated UI/theme changes and cannot be attributed to 040; scoped git diffs and tests
are the authoritative change evidence for this branch.
