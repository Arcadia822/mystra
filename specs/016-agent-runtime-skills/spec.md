# Feature Specification: Agent Runtime Skills

**Feature Branch**: `016-agent-runtime-skills`  
**Created**: 2026-05-15  
**Status**: Draft  
**Dependency Note**: Build after `014-management-api-truth` and `015-multi-project-lanes`. This feature replaces the earlier SDK-first direction with a skill-first coordinating surface. A shared SDK can be considered later, after the management surface is mature and stable.
**Input**: User description: "先不搞 sdk，搞这么一套 skill 就行。"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Coordinating Agent Submits Work Without Hand-Writing Raw Requests (Priority: P1)

As a coordinating agent, I want one Mystra skill to submit a structured implementation request or user journey, so that I do not hand-write raw request payloads every time I ask Mystra to do work.

**Why this priority**: Submission is the first useful slice. Without it, the rest of the skill surface is just a nicer way to look at information instead of a real execution path.

**Independent Test**: A coordinating agent can submit a valid implementation request or user journey using documented skill inputs only, then receive the created job identifier and immediate execution state without hand-crafting a raw payload.

**Acceptance Scenarios**:

1. **Given** a coordinating agent has the required project, task, branch, and goal context, **When** it calls the submission skill, **Then** Mystra receives a valid structured request and returns the created job identifier plus the current run state.
2. **Given** a coordinating agent wants to submit a user journey with actor, goal, and acceptance criteria, **When** it calls the journey submission skill, **Then** the request is packaged consistently instead of relying on ad hoc prompt text alone.
3. **Given** required inputs are missing or invalid, **When** the coordinating agent calls the submission skill, **Then** the skill surfaces the problem clearly and does not silently send a malformed request.

---

### User Story 2 - Coordinating Agent Checks Job Status Through A Human-Readable Skill (Priority: P1)

As a coordinating agent, I want one Mystra skill to check job status and summarize the result, so that I can track progress and review outcomes without decoding raw protocol responses.

**Why this priority**: Submission without status inspection leaves the core loop unfinished. Agents need both to actually coordinate work.

**Independent Test**: A coordinating agent can retrieve a job's current state through the status skill and get the key identifiers, result summary, and review links in one response.

**Acceptance Scenarios**:

1. **Given** a coordinating agent has a valid job identifier, **When** it calls the status skill, **Then** it receives a short human-readable summary of job state, result status, and follow-up links when present.
2. **Given** the target job is missing, **When** the coordinating agent checks status, **Then** the returned error is surfaced directly instead of being hidden behind a generic failure message.
3. **Given** the status endpoint is unreachable, **When** the coordinating agent checks status, **Then** the skill reports a connection failure clearly and stops.

---

### User Story 3 - Skill Author Uses One Small Skill Surface Instead Of Repeating Mystra Submission Logic (Priority: P2)

As a skill author, I want the first Mystra coordinating flows to live behind a small local skill surface, so that I do not duplicate Mystra request packaging and status decoding in every skill prompt.

**Why this priority**: This is the maintainability payoff of the skill-first direction. It keeps current coordination behavior concentrated in one surface while the underlying API is still evolving.

**Independent Test**: A future skill can reuse the documented submission and status patterns from this feature without inventing a second competing Mystra coordination surface.

**Acceptance Scenarios**:

1. **Given** a maintainer adds another coordinating flow later, **When** they extend the local skill set, **Then** they can follow the same input, validation, and summary conventions established by this feature.
2. **Given** the underlying management surface changes, **When** the maintainer updates the coordinating skills, **Then** the change is localized to the skill layer rather than requiring multiple independently phrased submission patterns to be reconciled.

---

### Edge Cases

- What happens when the coordinating agent omits required submission inputs? The skill must stop before submission and surface the missing field clearly.
- What happens when Mystra returns a structured business failure during submission or status inspection? The skill must preserve the returned meaning instead of flattening it into an opaque error.
- What happens when the transport is unreachable? The skill must report that connection failure clearly and stop instead of pretending the request succeeded.
- What happens when the first-slice skill surface grows too broad? The feature must stay limited to the current coordinating loop rather than turning into a premature general-purpose SDK.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide a local Mystra skill surface for structured work submission by coordinating agents.
- **FR-002**: The submission surface MUST support at least one implementation-request flow and one user-journey flow.
- **FR-003**: The system MUST provide a local Mystra skill surface for job status inspection by job identifier.
- **FR-004**: The skill surface MUST preserve the meaning of returned success and failure data so coordinating agents can act on it without decoding raw protocol payloads themselves.
- **FR-005**: The skill surface MUST keep required inputs, validation rules, and expected outputs documented in one local repository surface.
- **FR-006**: The first slice MUST remain a thin coordinating surface over the current Mystra management truth rather than introducing a second long-term contract layer.

### Key Entities *(include if feature involves data)*

- **Implementation Request Skill**: A structured skill entry point that packages an implementation-oriented Mystra submission from coordinating-agent inputs.
- **User Journey Skill**: A structured skill entry point that packages actor, goal, and acceptance criteria into a Mystra submission.
- **Job Status Skill**: A structured skill entry point that retrieves and summarizes the state of a previously submitted Mystra job.
- **Submission Summary**: The immediate identifiers and execution facts returned after a successful submission.
- **Status Summary**: The human-readable job-state, result, and review-link view returned for follow-up coordination.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of the first-slice coordinating flows covered by this feature, implementation request submission, user journey submission, and job status inspection, can be completed through documented local skills without hand-writing raw request payloads.
- **SC-002**: A coordinating agent can complete the submit-plus-check-status loop for a Mystra job without using the UI and without consulting raw transport documentation.
- **SC-003**: For each first-slice flow, success and failure outcomes remain specific enough that a coordinating agent can distinguish created-job, missing-input, missing-job, and connection-failure cases.
- **SC-004**: Future local skills can reuse the documented conventions from this feature instead of introducing a second competing Mystra coordination surface for the same flows.
