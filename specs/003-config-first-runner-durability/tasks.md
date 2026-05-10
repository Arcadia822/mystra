# Tasks: Config-First Headless Runner Durability

**Input**: Design documents from `/specs/003-config-first-runner-durability/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md, checklists/engineering-review.md

**Tests**: Included because this feature changes runner/control-plane contracts and durability behavior.

**Organization**: Tasks are grouped by technical scenario to enable independent implementation and validation.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which technical scenario this task belongs to (US1, US2, US3, US4)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish the narrow config-first contract and keep implementation scope bounded.

- [ ] T001 Review and preserve engineering-review constraints in `/Users/arcadia/Documents/mystra/specs/003-config-first-runner-durability/checklists/engineering-review.md`
- [ ] T002 [P] Add runner local config contract tests in `/Users/arcadia/Documents/mystra/packages/shared/src/schemas.test.ts`
- [ ] T003 [P] Add runner state transition expectation tests in `/Users/arcadia/Documents/mystra/packages/shared/src/state.test.ts`
- [ ] T004 [P] Add runner daemon source-behavior tests for config/watchdog hooks in `/Users/arcadia/Documents/mystra/apps/runner-daemon/src/container-task.test.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared contracts and persistence support that all scenarios depend on.

**CRITICAL**: No scenario implementation can begin until this phase is complete.

- [ ] T005 Add runner local config, eligibility, timeout, and observation schemas in `/Users/arcadia/Documents/mystra/packages/shared/src/schemas.ts`
- [ ] T006 Add or refine run state helpers for cancellation requested, cleanup observation, timeout, stale, and idempotent terminal handling in `/Users/arcadia/Documents/mystra/packages/shared/src/state.ts`
- [ ] T007 Extend `RunnerSession`, registration input, cancellation outcome, and stale-marking provider contracts in `/Users/arcadia/Documents/mystra/apps/control-plane/src/lib/db/rdb-provider.ts`
- [ ] T008 Add SQLite migration/storage changes for config-derived runner fields and stale/cancellation metadata in `/Users/arcadia/Documents/mystra/apps/control-plane/src/lib/db/sqlite-provider.ts`
- [ ] T009 Update runner API route parsing for registration, heartbeat, claim, event, result, and cancel contract changes in `/Users/arcadia/Documents/mystra/apps/control-plane/app/api/routes.test.ts`
- [ ] T010 Verify foundational contracts with `pnpm --filter @mystra/shared test` and `pnpm --filter @mystra/control-plane test`, then record evidence in `/Users/arcadia/Documents/mystra/specs/003-config-first-runner-durability/quickstart.md`

**Checkpoint**: Shared contracts and durable state boundaries are ready.

---

## Phase 3: User Story 1 - Runner Runs From Local Config (Priority: P1) MVP

**Goal**: Runner local config controls concurrency, polling, timeout defaults, cancellation check interval, cleanup timeout, and eligible claim scope.

**Independent Test**: Start/register a runner with local config for concurrency and eligibility, submit eligible and ineligible work, and verify claim behavior respects local config without a central scheduler.

### Tests for User Story 1

- [ ] T011 [P] [US1] Add shared schema tests for runner config defaults and validation in `/Users/arcadia/Documents/mystra/packages/shared/src/schemas.test.ts`
- [ ] T012 [P] [US1] Add control-plane tests for config-derived eligibility and local concurrency claim filtering in `/Users/arcadia/Documents/mystra/apps/control-plane/src/lib/db/sqlite-provider.test.ts`
- [ ] T013 [P] [US1] Add route tests for runner registration and claim eligibility in `/Users/arcadia/Documents/mystra/apps/control-plane/app/api/routes.test.ts`
- [ ] T014 [P] [US1] Add runner daemon tests for reading config from env/file-compatible inputs in `/Users/arcadia/Documents/mystra/apps/runner-daemon/src/container-task.test.ts`

### Implementation for User Story 1

