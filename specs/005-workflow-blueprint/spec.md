# Feature Specification: Workflow Blueprint Architecture

**Feature Branch**: `005-workflow-blueprint`
**Created**: 2026-05-14
**Status**: Draft
**Dependency Note**: Initialize from `specs/004-open-agents-framework/contracts/framework-alignment.md`, `contracts/module-inventory.md`, `contracts/provider-seams.md`, and `research.md` divergence records before introducing workflow contracts or replacing `container-task.sh`.
**Input**: The current task lifecycle is hardcoded in `container-task.sh` as a flat bash script. Stripe Minions demonstrates that a blueprint architecture (deterministic + agentic nodes in a DAG) is the correct model for reliable, scalable, auditable agent orchestration. Mystra needs a workflow provider interface with a local workflow adapter that replaces the hardcoded script with structured DAG execution.

## User Scenarios & Testing *(mandatory)*

This is platform core architecture work. Scenarios use named technical actors.

### Technical Scenario 1 - Workflow Orchestrates Task Lifecycle as a DAG (Priority: P1)

A runner operator can define a task lifecycle as a workflow blueprint: a DAG of deterministic nodes (git clone, quality gate, git push, MR/PR create) and agentic nodes (agent execution), and the workflow provider executes them in dependency order with data flowing between nodes.

**Why this priority**: This is the core architectural change. Without it, every lifecycle variation requires editing `container-task.sh`. With it, new blueprints are data, not code.

**Independent Test**: Define a blueprint with 3 nodes (git clone → agent execute → git push), submit a job, and verify the workflow provider executes nodes in order and passes data between them.

**Acceptance Scenarios**:

1. **Given** a blueprint defines a DAG with deterministic and agentic nodes, **When** the workflow provider receives a job, **Then** it executes nodes in topological order respecting dependency edges.
2. **Given** a node produces output data, **When** a downstream node starts, **Then** the upstream output is available as input to the downstream node.
3. **Given** a deterministic node fails, **When** the workflow provider handles the failure, **Then** it marks the run as failed with the failing node identity and error, and does not execute downstream nodes.

---

### Technical Scenario 2 - Local Workflow Adapter Replaces container-task.sh (Priority: P1)

The local workflow adapter implements the same lifecycle that `container-task.sh` currently hardcodes, but as a structured blueprint: git clone → agent execute → quality gate → git push → MR create. The bash script is retired.

**Why this priority**: This proves the blueprint architecture works for the existing MVP lifecycle. It is the migration path, not a parallel system.

**Independent Test**: Submit a job through the control plane, have a runner claim it, and verify the local workflow adapter produces the same observable result (branch pushed, MR created) as `container-task.sh` would have.

**Acceptance Scenarios**:

1. **Given** a job is claimed by a runner using the local workflow adapter, **When** the blueprint completes successfully, **Then** a branch is pushed and a GitLab MR is created, matching the current `container-task.sh` behavior.
2. **Given** the quality gate node fails, **When** the workflow handles the failure, **Then** the run is marked failed with quality gate metadata, and no MR is created.
3. **Given** the agent execution node produces no changes, **When** the workflow detects no diff, **Then** the run is marked failed with a "no changes" error, and no push or MR occurs.

---

### Technical Scenario 3 - Workflow Provider Interface Is Pluggable (Priority: P1)

The workflow provider interface allows different adapters: LocalWorkflowProvider (MVP), VercelWorkflowAdapter, DifyAdapter, etc. The control plane and runner interact with the interface, not the implementation.

**Why this priority**: Constitution principle III requires providers to be replaceable boundaries. The workflow provider is no exception.

**Independent Test**: Register a stub workflow provider that records which nodes it would execute; submit a job; verify the stub is called and the real provider is not.

**Acceptance Scenarios**:

1. **Given** the workflow provider interface is defined, **When** a new adapter implements the interface, **Then** it can be registered at startup and used without changing the control plane or runner.
2. **Given** the local workflow adapter is the default, **When** no workflow provider is configured, **Then** the local adapter is used.

---

### Technical Scenario 4 - Fix Loop Removed, Retry Is Blueprint-Orchestrated (Priority: P1)

The `container-task.sh` fix loop (`MYSTRA_QUALITY_FIX_ATTEMPTS`) is removed. If retry logic is needed, it is expressed as a blueprint DAG node (bounded retry loop) rather than hardcoded in a script. This aligns with the spec boundary: MVP does not include quality-gate fix loops.

