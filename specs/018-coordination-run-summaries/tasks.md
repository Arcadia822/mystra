# Tasks: Coordination Run Summaries

**Input**: Design documents from `/specs/018-coordination-run-summaries/`  
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: This feature requires focused tests because it introduces a new shared contract plus API, MCP, and CLI read surfaces.

**Organization**: Tasks are grouped by user story so each story remains independently implementable and testable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (`US1`, `US2`, `US3`)
- Include exact file paths in descriptions

---

## Phase 1: Foundation (Blocking Prerequisites)

**Purpose**: Create the shared contract and the lightweight summary read path that all stories depend on.

- [ ] T001 [US1] Add `CoordinationRunSummary` schemas and exports in `packages/shared/src/coordination-run-summary.ts` and `packages/shared/src/index.ts`, including `phase`, `milestone`, `links`, `attempt`, and aligned top-level payload wrappers.
- [ ] T002 [P] [US1] Add schema tests for queued, assigned, running, review-ready, terminal, and invalid combinations in `packages/shared/src/coordination-run-summary.test.ts`.
- [ ] T003 [US1] Implement the lightweight summary query and result shape in `apps/control-plane/src/lib/db/sqlite-provider.ts`, with explicit latest-attempt semantics and only the fields needed for compact polling.
- [ ] T004 [US1] Implement pure summary projection logic in `apps/control-plane/src/lib/coordination-run-summary.ts`, including durable phase mapping, milestone selection, link precedence, and fallback behavior for missing events.
- [ ] T005 [US1] Cover summary query/projection behavior in `apps/control-plane/src/lib/db/sqlite-provider.test.ts`, including review-ready, timed-out, canceled, stale-marked, and malformed/missing-event fallback paths.

**Checkpoint**: Shared contract and lightweight summary derivation exist, and the control plane can derive compact summaries without assembling full raw snapshots.

---

## Phase 2: User Story 1 - Coordinating Agent Polls Compact Run State (Priority: P1) 🎯 MVP

**Goal**: Let a coordinating agent poll compact run state over HTTP API and MCP without parsing the full job snapshot.

**Independent Test**: Create a queued or running job, query the new HTTP summary route and MCP summary tool, and verify both return the same compact payload shape with `runState`, `phase`, `milestone`, and timestamps, without the full event list.

### Tests for User Story 1

- [ ] T006 [P] [US1] Add HTTP summary route tests to `apps/control-plane/app/api/routes.test.ts` for queued/running payloads, structured `job_not_found`, and the guarantee that `events` and workflow node histories are not exposed.
- [ ] T007 [P] [US1] Add MCP summary tool tests to `apps/control-plane/app/api/routes.test.ts` for payload parity with HTTP and aligned not-found behavior.

### Implementation for User Story 1

- [ ] T008 [US1] Add `GET /api/jobs/[id]/summary` in `apps/control-plane/app/api/jobs/[id]/summary/route.ts`, using the lightweight summary query plus the shared payload wrapper.
- [ ] T009 [US1] Add `mystra_get_job_summary` to `apps/control-plane/app/api/mcp/route.ts`, validating input and returning the same wrapped payload shape as HTTP.
- [ ] T010 [US1] Keep raw diagnostic routes/tools unchanged by wiring any shared helpers without altering `apps/control-plane/app/api/jobs/[id]/route.ts` semantics.

**Checkpoint**: HTTP and MCP both expose the compact polling surface, and raw diagnostic surfaces still behave as before.

---

## Phase 3: User Story 2 - Coordinating Agent Receives Terminal Outcome And Links (Priority: P1)

**Goal**: Return terminal result, branch/reference, and review links in the compact summary without leaking fake placeholders or freezing legacy-only fields.

**Independent Test**: Complete runs with and without review artifacts, then query the compact summary and verify terminal status, summary text, `attempt`, and link precedence are all correct.

### Tests for User Story 2

- [ ] T011 [P] [US2] Extend `apps/control-plane/src/lib/db/sqlite-provider.test.ts` with terminal summary cases for succeeded, failed, canceled, timed_out, and stale-marked runs, including latest-attempt semantics.
- [ ] T012 [P] [US2] Extend `apps/control-plane/app/api/routes.test.ts` with terminal HTTP/MCP parity cases covering normalized review links, legacy fallback links, and missing-link omission.
- [ ] T013 [P] [US2] Add regression coverage in `apps/control-plane/app/api/routes.test.ts` proving `GET /api/jobs/[id]` and `mystra_get_job` still return the full raw snapshot after compact-summary work lands.

### Implementation for User Story 2

