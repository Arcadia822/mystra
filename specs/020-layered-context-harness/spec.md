# Feature Specification: Layered Context Harness

**Feature Branch**: `020-layered-context-harness`  
**Created**: 2026-05-17  
**Status**: Draft  
**Dependency Note**: Clarifies the collaboration-to-execution handoff assumed by `002-runtime-profile-context` without introducing a new runtime provider or management surface.  
**Input**: User description: "Layered Context Harness — 补充 Spec-as-Contract 冻结注入语义"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Submit Frozen Spec Into Execution Space (Priority: P1)

As a platform operator or coordinating agent, I want Mystra to freeze the execution-facing spec when a job is submitted, so that execution starts from a stable contract rather than a moving collaborative discussion.

**Why this priority**: Without a clear freeze point, a run can silently drift away from the approved work definition. That breaks reproducibility and makes review arguments rely on chat archaeology.

**Independent Test**: Submit a job from a collaborative workflow, mutate the collaborative workspace afterward, and confirm the accepted run still points to the originally frozen execution-facing spec.

**Acceptance Scenarios**:

1. **Given** a collaborative workspace has produced an approved spec, **When** a job is submitted to Mystra, **Then** the execution-facing context includes a frozen spec snapshot created at submission time.
2. **Given** the collaborative workspace changes after the job is accepted, **When** the in-flight run continues, **Then** the run still uses the originally frozen spec rather than the newer collaborative edits.

---

### User Story 2 - Sandbox Agents Work From Spec Artifacts, Not Chat History (Priority: P1)

As a future Mystra agent running inside the sandbox, I want my task context to come from injected spec artifacts, so that I can execute against an explicit contract instead of depending on external chat history.

**Why this priority**: Spec-as-Contract is only real if the sandbox consumes durable artifacts. If the agent still depends on live conversation context, the contract is ceremonial rather than operational.

**Independent Test**: Inspect the execution input available inside the sandbox and confirm the agent can identify the frozen spec artifact without requiring direct access to collaborative chat history.

**Acceptance Scenarios**:

1. **Given** a run starts inside the sandbox, **When** the agent reads its task context, **Then** the primary requirements source is the injected spec artifact rather than direct chat history from the collaboration space.
2. **Given** collaborative chat history contains additional discussion that never became part of the approved spec, **When** the sandbox agent executes the run, **Then** that extra discussion does not implicitly become execution truth.

---

### User Story 3 - Reviewers Can Explain Which Spec Version Produced The Result (Priority: P2)

As a reviewer, I want Mystra outputs to remain tied to the frozen spec that was actually executed, so that I can decide whether to approve the result or request a new run after requirements change.

**Why this priority**: Review must be able to answer "which contract produced this artifact?" without guessing whether the run followed the latest conversation or an earlier agreement.

**Independent Test**: Compare a produced artifact with the run metadata and confirm the reviewer can identify the frozen execution spec and determine whether a later collaborative revision requires re-submission.

**Acceptance Scenarios**:

1. **Given** a run has produced reviewable artifacts, **When** a reviewer inspects the run context, **Then** they can identify the frozen spec version that governed execution.
2. **Given** the collaborative workspace has a newer approved revision after submission, **When** the reviewer compares it with the completed run, **Then** the system makes it clear that the new revision requires a new job rather than retroactively changing the completed run.

---

### Edge Cases

- What happens when no approved spec can be materialized at submission time? Mystra should fail before agent execution rather than starting with ambiguous context.
- What happens when the collaborative workspace keeps iterating while execution is in progress? The accepted run should remain pinned to its frozen execution-facing spec.
- What happens when an operator wants a newer collaborative revision to take effect? A new job submission should be required instead of mutating the existing run.
- What happens when execution artifacts survive longer than the collaboration thread? The run should still retain enough context to explain the executed contract.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Mystra MUST distinguish the collaborative workspace where requirements are iterated from the execution workspace where approved work is carried out.
- **FR-002**: Job submission MUST define the freeze point for execution-facing spec context.
- **FR-003**: When collaborative context is handed into Mystra execution, the execution workspace MUST receive a frozen spec artifact rather than a live pointer to ongoing collaboration.
- **FR-004**: Changes made in the collaborative workspace after job submission MUST NOT retroactively alter the context of an accepted or running job.
- **FR-005**: Sandbox agents MUST treat the injected spec artifact as the primary execution contract rather than relying on collaborative chat history as the source of truth.
- **FR-006**: Context handoff semantics MUST make clear that collaborative discussion only affects execution after it is incorporated into a newly submitted frozen spec.
- **FR-007**: Mystra MUST fail a run before agent execution when the required frozen spec artifact cannot be created, located, or injected into the execution workspace.
- **FR-008**: Reviewable run outputs MUST remain attributable to the frozen spec artifact that governed execution.
- **FR-009**: The specification MUST describe Context Bundle as the conveyor from collaboration space into execution space, including provenance, freeze timing, and the rule that execution consumes artifacts rather than live discussion.

### Key Entities *(include if feature involves data)*

- **Collaborative Workspace**: The external coordination surface where requirements, plan discussion, approval, and review iterations happen before or after execution.
- **Frozen Spec Artifact**: The execution-facing snapshot of approved requirements created when a job is submitted.
- **Execution Workspace**: The Mystra-controlled runtime context in which workflow nodes and sandboxed agents execute against injected artifacts.
- **Context Bundle Injection**: The handoff mechanism that carries the frozen spec artifact and other approved context from collaboration into execution.
- **Execution Contract Reference**: The durable identity that lets a run or review artifact point back to the exact frozen spec used for execution.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A submitted run can identify the exact frozen spec artifact that was created at job submission time.
- **SC-002**: Post-submission edits in the collaborative workspace do not change the execution context of an accepted run.
- **SC-003**: A sandbox agent can execute from the injected spec artifact without requiring direct access to collaborative chat history.
- **SC-004**: If the frozen spec artifact is unavailable, the run stops before agent execution with an operator-readable reason.
- **SC-005**: A reviewer can determine whether a completed run reflects the frozen submitted spec or whether a newer collaborative revision requires a new job.
