# Implementation Plan: Config-First Headless Runner Durability

**Branch**: `003-config-first-runner-durability` | **Date**: 2026-05-10 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/003-config-first-runner-durability/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Keep runner durability small and configuration-driven. The runner remains a
headless pull worker whose local configuration controls concurrency, polling,
timeouts, cancellation checks, cleanup timeout, and eligible work scope. The
control plane remains the durable fact store for desired run state and runner
observations. Cancellation and timeout cleanup happen locally in the runner;
stale runners and their active work are marked from durable timestamps without
introducing a central scheduler, retry API, or cross-runner rebalance.

## Technical Context

**Language/Version**: TypeScript 5.9 with Node.js 24 runtime assumptions  
**Primary Dependencies**: Next.js 16 route handlers, Zod 4 shared schemas, Vitest 4, existing `better-sqlite3` provider, Node `child_process` for runner execution  
**Storage**: SQLite via `SqliteRdbProvider`, behind `RdbProvider` so future PG/Supabase compatibility is preserved  
**Testing**: Vitest package tests plus TypeScript typecheck; focused runner-daemon tests for config/watchdog behavior  
**Target Platform**: Private Linux runner host with Docker sandbox workloads and outbound-only runner connection to the control plane
**Project Type**: TypeScript monorepo with Next.js control plane, Node runner daemon, shared contracts, and local scripts  
**Performance Goals**: Runner claim/poll path stays bounded; a configured runner never exceeds local concurrency; stale evaluation is a cheap durable-state scan rather than a scheduling loop  
**Constraints**: Do not add a central capacity scheduler, queue priority system, cross-runner rebalance, public retry API, logs API, callback URLs, Kubernetes-style controller, cross-runner shared cache, caller auth, or per-repository secret management  
**Scale/Scope**: MVP single-machine Docker runner model; multiple runners may exist but are independently configured headless workers, not a centrally scheduled fleet

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Specification Owns Product Boundaries**: PASS. The plan preserves MVP exclusions and explicitly rejects scheduler/retry/log/callback/Kubernetes expansion.
- **Typed Contracts at Service Boundaries**: PASS. Runner config, registration, claim eligibility, cancellation observation, timeout observation, stale marking, and result states are represented through shared schemas/provider methods.
- **Providers Are Replaceable Boundaries**: PASS. The runner-local watchdog sits in the runner daemon; the control plane only records desired/observed state through `RdbProvider`.
- **Runner Isolation and Secret Hygiene**: PASS. Work remains within single-machine Docker runner boundaries; this feature does not alter secret injection or mount policy.
- **Verification And Documentation Before Delivery**: PASS. The plan adds contract/provider/runner tests and feature docs before implementation completion.

## Project Structure

### Documentation (this feature)

```text
specs/003-config-first-runner-durability/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── runner-config.md
│   └── runner-state.md
└── checklists/
    └── requirements.md
```

### Source Code (repository root)

```text
packages/shared/src/
├── schemas.ts              # runner config, runner observation, stale state schemas
├── schemas.test.ts
├── state.ts                # run state transition helpers if needed
└── state.test.ts

apps/control-plane/
├── app/api/runner/
│   ├── register/route.ts   # registration accepts config-derived capability fields
│   ├── heartbeat/route.ts  # heartbeat remains thin durable observation
│   └── jobs/
│       ├── route.ts        # claim remains pull-based and eligibility-bound
│       ├── [id]/events/route.ts
│       └── [id]/result/route.ts
├── app/api/jobs/[id]/cancel/route.ts
├── app/api/routes.test.ts
└── src/lib/db/
    ├── rdb-provider.ts
    ├── sqlite-provider.ts
    └── sqlite-provider.test.ts

apps/runner-daemon/src/
├── index.ts                # local config, watchdog loop, cleanup/reporting
└── container-task.test.ts  # existing source-level runner behavior tests
```

**Structure Decision**: Keep the current monorepo layout. Shared config/state
contracts live in `packages/shared/src/schemas.ts`. Durable ownership remains in
`RdbProvider` and `SqliteRdbProvider`. Runner-local behavior stays in
`apps/runner-daemon/src/index.ts`, where the current `readConfig -> register ->
heartbeat -> claim -> executeJob` loop already exists. No new scheduler package
or worker orchestration service is introduced.

