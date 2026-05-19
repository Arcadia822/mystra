# Feature Specification: Operator CLI Surface

**Feature Branch**: `017-operator-cli-surface`  
**Created**: 2026-05-15  
**Status**: Draft  
**Dependency Note**: Build after `014-management-api-truth` and in parallel with `024-agent-runtime-sdk` where practical. This feature defines the shell-first operator surface for the Debian-hosted deployment.
**Input**: User description: "Mystra should expose an operator CLI surface for Debian-server workflows so project inspection, run inspection, and result retrieval do not depend on the web UI."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Operator Inspects Projects And Runs From The Debian Shell (Priority: P1)

As a Debian-host operator, I want to inspect projects and runs from the shell, so that routine management does not require opening a browser.

**Why this priority**: The product is supposed to be headless and agent-first. A Debian-host operator must be able to inspect the deployment where it actually lives.

**Independent Test**: From the Debian shell, inspect available projects and recent runs, then confirm the output is sufficient for routine operator understanding.

**Acceptance Scenarios**:

1. **Given** the operator has shell access, **When** they inspect projects from the CLI, **Then** they can identify the available target projects and their core execution facts.
2. **Given** runs exist on the deployment, **When** the operator inspects recent runs from the CLI, **Then** they can distinguish their state and project association without relying on the UI.

---

### User Story 2 - Operator Retrieves Final Results And Failure Context From The Shell (Priority: P1)

As a Debian-host operator, I want to retrieve final summaries and failure context from the CLI, so that I can debug or report outcomes without reading raw container logs.

**Why this priority**: Day-two operations require shell access first. The CLI should be useful even when the UI is unavailable or simply too indirect.

**Independent Test**: From the shell, retrieve the final summary for a completed run and failure context for a failed run, then verify the information is sufficient for operator reporting.

**Acceptance Scenarios**:

1. **Given** a completed run exists, **When** the operator retrieves the result from the CLI, **Then** the returned output includes the core summary and result references needed for operator reporting.
2. **Given** a failed run exists, **When** the operator inspects it from the CLI, **Then** the CLI reports the failure context in a structured operator-readable form.

---

### User Story 3 - Operator Inspects Workflow And Context Facts Needed For Operations (Priority: P2)

As a Debian-host operator, I want to inspect the workflow and context facts attached to a project or run from the CLI, so that I can explain what execution path the system took.

**Why this priority**: A shell surface is only truly useful if it can explain more than "it failed." It must also expose the execution facts most relevant to operations.

**Independent Test**: Use the CLI to inspect a project's execution context and a run's workflow identity, then verify those facts are enough for basic operational reasoning.

**Acceptance Scenarios**:

1. **Given** a project has execution context attached, **When** the operator inspects it from the CLI, **Then** the CLI returns the relevant workflow and context facts.
2. **Given** a run has a known workflow identity, **When** the operator inspects it from the CLI, **Then** the CLI returns that identity along with run state and result facts.

---

### Edge Cases

- What happens when the operator inspects a missing project or run? The CLI should return a structured operator-facing error and a failure outcome.
- What happens when the control plane restarts? The CLI should still be able to retrieve durable project and run state afterward.
- What happens when a result is not yet available? The CLI should distinguish "not ready" from "missing" and "failed."

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide a shell-first operator surface for project inspection, run inspection, and result retrieval on the Debian host.
- **FR-002**: The operator CLI surface MUST derive its core management facts from the canonical management API rather than inventing a separate product truth.
- **FR-003**: The operator CLI surface MUST allow operators to inspect available projects and recent runs without opening the UI.
- **FR-004**: The operator CLI surface MUST allow operators to retrieve final summaries and failure context for completed or failed runs.
- **FR-005**: The operator CLI surface MUST expose the workflow and context facts needed for routine operational reasoning.
- **FR-006**: The operator CLI surface MUST return distinguishable outcomes for missing, unavailable, not-yet-ready, and failed states.

### Key Entities *(include if feature involves data)*

- **OperatorCLI**: The Debian-shell management surface for inspection and retrieval actions.
- **OperatorInspectionView**: The project, run, result, workflow, and context facts exposed through the CLI.
- **OperatorOutcome**: The shell-visible success or failure outcome for one CLI management action.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A Debian-host operator can inspect projects and runs from the shell without opening the UI.
- **SC-002**: A Debian-host operator can retrieve final summaries and failure context for runs from the shell without reading raw container logs.
- **SC-003**: Workflow and context facts needed for routine operations remain inspectable through the CLI.
