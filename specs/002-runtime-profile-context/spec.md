# Feature Specification: Runtime Config Resolution and Context Bundles

**Feature Branch**: `002-runtime-profile-context`
**Created**: 2026-05-09
**Status**: Implemented; closure verified
**Input**: User correction: "A Project may own runtime image configuration, but it should live in a typed runtime config object. This first version does not need legacy top-level image compatibility; Mystra should resolve image and context from Project runtime configuration instead of baking source-owned runtime contents or hard-coding runner access paths."

## User Scenarios & Testing *(mandatory)*

This feature is a low-level platform and contract refactor. The scenarios below
are written as technical scenarios and validation slices rather than
consumer-style user stories.

### Technical Scenario 1 - Define Project Runtime Config (Priority: P1)

A platform operator creates or updates a Project with an explicit runtime configuration object that may include a Docker image, provider family, context bundle references, mounts, ports, caches, and secret references.

**Why this priority**: The Project is the durable configuration owner for repository work. It is reasonable for a Project to specify the runtime image it needs. The problem is not image configuration; the problem is representing it as an ad hoc top-level Project field instead of `Project.runtime.image`.

**Independent Test**: Create a Project with `runtime: { provider: "docker", image: "mystra-castrel-runner:local" }`, retrieve it, and verify runtime fields are validated as a structured object rather than as loose Project-level Docker-only fields.

**Acceptance Scenarios**:

1. **Given** a Project payload includes a valid Docker runtime config, **When** the operator creates the Project, **Then** Mystra persists the config as `Project.runtime`.
2. **Given** a Project payload includes invalid provider, empty image, forbidden mount, or embedded secret value, **When** the operator submits it, **Then** Mystra rejects the Project with a clear validation error.
3. **Given** two Projects use different runtime images, **When** jobs are submitted for each, **Then** Mystra preserves the per-Project runtime distinction without requiring runner-global image configuration.

---

### Technical Scenario 2 - Resolve Runtime From Project Default And Constrained Job Overrides (Priority: P1)

Mystra resolves an effective runtime contract for each run from the Project default runtime plus permitted job-level overrides. The first version supports one default runtime per Project, while the contract leaves room for future named runtime profiles such as `frontend-dev`, `backend-dev`, `docs`, or `test`.

**Why this priority**: Callers need a small stable submission contract. They may usually rely on the Project default runtime, while advanced callers can request an allowed override without mutating the Project. Future Projects may need multiple managed runtime profiles, but MVP execution should prove the default-runtime path before adding profile management.

**Independent Test**: Submit one job using the Project runtime and another with an allowed image/context override; verify each claim receives a resolved runtime contract and the Project itself remains unchanged.

**Acceptance Scenarios**:

1. **Given** a Project has runtime config, **When** a caller submits a job without runtime fields, **Then** Mystra resolves the run from the Project runtime config.
2. **Given** a caller provides an allowed job runtime override, **When** the job is accepted, **Then** Mystra records the resolved runtime snapshot for that run without mutating the Project.
3. **Given** a future caller selects a named runtime profile, **When** profile support is implemented, **Then** Mystra resolves from that Project-managed profile before applying allowed job overrides.
4. **Given** a caller requests an unsupported provider, forbidden mount, disallowed context bundle, embedded secret value, or disallowed override field, **When** the job is submitted, **Then** Mystra rejects the job or fails resolution before agent execution begins.

---

### Technical Scenario 3 - Design API/MCP Runtime Boundaries (Priority: P0)

Mystra exposes a clear API and MCP contract for Project runtime config, future runtime profiles, constrained job overrides, context bundle references, and resolved runtime claims.

**Why this priority**: The runtime model is a service boundary. If API and MCP callers can write loosely shaped runtime data, the control plane will accumulate provider-specific exceptions and chat-history assumptions before the first version is even finished. A charmingly common failure mode.

**Independent Test**: Submit Project and job payloads through HTTP and MCP route tests, verifying that accepted payloads match the shared schemas and invalid top-level image fields, unsafe overrides, malformed runtime fields, or unsupported provider fields are rejected at the boundary.

