# Quickstart: Config-First Headless Runner Durability

## Goal

Validate that runner durability remains config-first and headless:

- runner local config controls concurrency and eligibility;
- control plane persists desired and observed state;
- runner handles timeout/cancel cleanup locally;
- stale work is marked without retry or rebalance.

## Local Runner Config

The first implementation maps the config-first contract to local environment
variables:

```sh
MYSTRA_RUNNER_NAME=runner-dev-01
MYSTRA_RUNNER_CONCURRENCY=2
MYSTRA_RUNNER_POLL_INTERVAL_SECONDS=2
MYSTRA_RUNNER_STALE_AFTER_SECONDS=60
MYSTRA_RUNNER_DEFAULT_EXECUTION_TIMEOUT_SECONDS=1800
MYSTRA_RUNNER_CANCEL_CHECK_INTERVAL_SECONDS=5
MYSTRA_RUNNER_CLEANUP_TIMEOUT_SECONDS=30
MYSTRA_RUNNER_ELIGIBLE_PROJECT_IDS=PROJECT_ID
MYSTRA_RUNNER_ELIGIBLE_RUNTIME_PROVIDERS=docker
```

This deliberately avoids hosted runner config CRUD. A future file format can be
added without changing the control-plane ownership model.

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

## Verification Evidence

- 2026-05-11: `.specify/scripts/bash/check-prerequisites.sh --json` returned
  `FEATURE_DIR=/Users/arcadia/Documents/mystra/specs/003-config-first-runner-durability`.
- 2026-05-11: `pnpm --filter @mystra/shared test` passed: 5 files, 73 tests.
- 2026-05-11: `pnpm --filter @mystra/control-plane test` passed: 3 files, 49 tests.
- 2026-05-11: `pnpm --filter @mystra/runner-daemon test` passed: 1 file, 21 tests.
- 2026-05-11: `pnpm typecheck` passed across shared, workflows, agent-adapters,
  control-plane, and runner-daemon.
- 2026-05-11: `pnpm test` passed across shared, control-plane, runner-daemon,
  workflows, and agent-adapters. Workflows and agent-adapters had no test files.

## GitNexus Evidence

`npx gitnexus impact ...` and `npx gitnexus analyze` still fail locally with
`Cannot destructure property 'package' of 'node.target' as it is null`. The
implementation used direct source inspection plus focused provider, route,
runner, and typecheck verification as the fallback evidence path.
