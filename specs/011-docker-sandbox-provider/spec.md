# Feature Specification: Docker Sandbox Provider

**Feature Branch**: `011-docker-sandbox-provider`
**Created**: 2026-05-14
**Status**: Draft
**Dependency Note**: Initialize from `specs/004-open-agents-framework/contracts/framework-alignment.md`, `contracts/module-inventory.md`, `contracts/provider-seams.md`, and `research.md` divergence records before defining Docker-specific execution semantics.
**Input**: Mystra MVP already depends on Docker task containers as its first `SandboxProvider`, but there is no dedicated feature spec defining the sandbox contract, mount and secret boundaries, preview-port behavior, cleanup rules, or what future providers must preserve. The MVP needs an explicit sandbox-provider spec so workflow, runner, and runtime features stop relying on implicit container-task behavior.

## User Scenarios & Testing *(mandatory)*

This is sandbox-boundary work. The scenarios use named technical actors because
the core users are runner maintainers, sandbox provider implementers, platform
operators, and future agents.

### Technical Scenario 1 - Runner Launches A Task Container From A Resolved Runtime Contract (Priority: P1)

A runner maintainer can ask the sandbox provider to launch a task container from
the resolved runtime contract without reinterpreting project/runtime fields
manually in runner-specific code.

**Why this priority**: The runtime contract only matters if the sandbox
provider owns the execution semantics. Otherwise the provider seam is just a
polite rumor.

**Independent Test**: Submit a job with a resolved runtime contract and verify
the sandbox provider launches a Docker task container using the declared image,
mounts, context bundles, caches, and secret references.

**Acceptance Scenarios**:

1. **Given** a resolved runtime contract with image, mounts, context bundles,
   caches, and secrets, **When** the sandbox provider launches a task
   container, **Then** the container uses those declared runtime inputs without
   the runner independently re-deriving them.
2. **Given** the runtime contract changes for a project, **When** a later job is
   executed, **Then** the sandbox provider applies the new contract without
   changing workflow or agent-adapter behavior.
3. **Given** the requested runtime contract is invalid for the provider,
   **When** the provider receives it, **Then** the failure is explicit and
   explainable before task execution proceeds.

---

### Technical Scenario 2 - Docker Sandbox Preserves Isolation And Secret Hygiene (Priority: P1)

A sandbox provider implementer can run Docker task containers in a way that
preserves the MVP isolation rules: no Docker socket in task containers, no
baked-in credentials, and no accidental host-state dependence beyond explicit
mounts and caches.

**Why this priority**: Sandbox execution is the place where a small shortcut
turns into a security or reliability habit. The MVP needs boring, explicit
container rules, not vibes.

**Independent Test**: Inspect the launched task container and provider contract;
verify the container receives only declared mounts and secrets, does not mount
the host Docker socket, and does not require credentials baked into the image.

**Acceptance Scenarios**:

1. **Given** a task container is launched, **When** its runtime mounts are
   inspected, **Then** the host Docker socket is not present inside the task
   container.
2. **Given** repository or agent credentials are required, **When** the sandbox
   provider injects them, **Then** they are injected through runtime environment
   variables or read-only files rather than through image baking.
3. **Given** cache mounts are unavailable or cold, **When** the provider starts
   the task container, **Then** execution still falls back to the declared cold
   path rather than failing because a cache was missing.

---

### Technical Scenario 3 - Preview Ports And Sandbox Metadata Are Exposed Cleanly (Priority: P2)

A platform operator can understand which preview ports and sandbox metadata were
opened for a task without scraping container internals or relying on ad hoc
logs.

**Why this priority**: Mystra's runner model already cares about preview hosts
and dynamic host ports. That behavior needs to live in the provider contract so
UI, MCP, and result reporting have a stable source of truth.

**Independent Test**: Execute a task that opens a supported preview port and
verify the provider reports the exposed port mapping and relevant sandbox
metadata through a structured result surface.

**Acceptance Scenarios**:

1. **Given** a task opens a supported preview port, **When** the sandbox
   provider exposes it, **Then** the resolved host-port mapping is returned in a
   structured provider result.
2. **Given** no preview port is opened, **When** the task completes, **Then**
   the provider returns an explicit "no exposed ports" outcome rather than
   leaving callers to infer absence from missing fields.

---

### Technical Scenario 4 - Cancellation, Timeout, And Cleanup Are Provider-Owned Outcomes (Priority: P1)

A runner maintainer can rely on the sandbox provider to stop, clean up, and
report task-container outcomes consistently for success, failure, cancellation,
and timeout.

