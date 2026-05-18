# Tasks: Layered Context Harness

**Input**: Design documents from `/specs/020-layered-context-harness/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: Documentation consistency checks only. No new executable test surface is required for this issue.

**Organization**: Tasks are grouped by user story so the contract clarification can be delivered in independently reviewable slices.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel
- **[Story]**: Which user story this task belongs to (`[US1]`, `[US2]`, `[US3]`)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Planning And Terminology)

**Purpose**: Lock the terminology and target surfaces before editing existing docs.

- [x] T001 Review `/Users/arcadia/data/mystra/specs/020-layered-context-harness/spec.md`, `/Users/arcadia/data/mystra/specs/002-runtime-profile-context/spec.md`, and `/Users/arcadia/data/mystra/docs/ARCHITECTURE.md` for wording drift
- [x] T002 [P] Confirm the shared terms in `/Users/arcadia/data/mystra/specs/020-layered-context-harness/{research.md,data-model.md,quickstart.md}`

---

## Phase 2: Foundational (Primary Contract Surfaces)

**Purpose**: Update the existing runtime/context feature docs that already own the execution contract.

- [x] T003 Update `/Users/arcadia/data/mystra/specs/002-runtime-profile-context/spec.md` so Context Bundle semantics explicitly include submission-time frozen spec injection and artifact-first execution
- [x] T004 [P] Update `/Users/arcadia/data/mystra/specs/002-runtime-profile-context/research.md` to record the freeze-point and artifact-vs-chat-history decisions
- [x] T005 [P] Update `/Users/arcadia/data/mystra/specs/002-runtime-profile-context/quickstart.md` to describe the frozen spec artifact and review attribution flow

**Checkpoint**: `002-runtime-profile-context` now describes the layered handoff without requiring readers to open `020/spec.md`.

---

## Phase 3: User Story 1 - Submit Frozen Spec Into Execution Space (Priority: P1) 🎯 MVP

**Goal**: Existing docs say clearly that job submission freezes the execution-facing spec.

**Independent Test**: Search the updated docs and confirm they identify job submission as the freeze point and reject live post-submission drift.

- [x] T006 [US1] Update `/Users/arcadia/data/mystra/specs/002-runtime-profile-context/contracts/api.md` with submission-time freeze and execution-contract wording
- [x] T007 [US1] Update `/Users/arcadia/data/mystra/specs/002-runtime-profile-context/contracts/mcp.md` with the same submission-time freeze semantics for MCP callers

---

## Phase 4: User Story 2 - Sandbox Agents Work From Spec Artifacts, Not Chat History (Priority: P1)

**Goal**: Runner-facing and runtime-facing docs state that sandbox execution consumes injected artifacts rather than live collaboration history.

**Independent Test**: Search the updated runner/runtime docs and confirm they treat chat history as out-of-contract and spec artifacts as primary input.

- [x] T008 [US2] Update `/Users/arcadia/data/mystra/specs/002-runtime-profile-context/contracts/runner-claim.md` to describe artifact-first execution semantics
- [x] T009 [US2] Reconcile the corresponding bundle/injection wording in `/Users/arcadia/data/mystra/specs/002-runtime-profile-context/spec.md` if contract phrasing changed

---

## Phase 5: User Story 3 - Reviewers Can Explain Which Spec Version Produced The Result (Priority: P2)

**Goal**: Architecture and quickstart docs explain how completed runs remain attributable to the frozen spec version they executed.

**Independent Test**: Read the updated architecture and quickstart docs and confirm they explain why newer collaborative revisions require a new job.

- [x] T010 [US3] Update `/Users/arcadia/data/mystra/docs/ARCHITECTURE.md` with the collaborative-workspace to execution-workspace handoff explanation
- [x] T011 [US3] Update `/Users/arcadia/data/mystra/specs/002-runtime-profile-context/quickstart.md` or `/Users/arcadia/data/mystra/specs/020-layered-context-harness/quickstart.md` if review attribution wording still differs

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Verify consistency and close the loop.

- [x] T012 [P] Run targeted text searches across `/Users/arcadia/data/mystra/specs/020-layered-context-harness/`, `/Users/arcadia/data/mystra/specs/002-runtime-profile-context/`, and `/Users/arcadia/data/mystra/docs/ARCHITECTURE.md` for `freeze`, `chat history`, `artifact`, and `Context Bundle`
- [x] T013 Review `git diff --stat` and the touched markdown files to confirm the change stays documentation-only and scope-limited

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 Setup**: No dependencies.
- **Phase 2 Foundational**: Depends on Phase 1.
- **US1**: Depends on Phase 2.
- **US2**: Depends on Phase 2 and should stay aligned with US1 wording.
- **US3**: Depends on Phase 2 and can finish after US1/US2 wording is stable.
- **Polish**: Depends on all user-story phases.

### Parallel Opportunities

- T001 and T002 can overlap.
- T004 and T005 can run in parallel after T003 is scoped.
- T012 and T013 can run in parallel at the end.

## Implementation Strategy

### MVP First

1. Align `002` spec/research/quickstart.
2. Tighten API/MCP/runner contract wording.
3. Update architecture documentation.
4. Run consistency checks and stop.

### Incremental Delivery

1. Deliver the freeze-point semantics.
2. Deliver the artifact-first execution semantics.
3. Deliver the reviewer attribution semantics.
