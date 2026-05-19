# Contract: Management API

## Purpose

Freeze the canonical HTTP management actions that all other Mystra management
surfaces must consume or adapt.

## Actions

### `GET /api/projects`

- **Purpose**: List available project lanes for selection
- **Returns**: `{ projects: ProjectSelectionView[] }`
- **Required semantics**:
  - includes enough identity to distinguish `mystra` vs `skrya`
  - supports `includeArchived=true`

### `GET /api/projects/{slug}`

- **Purpose**: Inspect the execution context for one selected project
- **Returns**: `{ project: ExecutionContextView }`
- **Required semantics**:
  - includes repo, base branch, runtime inputs, and other stable project-backed
    fields
  - returns `PROJECT_NOT_FOUND` when missing
  - does not promise richer workflow/context facts than storage currently owns

### `GET /api/jobs`

- **Purpose**: List current jobs through the same canonical management contract
- **Returns**: `{ jobs: CanonicalRunSnapshot[] }`
- **Required semantics**:
  - uses the same error vocabulary and snapshot semantics as single-job reads
  - does not introduce a second list-only shape that drifts from polling

### `POST /api/jobs`

- **Purpose**: Submit work for a selected project
- **Input**: validated job submission payload
- **Returns**: `CanonicalRunSnapshot`
- **Required semantics**:
  - returns durable identifiers and initial state
  - returns structured validation errors, not free-form strings

### `GET /api/jobs/{id}`

- **Purpose**: Poll run state and retrieve terminal result through one canonical
  read model
- **Returns**: `CanonicalRunSnapshot`
- **Required semantics**:
  - stable for polling
  - restart-safe
  - includes terminal result at `run.result` when available
  - does not require follow-up reads to interpret the latest state

### `POST /api/jobs/{id}/cancel`

- **Purpose**: Request cancellation for an active job through the canonical
  management contract
- **Returns**: `CancelJobOutcome & { snapshot: CanonicalRunSnapshot }`
- **Required semantics**:
  - idempotent enough for coordination use
  - uses the same shared error vocabulary as the rest of the management surface

## Ownership Rules

1. These HTTP actions are the product truth.
2. MCP adapts them.
3. Coordinating skills, the CLI, and any later SDK consume them.
4. UI displays them.

Anything else is drift.
