# Tasks: Repository Provider Contracts

**Input**: Design documents from `/specs/010-repo-provider-contracts/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Add focused shared-schema, runner, and control-plane tests because the
feature changes cross-package contract boundaries.

**Organization**: Tasks are grouped by technical scenario so each scenario can be
implemented and validated independently.

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare the repository vocabulary and doc touchpoints for the new
provider boundary.

- [x] T001 Audit GitLab-specific review vocabulary in `packages/shared/src/result.ts`, `packages/shared/src/events.ts`, `apps/runner-daemon/src/index.ts`, and `apps/runner-daemon/assets/container-task.sh`
- [x] T002 [P] Align repository-provider wording in `docs/SPEC.md`, `docs/RUNNER-DOCKER-MVP.md`, and `README.md` with the formal contract once implementation lands

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared contract surfaces that every repository provider implementation depends on

**⚠️ CRITICAL**: No user story work should begin until this phase is complete

- [x] T003 [P] Add provider-neutral repository contract schemas in `packages/shared/src/repository.ts`
- [x] T004 [P] Add schema and serialization tests for `packages/shared/src/repository.ts` in `packages/shared/src/repository.test.ts`
- [x] T005 Export repository contract types from `packages/shared/src/index.ts`
- [x] T006 Create provider registry scaffolding in `apps/runner-daemon/src/repo-providers.ts`
- [x] T007 Add runner registry tests in `apps/runner-daemon/src/repo-providers.test.ts`

**Checkpoint**: Shared repository contract vocabulary exists and the runner has a place to register concrete providers

---

## Phase 3: User Story 1 - Workflow Uses A Provider-Agnostic Repository Contract (Priority: P1) 🎯 MVP

**Goal**: Make workflow and runner call a Mystra-owned repository boundary instead of depending on GitLab-only shell semantics.

**Independent Test**: A stub provider can be registered and selected without changing workflow control flow, and normalized repository result data survives round-trip validation.

### Tests for User Story 1

- [x] T008 [P] [US1] Add shared contract tests for normalized branch/review outcomes in `packages/shared/src/repository.test.ts`
- [x] T009 [P] [US1] Add runner integration tests for provider selection and stub execution in `apps/runner-daemon/src/repo-providers.test.ts`

### Implementation for User Story 1

- [x] T010 [US1] Introduce normalized branch/review result types and auth binding helpers in `packages/shared/src/repository.ts`
- [x] T011 [US1] Wire repository contract exports through `packages/shared/src/index.ts`
- [x] T012 [US1] Refactor `apps/runner-daemon/src/index.ts` to call `apps/runner-daemon/src/repo-providers.ts` instead of inlining provider selection assumptions
- [x] T013 [US1] Update `apps/control-plane/src/lib/db/sqlite-provider.ts` and `apps/control-plane/app/api/mcp/route.ts` to preserve or expose normalized repository-delivery snapshots where required

**Checkpoint**: A provider-neutral repository contract exists and the runner/control-plane can consume it without GitLab-specific branching in shared paths

---

## Phase 4: User Story 2 - GitLab Delivery Produces A Reviewable Branch And Merge Request (Priority: P1)

**Goal**: Preserve the current GitLab path as a concrete `RepoProvider` implementation behind the new contract.

**Independent Test**: GitLab branch push and MR creation still pass through the contract and return normalized outcomes, including partial-success cases.

### Tests for User Story 2

- [x] T014 [P] [US2] Add GitLab provider contract tests in `apps/runner-daemon/src/repo-providers/gitlab.test.ts`
- [x] T015 [P] [US2] Extend shell/runner tests for push-succeeded and review-failed-after-push paths in `apps/runner-daemon/src/container-task.test.ts`

### Implementation for User Story 2

- [x] T016 [US2] Implement the GitLab provider in `apps/runner-daemon/src/repo-providers/gitlab.ts`
- [x] T017 [US2] Refactor GitLab-specific branch push and MR creation flow in `apps/runner-daemon/assets/container-task.sh` to emit the normalized contract shape
- [x] T018 [US2] Update `apps/runner-daemon/src/index.ts` to pass provider-neutral auth bindings and review request data into the GitLab provider

**Checkpoint**: GitLab is still the first verified implementation, but it now lives behind the `RepoProvider` boundary

---

## Phase 5: User Story 3 - GitHub Delivery Produces A Reviewable Branch And Pull Request (Priority: P1)

**Goal**: Add a GitHub implementation that satisfies the same contract without changing workflow or runner control flow.

**Independent Test**: A GitHub-backed repository target produces the same normalized review result shape as GitLab.

### Tests for User Story 3

- [x] T019 [P] [US3] Add GitHub provider contract tests in `apps/runner-daemon/src/repo-providers/github.test.ts`
- [x] T020 [P] [US3] Add control-plane/shared tests proving GitHub review results serialize through the same normalized contract in `packages/shared/src/repository.test.ts`

### Implementation for User Story 3

- [x] T021 [US3] Implement the GitHub provider in `apps/runner-daemon/src/repo-providers/github.ts`
- [x] T022 [US3] Update `apps/runner-daemon/src/repo-providers.ts` to register and select the GitHub provider from repository target metadata
- [x] T023 [US3] Extend `apps/runner-daemon/src/index.ts` and adjacent docs to pass GitHub-specific host metadata without leaking GitHub-only semantics into shared surfaces

**Checkpoint**: GitHub becomes a real provider implementation under the same contract as GitLab

---

## Phase 6: User Story 4 - Credentials And Repository Metadata Stay At The Right Boundary (Priority: P2)

**Goal**: Keep repository auth opaque and execution-time scoped without widening MVP into per-repository secret management.

**Independent Test**: Workflow, MCP, and agent contracts no longer depend on raw provider token names, while the runner can still resolve the required auth binding at execution time.

### Tests for User Story 4

- [x] T024 [P] [US4] Add auth-binding validation tests in `packages/shared/src/repository.test.ts`
- [x] T025 [P] [US4] Add runner auth-resolution tests in `apps/runner-daemon/src/repo-providers.test.ts`

### Implementation for User Story 4

- [x] T026 [US4] Implement provider-owned auth binding translation in `apps/runner-daemon/src/repo-providers/auth.ts`
- [x] T027 [US4] Refactor `apps/runner-daemon/src/index.ts` to build `RepositoryAuthBinding` values instead of handing raw env names to downstream repository logic
- [x] T028 [US4] Update `docs/RUNNER-DOCKER-MVP.md` and `specs/010-repo-provider-contracts/quickstart.md` to explain the MVP auth-boundary model without implying per-repository secret management

**Checkpoint**: Repository auth stays behind the provider seam and future secret-management work can build on a stable boundary

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Close the loop across docs, tests, and follow-on consumers

- [x] T029 [P] Reconcile repository-delivery terminology across `PRODUCT.md`, `PLATFORM.md`, `README.md`, and `docs/SPEC.md`
- [x] T030 Update `specs/004-open-agents-framework/contracts/provider-seams.md` and `specs/004-open-agents-framework/contracts/module-inventory.md` with the realized `RepoProvider` contract owner once code lands
- [x] T031 [P] Run quickstart validation from `specs/010-repo-provider-contracts/quickstart.md`
- [x] T032 Run `pnpm --filter @mystra/shared test && pnpm --filter @mystra/control-plane test && pnpm --filter @mystra/runner-daemon test && pnpm typecheck`

---

## Dependencies & Execution Order

### Phase Dependencies

- Phase 1 → Phase 2 → all user stories
- US1 blocks US2, US3, and US4 because they all depend on the shared contract and runner registry
- US2 and US4 can proceed in parallel after US1 if they avoid the same files at the same time
- US3 depends on the same runner registry as US2, so expect sequential work in `apps/runner-daemon/src/repo-providers.ts`
- 010 and 011 both modify `apps/runner-daemon/src/index.ts` and `apps/runner-daemon/assets/container-task.sh`, so provider-boundary implementation should be staged carefully rather than landed as one mixed refactor

### Parallel Opportunities

- T003/T004 can run in parallel
- T006/T007 can run in parallel after the shared schema shape settles
- GitLab and GitHub provider test authoring can begin in parallel once US1 contract types are stable

### Implementation Strategy

1. Land the shared repository contract and runner registry first.
2. Preserve the GitLab path behind the new contract.
3. Add GitHub against the same boundary.
4. Finish by hiding provider-specific auth names behind auth bindings and reconciling docs.
