# Implementation Plan: Multi-Project Lanes

**Branch**: `015-multi-project-lanes` | **Date**: 2026-05-16 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/015-multi-project-lanes/spec.md`

## Summary

Extend the canonical management contract so one Debian-hosted Mystra deployment
can expose `mystra` and `skrya` as honest, inspectable project lanes, and keep a
submitted run attributable to the lane configuration that existed at submission
time. Reuse the existing `Project`, `JobSnapshot`, runner eligibility, resolved
runtime, and workflow snapshot seams. Do not invent a second scheduler, a new
project registry, or first-class workflow configuration storage just to make the
lane story sound richer than the code really is.

## Technical Context

**Language/Version**: TypeScript 5.9 with Node.js 24 runtime assumptions  
**Primary Dependencies**: Next.js 16 route handlers, Zod 4, Vitest 4,
`better-sqlite3`, `@mystra/shared`, existing `RdbProvider`/`SqliteRdbProvider`,
runtime resolution in `apps/control-plane/src/lib/runtime/resolve-runtime.ts`,
and workflow snapshots derived from run events  
**Storage**: SQLite through `RdbProvider`, with durable `Project`, `Job`, `Run`,
`RunEvent`, and `RunResult` state already owned by the control plane  
**Testing**: `pnpm --filter @mystra/shared test`,
`pnpm --filter @mystra/control-plane test`,
`pnpm --filter @mystra/runner-daemon test`, and `pnpm typecheck`  
**Target Platform**: One Debian-hosted Mystra control plane and runner
deployment, serving at least `mystra` and `skrya` from one host  
**Project Type**: TypeScript pnpm monorepo with a Next.js control plane, shared
Zod contracts, SQLite-backed persistence, and runner-side workflow telemetry  
**Performance Goals**: Preserve one pollable snapshot per job, avoid fan-out
reads for lane attribution, and keep concurrent lane inspection cheap enough for
coordinating agents to use routinely  
**Constraints**: Build on `014-management-api-truth`; keep HTTP as truth; keep
MCP as adapter; preserve durable run/result ownership; do not widen into auth,
multi-host scheduling, retry APIs, or first-class workflow-registry storage  
**Scale/Scope**: One additive lane-inspection view for projects, one additive
submitted-lane snapshot for jobs/runs, concurrency-safe attribution for at least
two lanes on one host, and no new public distribution artifact

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Specification Owns Product Boundaries**: PASS. The plan stays inside the lane
  isolation problem and explicitly defers workflow-registry, auth, and
  multi-host concerns.
- **Typed Contracts at Service Boundaries**: PASS. Lane inspection and
  submitted-lane attribution land as shared Zod-backed management views instead
  of route-local JSON blobs.
- **Providers Are Replaceable Boundaries**: PASS. The plan works above
  `RdbProvider`; it does not tie the management contract to SQLite-specific query
  behavior beyond one additive stored snapshot field.
- **Runner Isolation and Secret Hygiene**: PASS. The plan reuses existing runtime
  resolution, runner eligibility, and workflow event seams without broadening
  secret handling.
- **Verification And Documentation Before Delivery**: PASS. Delivery requires
  shared-schema tests, provider regression tests, route-level concurrency
  coverage, and feature-local docs before closure.

## Step 0 Scope Challenge

1. **What already solves part of this?**
   - `014-management-api-truth` already froze minimum project identity and one
     canonical job snapshot.
   - `SqliteRdbProvider.createJob()` already freezes repo, base branch, agent,
     and resolved runtime per submission.
   - `claimNextRun()` already isolates queued work by `project_id` and runtime
     provider eligibility.
   - Workflow identity already has a truthful observation seam through
     `workflow.start_requested` events and `workflowExecutionSnapshotSchema`.
2. **Minimum change that achieves the goal**:
   - Add a **current lane inspection view** on project detail.
   - Add a **submitted lane snapshot** to the durable job/run observation path.
   - Add tests that prove concurrent `mystra` and `skrya` runs stay distinct and
     stay honest after project edits.
3. **Complexity check**:
   - This slice should stay inside shared management schemas, DB/provider
     snapshotting, project/job routes, and tests. No new service package, no new
     scheduler, no new route family.
4. **Search check**:
   - Existing framework seams are already present. No custom concurrency system is
     needed beyond the current durable project-id and runtime-provider filters.
5. **Completeness check**:
   - The complete version includes both current project-lane inspection and
     submission-time frozen attribution. Shipping only one would leave either
     project edits or concurrent run inspection dishonest.
6. **Distribution check**:
   - No new distributable artifact is introduced. This is a control-plane
     contract extension only.

**Scope verdict**: Keep scope as-is, but keep it boring. The only new persistence
surface should be one additive durable lane snapshot, not a new lane subsystem.

## Project Structure

### Documentation (this feature)

```text
specs/015-multi-project-lanes/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── lane-inspection.md
│   └── lane-run-attribution.md
└── tasks.md
```

### Source Code (repository root)

```text
apps/control-plane/
├── app/api/
│   ├── projects/[slug]/route.ts
│   ├── jobs/route.ts
│   ├── jobs/[id]/route.ts
│   └── routes.test.ts
├── src/lib/db/
│   ├── rdb-provider.ts
│   └── sqlite-provider.ts
└── src/lib/runtime/resolve-runtime.ts

