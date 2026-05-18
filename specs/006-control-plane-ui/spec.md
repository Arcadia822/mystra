# Feature Specification: Control Plane UI Optimization

**Feature Branch**: `006-control-plane-ui`
**Created**: 2026-05-14
**Status**: Implemented (prototype scope)
**Dependency Note**: Can proceed mostly in parallel with `004-open-agents-framework`, but should adopt the lifecycle vocabulary and status semantics that 004 pins for tasks, runs, and events.
**Input**: The current control plane UI is a single-page React client component with runner, task, and project display. It needs optimization for layout and design, plus new panels: component health, task detail view, task submission form, MCP connection info, and companion skill discovery.

**Implementation Note**: This feature is now treated as a shipped prototype/operator-workflow slice. Queue filtering and companion-skill discovery UI are intentionally left to follow-on work rather than counted as remaining 006 scope.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Operator Sees Platform Health at a Glance (Priority: P1)

As a platform operator, I want to see the health status of all platform components (control plane, runners, workflow provider, RDB, MCP server) on the dashboard, so that I can quickly identify degraded components without checking logs.

**Why this priority**: Health visibility is the first thing an operator needs. Without it, every investigation starts with "is it up?" which is... inefficient.

**Independent Test**: Open the dashboard; verify each component shows a health indicator (healthy/degraded/down) based on real status.

**Acceptance Scenarios**:

1. **Given** the control plane is running and runners are connected, **When** the operator opens the dashboard, **Then** each component shows a health status indicator with last-check timestamp.
2. **Given** a runner has not sent a heartbeat within the stale window, **When** the dashboard loads, **Then** that runner shows a "degraded" or "stale" health indicator.
3. **Given** the MCP server endpoint is reachable, **When** the dashboard loads, **Then** the MCP component shows "healthy" with the server URL.

---

### User Story 2 - Operator Views and Filters Tasks (Priority: P1)

As a platform operator, I want to view a list of tasks with their status, and drill into a task detail view showing the full lifecycle events, run result, and quality gate outcome, so that I can understand what happened without querying the API directly.

**Why this priority**: Task observability is the primary value of the control plane UI. The current task list exists but needs detail view and filtering.

**Independent Test**: Submit a task, wait for completion, open the task detail view, and verify all lifecycle events and the final result are displayed.

**Acceptance Scenarios**:

1. **Given** tasks exist in various states, **When** the operator views the task list, **Then** tasks are displayed with id, task, status, agent, and timestamps.
2. **Given** the operator wants to find specific tasks, **When** they apply a status filter (e.g., "failed"), **Then** only tasks matching that status are shown.
3. **Given** the operator clicks on a task, **When** the task detail view opens, **Then** it shows the full spec, run state, lifecycle events timeline, quality gate result, and MR/PR link if created.

---

### User Story 3 - Operator Submits a Task from the UI (Priority: P1)

As a platform operator, I want to submit a new task from the control plane UI by selecting a project, entering a prompt, and choosing an agent, so that I can initiate work without using the API or MCP directly.

**Why this priority**: Task submission is the primary action. The current UI has a form but it needs to be prominent and well-designed.

**Independent Test**: Fill in the task submission form with a project, prompt, and agent; submit; verify the task appears in the task list.

**Acceptance Scenarios**:

1. **Given** projects exist in the system, **When** the operator opens the task submission form, **Then** they can select a project from a dropdown, enter a prompt, and choose an agent (codex/copilot).
2. **Given** the form is filled in, **When** the operator submits, **Then** a task is created and appears in the task list with "queued" status.
3. **Given** the form has invalid input (empty prompt, no project), **When** the operator submits, **Then** validation errors are shown and no task is created.

---

### User Story 4 - Developer Sees MCP Connection Info (Priority: P2)

As a developer integrating with Mystra, I want to see the MCP server URL, available tools, and connection instructions on the dashboard, so that I can configure my agent or skill to connect to Mystra remote MCP.

**Why this priority**: MCP is the primary integration path. Connection info lowers the barrier to entry.

**Independent Test**: Open the MCP panel; verify the server URL, tool list, and connection instructions are displayed.

**Acceptance Scenarios**:

1. **Given** the MCP server is configured, **When** the developer opens the MCP info panel, **Then** the server URL, transport type (streamable HTTP), and available tools are displayed.
2. **Given** the developer wants to connect, **When** they view the connection instructions, **Then** they see a copy-ready configuration snippet for common MCP clients.

---

### User Story 5 - Developer Discovers Companion Skills (Priority: P2)

As a developer, I want to see available companion skills that work with Mystra MCP, so that I can install and use them to submit user journeys and implementation requests.

**Why this priority**: Skills are the ergonomic layer on top of MCP. Discovery drives adoption.

**Independent Test**: Open the skills panel; verify available skills are listed with descriptions and installation instructions.

**Acceptance Scenarios**:

1. **Given** companion skills are registered, **When** the developer opens the skills panel, **Then** each skill shows its name, description, and installation command.
2. **Given** no skills are registered, **When** the developer opens the skills panel, **Then** a message explains how to register or find skills.

---

### Edge Cases

- What if the control plane API is unreachable? The UI should show a connection error, not a blank page.
- What if no runners are connected? The health panel should show "No runners" rather than implying the system is healthy.
- What if a task has no events yet? The detail view should show "Pending" or "Queued" rather than an empty timeline.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The dashboard MUST display health status for: control plane API, each connected runner, workflow provider, RDB, and MCP server.
- **FR-002**: Health indicators MUST use real status data (heartbeat age, API reachability, DB connectivity).
- **FR-003**: The task list MUST display task id, status, agent, project, and timestamps.
- **FR-004**: The task list MUST support filtering by status (queued, running, succeeded, failed, canceled, timed_out).
- **FR-005**: Clicking a task MUST open a detail view showing spec, run state, lifecycle events, quality gate result, and MR/PR link.
- **FR-006**: The task submission form MUST allow selecting a project, entering a prompt, choosing an agent, and submitting.
- **FR-007**: The form MUST validate required fields before submission.
- **FR-008**: The MCP info panel MUST display server URL, transport type, and available tools.
- **FR-009**: The MCP info panel MUST provide copy-ready connection configuration snippets.
- **FR-010**: The skills panel MUST list available companion skills with name, description, and installation command.
- **FR-011**: Layout and design MUST be optimized for clarity and usability on the existing single-page structure.

### Key Entities

- **ComponentHealth**: A health status record for a platform component (name, status, lastCheck, details).
- **TaskDetail**: Extended task view with full spec, run, events, and result data.
- **MCPConnectionInfo**: Server URL, transport type, tool list, and configuration snippets.
- **CompanionSkill**: A skill entry with name, description, and installation command.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An operator can assess platform health within 5 seconds of opening the dashboard.
- **SC-002**: An operator can find and inspect any task's full lifecycle from the UI without using the API.
- **SC-003**: An operator can submit a task from the UI and see it appear in the task list.
- **SC-004**: A developer can copy MCP connection configuration from the UI in one click.
- **SC-005**: The UI layout is clean, responsive, and consistent with the existing design language.
