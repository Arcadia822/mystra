# Research: Config-First Headless Runner Durability

## Decision: Use Local Runner Config As The MVP Control Surface

**Rationale**: The existing runner daemon already reads local environment config
and runs a simple heartbeat/claim/execute loop. Extending that local config with
concurrency, poll interval, timeout, cancellation check interval, cleanup
timeout, stale window, and eligibility scope preserves the headless shape and
avoids a hosted runner-management surface.

**Alternatives considered**:
- Central scheduler with slot assignment: rejected because it exceeds MVP needs.
- Hosted runner CRUD/config API: rejected because local operator config is
  enough for the first private runner.

## Decision: Keep Control Plane As Desired/Observed State Store

**Rationale**: The control plane should durably store what callers want and what
runners observed. It should not supervise every container operation. This keeps
SQLite provider responsibilities simple and compatible with a future hosted RDB
provider.

**Alternatives considered**:
- In-memory scheduler state: rejected because process restart would hide facts.
- Runner-only state: rejected because operators and future agents need durable
  state visibility.

## Decision: Runner Owns Timeout And Cleanup

**Rationale**: The runner starts task containers and is closest to process
cleanup. Local watchdog behavior can enforce timeouts and cancellation cleanup
without a central process manager.

**Alternatives considered**:
- Control-plane-issued cleanup commands: rejected as too complex for MVP and
  fragile under runner/network loss.
- Container-only timeout script: rejected as insufficient because the runner
  still needs to report durable outcomes and cleanup failures.

## Decision: Mark Stale Work Instead Of Retrying Or Rebalancing

**Rationale**: The first useful durability improvement is honest state after a
runner disappears. Automatic retry, requeue, and rebalance require deeper
idempotency and delivery semantics and are out of scope.

**Alternatives considered**:
- Requeue stale work automatically: rejected because it is a retry feature.
- Cross-runner rebalance: rejected because it implies central scheduling.

## Decision: Use Existing Claim Boundary With Minimal Contract Expansion

**Rationale**: `SqliteRdbProvider.claimNextRun` already filters queued runs by
runner capability and max concurrency. The plan should add config-derived
eligibility and desired-state handling around this boundary rather than
inventing a new scheduler path.

**Alternatives considered**:
- New scheduler module: rejected because it duplicates existing claim behavior.
- Runner-side queue filtering only: rejected because the control plane should
  avoid handing clearly ineligible work to a runner.

## Code Evidence Notes

- GitNexus `list_repos` reported the `mystra` index was 3 commits behind.
- `npx gitnexus analyze` failed during planning with
  `Cannot destructure property 'package' of 'node.target' as it is null`.
- GitNexus still identified `SqliteRdbProvider.claimNextRun` and runner daemon
  `main`/`readConfig` as the relevant boundaries; direct source inspection was
  used to compensate for index staleness.
