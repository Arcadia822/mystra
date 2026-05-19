# Tasks: Agent Runtime Skills

**Input**: Design documents from `/specs/016-agent-runtime-skills/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, quickstart.md, contracts/

**Tests**: This feature requires tests. Fixture-backed skill-contract coverage, canonical snapshot parity checks, and manual MCP validation are mandatory. Reuse existing route/MCP coverage instead of duplicating it.

**Organization**: Tasks are grouped by user story so the three-skill coordinating loop can be aligned and verified independently while keeping `008-mcp-skills` as the durable owner of the local skill surface.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g. US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Alignment And Ownership Freeze)

**Purpose**: Freeze the alignment strategy before touching the skill manifests.

- [x] T001 [P] Add fixture scaffolding for implementation-request, user-journey, and status-summary contract checks in `apps/control-plane/app/api/routes.test.ts`
- [x] T002 [P] Update `specs/016-agent-runtime-skills/contracts/skill-surface.md` and `specs/016-agent-runtime-skills/contracts/skill-error-semantics.md` so they explicitly reflect `008` as the durable owner and fixture-backed verification as the drift-detection strategy
- [x] T003 [P] Refresh `specs/008-mcp-skills/quickstart.md` with a short ownership/alignment note so `008` and `016` no longer describe two competing futures for the same three skills

**Checkpoint**: The feature starts from one explicit ownership story, one verification strategy, and one test-fixture shape before any skill wording changes land.

---

## Phase 2: User Story 1 - Coordinating Agent Submits Work Without Hand-Writing Raw Requests (Priority: P1) 🎯 MVP

**Goal**: Keep the implementation-request and user-journey skills thin, current, and provably aligned with the canonical `mystra_create_job` contract.

**Independent Test**: Using only the documented skill inputs, a coordinating agent can form valid implementation-request and user-journey submissions that still pass the MCP create-job contract and preserve canonical business failures.

### Tests for User Story 1

- [x] T004 [P] [US1] Add fixture-backed implementation-request contract assertions in `apps/control-plane/app/api/routes.test.ts` for valid create-job arguments, invalid local input, and preserved business-failure meaning
- [x] T005 [P] [US1] Add fixture-backed user-journey contract assertions in `apps/control-plane/app/api/routes.test.ts` for acceptance-criteria packaging, invalid local input, and preserved business-failure meaning

### Implementation for User Story 1

- [x] T006 [US1] Update `.agents/skills/mystra-submit-implementation-request/SKILL.md` so required inputs, workflow-hint metadata, and expected result fields match the current MCP contract and `016` wording
- [x] T007 [US1] Update `.agents/skills/mystra-submit-user-journey/SKILL.md` so acceptance-criteria requirements, prompt packaging, and failure wording match the current MCP contract and `016` wording

**Checkpoint**: The two submission skills remain repo-local wrappers over `mystra_create_job`, and fixture-backed tests prove they have not drifted from the API truth.

---

## Phase 3: User Story 2 - Coordinating Agent Checks Job Status Through A Human-Readable Skill (Priority: P1)

**Goal**: Keep the status skill honest about what `mystra_get_job` actually returns, without inventing a second summary model.

**Independent Test**: A coordinating agent can inspect a valid job and a missing job through the documented status flow, then receive only summary fields that exist in the canonical snapshot or canonical business error.

### Tests for User Story 2

- [x] T008 [P] [US2] Add fixture-backed status-summary and missing-job assertions in `apps/control-plane/app/api/routes.test.ts` using canonical snapshot fields returned by `mystra_get_job`
- [x] T009 [P] [US2] Audit `packages/shared/src/management.test.ts` for any missing assertions on the canonical snapshot fields promised by the status skill, and extend it if needed

### Implementation for User Story 2

- [x] T010 [US2] Update `.agents/skills/mystra-check-job-status/SKILL.md` so its required input, summary bullets, and missing-job wording promise only fields the canonical snapshot and management errors actually expose
- [x] T011 [US2] Refresh `specs/016-agent-runtime-skills/contracts/skill-surface.md`, `specs/016-agent-runtime-skills/contracts/skill-error-semantics.md`, and `specs/016-agent-runtime-skills/quickstart.md` so the status flow documents the same fixture-backed expectations used in tests

**Checkpoint**: The status skill is honest, the canonical snapshot remains the only truth, and missing-job behavior is preserved end to end.

---

## Phase 4: User Story 3 - Skill Author Reuses One Small Local Surface Instead Of Repeating Submission Logic (Priority: P2)

**Goal**: Make the future-author story explicit without moving long-term ownership away from `008`.

**Independent Test**: A maintainer reading `008` plus `016` can tell where the three skills live, what rules a future skill must follow, and how to verify alignment without reverse-engineering the MCP transport.

### Implementation for User Story 3

- [x] T012 [P] [US3] Refresh `specs/016-agent-runtime-skills/quickstart.md` so future maintainers reuse fixture-backed submission/status contracts instead of hand-crafting raw JSON-RPC payloads
- [x] T013 [P] [US3] Update `docs/LOCAL-USAGE.md` with the final local-skill workflow language, manual MCP fallback, and current trust-boundary wording

**Checkpoint**: Future skill authors get one clear extension story, and `008` plus `016` read as complementary instead of contradictory.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Verify the aligned skill surface, docs, and contracts together before implementation is considered complete.

- [x] T014 [P] Run `pnpm --filter @mystra/shared build`
- [x] T015 [P] Run `pnpm --filter @mystra/control-plane test`
- [x] T016 Run `pnpm typecheck` if shared or route code changed, then execute the manual create-job / get-job validation flow from `specs/016-agent-runtime-skills/quickstart.md` and reconcile any doc drift before closure

**Checkpoint**: The aligned skill surface is documented, fixture-backed, manually spot-checked, and ready to support later CLI or summary work without inventing an SDK.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies, start immediately
- **User Story 1 (Phase 2)**: Depends on Setup completion
- **User Story 2 (Phase 3)**: Depends on User Story 1 because the status skill should follow the same frozen alignment story and test-fixture style
- **User Story 3 (Phase 4)**: Depends on User Story 1 and User Story 2 so future-author guidance reflects the final submission and status contracts
- **Polish (Phase 5)**: Depends on all desired stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Starts after ownership and fixture strategy are frozen
- **User Story 2 (P1)**: Starts after submission-skill alignment is frozen
- **User Story 3 (P2)**: Starts after submission and status wording are both stable

### Within Each User Story

- Add or update fixture-backed tests before rewriting the corresponding skill manifest
- Keep route/MCP truth in existing test surfaces rather than inventing a parallel test harness
- Refresh quickstart/docs only after the final skill wording is stable
- Manual MCP validation only after automated coverage passes

### Parallel Opportunities

- `T001`, `T002`, and `T003` can run in parallel
- `T004` and `T005` can run in parallel
- `T008` and `T009` can run in parallel
- `T012` and `T013` can run in parallel
- `T014` and `T015` can run in parallel

---

## Implementation Strategy

### MVP First

1. Freeze ownership and fixture-backed verification
2. Align the two submission skills
3. Align the status skill
4. **STOP and VALIDATE**: confirm fixture-backed tests and manual MCP checks agree with the documented skill surface
5. Refresh future-author docs and local usage guidance

### Incremental Delivery

1. Lock the ownership/alignment story
2. Land fixture-backed submission coverage and skill wording
3. Land fixture-backed status coverage and skill wording
4. Refresh docs and run focused verification

### Parallel Team Strategy

With multiple worktrees:

1. Lane A: `T001` -> `T004`/`T005` -> `T006`/`T007`
2. Lane B: `T002`/`T003` -> `T012`/`T013`
3. Lane C: `T008`/`T009` -> `T010`/`T011`

Merge Lane A first, then Lane C, then Lane B, then finish verification in one lane.

---

## Notes

- This tasks file intentionally keeps `016` as an alignment and verification slice, not a re-homing of the skill surface away from `008`.
- The automated drift check uses explicit fixtures, not markdown parsing, because the current MCP input schemas still live inline in `apps/control-plane/app/api/mcp/route.ts`.
- Existing route/MCP contract coverage is a dependency, not something to duplicate.
- A shared SDK, helper module, or second transport layer remains out of scope.
