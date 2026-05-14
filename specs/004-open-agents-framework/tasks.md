# Tasks: Open Agents Framework Reuse

**Input**: Design documents from `/specs/004-open-agents-framework/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md, `contracts/`

**Tests**: Focused updates to `packages/shared/src/events.test.ts` and `apps/control-plane/app/api/routes.test.ts`, plus the relevant package test commands from `quickstart.md` when the first slice lands.

**Organization**: Tasks are grouped by technical scenario so each planning output and the first alignment slice can be completed and reviewed incrementally.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which technical scenario this task belongs to (`[US1]` ... `[US4]`)
- Include exact file paths in descriptions

## Phase 1: Setup (Artifact Scaffolding)

**Purpose**: Establish the concrete artifact surfaces that 004 will use as its durable truth sources.

- [ ] T001 Add the pinned Open Agents repository, immutable revision, and authoritative upstream source-file list to `specs/004-open-agents-framework/research.md`
- [ ] T002 [P] Create the concrete module inventory artifact in `specs/004-open-agents-framework/contracts/module-inventory.md`
- [ ] T003 [P] Update `specs/004-open-agents-framework/plan.md` and `specs/004-open-agents-framework/quickstart.md` so they reference `contracts/module-inventory.md` as a required 004 output

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Convert the contract documents into executable implementation surfaces before any subsystem-alignment code edits start.

**⚠️ CRITICAL**: No user-story implementation should begin until this phase is complete.

- [ ] T004 Create the subsystem-mapping table structure in `specs/004-open-agents-framework/contracts/framework-alignment.md`
- [ ] T005 [P] Create the seam-record table structure in `specs/004-open-agents-framework/contracts/provider-seams.md`
- [ ] T006 [P] Expand `specs/004-open-agents-framework/contracts/fork-rules.md` and `specs/004-open-agents-framework/contracts/module-inventory.md` with cross-link fields for concrete 004 surfaces
- [ ] T007 Reconcile repository-provider wording across `PRODUCT.md`, `PLATFORM.md`, `README.md`, and `docs/ADR-0004-open-agents-local-provider-boundary.md`

**Checkpoint**: Foundation ready - provenance, mapping, seam, and wording artifacts exist and can anchor the rest of the feature.

---

## Phase 3: User Story 1 - Maintainers Can Trace Mystra Back to Open Agents (Priority: P1) 🎯 MVP

**Goal**: Give maintainers one durable place to trace each MVP-relevant Mystra subsystem back to a pinned upstream Open Agents source or an explicit non-reuse decision.

**Independent Test**: A maintainer can start in `contracts/framework-alignment.md`, follow one subsystem's `upstreamReference` and `moduleInventoryLink`, and reach the exact local owner plus the pinned upstream source evidence without relying on chat history.

### Implementation for User Story 1

- [ ] T008 [US1] Populate concrete mapping entries for control surface, workflow, sandbox, persistence, repository, and agent execution in `specs/004-open-agents-framework/contracts/framework-alignment.md`
- [ ] T009 [P] [US1] Record the approved lifecycle/control-handoff proof boundary and its upstream references in `specs/004-open-agents-framework/research.md`
- [ ] T010 [US1] Add maintainer traceability review steps to `specs/004-open-agents-framework/quickstart.md`

**Checkpoint**: User Story 1 is complete when maintainers can trace at least one full subsystem boundary from Mystra to the pinned upstream source set.

---

## Phase 4: User Story 2 - Local-First Providers Replace Managed Infrastructure Cleanly (Priority: P1)

**Goal**: Make every managed-capability replacement explicit so follow-on provider work starts from shared seams instead of host-specific assumptions.

**Independent Test**: A provider implementer can inspect `provider-seams.md` and `module-inventory.md` and determine how persistence, workflow, sandbox, repository, and agent-execution surfaces are preserved, replaced, deferred, or delegated to follow-on specs.

### Implementation for User Story 2

- [ ] T011 [US2] Populate the persistence, workflow, sandbox, repository, and agent-execution seam records in `specs/004-open-agents-framework/contracts/provider-seams.md`
- [ ] T012 [P] [US2] Classify control plane, workflows, runner daemon, repository provider, sandbox provider, and agent adapters in `specs/004-open-agents-framework/contracts/module-inventory.md`
- [ ] T013 [US2] Update `specs/005-workflow-blueprint/spec.md`, `specs/007-mcp-server/spec.md`, `specs/009-agent-adapters/spec.md`, `specs/010-repo-provider-contracts/spec.md`, and `specs/011-docker-sandbox-provider/spec.md` to reference the concrete 004 mapping, seam, and inventory artifacts

**Checkpoint**: User Story 2 is complete when provider implementers can see a clean seam owner and leakage guard for each managed-capability replacement.

---

## Phase 5: User Story 3 - Divergences And Extensions Are Recorded Before Follow-On Specs Build On Them (Priority: P1)

**Goal**: Lock Mystra's intentional divergences and Mystra-only extensions into durable docs before downstream work reinterprets them.

**Independent Test**: A future agent can read the divergence records and downstream dependency notes and explain what Mystra intentionally forks, extends, or keeps local without inferring missing context.

### Implementation for User Story 3

- [ ] T014 [US3] Record the agent-in-container execution divergence and any other first-slice Mystra-only extensions in `specs/004-open-agents-framework/research.md` and `docs/ADR-0004-open-agents-local-provider-boundary.md`
- [ ] T015 [P] [US3] Update `specs/004-open-agents-framework/spec.md` and `specs/004-open-agents-framework/quickstart.md` so divergence review points to the concrete mapping, seam, inventory, and fork-rule artifacts
- [ ] T016 [US3] Update `specs/008-mcp-skills/spec.md` and `specs/009-agent-adapters/spec.md` so their dependency notes consume 004 divergence and inventory outputs rather than only chat-derived policy

**Checkpoint**: User Story 3 is complete when divergence review is explicit enough that downstream planning no longer needs to rediscover Open Agents alignment policy.

---

## Phase 6: User Story 4 - Initial Alignment Slice Is Small, Verifiable, And Centered On One Proving Boundary (Priority: P2)

**Goal**: Land one real lifecycle/control-handoff alignment slice without widening 004 into a runner rewrite or placeholder-module migration.

**Independent Test**: The lifecycle/control-handoff vocabulary is traceably aligned across `packages/shared/src/events.ts` and `apps/control-plane/app/api/mcp/route.ts`, and the focused package tests still pass.

### Tests for User Story 4

- [ ] T017 [P] [US4] Update lifecycle event coverage in `packages/shared/src/events.test.ts` for the selected first-slice vocabulary in `packages/shared/src/events.ts`
- [ ] T018 [P] [US4] Update control-plane route coverage in `apps/control-plane/app/api/routes.test.ts` for the selected lifecycle/control handoff in `apps/control-plane/app/api/mcp/route.ts`

### Implementation for User Story 4

- [ ] T019 [US4] Align the first-slice lifecycle/control-handoff vocabulary in `packages/shared/src/events.ts`
- [ ] T020 [US4] Apply the aligned lifecycle/control handoff in `apps/control-plane/app/api/mcp/route.ts`
- [ ] T021 [US4] Record the completed first-slice evidence, deferred items, and focused verification commands in `specs/004-open-agents-framework/plan.md` and `specs/004-open-agents-framework/quickstart.md`

**Checkpoint**: User Story 4 is complete when the first alignment slice is documented, tested, and still scoped to one real boundary.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Close the loop on feature verification and leave a clean handoff for implementation and review.

- [ ] T022 [P] Record final verification outcomes and any remaining deferred surfaces in `specs/004-open-agents-framework/checklists/engineering-review.md`
- [ ] T023 Run the final validation workflow described in `specs/004-open-agents-framework/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 - blocks all story work
- **User Story 1 (Phase 3)**: Depends on Phase 2
- **User Story 2 (Phase 4)**: Depends on Phases 2 and 3 because seam ownership should cite completed mapping entries
- **User Story 3 (Phase 5)**: Depends on Phases 3 and 4 because divergence records must point to concrete mapping and seam outputs
- **User Story 4 (Phase 6)**: Depends on Phases 3, 4, and 5 so the first code slice is constrained by the finalized docs
- **Polish (Phase 7)**: Depends on the desired story set being complete

