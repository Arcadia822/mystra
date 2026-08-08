# Verification: 046 Agent Definition

**Date**: 2026-08-08
**Branch**: `046-agent-definition`
**Verdict**: PASS WITH ONE DECLARED ENVIRONMENTAL SKIP

## Delivered contract

- Agent is Team-scoped and has no Project, Task or Session ownership field.
- Its only effect-related configuration is `systemPrompt`; identity, name,
  revision, lifecycle and timestamps are management metadata.
- Session composition contracts keep Runtime, Provider, Agent and Context
  independent. Project and Task are separate optional `0..1` references and do
  not enter Agent persistence or management APIs.
- Agent management is available through `RdbProvider`, canonical HTTP, five MCP
  tools and five operator CLI commands.
- Public `codex|copilot` execution keys use Provider terminology without a
  pre-0.1 compatibility alias.

## Automated gates

| Gate | Result |
| --- | --- |
| `pnpm test` | PASS: shared 149, adapters 6, control-plane 203, runner 7 |
| PostgreSQL provider suite | SKIP: 12 tests; `MYSTRA_TEST_POSTGRES_URL` unavailable |
| `pnpm typecheck` | PASS: all four workspace projects |
| `pnpm db:validate` | PASS: SQLite and PostgreSQL Prisma schemas |
| `pnpm build` | PASS: production build includes all three `/api/agents` routes |
| `git diff --check` | PASS |
| Spec Kit doctor | PASS for 046; historical 042 still lacks plan/tasks |

The Next.js build emitted existing Sentry configuration/deprecation warnings;
compilation, TypeScript, static generation and route collection all completed.

## Persistence and runtime evidence

- A disposable SQLite database applied all five migrations successfully.
- The resulting `agents` table contained exactly `id`, `team_id`, `name`,
  `system_prompt`, `revision`, `status`, `archived_at`, `created_at`, and
  `updated_at`.
- A production Next server returned the authenticated Agent API.
- The real operator CLI implementation (`run`, real `fetch`, filesystem session
  store, injected password reader for the non-interactive harness) completed
  login plus create/list/update/inspect/archive/default-list/archived-list.
- The observed Agent moved from revision 1 to revision 2 and ended archived;
  the default list excluded it and `--include-archived` included it.
- The disposable database and CLI session directory were moved to the user's
  Trash after the server was stopped.

## Code intelligence and review

- Pre-edit impact analysis classified `RdbProvider` and `PrismaRdbProvider` as
  CRITICAL and the Prisma delegate wrapper as HIGH. This was expected for an
  additive cross-boundary contract and was reported before edits.
- The refreshed graph contains 7,943 nodes, 13,004 edges, 136 clusters and 300
  flows.
- `detect_changes(scope=compare, base_ref=main)` reported 183 changed symbols,
  16 affected flows and CRITICAL aggregate risk. Each affected flow belongs to
  the intended RDB, Agent HTTP/MCP authorization, Runtime Provider naming or
  mapping surface; no unrelated execution process was found.
- Five-axis code review found and fixed strict revision parsing, one stale CLI
  Provider flag example, and one generated GitNexus instruction regression.

## Scope exclusions preserved

- No Session table, lifecycle, launch endpoint or execution orchestration.
- No Task or Project persistence redesign in 046; durable docs identify their
  current pre-0.1 mismatch for a separate specification.
- No Agent UI, skills/tools/model/provider/runtime/context fields, secret
  storage, Project filters or Project Agent/Runtime fallback. The stale operator
  `projects create` command was removed because its payload no longer matched the
  canonical Project contract; list and inspect remain available.
