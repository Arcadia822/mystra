# Tasks: Issue 驱动的 Agent 自主执行

**Input**: Design documents from `/specs/033-issue-agent-execution/`
**Prerequisites**: `spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`

**Tests**: TDD is mandatory for contract, state, runner and CLI changes. Each test task
must fail for the intended reason before its paired implementation task starts.

**Execution mode**: Sequential in one worktree. `[P]` only marks work that is
file-independent after its listed prerequisites are complete.

## Phase 1: Setup and Safety Baseline

**Purpose**: Make the work reproducible and preserve pre-change evidence before editing
the high-risk runner/state symbols.

- [x] T001 Record GitNexus context, `executeDockerJob` impact, shared state import inventory, exact workflow reference inventory and current gate baseline in `specs/033-issue-agent-execution/evidence/pre-change-baseline.md`
- [x] T002 [P] Add the generic pinned Copilot runner image and build instructions in `runner-images/copilot/Dockerfile` and `runner-images/copilot/README.md`
- [x] T003 Replace Castrel-oriented local image defaults and add `runner:image:build` plus `operator:cli` scripts in `scripts/build-runner-image.sh` and `package.json`
- [x] T004 Verify `docker build` produces `mystra-copilot-runner:1.0.69-0` and that `copilot --version` matches in `specs/033-issue-agent-execution/evidence/image-build.md`

**Checkpoint**: Reproducible generic sandbox image exists; no secret was supplied to
the build.

---

## Phase 2: Foundational Shared Contracts and Clean Persistence

**Purpose**: Establish the new Issue/state/result truth and remove the need for legacy
data compatibility before any route or runner implementation.

- [x] T005 [P] Write failing Issue, Integration, pagination, dispatch and external-response schema tests in `packages/shared/src/issue.test.ts`
- [x] T006 Implement Issue, Integration, pagination, dispatch and stable integration error schemas in `packages/shared/src/issue.ts` and export them from `packages/shared/src/index.ts`
- [x] T007 [P] Write failing `waiting_for_review`, execution-event, QualityResult, AgentExecutionMetadata and ReviewHandoff tests in `packages/shared/src/state.test.ts`, `packages/shared/src/events.test.ts`, and `packages/shared/src/result.test.ts`
- [x] T008 Replace `needs_human_review` and workflow events with direct execution states/events/results in `packages/shared/src/state.ts`, `packages/shared/src/events.ts`, and `packages/shared/src/result.ts`
- [x] T009 Write failing JobSpec, execution-spec v2 and canonical snapshot tests for immutable IssueSnapshot and absence of workflow projection in `packages/shared/src/schemas.test.ts` and `packages/shared/src/management.test.ts`
- [x] T010 Extend JobSpec/execution-spec/management schemas with IssueSnapshot, dispatchKey and direct execution fields; remove workflow exports and hints in `packages/shared/src/schemas.ts`, `packages/shared/src/management.ts`, and `packages/shared/src/index.ts`
- [x] T011 Write failing clean-schema persistence tests for `issue_snapshot`, unique `dispatch_key`, no workflow snapshot and `waiting_for_review` capacity release in `apps/control-plane/src/lib/db/sqlite-provider.test.ts`
- [x] T012 Replace legacy-compatible SQLite Job/Run/event schema and projections with clean Issue/direct-execution persistence in `apps/control-plane/src/lib/db/migrations.ts`, `apps/control-plane/src/lib/db/rdb-provider.ts`, and `apps/control-plane/src/lib/db/sqlite-provider.ts`
- [x] T013 Run shared and SQLite focused tests and record the clean disposable DB path contract in `specs/033-issue-agent-execution/evidence/foundation-tests.md`

**Checkpoint**: A newly initialized database understands only the new active contracts;
old workflow history is neither migrated nor readable.

---

## Phase 3: User Story 1 - 从 Linear Issue 发起本机开发任务 (Priority: P1)

**Goal**: API and CLI can read a real Linear Issue and atomically freeze it into one
queued Job/Run.

**Independent Test**: With a fake fetch and disposable SQLite database, list/get and
dispatch work; every Linear failure mode produces a stable error and zero partial Job.

### Tests for User Story 1

- [x] T014 [P] [US1] Write failing Linear provider tests for list/get, cursor, identifier lookup, missing key, 401/403, 429, timeout, 5xx, GraphQL errors/partial data and malformed payloads in `apps/control-plane/src/lib/integrations/linear.test.ts`
- [x] T015 [P] [US1] Write failing integration registry tests for missing integration and missing Issue capability in `apps/control-plane/src/lib/integrations/registry.test.ts`
- [x] T016 [US1] Write failing route contract tests for Issue list/get success and structured errors in `apps/control-plane/app/api/routes.test.ts`
- [x] T017 [US1] Write failing dispatch tests for exact refetch, immutable snapshot, invalid Project/Agent/runtime/repository, atomic failure and duplicate 409 in `apps/control-plane/app/api/routes.test.ts`

