# Feature Specification: Project Abstraction + SQLite Persistence

**Feature Branch**: `001-project-and-sqlite`
**Created**: 2026-05-09
**Status**: Implemented; closure verified
**Reconciliation Note**: Core Project/SQLite persistence scope in this feature is implemented. Runtime-image and runner-claim semantics originally drafted here were refined by `002-runtime-profile-context`; treat `002` as authoritative for runtime contract shape.
**Input**: User description: "Introduce Project as the parent configuration for tasks and replace the in-memory local store with a SQLite-backed RdbProvider while keeping the future PG/Supabase boundary clean."
**Dependency Note**: Runtime-image and runtime-contract details in this feature are interpreted through `002-runtime-profile-context`. `Project` remains the durable repository/execution unit, but runtime image ownership now lives under `Project.runtime.image`, not a top-level `Project.image` field. A future `workspace` scope may sit above `Project`, but does not replace it as the execution configuration unit in this feature.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Create Project Configuration (Priority: P1)

A platform operator creates a Project with name, slug, repository, default branch, default agent, structured runtime configuration, and optional prewarm metadata so later tasks can reference stable project configuration.

**Why this priority**: Without Project records, callers must keep repeating repo/baseBranch/agent/image details and Mystra cannot support multiple GitLab/GitHub projects cleanly.

**Independent Test**: POST a valid project, query it by slug, restart the control plane with the same SQLite file, and confirm the project is still present.

**Acceptance Scenarios**:

1. **Given** no project exists with slug `castrel-ai`, **When** the operator posts a valid project payload, **Then** the API returns `201` with `{ project }` containing the full Project record and persists it.
2. **Given** a project already exists with slug `castrel-ai`, **When** the operator posts another project with the same slug, **Then** the API returns `409` with a clear error.
3. **Given** a project payload omits required runtime image information for the Docker provider, **When** the operator posts it, **Then** the API returns `400` and no project is created.

---

### User Story 2 - Submit Task by Project (Priority: P1)

An agent or CI caller submits a task with `projectId`, `branchName`, and `prompt`; Mystra resolves repo/baseBranch/agent/runtime defaults from the Project while allowing explicit task-level overrides where permitted.

**Why this priority**: Remote MCP and HTTP callers need a small stable contract. Project-based task creation is the main path for other agents and skills to use Mystra.

**Independent Test**: Create a project, submit a task with only `projectId`, `branchName`, and `prompt`, then inspect the task snapshot and first run.

**Acceptance Scenarios**:

1. **Given** an active Project, **When** a caller posts `{ projectId, branchName, prompt }`, **Then** Mystra creates a task whose snapshot includes repo/baseBranch/agent resolved from the Project.
2. **Given** an active Project, **When** a caller provides explicit repo/baseBranch/agent overrides, **Then** the task snapshot stores the resolved override values without mutating the Project.
3. **Given** a missing, unknown, or archived Project, **When** a caller submits a task, **Then** Mystra returns `400` with a clear error and creates no run.

---

### User Story 3 - Archive Project (Priority: P2)

A platform operator archives a Project instead of deleting it so historical tasks remain traceable while new work cannot use the archived Project.

**Why this priority**: Project lifecycle must not break task history. Archive semantics are safer than physical deletes for an AI-built operational system.

**Independent Test**: Archive a project, verify old tasks remain queryable, verify new task creation is rejected, then unarchive through PATCH.

**Acceptance Scenarios**:

1. **Given** an active Project, **When** the operator deletes `/api/projects/{slug}`, **Then** `archivedAt` is set and the Project is returned.
2. **Given** an archived Project with historical tasks, **When** tasks are queried, **Then** historical task snapshots are still available.
3. **Given** an archived Project, **When** the operator restores it with PATCH, **Then** `archivedAt` is cleared and new tasks may be created.

---

### User Story 4 - Persist Runtime State Across Restart (Priority: P1)

A platform operator restarts the control plane and still sees existing tasks, runs, runner sessions, run events, and artifacts from SQLite.

**Why this priority**: The current in-memory Map loses operational state. Durable state is required before a real remote MCP-driven MVP can be trusted.

**Independent Test**: Create a project and task, append run state, close/reopen the SQLite provider, and query the same records.

**Acceptance Scenarios**:

1. **Given** a task and run exist, **When** the control-plane process restarts using the same `MYSTRA_DB_PATH`, **Then** GET `/api/tasks/{id}` returns the same snapshot.
2. **Given** a runner daemon restarts, **When** it registers again, **Then** it receives a new session token; old session records may remain but are not required for correctness.
3. **Given** a non-terminal run exists before restart, **When** the control plane restarts, **Then** Mystra does not auto-cancel or auto-retry it.

---

### User Story 5 - Runner Uses Project Image (Priority: P1)

A runner daemon claims a run and receives the resolved Project runtime contract in the claim response so different projects can run in different containers.

**Why this priority**: The MVP must support multiple project environments on the high-capacity server; runner-global `MYSTRA_RUNNER_IMAGE` is too coarse.

**Independent Test**: Create two projects with different images, submit a task for each, claim runs, and verify Docker execution uses the image from the associated Project.

**Acceptance Scenarios**:

1. **Given** a queued run for a Project, **When** a runner claims it, **Then** the claim response includes the Project identity plus the resolved runtime contract needed for execution.
2. **Given** a claimed run, **When** the Docker executor starts, **Then** it uses the resolved runtime image from the claim contract.
3. **Given** image pull or startup fails, **When** the executor reports failure, **Then** the run becomes `failed` with a clear `failureReason`.