## Phase 0 Research Summary

Detailed decisions live in [research.md](./research.md).

Key conclusions:

1. Preserve a config-first runner model rather than adding central scheduling.
2. Split desired state from runner observations.
3. Keep timeout and cleanup local to the runner.
4. Mark stale sessions/runs durably without retry or rebalance.
5. Treat GitNexus evidence as partially stale because `npx gitnexus analyze`
   failed during planning; compensate with direct source inspection.

## Phase 1 Design Summary

Generated artifacts:

- [data-model.md](./data-model.md)
- [quickstart.md](./quickstart.md)
- [contracts/runner-config.md](./contracts/runner-config.md)
- [contracts/runner-state.md](./contracts/runner-state.md)

The first build slice should be:

1. Add shared runner config schema for local config-derived values:
   concurrency, poll interval, stale window, execution timeout, cancel check
   interval, cleanup timeout, and eligibility scope.
2. Extend registration and runner session persistence only as far as needed to
   store config-derived observation fields.
3. Change cancellation from immediate terminal state for assigned/running work
   into durable cancellation requested state, leaving queued cancellation
   terminal if no runner owns it.
4. Add runner-local watchdog behavior for timeout/cancel cleanup and result
   reporting.
5. Add stale marking from durable timestamps without retry/reassignment.

## GitNexus / Code Evidence

- GitNexus index for `mystra` was 3 commits behind; `npx gitnexus analyze`
  failed with `Cannot destructure property 'package' of 'node.target' as it is null`.
- Existing `SqliteRdbProvider.claimNextRun` is the current assignment boundary.
  GitNexus found it in `apps/control-plane/src/lib/db/sqlite-provider.ts` and
  connected it to provider tests plus execution flows such as `ClaimNextRun -> Now`.
- Existing runner daemon `main` calls `readConfig`, `register`, heartbeat,
  claim, and `executeJob`; this is already the correct headless loop shape.
- API impact for `/api/runner/jobs` is LOW with no detected frontend consumers,
  but it affects runner route flows and must still be covered by route tests.
- Direct source inspection confirmed current cancellation immediately
  transitions to `canceled` and decrements runner capacity if assigned; this
  must be revisited so runner-owned cleanup is not bypassed.

## Verification Plan

| Surface | Evidence |
|---|---|
| Shared schemas | `pnpm --filter @mystra/shared test` |
| SQLite provider transitions | `pnpm --filter @mystra/control-plane test` |
| Runner route contracts | `pnpm --filter @mystra/control-plane test` |
| Runner config/watchdog behavior | `pnpm --filter @mystra/runner-daemon test` |
| Broad type safety | `pnpm typecheck` |
| Broad regression after implementation | `pnpm test` when touched surface justifies it |

## Risks And Mitigations

| Risk | Mitigation |
|---|---|
| Plan drifts into central scheduling | Keep eligibility and concurrency runner-local; control plane only stores facts and filters claims. |
| Assigned cancellation bypasses cleanup | Make assigned/running cancellation a desired state observed by runner; terminalize queued cancellation directly. |
| Stale marking becomes retry semantics | Mark stale/failed with reason only; defer retry/rebalance to a separate spec. |
| Active count becomes inconsistent | Prefer deriving active counts from active assigned/running states where practical; if keeping counters, make decrement idempotent and test duplicate terminal paths. |
| Runner-local config becomes hosted management | Read config at runner startup from env/file; no hosted runner CRUD in this slice. |

## Engineering Review

Review artifact: [checklists/engineering-review.md](./checklists/engineering-review.md)

Outcome: Proceed to tasks only after preserving the following constraints:

1. Do not add a new scheduler module or queue priority model.
2. Prefer durable run-state queries over mutable `activeRunCount` as the source
   of truth for local concurrency when feasible; if the counter remains, test
   duplicate terminal and stale paths.
3. Avoid adding new run-state enum values unless events plus existing states
   cannot represent cancellation requested and cleanup in progress.
4. Keep stale handling terminal/visible only; do not requeue, retry, or assign
   work elsewhere in this feature.

## Complexity Tracking

No constitution violations are required. The design is intentionally smaller
than a complete scheduler: config-first runner, durable facts, local cleanup,
and stale marking only.