- [ ] T014 [US2] Finalize terminal and link projection rules in `apps/control-plane/src/lib/coordination-run-summary.ts`, preferring `reviewResult.review.{url,displayId}` and falling back to legacy result fields only when needed.
- [ ] T015 [US2] Ensure the lightweight summary query in `apps/control-plane/src/lib/db/sqlite-provider.ts` returns enough data for latest-attempt summaries and latest relevant lifecycle milestones without requiring full snapshot assembly.

**Checkpoint**: Terminal compact summaries are truthful, latest-attempt aware, and regression coverage protects the raw diagnostic contract.

---

## Phase 4: User Story 3 - Operator Or Agent Checks The Same Summary From CLI (Priority: P2)

**Goal**: Expose the same compact summary contract in a CLI status command, and reuse the same polling helper from `submit-job.mjs`.

**Independent Test**: Run `pnpm job:status -- --job-id <id>` and `pnpm job:status -- --job-id <id> --wait` against active and terminal jobs, verifying wrapped JSON output, exit codes, and timeout/not-found behavior.

### Tests for User Story 3

- [ ] T016 [P] [US3] Add script-level smoke coverage for one-shot JSON, wait success, wait failure-like exit, timeout exit `124`, and not-found exit `3` for the new CLI helper and command.

### Implementation for User Story 3

- [ ] T017 [US3] Add shared CLI summary helper in `scripts/lib/job-summary.mjs` for summary fetch, wait polling, wrapped JSON output, and exit-code handling.
- [ ] T018 [US3] Add `scripts/job-status.mjs` implementing `pnpm job:status -- --job-id <id> [--wait]`.
- [ ] T019 [US3] Update `scripts/submit-job.mjs` to reuse `scripts/lib/job-summary.mjs` for wait-mode polling and final summary output instead of its inline summarizer.
- [ ] T020 [US3] Add the root `package.json` script entry for `job:status`.

**Checkpoint**: CLI consumers use the same compact summary contract and wait semantics as the API/MCP surfaces.

---

## Phase 5: Polish & Cross-Cutting Validation

**Purpose**: Close out docs, commands, and broad verification for the completed feature slice.

- [ ] T021 [US1] Update `specs/018-coordination-run-summaries/quickstart.md` if implementation file names or commands differ from the current plan assumptions.
- [ ] T022 [US1] Run feature-focused verification: `pnpm --filter @mystra/shared test`, `pnpm --filter @mystra/control-plane test`, `pnpm --filter @mystra/shared typecheck`, `pnpm --filter @mystra/control-plane typecheck`.
- [ ] T023 [US3] Run CLI and repo-wide verification: `pnpm test`, `pnpm typecheck`, `pnpm build`, and a manual `pnpm job:status -- --job-id <id>` smoke check against a local control plane.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundation (Phase 1)**: No dependencies, but blocks all user stories.
- **User Story 1 (Phase 2)**: Depends on Foundation.
- **User Story 2 (Phase 3)**: Depends on User Story 1's query/projection path being in place.
- **User Story 3 (Phase 4)**: Depends on the shared summary contract and the HTTP summary route shape.
- **Polish (Phase 5)**: Depends on all implemented user stories.

### User Story Dependencies

- **US1**: First deliverable and MVP surface.
- **US2**: Extends US1 with terminal truth, link precedence, and regression protection.
- **US3**: Reuses US1/US2 contract shape for CLI parity.

### Within Each User Story

- Tests should be written before or alongside implementation and must fail before the implementation is considered complete.
- Shared contract before query logic.
- Query logic before route/tool wiring.
- Shared CLI helper before CLI entrypoints.
- Regression coverage before broad verification.

### Parallel Opportunities

- T002 can run in parallel with T003 once the intended schema file path is fixed.
- T006 and T007 can run in parallel.
- T011, T012, and T013 can run in parallel.
- T017 and T018 can run in parallel after the route shape is frozen.

---

## Implementation Strategy

### MVP First

1. Complete Phase 1.
2. Complete Phase 2.
3. Validate HTTP + MCP compact polling independently.

### Incremental Delivery

1. Land Foundation + US1 for compact polling.
2. Add US2 for truthful terminal summaries and regression protection.
3. Add US3 for CLI parity.
4. Finish with Phase 5 verification and quickstart alignment.

### Parallel Worktree Strategy

1. Main lane: T001 → T005 → T008 → T009 → T014 → T015
2. Parallel lane after T001: T017 → T018 → T019 → T020
3. Test lane after relevant code lands: T006/T007, then T011/T012/T013, then T016

---

## Notes

- Keep raw diagnostic surfaces untouched except for safe helper reuse.
- Do not invent new phase labels during implementation; use the plan's durable mapping only.
- `attempt` and link precedence are part of the contract, not optional polish.
- If the lightweight query needs an index after inspection or tests, add it in the same feature rather than punting silent performance debt.
