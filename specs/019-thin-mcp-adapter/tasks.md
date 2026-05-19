# Tasks: Thin MCP Adapter

**Input**: Design documents from `/specs/019-thin-mcp-adapter/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, quickstart.md, contracts/

**Tests**: This feature requires tests. Shared-schema tests, MCP route regressions, descriptor-sync coverage, internal-error correlation checks, and expanded manual MCP validation are mandatory.

**Organization**: Tasks are grouped by user story so the MCP hardening work can land in vertical slices while the shared descriptor model and shared wrapper ownership stay aligned.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this belongs to (e.g. US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Hardening Scope Freeze)

**Purpose**: Freeze the accepted scope, failing expectations, and verification shape before restructuring the adapter.

- [ ] T001 [P] Add failing shared-contract expectations in `packages/shared/src/management.test.ts` for `projectCreateResponseSchema` and any new wrapped response schemas needed for context bundles and runners
- [ ] T002 [P] Add failing MCP regression assertions in `apps/control-plane/app/api/routes.test.ts` for canonical wrapped payloads, `mystra_create_project` conflict handling, internal-error request-id preservation, and full live `tools/list` inventory
- [ ] T003 [P] Refresh `specs/019-thin-mcp-adapter/contracts/mcp-adapter-surface.md`, `specs/019-thin-mcp-adapter/contracts/mcp-error-boundary.md`, and `specs/019-thin-mcp-adapter/quickstart.md` so the descriptor-model, shared-wrapper, and request-correlation expectations are explicit before implementation begins

**Checkpoint**: Shared expectations, failing regressions, and operator guidance all describe the same hardening target before route code changes begin.

---

## Phase 2: Foundational (Descriptor Model And Shared Wrapper Base)

**Purpose**: Land the blocking structure all later slices depend on.

**⚠️ CRITICAL**: No user story is complete until the MCP route has one descriptor-driven source of truth and the accepted HTTP-backed surfaces have shared wrapper ownership.

- [ ] T004 Create a shared MCP descriptor model in `apps/control-plane/app/api/mcp/route.ts` or a nearby helper such as `apps/control-plane/app/api/mcp/tools.ts` so `tools/list`, argument validation, and dispatch wiring stop diverging
- [ ] T005 Add and export missing shared wrapped response schemas in `packages/shared/src/management.ts` and `packages/shared/src/index.ts`, starting with `projectCreateResponseSchema` and extending to accepted context-bundle / runner wrappers where needed
- [ ] T006 Reconcile `apps/control-plane/app/api/projects/route.ts`, `apps/control-plane/app/api/context-bundles/route.ts`, and `apps/control-plane/app/api/runners/route.ts` so HTTP emits the same shared wrapper shapes MCP will project

**Checkpoint**: One descriptor source exists, shared wrapper schemas exist, and HTTP truth is ready for MCP to project without route-local ad hoc response shapes.

---

## Phase 3: User Story 1 - Coordinating Agent Uses MCP Without Seeing A Second Truth (Priority: P1) 🎯 MVP

**Goal**: Let a coordinating agent use the live HTTP-backed MCP tools and always receive the same wrapped business meaning exposed through the canonical HTTP routes.

**Independent Test**: Use MCP to create a project, create/list context bundles, list runners, create a job, and fetch a job, then confirm the transported payloads are wrapped and typed the same way as the underlying HTTP truths.

### Tests for User Story 1

- [ ] T007 [P] [US1] Extend `packages/shared/src/management.test.ts` with wrapper coverage for project creation and the accepted context-bundle / runner response schemas added in this slice
- [ ] T008 [P] [US1] Add MCP parity assertions in `apps/control-plane/app/api/routes.test.ts` for `mystra_create_project`, `mystra_create_context_bundle`, `mystra_list_context_bundles`, and `mystra_list_runners`

### Implementation for User Story 1

- [ ] T009 [US1] Normalize `mystra_create_project`, `mystra_create_context_bundle`, `mystra_list_context_bundles`, and `mystra_list_runners` in `apps/control-plane/app/api/mcp/route.ts` (and any new descriptor helper) so they return shared wrapped payloads instead of route-local objects
- [ ] T010 [US1] Keep the corresponding `tools/list` entries in `apps/control-plane/app/api/mcp/route.ts` (or the extracted descriptor helper) aligned with the now-wrapped live tool surface and its input schemas

**Checkpoint**: The live HTTP-backed MCP tools no longer force clients to learn a second wrapper convention.

---

## Phase 4: User Story 2 - Maintainer Evolves One Canonical Contract Instead Of Two Hand-Written MCP Tables (Priority: P1)

**Goal**: Let maintainers change one MCP descriptor graph and one shared response-owner layer, instead of editing duplicated `tools/list` and `tools/call` structures by hand.

**Independent Test**: Change one tool definition in the descriptor layer and confirm `tools/list`, argument parsing, and dispatch behavior stay synchronized without parallel edits in separate route branches.

### Tests for User Story 2

- [ ] T011 [P] [US2] Add descriptor-sync regression coverage in `apps/control-plane/app/api/routes.test.ts` for live tool names, lifecycle metadata, and input-schema drift between `tools/list` and dispatch behavior

### Implementation for User Story 2

- [ ] T012 [US2] Replace the duplicated `tools/list` metadata and `tools/call` branching in `apps/control-plane/app/api/mcp/route.ts` with descriptor-driven advertisement, validation, and dispatch
- [ ] T013 [US2] Extract shared MCP projection helpers in a nearby file such as `apps/control-plane/src/lib/management-projections.ts` and reuse them from `apps/control-plane/app/api/mcp/route.ts` so project/context/runner shaping stops living as ad hoc route-local logic

**Checkpoint**: The main drift source is structuraly removed, not merely watched by tests.

---

## Phase 5: User Story 3 - Transport Errors Stay Transport-Specific And Internal Failures Stay Correlatable (Priority: P2)

**Goal**: Keep invalid requests as JSON-RPC transport errors, keep business failures on stable typed mappings, and preserve request ids when internal failures occur.

**Independent Test**: Trigger invalid params, a known business failure, and an internal adapter failure, then confirm each outcome keeps the correct error category and the internal failure still echoes the original request id.

### Tests for User Story 3

- [ ] T014 [P] [US3] Add or update `apps/control-plane/app/api/routes.test.ts` to cover stable business-error mapping, unknown domain-error fallback behavior, and top-level internal failures preserving the original JSON-RPC `id`

### Implementation for User Story 3

- [ ] T015 [US3] Harden `businessErrorFromException()` and the top-level catch path in `apps/control-plane/app/api/mcp/route.ts` so business failures no longer depend on brittle string-prefix guesses alone and internal failures preserve request correlation

**Checkpoint**: Success paths and failure paths are both explicit enough for real clients to debug.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Reconcile docs, run full verification, and reflect the feature state in project status surfaces.

- [ ] T016 [P] Refresh `specs/019-thin-mcp-adapter/contracts/mcp-adapter-surface.md`, `specs/019-thin-mcp-adapter/contracts/mcp-error-boundary.md`, and `specs/019-thin-mcp-adapter/quickstart.md` after the descriptor model and wrappers settle
- [ ] T017 [P] Refresh `specs/spec-status.md` and any nearby MCP-facing docs if the final live surface wording changed during hardening
- [ ] T018 Run `pnpm --filter @mystra/shared test`, `pnpm --filter @mystra/shared build`, `pnpm --filter @mystra/control-plane test`, and `pnpm --filter @mystra/control-plane typecheck`, then execute the expanded manual MCP smoke from `specs/019-thin-mcp-adapter/quickstart.md`

**Checkpoint**: The hardened adapter is documented, regression-covered, manually spot-checked, and reflected in the spec status surface.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies, start immediately
- **Foundational (Phase 2)**: Depends on Setup completion, blocks all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational
- **User Story 2 (Phase 4)**: Depends on User Story 1 because descriptor hardening should target the final shared wrapper shapes
- **User Story 3 (Phase 5)**: Depends on User Story 2 because the error boundary should settle on top of the final descriptor-driven route structure
- **Polish (Phase 6)**: Depends on all desired stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Starts after the descriptor model and wrapper base are frozen
- **User Story 2 (P1)**: Starts after the wrapped live HTTP-backed surfaces are known
- **User Story 3 (P2)**: Starts after the final descriptor-driven route shape exists

### Within Each User Story

- Add or extend failing tests before normalizing the corresponding route behavior
- Shared wrapper schemas before MCP projection changes
- Descriptor model before removing duplicated `tools/list` and `tools/call` logic
- Manual MCP validation only after automated coverage passes

### Parallel Opportunities

- `T001`, `T002`, and `T003` can run in parallel
- `T004` and `T005` can overlap once the expected wrapper set is fixed
- `T007` and `T008` can run in parallel
- `T016` and `T017` can run in parallel

---

## Implementation Strategy

### MVP First

1. Freeze failing expectations and review-backed docs
2. Land the descriptor model and shared wrappers
3. Normalize the live HTTP-backed MCP tools
4. Remove duplicated route metadata / dispatch wiring
5. **STOP and VALIDATE**: confirm wrapper parity, descriptor sync, and request-id preservation before closing docs
6. Finish docs and verification

### Incremental Delivery

1. Shared wrapper and regression prep
2. Descriptor model foundation
3. Canonical wrapped MCP projections
4. Error-boundary hardening
5. Docs and full verification

### Parallel Team Strategy

With multiple worktrees:

1. Lane A: `T004` -> `T005` -> `T006` -> `T012` -> `T015`
2. Lane B: `T001`/`T002` -> `T007`/`T008` -> `T011`/`T014`
3. Lane C: `T003` -> `T016`/`T017`

Launch Lane A and Lane B in parallel after setup. Merge the descriptor/wrapper core from Lane A first, rebase Lane B onto it for final regression alignment, then finish Lane C and `T018` in one lane.

---

## Notes

- This tasks file intentionally reflects the widened post-review scope: `019` is
  no longer a minimal parity patch, it is an adapter hardening slice.
- The accepted direction is to harden the existing live MCP surface, not to
  silently shrink it during this feature.
- `mystra_health` remains an MCP-owned operational exception even after the
  HTTP-backed tools move onto stronger shared wrapper ownership.
- The current JSON-RPC envelope and `content[].text` transport wrapper remain in
  place for compatibility; the hardening target is ownership, synchronization,
  and error-boundary honesty.
