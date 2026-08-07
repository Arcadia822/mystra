# Feature Specification: Product Surface Positioning

**Feature Branch**: `021-product-surface-positioning`  
**Created**: 2026-05-18  
**Status**: Superseded; retained for historical context
**Supersession Notice (2026-08-06)**: This document is no longer the current Mystra object model. Its `Task -> Run`, `Workflow`, `Artifact`, `Review`, and `Runner Node` ownership model was superseded by later decisions. `040-prisma-rdb` currently persists Task but excludes Session and Runner persistence; both require later redesign. Workflow orchestration is removed; Task Activity and Artifact remain deferred. The Team-versus-workspace rationale remains historical background, but this Spec MUST NOT be used as an authoritative entity inventory, ER model, API contract, or implementation input.
**Dependency Note**: This feature amends product terminology and information architecture expectations that currently conflict with the durable 5xP wording around `workspace`. It does not add new MVP runtime capabilities; it clarifies the product contract future specs and docs must follow.  
**Input**: User description: "整理 issue 9 的产品对象、对象从属、术语边界与页面功能，用程序化语言写清 Team / Project / Task / Run / Workflow / Workspace / Sandbox / Agent / Context Bundle / Artifact / Review / Runner Node 的职责、关系与约束"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Operators Can Read One Stable Object Model (Priority: P1)

As a platform operator or future contributor, I want one authoritative object model for Mystra's product surface, so that I can tell which object owns which responsibility without inferring it from scattered docs.

**Why this priority**: If the ownership model is ambiguous, every later spec, API contract, control-plane screen, and review artifact inherits the ambiguity.

**Independent Test**: Read the spec alone and verify that a reviewer can explain the role, parent object, child objects, and boundary of Team, Project, Task, Run, Workflow, Workspace, Sandbox, Agent, Context Bundle, Artifact, Review, and Runner Node without consulting chat history.

**Acceptance Scenarios**:

1. **Given** a reviewer opens the product-surface specification, **When** they inspect the object definitions, **Then** each object has a stated purpose, owner or parent, and relationship to adjacent objects.
2. **Given** the reviewer compares lifecycle objects with runtime objects, **When** they inspect the definitions, **Then** Task and Run remain lifecycle objects while Workspace and Sandbox remain runtime-delivery objects.

---

### User Story 2 - Team And Workspace Mean Different Things Everywhere (Priority: P1)

As a documentation author, API designer, or UI designer, I want `Team` and `workspace` to have non-overlapping meanings, so that tenancy and runtime working-directory concepts do not collapse into the same word.

**Why this priority**: The current collision between tenancy and runtime terminology makes page naming, requirements writing, and future contract design unreliable.

**Independent Test**: Review the terminology rules and confirm that `Team` is the tenancy and ownership object while `workspace` is reserved for the run-scoped working directory and mounted execution context.

**Acceptance Scenarios**:

1. **Given** a product artifact describes who owns projects and policies, **When** it names that object, **Then** it uses `Team` rather than `workspace`.
2. **Given** a product artifact describes the files, mounts, prompts, and injected context visible during execution, **When** it names that object, **Then** it uses `workspace` rather than `Team`.

---

### User Story 3 - External Agent Can Submit Text-Backed Work Without Ambiguity (Priority: P1)

As an external coordinating agent, I want to submit a plain-text work request, so that Mystra can create a durable Task and Run without requiring issue-system integration in the MVP intake path.

**Why this priority**: This is the smallest useful agent-first MVP intake path. If the object model cannot represent submitted text as first-class Task input, the platform can queue work but still cannot explain exactly what request a given run executed.

**Independent Test**: Submit a work request through the management API or MCP with project selection and plain-text requirement content; then inspect the resulting Task and Run and verify the submitted text remains attributable and is available as execution input.

**Acceptance Scenarios**:

1. **Given** an external agent submits work with plain-text requirement content, **When** Mystra accepts intake, **Then** the Task stores that text separately from the submission surface used to call Mystra.
2. **Given** the Task later produces a Run and execution workspace, **When** execution begins, **Then** the submitted text can be materialized as workflow or agent input without needing any upstream issue lookup.
3. **Given** the caller later submits revised text as a new request, **When** the operator inspects the old and new Tasks or Runs, **Then** each one remains attributable to the exact text that was submitted for that request.

---