**Acceptance Scenarios**:

1. **Given** a Project create payload includes `runtime.provider` and `runtime.image`, **When** it is submitted through HTTP or MCP, **Then** the boundary validates the same shared runtime schema used by persistence.
2. **Given** a Project create payload uses top-level `image`, **When** it is submitted through HTTP or MCP, **Then** Mystra rejects it before persistence.
3. **Given** a job submits a runtime override, **When** the Project policy permits that override field, **Then** the boundary accepts the payload and runtime resolution records the final snapshot.
4. **Given** a job submits a runtime override for mounts, secrets, or another MVP-forbidden field, **When** it reaches the API or MCP boundary, **Then** Mystra rejects it with a clear validation or policy error.

---

### Technical Scenario 4 - Provide Context Through Explicit Bundles (Priority: P1)

Mystra provides task containers with explicit context bundles, such as agent skills, frozen execution-facing spec artifacts, issue summaries, repository instructions, or operator-provided task context, without baking concrete context contents into the Mystra source tree.

**Why this priority**: Mystra should manage how context is attached and isolated, but the contents of skills, issue context, and project-specific guidance are runtime inputs or release artifacts. Baking them into the platform repository makes the platform look like a specific project's runtime image.

**Independent Test**: Configure Project runtime with named context bundles, submit a job, and inspect the claim to confirm the runner receives resolved bundle contracts and access policy, including the frozen execution-facing spec created at submission time, rather than hard-coded source-tree paths, prompt fragments, or live collaboration history.

**Acceptance Scenarios**:

1. **Given** Project runtime includes the `agent-skills` context bundle, **When** a run is claimed, **Then** the runner receives a resolved context-bundle contract that identifies what must be made available, under which access mode, and which bundle represents the run's frozen execution-facing spec when applicable.
2. **Given** a job contains task-specific issue context and an approved spec, **When** Mystra prepares the run, **Then** the execution-facing spec is frozen at job submission and attached as an explicit run-scoped artifact instead of being inferred from runner-daemon source text or external chat history.
3. **Given** a required context bundle is missing or cannot be resolved, **When** runtime resolution occurs, **Then** Mystra fails clearly before agent execution begins.

---

### Technical Scenario 5 - Keep Sandbox Providers Replaceable (Priority: P2)

A platform engineer can add or replace a sandbox provider without changing Project or job submission contracts.

**Why this priority**: The current MVP uses a single-machine Docker provider, but the product boundary says stronger sandbox providers remain future replacements. Runtime config should describe intent while each provider translates that intent into its own execution shape.

**Independent Test**: Define a non-Docker provider shape in contracts and verify the same Project/job runtime config envelope can resolve into provider-specific execution details without adding another Project-level image field.

**Acceptance Scenarios**:

1. **Given** Project runtime declares provider `docker`, **When** a compatible runner claims work, **Then** the runner receives Docker-specific execution details derived from the resolved runtime contract.
2. **Given** a runner does not support the resolved provider or required features, **When** it attempts to claim work, **Then** Mystra does not assign that run to the incompatible runner.
3. **Given** a future provider does not use container images, **When** it resolves runtime config, **Then** Project and job contracts remain unchanged.

---

### Technical Scenario 6 - Retire Source-Owned Baseline Runtime Truth (Priority: P2)

A platform operator can keep a baseline runtime image or example builder for local development while preventing source-owned image/context contents from becoming the authoritative per-project runtime contract.

**Why this priority**: A baseline image can help bootstrap local testing, but concrete runtime configuration belongs to Project/job runtime config and release artifacts, not hard-coded runner-daemon prompt text or source-owned bundled context.

**Independent Test**: Build/use the local baseline image by referencing it from Project runtime config and verify job execution uses the resolved runtime contract rather than global env vars or source-owned context assumptions.

**Acceptance Scenarios**:

1. **Given** a baseline runtime builder exists in the repository, **When** documentation describes it, **Then** it is labeled as a local development/template artifact.
2. **Given** a job is submitted for a Project with runtime image config, **When** the run is claimed, **Then** execution uses the resolved runtime contract.
3. **Given** runtime config points to an external runtime artifact, **When** Mystra resolves it, **Then** the artifact reference is treated as configuration, not as source content that must live in the platform repository.