### User Story Dependencies

- **US1**: First MVP story - no dependency on later stories
- **US2**: Uses the traceability outputs from US1
- **US3**: Uses the mapping and seam outputs from US1 and US2
- **US4**: Uses the policy locked by US1-US3 before touching code

### Parallel Opportunities

- T002 and T003 can run in parallel after T001
- T005 and T006 can run in parallel after T004
- T009 can run in parallel with T010 after T008 starts
- T012 can run in parallel with T013 after T011 establishes seam ownership
- T015 can run in parallel with T016 after T014
- T017 and T018 can run in parallel before T019 and T020

---

## Parallel Example: User Story 4

```bash
# Prepare the focused first-slice tests together:
Task: "Update lifecycle event coverage in packages/shared/src/events.test.ts"
Task: "Update control-plane route coverage in apps/control-plane/app/api/routes.test.ts"
```

---

## Implementation Strategy

### MVP First

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phases 3-5: Lock provenance, seams, module inventory, and divergences
4. Complete Phase 6: Land the first lifecycle/control-handoff slice
5. **STOP and VALIDATE** using `quickstart.md` before starting any 005/007/009/010/011 implementation

### Incremental Delivery

1. Finish Setup + Foundational so 004 becomes the durable architecture gate
2. Finish US1 and US2 so downstream specs can consume concrete mapping and seam outputs
3. Finish US3 so divergence policy is explicit
4. Finish US4 so one real alignment slice is proven in code and tests
5. Finish Phase 7 to leave a reviewable handoff package

### Parallel Team Strategy

With multiple developers:

1. One developer owns the 004 contract artifacts (`framework-alignment.md`, `provider-seams.md`, `module-inventory.md`)
2. One developer owns wording reconciliation and downstream spec note updates
3. One developer owns the focused US4 code slice after the documentation policy is locked

---

## Notes

- `[P]` tasks touch different files and should stay coordination-light
- `contracts/module-inventory.md` is the new concrete inventory surface referenced by the updated 004 contracts
- Do not start broader workflow, runner, or adapter rewrites inside 004
- Treat `packages/shared/src/events.ts` plus `apps/control-plane/app/api/mcp/route.ts` as the only approved first proof boundary for code changes
