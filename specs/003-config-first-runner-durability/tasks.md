# Tasks: Config-First Headless Runner Durability

**Input**: Design documents from `/specs/003-config-first-runner-durability/`
**Prerequisites**: [spec.md](./spec.md), [plan.md](./plan.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [checklists/engineering-review.md](./checklists/engineering-review.md)

**Tests**: Included because the spec requires independent durability, cancellation, timeout, stale visibility, and restart evidence.

**Organization**: Tasks are grouped by technical scenario so each scenario can be implemented and tested as an independently useful slice.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it touches different files and does not depend on incomplete tasks.
- **[Story]**: Maps to technical scenarios in [spec.md](./spec.md).
- Every task includes exact file paths.

## Phase 1: Setup

**Purpose**: Confirm the feature directory and local evidence path before implementation starts.

- [ ] T001 Run `.specify/scripts/bash/check-prerequisites.sh --json` from `/Users/arcadia/Documents/mystra` and confirm `/Users/arcadia/Documents/mystra/specs/003-config-first-runner-durability` is the active feature directory.
- [ ] T002 [P] Re-run or record the GitNexus fallback in `/Users/arcadia/Documents/mystra/specs/003-config-first-runner-durability/quickstart.md` if `npx gitnexus analyze` still fails.
- [ ] T003 [P] Inspect existing runner/control-plane tests in `/Users/arcadia/Documents/mystra/apps/control-plane/app/api/routes.test.ts`, `/Users/arcadia/Documents/mystra/apps/control-plane/src/lib/db/sqlite-provider.test.ts`, `/Users/arcadia/Documents/mystra/apps/runner-daemon/src/container-task.test.ts`, `/Users/arcadia/Documents/mystra/packages/shared/src/schemas.test.ts`, and `/Users/arcadia/Documents/mystra/packages/shared/src/state.test.ts` before adding new assertions.

---

## Phase 2: Foundational

**Purpose**: Add shared contracts and provider surfaces that block all scenarios.

**Critical**: No scenario implementation should start until these contracts are in place.
This phase must preserve the plan's state-representation rule: do not add
`cancellation_requested`, `cleanup_in_progress`, or `stale` to `RunState`.

- [ ] T004 [P] Add runner local config, eligibility, observation, cancellation-request metadata, cancellation-outcome, cleanup observation, and stale-result Zod schemas/types in `/Users/arcadia/Documents/mystra/packages/shared/src/schemas.ts`; do not add new `RunState` enum values.
- [ ] T005 [P] Add shared schema tests for runner config defaults, eligibility lists, observation payloads, and invalid timeout/concurrency values in `/Users/arcadia/Documents/mystra/packages/shared/src/schemas.test.ts`.
- [ ] T006 Keep `/Users/arcadia/Documents/mystra/packages/shared/src/state.ts` `RunState` values unchanged; only add helper predicates or comments if needed to define existing active and terminal state sets.
- [ ] T007 Add run-state tests proving cancellation request, cleanup progress, and stale evaluation are not first-class `RunState` transitions; preserve timeout/canceled/failed terminal-state immutability in `/Users/arcadia/Documents/mystra/packages/shared/src/state.test.ts`.
- [ ] T008 Extend `RunnerSession`, `RegisterRunnerInput`, cancellation request metadata, cancellation outcome, runner observation, cleanup observation, and stale marking provider types in `/Users/arcadia/Documents/mystra/apps/control-plane/src/lib/db/rdb-provider.ts`.
- [ ] T009 Update SQLite schema fields/indexes for config-derived runner visibility, eligibility metadata, stale timestamps/reasons, and desired cancellation metadata in `/Users/arcadia/Documents/mystra/apps/control-plane/src/lib/db/migrations.ts`; do not encode cancellation/cleanup/stale as run-state enum migrations.
- [ ] T010 Update row parsing and serialization helpers for the new runner/run fields in `/Users/arcadia/Documents/mystra/apps/control-plane/src/lib/db/sqlite-provider.ts`.
- [ ] T011 [P] Add migration/provider fixture coverage for existing databases and new runner/run fields in `/Users/arcadia/Documents/mystra/apps/control-plane/src/lib/db/sqlite-provider.test.ts`.

**Checkpoint**: Shared schemas, provider types, and SQLite persistence compile and have focused tests before any route or runner behavior changes.

---

## Phase 3: Technical Scenario 1 - Runner Runs From Local Config (Priority: P1)

**Goal**: Runner startup config controls concurrency, polling, timeout intervals, cleanup intervals, and eligibility scope.

**Independent Test**: Start or simulate a runner config with concurrency `2`, project/runtime eligibility, and interval settings; verify only eligible work is claimed and the runner never owns more than two active jobs.

### Tests for Technical Scenario 1

- [ ] T012 [P] [US1] Add runner config parsing tests for env/file defaults, numeric validation, and eligibility scope in `/Users/arcadia/Documents/mystra/apps/runner-daemon/src/container-task.test.ts`.
- [ ] T013 [P] [US1] Add control-plane route tests for runner registration storing config-derived concurrency and eligibility in `/Users/arcadia/Documents/mystra/apps/control-plane/app/api/routes.test.ts`.
- [ ] T014 [P] [US1] Add SQLite provider tests proving `claimNextRun` respects runner concurrency, project eligibility, and runtime provider eligibility in `/Users/arcadia/Documents/mystra/apps/control-plane/src/lib/db/sqlite-provider.test.ts`.
- [ ] T015 [P] [US1] Add SQLite provider tests proving runner active work is calculated from durable assigned/starting/running runs instead of `activeRunCount` in `/Users/arcadia/Documents/mystra/apps/control-plane/src/lib/db/sqlite-provider.test.ts`.

### Implementation for Technical Scenario 1

- [ ] T016 [US1] Extend `RunnerConfig` and `readConfig` with concurrency, poll interval, stale window, execution timeout, cancellation check interval, cleanup timeout, eligible project ids, and eligible runtime providers in `/Users/arcadia/Documents/mystra/apps/runner-daemon/src/index.ts`.
- [ ] T017 [US1] Send config-derived concurrency and eligibility metadata during runner registration in `/Users/arcadia/Documents/mystra/apps/runner-daemon/src/index.ts`.
- [ ] T018 [US1] Parse and persist config-derived runner registration fields in `/Users/arcadia/Documents/mystra/apps/control-plane/app/api/runner/register/route.ts` and `/Users/arcadia/Documents/mystra/apps/control-plane/src/lib/db/sqlite-provider.ts`.
- [ ] T019 [US1] Apply project/runtime eligibility filtering and local concurrency limits in `claimNextRun`, calculating active work from durable active runs instead of `activeRunCount`, in `/Users/arcadia/Documents/mystra/apps/control-plane/src/lib/db/sqlite-provider.ts`.
- [ ] T020 [US1] Replace the fixed single-job loop with bounded local active-job supervision that respects configured `concurrency` and `pollIntervalSeconds` in `/Users/arcadia/Documents/mystra/apps/runner-daemon/src/index.ts`.

**Checkpoint**: `pnpm --filter @mystra/shared test`, `pnpm --filter @mystra/control-plane test`, and `pnpm --filter @mystra/runner-daemon test` should pass for config-first claiming.

---

## Phase 4: Technical Scenario 2 - Control Plane Stores Desired And Observed State (Priority: P1)

**Goal**: The control plane durably records cancellation intent and runner observations without becoming a live scheduler.

**Independent Test**: Submit, claim, cancel, complete, and restart control-plane/provider state; verify desired and observed states remain explainable from SQLite records and events.

### Tests for Technical Scenario 2

- [ ] T021 [P] [US2] Add provider tests for queued cancellation terminalizing immediately while assigned/running cancellation records desired request metadata in `/Users/arcadia/Documents/mystra/apps/control-plane/src/lib/db/sqlite-provider.test.ts`.
- [ ] T022 [P] [US2] Add route tests for `/api/jobs/[id]/cancel`, `/api/runner/jobs/[id]/events`, and `/api/runner/jobs/[id]/result` desired request/observed response fields in `/Users/arcadia/Documents/mystra/apps/control-plane/app/api/routes.test.ts`.
- [ ] T023 [P] [US2] Add restart-style provider tests that reopen the SQLite database and verify queued, assigned, running, cancellation request metadata, terminal outcomes, and event records in `/Users/arcadia/Documents/mystra/apps/control-plane/src/lib/db/sqlite-provider.test.ts`.

### Implementation for Technical Scenario 2

- [ ] T024 [US2] Change `cancelJob` to return a typed cancellation outcome and record desired cancellation metadata plus a visible event for assigned/running work in `/Users/arcadia/Documents/mystra/apps/control-plane/src/lib/db/sqlite-provider.ts`; do not transition assigned/running work to a new cancellation-requested run state.
- [ ] T025 [US2] Update `/api/jobs/[id]/cancel` to expose cancellation-requested vs canceled outcomes without adding a public retry/log/callback surface in `/Users/arcadia/Documents/mystra/apps/control-plane/app/api/jobs/[id]/cancel/route.ts`.
- [ ] T026 [US2] Add runner observation validation and idempotency checks for cleanup, canceled, timed-out, failed, and completed observations in `/Users/arcadia/Documents/mystra/apps/control-plane/src/lib/db/sqlite-provider.ts`.
- [ ] T027 [US2] Update `/api/runner/jobs/[id]/events` and `/api/runner/jobs/[id]/result` to use the new observation contracts in `/Users/arcadia/Documents/mystra/apps/control-plane/app/api/runner/jobs/[id]/events/route.ts` and `/Users/arcadia/Documents/mystra/apps/control-plane/app/api/runner/jobs/[id]/result/route.ts`.

**Checkpoint**: Control-plane tests should show cancellation request metadata and runner observations surviving provider restart without any scheduler or retry behavior.

---

## Phase 5: Technical Scenario 3 - Runner Owns Local Timeout And Cleanup (Priority: P1)

**Goal**: The runner observes cancellation/timeout locally, stops execution, performs cleanup, and reports durable outcomes.

**Independent Test**: Run or simulate one timed-out job and one cancellation-requested job; verify the runner stops local execution, applies cleanup timeout, and reports timed-out/canceled or cleanup-failed outcomes.

### Tests for Technical Scenario 3

- [ ] T028 [P] [US3] Add runner-daemon tests for timeout watchdog behavior and cleanup-failure reporting in `/Users/arcadia/Documents/mystra/apps/runner-daemon/src/container-task.test.ts`.
- [ ] T029 [P] [US3] Add runner-daemon tests for cancellation polling and local cleanup reporting in `/Users/arcadia/Documents/mystra/apps/runner-daemon/src/container-task.test.ts`.
- [ ] T030 [P] [US3] Add control-plane provider tests rejecting duplicate or stale terminal observations after cancellation/timeout in `/Users/arcadia/Documents/mystra/apps/control-plane/src/lib/db/sqlite-provider.test.ts`.

### Implementation for Technical Scenario 3

- [ ] T031 [US3] Add a runner-facing way, using the existing runner route trust boundary, to inspect cancellation request metadata for active runs in `/Users/arcadia/Documents/mystra/apps/control-plane/app/api/runner/jobs/[id]/route.ts` or the existing claim/result route files under `/Users/arcadia/Documents/mystra/apps/control-plane/app/api/runner/jobs/`; do not introduce caller auth in this MVP slice.
- [ ] T032 [US3] Track active child process/container handles and deadline metadata per active run in `/Users/arcadia/Documents/mystra/apps/runner-daemon/src/index.ts`.
- [ ] T033 [US3] Implement cancellation polling and execution-timeout watchdog logic using `cancelCheckIntervalSeconds` and `defaultExecutionTimeoutSeconds` in `/Users/arcadia/Documents/mystra/apps/runner-daemon/src/index.ts`.
- [ ] T034 [US3] Implement bounded cleanup using `cleanupTimeoutSeconds`, stop Docker containers or fake executions, emit cleanup-started events/observations, and report canceled/timed-out/cleanup-failed results in `/Users/arcadia/Documents/mystra/apps/runner-daemon/src/index.ts`; do not add a `cleanup_in_progress` run state.
- [ ] T035 [US3] Ensure Docker task workspace cleanup and result reading remain safe when the container is stopped before writing `result.json` in `/Users/arcadia/Documents/mystra/apps/runner-daemon/src/index.ts`.

**Checkpoint**: Runner-daemon tests should cover timeout, cancellation, cleanup failure, and ordinary success without relying on a central cleanup command.

---

## Phase 6: Technical Scenario 4 - Stale Runner State Is Marked, Not Magically Rescheduled (Priority: P2)

**Goal**: Non-reporting runners and their active runs become stale or failed from durable timestamps, with no automatic retry or rebalance.

**Independent Test**: Claim a run, stop heartbeats, run stale evaluation, and verify runner/run state is visibly stale or failed while no new run attempt is created and no other runner receives the work.

### Tests for Technical Scenario 4

- [ ] T036 [P] [US4] Add SQLite provider tests for stale runner detection from `lastHeartbeatAt` and configured `staleAfterSeconds` in `/Users/arcadia/Documents/mystra/apps/control-plane/src/lib/db/sqlite-provider.test.ts`.
- [ ] T037 [P] [US4] Add SQLite provider tests proving stale active runs are marked visible and terminal via existing terminal states plus stale reason metadata/events, without retry, requeue, rebalance, or new attempts, in `/Users/arcadia/Documents/mystra/apps/control-plane/src/lib/db/sqlite-provider.test.ts`.
- [ ] T038 [P] [US4] Add route tests exposing stale runner/run visibility through existing runner/job inspection surfaces in `/Users/arcadia/Documents/mystra/apps/control-plane/app/api/routes.test.ts`.

### Implementation for Technical Scenario 4

- [ ] T039 [US4] Add provider method(s) to mark stale runner sessions and associated active runs from durable timestamps in `/Users/arcadia/Documents/mystra/apps/control-plane/src/lib/db/rdb-provider.ts` and `/Users/arcadia/Documents/mystra/apps/control-plane/src/lib/db/sqlite-provider.ts`; use existing terminal run states plus stale reason metadata/events, not a new `stale` run state.
- [ ] T040 [US4] Add a minimal internal stale-evaluation route or callable control-plane helper without public retry/rebalance semantics in `/Users/arcadia/Documents/mystra/apps/control-plane/app/api/runner/heartbeat/route.ts` or a new internal route under `/Users/arcadia/Documents/mystra/apps/control-plane/app/api/runner/`.
- [ ] T041 [US4] Reject old runner observations that would overwrite newer terminal outcomes or stale-marked terminal outcomes in `/Users/arcadia/Documents/mystra/apps/control-plane/src/lib/db/sqlite-provider.ts`.
- [ ] T042 [US4] Document the stale evaluation command or route behavior in `/Users/arcadia/Documents/mystra/specs/003-config-first-runner-durability/quickstart.md`.

**Checkpoint**: Stale evaluation produces honest durable state only; no task is retried, requeued, reassigned, or duplicated.

---

## Phase 7: Polish And Cross-Cutting Concerns

**Purpose**: Reconcile feature docs, module knowledge, and full verification after the scenarios land.

- [ ] T043 [P] Update runner module documentation for local config variables, concurrency, timeout, cancellation cleanup, and stale behavior in `/Users/arcadia/Documents/mystra/apps/runner-daemon/README.md` or the smallest nearby existing runner doc.
- [ ] T044 [P] Update control-plane/provider documentation for desired vs observed state and stale marking in `/Users/arcadia/Documents/mystra/apps/control-plane/src/lib/db/README.md` or the smallest nearby existing provider doc.
- [ ] T045 Update `/Users/arcadia/Documents/mystra/specs/003-config-first-runner-durability/contracts/runner-config.md` and `/Users/arcadia/Documents/mystra/specs/003-config-first-runner-durability/contracts/runner-state.md` to match final implemented names and response shapes.
- [ ] T046 Run `pnpm --filter @mystra/shared test` from `/Users/arcadia/Documents/mystra` and record any failure or pass evidence in `/Users/arcadia/Documents/mystra/specs/003-config-first-runner-durability/quickstart.md`.
- [ ] T047 Run `pnpm --filter @mystra/control-plane test` from `/Users/arcadia/Documents/mystra` and record any failure or pass evidence in `/Users/arcadia/Documents/mystra/specs/003-config-first-runner-durability/quickstart.md`.
- [ ] T048 Run `pnpm --filter @mystra/runner-daemon test` from `/Users/arcadia/Documents/mystra` and record any failure or pass evidence in `/Users/arcadia/Documents/mystra/specs/003-config-first-runner-durability/quickstart.md`.
- [ ] T049 Run `pnpm typecheck` from `/Users/arcadia/Documents/mystra` and record any failure or pass evidence in `/Users/arcadia/Documents/mystra/specs/003-config-first-runner-durability/quickstart.md`.
- [ ] T050 Run `pnpm test` from `/Users/arcadia/Documents/mystra` when the touched surface justifies broad regression evidence and record the result in `/Users/arcadia/Documents/mystra/specs/003-config-first-runner-durability/quickstart.md`.

---

## Dependencies And Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Setup and blocks all scenario work.
- **Scenario 1 (Phase 3)**: Depends on Foundational and should land before Scenario 2/3 because config and claim limits are core runner inputs.
- **Scenario 2 (Phase 4)**: Depends on Foundational and can begin after cancellation/provider contracts are stable.
- **Scenario 3 (Phase 5)**: Depends on Scenario 2 cancellation/observation contracts and can proceed in parallel with later Scenario 2 route finishing once provider contracts are stable.
- **Scenario 4 (Phase 6)**: Depends on Foundational and Scenario 2 observation idempotency; can be implemented after P1 behavior is stable.
- **Polish (Phase 7)**: Depends on the implemented scenario set.

### Scenario Dependencies

- **US1 (P1)**: First MVP slice after Foundational.
- **US2 (P1)**: Can start after Foundational, but cancellation behavior should be coordinated with US3.
- **US3 (P1)**: Depends on US2 runner observation/cancellation desired-state contracts.
- **US4 (P2)**: Depends on durable runner/run timestamps and terminal-observation idempotency.

### Parallel Opportunities

- T002 and T003 can run in parallel.
- T004 and T005 can begin together; T006 and T007 can begin together after applying the spec3 state representation rule from the engineering review.
- T012, T013, T014, and T015 can be written in parallel before US1 implementation.
- T021, T022, and T023 can be written in parallel before US2 implementation.
- T028, T029, and T030 can be written in parallel before US3 implementation.
- T036, T037, and T038 can be written in parallel before US4 implementation.
- T043 and T044 can be written in parallel after implementation behavior is stable.

---

## Parallel Example: Scenario 1

```text
Task: "Add runner config parsing tests for env/file defaults, numeric validation, and eligibility scope in /Users/arcadia/Documents/mystra/apps/runner-daemon/src/container-task.test.ts"
Task: "Add control-plane route tests for runner registration storing config-derived concurrency and eligibility in /Users/arcadia/Documents/mystra/apps/control-plane/app/api/routes.test.ts"
Task: "Add SQLite provider tests proving claimNextRun respects runner concurrency, project eligibility, and runtime provider eligibility in /Users/arcadia/Documents/mystra/apps/control-plane/src/lib/db/sqlite-provider.test.ts"
```

---

## Implementation Strategy

### MVP First

1. Complete Phase 1 and Phase 2.
2. Complete Scenario 1 so local config and eligible claiming work.
3. Complete Scenario 2 and Scenario 3 together enough to prove runner-owned cancellation/timeout cleanup.
4. Stop and validate all P1 success criteria before stale marking.

### Incremental Delivery

1. Config-first claiming.
2. Durable cancellation request metadata and runner observations.
3. Runner-local timeout/cancellation cleanup.
4. Stale marking without retry or rebalance.
5. Documentation and broad verification.

### Stop Conditions

- Stop if implementation requires caller auth, logs API, retry API, callback URLs, a hosted runner config API, queue priority, central scheduler, Kubernetes controller behavior, cross-runner shared cache, or per-repository secret management.
- Stop if implementation attempts to add `cancellation_requested`, `cleanup_in_progress`, or `stale` as `RunState` values. First follow the spec3 event-based state model with desired-state metadata, runner observations, events, and existing active/terminal states. If that cannot satisfy a concrete test, stop and revise `plan.md`/`tasks.md` before changing the enum.
- Stop if implementation tries to use `activeRunCount` as a correctness source; use durable active-run queries instead.

---

## Summary

- **Total tasks**: 50
- **US1 tasks**: 8
- **US2 tasks**: 7
- **US3 tasks**: 8
- **US4 tasks**: 7
- **Parallel opportunities**: 15 test/documentation/setup tasks can run in parallel after their prerequisites.
- **Suggested MVP scope**: Phase 1, Phase 2, Scenario 1, Scenario 2, and Scenario 3.
- **Format validation**: All executable tasks use `- [ ] T###` with `[P]` only for parallelizable tasks and `[US#]` only inside scenario phases.
