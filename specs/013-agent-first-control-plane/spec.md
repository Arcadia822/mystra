# Feature Specification: Agent-First Control Plane

**Feature Branch**: `013-agent-first-control-plane`  
**Created**: 2026-05-15  
**Status**: Draft  
**Dependency Note**: Build on `001-project-and-sqlite` for project-backed job execution, `007-mcp-server` for the existing remote submission surface, and `008-mcp-skills` for companion-skill ergonomics. This feature defines the next control-plane contract layer: API as truth, a typed agent runtime surface, and an operator CLI surface for external agents such as OpenClaw.
**Input**: User description: "Prioritize Mystra as an agent-first control plane on a Debian server, where OpenClaw coordinates work over Lark and uses Mystra to develop both the Mystra and Skrya projects. Management capabilities should prioritize API, skill/MCP, and CLI over UI. The preferred interface model is skill as policy, API as truth, SDK as agent runtime, and CLI as operator runtime."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Coordinating Agent Manages Projects Without UI (Priority: P1)

As the coordinating OpenClaw agent on a Debian server, I want to list, inspect, and target the `mystra` and `skrya` projects through a stable management surface, so that I can choose the correct project and start work from Lark without opening the Mystra UI.

**Why this priority**: The project goal is agent-first orchestration. If a coordinating agent cannot manage multiple target projects programmatically, the whole Debian-server workflow stalls before execution even begins.

**Independent Test**: On a Debian-hosted Mystra deployment with both `mystra` and `skrya` configured, an external agent can list projects, inspect the chosen project's execution context, and select the target project without using the UI.

**Acceptance Scenarios**:

1. **Given** a Mystra deployment contains both `mystra` and `skrya` project records, **When** the coordinating agent lists available projects, **Then** it receives enough structured metadata to distinguish the two projects and choose one for work submission.
2. **Given** the coordinating agent selects a project, **When** it requests project details, **Then** it can inspect the project's execution context, including repository identity, default branch, runtime contract inputs, and available attached context.

---

### User Story 2 - Coordinating Agent Submits Work and Tracks Delivery (Priority: P1)

As the coordinating OpenClaw agent, I want to submit work for a selected project and then track queued, running, and terminal state through the same management surfaces, so that I can post progress updates back to Lark and deliver the final branch or PR result without relying on UI-only flows.

**Why this priority**: This is the core operating path for the intended deployment model. If OpenClaw cannot submit work and retrieve status/results end to end, Mystra cannot function as the execution backend for the demo or the real server workflow.

**Independent Test**: Submit a job for either `mystra` or `skrya`, poll status from queued to terminal state, and retrieve the final branch or review artifact summary without using the UI.

**Acceptance Scenarios**:

1. **Given** a project is selected and the coordinating agent submits work, **When** the submission is accepted, **Then** Mystra returns a durable identifier and enough initial state for the agent to begin status polling immediately.
2. **Given** a submitted run is in progress, **When** the coordinating agent requests status, **Then** it receives structured progress data and the latest known execution outcome without scraping logs.
3. **Given** a submitted run has completed, **When** the coordinating agent requests the final result, **Then** it receives a structured summary plus any branch, PR, or review artifact references needed to report back to Lark.

---

### User Story 3 - Agent And Operator Use Clear Management Surface Priorities (Priority: P2)

As a platform operator or future agent integrator, I want Mystra's management capabilities to be exposed in a predictable priority order, so that new capabilities are not trapped behind the UI and agents do not need verbose tool descriptions to perform routine work.

**Why this priority**: This story protects the long-term product direction. Without an explicit hierarchy, Mystra will drift toward UI-first or description-heavy integration surfaces that conflict with the agent-first goal.

**Independent Test**: Review the management actions needed for project inspection, work submission, run observation, and result retrieval; verify each action is available through the canonical programmatic surfaces before or alongside any UI support.

**Acceptance Scenarios**:

1. **Given** a core management capability is considered complete, **When** it is reviewed, **Then** it is available through the canonical programmatic management path and is not UI-only.
2. **Given** an agent integrator needs to use Mystra from a runtime environment, **When** they adopt the default agent-facing surface, **Then** they can use a typed management contract rather than guessing from free-form command output.

