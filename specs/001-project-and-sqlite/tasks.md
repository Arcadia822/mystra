# Tasks: Project Abstraction + SQLite Persistence

**Input**: Design documents from `/specs/001-project-and-sqlite/`  
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/)

**Tests**: Required for shared contracts, provider behavior, route boundaries, and runner protocol changes.

**Organization**: Tasks are grouped by user story so core MVP slices can be implemented and validated independently.

## Phase 1: Setup and Dependencies

**Purpose**: Prepare dependencies and keep generated artifacts aligned.

- [x] T001 Add `better-sqlite3` runtime dependency and `@types/better-sqlite3` dev dependency to `apps/control-plane/package.json`.
- [x] T002 Run `pnpm install` to update `pnpm-lock.yaml`.
- [x] T003 [P] Update [specs/001-project-and-sqlite/checklists/requirements.md](./checklists/requirements.md) after final spec validation.

---

## Phase 2: Foundational Contracts (Blocking)

**Purpose**: Shared schema and provider contracts that every user story depends on.

- [x] T004 Update `packages/shared/src/schemas.ts` to add `projectSchema`, `projectCreateSchema`, `projectUpdateSchema`, Project types, and `projectId` on `jobSpecSchema`.
- [x] T005 Update `packages/shared/src/schemas.ts` to remove `projectConfigSchema` and make `repo`, `baseBranch`, and `agent` optional job-level overrides.
- [x] T006 Update `packages/shared/src/schemas.test.ts` for Project create/update validation, job creation with `projectId`, job overrides, and rejection when `projectId` is missing.
- [x] T007 Create `apps/control-plane/src/lib/db/rdb-provider.ts` with domain types and provider methods for Projects, Jobs, Runs, RunnerSessions, RunEvents, and Artifacts.
- [x] T008 Create `apps/control-plane/src/lib/db/migrations.ts` with SQLite DDL for `projects`, `jobs`, `runs`, `runner_sessions`, `run_events`, and `artifacts`.
- [x] T009 Create `apps/control-plane/src/lib/db/sqlite-provider.ts` with WAL setup, migrations, row/domain mapping, JSON serialization helpers, and provider method skeletons.
- [x] T010 Create `apps/control-plane/src/lib/db/index.ts` with `getDb()` singleton using `MYSTRA_DB_PATH`.
- [x] T011 [P] Add local module documentation in `apps/control-plane/src/lib/db/README.md` covering provider purpose, dialect boundary, JSON handling, and test commands.

**Checkpoint**: Foundational provider contract exists; no route migration yet.

---

## Phase 3: User Story 1 - Create Project Configuration (Priority: P1)

**Goal**: Operators can create and query Projects through durable SQLite-backed APIs.

**Independent Test**: Create Project through provider/API, query by slug, close/reopen provider, query again.

### Tests

- [x] T012 [P] [US1] Add provider tests in `apps/control-plane/src/lib/db/sqlite-provider.test.ts` for create/get/list Project and duplicate slug conflict.
- [x] T013 [P] [US1] Add API route tests or focused handler tests for `POST /api/projects`, `GET /api/projects`, and `GET /api/projects/{slug}`.

### Implementation

- [x] T014 [US1] Implement Project create/get/list methods in `apps/control-plane/src/lib/db/sqlite-provider.ts`.
- [x] T015 [US1] Create `apps/control-plane/app/api/projects/route.ts` for `GET` and `POST` using `getDb()`.
- [x] T016 [US1] Create `apps/control-plane/app/api/projects/[slug]/route.ts` with `GET` support.
- [x] T017 [US1] Normalize API errors in project routes with `{ error: { code, message } }`.

**Checkpoint**: Project create/query works independently.

---

## Phase 4: User Story 2 - Submit Job by Project (Priority: P1)

**Goal**: API and MCP callers submit jobs using `projectId`; jobs store resolved snapshots.

**Independent Test**: Create Project, create Job with projectId, inspect snapshot and run.

### Tests

- [x] T018 [P] [US2] Add provider tests for `createJob` resolving Project defaults and allowing explicit overrides in `apps/control-plane/src/lib/db/sqlite-provider.test.ts`.
- [x] T019 [P] [US2] Add provider tests for missing Project and archived Project rejection in `apps/control-plane/src/lib/db/sqlite-provider.test.ts`.
- [x] T020 [P] [US2] Update API/MCP route tests for missing `projectId` rejection and valid project-based job creation.

### Implementation