### User Story 4 - Control-Plane Pages Map Cleanly To Product Objects (Priority: P2)

As a control-plane designer or operator, I want each management page to map to a primary product object and capability, so that the UI can observe and control the system without inventing a second incompatible model.

**Why this priority**: The UI should reflect the product contract rather than improvising new nouns when the underlying model is already unclear.

**Independent Test**: Inspect the page inventory and confirm each page has a defined purpose, primary object, and supported operator question or action.

**Acceptance Scenarios**:

1. **Given** the page list for the management surface, **When** a reviewer inspects it, **Then** each page can be traced back to one or more defined product objects.
2. **Given** a run-detail or review page, **When** a reviewer reads the description, **Then** the page distinguishes Task, Run, Workflow, Workspace, and Sandbox instead of flattening them into one execution blob.

---

### Edge Cases

- What happens when older docs still use `workspace` as a tenancy synonym? The spec must classify those usages as legacy wording to be corrected rather than a valid parallel term.
- What happens when a Task exists before any execution environment is prepared? The object model must allow Task and Run lifecycle state to exist before a Workspace or Sandbox is materialized.
- What happens when a Run finishes without producing a review artifact or requiring human review? Artifact and Review must remain optional downstream objects rather than mandatory parents of Run.
- What happens when a Team has no active Projects or a Project has no active Tasks? Parent-child ownership must still remain valid without implying that empty parents disappear.
- What happens when the caller submits ambiguous or incomplete plain text? The platform should still preserve the exact submitted text rather than silently rewriting the request.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system specification MUST define `Team` as the product-layer tenancy and ownership object for projects, defaults, collaboration scope, and shared policy.
- **FR-002**: The system specification MUST define `Project` as the repository and execution-configuration object owned by one Team.
- **FR-003**: The system specification MUST define `Task` as the business request object that targets one Project and expresses requested work and delivery intent.
- **FR-004**: The system specification MUST define `Run` as one execution attempt for one Task and as the primary lifecycle and observability object.
- **FR-005**: The system specification MUST define `Workflow` as the orchestration path a Run follows from intake to terminal outcome, without treating Workflow as the execution environment itself.
- **FR-006**: The system specification MUST define `workspace` as the run-scoped working directory and execution-context delivery surface that may contain repository content, prompts, context artifacts, and step outputs.
- **FR-007**: The system specification MUST define `Sandbox` as the isolated compute environment used during execution and MUST keep it separate from Task and Run lifecycle ownership.
- **FR-008**: The system specification MUST define `Agent` as the execution adapter used inside a Run, separate from the Sandbox and separate from the business request object.
- **FR-009**: The system specification MUST define `Context Bundle` as a reusable context asset that can be attached to execution and materialized through the Workspace.
- **FR-010**: The system specification MUST define `Artifact` as a reviewable or inspectable output attributable to a Run.
- **FR-011**: The system specification MUST define `Review` as the human decision object that may be attached to a Run and its artifacts, rather than as a synonym for Run completion.
- **FR-012**: The system specification MUST define `Runner Node` as the execution-capacity provider that claims eligible Runs, prepares Workspaces, and launches Sandboxes.
- **FR-013**: The specification MUST express object ownership using an unambiguous parent-child model equivalent to: Team owns Projects; Project owns Tasks; Task owns Runs; Run may reference Workflow, Workspace, Sandbox, Agent, Context Bundles, Artifacts, and Reviews; Runner Node serves Runs but does not own them.
- **FR-014**: The specification MUST distinguish management-boundary objects (`Team`, `Project`, `Task`, `Run`) from runtime-boundary objects (`Workflow`, `Workspace`, `Sandbox`, `Agent`, `Context Bundle`) and result-boundary objects (`Artifact`, `Review`).
- **FR-015**: The specification MUST state that Mystra management surfaces are prioritized in the order `API -> skill/MCP -> CLI -> UI`, and page descriptions must be consistent with that priority.
- **FR-016**: The specification MUST enumerate the minimum management pages needed for the MVP and map each page to the product objects and operator questions it serves.
- **FR-017**: The MVP page inventory MUST include Overview or Workbench, Teams, Team Detail, Projects, Project Detail or Configuration, Task Submit, Task Queue, Run Detail, Review Queue or Review Detail, Runner Nodes, and MCP or API Explorer.
- **FR-018**: The extended page inventory SHOULD include Context Bundles, Artifacts, Workflow Templates or Blueprints, Sandbox Runtime View, Execution Trace or Timeline, and Audit or History for later phases.
- **FR-019**: The specification MUST explicitly mark caller auth, logs API, retry API, callback URLs, quality-gate fix loops, Kubernetes sandboxes, and other current MVP exclusions as out of scope for this feature.
- **FR-020**: The requirements artifact MUST be detailed enough that future agents can derive naming, documentation, page IA, and contract terminology from the spec without relying on issue comments.
- **FR-021**: The specification MUST define Task intake provenance strongly enough to distinguish the submission surface (`api`, `mcp`, or future surfaces) from the submitted plain-text request content.
- **FR-022**: The MVP object model MUST allow an external agent to create a Task using at minimum a selected Project and a plain-text requirement payload.
- **FR-023**: The specification MUST treat submitted plain-text request content as Task-owned intake data or a Task-linked value object, rather than as Team, Project, or Sandbox state.
- **FR-024**: The object model MUST allow workflow or agent execution to receive the submitted plain-text request as execution input through the Run and Workspace path.
- **FR-025**: Upstream issue-id-based hydration MAY be added later, but it MUST NOT be required for the MVP text-based intake path.

