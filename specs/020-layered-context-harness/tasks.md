# Tasks: Layered Context Harness

**Input**: Design documents from `/specs/020-layered-context-harness/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: Shared schema tests, control-plane DB/route tests, runner-daemon tests, then broad repo typecheck/test reconciliation.

**Organization**: Tasks are grouped by execution slice so the artifact-first Context Bundle loop can land in a minimal, reviewable sequence.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel
- **[Story]**: Which user story this task belongs to (`[US1]`, `[US2]`, `[US3]`)
- Include exact file paths in descriptions

## Phase 1: Review And Artifact Sync

**Purpose**: Reconfirm the reduced implementation scope and bring the latest spec artifacts into this worktree.

- [x] T001 Review `specs/020-layered-context-harness/{spec.md,plan.md}` against `packages/shared/src/schemas.ts`, `apps/control-plane/src/lib/db/sqlite-provider.ts`, and `apps/runner-daemon/src/index.ts` to confirm the smallest artifact-first closure
- [x] T002 [P] Sync `specs/020-layered-context-harness/` into this worktree so implementation, plan review, and follow-up docs all reference the same feature artifacts

---

## Phase 2: Shared Contract And Control-Plane Freeze

**Purpose**: Freeze a first-class execution-spec artifact at job creation and thread it through the resolved runtime contract.

- [x] T003 [US1] Extend `packages/shared/src/schemas.ts` with safe inline Context Bundle payloads, execution contract references, and execution-spec artifact schemas
- [x] T004 [US1] Update `apps/control-plane/src/lib/db/sqlite-provider.ts` so `createJob()` freezes the execution-spec artifact, persists it via the existing artifacts table, and attaches it to `resolved_runtime` as a required job-scoped Context Bundle
- [x] T005 [P] [US1] Add/refresh focused coverage in `packages/shared/src/schemas.test.ts`, `apps/control-plane/src/lib/db/sqlite-provider.test.ts`, and `apps/control-plane/app/api/routes.test.ts` for freeze-time artifacts and execution-contract metadata

**Checkpoint**: Submitted jobs carry a typed execution-spec artifact and runtime execution contract reference before any runner claims occur.

---

## Phase 3: Runner Materialization And Artifact-First Execution

**Purpose**: Turn runtime Context Bundle metadata into real mounted files and make the injected artifact the primary execution contract.

**Independent Test**: A claimed Docker run materializes the execution-spec bundle before mount and the generated task prompt points the agent at the mounted artifact instead of treating the raw submission prompt as truth.

- [x] T006 [US2] Update `apps/runner-daemon/src/index.ts` so runtime Context Bundles materialize into `cacheRoot/context-bundles/<ref>` for `job-inline`, `local-template`, and `external-artifact` sources before Docker bind mounts are assembled
- [x] T007 [US2] Update runner prompt construction in `apps/runner-daemon/src/index.ts` so the injected execution-spec artifact is the primary contract and the submission prompt is supporting context only
- [x] T008 [P] [US2] Expand `apps/runner-daemon/src/container-task.test.ts` to cover materialization helpers and artifact-first prompt wording

---

## Phase 4: Traceability And Final Reconciliation

**Purpose**: Make the implementation backlog truthful and close the loop with verification.

**Independent Test**: Focused package checks pass, broad repo validation passes, and the feature artifacts describe the landed implementation instead of the old documentation-only task list.

- [x] T009 [US3] Keep reviewer traceability on the existing artifact/event path by emitting `artifact.created` and surfacing execution-contract metadata in job snapshots
- [x] T010 [US3] Reconcile `specs/020-layered-context-harness/{plan.md,tasks.md}` with the landed implementation and finish broad validation (`pnpm typecheck`, `pnpm test`)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 Review And Artifact Sync**: No dependencies.
- **Phase 2 Shared Contract And Control-Plane Freeze**: Depends on Phase 1.
- **Phase 3 Runner Materialization And Artifact-First Execution**: Depends on Phase 2.
- **Phase 4 Traceability And Final Reconciliation**: Depends on Phases 2 and 3.

### Parallel Opportunities

- T001 and T002 can overlap at the start.
- T005 can run in parallel with the end of T004 once the schema shape is stable.
- T008 can run in parallel with the end of T007 once prompt/materialization helpers settle.

## Implementation Strategy

### MVP First

1. Freeze the execution-spec artifact at `createJob()`.
2. Attach it to the resolved runtime as a required job-scoped Context Bundle.
3. Materialize bundles before Docker mounts and point the agent prompt at the mounted artifact.
4. Validate the changed shared, control-plane, and runner surfaces.

### Incremental Delivery

1. Land the typed execution artifact and execution-contract reference.
2. Land control-plane artifact persistence plus runtime attachment.
3. Land runner materialization and artifact-first prompt semantics.
4. Reconcile plan/tasks with the implemented closure.