**Why this priority**: The current fix loop violates the spec boundary and constitution principle I. Removing it is a spec compliance fix. Future retry is a blueprint concern, not a script concern.

**Independent Test**: Run a job where the quality gate fails; verify the run is marked failed immediately without retry attempts.

**Acceptance Scenarios**:

1. **Given** a quality gate node fails, **When** the workflow handles the failure, **Then** the run is marked failed with no retry attempts.
2. **Given** a future blueprint includes a bounded retry node, **When** the retry node is configured, **Then** it can re-invoke the agent node up to a configured limit before failing. (Post-MVP extension point, not implemented now.)

---

### Technical Scenario 5 - Blueprint Definition Is Data, Not Code (Priority: P2)

Blueprints are defined as structured data (TypeScript/Zod schema or JSON), not as executable scripts. This enables validation, visualization, versioning, and programmatic composition.

**Why this priority**: Data-defined blueprints are what make the architecture scale. Code-defined workflows are just another script.

**Independent Test**: Parse a blueprint definition from JSON, validate it against the Zod schema, and execute it through the workflow provider.

**Acceptance Scenarios**:

1. **Given** a blueprint is defined as a JSON or TypeScript object, **When** it is loaded, **Then** it validates against the blueprint Zod schema.
2. **Given** an invalid blueprint (cyclic DAG, missing node type), **When** it is loaded, **Then** validation fails with a descriptive error.

---

### Edge Cases

- What if a node produces output that a non-adjacent downstream node needs? The DAG must support transitive data flow through intermediate nodes or explicit data bindings.
- What if two agentic nodes need to run in parallel? The DAG must support parallel execution of independent nodes.
- What if the workflow provider crashes mid-execution? Node execution state must be durable enough to resume or explain the partial run.
- What if a blueprint references a node type that the adapter does not support? The adapter must reject the blueprint at load time with a clear error.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The workflow provider interface MUST define methods for loading, validating, and executing blueprints.
- **FR-002**: A blueprint MUST be a DAG of nodes with explicit dependency edges and data bindings.
- **FR-003**: Each node MUST declare its type: deterministic or agentic.
- **FR-004**: The workflow provider MUST execute nodes in topological order.
- **FR-005**: Deterministic nodes MUST produce the same output for the same input (no LLM involvement).
- **FR-006**: Agentic nodes MUST invoke an agent adapter (Codex or Copilot) and produce non-deterministic output.
- **FR-007**: The local workflow adapter MUST implement the current task lifecycle (git clone → agent → quality gate → git push → MR create) as a blueprint.
- **FR-008**: The fix loop in `container-task.sh` MUST be removed; no retry on quality gate failure in MVP.
- **FR-009**: The workflow provider interface MUST be pluggable: LocalWorkflowProvider, future VercelWorkflowAdapter, DifyAdapter, etc.
- **FR-010**: Blueprint definitions MUST be structured data validated by Zod schemas.
- **FR-011**: Node execution failures MUST be captured with node identity, error details, and partial output.
- **FR-012**: The existing runner daemon MUST use the workflow provider instead of invoking `container-task.sh` directly.

### Key Entities

- **WorkflowProvider**: Interface for loading, validating, and executing blueprints.
- **Blueprint**: A named DAG of nodes with dependency edges and data bindings. Defines a task lifecycle.
- **BlueprintNode**: A step in a blueprint. Has a type (deterministic/agentic), a handler reference, input bindings, and output schema.
- **BlueprintEdge**: A dependency between two nodes. Defines execution order and data flow.
- **NodeExecution**: A runtime record of a node's execution: input, output, status, error, timing.
- **LocalWorkflowProvider**: The MVP adapter that executes blueprints on the runner host using Docker containers.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A job submitted through the control plane and claimed by a runner completes the full lifecycle (clone → agent → gate → push → MR) via the workflow provider, producing the same observable result as the current `container-task.sh`.
- **SC-002**: The fix loop is removed; quality gate failure immediately fails the run.
- **SC-003**: A new workflow adapter can be registered and used without modifying the control plane or runner daemon.
- **SC-004**: Blueprint definitions validate against Zod schemas; invalid blueprints are rejected at load time.
- **SC-005**: The `container-task.sh` file is retired or reduced to a thin entrypoint that delegates to the workflow provider.
