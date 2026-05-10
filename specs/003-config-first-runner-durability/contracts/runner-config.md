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

## Non-Goals

- No central scheduler.
- No hosted runner config CRUD.
- No queue priority or rebalance.
- No cross-runner shared cache.
