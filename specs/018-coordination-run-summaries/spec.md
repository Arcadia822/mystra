# Feature Specification: Coordination Run Summaries

**Feature Branch**: `018-coordination-run-summaries`  
**Created**: 2026-05-15  
**Status**: Superseded; retained for historical context
**Supersession Notice (2026-08-06)**: This Spec's `Run`-based object and API contract is superseded. Its proposed compact Session summary is also explicitly deleted by `040-prisma-rdb`; Session persistence itself is deferred for a separate redesign. This document MUST NOT be used to reintroduce a Run resource, Session summary, public event/activity timeline, Session table, or database Artifact entity.
**Dependency Note**: Build after `014-management-api-truth`. This feature defines the coordination-facing summary layer that OpenClaw and similar agents can relay to Lark without depending on raw logs or custom per-run prompt archaeology.
**Input**: User description: "Mystra should provide milestone-friendly run summaries, clear status enums, and failure reasons so a coordinating agent can report progress and outcomes back to Lark."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Coordinating Agent Posts Stable Milestone Updates (Priority: P1)

As the coordinating agent, I want Mystra to expose stable milestone-friendly run state, so that I can post progress updates back to Lark without inventing my own interpretation on every run.

**Why this priority**: Coordination is part of the actual user journey. If the state model is too raw, OpenClaw has to reconstruct meaning from low-level facts every time.

**Independent Test**: Submit work, observe the run during its lifecycle, and confirm the coordinating agent can convert the returned state into the planned milestone updates without reading raw logs.

**Acceptance Scenarios**:

1. **Given** a run has been accepted, **When** the coordinating agent inspects its state, **Then** it can identify a stable milestone that is suitable for reporting.
2. **Given** a run progresses from submission to terminal state, **When** the coordinating agent polls Mystra, **Then** the returned summary remains stable enough to support milestone-style updates rather than ad hoc reinterpretation.

---

### User Story 2 - Coordinating Agent Receives Clear Failure Reasons And Recovery Hints (Priority: P1)

As the coordinating agent, I want failed or blocked work to include clear reason categories and recovery-oriented summary data, so that I can explain what went wrong and decide what to do next.

**Why this priority**: Failure reporting is where rough orchestration systems become unusable. Coordination needs compact, reliable explanation instead of raw stderr fragments.

**Independent Test**: Inspect a failed or blocked run and verify the returned summary identifies what failed and what kind of action is needed next.

**Acceptance Scenarios**:

1. **Given** a run reaches a failed terminal state, **When** the coordinating agent requests the final summary, **Then** the returned data clearly identifies the failure category and the most relevant explanation.
2. **Given** a run is incomplete because some prerequisite is missing, **When** the coordinating agent inspects it, **Then** the returned summary explains the blocking condition rather than presenting an ambiguous failure.

---

### User Story 3 - Coordinating Agent Delivers A Final Lark-Friendly Summary (Priority: P2)

As the coordinating agent, I want a compact final summary and result reference that can be forwarded into Lark, so that the human operator receives the end result in one understandable message.

**Why this priority**: The final result is what closes the coordination loop. The summary needs to be ready for relay, not just technically correct.

**Independent Test**: Complete a run and verify the final summary is compact enough to reuse in an external coordination message while still preserving branch or artifact references.

**Acceptance Scenarios**:

1. **Given** a run completes successfully, **When** the coordinating agent retrieves the final summary, **Then** it receives a compact explanation plus the result reference needed for final delivery.
2. **Given** a run completes unsuccessfully, **When** the coordinating agent retrieves the final summary, **Then** it receives a compact explanation of the failure plus the most relevant next-step hint.

---

### Edge Cases

- What happens when a run changes state rapidly? The summary model should remain stable enough for coordination instead of oscillating between ambiguous meanings.
- What happens when a run has no final artifact? The final summary should explain that clearly rather than returning an empty success-shaped message.
- What happens when the coordinating agent resumes polling after restart? The latest durable summary should still be available.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide stable coordination-friendly run summaries that a coordinating agent can use for milestone-style progress updates.
- **FR-002**: The coordination summary model MUST distinguish meaningful run states needed for external progress reporting.
- **FR-003**: Failed, blocked, or incomplete work MUST return a clear failure or blockage explanation suitable for coordination rather than requiring raw log interpretation.
- **FR-004**: Successful terminal work MUST return a compact final summary plus any branch or artifact reference needed for delivery.
- **FR-005**: Coordination summaries MUST remain retrievable from durable state after control-plane restart.
- **FR-006**: Coordination summaries MUST be usable through the canonical management surfaces rather than being trapped in the UI.

### Key Entities *(include if feature involves data)*

- **CoordinationSummary**: The compact progress or terminal summary used by a coordinating agent.
- **MilestoneState**: A stable coordination-oriented run state suitable for progress updates.
- **FailureReason**: The categorized explanation for failed, blocked, or incomplete work.
- **ResultSummary**: The compact terminal summary plus any delivery reference.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A coordinating agent can post stable milestone-style updates from Mystra run state without parsing raw logs.
- **SC-002**: Failed or blocked work returns a clear coordination-oriented explanation instead of requiring manual debugging to interpret.
- **SC-003**: Successful or failed runs expose a compact final summary that can be relayed to Lark together with the relevant result reference.
