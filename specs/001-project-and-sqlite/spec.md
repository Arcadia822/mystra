# Feature Specification: Project Abstraction + SQLite Persistence

**Feature Branch**: `001-project-and-sqlite`  
**Created**: 2026-05-09  
**Status**: Ready for planning  
**Input**: User description: "Introduce Project as the parent configuration for jobs and replace the in-memory local store with a SQLite-backed RdbProvider while keeping the future PG/Supabase boundary clean."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Create Project Configuration (Priority: P1)

A platform operator creates a Project with name, slug, repository, default branch, default agent, runtime image, and optional prewarm metadata so later jobs can reference stable project configuration.

**Why this priority**: Without Project records, callers must keep repeating repo/baseBranch/agent/image details and Mystra cannot support multiple GitLab/GitHub projects cleanly.

**Independent Test**: POST a valid project, query it by slug, restart the control plane with the same SQLite file, and confirm the project is still present.

**Acceptance Scenarios**:

1. **Given** no project exists with slug `castrel-ai`, **When** the operator posts a valid project payload, **Then** the API returns `201` with `{ project }` containing the full Project record and persists it.
2. **Given** a project already exists with slug `castrel-ai`, **When** the operator posts another project with the same slug, **Then** the API returns `409` with a clear error.
3. **Given** a project payload omits `image`, **When** the operator posts it, **Then** the API returns `400` and no project is created.

---

### User Story 2 - Submit Job by Project (Priority: P1)

An agent or CI caller submits a job with `projectId`, `branchName`, and `prompt`; Mystra resolves repo/baseBranch/agent/image defaults from the Project while allowing explicit job-level overrides where permitted.

**Why this priority**: Remote MCP and HTTP callers need a small stable contract. Project-based job creation is the main path for other agents and skills to use Mystra.

**Independent Test**: Create a project, submit a job with only `projectId`, `branchName`, and `prompt`, then inspect the job snapshot and first run.

**Acceptance Scenarios**:

1. **Given** an active Project, **When** a caller posts `{ projectId, branchName, prompt }`, **Then** Mystra creates a job whose snapshot includes repo/baseBranch/agent resolved from the Project.
2. **Given** an active Project, **When** a caller provides explicit repo/baseBranch/agent overrides, **Then** the job snapshot stores the resolved override values without mutating the Project.
3. **Given** a missing, unknown, or archived Project, **When** a caller submits a job, **Then** Mystra returns `400` with a clear error and creates no run.

---

### User Story 3 - Archive Project (Priority: P2)

A platform operator archives a Project instead of deleting it so historical jobs remain traceable while new work cannot use the archived Project.

**Why this priority**: Project lifecycle must not break job history. Archive semantics are safer than physical deletes for an AI-built operational system.

**Independent Test**: Archive a project, verify old jobs remain queryable, verify new job creation is rejected, then unarchive through PATCH.

**Acceptance Scenarios**:

1. **Given** an active Project, **When** the operator deletes `/api/projects/{slug}`, **Then** `archivedAt` is set and the Project is returned.
2. **Given** an archived Project with historical jobs, **When** jobs are queried, **Then** historical job snapshots are still available.
3. **Given** an archived Project, **When** the operator restores it with PATCH, **Then** `archivedAt` is cleared and new jobs may be created.

---

### User Story 4 - Persist Runtime State Across Restart (Priority: P1)

A platform operator restarts the control plane and still sees existing jobs, runs, runner sessions, run events, and artifacts from SQLite.

**Why this priority**: The current in-memory Map loses operational state. Durable state is required before a real remote MCP-driven MVP can be trusted.

**Independent Test**: Create a project and job, append run state, close/reopen the SQLite provider, and query the same records.

**Acceptance Scenarios**:

1. **Given** a job and run exist, **When** the control-plane process restarts using the same `MYSTRA_DB_PATH`, **Then** GET `/api/jobs/{id}` returns the same snapshot.
2. **Given** a runner daemon restarts, **When** it registers again, **Then** it receives a new session token; old session records may remain but are not required for correctness.
3. **Given** a non-terminal run exists before restart, **When** the control plane restarts, **Then** Mystra does not auto-cancel or auto-retry it.

---

### User Story 5 - Runner Uses Project Image (Priority: P1)

A runner daemon claims a run and receives the Project runtime image in the claim response so different projects can run in different containers.

**Why this priority**: The MVP must support multiple project environments on the high-capacity server; runner-global `MYSTRA_RUNNER_IMAGE` is too coarse.

**Independent Test**: Create two projects with different images, submit a job for each, claim runs, and verify Docker execution uses the image from the associated Project.

**Acceptance Scenarios**:

1. **Given** a queued run for a Project, **When** a runner claims it, **Then** the claim response includes `project: { id, slug, image, prewarmConfig }`.
2. **Given** a claimed run, **When** the Docker executor starts, **Then** it uses `claimedJob.project.image`.
3. **Given** image pull or startup fails, **When** the executor reports failure, **Then** the run becomes `failed` with a clear `failureReason`.

---

### User Story 6 - Preserve Prewarm as Provider Capability (Priority: P3)

A future sandbox provider can read Project prewarm configuration, while the bare Docker MVP does not pretend to support automatic prewarm.

