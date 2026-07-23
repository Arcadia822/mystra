# Pre-change Baseline

Recorded: 2026-07-23
Branch: `033-issue-agent-execution`
Commit: `29758b78d9f890f4584faf26fc1358c218467fde`

## Isolation

- Worktree: `/Users/arcadia/Documents/mystra-033-issue-agent-execution`
- The original `/Users/arcadia/Documents/mystra` dirty worktree was not modified.
- The feature worktree initially contained only the 033 Spec-Kit and durable-context
  documentation changes.

## GitNexus

The `mystra` index matches the feature base commit and contains 4,651 symbols,
6,976 relationships and 218 execution flows.

Upstream impact for
`Function:apps/runner-daemon/src/index.ts:executeDockerJob`:

- graph risk: LOW;
- direct caller: `executeJob`;
- transitive caller: `main`;
- affected indexed processes: 2;
- affected module clusters: 1.

Engineering treatment remains high-risk because the function also owns Docker launch,
secret delivery, lifecycle events, quality, preview and repository review handoff.
Every extracted behavior therefore requires a failing regression test before the
existing function is changed.

## Active workflow inventory

The focused search covered `apps/`, `packages/`, root package metadata and lockfile.
It found workflow abstractions in 15 active code/package files:

1. `apps/control-plane/app/api/mcp/route.ts`
2. `apps/control-plane/app/page.tsx`
3. `apps/control-plane/src/lib/db/sqlite-provider.ts`
4. `apps/runner-daemon/package.json`
5. `apps/runner-daemon/src/container-task.test.ts`
6. `apps/runner-daemon/src/index.ts`
7. `apps/runner-daemon/src/workflow-providers.test.ts`
8. `apps/runner-daemon/src/workflow-providers.ts`
9. `apps/workflows/package.json`
10. `apps/workflows/src/index.test.ts`
11. `apps/workflows/src/index.ts`
12. `packages/shared/src/management.ts`
13. `packages/shared/src/workflow.test.ts`
14. `packages/shared/src/workflow.ts`
15. `pnpm-lock.yaml`

Durable top-level documentation also contains obsolete WorkflowProvider descriptions
in `README.md`, `docs/SPEC.md` and `docs/IMPLEMENTATION-PLAN.md`. Historical
`specs/<older-feature>/` records are intentionally retained and excluded from the
active-code zero-result criterion.

## Database target

`find` found no `*.db`, `*.sqlite` or `*.sqlite3` file inside the feature worktree.
No historical database has been deleted. The real E2E must set and record one exact
disposable `MYSTRA_DB_PATH`; only that verified file may be removed before schema
initialization.

## Gate baseline

Required toolchain:

- Node `24.14.0`, invoked with `fnm exec --using 24.14.0`;
- pnpm `10.25.0`, invoked with `corepack pnpm`.

The isolated worktree required `pnpm install --frozen-lockfile`. pnpm's default build
allowlist skipped the native `better-sqlite3` install script, so its package-local
install script was run under Node 24 before the test baseline.

| Gate | Baseline |
|------|----------|
| `pnpm lint` | PASS |
| `pnpm typecheck` | PASS |
| `pnpm test` | PASS: shared 114, agent-adapters 6, workflows 8, control-plane 75, runner 89 |
| `pnpm build` | PASS |

The first pre-install and pre-native-build attempts failed only because dependencies
and the `better-sqlite3` binding did not yet exist; the pinned, fully installed
baseline is green.
