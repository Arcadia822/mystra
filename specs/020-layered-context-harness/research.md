# Research: Layered Context Harness

## Decision: Reuse `002-runtime-profile-context` As The Primary Contract Surface

**Rationale**: The existing runtime/context-bundle feature already owns the relevant execution semantics. Adding a second contract file hierarchy for the same handoff would split the source of truth and make future agents reconcile two explanations for one behavior.

**Alternatives considered**:

- Create a new generic docs explainer under `docs/`: rejected because feature-level semantics belong in `specs/<feature>/` and existing architecture docs already cover project-wide rules.
- Keep all clarification only in `020/spec.md`: rejected because the issue is specifically about durable injection semantics that future agents will look for in the established runtime/context contract surfaces.

## Decision: Job Submission Is The Freeze Point

**Rationale**: The core ambiguity is when collaborative intent stops being mutable and starts being execution truth. The clean answer is job submission. It is observable, auditable, and lines up with the existing rule that runtime and workflow inputs must resolve into immutable contracts before execution starts.

**Alternatives considered**:

- Freeze at runner claim time: rejected because it leaves too much room for silent drift between acceptance and execution.
- Freeze at plan approval outside Mystra: rejected because Mystra still needs its own explicit execution handoff moment once work is submitted.

## Decision: Sandbox Agents Consume Artifacts, Not Live Discussion

**Rationale**: Spec-as-Contract only matters if the sandbox can execute from durable artifacts. If the run still depends on chat history, reviewability and reproducibility collapse into "whatever the conversation looked like at the time."

**Alternatives considered**:

- Treat chat history as an implicit fallback: rejected because it creates an undocumented second source of truth.
- Leave context-source semantics to runner implementation details: rejected because the contract matters at the product and review level, not only inside one runner.

## Decision: No GitNexus Deep Dive For This Slice

**Rationale**: This feature does not change code symbols, persistence flows, or runtime behavior. The affected surfaces are documentation and feature specs that already describe the relevant execution flow in plain text. Live-codebase-first reading was enough.

**Alternatives considered**:

- Run GitNexus exploration anyway: rejected because it would not materially improve a documentation-only wording alignment task.

