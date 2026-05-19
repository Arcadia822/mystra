# Research: Coordination Run Summaries

## Decision: Use A Dedicated Shared Compact Summary Contract

**Rationale**: HTTP API, MCP, and CLI all need the same coordinator-facing payload. A shared `CoordinationRunSummary` schema prevents each surface from inventing its own interpretation of run phase, terminal outcome, and links.

**Alternatives considered**:

- Reuse the full `JobSnapshot` contract everywhere: rejected because coordinating agents would still need to parse raw events and workflow node history.
- Let each surface reshape `JobSnapshot` independently: rejected because API/MCP/CLI drift would become likely immediately.

## Decision: Derive Summary From Existing Durable Run State And Structured Events

**Rationale**: Mystra already persists run state, run result, and structured lifecycle events. Compact coordination summaries should be projections over that durable data rather than a new persistence model.

**Alternatives considered**:

- Persist a separate summary table: rejected because it duplicates truth and adds write-path coupling for a read-side feature.
- Depend on stdout/stderr parsing: rejected because logs storage is out of MVP scope and transient logs are not durable truth.

## Decision: Keep Raw Snapshot Surfaces And Add A New Summary Surface

**Rationale**: Coordinators need a simpler surface, but debuggers still need full job inspection. Adding a dedicated summary route/tool keeps the raw snapshot contract intact for diagnostics.

**Alternatives considered**:

- Replace the existing job route/tool with the compact summary: rejected because it would break current diagnostic callers and remove useful detail.
- Add optional query flags to the existing route/tool: rejected because it blurs two different contracts and makes shape guarantees weaker.

## Decision: Standardize A Small Coordination Phase Model

**Rationale**: Coordinators need a stable answer to "where is the run right now?" independent of the full event taxonomy. A compact phase model should sit above raw event types while still being derived from them.

**Alternatives considered**:

- Return only raw run state: rejected because `running` alone does not distinguish waiting for runner, active workflow execution, or delivery/review creation.
- Return raw latest event type only: rejected because event names are too granular and unstable for higher-level coordination messaging.

## Decision: Add A Dedicated CLI Status Command And Reuse It In Polling Paths

**Rationale**: The repository already has `scripts/submit-job.mjs` with ad hoc terminal summarization. A dedicated status command lets shell users query summaries directly and gives `submit-job` a single compact polling surface to reuse.

**Alternatives considered**:

- Keep all CLI behavior inside `submit-job.mjs`: rejected because it couples submission and status inspection too tightly.
- Make CLI call the raw snapshot route forever: rejected because it preserves the same parsing burden the feature is trying to remove.

## Research Notes

- GitNexus-specific planning evidence was not used in this branch because the immediate repository state already provided direct file-level truth for the affected contracts and there was no indexed branch-local spec18 surface to reconcile yet.
- Existing code already exposes durable `RunResult`, `RunEvent`, and workflow snapshots plus a raw MCP `mystra_get_job` tool; spec18 should sit beside these instead of replacing them.