- [x] T021 [US2] Implement `createJob`, `getJob`, `listJobs`, and `cancelJob` in `apps/control-plane/src/lib/db/sqlite-provider.ts`.
- [x] T022 [US2] Update `apps/control-plane/app/api/jobs/route.ts` to use `getDb().createJob()` and `getDb().listJobs()`.
- [x] T023 [US2] Update `apps/control-plane/app/api/jobs/[id]/route.ts` to use `getDb().getJob()`.
- [x] T024 [US2] Update `apps/control-plane/app/api/jobs/[id]/cancel/route.ts` to use `getDb().cancelJob()`.
- [x] T025 [US2] Update `apps/control-plane/app/api/mcp/route.ts` so `mystra_create_job` requires `projectId`.
- [x] T026 [US2] Add MCP tools `mystra_create_project`, `mystra_list_projects`, and `mystra_get_project` in `apps/control-plane/app/api/mcp/route.ts`.
- [x] T027 [US2] Update `apps/control-plane/app/page.tsx` to use a Project dropdown and remove primary repo/baseBranch/agent inputs.

**Checkpoint**: Project-based job creation works through API and MCP.

---

## Phase 5: User Story 4 - Persist Runtime State Across Restart (Priority: P1)

**Goal**: Jobs, runs, runner sessions, events, results, and artifacts survive control-plane restart.

**Independent Test**: Create records, close/reopen provider, query same snapshots.

### Tests

- [x] T028 [P] [US4] Add provider tests for runner registration, heartbeat, claim, event append, completion, cancellation, and reopen persistence.
- [x] T029 [P] [US4] Add corrupt JSON tests for Project metadata/prewarmConfig, run result, runner capabilities, and run event data.

### Implementation

- [x] T030 [US4] Implement runner session methods in `apps/control-plane/src/lib/db/sqlite-provider.ts`.
- [x] T031 [US4] Implement claim, event append, completion, and cancellation state updates in `apps/control-plane/src/lib/db/sqlite-provider.ts`.
- [x] T032 [US4] Update `apps/control-plane/app/api/runner/register/route.ts` to use `getDb().registerRunner()`.
- [x] T033 [US4] Update `apps/control-plane/app/api/runner/heartbeat/route.ts` to use `getDb().authenticateRunner()` and `getDb().heartbeatRunner()`.
- [x] T034 [US4] Update `apps/control-plane/app/api/runner/jobs/[id]/events/route.ts` to use `getDb().appendRunEvent()`.
- [x] T035 [US4] Update `apps/control-plane/app/api/runner/jobs/[id]/result/route.ts` to use `getDb().completeRun()`.
- [x] T036 [US4] Update `apps/control-plane/app/api/runners/route.ts` to use `getDb().listRunners()`.

**Checkpoint**: local-store is no longer needed for runtime state.

---

## Phase 6: User Story 5 - Runner Uses Project Image (Priority: P1)

**Goal**: Runner claims include Project image and daemon uses it for Docker execution.

**Independent Test**: Create Project with image, create job, claim run, verify claim project payload and runner Docker image selection.

### Tests

- [x] T037 [P] [US5] Add control-plane claim test verifying `project: { id, slug, image, prewarmConfig }`.
- [x] T038 [P] [US5] Add runner-daemon test in `apps/runner-daemon/src/container-task.test.ts` or a new focused test verifying claimed Project image is used.

### Implementation

- [x] T039 [US5] Update `apps/control-plane/app/api/runner/jobs/route.ts` to return Project data from `getDb().claimNextRun()`.
- [x] T040 [US5] Update `apps/runner-daemon/src/index.ts` `ClaimedJobResponse` type to include Project data.
- [x] T041 [US5] Remove normal `MYSTRA_RUNNER_IMAGE` runtime image selection from `apps/runner-daemon/src/index.ts`.
- [x] T042 [US5] Update Docker execution path in `apps/runner-daemon/src/index.ts` to use `claimedJob.project.image`.
- [x] T043 [US5] Update `scripts/deploy-dev-machine.sh` to stop writing `MYSTRA_RUNNER_IMAGE`.
- [x] T044 [US5] Update `scripts/doctor-local.sh` to make runner image checks project-aware or remove global image check.

**Checkpoint**: runner uses Project image; global runner image is no longer the job runtime contract.

---

## Phase 7: User Story 3 - Archive Project (Priority: P2)

**Goal**: Operators can archive and restore Projects without losing historical jobs.

**Independent Test**: Archive Project, reject new jobs, query old jobs, restore Project.

### Tests

- [x] T045 [P] [US3] Add provider tests for archive, unarchive, and archived-project job rejection.
- [x] T046 [P] [US3] Add API tests for `DELETE /api/projects/{slug}` and `PATCH /api/projects/{slug}`.

### Implementation

- [x] T047 [US3] Implement Project update/archive methods in `apps/control-plane/src/lib/db/sqlite-provider.ts`.
- [x] T048 [US3] Add `PATCH` and `DELETE` handlers in `apps/control-plane/app/api/projects/[slug]/route.ts`.
- [x] T049 [US3] Ensure `createJob` rejects archived Project with `400 PROJECT_ARCHIVED`.

