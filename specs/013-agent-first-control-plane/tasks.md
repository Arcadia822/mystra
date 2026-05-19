# Tasks: Agent-First Control Plane

**Input**: Design documents from `/specs/013-agent-first-control-plane/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: This feature requires tests. Cross-surface parity, restart regression, and overlapping multi-project coverage are mandatory.

**Organization**: Tasks are grouped by user story so each story can be implemented and verified independently, while respecting the umbrella rule that real code lands through child slices `014` to `018`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g. US1, US2, US3, US4)
- Include exact file paths in descriptions

## Phase 1: Setup (Umbrella Alignment)

**Purpose**: Reconcile the reviewed `013` decisions into the child specs before implementation starts.

- [x] T001 Update dependency notes and review constraints in `specs/014-management-api-truth/spec.md`, `specs/015-multi-project-lanes/spec.md`, `specs/016-agent-runtime-skills/spec.md`, `specs/017-operator-cli-surface/spec.md`, and `specs/018-coordination-run-summaries/spec.md`
- [x] T002 Create the canonical API design artifacts in `specs/014-management-api-truth/plan.md`, `specs/014-management-api-truth/research.md`, `specs/014-management-api-truth/data-model.md`, `specs/014-management-api-truth/quickstart.md`, and `specs/014-management-api-truth/contracts/`
- [x] T003 Run engineering review for `specs/014-management-api-truth/plan.md` and reconcile accepted findings back into `specs/014-management-api-truth/plan.md`
- [x] T004 Generate `specs/014-management-api-truth/tasks.md` so implementation of the canonical contract has its own executable child task list

---

## Phase 2: Foundational (Canonical Contract Freeze)

**Purpose**: Land the blocking shared contract and canonical control-plane behavior that every later surface depends on.

**⚠️ CRITICAL**: No coordinating skill, CLI, or coordination-summary implementation should start before this phase is complete.

- [x] T005 [P] Add shared management envelope and error-code schemas in `packages/shared/src/management.ts`
- [x] T006 [P] Export the canonical management schemas from `packages/shared/src/index.ts` and cover them in `packages/shared/src/management.test.ts`
- [x] T007 Add canonical response helpers and one polling snapshot/result read model in `apps/control-plane/src/lib/management-response.ts`
- [x] T008 Update the canonical project and job routes in `apps/control-plane/app/api/projects/route.ts`, `apps/control-plane/app/api/projects/[slug]/route.ts`, `apps/control-plane/app/api/jobs/route.ts`, and `apps/control-plane/app/api/jobs/[id]/route.ts`
- [x] T009 Add the shared contract-parity fixtures and restart regression coverage in `apps/control-plane/app/api/routes.test.ts`
- [x] T010 Reconcile the MCP adapter to the canonical contract in `apps/control-plane/app/api/mcp/route.ts` without introducing a competing envelope or polling model
- [x] T011 Validate the foundational slice with `pnpm --filter @mystra/shared test`, `pnpm --filter @mystra/control-plane test`, `pnpm --filter @mystra/runner-daemon test`, and `pnpm typecheck`

**Checkpoint**: The canonical management contract is frozen, uses shared schemas, exposes one polling snapshot/result view, and has parity coverage for API plus MCP.

---

## Phase 3: User Story 1 - Coordinating Agent Manages Projects Without UI (Priority: P1) 🎯 MVP

**Goal**: Let OpenClaw-style coordinators distinguish `mystra` and `skrya`, inspect project context, and choose a target through the canonical management surface.

**Independent Test**: Query the canonical management API against one deployment with `mystra` and `skrya`, distinguish the two projects, inspect one project, and confirm the returned context is enough for work selection.

### Tests for User Story 1

- [x] T012 [P] [US1] Add project-selection and project-inspection contract coverage in `apps/control-plane/app/api/routes.test.ts`
- [x] T013 [P] [US1] Add shared schema coverage for project selection and execution-context views in `packages/shared/src/management.test.ts`

### Implementation for User Story 1

- [x] T014 [US1] Create the richer multi-project lane plan artifacts in `specs/015-multi-project-lanes/plan.md`, `specs/015-multi-project-lanes/research.md`, `specs/015-multi-project-lanes/data-model.md`, `specs/015-multi-project-lanes/quickstart.md`, and `specs/015-multi-project-lanes/contracts/`
- [x] T015 [US1] Run engineering review for `specs/015-multi-project-lanes/plan.md` and generate `specs/015-multi-project-lanes/tasks.md` before code implementation
- [x] T016 [US1] Add minimum project-lane identity fields and execution-context projections in `packages/shared/src/management.ts` and `apps/control-plane/app/api/projects/[slug]/route.ts`
- [x] T017 [US1] Implement one-host lane identity and selection isolation in `apps/control-plane/app/api/projects/route.ts`, `apps/control-plane/app/api/projects/[slug]/route.ts`, and `packages/shared/src/management.ts`

**Checkpoint**: A coordinating agent can choose between `mystra` and `skrya` and inspect lane-scoped context without the UI.

---

## Phase 4: User Story 2 - Coordinating Agent Submits Work And Tracks Delivery (Priority: P1)

**Goal**: Let the coordinating agent submit work, poll durable state, survive restart, and retrieve final delivery plus coordination-ready summary data.

**Independent Test**: Submit work for one selected project, restart the control plane during polling, resume inspection, and retrieve the final result and coordination summary without log scraping.

### Tests for User Story 2

- [ ] T018 [P] [US2] Add submit/poll/result parity coverage across API and MCP in `apps/control-plane/app/api/routes.test.ts`
- [ ] T019 [P] [US2] Add restart-resume regression coverage in `apps/control-plane/app/api/routes.test.ts` and `apps/runner-daemon/src/index.test.ts`
- [ ] T020 [P] [US2] Add overlap coverage for concurrent `mystra` and `skrya` runs in `apps/control-plane/app/api/routes.test.ts`

### Implementation for User Story 2

- [ ] T021 [US2] Create the coordination-summary plan artifacts in `specs/018-coordination-run-summaries/plan.md`, `specs/018-coordination-run-summaries/research.md`, `specs/018-coordination-run-summaries/data-model.md`, `specs/018-coordination-run-summaries/quickstart.md`, and `specs/018-coordination-run-summaries/contracts/`
- [ ] T022 [US2] Run engineering review for `specs/018-coordination-run-summaries/plan.md` and generate `specs/018-coordination-run-summaries/tasks.md` before code implementation
- [ ] T023 [US2] Implement lane-scoped run attribution, durable result ownership, and canonical polling snapshot parity in `apps/control-plane/app/api/jobs/route.ts`, `apps/control-plane/app/api/jobs/[id]/route.ts`, and `packages/shared/src/management.ts`
- [ ] T024 [US2] Implement coordination summary projection, failure categorization, and runner-result reconciliation in `packages/shared/src/coordination-summary.ts`, `packages/shared/src/result.ts`, `packages/shared/src/index.ts`, `apps/control-plane/app/api/jobs/[id]/route.ts`, and `apps/runner-daemon/src/index.ts`

**Checkpoint**: Submission, polling, restart-resume, overlap isolation, and final delivery all work through one durable contract.

---

## Phase 5: User Story 3 - Agent And Operator Use Clear Management Surface Priorities (Priority: P2)

**Goal**: Ship the first coordinating skill surface as a real consumer of the canonical API, not a parallel abstraction.

**Independent Test**: Use the local Mystra coordinating skills to submit an implementation request or user journey, then inspect job status while proving they consume the same contract and errors as the canonical API.

### Tests for User Story 3

- [x] T025 [P] [US3] Add submission/status parity coverage for the skill-first coordination loop in `apps/control-plane/app/api/routes.test.ts` and the `016` feature verification surface
- [x] T026 [P] [US3] Add missing-input, missing-job, and structured-error coverage for the coordinating skill surface in the `016` feature verification surface

### Implementation for User Story 3

- [x] T027 [US3] Create the coordinating-skill plan artifacts in `specs/016-agent-runtime-skills/plan.md`, `specs/016-agent-runtime-skills/research.md`, `specs/016-agent-runtime-skills/data-model.md`, `specs/016-agent-runtime-skills/quickstart.md`, and `specs/016-agent-runtime-skills/contracts/`
- [x] T028 [US3] Run engineering review for `specs/016-agent-runtime-skills/plan.md` and generate `specs/016-agent-runtime-skills/tasks.md` before code implementation
- [x] T029 [US3] Implement the coordinating skill surface in `.agents/skills/mystra-submit-implementation-request/`, `.agents/skills/mystra-submit-user-journey/`, and `.agents/skills/mystra-check-job-status/`
- [x] T030 [US3] Add parity guards so MCP and UI remain consumers, not truth owners, in `apps/control-plane/app/api/mcp/route.ts` and `apps/control-plane/app/page.tsx`

**Checkpoint**: The first real agent consumer can operate through one local coordinating skill surface that stays aligned with the canonical API.

---

## Phase 6: User Story 4 - Operators Manage The Same Deployment From The Debian Shell (Priority: P2)

**Goal**: Ship a shell-first operator surface with machine-readable output over the same canonical management contract.

**Independent Test**: From the Debian shell, inspect projects, inspect runs, and retrieve a final result in both human and machine-readable forms without using the UI.

### Tests for User Story 4

- [x] T031 [P] [US4] Add CLI JSON-mode parity coverage in `apps/operator-cli/src/index.test.ts`
- [x] T032 [P] [US4] Add missing/not-ready/failed operator outcome tests in `apps/operator-cli/src/index.test.ts`

### Implementation for User Story 4

- [x] T033 [US4] Create the CLI plan artifacts in `specs/017-operator-cli-surface/plan.md`, `specs/017-operator-cli-surface/research.md`, `specs/017-operator-cli-surface/data-model.md`, `specs/017-operator-cli-surface/quickstart.md`, and `specs/017-operator-cli-surface/contracts/`
- [x] T034 [US4] Run engineering review for `specs/017-operator-cli-surface/plan.md` and generate `specs/017-operator-cli-surface/tasks.md` before code implementation
- [x] T035 [US4] Scaffold and implement project/run inspection commands in `apps/operator-cli/package.json`, `apps/operator-cli/tsconfig.json`, `apps/operator-cli/src/index.ts`, and `apps/operator-cli/src/commands/inspect.ts`
- [x] T036 [US4] Implement result/failure retrieval and JSON output modes in `apps/operator-cli/src/commands/result.ts`, `apps/operator-cli/src/formatters/json.ts`, and `apps/operator-cli/src/index.test.ts`

**Checkpoint**: Operators can inspect and retrieve deployment state from the shell, with JSON output that matches the canonical API.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Finish the umbrella by reconciling docs, parity checks, and final validation across child surfaces.

- [ ] T037 [P] Refresh the 013 umbrella docs and child quickstarts in `specs/013-agent-first-control-plane/plan.md`, `specs/014-management-api-truth/quickstart.md`, `specs/015-multi-project-lanes/quickstart.md`, `specs/016-agent-runtime-skills/quickstart.md`, `specs/017-operator-cli-surface/quickstart.md`, and `specs/018-coordination-run-summaries/quickstart.md`
- [ ] T038 Add the cross-surface parity matrix to `docs/LOCAL-USAGE.md` and any nearby module docs that explain API, skill, CLI, and MCP usage
- [ ] T039 Run the end-to-end validation commands in `specs/013-agent-first-control-plane/quickstart.md` and capture any deviations back into the relevant child specs
- [ ] T040 Run the final review gate against the cumulative diff and reconcile findings before merge

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies, start immediately
- **Foundational (Phase 2)**: Depends on Setup, blocks every later story
- **US1 (Phase 3)**: Depends on Foundational
- **US2 (Phase 4)**: Depends on Foundational and the lane identity work from US1
- **US3 (Phase 5)**: Depends on Foundational; safest after the canonical API contract from Phase 2 is stable
- **US4 (Phase 6)**: Depends on Foundational; safest after the canonical API contract from Phase 2 is stable
- **Polish (Phase 7)**: Depends on all desired story phases being complete

### User Story Dependencies

- **User Story 1 (P1)**: Starts after Foundational, establishes project selection and lane identity
- **User Story 2 (P1)**: Starts after Foundational, but depends on US1 for lane attribution to be honest
- **User Story 3 (P2)**: Starts after Foundational, independent from US4 at the module level
- **User Story 4 (P2)**: Starts after Foundational, independent from US3 at the module level

### Parallel Opportunities

- `T005` and `T006` can run in parallel
- `T012` and `T013` can run in parallel
- `T018`, `T019`, and `T020` can run in parallel
- `T025` and `T026` can run in parallel
- `T031` and `T032` can run in parallel
- After Phase 2 completes, **US3** and **US4** can proceed in parallel because they touch `.agents/skills/` and `apps/operator-cli/` respectively

---

## Parallel Example: Post-Foundation Work

```bash
# After canonical API truth lands, run these in parallel:
Task: "Implement the coordinating skills in .agents/skills/mystra-submit-implementation-request/, .agents/skills/mystra-submit-user-journey/, and .agents/skills/mystra-check-job-status/"
Task: "Scaffold the operator CLI app in apps/operator-cli/package.json, apps/operator-cli/tsconfig.json, and apps/operator-cli/src/index.ts"

