# Data Model: Coordination Run Summaries

## CoordinationRunSummary

Compact read model for one job/run pair used by coordinators and terminal tooling.

| Field | Type | Required | Notes |
|---|---|---:|---|
| `jobId` | string UUID | yes | Stable job identifier |
| `runId` | string UUID | yes | Current/latest run identifier |
| `attempt` | integer | yes | Attempt number for the summarized run |
| `taskId` | string | yes | Caller-visible task identifier |
| `projectSlug` | string | no | Included when the job resolves to a known project slug |
| `runState` | run state enum | yes | Raw persisted run state |
| `phase` | coordination phase enum | yes | Compact phase for polling consumers |
| `headline` | string | yes | Human-readable current or terminal summary |
| `milestone.key` | string enum | yes | Current milestone classification |
| `milestone.label` | string | yes | Human-readable milestone label |
| `milestone.observedAt` | ISO string | yes | Timestamp of the latest relevant milestone |
| `startedAt` | ISO string | no | Present once the run starts |
| `finishedAt` | ISO string | no | Present for terminal runs |
| `updatedAt` | ISO string | yes | Latest summary update time |
| `currentNodeId` | string | no | Included when workflow execution is in progress and a current node is known |
| `terminal.status` | run result status enum | no | Present for terminal runs with result payload |
| `terminal.summary` | string | no | Terminal outcome summary |
| `terminal.errorCode` | string | no | Present when the terminal result includes one |
| `terminal.errorMessage` | string | no | Present when the terminal result includes one |
| `links.branch` | string | no | Branch name or equivalent review branch identifier |
| `links.reviewUrl` | string URL | no | MR/PR URL when available |
| `links.reviewDisplayId` | string | no | Human-readable review identifier when available |
| `links.frontendPreviewUrl` | string URL | no | Preview URL if present in durable metadata |
| `links.backendPreviewUrl` | string URL | no | Preview URL if present in durable metadata |

## CoordinationPhase

Higher-level progress state for coordinators. This is intentionally separate from
raw `runState`, and it must be derived only from existing durable run states and
structured lifecycle events that already exist in the repository.

| Value | Meaning |
|---|---|
| `queued` | Run is still `queued` or `dispatching` and has not been claimed |
| `assigned` | Run has been assigned or is starting, but active workflow execution has not yet been observed |
| `running` | Workflow/container/agent execution is in progress |
| `review_ready` | A durable review artifact event such as `review.created` or `mr.created` has been observed before terminal completion |
| `terminal` | Run reached a terminal state |

Validation:

- `phase` is derived from durable run state plus existing event types, never from UI-only heuristics.
- `review_ready` is valid only when a durable review-creation event exists.
- `terminal` requires a terminal `runState`; it is not itself a persisted run state.

## CoordinationMilestone

The current best single progress marker shown to coordinators.

| Field | Type | Required | Notes |
|---|---|---:|---|
| `key` | string enum | yes | Example: `queued`, `runner_assigned`, `workflow_started`, `review_created`, `terminal` |
| `label` | string | yes | Human-readable label for summaries and CLI output |
| `observedAt` | ISO string | yes | Time the latest relevant event/state was observed |

Validation:

- Only one current milestone is exposed at a time.
- Milestone history is intentionally out of scope for this feature.

## CoordinationLinks

Compact set of identifiers and URLs that help a coordinator hand off the result.

| Field | Type | Required | Notes |
|---|---|---:|---|
| `branch` | string | no | Default to terminal result branch, otherwise job branch |
| `reviewUrl` | string URL | no | PR/MR URL |
| `reviewDisplayId` | string | no | Provider display id such as `#42` when available |
| `frontendPreviewUrl` | string URL | no | Optional preview metadata |
| `backendPreviewUrl` | string URL | no | Optional preview metadata |

Validation:

- `reviewUrl` and `reviewDisplayId` prefer normalized `reviewResult.review.{url,displayId}` when present; legacy `mrUrl` and `mrIid` are compatibility fallbacks only.
- Links are omitted when not present in durable result metadata.
- The model must not synthesize fake review or preview links.

## Relationships

```text
Job 1 ── 1 latest-attempt RunSummary projection
          ├── derived from the latest Run attempt
          ├── derived from latest relevant RunEvent values
          └── may include Project slug and workflow current node
```

## State Notes

- The summary is a derived read model, not a new persisted source of truth.
- `attempt` makes "latest run" explicit instead of assuming one job always has one meaningful run forever.
- Terminal summaries stay explainable from `RunResult` plus existing event records.
- Raw event history remains available through existing diagnostic routes and tools.
