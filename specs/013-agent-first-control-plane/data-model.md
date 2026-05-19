# Data Model: Agent-First Control Plane

## Entities

### ManagementContract

- **Purpose**: Canonical control-plane contract for project inspection, work
  submission, run observation, and result retrieval.
- **Fields / responsibilities**:
  - Stable action set: list projects, inspect project, submit work, inspect run,
    inspect result
  - Shared success/error envelope vocabulary
  - Mapping to `packages/shared` schemas for project, job, run, runtime, and
    result shapes
- **Validation rules**:
  - Must be machine-readable and typed
  - Must not require UI scraping or free-form CLI parsing
  - Must remain the source of truth for coordinating skills, CLI, MCP, and UI consumers

### ManagedProject

- **Purpose**: Project-level coordination target such as `mystra` or `skrya`.
- **Fields**:
  - `id`
  - `slug`
  - `repo`
  - `baseBranch`
  - `runtime`
  - `context identity`
  - `archive state`
- **Relationships**:
  - Selected by `ManagementContract`
  - Produces lane-scoped runs and results
  - Projects into `ProjectSelectionView` and `ExecutionContextView`

### RunHandle

- **Purpose**: Durable handle returned immediately after work submission.
- **Fields**:
  - `jobId`
  - `initial state`
  - `project identity`
  - `submission timestamps`
- **Validation rules**:
  - Must be stable enough for polling after restart
  - Must always identify the selected project lane

### RunSnapshot

- **Purpose**: Durable inspection view of a submitted run.
- **Fields**:
  - `job`
  - `run`
  - `events`
  - `workflow`
  - `project`
  - `resolved runtime`
- **Relationships**:
  - Derived from existing durable job/run/event/result records
  - Consumed by coordinating skills, CLI, MCP, and coordination summary projections
- **Validation rules**:
  - Must distinguish queued, running, terminal, stale, and blocked/failure cases
  - Must remain available after control-plane restart

### ResultReference

- **Purpose**: Final delivery reference returned at terminal completion.
- **Fields**:
  - `status`
  - `summary`
  - `branch`
  - `review handle / PR or MR URL`
  - `error code/message`
  - `metadata`
- **Relationships**:
  - Derived from `RunSnapshot.run.result`
  - Projected into coordination-friendly terminal summaries
- **Validation rules**:
  - Must explain missing or failed delivery without pretending success
  - Must stay attributable to the originating project lane

### CoordinatingSkillSurface

- **Purpose**: Agent-facing coordinating skill surface built from the management
  contract.
- **Fields / responsibilities**:
  - Structured operations for project-aware submission, status inspection, and
    result follow-up
  - Structured success and error propagation
  - One local reusable surface so skills do not duplicate request packaging
- **Validation rules**:
  - Must not become a competing source of truth
  - Must preserve structured failures from the canonical contract

### OperatorShellSurface

- **Purpose**: Debian shell executable for project/run/result inspection and
  routine operator control.
- **Fields / responsibilities**:
  - Command groups for project listing/inspection
  - Run listing/status inspection
  - Final result/failure retrieval
  - Operator-readable but structured exit outcomes
- **Validation rules**:
  - Must derive from the same management contract as the coordinating skills
  - Must distinguish missing, unavailable, not-ready, and failed states

### CoordinationSummary

- **Purpose**: Stable milestone-friendly summary derived from durable run/result
  state for relay into Lark or similar coordination channels.
- **Fields**:
  - `milestone state`
  - `compact progress summary`
  - `failure or blockage category`
  - `final delivery reference`
- **Relationships**:
  - Derived from `RunSnapshot` and `ResultReference`
  - Consumed by coordinating agents, not owned as separate durable truth
- **Validation rules**:
  - Must remain stable across polling intervals
  - Must stay aligned with the underlying durable run/result data

## Relationships

```text
ManagedProject
  -> ManagementContract.inspectProject()
    -> ProjectSelectionView / ExecutionContextView

ManagedProject + work request
  -> ManagementContract.submitWork()
    -> RunHandle
      -> RunSnapshot
        -> ResultReference
          -> CoordinationSummary

ManagementContract
  -> AgentRuntimeSurface
  -> OperatorShellSurface
  -> MCP adapter
  -> UI consumers
```

## State Transitions

### Run lifecycle

```text
submission accepted
  -> queued
  -> claimed/running
  -> completed
  -> failed
  -> canceled
  -> timed_out
  -> stale
```

### Coordination projection

```text
queued
  -> accepted
running
  -> active milestone
terminal
  -> succeeded summary
  -> failed summary
  -> blocked / stale explanation
```

## Notes

- `013` does not replace the durable `Project`, `Job`, `Run`, or `RunResult`
  owners already established by earlier specs. It defines how those records are
  exposed consistently across management surfaces.
- `CoordinationSummary` is a projection layer, not a new source-of-truth store.
- `AgentRuntimeSurface` and `OperatorShellSurface` are explicit consumers of the
  same canonical contract, which is the key anti-drift rule this feature
  establishes.