### Edge Cases

- Project runtime config is missing, malformed, or names an unsupported provider.
- Project runtime image is empty for Docker provider.
- Job override tries to replace runtime image when Project policy does not allow overrides.
- Job override selects a named runtime profile before profile management exists.
- Job override tries to change mounts, secrets, cache, or ports before those override surfaces are explicitly allowed.
- Context bundle resolves successfully but the content is unavailable at execution time.
- Collaborative requirements continue changing after job submission.
- Runtime config requests forbidden host resources such as host home or Docker socket.
- Runtime config stores a secret value instead of a secret reference.
- Project payload still uses a top-level `image` field instead of `runtime.image`.
- Baseline local runtime artifacts exist but are stale relative to Project runtime config.
- Exposed preview ports requested by runtime config conflict with runner policy.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Project configuration MUST support a typed default `runtime` object that can include provider family, Docker image, context bundle references, mount policy, exposed port policy, cache policy, secret references, and override policy.
- **FR-002**: Docker image MAY be specified by the user during Project creation as part of `Project.runtime`; it MUST NOT be treated as source-owned runtime content.
- **FR-003**: Job submission MUST resolve an effective runtime from Project runtime config unless the caller provides a permitted job-level override.
- **FR-004**: Mystra MUST reject runtime config or job overrides that reference unsupported providers, invalid images, forbidden mounts, embedded secret values, or disallowed context bundles.
- **FR-005**: Runner claim responses MUST include a resolved runtime contract required for execution, including provider family, environment reference, context bundle contracts, effective mount set, exposed port policy, cache policy, and secret references.
- **FR-006**: Runner daemon MUST obtain the Docker image through the resolved runtime contract, not by independently interpreting an ad hoc top-level Project image field.
- **FR-007**: Mystra MUST keep context bundle contents separate from the Mystra platform source tree unless the bundle is explicitly documented as a local development example.
- **FR-008**: Mystra MUST provide a way to attach job-scoped context, such as issue summaries or task-specific instructions, as explicit context bundles rather than hard-coded runner prompt text.
- **FR-009**: Mystra MUST fail a run clearly before agent execution when a required runtime config, image, context bundle, mount, port, cache, or secret reference cannot be resolved or is not permitted.
- **FR-010**: Runtime policy MUST prevent task containers from receiving forbidden host resources, including host home directories and the host container runtime socket.
- **FR-011**: Secret references MUST remain runtime-injected and MUST NOT be committed, baked into runtime artifacts, or exposed as source-managed context bundle content.
- **FR-012**: Runner compatibility MUST be evaluated against the resolved runtime contract before a run is assigned.
- **FR-013**: Existing baseline runtime image or skills-bundle artifacts in the repository MUST be reclassified as development templates and referenced through runtime config when used.
- **FR-014**: This first version MUST NOT preserve a top-level `Project.image` compatibility field; Docker image belongs under `Project.runtime.image`.
- **FR-015**: Runtime config, context bundle, and resolved runtime contracts MUST be validated through shared service-boundary schemas.
- **FR-016**: Documentation MUST state the ownership boundary between Project runtime config, job runtime overrides, context bundles, sandbox provider translation, and baseline local templates.
- **FR-017**: The first version MUST implement one Project default runtime while preserving a contract path for future Project-managed named runtime profiles.
- **FR-018**: Job runtime override MUST be allowed only for explicit MVP fields, initially provider/image/context bundle references and metadata as permitted by Project policy; mounts, secrets, cache, and ports remain Project-managed until their management model is designed.
- **FR-019**: Runtime mount resolution MUST distinguish system-managed mounts, Project-managed mounts, and runtime/image-declared mounts before producing the effective mount set for a runner.
- **FR-020**: Secret references, including project-specific repository tokens such as GitLab tokens, MUST be modeled as managed Project/runtime inputs rather than hard-coded Mystra system secrets; full secret management can remain outside the MVP execution slice.
- **FR-021**: API and MCP boundaries MUST validate Project runtime config and job runtime override shapes explicitly instead of relying only on downstream persistence parsing.
- **FR-022**: Job submission MUST freeze execution-facing spec context into a run-specific artifact before runner claim or sandbox execution begins.
- **FR-023**: Sandbox agents MUST treat injected execution artifacts, especially the frozen execution-facing spec, as the primary contract and MUST NOT depend on collaborative chat history as live execution truth.
- **FR-024**: Run outputs and review surfaces MUST remain attributable to the frozen execution-facing spec artifact that governed execution.

