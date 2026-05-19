# Tasks: Management API Truth

**Input**: Design documents from `/specs/014-management-api-truth/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: This feature requires tests. Shared-schema tests, HTTP route tests, MCP parity tests, restart regression tests, and lane-attribution coverage are mandatory.

**Organization**: Tasks are grouped by user story so each story can be implemented and verified independently, while respecting the requirement that shared contracts land before route and MCP reconciliation.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g. US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Contract Freeze Preparation)

**Purpose**: Prepare the shared contract surface and route helpers that every later task depends on.

- [x] T001 Create `packages/shared/src/management.ts` with the frozen management error vocabulary, project selection view, project-card execution-context view, and canonical run snapshot schemas
- [x] T002 [P] Export the new management schemas from `packages/shared/src/index.ts`
- [x] T003 [P] Add schema tests for `packages/shared/src/management.ts` in `packages/shared/src/management.test.ts`
- [x] T004 Add or update route-level management response helpers in `apps/control-plane/src/lib/http.ts` or a nearby helper file so project, job, and cancel routes can share normalized error semantics

**Checkpoint**: Shared contract types exist, are exported, and have isolated test coverage before any route behavior changes.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Land the blocking route and persistence-facing changes that must be correct before any user-story behavior is considered complete.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T005 Extend `apps/control-plane/src/lib/db/rdb-provider.ts` types so the snapshot-embedded project view can carry the minimum lane-attribution fields required by `014`
- [x] T006 Reconcile the current persistence-backed snapshot projection in `apps/control-plane/src/lib/db/sqlite-provider.ts` with the canonical `run.result` and project-card semantics from `packages/shared/src/management.ts`
- [x] T007 [P] Add failing shared-contract route assertions in `apps/control-plane/app/api/routes.test.ts` for project errors, job errors, cancel errors, and snapshot shape mismatches
- [x] T008 [P] Add failing MCP parity assertions in `apps/control-plane/app/api/routes.test.ts` for project lookup, job lookup, and cancel semantics

**Checkpoint**: The DB-facing types and failing tests agree on the same contract before route handlers are rewritten.

---

## Phase 3: User Story 1 - Coordinating Agent Inspects Projects And Execution Context (Priority: P1) 🎯 MVP

**Goal**: Let an external coordinating agent distinguish `mystra` and `skrya`, inspect one project, and get only the stable project-backed execution facts needed to choose where to submit work.

**Independent Test**: Query `GET /api/projects` and `GET /api/projects/{slug}` against a deployment with at least `mystra` and `skrya`, then verify the returned payloads are enough to pick the right project without using the UI.

### Tests for User Story 1

- [x] T009 [P] [US1] Add project-list and project-detail contract tests in `apps/control-plane/app/api/routes.test.ts`
- [x] T010 [P] [US1] Add schema coverage for `ProjectSelectionView` and `ExecutionContextView` in `packages/shared/src/management.test.ts`

### Implementation for User Story 1

- [x] T011 [US1] Update `apps/control-plane/app/api/projects/route.ts` to emit the canonical project list payload and shared machine-readable errors
- [x] T012 [US1] Update `apps/control-plane/app/api/projects/[slug]/route.ts` to emit the project-card execution-context payload and shared machine-readable errors
- [x] T013 [US1] Normalize any supporting project-route helpers in `apps/control-plane/src/lib/http.ts` and keep the explicit success payloads `{ projects }` and `{ project }`

**Checkpoint**: Project selection and project inspection are frozen and independently testable through the canonical HTTP contract.

---

## Phase 4: User Story 2 - Coordinating Agent Submits Work, Polls Runs, And Cancels Safely (Priority: P1)

**Goal**: Let the coordinating agent submit work, poll one canonical snapshot, distinguish missing vs not-ready states, and request cancellation through the same shared error vocabulary.

**Independent Test**: Submit work through `POST /api/jobs`, poll it through `GET /api/jobs/{id}`, cancel a second in-flight job through `POST /api/jobs/{id}/cancel`, and verify the HTTP responses all use the frozen success/error semantics.

### Tests for User Story 2

- [x] T014 [P] [US2] Add create-job, get-job, list-jobs, and cancel-job contract tests in `apps/control-plane/app/api/routes.test.ts`
- [x] T015 [P] [US2] Add restart-regression coverage for job snapshot retrieval in `apps/control-plane/app/api/routes.test.ts`
- [x] T016 [P] [US2] Add overlapping multi-project attribution coverage in `apps/control-plane/app/api/routes.test.ts` so `mystra` and `skrya` runs stay distinguishable

### Implementation for User Story 2

- [x] T017 [US2] Update `apps/control-plane/app/api/jobs/route.ts` so `GET /api/jobs` and `POST /api/jobs` use the canonical list and snapshot semantics plus shared machine-readable errors
- [x] T018 [US2] Keep `apps/control-plane/app/api/jobs/[id]/route.ts` on one canonical snapshot read model so missing jobs fail clearly and queued/running/terminal/restart-resumed states stay distinguishable through `run.state` and `run.result`
- [x] T019 [US2] Update `apps/control-plane/app/api/jobs/[id]/cancel/route.ts` so cancel responses and errors use the shared vocabulary without lowercase ad hoc strings
- [x] T020 [US2] Reconcile `apps/control-plane/src/lib/http.ts` helpers so Zod validation failures and route-specific errors emit the same machine-readable structure across all job and cancel actions

**Checkpoint**: Submission, list, poll, restart-resume, cancel, and result retrieval all work through one coherent HTTP management surface.

---

## Phase 5: User Story 3 - Operator And Agent See The Same Truth Through MCP (Priority: P2)

**Goal**: Keep MCP as a projection of the canonical HTTP semantics so agent and operator consumers do not observe a second truth.

**Independent Test**: Use the current MCP tools to list projects, inspect one project, create a job, fetch the job, and cancel a job, then confirm the transported payloads match the canonical HTTP success/error meanings.

### Tests for User Story 3

- [x] T021 [P] [US3] Add MCP parity tests for project list/get, job create/get/list, and cancel behavior in `apps/control-plane/app/api/routes.test.ts`
- [x] T022 [P] [US3] Add MCP-local JSON-RPC error-shape assertions in `apps/control-plane/app/api/routes.test.ts` so tool-argument failures remain transport errors while business failures reuse the canonical management vocabulary

### Implementation for User Story 3

- [x] T023 [US3] Update `apps/control-plane/app/api/mcp/route.ts` so project and job tools project the canonical success payloads instead of route-local ad hoc payloads
- [x] T024 [US3] Update `apps/control-plane/app/api/mcp/route.ts` so business failures use the shared management error vocabulary while JSON-RPC transport failures stay transport-specific
- [x] T025 [US3] Verify and, if needed, update any helper schemas inside `apps/control-plane/app/api/mcp/route.ts` so the strict schema parse matches the frozen `packages/shared/src/management.ts` contract

**Checkpoint**: MCP remains an adapter, not a shadow API, and parity coverage proves it.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Finish documentation, validation, and low-risk cleanup that affects multiple stories.

- [x] T026 [P] Refresh `specs/014-management-api-truth/quickstart.md` with the final route names, payload expectations, and trust-boundary wording after implementation settles
- [x] T027 [P] Update nearby docs such as `docs/LOCAL-USAGE.md` if the canonical management contract changes any operator-facing examples
- [x] T028 Run `pnpm --filter @mystra/shared test`, `pnpm --filter @mystra/control-plane test`, `pnpm --filter @mystra/runner-daemon test`, and `pnpm typecheck`
- [x] T029 Run the quickstart validation flow from `specs/014-management-api-truth/quickstart.md` and reconcile any deviations back into the spec or docs before closing the feature

**Checkpoint**: The contract is documented, verified, and ready to serve as the truth for later coordinating skill and CLI work, plus any later SDK.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies, start immediately
- **Foundational (Phase 2)**: Depends on Setup completion, blocks all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational
- **User Story 2 (Phase 4)**: Depends on User Story 1 because lane-attribution honesty relies on the project-card identity work
- **User Story 3 (Phase 5)**: Depends on User Story 2 because MCP must adapt the final HTTP semantics, not an intermediate version
- **Polish (Phase 6)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational, no dependency on later stories
- **User Story 2 (P1)**: Starts after User Story 1 freezes project-card and lane-attribution semantics
- **User Story 3 (P2)**: Starts after User Story 2 freezes the final HTTP success/error behavior

### Within Each User Story

- Schema and route tests should fail before implementation changes land
- Shared schemas before route handlers
- HTTP routes before MCP projection
- Manual quickstart validation only after automated coverage passes

### Parallel Opportunities

- `T002` and `T003` can run in parallel
- `T007` and `T008` can run in parallel
- `T009` and `T010` can run in parallel
- `T014`, `T015`, and `T016` can run in parallel
- `T021` and `T022` can run in parallel
- `T026` and `T027` can run in parallel

---

## Parallel Example: Early Safe Splits

```bash
# Shared-schema preparation
Task: "Export the new management schemas from packages/shared/src/index.ts"
Task: "Add schema tests for packages/shared/src/management.ts in packages/shared/src/management.test.ts"

