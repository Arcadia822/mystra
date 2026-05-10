# Data Model: Config-First Headless Runner Durability

## Runner Config

Operator-managed local config loaded by the runner at startup.

Fields:
- `runnerName`: stable operator-readable runner name.
- `concurrency`: positive integer local max active tasks.
- `pollIntervalSeconds`: positive integer for the runner poll loop.
- `staleAfterSeconds`: positive integer used to decide when a runner has stopped reporting.
- `defaultExecutionTimeoutSeconds`: positive integer applied when no run-specific timeout exists.
- `cancelCheckIntervalSeconds`: positive integer for runner-local cancellation checks.
- `cleanupTimeoutSeconds`: positive integer for container/task cleanup.
- `eligibleProjectIds`: optional list of Project ids the runner may claim.
- `eligibleRuntimeProviders`: optional list of runtime providers the runner may claim.

Validation:
- Numeric values must be positive integers.
- Empty eligibility lists mean "no extra local restriction" only when the
  implementation explicitly chooses that default.
- Config is local startup input, not a hosted management record.

## Runner Session

Durable control-plane record for one runner process registration.

Existing fields:
- `id`
- `token`
- `runnerName`
- `capabilities`
- `maxConcurrency`
- `lastHeartbeatAt`
- `createdAt`
- `updatedAt`

Removed or deprecated correctness field:
- `activeRunCount`: not needed for the MVP durability model. Active work should
  be calculated from durable active runs assigned to the runner whenever claim
  eligibility is checked. If retained temporarily for UI display, it is derived
  data and not a source of truth.

Planned additions or refinements:
- `staleAfterSeconds`
- optional eligibility metadata derived from runner config
- optional observation timestamps for cleanup/stale evaluation if needed

State:
- `online`: recent heartbeat.
- `stale`: no heartbeat within configured stale window.

## Desired Run State

Durable control-plane intent for a run.

Relevant states/intents:
- queued work is available for claim.
- cancellation requested means runner should stop owned execution.
- terminal states remain final once accepted.

Rules:
- Queued cancellation may terminalize immediately because no runner owns cleanup.
- Assigned/running cancellation should be recorded as desired state for runner
  observation, not blindly treated as local cleanup complete.

## Runner Observation

Durable event or state transition reported by the runner.

Observation types:
- claimed
- running
- cleanup started
- cancelled
- timed out
- failed
- completed
- cleanup failed

Rules:
- Observations must come from the runner session that owns the active run.
- Stale runner observations must not overwrite newer terminal/stale outcomes.
- Result observations should be idempotent for duplicate reports.

## Stale Run

Active run associated with a runner session that stopped reporting.

Fields:
- `runId`
- `runnerSessionId`
- stale reason
- stale timestamp

Rules:
- MVP marks stale/failed for operator visibility.
- MVP does not automatically retry, requeue, or rebalance stale runs.

## State Transitions

```text
queued
  -> assigned
  -> starting
  -> running
  -> cleanup_in_progress
  -> canceled | timed_out | failed | succeeded

queued
  -> canceled

assigned | starting | running
  -> cancellation_requested
  -> cleanup_in_progress
  -> canceled | failed

assigned | starting | running | cancellation_requested | cleanup_in_progress
  -> stale | failed
```

Exact enum additions should be minimized during implementation. If existing
states can represent `cancellation_requested` or `cleanup_in_progress` through
events plus current state, prefer the smaller contract and document it.