---

### User Story 4 - Operators Manage The Same Deployment From The Debian Shell (Priority: P2)

As a Debian server operator, I want the same deployment to be inspectable and controllable from the shell, so that routine operations do not require the web UI and can be scripted or debugged directly on the host.

**Why this priority**: The intended environment is a real server, not a browser-first product. A shell-friendly operator surface keeps Mystra aligned with headless control-plane behavior and makes day-two operations practical.

**Independent Test**: From the Debian shell, inspect projects, list recent runs, fetch the status of a selected run, and retrieve the final summary for a completed run without opening the UI.

**Acceptance Scenarios**:

1. **Given** the operator has shell access to the Debian host, **When** they inspect a project or run from the CLI, **Then** they receive the same core management facts available to the agent-facing surface.
2. **Given** the control plane restarts during or after execution, **When** the operator rechecks the selected run from the shell, **Then** the latest durable state remains visible without relying on transient in-memory data.

---

### Edge Cases

- What happens when the coordinating agent asks for a project that is missing, archived, or ambiguously identified? The management surface should return a structured selection error and avoid starting work on the wrong target.
- What happens when the control plane restarts while OpenClaw is polling a run? The agent should be able to resume polling from durable run state instead of losing the execution trail.
- What happens when one management action is only available in the UI? The feature should be considered incomplete for this control-plane path.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide a canonical programmatic management contract for project inspection, work submission, run observation, and result retrieval.
- **FR-002**: The canonical management contract MUST allow an external coordinating agent to distinguish, inspect, and target at least two configured projects on one Debian-hosted Mystra deployment.
- **FR-003**: The system MUST allow a coordinating agent to submit work for a selected project and receive a durable identifier plus initial execution state.
- **FR-004**: The system MUST allow a coordinating agent to retrieve queued, running, and terminal run state plus final result metadata without scraping UI text or raw logs.
- **FR-005**: The canonical management contract MUST remain the product truth for core management capabilities; no capability in this feature may be considered complete if it is only available through the UI.
- **FR-006**: The system MUST provide a typed agent-facing runtime surface over the canonical management contract so agent runtimes can call Mystra without relying on long free-form tool descriptions.
- **FR-007**: The system MUST provide an operator-facing shell surface for the same core management actions needed in the Debian server workflow.
- **FR-008**: Project, runtime, context, workflow identity, and result state needed for routine coordination MUST be inspectable through the programmatic management surfaces.
- **FR-009**: Run state and final result references for this feature MUST remain durable enough for an external coordinating agent or operator to resume inspection after control-plane restart.
- **FR-010**: Management-surface failures such as missing project, invalid submission, unavailable run, or unavailable result MUST return structured errors that an agent can interpret without manual debugging.
- **FR-011**: New management capabilities introduced under this feature MUST follow the priority order `API -> typed agent runtime surface -> CLI -> UI`.

### Key Entities *(include if feature involves data)*

- **ManagedProject**: A target project such as `mystra` or `skrya`, including the identity and execution context needed for an external agent to select and act on it.
- **ManagementContract**: The canonical programmable contract for project inspection, work submission, run observation, and result retrieval.
- **AgentRuntimeSurface**: The typed agent-facing layer built on top of the management contract for OpenClaw and similar coordinators.
- **OperatorShellSurface**: The command-line operator layer for Debian-host workflows.
- **RunSnapshot**: Durable execution state for a submitted unit of work, including status, latest known progress, and final outcome metadata.
- **ResultReference**: The branch, PR, review artifact, or summary pointer returned to the coordinating agent or operator after execution.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A coordinating agent can choose between at least two configured projects and start work on either one without manual UI interaction.
- **SC-002**: After work submission, a coordinating agent can observe the run through queued, running, and terminal states and retrieve the final result summary without manual log inspection.
- **SC-003**: Core management actions for this feature are available through the canonical programmatic management path before the feature is treated as complete in review.
- **SC-004**: After a control-plane restart, the latest durable state for an active or completed run remains available for external status polling and final-result retrieval.
- **SC-005**: A Debian server operator can inspect projects, runs, and final results from the shell for routine operations without opening the UI.
