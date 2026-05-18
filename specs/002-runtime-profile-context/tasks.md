# Tasks: Runtime Config Resolution and Context Bundles

**Input**: Design documents from `/specs/002-runtime-profile-context/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Contract and focused unit tests are required because this feature changes shared schemas, persistence, runner protocol, and Docker execution behavior.

**Organization**: Tasks are grouped by technical scenario. `[TS#]` maps to the numbered Technical Scenarios in [spec.md](./spec.md). Some API/MCP boundary tasks sit beside the Project/task route files they change, but are labeled `[TS3]` because boundary design is now the highest-priority scenario.

## Format: `[ID] [P?] [Scenario] Description`

- **[P]**: Can run in parallel after its dependencies are satisfied
- **[TS#]**: Technical scenario label
- All implementation tasks include exact file paths
- Before editing code symbols, run GitNexus impact analysis for the target symbols per `AGENTS.md`

## Phase 1: Setup (Shared Planning And Safety)

**Purpose**: Prepare the branch for contract work and protect existing behavior.

- [x] T001 Run `npx gitnexus analyze` in `/Users/arcadia/Documents/mystra` to refresh the code intelligence index before code edits
- [x] T002 [P] Review existing image/runtime references in `/Users/arcadia/Documents/mystra/packages/shared/src/schemas.ts`, `/Users/arcadia/Documents/mystra/apps/control-plane/src/lib/db/rdb-provider.ts`, `/Users/arcadia/Documents/mystra/apps/control-plane/src/lib/db/migrations.ts`, and `/Users/arcadia/Documents/mystra/apps/runner-daemon/src/index.ts`
- [x] T003 [P] Confirm current focused verification commands from `/Users/arcadia/Documents/mystra/PLATFORM.md` and `/Users/arcadia/Documents/mystra/package.json`
- [x] T004 Create a runtime contract checklist in `/Users/arcadia/Documents/mystra/specs/002-runtime-profile-context/checklists/runtime-contract.md`

---

## Phase 2: Foundational (Blocking Contracts)

**Purpose**: Define shared contracts and persistence foundations that all scenarios depend on.

**Critical**: No scenario implementation should begin until this phase is complete.

- [x] T005 Run GitNexus impact analysis for `projectSchema`, `projectCreateSchema`, `projectUpdateSchema`, `taskSpecSchema`, `platformCapabilitiesSchema`, and `TaskSpec` before editing `/Users/arcadia/Documents/mystra/packages/shared/src/schemas.ts`
- [x] T006 Add Project runtime config, task runtime override, context bundle, resolved runtime, and expanded runner capability schemas in `/Users/arcadia/Documents/mystra/packages/shared/src/schemas.ts`
- [x] T007 Update shared schema tests for Project runtime config, task runtime override, context bundles, runner capabilities, resolved runtime, and top-level image rejection in `/Users/arcadia/Documents/mystra/packages/shared/src/schemas.test.ts`
- [x] T008 Run GitNexus impact analysis for `RdbProvider`, `ProjectClaim`, `TaskSnapshot`, and `RegisterRunnerInput` before editing `/Users/arcadia/Documents/mystra/apps/control-plane/src/lib/db/rdb-provider.ts`
- [x] T009 Extend `RdbProvider` types and methods for Project runtime config, context bundle lookup, task runtime overrides, and resolved runtime snapshots in `/Users/arcadia/Documents/mystra/apps/control-plane/src/lib/db/rdb-provider.ts`
- [x] T010 Update SQLite migrations for Project runtime JSON, context bundles, and resolved runtime snapshot fields in `/Users/arcadia/Documents/mystra/apps/control-plane/src/lib/db/migrations.ts`
- [x] T011 Add DB row parsing helpers for runtime config, context bundle JSON, and resolved runtime fields in `/Users/arcadia/Documents/mystra/apps/control-plane/src/lib/db/sqlite-provider.ts`
- [x] T012 [P] Add runtime resolver module skeleton and focused tests in `/Users/arcadia/Documents/mystra/apps/control-plane/src/lib/runtime/resolve-runtime.ts` and `/Users/arcadia/Documents/mystra/apps/control-plane/src/lib/runtime/resolve-runtime.test.ts`
- [x] T013 Verify foundational contracts with `pnpm --filter @mystra/shared test`

**Checkpoint**: Shared contracts and DB surfaces exist; scenario work can begin.

---

## Phase 3: Technical Scenario 1 - Define Project Runtime Config (Priority: P1)

**Goal**: Platform operators can create and update Projects with typed runtime config, including Docker image, without loose top-level runtime fields.

**Independent Test**: Create a Project with `runtime.provider=docker` and `runtime.image`, retrieve it, and verify invalid runtime config is rejected.

### Tests for TS1

- [x] T014 [P] [TS1] Add shared Project runtime config tests for valid Docker image, invalid image, forbidden mounts, and embedded secret values in `/Users/arcadia/Documents/mystra/packages/shared/src/schemas.test.ts`
- [x] T015 [P] [TS1] Add SQLite provider tests for Project runtime create/update/read and top-level image rejection in `/Users/arcadia/Documents/mystra/apps/control-plane/src/lib/db/sqlite-provider.test.ts`
- [x] T016 [P] [TS1] Add route tests for Project runtime config create/update behavior in `/Users/arcadia/Documents/mystra/apps/control-plane/app/api/routes.test.ts`

### Implementation for TS1

- [x] T017 [TS1] Update Project create/update persistence to store `runtime` without a top-level image compatibility field in `/Users/arcadia/Documents/mystra/apps/control-plane/src/lib/db/sqlite-provider.ts`
- [x] T018 [TS3] Update Project API route boundary validation for runtime config fields in `/Users/arcadia/Documents/mystra/apps/control-plane/app/api/projects/route.ts`
- [x] T019 [TS3] Update Project detail API route boundary validation for runtime config fields in `/Users/arcadia/Documents/mystra/apps/control-plane/app/api/projects/[slug]/route.ts`
- [x] T020 [TS1] Update control-plane UI or minimal operator surface to show Project runtime provider and image in `/Users/arcadia/Documents/mystra/apps/control-plane/app/page.tsx`
- [x] T021 [TS1] Run `pnpm --filter @mystra/shared test` and `pnpm --filter @mystra/control-plane test`

**Checkpoint**: TS1 works independently: Projects can own typed runtime image config.

---

## Phase 4: Technical Scenario 2 - Resolve Runtime From Project Default And Overrides (Priority: P1)

**Goal**: Task submission resolves an effective runtime from Project runtime config and permitted overrides.

**Independent Test**: Submit tasks with Project default runtime and allowed overrides; verify unknown/disallowed overrides create no run or fail before execution.

### Tests for TS2

- [x] T022 [P] [TS2] Add shared task runtime override tests for allowed image/context overrides and rejected forbidden overrides in `/Users/arcadia/Documents/mystra/packages/shared/src/schemas.test.ts`
- [x] T023 [P] [TS2] Add runtime resolver tests for Project defaults, override acceptance, override rejection, forbidden mounts, secret hygiene, and snapshot stability in `/Users/arcadia/Documents/mystra/apps/control-plane/src/lib/runtime/resolve-runtime.test.ts`
- [x] T024 [P] [TS3] Add API/MCP route tests for Project runtime config, constrained task runtime override fields, top-level image rejection, and MVP-forbidden override fields in `/Users/arcadia/Documents/mystra/apps/control-plane/app/api/routes.test.ts`

### Implementation for TS2

- [x] T025 [TS2] Implement runtime resolver logic in `/Users/arcadia/Documents/mystra/apps/control-plane/src/lib/runtime/resolve-runtime.ts`
- [x] T026 [TS2] Update task creation to call the runtime resolver and persist the resolved runtime snapshot in `/Users/arcadia/Documents/mystra/apps/control-plane/src/lib/db/sqlite-provider.ts`
- [x] T027 [TS3] Update task API boundary validation for constrained runtime override fields in `/Users/arcadia/Documents/mystra/apps/control-plane/app/api/tasks/route.ts`
- [x] T028 [TS3] Update MCP project/task tool schemas for Project runtime, future profile reservation, and constrained task override fields in `/Users/arcadia/Documents/mystra/apps/control-plane/app/api/mcp/route.ts`
- [x] T029 [TS2] Run `pnpm --filter @mystra/shared test` and `pnpm --filter @mystra/control-plane test`

**Checkpoint**: TS2 works independently: tasks resolve runtime contracts from Project runtime config.

---

## Phase 4.5: Technical Scenario 3 - Design API/MCP Runtime Boundaries (Priority: P0)

**Goal**: HTTP API and MCP submissions validate Project runtime config, future profile reservation, and constrained task overrides at the service boundary before persistence or run creation.

**Task Mapping**: TS3 work is attached to the route files it changes: T018, T019, T024, T027, T028, T068, and T069.

**Checkpoint**: TS3 works independently: API and MCP callers cannot create executable runs with top-level Project image, malformed runtime config, or MVP-forbidden override fields.

---

## Phase 5: Technical Scenario 4 - Provide Context Through Explicit Bundles (Priority: P1)

**Goal**: Context bundles are explicit runtime inputs with resolution and failure policy, not hard-coded runner prompt or source-owned content.

**Independent Test**: Configure `agent-skills` in Project runtime, submit a task with job-scoped context, and verify missing required bundles fail before agent start.

### Tests for TS4

- [x] T030 [P] [TS4] Add context bundle schema tests for source, access mode, freshness, failure mode, and forbidden mount paths in `/Users/arcadia/Documents/mystra/packages/shared/src/schemas.test.ts`
- [x] T031 [P] [TS4] Add SQLite provider tests for required context bundle lookup/resolution failures; full context bundle CRUD is optional for the first slice in `/Users/arcadia/Documents/mystra/apps/control-plane/src/lib/db/sqlite-provider.test.ts`
- [x] T032 [P] [TS4] Add runner-daemon test asserting prompt/context setup is driven by resolved bundles rather than hard-coded issue-context text in `/Users/arcadia/Documents/mystra/apps/runner-daemon/src/container-task.test.ts`

### Implementation for TS4

- [x] T033 [TS4] Implement minimal context bundle lookup/persistence needed for resolution in `/Users/arcadia/Documents/mystra/apps/control-plane/src/lib/db/sqlite-provider.ts`
- [x] T034 [TS4] Implement minimal context bundle collection route handlers for create/list in `/Users/arcadia/Documents/mystra/apps/control-plane/app/api/context-bundles/route.ts`
- [x] T035 [TS4] Defer or implement single context bundle route handlers only if the first slice needs operator-managed bundles in `/Users/arcadia/Documents/mystra/apps/control-plane/app/api/context-bundles/[slug]/route.ts`
- [x] T036 [TS4] Add context bundle resolution into the runtime resolver in `/Users/arcadia/Documents/mystra/apps/control-plane/src/lib/runtime/resolve-runtime.ts`
- [x] T037 [TS4] Replace hard-coded task prompt context sections with resolved context bundle rendering in `/Users/arcadia/Documents/mystra/apps/runner-daemon/src/index.ts`
- [x] T038 [TS4] Run `pnpm --filter @mystra/control-plane test` and `pnpm --filter @mystra/runner-daemon test`

**Checkpoint**: TS4 works independently: required context is explicit and missing context fails before agent execution.

---

## Phase 6: Technical Scenario 5 - Keep Sandbox Providers Replaceable (Priority: P2)

**Goal**: Runner registration and claim matching use provider and runtime capabilities so future providers do not require Project or task contract changes.

**Independent Test**: Register compatible and incompatible runners, submit a Project-runtime-backed task, and verify only compatible runners can claim it.

### Tests for TS5

- [x] T039 [P] [TS5] Add shared runner capability tests for providers, mount kinds, context bundle modes, port exposure, and secret injection modes in `/Users/arcadia/Documents/mystra/packages/shared/src/schemas.test.ts`
- [x] T040 [P] [TS5] Add control-plane claim tests for compatible runner assignment and incompatible runner non-assignment in `/Users/arcadia/Documents/mystra/apps/control-plane/src/lib/db/sqlite-provider.test.ts`
- [x] T041 [P] [TS5] Add runner claim contract route tests for resolved runtime payload shape in `/Users/arcadia/Documents/mystra/apps/control-plane/app/api/routes.test.ts`

### Implementation for TS5

- [x] T042 [TS5] Update runner registration capability parsing in `/Users/arcadia/Documents/mystra/apps/control-plane/src/lib/db/sqlite-provider.ts`
- [x] T043 [TS5] Update claim selection to check provider and required runtime features before assignment in `/Users/arcadia/Documents/mystra/apps/control-plane/src/lib/db/sqlite-provider.ts`
- [x] T044 [TS5] Update runner registration route handling for expanded capabilities in `/Users/arcadia/Documents/mystra/apps/control-plane/app/api/runner/register/route.ts`
- [x] T045 [TS5] Update runner claim route to return `{ task, run, project, runtime }` including empty runtime nulls in `/Users/arcadia/Documents/mystra/apps/control-plane/app/api/runner/tasks/route.ts`
- [x] T046 [TS5] Update runner-daemon `ClaimedTaskResponse` type and compatibility checks in `/Users/arcadia/Documents/mystra/apps/runner-daemon/src/index.ts`
- [x] T047 [TS5] Run `pnpm --filter @mystra/control-plane test` and `pnpm --filter @mystra/runner-daemon test`

**Checkpoint**: TS5 works independently: provider compatibility is enforced before assignment.

---

## Phase 7: Technical Scenario 6 - Retire Source-Owned Baseline Runtime Truth (Priority: P2)

**Goal**: Baseline image and skill sync remain local development templates, while normal execution uses resolved runtime config.

**Independent Test**: Build/use the local template through `Project.runtime.image` and verify runner execution uses `runtime.environment.image`.

### Tests for TS6

- [x] T048 [P] [TS6] Update runner-daemon test to assert Docker image selection uses `runtime.environment.image` and does not independently interpret `project.image` in `/Users/arcadia/Documents/mystra/apps/runner-daemon/src/container-task.test.ts`
- [x] T049 [P] [TS6] Update control-plane provider tests to assert claim payloads include resolved runtime from Project runtime config in `/Users/arcadia/Documents/mystra/apps/control-plane/src/lib/db/sqlite-provider.test.ts`

### Implementation for TS6

- [x] T050 [TS6] Update Docker execution path to use the resolved runtime contract for image, env, mounts, ports, caches, and secrets in `/Users/arcadia/Documents/mystra/apps/runner-daemon/src/index.ts`
- [x] T051 [TS6] Move Castrel-oriented runner image context out of git to `/tmp/mystra-castrel-runner-image`
- [x] T052 [TS6] Update skill sync script to target the local image context instead of a git-tracked image package in `/Users/arcadia/Documents/mystra/scripts/sync-runner-skills.sh`
- [x] T053 [TS6] Update runner image build and doctor scripts to reference local Castrel image context and Project runtime config in `/Users/arcadia/Documents/mystra/scripts/build-runner-image.sh` and `/Users/arcadia/Documents/mystra/scripts/doctor-local.sh`
- [x] T054 [TS6] Update local usage and runner docs to describe Project runtime config and the local-only Castrel image in `/Users/arcadia/Documents/mystra/docs/LOCAL-USAGE.md` and `/Users/arcadia/Documents/mystra/docs/RUNNER-DOCKER-MVP.md`
- [x] T055 [TS6] Run `pnpm --filter @mystra/runner-daemon test`

**Checkpoint**: TS6 works independently: local templates exist, but source-owned runtime truth is retired.

---

## Phase 8: Current Corrections From Core Logic Review

**Purpose**: Incorporate owner clarification before continuing implementation: MVP has one Project default runtime, future runtime profiles are reserved, API/MCP boundary design is P0, mount ownership has three levels, and secrets are managed Project/runtime inputs but not a full first-slice manager.

- [x] T066 [P] [TS2] Add schema/resolver tests that document the MVP default-runtime path and reserved future `runtimeProfile` behavior in `/Users/arcadia/Documents/mystra/packages/shared/src/schemas.test.ts` and `/Users/arcadia/Documents/mystra/apps/control-plane/src/lib/runtime/resolve-runtime.test.ts`
- [x] T067 [TS2] Ensure task runtime override remains constrained to MVP-allowed fields and cannot override mounts, secrets, cache, or ports in `/Users/arcadia/Documents/mystra/packages/shared/src/schemas.ts` and `/Users/arcadia/Documents/mystra/apps/control-plane/src/lib/runtime/resolve-runtime.ts`
- [x] T068 [P] [TS3] Add API/MCP tests that reject MVP-forbidden runtime override fields and top-level Project image before persistence in `/Users/arcadia/Documents/mystra/apps/control-plane/app/api/routes.test.ts`
- [x] T069 [TS3] Tighten API and MCP route schemas to validate Project runtime and task runtime override at the boundary in `/Users/arcadia/Documents/mystra/apps/control-plane/app/api/projects/route.ts`, `/Users/arcadia/Documents/mystra/apps/control-plane/app/api/projects/[slug]/route.ts`, `/Users/arcadia/Documents/mystra/apps/control-plane/app/api/tasks/route.ts`, and `/Users/arcadia/Documents/mystra/apps/control-plane/app/api/mcp/route.ts`
- [x] T070 [P] [TS5] Add focused tests for effective mount ownership and merge semantics across system, Project, and runtime/image mounts in `/Users/arcadia/Documents/mystra/apps/runner-daemon/src/container-task.test.ts` or `/Users/arcadia/Documents/mystra/apps/control-plane/src/lib/runtime/resolve-runtime.test.ts`
- [x] T071 [TS5] Refactor resolved mount translation so system-managed runner mounts are not confused with Castrel Project/runtime mounts in `/Users/arcadia/Documents/mystra/apps/runner-daemon/src/index.ts` and, if needed, `/Users/arcadia/Documents/mystra/apps/control-plane/src/lib/runtime/resolve-runtime.ts`
- [x] T072 [P] [TS1] Update the minimal operator surface to show Project runtime provider, image, and runtime summary in `/Users/arcadia/Documents/mystra/apps/control-plane/app/page.tsx`
- [x] T073 Run `pnpm --filter @mystra/shared test`, `pnpm --filter @mystra/control-plane test`, `pnpm --filter @mystra/runner-daemon test`, and `pnpm typecheck` after the correction slice

---

## Phase 9: Polish And Broad Verification

**Purpose**: Complete documentation reconciliation and broad checks.

- [x] T056 Add coverage that top-level Project `image` is rejected in shared schema, control-plane routes, and MCP project creation in `/Users/arcadia/Documents/mystra/packages/shared/src/schemas.test.ts` and `/Users/arcadia/Documents/mystra/apps/control-plane/app/api/routes.test.ts`
- [x] T057 Remove any remaining feature documentation that implies legacy top-level Project image migration in `/Users/arcadia/Documents/mystra/specs/002-runtime-profile-context/`
- [x] T058 Update feature quickstart with any implementation-specific command changes in `/Users/arcadia/Documents/mystra/specs/002-runtime-profile-context/quickstart.md`
- [x] T059 [P] Update `PLATFORM.md` runtime shape and provider-boundary notes for Project runtime config in `/Users/arcadia/Documents/mystra/PLATFORM.md`
- [x] T060 [P] Update `PRODUCT.md` success measures or boundaries only if implementation changes durable product scope in `/Users/arcadia/Documents/mystra/PRODUCT.md`
- [x] T061 Run `pnpm --filter @mystra/shared test`
- [x] T062 Run `pnpm --filter @mystra/control-plane test`
- [x] T063 Run `pnpm --filter @mystra/runner-daemon test`
- [x] T064 Run `pnpm typecheck` when focused tests pass
- [x] T065 Run GitNexus detect changes before committing to verify affected symbols and execution flows

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 Setup**: No dependencies.
- **Phase 2 Foundational**: Depends on Phase 1.
- **TS1 Project Runtime Config**: Depends on Phase 2.
- **TS2 Runtime Resolution**: Depends on TS1 Project runtime config.
- **TS3 API/MCP Boundary**: Depends on TS1 and TS2 schemas; blocks clean external submission.
- **TS4 Context Bundles**: Depends on Phase 2 and can overlap with TS2 after schemas exist.
- **TS5 Provider Compatibility**: Depends on TS1 and TS2 resolved runtime contracts.
- **TS6 Baseline Runtime Truth Cleanup**: Depends on TS5 runner claim contract.
- **Phase 8 Corrections**: Depends on owner clarification and the current partial implementation state.
- **Phase 9 Migration/Polish**: Depends on all selected technical scenarios.

### Parallel Opportunities

- T002 and T003 can run in parallel.
- T014, T015, and T016 can run in parallel after foundational schemas.
- T022, T023, and T024 can run in parallel after TS1 contracts.
- T030, T031, and T032 can run in parallel after context bundle schemas.
- T039, T040, and T041 can run in parallel after runner capability schemas.
- T048 and T049 can run in parallel after resolved runtime claim contract exists.
- T066, T068, T070, and T072 can run in parallel after this clarification is recorded.
- T059 and T060 can run in parallel after implementation behavior is known.

## Implementation Strategy

### MVP First

1. Complete Phase 1 and Phase 2.
2. Complete TS1 and TS2.
3. Validate that Projects can own runtime image config and tasks resolve runtime contracts.
4. Stop and review before changing runner execution.

### Incremental Delivery

1. Project runtime config contract and persistence.
2. Task runtime override and runtime resolver.
3. Context bundle resolution.
4. Runner compatibility and claim contract.
5. Docker runner translation and local Castrel image cleanup.

### Coordination Notes

- Shared schema and DB provider tasks are sequentially sensitive; avoid parallel edits to the same files.
- Runner-daemon and documentation cleanup can proceed after the claim contract is stable.
- Every code-symbol edit requires GitNexus impact analysis before modification.