# Parallel test slices for delivery tracking:
Task: "Add restart-resume regression coverage in apps/control-plane/app/api/routes.test.ts and apps/runner-daemon/src/index.test.ts"
Task: "Add overlap coverage for concurrent mystra and skrya runs in apps/control-plane/app/api/routes.test.ts"
```

---

## Implementation Strategy

### MVP First (Canonical API + Project Selection + Delivery Tracking)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1
4. Complete Phase 4: User Story 2
5. **STOP and VALIDATE**: confirm API + MCP parity, restart-resume, and overlapping lane isolation

### Incremental Delivery

1. Land the canonical API truth in `014`
2. Land honest multi-project lane behavior in `015`
3. Land the first real agent consumer in `016`
4. Land the operator CLI in `017`
5. Land coordination summaries in `018`
6. Reconcile docs and run the final review gate

### Parallel Team Strategy

With multiple worktrees after Phase 2:

1. Lane A: User Story 1 → User Story 2
2. Lane B: User Story 3
3. Lane C: User Story 4
4. Merge B and C after parity checks, then finish A before the Phase 7 polish pass

---

## Notes

- This umbrella tasks file intentionally starts with child-spec reconciliation because `013` is governance/sequencing only.
- The first real code slice, `014-management-api-truth`, is complete and now serves as the frozen base for the remaining child slices.
- `018-coordination-run-summaries` is the next active P1 child slice; `015`, `016`, and `017` are already complete and should be treated as finished umbrella dependencies.
- Every surface must reuse the same shared error vocabulary and polling snapshot.
- CLI human formatting is a presentation layer, not a different contract.
- Cross-surface parity tests are mandatory, not polish.
