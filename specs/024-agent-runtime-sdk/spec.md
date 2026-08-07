# Feature Specification: Agent Runtime SDK

**Feature Branch**: `024-agent-runtime-sdk`  
**Created**: 2026-05-15  
**Status**: Cancelled; retained for historical context  
**Deprecation Notice (2026-08-06)**: This entire standalone SDK proposal is cancelled. It MUST NOT be scheduled, implemented, or treated as a current package/API commitment. The canonical management API, local Mystra skills, and thin MCP adapter remain the intended boundary. Task remains current intent terminology, while `040-prisma-rdb` excludes Session persistence pending a separate redesign; do not derive a Session API from `038-task-session-model` or this document.
**Dependency Note**: Build after `014-management-api-truth`. This feature defines the default typed agent runtime layer for OpenClaw and similar coordinators. It should consume the canonical management API rather than creating a competing surface.
**Input**: User description: "Mystra should expose a typed SDK for coordinating agents. The preferred model is skill as policy, API as truth, SDK as the agent runtime surface, and MCP as a thin adapter."
**Cancellation Note**: This feature is no longer planned as a standalone MVP slice. The desired agent-facing behavior is being carried by the management API, local skills, MCP surface, and adjacent runtime integration work, so this spec is preserved only as a record of the superseded direction.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Coordinating Agent Uses A Typed Runtime Surface (Priority: P1)

As the coordinating agent, I want a typed runtime surface for the core Mystra management actions I use frequently, so that I do not have to guess at free-form output or load long tool descriptions into context.

**Why this priority**: This is the main reason to prefer an SDK over raw CLI or verbose MCP descriptions. It makes the Debian-server coordination path practical for OpenClaw.

**Independent Test**: Use the typed agent runtime surface to list projects, inspect a selected project, submit work, observe a run, and retrieve the final result without consulting a UI.

**Acceptance Scenarios**:

1. **Given** the coordinating agent needs to choose a target project, **When** it uses the typed runtime surface, **Then** it receives a typed project listing and typed project details suitable for immediate use.
2. **Given** the coordinating agent submits work, **When** the runtime surface returns, **Then** the returned submission state is typed and sufficient for polling.
3. **Given** the coordinating agent retrieves final results, **When** the runtime surface responds, **Then** result references and summary facts are returned in a typed form instead of free-form shell text.

---

### User Story 2 - Skill Logic Delegates To Runtime Calls Instead Of Re-Explaining The System (Priority: P1)

As a skill author, I want the runtime surface to hold the callable management contract, so that the skill can focus on policy, sequencing, fallback, and output wording rather than embedding large Mystra tool manuals.

**Why this priority**: This keeps the model's context small and aligns with the chosen "skill as policy, runtime as execution" design.

**Independent Test**: Write or review a coordinating skill that depends on the runtime surface; confirm the skill can orchestrate its flow without duplicating the management contract in natural language.

**Acceptance Scenarios**:

1. **Given** a coordinating skill needs to submit work and poll results, **When** it uses the typed runtime surface, **Then** the skill can focus on decision logic instead of parsing ad hoc transport details.
2. **Given** the runtime surface returns an error, **When** the skill handles it, **Then** the error is already structured enough for policy-level fallback and user reporting.

---

### User Story 3 - Agent Integrator Pays Only For The Calls They Need (Priority: P2)

As an agent integrator, I want to use only the management calls relevant to my current task, so that adopting Mystra does not require loading every possible management action into model context up front.

**Why this priority**: This is the token-efficiency and composability benefit that motivated the API truth plus SDK runtime decision.

**Independent Test**: Use the runtime surface for one narrow coordination flow and confirm that only the directly relevant management capabilities are required.

**Acceptance Scenarios**:

1. **Given** the integrator only needs project inspection and run polling, **When** they use the runtime surface, **Then** they are not forced into unrelated management behaviors or bloated tool descriptions.
2. **Given** the integrator later adds more Mystra actions, **When** they extend their usage, **Then** the new calls compose with the same runtime surface instead of requiring a new transport model.

---

### Edge Cases

- What happens when the canonical management API returns a structured failure? The runtime surface should preserve that structure for the skill and agent.
- What happens when the external agent needs only one narrow call? The runtime surface should not require loading unrelated management concepts first.
- What happens when UI behavior diverges from the runtime surface? The runtime surface should stay aligned to the canonical management API rather than inheriting UI-only assumptions.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide a typed agent runtime surface over the canonical Mystra management API.
- **FR-002**: The typed runtime surface MUST support the core coordination actions: project inspection, work submission, run observation, and final result retrieval.
- **FR-003**: The typed runtime surface MUST preserve structured success and error data from the canonical management API.
- **FR-004**: The typed runtime surface MUST allow coordinating skills to use Mystra without embedding long transport-specific manuals in their own prompt text.
- **FR-005**: The typed runtime surface MUST remain aligned with the canonical management API rather than introducing a separate competing product truth.
- **FR-006**: The typed runtime surface MUST support narrow usage where an integrator needs only a subset of the management actions.

### Key Entities *(include if feature involves data)*

- **AgentRuntimeSDK**: The typed runtime surface used by OpenClaw and similar coordinating agents.
- **TypedManagementCall**: A typed operation over the canonical management API, such as listing projects or retrieving a run result.
- **TypedManagementError**: A structured error returned by the runtime surface for skills and agents to interpret.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A coordinating agent can use the typed runtime surface to inspect projects, submit work, observe runs, and retrieve final results without using the UI.
- **SC-002**: A coordinating skill can delegate execution calls to the runtime surface instead of embedding large Mystra transport explanations in its own prompt text.
- **SC-003**: Structured errors and results from the canonical management API remain usable through the typed runtime surface without being flattened into free-form text.
