# Tasks: Operator CLI Surface

**Input**: Design documents from `/specs/017-operator-cli-surface/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: This feature requires tests. CLI parsing, human/json output, and derived operator outcome coverage are mandatory.

**Organization**: Tasks are grouped by user story so the operator CLI can be implemented in thin vertical slices over the canonical management API.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this belongs to
- Include exact file paths in descriptions

## Phase 1: Setup (Contract Freeze)

**Purpose**: Freeze command names, output modes, and test expectations before writing the CLI.

- [x] T001 [P] Add CLI behavior tests for argument parsing and common command success/failure flows in `apps/control-plane/src/lib/operator-cli.test.ts`
- [x] T002 [P] Backfill spec artifacts for `017` in `specs/017-operator-cli-surface/` so implementation does not rely on chat memory

**Checkpoint**: CLI command surface and expected outcomes are written down before implementation begins.

---

## Phase 2: Foundational (Entrypoint And Shared Outcome Logic)

**Purpose**: Add the reusable CLI plumbing all commands depend on.

**⚠️ CRITICAL**: No story is complete until the CLI has consistent argument parsing, fetch behavior, and outcome mapping.

- [x] T003 Create `scripts/operator-cli.mjs` with subcommand parsing, `MYSTRA_CONTROL_PLANE_URL` handling, shared fetch helpers, and operator-outcome mapping
- [x] T004 [P] Add the root package alias for the operator CLI in `package.json`

**Checkpoint**: The CLI can parse commands, talk to the control plane, and produce consistent success/failure envelopes.

---

## Phase 3: User Story 1 - Operator Inspects Projects And Runs From The Debian Shell (Priority: P1) 🎯 MVP

**Goal**: Let an operator inspect projects and recent runs without opening the UI.

**Independent Test**: Run `projects list`, `projects inspect`, `runs list`, and `runs inspect` against a local control plane and confirm the output is sufficient for routine operator understanding.

### Tests for User Story 1

- [x] T005 [P] [US1] Add focused tests for `projects list` and `projects inspect` in `apps/control-plane/src/lib/operator-cli.test.ts`
- [x] T006 [P] [US1] Add focused tests for `runs list` and `runs inspect` in `apps/control-plane/src/lib/operator-cli.test.ts`

### Implementation for User Story 1

- [x] T007 [US1] Implement `projects list` and `projects inspect` in `scripts/operator-cli.mjs`
- [x] T008 [US1] Implement `runs list` and `runs inspect` in `scripts/operator-cli.mjs`

**Checkpoint**: Project and run inspection work independently and are useful without the UI.

---

## Phase 4: User Story 2 - Operator Retrieves Final Results And Failure Context From The Shell (Priority: P1)

**Goal**: Let an operator retrieve terminal summaries and failure context from one canonical run snapshot.

**Independent Test**: Run `runs result <job-id>` for completed and active runs, and `runs failure <job-id>` for failed and successful runs, then verify the CLI distinguishes not-ready, unavailable, and failed states.

### Tests for User Story 2

- [x] T009 [P] [US2] Add tests for `runs result` success, `RESULT_NOT_READY`, and `RESULT_UNAVAILABLE` in `apps/control-plane/src/lib/operator-cli.test.ts`
- [x] T010 [P] [US2] Add tests for `runs failure` success and non-failure outcomes in `apps/control-plane/src/lib/operator-cli.test.ts`

### Implementation for User Story 2

- [x] T011 [US2] Implement `runs result` in `scripts/operator-cli.mjs`
- [x] T012 [US2] Implement `runs failure` in `scripts/operator-cli.mjs`

**Checkpoint**: Result retrieval and failure-context retrieval are reliable and state-distinguishable.

---

## Phase 5: User Story 3 - Operator Inspects Workflow And Context Facts Needed For Operations (Priority: P2)

**Goal**: Make workflow identity and context facts visible through project and run inspection commands.

**Independent Test**: Inspect a project and a run with lane/workflow/context data and confirm the CLI presents those facts clearly in both human and JSON modes.

### Tests for User Story 3

- [x] T013 [P] [US3] Add tests for workflow/lane/context presentation in `apps/control-plane/src/lib/operator-cli.test.ts`

### Implementation for User Story 3

- [x] T014 [US3] Reconcile `projects inspect` and `runs inspect` output sections in `scripts/operator-cli.mjs` so workflow and context facts are explicit rather than buried

**Checkpoint**: Operators can explain what execution path the system took from the shell output alone.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Refresh docs, validate behavior, and close the feature with evidence.

- [x] T015 [P] Refresh `specs/017-operator-cli-surface/quickstart.md` and contracts after implementation settles
- [x] T016 [P] Update `docs/LOCAL-USAGE.md` with the operator CLI path and examples
- [x] T017 Run `pnpm --filter @mystra/shared build`, `pnpm --filter @mystra/shared test`, `pnpm --filter @mystra/control-plane test`, and `pnpm --filter @mystra/control-plane typecheck`
- [x] T018 Refresh `specs/spec-status.md` and closeout artifacts once the feature is materially advanced

**Checkpoint**: The CLI is documented, tested, and reflected in the project status surfaces.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies, start immediately
- **Foundational (Phase 2)**: Depends on Setup completion, blocks all stories
- **User Story 1 (Phase 3)**: Depends on Foundational
- **User Story 2 (Phase 4)**: Depends on User Story 1 because result/failure commands reuse the run inspection plumbing
- **User Story 3 (Phase 5)**: Depends on User Story 1 and benefits from the final inspect output structure
- **Polish (Phase 6)**: Depends on all desired stories being complete

### Parallel Opportunities

- `T001` and `T002` can run in parallel
- `T005` and `T006` can run in parallel
- `T009` and `T010` can run in parallel
- `T015` and `T016` can run in parallel

---

## Implementation Strategy

### MVP First

1. Freeze CLI contract and tests
2. Build the CLI plumbing
3. Land project/run inspection commands
4. **STOP and VALIDATE**: ensure the shell surface is already useful before adding result/failure specialization
5. Add result/failure retrieval

### Incremental Delivery

1. Inspection commands
2. Result and failure commands
3. Workflow/context presentation polish
4. Docs and validation

## Notes

- This feature is intentionally repo-local. If future work wants packaging, that
  should be a separate spec with explicit distribution decisions.
- The CLI is a consumer of the management API, not a new source of truth.
