# Quickstart: Config-First Headless Runner Durability

## Goal

Validate that runner durability remains config-first and headless:

- runner local config controls concurrency and eligibility;
- control plane persists desired and observed state;
- runner handles timeout/cancel cleanup locally;
- stale work is marked without retry or rebalance.

## Example Local Runner Config

```toml
[runner]
name = "runner-dev-01"
concurrency = 2
poll_interval_seconds = 2
stale_after_seconds = 60

[execution]
default_timeout_seconds = 1800
cancel_check_interval_seconds = 5
cleanup_timeout_seconds = 30

[claim]
eligible_project_ids = ["PROJECT_ID"]
eligible_runtime_providers = ["docker"]
```

The implementation may initially map these fields from environment variables if
that keeps the first slice smaller. The product contract is config-first; the
file format can be finalized during implementation.

## Manual Validation Flow

1. Start the control plane.

```sh
pnpm dev:control-plane
```

2. Start a runner with local config limiting concurrency to `1` or `2`.

```sh
pnpm dev:runner
```

3. Create two or more jobs for an eligible Project and verify the runner never
   exceeds configured local concurrency.

4. Submit a job outside the runner's eligible Project/runtime scope and verify
   it remains unclaimed by that runner.

5. Cancel a running job and verify:
   - control plane records cancellation requested;
   - runner observes cancellation;
   - runner cleans up local execution;
   - final state is cancelled or failed with an operator-readable reason.

6. Run a job that exceeds timeout and verify:
   - runner watchdog stops execution;
   - cleanup runs;
   - final state is timed out or failed.

7. Stop a runner with active work and wait past stale window. Verify the runner
   and active work are marked stale or failed without automatic retry/rebalance.

## Automated Verification

```sh
pnpm --filter @mystra/shared test
pnpm --filter @mystra/control-plane test
pnpm --filter @mystra/runner-daemon test
pnpm typecheck
```