**Why this priority**: Cleanup behavior is part of the product contract. If it
is scattered between shell scripts and runner heuristics, later providers will
be painful to introduce and current failures will be hard to explain.

**Independent Test**: Run tasks that succeed, fail, are canceled, and time out;
verify the provider performs cleanup and returns structured outcome metadata for
each case.

**Acceptance Scenarios**:

1. **Given** a task is canceled while running, **When** the sandbox provider
   handles the cancellation, **Then** the container is stopped and cleanup
   outcome is returned explicitly.
2. **Given** a task exceeds its execution timeout, **When** the provider handles
   the timeout, **Then** the result is reported as timed out with provider-owned
   cleanup behavior rather than as a generic failure.
3. **Given** cleanup itself fails, **When** the provider returns control to
   Mystra, **Then** the cleanup failure is surfaced as structured metadata
   instead of disappearing into transient console output.

---

### Technical Scenario 5 - Future Sandbox Providers Can Replace Docker Without Rewriting Product Contracts (Priority: P2)

A future sandbox provider implementer can introduce stronger isolation or a
managed sandbox backend without forcing workflow, MCP, or agent-adapter specs to
rewrite their product contracts.

**Why this priority**: Docker is the MVP implementation, not the architecture.
The provider seam only matters if a later replacement can actually fit through
it.

**Independent Test**: Review the sandbox contract and show that a stub
non-Docker provider can satisfy it without changing workflow, MCP, or runner
state contracts.

**Acceptance Scenarios**:

1. **Given** a non-Docker sandbox provider is added later, **When** it satisfies
   the same contract, **Then** workflow and runner state surfaces do not require
   redesign just to support the new isolation backend.
2. **Given** Docker-specific operational details exist today, **When** the
   sandbox contract is reviewed, **Then** those details are confined to the
   Docker provider implementation rather than leaking into shared product
   schemas.

### Edge Cases

- What happens when a task requests a mount, secret, or context bundle that the
  Docker provider cannot satisfy?
- How does the provider behave when a preview port is requested but the port is
  already occupied on the host?
- What if the task container exits successfully but cleanup of temporary
  workspace state fails?
- What if the task opens multiple supported preview ports?
- What if the requested image is unavailable on the runner host at launch time?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Mystra MUST define a typed `SandboxProvider` contract for task
  container launch, execution lifecycle, preview-port exposure, and cleanup.
- **FR-002**: The MVP Docker sandbox provider MUST consume the resolved runtime
  contract as the source of truth for image, mounts, context bundles, caches,
  secret references, and exposed ports.
- **FR-003**: Task containers MUST NOT mount the host Docker socket.
- **FR-004**: Secrets required for task execution MUST be injected at runtime as
  environment variables or read-only files, not baked into images.
- **FR-005**: Cache and prewarm surfaces MUST remain performance aids only; the
  provider MUST preserve a cold-execution fallback path when caches are absent
  or invalid.
- **FR-006**: The provider MUST report success, failure, cancellation, timeout,
  exposed preview-port mappings, and cleanup failures as structured outcomes.
- **FR-007**: The Docker provider MUST keep provider-specific implementation
  details localized so future sandbox providers can satisfy the same product
  contract without rewriting workflow, MCP, or agent-adapter specs.
- **FR-008**: Follow-on specs for workflow, runtime, and UI MUST depend on the
  sandbox-provider contract instead of directly assuming container-task or
  runner-local Docker behavior.

### Key Entities

- **SandboxProvider**: The typed contract for launching, observing, and cleaning
  up task execution environments.
- **SandboxSession**: The provider-owned runtime instance for one task
  execution, including lifecycle and cleanup metadata.
- **RuntimeMount**: A declared workspace, cache, context-bundle, or read-only
  file mount passed through the runtime contract.
- **SecretInjectionRef**: A runtime-managed secret input consumed by the active
  sandbox provider.
- **PortExposure**: Structured preview-port metadata returned by the provider.
- **SandboxOutcome**: Structured result surface describing task execution
  outcome plus cleanup and exposure metadata.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A runner maintainer can launch a Docker task container entirely
  from the resolved runtime contract without re-deriving provider behavior in
  runner code.
- **SC-002**: Task containers run without the host Docker socket and without
  requiring baked-in execution secrets.
- **SC-003**: Successful, failed, canceled, and timed-out task executions all
  produce structured sandbox outcomes with explicit cleanup visibility.
- **SC-004**: Preview-port exposure is returned in a structured form that UI,
  MCP, and result-reporting features can consume.
- **SC-005**: A future non-Docker sandbox provider can satisfy the same
  contract without forcing product-contract rewrites outside the provider
  boundary.