packages/shared/src/
├── index.ts
├── management.ts
├── schemas.ts
└── workflow.ts
```

**Structure Decision**: Keep lane contract ownership in
`packages/shared/src/management.ts`, keep durable lane attribution inside the DB
provider snapshot seam, and keep project/job routes as thin projections over
that shared truth.

## Complexity Tracking

This slice stays below the "overbuilt" threshold if it adds:

1. One additive shared lane-contract module extension.
2. One additive durable submitted-lane snapshot on job creation.
3. Route/test reconciliation over the same canonical surfaces.

If implementation starts introducing a workflow registry, lane-specific service
objects, or more than one new persisted JSON field, stop and reduce scope.

## Phase 0 Research Summary

Detailed decisions live in [research.md](./research.md).

Key conclusions:

1. `014` already solved **minimum lane identity**, but not the richer "current
   lane config vs submission-time frozen lane config" distinction.
2. `SqliteRdbProvider.projectClaim()` currently reads the **live project row** on
   every job snapshot. That is useful for current inspection, but not sufficient
   to prove which workflow/context/runtime inputs were selected when a job was
   created.
3. `createJob()` already freezes repo, base branch, agent, and resolved runtime.
   `015` should build on that seam instead of introducing a second run read model.
4. Workflow identity is already observable through
   `workflow.start_requested`/`workflow.started` events and
   `workflowExecutionSnapshotSchema`, but **project-level workflow intent** is
   not first-class storage yet. The honest short-term seam is
   `project.metadata.workflow`.
5. Existing runner eligibility by `project_id` and runtime provider already gives
   the control plane the bones of one-host lane isolation. The missing part is a
   clearer contract and stronger regression coverage.

## Phase 1 Design Summary

Generated artifacts:

- [data-model.md](./data-model.md)
- [quickstart.md](./quickstart.md)
- [contracts/lane-inspection.md](./contracts/lane-inspection.md)
- [contracts/lane-run-attribution.md](./contracts/lane-run-attribution.md)

The implementation slice for `015` should:

1. Add a **LaneInspectionView** for `GET /api/projects/{slug}` that turns the
   current project row into an explicit lane configuration view.
2. Add a **SubmittedLaneSnapshot** captured at job creation so later inspection
   can show the lane inputs selected for that run even if the project is edited
   afterward.
3. Keep `project` in canonical job snapshots as the **current project-backed
   view**, while adding a separate frozen lane snapshot for historical honesty.
4. Reuse `project.metadata.workflow` as the project-side workflow hint until a
   future feature introduces first-class workflow config storage.
5. Reuse resolved runtime, context-bundle resolution, and existing runner
   eligibility logic. No parallel scheduler. No lane daemon. No registry magic.

### Boundary Diagram

```text
current project row
  -> LaneInspectionView
     -> GET /api/projects/{slug}

project row + runtime resolution + workflow hint
  -> SubmittedLaneSnapshot (captured at createJob)
     -> CanonicalRunSnapshot.lane
        -> GET /api/jobs
        -> GET /api/jobs/{id}
        -> MCP / future SDK / future CLI

runner eligibility today
  project_id filter + runtime provider filter
    -> one-host lane isolation
```

### Current-vs-Frozen Truth Diagram

```text
project edited after submission?
  yes
   ├── project detail read
   │    -> show CURRENT lane config
   └── job snapshot read
        -> show FROZEN submitted lane snapshot

no edit
  -> both views agree
