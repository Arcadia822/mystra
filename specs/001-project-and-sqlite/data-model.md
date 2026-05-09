# Data Model: Project Abstraction + SQLite Persistence

## Project

Represents stable configuration for a GitLab/GitHub project.

| Field | Type | Required | Notes |
|---|---|---:|---|
| `id` | string UUID | yes | Internal identifier |
| `name` | string | yes | Human-readable display name |
| `slug` | string | yes | Globally unique URL/CLI identifier |
| `repo` | string | yes | Repository URL or canonical repo identifier |
| `baseBranch` | string | yes | Defaults to `main` |
| `defaultAgent` | `codex` or `copilot` | yes | Job default |
| `image` | string | yes | Runtime image used by runner claim/executor |
| `prewarmConfig` | object | yes | JSON, defaults to `{}` |
| `metadata` | object | yes | JSON, defaults to `{}` |
| `archivedAt` | ISO string or null | no | Null means active |
| `createdAt` | ISO string | yes | Application generated |
| `updatedAt` | ISO string | yes | Application generated |

Validation:

- `slug` is unique.
- `image` is non-empty.
- `defaultAgent` uses shared `agentNameSchema`.
- `prewarmConfig` and `metadata` must serialize to JSON objects.

## Job

Represents a submitted coding task.

| Field | Type | Required | Notes |
|---|---|---:|---|
| `id` | string UUID | yes | Internal identifier |
| `projectId` | string UUID | yes | FK to Project, `ON DELETE SET NULL` in SQL but physical delete is not used |
| `taskId` | string | yes | Caller-provided task identifier |
| `source` | `mcp` or `api` | yes | Caller surface |
| `repo` | string | yes | Resolved snapshot |
| `baseBranch` | string | yes | Resolved snapshot |
| `branchName` | string | yes | Caller-provided branch |
| `agent` | `codex` or `copilot` | yes | Resolved snapshot |
| `prompt` | string | yes | Agent prompt |
| `mergeRequest.title` | string | no | Also used for PR title semantics |
| `mergeRequest.body` | string | no | Also used for PR body semantics |
| `metadata` | object | yes | JSON, defaults to `{}` |
| `createdAt` | ISO string | yes | Application generated |
| `updatedAt` | ISO string | yes | Application generated |

Validation:

- Job creation requires active `projectId`.
- Explicit repo/baseBranch/agent overrides are allowed and stored as snapshots.
- Project mutation after job creation does not change job snapshot.

## Run

Represents an execution attempt for a job.

| Field | Type | Required | Notes |
|---|---|---:|---|
| `id` | string UUID | yes | Internal identifier |
| `jobId` | string UUID | yes | FK to Job |
| `state` | run state enum | yes | Starts as `queued` |
| `attempt` | integer | yes | Defaults to 1 |
| `assignedRunnerSessionId` | string UUID or null | no | Set on claim |
| `startedAt` | ISO string or null | no | Set on execution start |
| `finishedAt` | ISO string or null | no | Set on terminal state |
| `result` | object or null | no | JSON RunResult |
| `failureReason` | string or null | no | Structured error summary |
| `createdAt` | ISO string | yes | Application generated |
| `updatedAt` | ISO string | yes | Application generated |

## RunnerSession

Represents a registered runner daemon.

| Field | Type | Required | Notes |
|---|---|---:|---|
| `id` | string UUID | yes | Internal identifier |
| `runnerName` | string | yes | Runner name |
| `token` | string | yes | MVP stores plaintext token |
| `capabilities` | object | yes | JSON capabilities |
| `maxConcurrency` | integer | yes | Defaults to 1 |
| `activeRunCount` | integer | yes | Claim/completion accounting |
| `lastHeartbeatAt` | ISO string | yes | Heartbeat |
| `createdAt` | ISO string | yes | Application generated |
| `updatedAt` | ISO string | yes | Application generated |

## RunEvent

Append-only structured lifecycle event.

| Field | Type | Required | Notes |
|---|---|---:|---|
| `id` | string UUID | yes | Internal identifier |
| `runId` | string UUID | yes | FK to Run |
| `jobId` | string UUID | yes | FK to Job |
| `type` | string | yes | Event type |
| `severity` | string | yes | Defaults to `info` |
| `data` | object | yes | JSON payload |
| `createdAt` | ISO string | yes | Application generated |

## Artifact

Structured pointer to generated output.

| Field | Type | Required | Notes |
|---|---|---:|---|
| `id` | string UUID | yes | Internal identifier |
| `runId` | string UUID | yes | FK to Run |
| `jobId` | string UUID | yes | FK to Job |
| `kind` | string | yes | Example: `merge_request`, `pull_request`, `branch`, future artifact kinds |
| `name` | string | yes | Display name |
| `uri` | string | yes | URL or artifact URI |
| `metadata` | object | yes | JSON payload |
| `createdAt` | ISO string | yes | Application generated |

## Relationships

```text
Project 1 ── * Job 1 ── * Run
                 │        ├── * RunEvent
                 │        └── * Artifact
                 └── resolved repo/baseBranch/agent snapshot

RunnerSession 1 ── * Run (assignedRunnerSessionId)
```

## State Notes

- Project archive does not mutate historical jobs.
- Runner session restart creates a new token; cleanup is post-MVP.
- Non-terminal runs survive control-plane restart unchanged.
