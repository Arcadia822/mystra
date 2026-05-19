# Data Model: Multi-Project Lanes

## Entities

### ProjectLaneWorkflowHint

- **Purpose**: The project-side workflow intent used to distinguish lanes before a
  run has emitted workflow lifecycle events.
- **Fields**:
  - `provider?`
  - `blueprintName?`
  - `blueprintVersion?`
- **Validation rules**:
  - Optional, because some lanes may still rely on runtime defaults
  - Must not imply first-class workflow-registry ownership that the product does
    not have yet

### LaneInspectionView

- **Purpose**: The current lane configuration returned when inspecting one project
  lane through `GET /api/projects/{slug}`.
- **Fields**:
  - `project identity`
  - `repo`
  - `baseBranch`
  - `defaultAgent`
  - `runtime config`
  - `context bundle refs`
  - `prewarmConfig`
  - `workflow hint?`
  - `metadata`
- **Validation rules**:
  - Must distinguish `mystra` and `skrya` without UI-only lookups
  - Must represent the **current** project-backed lane state, not submission-time
    history

### SubmittedLaneSnapshot

- **Purpose**: The lane configuration frozen at job creation and returned through
  canonical job snapshots.
- **Fields**:
  - `projectId`
  - `projectSlug`
  - `repo`
  - `baseBranch`
  - `defaultAgent`
  - `resolved runtime`
  - `prewarmConfig`
  - `workflow hint?`
  - `selected context bundle refs`
  - `metadata`
  - `submittedAt`
- **Validation rules**:
  - Must remain stable after later project edits
  - Must represent the lane inputs actually chosen for the run
  - Must not silently drift from `run.runtime`

### LaneScopedRun

- **Purpose**: A canonical run snapshot that carries both the current project view
  and the frozen lane snapshot needed for honest historical attribution.
- **Fields**:
  - `job`
  - `run`
  - `events`
  - `workflow?`
  - `project?` (current project-backed view)
  - `lane?` (submitted lane snapshot)
  - `runtime?`
- **Validation rules**:
  - Concurrent `mystra` and `skrya` runs must remain distinguishable through both
    current and frozen views
  - Missing workflow observation must not erase the lane workflow hint

## Relationships

```text
Project row
  -> LaneInspectionView
     -> current lane config

Project row + resolved runtime + workflow hint
  -> SubmittedLaneSnapshot
     -> LaneScopedRun

LaneScopedRun
  -> workflow observation snapshot
  -> terminal result at run.result
```

## State Transitions

### Project-side lane reads

```text
project detail request
  -> current lane config returned
  -> project archived returned with archived state
  -> project missing returns PROJECT_NOT_FOUND
```

### Submission-time lane freezing

```text
job creation
  -> resolve runtime
  -> freeze SubmittedLaneSnapshot
  -> queue run
```

### Later inspection

```text
project edited after submission?
  -> yes
     -> LaneInspectionView changes
     -> SubmittedLaneSnapshot does not
  -> no
     -> both remain aligned
```

## Notes

- `SubmittedLaneSnapshot` is intentionally additive. It does not replace the
  current project-backed view in job snapshots.
- `ProjectLaneWorkflowHint` is a metadata convention for this slice, not a claim
  that workflow config is now first-class project storage.
- The lane contract should reuse the resolved runtime contract verbatim wherever
  possible instead of re-encoding its fields a second time.