- [ ] T015 [US1] Implement runner config parsing and defaults in `/Users/arcadia/Documents/mystra/apps/runner-daemon/src/index.ts`
- [ ] T016 [US1] Send config-derived concurrency and eligibility during runner registration in `/Users/arcadia/Documents/mystra/apps/runner-daemon/src/index.ts`
- [ ] T017 [US1] Persist config-derived runner fields and eligibility in `/Users/arcadia/Documents/mystra/apps/control-plane/src/lib/db/sqlite-provider.ts`
- [ ] T018 [US1] Update `claimNextRun` eligibility filtering without adding a scheduler module in `/Users/arcadia/Documents/mystra/apps/control-plane/src/lib/db/sqlite-provider.ts`
- [ ] T019 [US1] Update runner registration route contract in `/Users/arcadia/Documents/mystra/apps/control-plane/app/api/runner/register/route.ts`
- [ ] T020 [US1] Verify US1 with `pnpm --filter @mystra/shared test` and `pnpm --filter @mystra/control-plane test`, then record evidence in `/Users/arcadia/Documents/mystra/specs/003-config-first-runner-durability/quickstart.md`

**Checkpoint**: Runner local config governs local concurrency and claim eligibility.

---

## Phase 4: User Story 2 - Control Plane Stores Desired And Observed State (Priority: P1)

**Goal**: Cancellation requests and runner observations are durable facts, while the control plane remains a state store rather than a live scheduler.

**Independent Test**: Submit, claim, cancel, complete, and restart state access; verify desired cancellation and runner observations remain explainable from durable records.

### Tests for User Story 2

- [ ] T021 [P] [US2] Add provider tests for queued cancellation versus assigned/running cancellation requested in `/Users/arcadia/Documents/mystra/apps/control-plane/src/lib/db/sqlite-provider.test.ts`
- [ ] T022 [P] [US2] Add provider tests for duplicate terminal result and stale/terminal overwrite protection in `/Users/arcadia/Documents/mystra/apps/control-plane/src/lib/db/sqlite-provider.test.ts`
- [ ] T023 [P] [US2] Add route tests for cancel and runner event/result observations in `/Users/arcadia/Documents/mystra/apps/control-plane/app/api/routes.test.ts`

### Implementation for User Story 2

- [ ] T024 [US2] Change `cancelJob` so queued runs can terminalize but assigned/running runs record cancellation requested in `/Users/arcadia/Documents/mystra/apps/control-plane/src/lib/db/sqlite-provider.ts`
- [ ] T025 [US2] Add durable runner observation handling for cleanup started, cancelled, timed out, cleanup failed, failed, and completed events in `/Users/arcadia/Documents/mystra/apps/control-plane/src/lib/db/sqlite-provider.ts`
- [ ] T026 [US2] Update cancel route response shape for immediate canceled versus cancellation requested outcomes in `/Users/arcadia/Documents/mystra/apps/control-plane/app/api/jobs/[id]/cancel/route.ts`
- [ ] T027 [US2] Update MCP cancel tool output to reflect cancellation requested when runner cleanup is pending in `/Users/arcadia/Documents/mystra/apps/control-plane/app/api/mcp/route.ts`
- [ ] T028 [US2] Verify US2 with `pnpm --filter @mystra/control-plane test`, then record evidence in `/Users/arcadia/Documents/mystra/specs/003-config-first-runner-durability/quickstart.md`

**Checkpoint**: Desired state and runner observations are durable and idempotent.

---

## Phase 5: User Story 3 - Runner Owns Local Timeout And Cleanup (Priority: P1)

**Goal**: Runner-local watchdog handles timeout, observes cancellation, stops execution, performs cleanup, and reports outcomes.

**Independent Test**: Run one timeout task and one cancelled task; verify runner-local cleanup and durable result reporting.

### Tests for User Story 3

