# Feature Specification: MCP Server Development

**Feature Branch**: `007-mcp-server`
**Created**: 2026-05-14
**Status**: Draft
**Dependency Note**: Initialize from `specs/004-open-agents-framework/contracts/framework-alignment.md`, `contracts/module-inventory.md`, and `research.md` divergence records, and treat MCP as a Mystra-owned submission shim over that lifecycle boundary rather than as the framework contract itself.
**Input**: The current MCP server has 9 tools (mystra_create_job, mystra_create_project, mystra_list_projects, mystra_get_project, mystra_get_job, mystra_cancel_job, mystra_list_runners, mystra_create_context_bundle, mystra_list_context_bundles). It needs expansion for real-world agent/skill integration scenarios: workflow interaction, job observation, result retrieval, and health checking.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Agent Submits a User Journey as a Job (Priority: P1)

As an external agent or skill, I want to submit a user journey or implementation request as a Mystra job through MCP, so that Mystra can develop the requested feature on a target GitLab or GitHub project.

**Why this priority**: This is the primary MVP use case. The current `mystra_create_job` tool exists but may need richer input (context bundles, runtime overrides, workflow selection).

**Independent Test**: Call `mystra_create_job` via MCP with a project, prompt, and agent; verify the job is created and queued.

**Acceptance Scenarios**:

1. **Given** a project exists and the MCP client is connected, **When** the client calls `mystra_create_job` with project id, prompt, and agent, **Then** a job is created with "queued" status and the job id is returned.
2. **Given** the client specifies context bundle references, **When** the job is created, **Then** the bundles are resolved into the runtime contract for the runner.
3. **Given** the client specifies a workflow blueprint name, **When** the job is created, **Then** the job is associated with that blueprint.

---

### User Story 2 - Agent Observes Job Progress (Priority: P1)

As an external agent, I want to poll or stream job status and events through MCP, so that I can track progress and react to completion or failure without repeatedly querying the REST API.

**Why this priority**: Agents need observability. Polling the REST API is possible but MCP is the ergonomic path.

**Independent Test**: Create a job, then call `mystra_get_job` repeatedly; verify status transitions from queued → running → succeeded/failed.

**Acceptance Scenarios**:

1. **Given** a job exists, **When** the client calls `mystra_get_job`, **Then** the response includes job spec, run state, latest event, and result if available.
2. **Given** a job has completed, **When** the client calls `mystra_get_job`, **Then** the response includes the final result with MR/PR URL, quality gate outcome, and branch name.

---

### User Story 3 - Agent Checks Platform Health (Priority: P2)

As an external agent, I want to check Mystra platform health through MCP before submitting work, so that I can avoid submitting jobs to a degraded or unavailable platform.

**Why this priority**: Health checking prevents wasted submissions. It is a quality-of-life improvement for agent integrators.

**Independent Test**: Call `mystra_health` via MCP; verify it returns component health status.

**Acceptance Scenarios**:

1. **Given** the platform is healthy, **When** the client calls `mystra_health`, **Then** the response shows all components as healthy.
2. **Given** a runner is stale, **When** the client calls `mystra_health`, **Then** the response shows that runner as degraded.

---

### User Story 4 - Agent Manages Projects and Context (Priority: P2)

As an external agent, I want to create and list projects and context bundles through MCP, so that I can set up the target project configuration before submitting jobs.

**Why this priority**: Project and context management are already implemented. This validates the existing tools and ensures they meet real integration needs.

**Independent Test**: Call `mystra_create_project` and `mystra_create_context_bundle` via MCP; verify the resources are created and listable.

**Acceptance Scenarios**:

1. **Given** the client creates a project with repo, base branch, and runtime config, **When** the project is listed, **Then** it appears with the configured properties.
2. **Given** the client creates a context bundle with prompt content, **When** the bundle is listed, **Then** it appears with its slug and content summary.

---

### Edge Cases

- What if the MCP client sends an invalid tool call? Return a structured MCP error, not a 500.
- What if the control plane is under load? MCP tools should timeout gracefully with a clear message.
- What if a job references a project that does not exist? Return a validation error at job creation time.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The MCP server MUST support `mystra_create_job` with project, prompt, agent, optional context bundles, and optional workflow blueprint name.
- **FR-002**: The MCP server MUST support `mystra_get_job` returning full job state including run result and latest events.
- **FR-003**: The MCP server MUST support `mystra_health` returning component health status.
- **FR-004**: Existing tools (create_project, list_projects, get_project, cancel_job, list_runners, create_context_bundle, list_context_bundles) MUST continue to work.
- **FR-005**: All MCP tool inputs and outputs MUST use Zod-validated schemas.
- **FR-006**: MCP errors MUST be structured and actionable (not raw 500s).

### Key Entities

- **MCPTool**: A named tool with Zod-validated input/output schemas.
- **HealthResponse**: Component health status map returned by `mystra_health`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An external agent can submit, observe, and cancel jobs entirely through MCP without using the REST API.
- **SC-002**: An external agent can check platform health before submitting work.
- **SC-003**: All MCP tools return structured, validated responses.
