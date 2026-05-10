# Contract: Runner Desired And Observed State

## Purpose

Define the minimal state boundary between control plane and headless runner.

## Control Plane Responsibilities

- Persist queued jobs and runs.
- Persist cancellation desired state.
- Persist runner sessions and last heartbeat timestamps.
- Accept runner observations for running, cleanup, terminal, and failure states.
- Mark stale runners and active runs from durable timestamps.

## Runner Responsibilities

- Load local config at startup.
- Register with config-derived capabilities and limits.
- Poll/claim eligible work while respecting local concurrency.
- Heartbeat while active.
- Observe cancellation requested state during execution.
- Enforce local execution timeout.
- Stop local execution and cleanup on cancellation or timeout.
- Report observed outcomes.

## State Rules

- Queued cancellation may be terminal immediately.
- Assigned/running cancellation is desired state until the runner observes and
  reports cleanup or until stale marking takes over.
- Timeout is runner-observed unless the runner itself becomes stale first.
- Stale marking does not retry, requeue, or rebalance work in the MVP.
- Older runner observations must not overwrite newer terminal or stale outcomes.

## Implemented API/Provider Shape

```ts
type CancelJobOutcome =
  | { kind: "canceled"; snapshot: JobSnapshot }
  | { kind: "cancellation_requested"; snapshot: JobSnapshot };

type RunnerObservation =
  | { type: "cleanup.started"; reason: "cancel" | "timeout" }
  | { type: "run.canceled"; summary: string }
  | { type: "run.timed_out"; summary: string }
  | { type: "run.cleanup_failed"; summary: string };

type StaleMarkingResult = {
  runnerSessionId: string;
  staleRunIds: string[];
};
```

Control-plane route behavior:

- `POST /api/jobs/:jobId/cancel` returns `kind: "canceled"` for queued work and
  `kind: "cancellation_requested"` for runner-owned work.
- `GET /api/runner/jobs/:runId` is runner-authenticated and returns the current
  snapshot for the assigned runner, including cancellation request metadata.
- `POST /api/runner/jobs/:runId/events` records observations such as
  `cleanup.started` and `run.cleanup_failed`.
- `POST /api/runner/jobs/:runId/result` records terminal runner observations
  using existing terminal states: `succeeded`, `failed`, `canceled`, or
  `timed_out`.
- `markStaleRunners()` marks active work `failed` with `staleReason:
  "runner_stale"` and a `run.stale_marked` event. It does not requeue or
  reassign work.

## Non-Goals

- No public retry API.
- No logs API.
- No callback URLs.
- No automatic cross-runner recovery.
