# Data Model: Management API Truth

## Entities

### ManagementEnvelope

- **Purpose**: Shared outer envelope for canonical management errors.
- **Fields**:
  - `error` for structured failure payloads
- **Validation rules**:
  - Envelope shape must be transport-neutral and reusable by HTTP, MCP,
    coordinating skill, CLI, and any later SDK projections
  - Success responses stay explicit and action-specific, not wrapped in a generic
    `data` box

### ManagementError

- **Purpose**: Shared machine-readable error vocabulary.
- **Fields**:
  - `code`
  - `message`
  - `details?`
- **Validation rules**:
  - `code` must be stable and machine-readable
  - `message` must be human-readable
  - `details` must be structured, optional context

### ProjectSelectionView

- **Purpose**: The minimal project identity returned when listing or inspecting
  projects for work selection.
- **Fields**:
  - `id`
  - `slug`
  - `repo`
  - `baseBranch`
  - `archivedAt`
  - minimum lane-attribution fields
- **Validation rules**:
  - Must distinguish at least `mystra` and `skrya`
  - Must not collapse two project lanes into the same ambiguous selection view

### ExecutionContextView

- **Purpose**: The inspectable execution facts for one selected project.
- **Fields**:
  - `project identity`
  - `repo`
  - `baseBranch`
  - `runtime inputs`
  - `prewarmConfig`
  - `metadata`
  - `trust boundary metadata`
- **Validation rules**:
  - Must include the facts required to decide whether work should be submitted
  - Must not require UI-only lookups
  - Must stay within today's stable project-backed fields in `014`

### CanonicalRunSnapshot

- **Purpose**: One canonical read model for polling and result retrieval.
- **Fields**:
  - `job`
  - `run`
  - `events`
  - `workflow?`
  - `project?`
  - `runtime?`
- **Relationships**:
  - Derived from the current `JobSnapshot`/`RdbProvider` persistence seam
  - Consumed by HTTP, MCP, future coordinating skills, future CLI, and any later SDK
- **Validation rules**:
  - Must expose queued, running, terminal, and stale state clearly
  - Must remain retrievable after control-plane restart
  - Terminal result remains nested at `run.result`

### ResultView

- **Purpose**: Final retrieval view for terminal run outcome.
- **Fields**:
  - `run.result.status`
  - `run.result.summary`
  - `run.result.branch?`
  - `run.result.review reference?`
  - `run.result.error code/message?`
  - `run.result.metadata?`
- **Validation rules**:
  - Must explain no-result, not-ready, and failed cases distinctly
  - Must remain attributable to the selected project lane

### TrustBoundaryPolicy

- **Purpose**: The explicit first-slice safety statement for the canonical API.
- **Fields**:
  - `exposure: "private-ops"`
  - `allowedNetworks`
  - `authStatus: "deferred"`
- **Validation rules**:
  - Must never imply public-safe exposure while caller auth is missing

## Relationships

```text
ProjectSelectionView
  -> ExecutionContextView
    -> Submit work
      -> CanonicalRunSnapshot
        -> ResultView

ManagementEnvelope
  -> ManagementError

Action-specific success payloads
  -> `{ projects }`
  -> `{ project }`
  -> `{ jobs }`
  -> `CanonicalRunSnapshot`
  -> `CancelJobOutcome & { snapshot: CanonicalRunSnapshot }`

TrustBoundaryPolicy
  -> applies to all canonical API actions in this first slice
```

## State Transitions

### Polling lifecycle

```text
submission accepted
  -> queued
  -> running
  -> completed
  -> failed
  -> canceled
  -> timed_out
  -> stale
```

### Retrieval semantics

```text
result request
  -> terminal result available
  -> not ready yet
  -> run missing
  -> result missing/incomplete
```

## Notes

- `CanonicalRunSnapshot` should be a normalization of the existing `JobSnapshot`
  seam, not a parallel persistence object.
- `ExecutionContextView` is intentionally a project-card view in `014`, not a
  promise that workflow/context facts already exist everywhere.
- `TrustBoundaryPolicy` is documentation and contract metadata, not an auth
  system.
- The purpose of this slice is to eliminate envelope and read-model drift before
  downstream surfaces are implemented.
