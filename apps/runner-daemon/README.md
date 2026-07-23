# Runner Daemon

The runner daemon is a headless pull worker. Local startup configuration controls
its concurrency, poll interval, timeout windows, cleanup timeout, and eligible
claim scope. The control plane records those config-derived facts for visibility
but does not host runner configuration or centrally schedule capacity.

## Local Config

```sh
MYSTRA_RUNNER_CONCURRENCY=1
MYSTRA_RUNNER_POLL_INTERVAL_SECONDS=5
MYSTRA_RUNNER_STALE_AFTER_SECONDS=90
MYSTRA_RUNNER_DEFAULT_EXECUTION_TIMEOUT_SECONDS=3600
MYSTRA_RUNNER_CANCEL_CHECK_INTERVAL_SECONDS=10
MYSTRA_RUNNER_CLEANUP_TIMEOUT_SECONDS=30
MYSTRA_RUNNER_ELIGIBLE_PROJECT_IDS=
MYSTRA_RUNNER_ELIGIBLE_RUNTIME_PROVIDERS=docker
```

## Durability Model

- The runner registers config-derived concurrency and eligibility.
- Claiming is pull-based and bounded by local `MYSTRA_RUNNER_CONCURRENCY`.
- A claimed run follows one fixed sequence:
  `clone -> Agent -> test -> build -> preview -> commit -> push -> PR`.
- The runner contains no orchestration provider, graph, blueprint, or node
  registry. Future policy belongs in a removable Agent hook/plugin.
- Active Docker execution is watched locally for timeout and cancellation.
- On cancellation or timeout, the runner emits `cleanup.started`, stops the
  container with `MYSTRA_RUNNER_CLEANUP_TIMEOUT_SECONDS`, and reports `canceled`,
  `timed_out`, or `failed` with `cleanup_failed`.

## Execution Invariants

- The base container receives no repository or Agent credentials.
- Repository credentials are scoped to clone/push operations. Copilot
  credentials are scoped to the Agent command. Test, build, and preview phases
  receive neither.
- Copilot runs in bounded autopilot mode with an explicit continuation cap.
- Test and build are independent structured quality results.
- Preview must pass two bounded host-side probes before review handoff.
- Successful delivery returns `waiting_for_review`, releases runner capacity,
  retains the sandbox, and records preview, commit, branch, and PR metadata.
- Cancellation, timeout, quality failure, preview failure, and delivery failure
  fail closed and do not claim a review-ready result.

## Commands

```sh
pnpm --filter @mystra/runner-daemon test
pnpm --filter @mystra/runner-daemon typecheck
```