### Key Entities

- **Project Runtime Config**: Project-owned structured default runtime configuration. It may include a Docker image for the MVP provider and owns default context, mount, port, cache, secret reference, and override policy.
- **Runtime Profile**: Future Project-managed named runtime configuration for different work modes, such as frontend development, backend development, documentation-only work, or testing. MVP stores only the default runtime, but contracts should not block this evolution.
- **Job Runtime Override**: Optional job-level runtime changes permitted by Project policy and captured as part of the run's resolved runtime snapshot. MVP override scope is intentionally narrow.
- **Context Bundle**: Named package of context made available to a run, such as agent skills, a frozen execution-facing spec artifact, issue summaries, repository instructions, operator guidance, or task-specific context. It defines source, access mode, freshness expectations, and failure behavior.
- **Frozen Spec Artifact**: The immutable execution-facing snapshot of approved requirements created when a job is submitted and injected into the run context.
- **Runtime Resolver**: Control-plane logic that combines Project runtime config, job overrides, context bundles, runner compatibility, and policy checks into a resolved runtime contract.
- **Resolved Runtime Contract**: The run-specific, provider-ready contract returned to a compatible runner after Project defaults, job overrides, context bundles, and policy checks are resolved.
- **Execution Contract Reference**: The durable attribution path from a run or review artifact back to the frozen spec artifact that governed execution.
- **Sandbox Provider Capability**: Runner-declared ability to execute a provider family and its required runtime features, such as environment artifact type, mounts, ports, caches, and secret injection modes.

### Assumptions

- The first implementation will preserve the current single-machine Docker provider as the MVP provider while changing the contract so that future providers do not inherit top-level image semantics.
- Project runtime config is operator-managed platform configuration, not arbitrary public caller input.
- Job-level runtime overrides are opt-in and constrained by Project policy.
- Collaborative planning or review surfaces may continue iterating outside Mystra, but an accepted run executes only against the frozen spec artifact created at submission time.
- Future named runtime profiles are expected, but the MVP implements only a default Project runtime.
- Project mount and secret management are required concepts, but full mount and secret management UI/CRUD can be deferred while the first business flow is made executable.
- There is no production compatibility requirement for top-level Project image data because this is the first implementation of the Project runtime contract.
- Baseline local runtime artifacts may remain in the repository only when clearly scoped to local development and not treated as production or per-project truth.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of accepted jobs resolve a runtime contract before runner claim.
- **SC-002**: A Project can specify Docker image as runtime config and the runner obtains it from the resolved runtime contract.
- **SC-003**: At least two Projects can use different runtime images without runner-global image configuration.
- **SC-004**: A required missing image, runtime config, or context bundle fails before agent execution with a clear operator-readable reason.
- **SC-005**: A runner that lacks required provider capabilities is not assigned incompatible work.
- **SC-006**: Existing local baseline runtime artifacts are either reclassified as development templates or referenced only through runtime config.
- **SC-007**: The feature documentation enables a future agent to identify the owner of Project runtime config, job overrides, context bundles, sandbox provider translation, and local-only Castrel image context without relying on chat history.
- **SC-008**: HTTP API and MCP submissions reject top-level `image`, malformed runtime config, and MVP-forbidden override fields before creating executable runs.
- **SC-009**: A submitted run can identify the frozen execution-facing spec artifact created at job submission time.
- **SC-010**: Later changes in collaborative review or planning spaces do not mutate the execution context of an accepted run.