# Contract-test preparation
Task: "Add failing shared-contract route assertions in apps/control-plane/app/api/routes.test.ts"
Task: "Add failing MCP parity assertions in apps/control-plane/app/api/routes.test.ts"
```

---

## Implementation Strategy

### MVP First

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1
4. Complete Phase 4: User Story 2
5. **STOP and VALIDATE**: confirm HTTP contract, restart behavior, and lane attribution before touching MCP
6. Complete Phase 5: User Story 3
7. Complete Phase 6: Polish

### Incremental Delivery

1. Freeze shared schemas and failing tests
2. Land project inspection truth
3. Land job submit/poll/cancel truth
4. Land MCP parity over the frozen HTTP semantics
5. Refresh docs and run full verification

### Parallel Team Strategy

With multiple worktrees:

1. Lane A: Phase 1 -> Phase 2 -> User Story 1 -> User Story 2
2. Lane B: Documentation refresh tasks `T026` and `T027` after the shared schema freeze
3. Merge Lane B after the route shapes settle, then finish MCP and final validation in Lane A

---

## Notes

- This tasks file intentionally keeps `014` bounded to canonical API truth, not coordinating skill, CLI, or SDK implementation.
- Explicit success payloads stay route-specific. The shared generic structure is for errors and read-model typing, not a universal `{ data: ... }` wrapper.
- `run.result` remains the terminal result source of truth.
- Project detail is a project-card view in `014`, not a promise that richer workflow/context storage already exists.