### Implementation for User Story 1

- [x] T018 [US1] Implement `IssueProvider`, `Integration`, registry and stable IntegrationError mapping in `apps/control-plane/src/lib/integrations/types.ts`, `apps/control-plane/src/lib/integrations/registry.ts`, and `apps/control-plane/src/lib/integrations/errors.ts`
- [x] T019 [US1] Implement read-only Linear GraphQL list/get with timeout, GraphQL error detection, pagination and Zod normalization in `apps/control-plane/src/lib/integrations/linear.ts`
- [x] T020 [US1] Implement canonical Issue list and get Route Handlers in `apps/control-plane/app/api/integrations/[integration]/issues/route.ts` and `apps/control-plane/app/api/integrations/[integration]/issues/[identifier]/route.ts`
- [x] T021 [US1] Implement dispatch-time refetch, validation, stable dispatchKey, prompt/review defaults and atomic Job creation in `apps/control-plane/src/lib/integrations/dispatch.ts` and `apps/control-plane/app/api/integrations/[integration]/issues/[identifier]/dispatch/route.ts`
- [x] T022 [US1] Write failing CLI tests for Issue list/get/dispatch, project slug resolution, structured server errors and transport failure in `apps/control-plane/src/lib/operator-cli.test.ts`
- [x] T023 [US1] Implement Issue list/get/dispatch argument parsing, HTTP requests and JSON/text formatting without importing domain implementations in `scripts/operator-cli.mjs`
- [x] T024 [US1] Run focused shared/control-plane/CLI tests and perform one redacted live Linear list/get check through API and CLI in `specs/033-issue-agent-execution/evidence/linear-intake.md`

**Checkpoint**: User Story 1 independently creates a queued, traceable Issue-driven
Job without contacting Docker or GitHub.

---

## Phase 4: User Story 4 - API 与 CLI 共享同一产品真相 (Priority: P1)

**Goal**: One operator CLI exposes Run inspect/wait, in addition to the Issue commands
proved by US1, solely through the canonical API.

**Independent Test**: Injected fetch tests prove each Run command URL, error/exit code,
polling behavior and absence of direct Linear/SQLite imports.

### Tests for User Story 4

- [x] T025 [US4] Extend failing CLI tests for Run inspect, Run wait success, local timeout, server error and transport failure in `apps/control-plane/src/lib/operator-cli.test.ts`
- [x] T026 [US4] Add a regression assertion that `waiting_for_review` is terminal success rather than failure in `apps/control-plane/src/lib/operator-cli.test.ts`

### Implementation for User Story 4

- [x] T027 [US4] Extend CLI argument parsing, polling and canonical Run response validation without importing domain implementations in `scripts/operator-cli.mjs`
- [x] T028 [US4] Update operator command documentation and five-command acceptance path in `scripts/README.md` and `specs/033-issue-agent-execution/quickstart.md`
- [x] T029 [US4] Run CLI contract tests against fake Issue and Run API responses in `specs/033-issue-agent-execution/evidence/cli-contract.md`

**Checkpoint**: User Story 4 proves every CLI command is an HTTP-only view of the
canonical API before the real E2E relies on it.

---

## Phase 5: User Story 2 - Agent 在 Sandbox 内自主完成任务 (Priority: P1)

**Goal**: Runner executes one explicit sandbox/Agent lifecycle with bounded Copilot
autopilot and no workflow package, graph, blueprint or node.

**Independent Test**: Fake providers prove ordered direct phases, cancel/timeout/cleanup,
secret isolation and each failure path; exact source search finds no active workflow
abstraction.

### Tests for User Story 2

- [x] T030 [P] [US2] Write failing Copilot command tests for `--autopilot`, cap 10, no deprecated config flag, prompt attachment and version metadata in `packages/agent-adapters/src/index.test.ts`
- [x] T031 [P] [US2] Write failing direct execution tests for phase order, event order, no changes, Agent nonzero, test failure and build failure in `apps/runner-daemon/src/direct-execution.test.ts`
- [x] T032 [P] [US2] Write failing container task tests for separate test/build outputs, generic preview scripts and removal of compat/workflow wording in `apps/runner-daemon/src/container-task.test.ts`
- [x] T033 [P] [US2] Write failing secret-isolation tests proving GitHub token only reaches clone and Copilot token only reaches Agent exec, never the base container or quality/preview execs, in `apps/runner-daemon/src/direct-execution.test.ts`
- [x] T034 [US2] Write regression tests for cancel, timeout, cleanup failure, stale runner and active-capacity accounting across runner source/sandbox tests and `apps/control-plane/src/lib/db/sqlite-provider.test.ts`

