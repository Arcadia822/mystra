# Feature Specification: Management API Truth

**Feature Branch**: `014-management-api-truth`  
**Created**: 2026-05-15  
**Status**: Draft  
**Dependency Note**: Build after `013-agent-first-control-plane`. Reuse `001-project-and-sqlite` for project-backed execution, `003-config-first-runner-durability` for durable run state, and `007-mcp-server` for the currently exposed remote entrypoints. This feature defines the canonical product truth that all other management surfaces depend on.
**Input**: User description: "Mystra should treat HTTP API as product truth for an agent-first Debian-server control plane. OpenClaw must be able to manage projects, submit work, inspect runs, and retrieve results for Mystra and Skrya without relying on UI-first behavior."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Coordinating Agent Inspects Projects And Execution Context (Priority: P1)

As the coordinating agent, I want to list available projects and inspect the execution context for a selected project, so that I can decide where to submit work without opening the Mystra UI.

**Why this priority**: Project selection is the first action in the Debian-server workflow. If this is not available through the canonical API, all higher-level surfaces inherit the wrong center of gravity.

**Independent Test**: Query the management API from an external client, list the configured `mystra` and `skrya` projects, then inspect one project's execution context and confirm it is sufficient for work selection.

**Acceptance Scenarios**:

1. **Given** the server has at least the `mystra` and `skrya` projects configured, **When** the coordinating agent lists projects, **Then** it receives enough structured information to distinguish and select the correct project.
2. **Given** the coordinating agent inspects a selected project, **When** project details are returned, **Then** they include the execution facts needed for coordination, such as repository identity, default branch, available context, and current execution policy inputs.

---

### User Story 2 - Coordinating Agent Submits Work And Tracks Runs (Priority: P1)

As the coordinating agent, I want to submit work and later query queued, running, and terminal run state through the same API, so that I can manage the full execution lifecycle for Mystra and Skrya from Lark-driven coordination.

**Why this priority**: Submission plus status retrieval is the core value path. Without it, there is no agent-first control plane—only scattered primitives.

**Independent Test**: Submit a unit of work through the management API, poll status until completion, and retrieve the final result metadata without using the UI.

**Acceptance Scenarios**:

1. **Given** the coordinating agent has selected a project, **When** it submits work through the management API, **Then** it receives a durable identifier and enough initial state to begin polling immediately.
2. **Given** a submitted run is in progress, **When** the coordinating agent queries status, **Then** it receives structured run state and the latest known progress summary.
3. **Given** a submitted run has completed, **When** the coordinating agent requests the result, **Then** it receives final summary data and any branch or review artifact references needed for delivery.

---

### User Story 3 - Operator Inspects Workflow, Context, And Results From The Same Contract (Priority: P2)

As a Debian-host operator, I want workflow, context, and result facts to be inspectable from the same canonical contract, so that operational reasoning does not require unrelated UI-only pages or ad hoc log scraping.

**Why this priority**: The management API is supposed to be the product truth. It must expose enough operational context to support operators, SDKs, CLIs, and thin adapters.

**Independent Test**: Use the management API to inspect a project's current execution context and a run's workflow/result state, then confirm those facts are sufficient to explain what happened.

**Acceptance Scenarios**:

1. **Given** a project has associated context and workflow identity, **When** the operator inspects it through the management API, **Then** those facts are returned alongside core project metadata.
2. **Given** a run has reached a terminal state, **When** the operator retrieves the result through the management API, **Then** the returned data explains the outcome without requiring raw log storage.

---

### Edge Cases

- What happens when an external client targets a missing or archived project? The API should return a structured validation error and no work should start.
- What happens when a run is queried after control-plane restart? The latest durable state should still be retrievable.
- What happens when project identity, workflow identity, or result references are incomplete? The API should fail clearly rather than returning ambiguous partial data without explanation.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide a canonical management API that serves as the product truth for project inspection, work submission, run observation, and result retrieval.
- **FR-002**: The canonical management API MUST allow external clients to list and inspect multiple configured projects on one Mystra deployment.
- **FR-003**: The canonical management API MUST allow external clients to submit work for a selected project and receive a durable identifier plus initial execution state.
- **FR-004**: The canonical management API MUST allow external clients to retrieve queued, running, and terminal run state plus final result metadata.
- **FR-005**: The canonical management API MUST expose the workflow, context, and execution facts needed for routine coordination and operator inspection.
- **FR-006**: The canonical management API MUST return structured, machine-readable errors for missing project, invalid submission, unavailable run, and unavailable result conditions.
- **FR-007**: Durable run state and final result references returned by the canonical management API MUST remain retrievable after control-plane restart.
- **FR-008**: Management capabilities covered by this feature MUST not be considered complete if they only exist in the UI and are absent from the canonical management API.
- **FR-009**: Higher-level surfaces such as SDK, CLI, and MCP MUST be able to derive their core management actions from this canonical management API rather than defining a competing product truth.

### Key Entities *(include if feature involves data)*

- **ManagementAPI**: The canonical contract for project inspection, work submission, run observation, and result retrieval.
- **ProjectSelectionView**: The structured project information external clients need in order to choose between target projects.
- **RunObservationView**: The durable run state, progress summary, and final result facts made available to external clients.
- **ExecutionContextView**: The inspectable workflow, context, and execution-policy facts attached to a project or run.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An external client can choose between at least two configured projects and submit work to either one without using the UI.
- **SC-002**: After submission, an external client can observe the run through queued, running, and terminal states through the canonical management API.
- **SC-003**: After completion, the external client can retrieve a final summary and any branch or review artifact reference without manual log inspection.
- **SC-004**: After control-plane restart, the latest durable state for an active or completed run remains retrievable through the canonical management API.