### Key Entities *(include if feature involves data)*

- **Team**: The tenancy and ownership root. Cardinality: one Team owns zero or more Projects. Team carries shared policy, shared defaults, and collaboration scope. Team never means a runtime working directory.
- **Project**: The repository-facing execution configuration object. Cardinality: one Project belongs to one Team and owns zero or more Tasks. Project is the configuration root for repository identity, default agent choice, runtime defaults, workflow defaults, and attached context references.
- **Task**: The requested-work object. Cardinality: one Task belongs to one Project and owns one or more Runs over time. Task describes intent, target branch or delivery direction, the request content being executed, and the intake provenance needed to tie the request back to its submitted plain-text input.
- **Run**: The attempt object and lifecycle truth. Cardinality: one Run belongs to one Task and may reference zero or one Workflow, zero or one Workspace, zero or one Sandbox, zero or one Agent adapter, zero or more Context Bundles, zero or more Artifacts, and zero or more Reviews. Run remains valid before all downstream references exist.
- **Workflow**: The orchestration definition or execution path used by a Run. Workflow controls sequencing, gates, and transitions. It is referenced by Run but does not own the Run.
- **Workspace**: The run-scoped working directory and mount surface exposed to execution. Workspace may contain repository checkout content, prompts, injected context, frozen requirement artifacts, gate outputs, and intermediate files. Workspace belongs to execution for one Run rather than to Team tenancy.
- **Sandbox**: The isolated compute environment used for a Run phase. Sandbox provides execution isolation and resources. Sandbox serves the Run but is not the Run's lifecycle owner.
- **Agent**: The code-execution adapter chosen for a Run, such as a CLI-backed agent integration. Agent is the worker identity inside execution, not the policy owner.
- **Context Bundle**: A reusable context asset that may be attached at Team or Project policy level and materialized into the Workspace for a specific Run.
- **Artifact**: A result object produced by a Run, such as a branch, pull request, frozen requirements packet, summary, or other reviewable output. Artifact never owns the Run that produced it.
- **Review**: A human decision object associated with a Run or its Artifacts. Review records approve, reject, or feedback decisions and may be absent for fully automated terminal paths.
- **Runner Node**: The execution-capacity object that polls for eligible Runs, claims work, prepares runtime prerequisites, and reports capacity and health. Runner Node serves many Runs over time but does not become their ownership parent.
- **TaskRequestText**: A Task-linked value object, or an explicit Task-owned field, containing the plain-text requirement payload submitted at intake time. It is the authoritative MVP request input.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A reviewer can read the resulting specification and correctly identify the parent object, child objects, and boundary of all twelve named product objects without consulting issue comments or chat history.
- **SC-002**: The resulting requirements contain zero ambiguous cases where `workspace` refers to both tenancy and runtime working-directory concepts.
- **SC-003**: The MVP page inventory maps every required page to at least one explicitly defined product object and operator question.
- **SC-004**: Future documentation updates can use the specification as a single terminology source without adding new contradictory tenancy or runtime nouns for the same concept.
- **SC-005**: An external agent can submit a plain-text request, and Mystra's object model can explain where submitted request text, run lifecycle state, and final artifacts each belong.