### Implementation for User Story 2

- [x] T035 [US2] Update CopilotAdapter and runner adapter defaults for bounded autopilot and version reporting in `packages/agent-adapters/src/index.ts` and `apps/runner-daemon/src/agent-adapters.ts`
- [x] T036 [US2] Implement the fixed, testable clone→Agent→test→build phase service with maintained ASCII pipeline diagram in `apps/runner-daemon/src/direct-execution.ts`
- [x] T037 [US2] Refactor container task commands and outputs from workflow/node terms to generic execution phases; remove Castrel preview mutation and compat main in `apps/runner-daemon/assets/container-task.sh`
- [x] T038 [US2] Implement a secret-free base container and phase-scoped `docker exec -e` environments in `apps/runner-daemon/src/direct-execution.ts` and `apps/runner-daemon/src/index.ts`
- [x] T039 [US2] Make the git mirror an authenticated optional cache with cold authenticated clone fallback and no persisted credential URL in `apps/runner-daemon/assets/container-task.sh` and `apps/runner-daemon/src/repo-providers/github.ts`
- [x] T040 [US2] Remove workflow config/registry initialization and call direct execution from the daemon entrypoint in `apps/runner-daemon/src/index.ts`
- [x] T041 [US2] Delete the active workflow package, runner workflow registry and shared workflow schema files in `apps/workflows/package.json`, `apps/workflows/src/index.ts`, `apps/workflows/src/index.test.ts`, `apps/workflows/tsconfig.json`, `apps/runner-daemon/src/workflow-providers.ts`, `apps/runner-daemon/src/workflow-providers.test.ts`, `packages/shared/src/workflow.ts`, and `packages/shared/src/workflow.test.ts`
- [x] T042 [US2] Remove `@mystra/workflows` dependencies and regenerate the workspace lockfile in `apps/runner-daemon/package.json` and `pnpm-lock.yaml`
- [x] T043 [US2] Remove workflow projection helpers and active UI/CLI labels in `apps/runner-daemon/src/review-projections.ts`, `apps/runner-daemon/src/review-projections.test.ts`, and `apps/control-plane/app/page.tsx`
- [x] T044 [US2] Run agent-adapter/runner/control-plane regression suites and exact workflow-abstraction search in `specs/033-issue-agent-execution/evidence/direct-execution-tests.md`

**Checkpoint**: User Story 2 independently runs the Agent lifecycle with fake external
providers, and the active package/runtime/shared graph contains no workflow abstraction.

---

## Phase 6: User Story 3 - 交付可接手的 Review 现场 (Priority: P1)

**Goal**: Passed code produces a host-reachable retained preview, unique GitHub PR and
`waiting_for_review` handoff with released runner capacity.

**Independent Test**: Fake GitHub and Docker integration tests cover success/reuse and
every failure; then a private demo repository completes the real path.

### Tests for User Story 3

- [x] T045 [P] [US3] Write failing GitHub provider tests for open-PR lookup/reuse, create success, 403/422/5xx and redacted errors in `apps/runner-daemon/src/repo-providers/github.test.ts`
- [x] T046 [P] [US3] Write failing host preview tests for two successful 2xx probes, timeout/non-success and retained container metadata in `apps/runner-daemon/src/preview-probe.test.ts` and runner sandbox tests
- [x] T047 [US3] Write failing end-state tests proving review success maps to `waiting_for_review`, info severity, finishedAt, capacity zero, no failure reason and retained sandbox in `apps/control-plane/src/lib/db/sqlite-provider.test.ts`

### Implementation for User Story 3

