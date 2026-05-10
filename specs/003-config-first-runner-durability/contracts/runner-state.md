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

## Candidate API/Provider Changes

These are planning-level contracts, not final implementation names:

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

## Non-Goals

- No public retry API.
- No logs API.
- No callback URLs.
- No automatic cross-runner recovery.
