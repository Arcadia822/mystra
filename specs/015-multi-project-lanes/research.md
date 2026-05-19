# Research: Multi-Project Lanes

## Decision 1: Build on the canonical `014` contract, do not fork it

- **Decision**: Extend the existing management contract instead of creating a
  lane-specific route family or a shadow "lane API".
- **Rationale**: `014` already froze the product truth for projects and jobs. The
  missing capability is richer lane attribution, not a missing transport.
- **Alternatives considered**:
  - Add `/api/lanes/*`. Rejected because it would duplicate route ownership
    before the lane shape is even frozen.
  - Push lane truth into MCP or a future SDK. Rejected because both are
    consumers, not owners.

## Decision 2: Distinguish current lane inspection from submission-time lane truth

- **Decision**: Keep project detail reads focused on the **current** lane
  configuration, and add a separate **submitted lane snapshot** for job/run
  inspection.
- **Rationale**: Project edits after submission are a real operating behavior.
  One view cannot honestly represent both "what the project looks like now" and
  "what this job selected when it was created."
- **Alternatives considered**:
  - Reuse only the live `project` view in job snapshots. Rejected because it can
    rewrite history after project edits.
  - Replace the live `project` snapshot with only frozen data. Rejected because
    operators still need a current project-backed view.

## Decision 3: Reuse existing runtime resolution instead of inventing lane runtime storage

- **Decision**: Keep `resolveRuntimeContract()` as the owner of runtime
  combination logic, and project its output into the submitted lane snapshot.
- **Rationale**: Runtime provider/image/context-bundle/mount/cache behavior is
  already centralized and tested. Duplicating it for lanes would create drift.
- **Alternatives considered**:
  - Add a second "lane runtime" object. Rejected because it is duplicate logic.
  - Freeze only project runtime config, not resolved runtime. Rejected because
    runs execute against the resolved contract, not the pre-resolution draft.

## Decision 4: Use `project.metadata.workflow` as the lane workflow hint for now

- **Decision**: Treat `project.metadata.workflow` as the project-side workflow
  selection hint until workflow configuration becomes first-class.
- **Rationale**: The repo already uses `metadata.workflow` as the low-blast-radius
  seam for workflow hints, and workflow execution snapshots already carry actual
  provider/blueprint identity once the run starts.
- **Alternatives considered**:
  - Add dedicated workflow columns to `projects`. Rejected because it widens this
    slice into unfinished workflow configuration work.
  - Ignore project-side workflow identity. Rejected because the spec explicitly
    requires lanes to carry distinct workflow identity for inspection.

## Decision 5: Reuse current runner/project isolation, then harden it with coverage

- **Decision**: Keep the existing project-id and runtime-provider eligibility
  logic as the isolation mechanism for one-host lanes, and add stronger route and
  provider regression tests around it.
- **Rationale**: `claimNextRun()` already makes lane-aware assignment decisions.
  The missing confidence is regression coverage and clearer contract projection.
- **Alternatives considered**:
  - Introduce a dedicated lane scheduler. Rejected because this is not a
    scheduling problem yet.
  - Treat concurrency isolation as "already solved" and skip tests. Rejected
    because that would leave the main user promise unproven.