- [x] T048 [US3] Implement GitHub open-PR lookup/reuse and safe error mapping in `apps/runner-daemon/src/repo-providers/github.ts`
- [x] T049 [US3] Implement two bounded host preview probes and fail-closed review handoff in `apps/runner-daemon/src/preview-probe.ts` and `apps/runner-daemon/src/index.ts`
- [x] T050 [US3] Complete direct execution with structured quality, preview, Agent, sandbox and PR metadata as `waiting_for_review` in `apps/runner-daemon/src/direct-execution.ts`, `apps/runner-daemon/src/index.ts`, and `apps/control-plane/src/lib/db/sqlite-provider.ts`
- [x] T051 [US3] Create or reuse a private `Arcadia822` demo web repository and record only its non-secret bootstrap facts in `specs/033-issue-agent-execution/evidence/demo-repository.md`
- [x] T052 [US3] Start Docker/control-plane/runner with the disposable exact DB path, dispatch one real Linear Issue through CLI, and preserve the redacted full E2E in `specs/033-issue-agent-execution/evidence/e2e-real-run.md`
- [x] T053 [US3] Verify API/CLI parity, two host preview probes, open PR, retained container, Copilot version/cap, final state and zero active capacity in `specs/033-issue-agent-execution/evidence/e2e-real-run.md` and `specs/033-issue-agent-execution/evidence/api-cli-parity.md`

**Checkpoint**: User Story 3 delivers a real, human-reviewable private GitHub artifact.

---

## Phase 7: Documentation, Full Verification and Closeout

**Purpose**: Reconcile durable context, prove the repository is clean and leave
reviewable evidence.

- [x] T054 [P] Reconcile product/runtime/module docs with Issue-driven direct execution in `README.md`, `docs/SPEC.md`, `docs/ARCHITECTURE.md`, `docs/IMPLEMENTATION-PLAN.md`, `apps/control-plane/src/lib/db/README.md`, and `scripts/README.md`
- [x] T055 [P] Add the smallest useful integration and direct-runner module invariants in `apps/control-plane/src/lib/integrations/README.md` and `apps/runner-daemon/README.md`
- [x] T056 Run exact active-code/package/config search for `WorkflowProvider`, `LocalWorkflowProvider`, workflow blueprint/node/registry and `apps/workflows`; record zero-result evidence in `specs/033-issue-agent-execution/evidence/final-audit.md`
- [x] T057 Run focused tests, `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build`; record commands and results in `specs/033-issue-agent-execution/evidence/final-audit.md`
- [x] T058 Run a secret-pattern and credential-bearing-URL scan across git diff, specs evidence and demo checkout; record only pass/fail summaries in `specs/033-issue-agent-execution/evidence/final-audit.md`
- [x] T059 Refresh GitNexus index, run `gitnexus_detect_changes()`, inspect all affected processes and resolve any unexpected HIGH/CRITICAL blast radius in `specs/033-issue-agent-execution/evidence/final-audit.md`
- [x] T060 Run `code-review-and-quality`, resolve all P0/P1 findings, rerun affected tests and record the review verdict in `specs/033-issue-agent-execution/evidence/final-audit.md`
- [x] T061 Refresh Spec-Kit status and mark every completed task/evidence link accurately in `specs/033-issue-agent-execution/tasks.md` and `specs/spec-status.md`

---

## Dependencies and Execution Order

```text
Phase 1 image/safety
    ↓
Phase 2 shared contracts + clean persistence
    ↓
US1 Linear intake + dispatch
    ↓
US4 CLI Run inspect/wait
    ↓
US2 direct sandbox/Agent lifecycle + workflow removal
    ↓
US3 preview/GitHub/waiting review + real E2E
    ↓
full audit and review
```

- US1 depends on Phase 2 Issue/Job contracts.
- US4 depends on US1 Issue commands and canonical Job/Run response contracts.
- US2 depends on Phase 2 state/event/result contracts.
- US3 depends on US2 direct execution, US1 Issue snapshot and US4 CLI wait.
- The E2E must not begin until focused fake-provider tests pass.

## Parallel Opportunities

- T002 can proceed independently of T001.
- T005/T007 and T014/T015 are file-independent after their phase prerequisites.
- T030/T031/T032/T033 may be authored in parallel, but implementation remains sequential.
- T045/T046 may be authored in parallel.
- T054/T055 may proceed in parallel only after behavior is stable.

No parallel agents are used for this run; these markers document dependency structure.

## Verification Checkpoints

- **Foundation**: shared + SQLite focused tests pass on a new disposable DB.
- **US1**: fake provider tests pass and live Linear API/CLI read succeeds without data mutation.
- **US4**: CLI Issue and Run commands pass HTTP-only contract tests.
- **US2**: direct execution regression suite passes and workflow abstraction search is zero.
- **US3**: API/CLI parity matches; real preview and PR exist; final state/capacity are correct.
- **Closeout**: full gates, GitNexus and code review pass with redacted evidence.

## Notes

- Delete only an exact, verified disposable SQLite file. Never recursively delete a
  workspace/data directory.
- Do not commit or print Linear/GitHub/Copilot secret values.
- Before editing each existing function/class/method, run GitNexus upstream impact and
  warn on HIGH/CRITICAL.
- Run GitNexus detect changes before any commit.
