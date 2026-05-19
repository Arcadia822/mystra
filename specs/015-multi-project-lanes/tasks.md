# Tasks: Multi-Project Lanes

**Input**: Design documents from `/specs/015-multi-project-lanes/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: This feature requires tests. Lane inspection, frozen submission-time
attribution, project-edit regression coverage, and concurrent-lane overlap
coverage are mandatory.

**Organization**: Tasks are grouped by user story so each lane behavior can be
implemented and verified independently while preserving `014` as the canonical
management base.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g. US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Contract And Regression Prep)

**Purpose**: Freeze the lane vocabulary and add failing tests before behavior
changes land.

- [X] T001 [P] Add failing shared-schema assertions for lane inspection and submitted-lane attribution in `packages/shared/src/management.test.ts`
- [X] T002 [P] Add failing provider regression tests for frozen submitted-lane snapshots and post-submission project edits in `apps/control-plane/src/lib/db/sqlite-provider.test.ts`
- [X] T003 [P] Add failing route-level tests for lane inspection, concurrent lane overlap, and frozen run attribution in `apps/control-plane/app/api/routes.test.ts`

**Checkpoint**: The desired lane behavior is specified as failing tests before the
management contract or provider snapshots are widened.

---

## Phase 2: Foundational (Shared Lane Contract)

**Purpose**: Add the shared lane contract surfaces that routes and provider
snapshots will reuse.

**⚠️ CRITICAL**: Do not widen routes or persistence before the shared contract is
clear.

- [X] T004 Add workflow-hint, current lane-inspection, and submitted-lane snapshot schemas in `packages/shared/src/management.ts`
- [X] T005 Export the new lane management types from `packages/shared/src/index.ts` and keep them aligned with existing workflow/runtime schemas
- [X] T006 Reconcile any shared-schema tests in `packages/shared/src/management.test.ts` so the lane contract stays strict and additive

**Checkpoint**: The lane contract exists in shared schemas and can be consumed by
the provider and HTTP routes without route-local JSON invention.

---

## Phase 3: User Story 1 - Coordinating Agent Targets Distinct Project Lanes On One Host (Priority: P1) 🎯 MVP

**Goal**: Let the coordinating agent inspect `mystra` and `skrya` as distinct
project lanes and choose one without ambiguity.

**Independent Test**: Configure `mystra` and `skrya` with distinct repo/base
branch/default-agent/runtime or workflow-hint values, inspect both project
detail reads, and verify the returned lane views are enough to pick the correct
target.

### Tests for User Story 1

- [X] T007 [P] [US1] Add route assertions for current lane inspection in `apps/control-plane/app/api/routes.test.ts`
- [X] T008 [P] [US1] Add shared-schema assertions for optional workflow hints and lane inspection views in `packages/shared/src/management.test.ts`

### Implementation for User Story 1

- [X] T009 [US1] Add the current lane-inspection projection to `apps/control-plane/app/api/projects/[slug]/route.ts`
- [X] T010 [US1] Keep project listing and detail behavior aligned with the additive lane contract in `apps/control-plane/app/api/projects/route.ts` and `packages/shared/src/management.ts`
- [X] T011 [US1] Preserve honest optional workflow hints from `project.metadata.workflow` without inventing first-class workflow storage in `apps/control-plane/src/lib/db/sqlite-provider.ts` and `packages/shared/src/management.ts`

**Checkpoint**: Project detail reads expose an explicit current lane config that
distinguishes `mystra` and `skrya` without UI lookups.

---

## Phase 4: User Story 2 - Concurrent Runs Stay Scoped To Their Project Lane (Priority: P1)

**Goal**: Keep overlapping runs attributable to the correct lane and preserve the
selected lane configuration after job creation.

**Independent Test**: Submit overlapping `mystra` and `skrya` jobs, edit one
project after submission, and confirm each job snapshot still reports the lane
configuration selected at submission time.

### Tests for User Story 2

- [X] T012 [P] [US2] Add provider regression coverage for post-submission project edits in `apps/control-plane/src/lib/db/sqlite-provider.test.ts`
- [X] T013 [P] [US2] Add route coverage for overlapping `mystra` and `skrya` jobs in `apps/control-plane/app/api/routes.test.ts`
- [X] T014 [P] [US2] Add route coverage for list/get parity of submitted-lane attribution in `apps/control-plane/app/api/routes.test.ts`

### Implementation for User Story 2

- [X] T015 [US2] Add additive durable submitted-lane snapshot storage and parsing in `apps/control-plane/src/lib/db/sqlite-provider.ts`
- [X] T016 [US2] Extend `apps/control-plane/src/lib/db/rdb-provider.ts` snapshot typing so job reads can carry the submitted-lane snapshot
- [X] T017 [US2] Expose the frozen submitted-lane snapshot through `apps/control-plane/app/api/jobs/route.ts` and `apps/control-plane/app/api/jobs/[id]/route.ts`

**Checkpoint**: Concurrent runs remain attributable, and project edits after
submission do not rewrite historical lane truth.

---

## Phase 5: User Story 3 - Project Lanes Carry Distinct Context, Workflow, And Runtime Inputs (Priority: P2)

**Goal**: Make lane-specific context, workflow hints, and execution inputs
inspectable now and attributable later through canonical job snapshots.

**Independent Test**: Configure different context bundle refs, runtime defaults,
prewarm config, and workflow hints for `mystra` and `skrya`; verify both the
project detail view and the submitted-lane snapshot expose those differences.

### Tests for User Story 3

- [X] T018 [P] [US3] Add shared-schema coverage for lane context/runtime/workflow-hint fields in `packages/shared/src/management.test.ts`
- [X] T019 [P] [US3] Add provider tests proving resolved runtime and selected context inputs remain lane-specific in `apps/control-plane/src/lib/db/sqlite-provider.test.ts`

### Implementation for User Story 3

- [X] T020 [US3] Project runtime, context bundle refs, prewarm config, and workflow hints into the submitted-lane snapshot in `apps/control-plane/src/lib/db/sqlite-provider.ts`
- [X] T021 [US3] Keep the current lane-inspection view and submitted-lane snapshot semantically distinct in `packages/shared/src/management.ts` and `apps/control-plane/app/api/projects/[slug]/route.ts`
- [X] T022 [US3] Reconcile route-level serialization so MCP and future consumers inherit the same lane semantics through `apps/control-plane/app/api/jobs/route.ts`, `apps/control-plane/app/api/jobs/[id]/route.ts`, and `apps/control-plane/app/api/mcp/route.ts`

**Checkpoint**: Lane-specific context, workflow intent, and execution inputs are
visible and stay attributable without inventing a second workflow or runtime
truth.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Refresh docs, validate the additive lane contract, and close the
feature with focused evidence.

- [X] T023 [P] Refresh `specs/015-multi-project-lanes/quickstart.md` and both contract docs with the final payload shape and verification flow
- [X] T024 [P] Update nearby docs such as `docs/LOCAL-USAGE.md` if the lane-aware management examples change operator expectations
- [X] T025 Run `pnpm --filter @mystra/shared test`, `pnpm --filter @mystra/control-plane test`, `pnpm --filter @mystra/runner-daemon test`, and `pnpm typecheck`
- [X] T026 Run the focused manual verification flow from `specs/015-multi-project-lanes/quickstart.md` and reconcile any deviations back into the spec or docs before closure

**Checkpoint**: The lane contract is documented, verified, and ready to support
later SDK, CLI, and summary work.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies, start immediately
- **Foundational (Phase 2)**: Depends on Setup completion, blocks every story
- **User Story 1 (Phase 3)**: Depends on Foundational
- **User Story 2 (Phase 4)**: Depends on Foundational and benefits from the lane-inspection vocabulary from US1
- **User Story 3 (Phase 5)**: Depends on Foundational and the submitted-lane snapshot from US2
- **Polish (Phase 6)**: Depends on all desired stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Starts after the shared lane vocabulary is frozen
- **User Story 2 (P1)**: Starts after the shared lane vocabulary is frozen and captures the historical truth requirement
- **User Story 3 (P2)**: Starts after the submitted-lane snapshot exists so context/workflow/runtime differences have somewhere honest to live

### Parallel Opportunities

- `T001`, `T002`, and `T003` can run in parallel
- `T007` and `T008` can run in parallel
- `T012`, `T013`, and `T014` can run in parallel
- `T018` and `T019` can run in parallel
- `T023` and `T024` can run in parallel

---

## Implementation Strategy

### MVP First

1. Add failing tests for current lane inspection and frozen lane attribution
2. Freeze the shared lane vocabulary
3. Land current project-lane inspection
4. Land frozen submitted-lane snapshots for job reads
5. **STOP and VALIDATE**: confirm concurrent `mystra` and `skrya` runs remain
   attributable even after project edits

### Incremental Delivery

1. Land lane inspection truth for project reads
2. Land submitted-lane truth for job reads
3. Reconcile workflow-hint/context/runtime distinctions
4. Refresh docs and run the full focused verification flow

### Parallel Team Strategy

With multiple worktrees:

1. Lane A: Shared contract -> provider snapshot -> job route projection
2. Lane B: Project-detail projection after Lane A freezes the lane vocabulary
3. Lane C: Docs/quickstart refresh after payload shape settles

Merge Lane A first, then Lane B, then Lane C.

---

## Notes

- This feature extends `014`; it does not replace or fork the canonical
  management contract.
- Current project reads and submission-time frozen lane attribution are both
  required. One without the other is incomplete.
- `project.metadata.workflow` is a bounded hint seam for this slice, not a claim
  that project workflow configuration is now fully modeled.
- Existing runner eligibility logic is part of the solution; stronger regression
  coverage is part of the deliverable.
