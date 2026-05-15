# Feature Specification: Multi-Project Lanes

**Feature Branch**: `015-multi-project-lanes`  
**Created**: 2026-05-15  
**Status**: Draft  
**Dependency Note**: Build after `014-management-api-truth`. Reuse project-backed execution from `001-project-and-sqlite`, runtime contract ownership from `002-runtime-profile-context`, and durable runner behavior from `003-config-first-runner-durability`. This feature defines the Debian-server operating shape where `mystra` and `skrya` run as distinct project lanes on one host.
**Input**: User description: "Mystra should support developing both the Mystra and Skrya projects from one Debian server, with project isolation, distinct runtime/context/workflow inputs, and concurrent runs that do not pollute each other."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Coordinating Agent Targets Distinct Project Lanes On One Host (Priority: P1)

As the coordinating agent, I want `mystra` and `skrya` to behave as distinct project lanes on the same Debian host, so that I can choose one target without accidentally reusing the other project's execution context.

**Why this priority**: This is the direct product use case. The server only becomes useful when both projects can coexist without ambiguity or cross-project drift.

**Independent Test**: Configure both projects on one host, inspect their execution context, and confirm each project exposes distinct repository and execution defaults.

**Acceptance Scenarios**:

1. **Given** the server hosts both `mystra` and `skrya`, **When** the coordinating agent inspects each project lane, **Then** each lane presents its own repository identity and execution defaults.
2. **Given** work is submitted for one project lane, **When** execution begins, **Then** the selected lane's execution context is used instead of borrowing values from the other lane.

---

### User Story 2 - Concurrent Runs Stay Scoped To Their Project Lane (Priority: P1)

As the coordinating agent or operator, I want concurrent runs for `mystra` and `skrya` to remain scoped to their own project lane, so that one project's execution does not contaminate the other's run state, artifacts, or working context.

**Why this priority**: Without concurrency-safe project lanes, one Debian host cannot safely serve both projects.

**Independent Test**: Start work for both projects on the same host, allow them to overlap in time, and confirm their execution records and resulting artifacts remain distinct.

**Acceptance Scenarios**:

1. **Given** both projects have active runs at the same time, **When** run state is inspected, **Then** each run remains associated with the correct project lane and does not collapse into a shared unnamed pool.
2. **Given** both projects produce terminal results, **When** results are retrieved, **Then** each result remains attributable to the correct project lane and its associated repository context.

---

### User Story 3 - Project Lanes Carry Distinct Context, Workflow, And Runtime Inputs (Priority: P2)

As a platform operator, I want each project lane to preserve its own context, workflow identity, and execution-contract inputs, so that Mystra and Skrya can evolve independently on the same host.

**Why this priority**: The difference between one-host convenience and one-host chaos is whether project lanes keep their own execution identity.

**Independent Test**: Compare both project lanes and verify that context, workflow identity, and execution-contract inputs can differ without collapsing into a single shared default.

**Acceptance Scenarios**:

1. **Given** each project lane has different context, workflow identity, or execution inputs, **When** the operator inspects them, **Then** those differences remain visible and attributable per lane.
2. **Given** a run is created for one project lane, **When** the operator later inspects the run, **Then** the run remains linked to the context and execution identity that were selected for that lane at submission time.

---

### Edge Cases

- What happens when two project lanes share the same host but require different execution defaults? The system should preserve both identities rather than silently merging them.
- What happens when one project's run fails while another project's run succeeds at the same time? Their states and results should remain independently explainable.
- What happens when a lane is archived or disabled while another lane stays active? Submissions should continue only for the valid lane.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST support at least two distinct project lanes on one Debian-hosted Mystra deployment.
- **FR-002**: Each project lane MUST preserve its own repository identity and execution defaults.
- **FR-003**: Work submitted to one project lane MUST execute against that lane's selected execution context instead of reusing another lane's defaults.
- **FR-004**: Concurrent runs for multiple project lanes MUST remain attributable to their own lane throughout queued, running, and terminal state.
- **FR-005**: Final results and artifact references MUST remain scoped to the originating project lane.
- **FR-006**: Each project lane MUST expose its own context, workflow identity, and execution-contract inputs for inspection.
- **FR-007**: A project lane becoming invalid, archived, or unavailable MUST NOT block inspection or execution for unrelated valid lanes on the same host.

### Key Entities *(include if feature involves data)*

- **ProjectLane**: A project-specific execution lane such as `mystra` or `skrya`, including its repository identity and execution defaults.
- **LaneExecutionContext**: The context, workflow identity, and execution-contract inputs attached to one project lane.
- **LaneScopedRun**: A run whose state and result remain attributable to one project lane across the full lifecycle.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: `mystra` and `skrya` can both be configured on one Debian server and selected independently for work submission.
- **SC-002**: Concurrent runs for different project lanes remain attributable to the correct lane from submission through final result.
- **SC-003**: Each lane's context, workflow identity, and execution inputs remain inspectable without collapsing into one shared host-level default.
