# Runner Daemon

The Runner daemon is a headless pull worker with a stable platform identity.
Enrollment uses `MYSTRA_RUNNER_REGISTRATION_SECRET`; registering the same name
retains its Runner ID, rotates its credential, and invalidates the old one.

## Local configuration

```sh
MYSTRA_RUNNER_REGISTRATION_SECRET=local-enrollment-secret
MYSTRA_RUNNER_NAME=local-runner
MYSTRA_RUNNER_CONCURRENCY=1
MYSTRA_RUNNER_POLL_INTERVAL_SECONDS=5
MYSTRA_RUNNER_STALE_AFTER_SECONDS=90
MYSTRA_RUNNER_DEFAULT_EXECUTION_TIMEOUT_SECONDS=3600
MYSTRA_RUNNER_CANCEL_CHECK_INTERVAL_SECONDS=10
MYSTRA_RUNNER_CLEANUP_TIMEOUT_SECONDS=30
MYSTRA_RUNNER_ELIGIBLE_PROJECT_IDS=
MYSTRA_RUNNER_ELIGIBLE_RUNTIME_PROVIDERS=docker
```

## Durability and execution

- Runner identity, capability, eligibility, heartbeat, capacity, credential
  digest, and current assignments are durable control-plane state.
- Claiming is pull-based, credential-authenticated, and bounded by local
  concurrency. A Session can be claimed once.
- A claimed Session receives its parent Task context and follows the fixed
  sequence `clone -> Agent -> test -> build -> preview -> commit -> push -> PR`.
- Task and Session use the same immutable Repository snapshot. Session-level
  Project or Repository replacement is rejected.
- Repository credentials are scoped to clone/push; Agent credentials are scoped
  to the Agent command. Quality and preview phases receive neither.
- Cancellation and timeout stop the sandbox with a bounded cleanup deadline.
- Successful review delivery returns `waiting_for_review`, releases Runner
  capacity, and retains structured review evidence on the Session result.
- Execution facts remain internal protocol/persistence details and are not a
  public business-object API.

## Commands

```sh
pnpm --filter @mystra/runner-daemon test
pnpm --filter @mystra/runner-daemon typecheck
```