**Checkpoint**: Project lifecycle works without physical delete.

---

## Phase 8: User Story 6 - Preserve Prewarm as Provider Capability (Priority: P3)

**Goal**: Store and expose prewarm config while keeping automatic prewarm out of bare Docker lifecycle.

**Independent Test**: Store Project prewarmConfig, see it in Project query and runner claim; no automatic lifecycle prewarm occurs.

### Tests

- [x] T050 [P] [US6] Add provider/API tests verifying `prewarmConfig` round-trips as JSON.
- [x] T051 [P] [US6] Add script smoke test or dry-run path for `prewarm-project.sh --project <slug>` if script test harness exists.

### Implementation

- [x] T052 [US6] Rename `scripts/prewarm-castrel-ai.sh` to `scripts/prewarm-project.sh`.
- [x] T053 [US6] Update `scripts/prewarm-project.sh` to resolve Project by slug instead of using Castrel-specific paths.
- [x] T054 [US6] Document in `scripts/README.md` or nearby script comments that automatic prewarm is a future sandbox provider capability.

**Checkpoint**: prewarm config is durable and visible but not coupled to bare Docker.

---

## Phase 9: Script, Baseline Template, and Documentation Cleanup

**Purpose**: Remove Castrel-specific primary paths and keep AI-built docs aligned.

- [x] T055 Rename `scripts/castrel-job.mjs` to `scripts/submit-job.mjs`.
- [x] T056 Update `scripts/submit-job.mjs` to require `--project <slug>`, fetch `/api/projects/{slug}`, and submit `projectId`.
- [x] T057 Update root `package.json` from `job:castrel` to `job:submit`.
- [x] T058 Move Castrel-oriented runner image context outside git.
- [x] T059 Update `docs/RUNNER-DOCKER-MVP.md` references from global runner image to Project runtime image.
- [x] T060 Update `docs/LOCAL-USAGE.md`, `docs/ARCHITECTURE.md`, and `README.md` for Project CRUD, SQLite provider, and `pnpm job:submit`.
- [x] T061 Delete `apps/control-plane/src/lib/local-store.ts` after all imports are gone.
- [x] T062 Run `rg "local-store|castrel-job|MYSTRA_RUNNER_IMAGE" apps packages scripts docs README.md` and resolve remaining stale primary-path references.

---

## Phase 10: Final Verification

- [x] T063 Run `pnpm --filter @mystra/shared test`.
- [x] T064 Run `pnpm --filter @mystra/control-plane test`.
- [x] T065 Run `pnpm --filter @mystra/control-plane typecheck`.
- [x] T066 Run `pnpm --filter @mystra/runner-daemon typecheck`.
- [x] T067 Run `pnpm job:submit --project <slug> ...` against a local control plane and record result in [quickstart.md](./quickstart.md) or final notes.
- [x] T068 Run broad `pnpm typecheck && pnpm test` if local runtime and native dependencies allow.

---

## Dependencies & Execution Order

### Phase Dependencies

- Phase 1 has no dependencies.
- Phase 2 blocks every user story.
- Phases 3 and 4 both depend on Phase 2; Phase 4 needs basic Project create/query from Phase 3 for end-to-end checks.
- Phase 5 depends on Phase 4.
- Phase 6 depends on Phase 5 because claim response comes from provider state.
- Phase 7 depends on Phase 3 and affects Phase 4 validation.
- Phase 8 depends on Phase 3 and Phase 6 for claim visibility.
- Phase 9 depends on Phases 3-8.
- Phase 10 depends on all desired implementation phases.

### User Story Dependencies

- **US1 Create Project Configuration**: First independently valuable slice.
- **US2 Submit Job by Project**: Depends on US1 and foundational provider methods.
- **US4 Persist Runtime State**: Uses provider foundation and completes local-store replacement.
- **US5 Runner Uses Project Image**: Depends on claim path from US4.
- **US3 Archive Project**: Can follow US1/US2; must be done before release.
- **US6 Prewarm Config**: Lowest priority; stores config and updates manual script.

### Parallel Opportunities

- T012/T013 can run in parallel.
- T018/T019/T020 can run in parallel.
- T028/T029 can run in parallel.
- T037/T038 can run in parallel.
- T045/T046 can run in parallel.
- Documentation cleanup tasks can run after contracts stabilize.

## Implementation Strategy

1. Complete Phase 1 and Phase 2.
2. Ship US1 + US2 as the first working slice: Project CRUD and project-based job creation.
3. Replace runtime state with SQLite provider and remove local-store.
4. Update runner claim/image path.
5. Add archive, prewarm config, scripts, and docs.
6. Run final verification before implementation is declared complete.
