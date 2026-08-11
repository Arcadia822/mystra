# Engineering Review Checklist: Task Workspace Setup

**Source**: [engineering-review.md](../engineering-review.md)
**Status**: Passed with required pre-task gates

## Architecture

- [x] TaskWorkspace ownership and `1 : 0..1` invariant are explicit.
- [x] Project config、Integration RepoProvider、standard Git reader、Issue、orchestration and Runtime responsibilities are separated.
- [x] attempt lease/fencing and state transitions are defined.
- [x] attempt claim/lease is restricted to materialization fencing/retry and is not Session Runtime capacity, slot or execution occupancy.
- [x] Current 048/049/050 scope is Task-bound only; future Project-only or standalone preparation must reuse the same Workspace/attachment contract.
- [x] Runtime affinity and no-fallback behavior are defined.

## Safety and quality

- [x] secret and absolute-path boundaries are explicit.
- [x] safe-root, argv execution, atomic publish and collision failure are required.
- [x] pre-0.1 direct replacement avoids compatibility shims.
- [x] GitNexus impact and HIGH `RdbProvider` risk are recorded.

## Verification

- [x] SQLite/PostgreSQL contract parity is required.
- [x] standard-Git/provider/service/runner/cross-feature/UI test layers are enumerated.
- [x] shared-mutable concurrent writes are treated as visible risk, not isolation.
- [x] UI prototype refreshed and verified in a real browser before tasks; evidence is recorded in `prototype.md`.
- [x] Owner implementation authorization confirms unavailable/rebuild/delete remain excluded for 048 MVP.
- [x] Owner-corrected 049/050 handoff confirms 049 owns atomic Session creation/input resolution/prompt composition/Provider start and consumes `task/shared-mutable`; 050 consumes setup/read plus 049 launch projections. 048 owns neither and introduces no initial `turnId`.
- [x] 048 task-only dependency checkpoint passes shared/control-plane focused tests and typecheck; 049 may rebase/stack on this contract before the remaining 048 audit closes.
- [x] Dependency consistency rechecked against the concrete 049/050 task-only specs, implementations and tests now present on local `main`.

## Completion evidence

- [x] shared/control-plane/runner tests, root typecheck/lint, production build and both Prisma schema validations pass.
- [x] Real HTTPS Git + SQLite + runner materialization closure passes, including a shared-mutable commit that advances `HEAD` while preserving base ancestry.
- [x] Real control-plane browser verification covers branch failure-to-text, saved config, ready facts, locked Runtime, 320px and console cleanliness.
- [x] Spec-Kit consistency analysis reports 34/34 requirements covered by 58 tasks with no critical findings.
- [x] GitNexus index refreshed and change detection run; untracked feature-file mapping limitation is recorded.
- [ ] PostgreSQL runtime contract suite is blocked: `MYSTRA_TEST_POSTGRES_URL` is absent. SQLite execution and schema parity are not substitutes.
