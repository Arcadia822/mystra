# Engineering Review: Config-First Headless Runner Durability

**Reviewed**: 2026-05-10  
**Inputs**: [spec.md](../spec.md), [plan.md](../plan.md), [research.md](../research.md), [data-model.md](../data-model.md), [contracts/](../contracts), `.specify/memory/constitution.md`, direct source inspection, partial GitNexus evidence.

## Verdict

Proceed to task decomposition after preserving the constraints below. The plan
matches the owner-approved direction: config-first headless runner, durable
desired/observed state, runner-local timeout/cancel cleanup, and stale marking
without central scheduling.

## Required Constraints Before Tasks

1. **No scheduler module**: Do not introduce a scheduler package, queue priority
   system, cross-runner rebalance, or retry workflow under this feature.
2. **Active capacity truth**: Prefer deriving active local concurrency from
   durable active runs for the runner. If `activeRunCount` remains as a cached
   counter, tasks must include idempotency tests for duplicate terminal writes,
   cancellation, timeout, and stale marking.
3. **State enum restraint**: Avoid adding `cancellation_requested` or
   `cleanup_in_progress` states unless events plus existing states cannot make
   operator behavior clear. The smallest acceptable model is desired cancel
   metadata/event plus runner observations.
4. **Stale is not retry**: Stale marking must end in visible stale/failed state
   only. Requeue, retry, and reassignment need a separate spec.
5. **Runner config remains local**: Config can be env-driven or file-driven in
   the first implementation, but this feature must not add hosted runner config
   CRUD.

## Code Evidence

- `apps/runner-daemon/src/index.ts` already has a thin headless loop:
  `readConfig -> register -> heartbeat -> claim -> executeJob`.
- `apps/control-plane/src/lib/db/sqlite-provider.ts` owns current claim,
  cancellation, heartbeat, and terminal result transitions.
- Current `cancelJob` immediately transitions assigned work to `canceled` and
  decrements runner count. Implementation tasks must change this behavior for
  assigned/running work so runner-local cleanup is observable.
- Current `claimNextRun` filters queued runs by runner capabilities and
  `maxConcurrency`; this is the right boundary to extend with config-derived
  eligibility, not replace.
- GitNexus was used for `claimNextRun`, runner daemon `main`/`readConfig`, and
  `/api/runner/jobs` API impact. Index refresh failed, so direct source
  inspection is also recorded in the plan.

## Test Expectations

- Shared schema tests cover runner config and observation contract parsing.
- Control-plane tests cover queued cancellation, assigned/running cancellation
  requested, stale marking, stale report rejection, and idempotent terminal
  writes.
- Runner-daemon tests cover config parsing/defaults, local concurrency,
  cancellation observation, timeout cleanup, and cleanup failure reporting.
- Route tests cover claim eligibility and runner state endpoints without adding
  public retry/log/callback behavior.

## Open Risks

- The existing `activeRunCount` counter may be convenient but can become a
  second source of truth. Tasks must either remove it from critical correctness
  or make it provably idempotent.
- Runner-local timeout around Docker execution may require process/container
  control refactoring. Keep that refactor inside `apps/runner-daemon` and avoid
  moving execution control into the control plane.