**Why this priority**: This keeps cache behavior behind the sandbox/provider boundary instead of turning Project into a runner lifecycle shortcut.

**Independent Test**: Verify `prewarmConfig` is stored and returned on Project records and claim responses, while no automatic bare-Docker prewarm is triggered.

**Acceptance Scenarios**:

1. **Given** a Project has `prewarmConfig`, **When** it is queried or claimed through a job, **Then** the config is returned as structured JSON.
2. **Given** the bare Docker provider is active, **When** a Project is created, **Then** no automatic job lifecycle prewarm is triggered.
3. **Given** the operator uses `prewarm-project.sh`, **When** a Project slug is provided, **Then** the script resolves Project data instead of hard-coded Castrel paths.

### Edge Cases

- Project slug conflict must return `409`, not overwrite.
- Corrupt JSON in SQLite must throw with field name and record id context.
- `projectId` missing, unknown, or archived must reject job creation.
- Explicit job overrides must not mutate Project defaults.
- Project archive must not delete historical jobs.
- Runner claim must not return a job without Project image.
- SQLite schema must not expose SQLite-only details through `RdbProvider`.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide Project CRUD APIs: `GET/POST /api/projects`, `GET/PATCH/DELETE /api/projects/{slug}`.
- **FR-002**: System MUST validate Project input with shared Zod schemas and require `name`, `slug`, `repo`, `baseBranch`, `defaultAgent`, and `image`.
- **FR-003**: System MUST enforce globally unique Project slugs.
- **FR-004**: System MUST implement soft archive for Projects through `archivedAt` and MUST NOT physically delete Projects in MVP.
- **FR-005**: System MUST reject new job creation for archived Projects.
- **FR-006**: System MUST add `projectId` to `JobSpec` and require it for job creation in this feature.
- **FR-007**: System MUST resolve repo/baseBranch/agent defaults from Project during job creation and store resolved values as immutable job snapshot fields.
- **FR-008**: System MUST allow explicit repo/baseBranch/agent overrides at job creation without mutating the Project.
- **FR-009**: System MUST replace `local-store.ts` with a provider boundary named `RdbProvider`.
- **FR-010**: System MUST implement `SqliteRdbProvider` using `better-sqlite3`.
- **FR-011**: `RdbProvider` MUST return domain types and MUST NOT expose SQLite-specific APIs, row ids, raw SQL, or dialect-specific parameters.
- **FR-012**: SQLite startup MUST apply the MVP schema automatically for projects, jobs, runs, runner sessions, run events, and artifacts.
- **FR-013**: SQLite MUST use WAL mode.
- **FR-014**: JSON fields MUST be serialized/deserialized at the provider boundary and parse failures MUST include field name and record id.
- **FR-015**: Runner claim responses MUST include `project: { id, slug, image, prewarmConfig }`.
- **FR-016**: Runner daemon MUST use `claimedJob.project.image` and MUST remove `MYSTRA_RUNNER_IMAGE` as the normal runtime image source.
- **FR-017**: MCP surface MUST add `mystra_create_project`, `mystra_list_projects`, and `mystra_get_project`.
- **FR-018**: Existing `mystra_create_job` MCP input MUST require `projectId`.
- **FR-019**: Scripts MUST rename/generalize `castrel-job.mjs` to `submit-job.mjs` and `prewarm-castrel-ai.sh` to `prewarm-project.sh`.
- **FR-020**: Castrel-oriented runner image context MUST stay local-only outside git, not Mystra-owned per-project runtime truth.

### Key Entities

- **Project**: Stable project configuration including repo, base branch, default agent, runtime image, prewarm config, metadata, archive state, and timestamps.
- **Job**: A submitted work request with `projectId`, task identity, branch, prompt, optional MR/PR metadata, and resolved repo/baseBranch/agent snapshots.
- **Run**: Attempt to execute a job, with state, assigned runner, result, failure reason, and timestamps.
- **RunnerSession**: Registered runner identity, token, capabilities, concurrency, heartbeat, and timestamps.
- **RunEvent**: Structured lifecycle event for observability without log persistence.
- **Artifact**: Structured result pointer such as branch/MR/PR metadata or future artifact URI.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A Project created through API remains queryable after control-plane restart using the same SQLite file.
- **SC-002**: A job can be created with only `projectId`, `branchName`, and `prompt`, and its snapshot contains resolved repo/baseBranch/agent values.
- **SC-003**: All existing API and MCP job creation paths reject missing `projectId` with a clear `400`.
- **SC-004**: Runner claim returns project image data and Docker execution no longer depends on `MYSTRA_RUNNER_IMAGE`.
- **SC-005**: `pnpm --filter @mystra/shared test` passes after schema changes.
- **SC-006**: `pnpm --filter @mystra/control-plane test` passes provider and route tests.
- **SC-007**: `pnpm --filter @mystra/control-plane typecheck` and `pnpm --filter @mystra/runner-daemon typecheck` pass.
- **SC-008**: `pnpm job:submit --project <slug> ...` can submit a job after a Project exists.
- **SC-009**: Docs and Spec-Kit artifacts no longer reference `castrel-job` as the primary submit command.
