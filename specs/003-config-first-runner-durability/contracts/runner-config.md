# Contract: Runner Config

## Purpose

Define the MVP runner-local configuration surface. This is startup config for a
headless runner, not a hosted runner-management API.

## Shape

```ts
type RunnerLocalConfig = {
  runnerName: string;
  concurrency: number;
  pollIntervalSeconds: number;
  staleAfterSeconds: number;
  defaultExecutionTimeoutSeconds: number;
  cancelCheckIntervalSeconds: number;
  cleanupTimeoutSeconds: number;
  eligibleProjectIds?: string[];
  eligibleRuntimeProviders?: Array<"docker" | string>;
};
```

## Rules

- `concurrency` must be a positive integer.
- interval and timeout fields must be positive integers.
- `eligibleProjectIds` limits claim scope when present.
- `eligibleRuntimeProviders` limits runtime provider scope when present.
- The runner may initially read these values from environment variables if file
  parsing is deferred, but the behavior must remain config-first and local.
- The control plane may persist config-derived registration fields for durable
  visibility, but it does not own hosted runner configuration in this feature.

## Current Environment Mapping

- `MYSTRA_RUNNER_NAME`
- `MYSTRA_RUNNER_CONCURRENCY`
- `MYSTRA_RUNNER_POLL_INTERVAL_SECONDS`
- `MYSTRA_RUNNER_STALE_AFTER_SECONDS`
- `MYSTRA_RUNNER_DEFAULT_EXECUTION_TIMEOUT_SECONDS`
- `MYSTRA_RUNNER_CANCEL_CHECK_INTERVAL_SECONDS`
- `MYSTRA_RUNNER_CLEANUP_TIMEOUT_SECONDS`
- `MYSTRA_RUNNER_ELIGIBLE_PROJECT_IDS`
- `MYSTRA_RUNNER_ELIGIBLE_RUNTIME_PROVIDERS`

## Non-Goals

- No central scheduler.
- No hosted runner config CRUD.
- No queue priority or rebalance.
- No cross-runner shared cache.
