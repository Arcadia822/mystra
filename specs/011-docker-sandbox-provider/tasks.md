# Tasks: Docker Sandbox Provider

**Input**: Design documents from `/specs/011-docker-sandbox-provider/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Add focused shared-schema, runner, and control-plane tests because the
feature formalizes a cross-package execution boundary.

**Organization**: Tasks are grouped by technical scenario so each scenario can be
implemented and validated independently.

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare the sandbox vocabulary and doc touchpoints for the new provider seam

- [ ] T001 Audit Docker-specific execution assumptions in `apps/runner-daemon/src/index.ts`, `apps/runner-daemon/assets/container-task.sh`, `packages/shared/src/schemas.ts`, and `docs/RUNNER-DOCKER-MVP.md`
- [ ] T002 [P] Align sandbox-provider wording in `docs/ARCHITECTURE.md`, `docs/RUNNER-DOCKER-MVP.md`, and `README.md` with the formal contract once implementation lands

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared contract surfaces that every sandbox-provider implementation depends on

**⚠️ CRITICAL**: No user story work should begin until this phase is complete

- [ ] T003 [P] Add provider-neutral sandbox contract schemas in `packages/shared/src/sandbox.ts`
- [ ] T004 [P] Add schema and serialization tests for `packages/shared/src/sandbox.ts` in `packages/shared/src/sandbox.test.ts`
- [ ] T005 Export sandbox contract types from `packages/shared/src/index.ts`
- [ ] T006 Create provider registry scaffolding in `apps/runner-daemon/src/sandbox-providers.ts`
- [ ] T007 Add runner registry tests in `apps/runner-daemon/src/sandbox-providers.test.ts`

**Checkpoint**: Shared sandbox contract vocabulary exists and the runner has a place to register concrete providers

---

## Phase 3: User Story 1 - Runner Launches A Task Container From A Resolved Runtime Contract (Priority: P1) 🎯 MVP

**Goal**: Launch task execution through a Mystra-owned `SandboxProvider` boundary instead of inline Docker branching.

**Independent Test**: A stub provider can be registered and selected from the resolved runtime contract, and launch/session data survives round-trip validation.

### Tests for User Story 1

- [ ] T008 [P] [US1] Add shared launch/session schema tests in `packages/shared/src/sandbox.test.ts`
- [ ] T009 [P] [US1] Add runner tests for provider selection and launch dispatch in `apps/runner-daemon/src/sandbox-providers.test.ts`

### Implementation for User Story 1

- [ ] T010 [US1] Introduce launch/session/outcome types in `packages/shared/src/sandbox.ts`
- [ ] T011 [US1] Wire sandbox contract exports through `packages/shared/src/index.ts`
- [ ] T012 [US1] Refactor `apps/runner-daemon/src/index.ts` to call `apps/runner-daemon/src/sandbox-providers.ts` for launch/inspect/stop/outcome collection
- [ ] T013 [US1] Keep `apps/control-plane/src/lib/runtime/resolve-runtime.ts` as the sole runtime launch input and update related tests if required

**Checkpoint**: The runner launches work through a provider boundary driven by the resolved runtime contract

---

## Phase 4: User Story 2 - Docker Sandbox Preserves Isolation And Secret Hygiene (Priority: P1)

**Goal**: Preserve the current Docker isolation rules behind the provider seam.

**Independent Test**: Docker provider launch translation still blocks Docker-socket/home leakage and preserves runtime-injected secret behavior.

### Tests for User Story 2

- [ ] T014 [P] [US2] Extend Docker translation tests in `apps/runner-daemon/src/container-task.test.ts`
- [ ] T015 [P] [US2] Add sandbox-provider isolation tests in `apps/runner-daemon/src/sandbox-providers/docker.test.ts`

### Implementation for User Story 2

- [ ] T016 [US2] Implement the Docker provider in `apps/runner-daemon/src/sandbox-providers/docker.ts`
- [ ] T017 [US2] Move mount, cache, and secret translation logic from `apps/runner-daemon/src/index.ts` into `apps/runner-daemon/src/sandbox-providers/docker.ts`
- [ ] T018 [US2] Keep `apps/runner-daemon/assets/container-task.sh` aligned with the provider-owned launch contract without reintroducing host-coupling assumptions

**Checkpoint**: Docker remains the first implementation, but its isolation and secret rules are now owned by the sandbox seam

---

## Phase 5: User Story 3 - Preview Ports And Sandbox Metadata Are Exposed Cleanly (Priority: P2)

**Goal**: Return structured preview-port exposure and retained-session metadata from the provider.

**Independent Test**: Preview URLs and host-port bindings are available through one structured sandbox outcome, including the explicit no-ports case.

### Tests for User Story 3

- [ ] T019 [P] [US3] Add shared port-exposure tests in `packages/shared/src/sandbox.test.ts`
- [ ] T020 [P] [US3] Extend runner tests for preview URL and no-ports outcomes in `apps/runner-daemon/src/container-task.test.ts`

### Implementation for User Story 3

- [ ] T021 [US3] Add `SandboxPortBinding` and retained-session serialization in `packages/shared/src/sandbox.ts`
- [ ] T022 [US3] Refactor preview-port probing and URL assembly from `apps/runner-daemon/src/index.ts` into `apps/runner-daemon/src/sandbox-providers/docker.ts`
- [ ] T023 [US3] Update result/event mapping in `apps/runner-daemon/src/index.ts` so preview exposure comes from the sandbox outcome instead of ad hoc metadata assembly

**Checkpoint**: Preview behavior is provider-owned and explainable through one structured outcome

---

## Phase 6: User Story 4 - Cancellation, Timeout, And Cleanup Are Provider-Owned Outcomes (Priority: P1)

**Goal**: Make stop/kill and cleanup behavior explicit provider outcomes instead of scattered runner heuristics.

**Independent Test**: Success, cancel, timeout, and cleanup-failure paths all produce structured sandbox outcomes with explicit cleanup visibility.

### Tests for User Story 4

- [ ] T024 [P] [US4] Add cleanup-outcome schema tests in `packages/shared/src/sandbox.test.ts`
- [ ] T025 [P] [US4] Extend runner tests for cancel, timeout, and cleanup-failure paths in `apps/runner-daemon/src/container-task.test.ts`

### Implementation for User Story 4

- [ ] T026 [US4] Implement provider-owned stop and cleanup reporting in `apps/runner-daemon/src/sandbox-providers/docker.ts`
- [ ] T027 [US4] Refactor cancellation polling and stop/kill orchestration in `apps/runner-daemon/src/index.ts` to consume provider cleanup outcomes
- [ ] T028 [US4] Update result/event emission in `apps/runner-daemon/src/index.ts` so cleanup failure and timeout state come from the sandbox outcome model

**Checkpoint**: Timeout, cancel, and cleanup behavior is explicit, testable, and no longer hidden in runner heuristics

---

## Phase 7: User Story 5 - Future Sandbox Providers Can Replace Docker Without Rewriting Product Contracts (Priority: P2)

**Goal**: Prove the seam is replaceable, not just renamed Docker code.

**Independent Test**: A stub non-Docker provider can satisfy the registry and shared contract without changing workflow or control-plane launch inputs.

### Tests for User Story 5

- [ ] T029 [P] [US5] Add stub-provider compatibility tests in `apps/runner-daemon/src/sandbox-providers.test.ts`

### Implementation for User Story 5

- [ ] T030 [US5] Add a stub provider fixture in `apps/runner-daemon/src/sandbox-providers/stub.ts`
- [ ] T031 [US5] Document non-Docker replacement rules in `specs/011-docker-sandbox-provider/contracts/sandbox-provider.md` and `docs/ARCHITECTURE.md`

**Checkpoint**: Docker is clearly the first implementation of a replaceable seam

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Close the loop across docs, tests, and follow-on consumers

- [ ] T032 [P] Reconcile sandbox-provider terminology across `PRODUCT.md`, `PLATFORM.md`, `README.md`, and `docs/ARCHITECTURE.md`
- [ ] T033 Update `specs/004-open-agents-framework/contracts/provider-seams.md` and `specs/004-open-agents-framework/contracts/module-inventory.md` with the realized `SandboxProvider` contract owner once code lands
- [ ] T034 [P] Run quickstart validation from `specs/011-docker-sandbox-provider/quickstart.md`
- [ ] T035 Run `pnpm --filter @mystra/shared test && pnpm --filter @mystra/control-plane test && pnpm --filter @mystra/runner-daemon test && pnpm typecheck`

---

## Dependencies & Execution Order

### Phase Dependencies

- Phase 1 → Phase 2 → all user stories
- US1 blocks US2, US3, US4, and US5 because they all depend on the shared contract and runner registry
- US2 and US4 both touch the Docker provider implementation and should usually run sequentially
- US3 can begin after US2 stabilizes provider-owned preview metadata inputs
- 011 and 010 both modify `apps/runner-daemon/src/index.ts` and `apps/runner-daemon/assets/container-task.sh`, so repo-provider and sandbox-provider implementation should not be merged as one undifferentiated runner rewrite

### Parallel Opportunities

- T003/T004 can run in parallel
- T006/T007 can run in parallel after the shared schema shape settles
- T019/T024 can run in parallel once the sandbox outcome schema exists

### Implementation Strategy

1. Land the shared sandbox contract and runner registry first.
2. Move Docker launch/isolation behavior behind the provider.
3. Add structured preview metadata and cleanup outcomes.
4. Finish by proving replaceability with a stub provider and reconciling docs.
