# Tasks: Product Surface Positioning

**Input**: Design documents from `/specs/021-product-surface-positioning/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Add focused shared-schema, event, control-plane, and runner regression tests because this feature changes public naming across shared contracts, API/MCP routes, persistence methods, and runner-facing execution surfaces.

**Organization**: Tasks are grouped by user story so documentation alignment, outward/core renames, and mechanical cleanup can be implemented and validated in bounded slices.

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup (Shared Planning Surface)

**Purpose**: Freeze the exact rename inventory before implementation starts.

- [x] T001 Audit current terminology surfaces in `PRODUCT.md`, `PLATFORM.md`, `PROCESS.md`, `AGENTS.md`, `README.md`, `packages/shared/src/schemas.ts`, `packages/shared/src/events.ts`, `apps/control-plane/src/lib/db/rdb-provider.ts`, `apps/control-plane/src/lib/db/sqlite-provider.ts`, `apps/control-plane/app/api/jobs/**`, `apps/control-plane/app/api/mcp/route.ts`, `apps/control-plane/app/page.tsx`, and `apps/runner-daemon/src/index.ts`
- [x] T002 [P] Extend `specs/021-product-surface-positioning/contracts/terminology-migration.md` with the exact `Job* -> Task*` rename matrix, protected `workspace` keep-rules, and the explicit list of files that stay future-deferred

**Checkpoint**: The rename inventory is explicit enough that implementation can proceed without guessing about scope.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Freeze the regression harness and shared outward/core vocabulary that all later slices depend on.

**⚠️ CRITICAL**: No outward/core rename work should begin until this phase is complete

- [x] T003 [P] Add shared contract regression coverage in `packages/shared/src/schemas.test.ts` and `packages/shared/src/events.test.ts` for renamed `Task*` contracts, task-facing events, and any `task-scoped` public contract changes that land
- [x] T004 [P] Add control-plane regression coverage in `apps/control-plane/app/api/routes.test.ts` and `apps/control-plane/src/lib/db/sqlite-provider.test.ts` for `/api/tasks`, `mystra_create_task`, `mystra_get_task`, and renamed provider lifecycle semantics
- [x] T005 [P] Add runner-facing regression coverage in `apps/runner-daemon/src/container-task.test.ts` and adjacent runner tests for renamed task-facing claim, event, and log surfaces that consume the shared contracts
- [x] T006 Rename shared outward/core contract exports in `packages/shared/src/schemas.ts`, `packages/shared/src/events.ts`, and `packages/shared/src/index.ts` from public `Job*` naming to `Task*` naming while preserving text-first `prompt` / `taskId` semantics

**Checkpoint**: Shared `Task*` vocabulary and failing-then-passing regression coverage exist before downstream consumers are rewritten.

---

## Phase 3: User Story 1 - Maintainers Can Read One Canonical Migration Scope (Priority: P1)

**Goal**: Align durable docs and historical specs with the approved terminology scope without redesigning pages or freezing future object structure.

**Independent Test**: A maintainer can read the root docs plus the affected historical specs and see one consistent explanation of the migration scope, exclusions, and protected runtime `workspace` meaning.

### Implementation for User Story 1

- [x] T007 [P] [US1] Rewrite tenancy-flavored terminology in `PRODUCT.md`, `PLATFORM.md`, `PROCESS.md`, `AGENTS.md`, and `README.md` so those docs stop using `workspace` as an aspirational tenancy object while preserving runtime `workspace` references
- [x] T008 [US1] Reconcile affected historical specs, including `specs/001-project-and-sqlite/spec.md` and the 021 artifacts under `specs/021-product-surface-positioning/`, so they match the landed migration vocabulary and exclusions

**Checkpoint**: The repo's durable docs and feature artifacts describe the same scope and no longer drift on tenancy/runtime wording.

---

## Phase 4: User Story 2 - Contract Owners Can Separate Deliberate Renames From Mechanical Renames (Priority: P1) 🎯 MVP

**Goal**: Perform the direct hard cut on outward/core names across shared contracts, control-plane surfaces, and current runner-facing consumers.

**Independent Test**: Shared types, provider methods, API routes, MCP tools, and current control-plane/runner consumers expose only the approved `Task*` outward/core names and still pass their focused regression tests.

### Tests for User Story 2

- [x] T009 [P] [US2] Extend shared-schema regression assertions in `packages/shared/src/schemas.test.ts` for renamed `TaskSpec`-style exports and text-first submission semantics
- [x] T010 [P] [US2] Extend public-surface regression assertions in `apps/control-plane/app/api/routes.test.ts` for `/api/tasks`, `mystra_create_task`, `mystra_get_task`, and explicit failure on unsupported legacy public names
- [x] T011 [P] [US2] Extend persistence and runner regression assertions in `apps/control-plane/src/lib/db/sqlite-provider.test.ts`, `packages/shared/src/events.test.ts`, and `apps/runner-daemon/src/container-task.test.ts` for renamed provider methods and task-facing event/claim consumers

### Implementation for User Story 2

- [x] T012 [US2] Rename provider/core type and method surfaces in `apps/control-plane/src/lib/db/rdb-provider.ts` and `apps/control-plane/src/lib/db/sqlite-provider.ts` from outward `Job*` naming to `Task*` naming and update dependent call sites
- [x] T013 [US2] Rename HTTP route files and handlers from `apps/control-plane/app/api/jobs/**` to `apps/control-plane/app/api/tasks/**` and align the request/response vocabulary with the new task-facing surface
- [x] T014 [US2] Rename MCP tool registration and dispatch in `apps/control-plane/app/api/mcp/route.ts` from `mystra_create_job` / `mystra_get_job` to `mystra_create_task` / `mystra_get_task`
- [x] T015 [US2] Align current consumer code in `apps/control-plane/app/page.tsx` and `apps/runner-daemon/src/index.ts` with the renamed `Task*` route, event, and tool surfaces without redesigning the page or widening MVP intake semantics

**Checkpoint**: The outward/core contract cut is complete across shared, control-plane, and current runner-facing consumers.

---

## Phase 5: User Story 3 - MVP Intake Semantics Stay Text-First During Terminology Migration (Priority: P1)

**Goal**: Finish the repository-wide cleanup so the naming cut does not leave mixed public terms behind and does not accidentally introduce issue-id-driven intake requirements.

**Independent Test**: The touched repository surfaces no longer expose leftover public `Job*` names, and task submission still enters through text-first `prompt`-driven contracts rather than issue-id hydration.

### Tests for User Story 3

- [x] T016 [P] [US3] Add a repository-consistency regression check in the narrowest appropriate test surface for 021, using `packages/shared/src/*.test.ts`, `apps/control-plane/app/api/routes.test.ts`, or an equivalent focused assertion, so supported public `Job*` names fail the test suite after the cut

### Implementation for User Story 3

- [x] T017 [US3] Mechanically rename remaining implementation-local job-centric symbols in the touched shared, control-plane, and runner files after outward/core names land, while keeping protected runtime `workspace` terms and future-only objects untouched
- [x] T018 [US3] Reconcile `specs/021-product-surface-positioning/quickstart.md`, `specs/spec-status.md`, and nearby touched docs so the landed verification commands and terminology match the implemented task-facing surface

**Checkpoint**: No mixed public naming remains in the touched scope, and the spec/quickstart/status artifacts match the implemented behavior.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Close the loop across verification, review, and final artifact alignment.

- [ ] T019 [P] Run focused verification for the touched packages: `pnpm --filter @mystra/shared build && pnpm --filter @mystra/shared test && pnpm --filter @mystra/shared typecheck && pnpm --filter @mystra/control-plane test && pnpm --filter @mystra/control-plane typecheck && pnpm --filter @mystra/control-plane build`
- [x] T020 [P] If `apps/runner-daemon/src/index.ts` changes, run runner verification in dependency order: `pnpm --filter @mystra/agent-adapters build && pnpm --filter @mystra/shared build && pnpm --filter @mystra/runner-daemon test`
- [ ] T021 Run broad verification: `pnpm typecheck`
- [ ] T022 Run the project-local `code-review-and-quality` gate or an equivalent explicit review pass before landing the completed 021 implementation

---

## Dependencies & Execution Order

### Phase Dependencies

- Phase 1 → Phase 2 → all user stories
- US1 can begin after Phase 2 if the rename matrix is frozen, but it should land before or alongside the public/core cut so docs do not lag code
- US2 depends on Phase 2 because the shared contract and regression harness must exist before public/core names are renamed
- US3 depends on US2 because mechanical cleanup and consistency checks only make sense after outward/core names settle
- Polish depends on all desired user stories being complete

### User Story Dependencies

- **US1 (P1)**: Depends on Phase 2, no dependency on the code cut itself
- **US2 (P1)**: Depends on Phase 2, blocks US3
- **US3 (P1)**: Depends on US2

### Parallel Opportunities

- T001 and T002 can proceed in parallel if the audit notes and rename matrix stay in sync
- T003, T004, and T005 can run in parallel before T006 lands
- T009, T010, and T011 can run in parallel once the Phase 2 vocabulary is stable
- T007 can run in parallel with the early US2 test work, but T008 should wait until the final landed names are known

### Implementation Strategy

1. Freeze the rename matrix and regression harness first.
2. Align durable docs and shared contracts early so downstream renames have one vocabulary source.
3. Land the public/core hard cut across shared, control-plane, and runner-facing consumers.
4. Finish with mechanical cleanup, consistency checks, verification, and review.