```

## Code Evidence

- `packages/shared/src/management.ts` already owns project selection, execution
  context, and canonical snapshot schemas. It is the right place to add lane
  inspection and submitted-lane schemas.
- `packages/shared/src/schemas.ts` already stores `runtime`, `prewarmConfig`, and
  generic `metadata` on `Project`, plus generic `metadata` on `JobSpec`. That is
  enough surface to express current lane inputs without inventing new top-level
  product entities.
- `apps/control-plane/src/lib/db/sqlite-provider.ts:createJob()` already freezes
  repo, base branch, agent, and resolved runtime. The cheapest honest extension
  is to freeze the remaining lane facts at that same moment.
- `apps/control-plane/src/lib/db/sqlite-provider.ts:projectClaim()` currently
  returns the current project-backed view. That seam should stay for current
  inspection and should not silently become the historical lane snapshot.
- `apps/control-plane/src/lib/runtime/resolve-runtime.ts` already resolves
  context bundles, runtime image, mounts, ports, cache, and secret refs. `015`
  should project this resolved contract, not rebuild it.
- `apps/control-plane/src/lib/db/sqlite-provider.ts:workflowSnapshotFromEvents()`
  already derives workflow provider/blueprint identity from durable events. That
  remains the run-observation truth once a workflow starts.
- `apps/control-plane/app/api/routes.test.ts` and
  `apps/control-plane/src/lib/db/sqlite-provider.test.ts` already prove route and
  provider behavior for multi-project attribution, restart safety, runtime
  eligibility, and workflow snapshots. They are the right regression surfaces.

## Implementation Order

1. Extend shared management schemas for lane inspection and submitted-lane
   attribution.
2. Add provider-level durable submitted-lane snapshot capture and parsing.
3. Project the current lane inspection view through project detail reads.
4. Project the frozen submitted-lane snapshot through job list/get reads.
5. Add regression tests for concurrent lanes, project edits after submission,
   workflow-hint inspection, and context-bundle/runtime distinctions.
6. Refresh quickstart/contracts/docs and rerun the focused validation commands.

## What Already Exists

- `GET /api/projects` and `GET /api/projects/{slug}` already solve current
  project listing and detail reads. `015` should enrich the detail contract, not
  replace these routes.
- `createJob()` plus `resolveRuntimeContract()` already solve runtime freezing at
  submission time. `015` should extend that frozen truth to the rest of the lane
  inputs.
- `claimNextRun()` already respects `project_id` and runtime-provider eligibility,
  which is the existing concurrency isolation mechanism for one-host lanes.
- `workflowExecutionSnapshotSchema` plus workflow lifecycle events already solve
  runtime-time workflow observation. `015` should reuse this instead of inventing
  a second workflow state model.

## NOT in scope

- **First-class workflow registry on Project**: deferred because
  `project.metadata.workflow` is enough for this slice and a full registry belongs
  with workflow-configuration work.
- **Multi-host or multi-workspace scheduling**: deferred because this slice is
  explicitly about multiple project lanes on one host.
- **Auth or tenancy policy**: deferred because caller auth and hosted workspace
  boundaries are still outside the MVP.
- **Artifact storage changes**: deferred because lane attribution can be made
  honest through current job/run/result seams.
- **UI-first lane management**: deferred because the contract must stay
  API-first; UI can consume the same additive views later.

## Risks And Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Job snapshots still read only live project data, so edits rewrite history | High | Add a submitted-lane snapshot captured during `createJob()` and exposed separately from the current project view |
| Workflow identity becomes fake because the project has no first-class workflow fields | Medium | Reuse `project.metadata.workflow` as an explicit hint and document its limited scope |
| Lane contract duplicates resolved runtime or workflow snapshots | Medium | Keep one submitted-lane snapshot and one workflow observation snapshot, with distinct purposes |
| Concurrent lanes look isolated in tests but share hidden runtime inputs | High | Add tests that create two projects with different repo/base branch/defaultAgent/context-bundle/runtime/workflow-hint inputs and assert both current and frozen reads |

## Failure Modes

| Codepath | Realistic failure | Planned test | Error handling |
|---|---|---|---|
| Project detail lane inspection | `metadata.workflow` is malformed or missing | Shared schema + route test for optional/malformed workflow hint | Treat workflow hint as optional; do not 500 on absent hint |
| Job creation lane snapshot | Project edits after submission silently rewrite lane identity | Provider + route regression test after project mutation | Frozen submitted-lane snapshot remains separate from live project view |
| Concurrent lane list/get | `mystra` and `skrya` snapshots collapse to one shared default image/agent/repo | Route tests with overlapping runs and distinct inputs | Route snapshots include per-job frozen lane attribution |
| Workflow inspection | Workflow has not started yet, so no runtime workflow snapshot exists | Tests for hinted workflow before start and observed workflow after start | Submitted lane snapshot carries workflow hint; runtime workflow snapshot stays optional |

No critical gap is accepted if it has **no test**, **no error handling**, and a
**silent failure** path.

## Worktree Parallelization Strategy

| Step | Modules touched | Depends on |
|---|---|---|
| Shared lane contract | `packages/shared/src/` | — |
| Durable submitted-lane snapshot | `apps/control-plane/src/lib/db/` | Shared lane contract |
| Route projection + route tests | `apps/control-plane/app/api/` | Shared lane contract, durable submitted-lane snapshot |
| Docs + quickstart refresh | `specs/015-multi-project-lanes/`, nearby docs | Route projection stabilized |

**Lane A**: Shared lane contract -> durable submitted-lane snapshot -> route projection  
**Lane B**: Docs/quickstart refresh after Lane A freezes the final payload

**Execution order**: Launch only Lane A first. Once payload shape is stable, Lane
B can run in parallel in a separate worktree for docs-only updates.

**Conflict flags**: No safe parallel code lanes before the provider snapshot
shape is frozen. Shared contracts and DB/provider changes are a single lane.