- [ ] T029 [P] [US3] Add runner daemon tests for timeout watchdog and timeout result reporting in `/Users/arcadia/Documents/mystra/apps/runner-daemon/src/container-task.test.ts`
- [ ] T030 [P] [US3] Add runner daemon tests for cancellation polling and cleanup result reporting in `/Users/arcadia/Documents/mystra/apps/runner-daemon/src/container-task.test.ts`
- [ ] T031 [P] [US3] Add control-plane route tests for timeout/cancel observation events in `/Users/arcadia/Documents/mystra/apps/control-plane/app/api/routes.test.ts`

### Implementation for User Story 3

- [ ] T032 [US3] Add runner-local watchdog loop for execution timeout and cancellation checks in `/Users/arcadia/Documents/mystra/apps/runner-daemon/src/index.ts`
- [ ] T033 [US3] Add container stop and cleanup timeout behavior around Docker execution in `/Users/arcadia/Documents/mystra/apps/runner-daemon/src/index.ts`
- [ ] T034 [US3] Add cancellation/timeout observation POSTs from runner to control plane in `/Users/arcadia/Documents/mystra/apps/runner-daemon/src/index.ts`
- [ ] T035 [US3] Update fake executor behavior to honor timeout/cancel reporting where practical in `/Users/arcadia/Documents/mystra/apps/runner-daemon/src/index.ts`
- [ ] T036 [US3] Verify US3 with `pnpm --filter @mystra/runner-daemon test` and `pnpm --filter @mystra/control-plane test`, then record evidence in `/Users/arcadia/Documents/mystra/specs/003-config-first-runner-durability/quickstart.md`

**Checkpoint**: Runner local cleanup is observable and durable.

---

## Phase 6: User Story 4 - Stale Runner State Is Marked, Not Magically Rescheduled (Priority: P2)

**Goal**: Non-reporting runners and their active work become stale/failed from durable timestamps, without retry, requeue, or rebalance.

**Independent Test**: Stop a runner with active work, wait past stale window, and verify durable stale state without reassignment.

### Tests for User Story 4

- [ ] T037 [P] [US4] Add provider tests for stale runner/session detection and active run stale marking in `/Users/arcadia/Documents/mystra/apps/control-plane/src/lib/db/sqlite-provider.test.ts`
- [ ] T038 [P] [US4] Add route or MCP tests exposing stale runner/run state without retry behavior in `/Users/arcadia/Documents/mystra/apps/control-plane/app/api/routes.test.ts`
- [ ] T039 [P] [US4] Add UI data-shape expectation for stale status if needed in `/Users/arcadia/Documents/mystra/apps/control-plane/app/page.tsx`

### Implementation for User Story 4

- [ ] T040 [US4] Add provider method for stale runner/run marking in `/Users/arcadia/Documents/mystra/apps/control-plane/src/lib/db/rdb-provider.ts`
- [ ] T041 [US4] Implement stale runner/run marking from durable timestamps in `/Users/arcadia/Documents/mystra/apps/control-plane/src/lib/db/sqlite-provider.ts`
- [ ] T042 [US4] Expose stale state through existing runners/jobs/MCP surfaces without adding retry APIs in `/Users/arcadia/Documents/mystra/apps/control-plane/app/api/runners/route.ts`
- [ ] T043 [US4] Ensure stale runner reports cannot overwrite newer terminal/stale outcomes in `/Users/arcadia/Documents/mystra/apps/control-plane/src/lib/db/sqlite-provider.ts`
- [ ] T044 [US4] Verify US4 with `pnpm --filter @mystra/control-plane test`, then record evidence in `/Users/arcadia/Documents/mystra/specs/003-config-first-runner-durability/quickstart.md`

**Checkpoint**: Stale state is visible, durable, and not a retry system.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, consistency, and full verification after selected stories are implemented.