---

### User Story 6 - Preserve Prewarm as Provider Capability (Priority: P3)

A future sandbox provider can read Project prewarm configuration, while the bare Docker MVP does not pretend to support automatic prewarm.

**Why this priority**: This keeps cache behavior behind the sandbox/provider boundary instead of turning Project into a runner lifecycle shortcut.

**Independent Test**: Verify `prewarmConfig` is stored and returned on Project records and claim responses, while no automatic bare-Docker prewarm is triggered.

**Acceptance Scenarios**:

1. **Given** a Project has `prewarmConfig`, **When** it is queried or claimed through a task, **Then** the config is returned as structured JSON.
2. **Given** the bare Docker provider is active, **When** a Project is created, **Then** no automatic task lifecycle prewarm is triggered.
3. **Given** the operator uses `prewarm-project.sh`, **When** a Project slug is provided, **Then** the script resolves Project data instead of hard-coded Castrel paths.

### Edge Cases

- Project slug conflict must return `409`, not overwrite.
- Corrupt JSON in SQLite must throw with field name and record id context.
- `projectId` missing, unknown, or archived must reject task creation.
- Explicit task overrides must not mutate Project defaults.
- Project archive must not delete historical tasks.
- Runner claim must not return a task without the resolved runtime image required for execution.
- SQLite schema must not expose SQLite-only details through `RdbProvider`.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide Project CRUD APIs: `GET/POST /api/projects`, `GET/PATCH/DELETE /api/projects/{slug}`.
- **FR-002**: System MUST validate Project input with shared Zod schemas and require `name`, `slug`, `repo`, `baseBranch`, `defaultAgent`, and runtime configuration sufficient for the selected provider.
- **FR-003**: System MUST enforce globally unique Project slugs.
- **FR-004**: System MUST implement soft archive for Projects through `archivedAt` and MUST NOT physically delete Projects in MVP.
- **FR-005**: System MUST reject new task creation for archived Projects.
- **FR-006**: System MUST add `projectId` to `TaskSpec` and require it for task creation in this feature.
- **FR-007**: System MUST resolve repo/baseBranch/agent defaults from Project during task creation and store resolved values as immutable task snapshot fields.
- **FR-008**: System MUST allow explicit repo/baseBranch/agent overrides at task creation without mutating the Project.
- **FR-009**: System MUST replace `local-store.ts` with a provider boundary named `RdbProvider`.
- **FR-010**: System MUST implement `SqliteRdbProvider` using `better-sqlite3`.
- **FR-011**: `RdbProvider` MUST return domain types and MUST NOT expose SQLite-specific APIs, row ids, raw SQL, or dialect-specific parameters.
- **FR-012**: SQLite startup MUST apply the MVP schema automatically for projects, logical task records (stored in the SQLite `jobs` table), runs, runner sessions, run events, and artifacts.
- **FR-013**: SQLite MUST use WAL mode.
- **FR-014**: JSON fields MUST be serialized/deserialized at the provider boundary and parse failures MUST include field name and record id.
- **FR-015**: Runner claim responses MUST include Project identity plus the resolved runtime contract required for execution.
- **FR-016**: Runner daemon MUST use the resolved runtime contract and MUST remove `MYSTRA_RUNNER_IMAGE` as the normal runtime image source.
- **FR-017**: MCP surface MUST add `mystra_create_project`, `mystra_list_projects`, and `mystra_get_project`.
- **FR-018**: Existing `mystra_create_task` MCP input MUST require `projectId`.
- **FR-019**: Scripts MUST rename/generalize `castrel-job.mjs` to `submit-job.mjs` and `prewarm-castrel-ai.sh` to `prewarm-project.sh`.
- **FR-020**: Castrel-oriented runner image context MUST stay local-only outside git, not Mystra-owned per-project runtime truth.

### Key Entities

- **Project**: Stable project configuration including repo, base branch, default agent, structured runtime configuration, prewarm config, metadata, archive state, and timestamps.
- **Task**: A submitted work request with `projectId`, task identity, branch, prompt, optional MR/PR metadata, and resolved repo/baseBranch/agent snapshots.
- **Run**: Attempt to execute a task, with state, assigned runner, result, failure reason, and timestamps.
- **RunnerSession**: Registered runner identity, token, capabilities, concurrency, heartbeat, and timestamps.
- **RunEvent**: Structured lifecycle event for observability without log persistence.
- **Artifact**: Structured result pointer such as branch/MR/PR metadata or future artifact URI.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A Project created through API remains queryable after control-plane restart using the same SQLite file.
- **SC-002**: A task can be created with only `projectId`, `branchName`, and `prompt`, and its snapshot contains resolved repo/baseBranch/agent values.
- **SC-003**: All existing API and MCP task creation paths reject missing `projectId` with a clear `400`.
- **SC-004**: Runner claim returns the resolved runtime data needed for execution and Docker execution no longer depends on `MYSTRA_RUNNER_IMAGE`.
- **SC-005**: `pnpm --filter @mystra/shared test` passes after schema changes.
- **SC-006**: `pnpm --filter @mystra/control-plane test` passes provider and route tests.
- **SC-007**: `pnpm --filter @mystra/control-plane typecheck` and `pnpm --filter @mystra/runner-daemon typecheck` pass.
- **SC-008**: `pnpm job:submit --project <slug> ...` can submit a task after a Project exists.
- **SC-009**: Docs and Spec-Kit artifacts no longer reference `castrel-job` as the primary submit command.
