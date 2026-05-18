# Feature Specification: MCP Companion Skills

**Feature Branch**: `008-mcp-skills`
**Created**: 2026-05-14
**Status**: Implemented
**Dependency Note**: Initialize after `specs/004-open-agents-framework/contracts/framework-alignment.md`, `contracts/module-inventory.md`, and `research.md` pin the lifecycle semantics, and after `007-mcp-server` defines the MCP tool shapes those skills wrap.
**Input**: Mystra remote MCP is the primary submission path for other agents and skills. Companion skills provide ergonomic, domain-specific interfaces on top of the raw MCP tools, enabling agents to submit user journeys, implementation requests, and feature work without understanding the low-level MCP protocol.

**Implementation Note**: The current implementation ships repo-local companion skills under `.agents/skills/` for user-journey submission, implementation-request submission, and job-status lookup, and now also exposes them as a local Codex-installable plugin under `plugins/mystra/` with marketplace registration in `.agents/plugins/marketplace.json`.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Agent Submits a User Journey Through a Skill (Priority: P1)

As an AI agent working on a product, I want to invoke a companion skill that packages a user journey (actor, goal, acceptance criteria) into a Mystra job, so that Mystra can implement the journey on a target project without me manually constructing the MCP job payload.

**Why this priority**: This is the ergonomic layer that makes Mystra MCP usable by other agents. Raw MCP tools are powerful but verbose; skills provide intent-level interfaces.

**Independent Test**: Invoke the "submit user journey" skill with a project, actor, goal, and acceptance criteria; verify a Mystra job is created with the journey encoded in the prompt.

**Acceptance Scenarios**:

1. **Given** a companion skill for user journey submission is installed, **When** an agent invokes it with project, actor, goal, and acceptance criteria, **Then** a Mystra job is created with a structured prompt that encodes the journey.
2. **Given** the skill accepts optional context (existing spec references, design decisions), **When** context is provided, **Then** it is included in the job prompt or as context bundle references.

---

### User Story 2 - Agent Submits an Implementation Request Through a Skill (Priority: P1)

As an AI agent that has completed a spec or plan, I want to invoke a companion skill that submits an implementation request to Mystra, so that Mystra can execute the implementation on a target project with the right agent and runtime configuration.

**Why this priority**: Implementation requests are the second primary workflow after user journeys. They carry richer context (spec, plan, task references).

**Independent Test**: Invoke the "submit implementation" skill with a project, spec reference, and task scope; verify a Mystra job is created with the implementation context.

**Acceptance Scenarios**:

1. **Given** a companion skill for implementation submission is installed, **When** an agent invokes it with project, spec reference, and task scope, **Then** a Mystra job is created with a prompt that includes the spec and task context.
2. **Given** the skill accepts a workflow blueprint name, **When** specified, **Then** the job is associated with that blueprint.

---

### User Story 3 - Agent Checks Job Status Through a Skill (Priority: P2)

As an AI agent, I want to invoke a companion skill that checks the status of a previously submitted job, so that I can track progress and retrieve results without calling raw MCP tools.

**Why this priority**: Status checking is needed but less critical than submission. Agents can fall back to `mystra_get_job` directly.

**Independent Test**: Invoke the "check job" skill with a job id; verify it returns human-readable status and result summary.

**Acceptance Scenarios**:

1. **Given** a job was previously submitted, **When** the agent invokes the "check job" skill, **Then** it returns status, progress summary, and result if available.
2. **Given** the job has completed with an MR/PR, **When** the skill returns the result, **Then** it includes the MR/PR URL for review.

---

### User Story 4 - Skills Are Discoverable and Installable (Priority: P2)

As a developer, I want to discover available companion skills and install them into my agent environment, so that I can use Mystra from my preferred agent framework.

**Why this priority**: Discovery drives adoption. Skills that cannot be found cannot be used.

**Independent Test**: List available skills; install one; invoke it.

**Acceptance Scenarios**:

1. **Given** companion skills are published, **When** a developer lists available skills, **Then** each skill shows name, description, and installation command.
2. **Given** a skill is installed, **When** the agent invokes it, **Then** it connects to Mystra MCP and executes the workflow.

---

### Edge Cases

- What if Mystra MCP is unreachable when a skill is invoked? The skill should return a clear connection error, not hang.
- What if a skill receives invalid input? It should validate and return a structured error before calling MCP.
- What if multiple agents submit jobs simultaneously? Skills must not serialize submissions; each invocation is independent.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: A "submit user journey" skill MUST accept project, actor, goal, acceptance criteria, and optional context, and create a Mystra job.
- **FR-002**: A "submit implementation" skill MUST accept project, spec reference, task scope, and optional workflow name, and create a Mystra job.
- **FR-003**: A "check job" skill MUST accept a job id and return status, progress, and result.
- **FR-004**: All skills MUST validate input before calling MCP.
- **FR-005**: All skills MUST handle MCP connection errors gracefully with clear messages.
- **FR-006**: Skills MUST be discoverable through a registry or manifest.
- **FR-007**: Skills MUST be installable into common agent environments (Copilot, Codex, Claude).

### Key Entities

- **CompanionSkill**: A named skill with input schema, MCP tool mapping, and installation metadata.
- **SkillRegistry**: A manifest or directory of available companion skills.
- **UserJourneySubmission**: Input for the user journey skill (project, actor, goal, acceptance criteria, context).
- **ImplementationSubmission**: Input for the implementation skill (project, spec reference, task scope, workflow).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An agent can submit a user journey through a skill without understanding the MCP protocol.
- **SC-002**: An agent can submit an implementation request through a skill with spec and task context.
- **SC-003**: Skills are installable and discoverable from at least one agent environment.