- [ ] T045 [P] Update runner durability quickstart with final config format and commands in `/Users/arcadia/Documents/mystra/specs/003-config-first-runner-durability/quickstart.md`
- [ ] T046 [P] Update runner environment/operator documentation in `/Users/arcadia/Documents/mystra/docs/RUNNER-ENVIRONMENT.md`
- [ ] T047 [P] Update feature plan with any implementation deviations in `/Users/arcadia/Documents/mystra/specs/003-config-first-runner-durability/plan.md`
- [ ] T048 Run `pnpm --filter @mystra/shared test` and record evidence in `/Users/arcadia/Documents/mystra/specs/003-config-first-runner-durability/quickstart.md`
- [ ] T049 Run `pnpm --filter @mystra/control-plane test` and record evidence in `/Users/arcadia/Documents/mystra/specs/003-config-first-runner-durability/quickstart.md`
- [ ] T050 Run `pnpm --filter @mystra/runner-daemon test` and record evidence in `/Users/arcadia/Documents/mystra/specs/003-config-first-runner-durability/quickstart.md`
- [ ] T051 Run `pnpm typecheck` and record evidence in `/Users/arcadia/Documents/mystra/specs/003-config-first-runner-durability/quickstart.md`
- [ ] T052 Run `pnpm test` if the final touched surface spans shared, control-plane, and runner-daemon packages, then record evidence in `/Users/arcadia/Documents/mystra/specs/003-config-first-runner-durability/quickstart.md`
- [ ] T053 Run `gitnexus_detect_changes` or `mcp__gitnexus__.detect_changes` before commit and record affected flows in `/Users/arcadia/Documents/mystra/specs/003-config-first-runner-durability/plan.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Setup completion and blocks all scenario work.
- **US1 (Phase 3)**: Depends on Foundational; MVP slice.
- **US2 (Phase 4)**: Depends on Foundational; can proceed after shared state contracts exist.
- **US3 (Phase 5)**: Depends on US2 observation contracts and Foundational runner config.
- **US4 (Phase 6)**: Depends on Foundational and benefits from US2 terminal/idempotency behavior.
- **Polish (Phase 7)**: Depends on all selected scenarios.

### User Story Dependencies

- **US1**: First implementation slice; establishes config-first runner scope.
- **US2**: Can start after Foundational but should align with US1 config-derived registration.
- **US3**: Requires US2 observation/reporting semantics.
- **US4**: Can be implemented after foundational stale fields exist, but terminal overwrite protection from US2 should be in place first.

### Parallel Opportunities

- T002, T003, and T004 can run in parallel.
- US1 tests T011-T014 can run in parallel.
- US2 tests T021-T023 can run in parallel.
- US3 tests T029-T031 can run in parallel.
- US4 tests T037-T039 can run in parallel.
- Documentation tasks T045-T047 can run in parallel after implementation behavior is known.

---

## Parallel Example: User Story 1

```text
Task: "Add shared schema tests for runner config defaults and validation in /Users/arcadia/Documents/mystra/packages/shared/src/schemas.test.ts"
Task: "Add control-plane tests for config-derived eligibility and local concurrency claim filtering in /Users/arcadia/Documents/mystra/apps/control-plane/src/lib/db/sqlite-provider.test.ts"
Task: "Add route tests for runner registration and claim eligibility in /Users/arcadia/Documents/mystra/apps/control-plane/app/api/routes.test.ts"
Task: "Add runner daemon tests for reading config from env/file-compatible inputs in /Users/arcadia/Documents/mystra/apps/runner-daemon/src/container-task.test.ts"
```

---

## Implementation Strategy

### MVP First

1. Complete Phase 1 and Phase 2.
2. Implement US1 only: config-derived runner registration and eligibility-bound claims.
3. Stop and validate with shared and control-plane tests.

### Incremental Delivery

1. Add US1: config-first claim scope.
2. Add US2: durable desired/observed state.
3. Add US3: runner-local timeout/cancel cleanup.
4. Add US4: stale marking without retry/rebalance.
5. Run broad verification and update docs.

### Guardrails

- Do not add scheduler, priority, rebalance, retry, logs, callback, or hosted runner-management surfaces.
- Do not let `activeRunCount` become the only correctness source unless idempotency tests prove it safe.
- Do not expand this feature into delivery-provider reliability or secret management.
