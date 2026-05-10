# Engineering Review: Config-First Headless Runner Durability

**Feature**: `003-config-first-runner-durability`
**Reviewed**: 2026-05-10
**Inputs**: [spec.md](../spec.md), [plan.md](../plan.md), [research.md](../research.md), [data-model.md](../data-model.md), [quickstart.md](../quickstart.md), [contracts/runner-config.md](../contracts/runner-config.md), [contracts/runner-state.md](../contracts/runner-state.md)

## Outcome

Proceed to task decomposition with revisions captured as implementation constraints.

The plan is aligned with the constitution and keeps the feature within the MVP
boundary: config-first runner behavior, durable desired/observed state, local
timeout/cancellation cleanup, and stale visibility only. It must not grow into
a scheduler, retry system, hosted runner-management API, or logs/callback
surface during implementation.

## Code Evidence

- GitNexus MCP tools were not available in this Codex session. Prior plan
  evidence records that the index was stale and `npx gitnexus analyze` failed
  with `Cannot destructure property 'package' of 'node.target' as it is null`.
  Direct source inspection was used for this review.
- `apps/runner-daemon/src/index.ts` already has the desired headless shape:
  `readConfig -> register -> heartbeat -> claim -> executeJob`.
- `apps/runner-daemon/src/index.ts` currently registers `maxConcurrency: 1`
  and processes one claimed job at a time inside the main loop, so local
  concurrency needs an explicit runner-side active-work model.
- `apps/control-plane/src/lib/db/sqlite-provider.ts` currently makes
  `cancelJob` transition assigned/running work directly to `canceled` and
  decrements runner capacity. That bypasses runner-owned cleanup and must
  change for assigned/running work.
- `apps/control-plane/src/lib/db/sqlite-provider.ts` currently uses
  `activeRunCount` as the claim limiter. Owner decision on 2026-05-10:
  remove this from correctness. Claim-time concurrency should be calculated
  from durable active runs assigned to the runner.
- `packages/shared/src/state.ts` currently has terminal states but no explicit
  `cancellation_requested`, `cleanup_in_progress`, or `stale` state. The plan
  correctly requires minimizing enum expansion unless events cannot express
  the distinction.

## Review Findings

1. **Cancellation semantics need a narrow contract before implementation.**
   Queued cancellation can remain terminal. Assigned/running cancellation must
   become durable desired state for the owning runner to observe, clean up, and
   report. This likely needs a provider outcome such as
   `cancellation_requested` plus a visible event, not a blind state jump to
   `canceled`.

2. **Runner concurrency is not just a registration field.** The runner daemon
   needs to claim and supervise up to `concurrency` active jobs locally. The
   task split must separate config parsing, control-plane claim filtering, and
   runner-local active job supervision.

3. **State enum expansion should be conservative.** Prefer events and existing
   active states where they preserve operator visibility. Add `stale` and/or
   cleanup states only if route responses and provider tests show events are
   insufficient for the success criteria.

4. **Stale marking must not imply recovery.** Stale runner/run marking should
   produce durable operator-readable facts only. No retry, requeue, rebalance,
   priority, or scheduler loop is allowed in this feature.

5. **Do not use `activeRunCount` as a correctness source.** The owner accepted
   the simpler model: calculate active work from durable non-terminal active
   runs at claim time. `activeRunCount` should be removed from the critical
   path and either deleted or treated only as optional derived display data.

## Required Task-Decomposition Rules

- Create shared schema/state tasks before route/provider/runner tasks.
- Put SQLite migration/provider changes before route behavior changes.
- Put runner-local config parsing before registration and claim-loop changes.
- Require tests for cancellation-request behavior before changing
  `cancelJob`.
- Require runner-daemon tests for config parsing, concurrency limiting,
  timeout cleanup, and cancellation cleanup.
- Require control-plane tests for claim eligibility, stale marking, stale
  observation rejection, and process-restart durability.

## State Representation Decision

No owner decision is required. Follow the spec3 design: keep the state model
small and represent cancellation requested, cleanup progress, and stale
evaluation through durable desired state, runner observations, events, and
existing active/terminal states first.

Only add a new first-class `RunState` when the implementation cannot satisfy
the documented operator visibility and stale-overwrite rules with the smaller
event-based model. If that happens, make the smallest contract change and keep
it inside this feature's shared schema, provider tests, and contracts.

## Owner Decisions After Review

- Do not rely on `activeRunCount`; calculate active work from durable run state
  every time claim eligibility is checked.
- Keep state enum expansion minimal.
- Stale means visible stale/failed state only. No retry, requeue, reassignment,
  or rebalance in this feature.
