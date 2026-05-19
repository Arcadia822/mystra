# Implementation Plan: Management API Truth

**Branch**: `014-management-api-truth` | **Date**: 2026-05-15 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/014-management-api-truth/spec.md`

## Summary

Freeze Mystra's canonical management API as the product truth for project
inspection, work submission, run observation, cancellation, and result
retrieval. This slice must normalize the current route and MCP drift into one
shared error vocabulary, one explicit set of success payloads with business
field names, one canonical run snapshot/read model, and one minimum
project-lane identity model that later child features can safely build on. It
also needs to state the uncomfortable but useful truth: until caller auth
exists, this contract is a private-ops surface for localhost or a trusted
internal network, not a public multi-tenant API.

## Technical Context

**Language/Version**: TypeScript 5.9 with Node.js 24 runtime assumptions  
**Primary Dependencies**: Next.js 16 route handlers, Zod 4, Vitest 4,
`better-sqlite3`, `@mystra/shared`, existing `RdbProvider`/`SqliteRdbProvider`,
and the current MCP route in `apps/control-plane/app/api/mcp/route.ts`  
**Storage**: SQLite through `RdbProvider`, with durable `Project`, `Job`, `Run`,
`RunEvent`, and `RunResult` state already owned by the control plane  
**Testing**: `pnpm --filter @mystra/shared test`,
`pnpm --filter @mystra/control-plane test`,
`pnpm --filter @mystra/runner-daemon test`, and `pnpm typecheck`  
**Target Platform**: Debian-hosted Mystra control plane and runner deployment,
serving trusted coordinating agents and operators on localhost or a trusted
internal network  
**Project Type**: TypeScript pnpm monorepo with a Next.js control plane, shared
Zod contracts, SQLite-backed persistence, and MCP as an adapter over the same
control-plane truth  
**Performance Goals**: One canonical run snapshot/read model per poll, no
transport-specific fan-out reads, and restart-safe retrieval of the latest
durable state and final result  
**Constraints**: Stay inside current MVP exclusions; use shared Zod schemas at
service boundaries; preserve current durable state ownership; freeze minimum
lane identity in this slice so later multi-project work does not invalidate the
contract; keep this first slice private-ops only until auth exists  
**Scale/Scope**: One canonical HTTP management contract, one shared
machine-readable error envelope, explicit per-action success payloads, one
canonical run snapshot model, parity with the current MCP adapter, and no
skill/CLI implementation yet

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Specification Owns Product Boundaries**: PASS. The plan keeps caller auth,
  retry APIs, callback URLs, log storage, and public multi-tenant exposure out
  of scope while documenting the trust boundary honestly.
- **Typed Contracts at Service Boundaries**: PASS. The plan centralizes shared
  error semantics and read models in shared Zod contracts while keeping success
  payloads explicit and action-specific.
- **Providers Are Replaceable Boundaries**: PASS. The plan works above the
  existing provider seams and does not leak SQLite or repository-provider
  specifics into the public contract.
- **Runner Isolation and Secret Hygiene**: PASS. The plan consumes durable
  runner state and result data without widening secret handling.
- **Verification And Documentation Before Delivery**: PASS. Delivery requires
  shared/control-plane tests, MCP parity evidence, restart regression, and
  feature-local docs before implementation closes.

## Project Structure

### Documentation (this feature)

```text
specs/014-management-api-truth/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── management-api.md
│   └── management-error-and-polling.md
└── tasks.md
```

### Source Code (repository root)

```text
apps/control-plane/
├── app/api/
│   ├── projects/route.ts
│   ├── projects/[slug]/route.ts
│   ├── jobs/route.ts
│   ├── jobs/[id]/route.ts
│   ├── jobs/[id]/cancel/route.ts
│   └── mcp/route.ts
├── app/api/routes.test.ts
├── src/lib/http.ts
└── src/lib/db/
    ├── index.ts
    ├── rdb-provider.ts
    └── sqlite-provider.ts

packages/shared/src/
├── index.ts
├── schemas.ts
├── result.ts
└── management.ts

scripts/
└── submit-job.mjs
```

**Structure Decision**: Keep canonical HTTP route ownership in
`apps/control-plane/app/api/`, keep shared contract ownership in
`packages/shared/src/`, and keep storage access behind `RdbProvider`. Do not let
MCP, scripts, or downstream skill/CLI surfaces define competing payload shapes.

## Complexity Tracking

No constitution violations require justification.

## Phase 0 Research Summary

Detailed decisions live in [research.md](./research.md).

Key conclusions:

1. The current project routes already return structured `{ project }` and
   `{ projects }` payloads, but job and cancel routes still use inconsistent raw
   payloads such as `{ error: "job_not_found" }` and `jsonError()` string
   envelopes.
2. The current MCP route validates inputs with shared Zod schemas, but still
   returns text-wrapped JSON payloads via `textToolResult()`. That confirms MCP
   is a transport adapter, not the right place to own canonical semantics.
3. `RdbProvider.getJob()` already returns a `JobSnapshot` that is close to the
   desired canonical polling model. The final result should stay where it really
   lives today, at `run.result`, instead of being duplicated as a new top-level
   field.
4. `014` must freeze the minimum project-lane identity now, not defer it fully
   to `015`, because selection and result attribution semantics depend on it.
5. The first-slice trust boundary must be explicit. Without auth, this is a
   private-ops contract, not a generally safe public API.
6. `GET /api/projects/{slug}` should freeze as a project-card projection of
   today's stable project data, not as an aspirational composite view that
   pretends workflow/context facts already exist in storage.

## Phase 1 Design Summary

Generated artifacts:

- [data-model.md](./data-model.md)
- [quickstart.md](./quickstart.md)
- [contracts/management-api.md](./contracts/management-api.md)
- [contracts/management-error-and-polling.md](./contracts/management-error-and-polling.md)

The first implementation slice for `014` should be:

1. Add shared management error-code schemas and canonical read models in
   `packages/shared`.
2. Add one canonical project selection, project-card execution-context view, and
   run snapshot read model that downstream consumers can reuse.
3. Reconcile HTTP project/job/cancel routes and MCP outputs to the same
   semantics in one deployment slice, so there is no drift window.
4. Add parity, restart-regression, and minimum lane-attribution tests before any
   coordinating skill or CLI implementation begins.

### Boundary Diagram

```text
packages/shared management schemas
  -> apps/control-plane HTTP routes
    -> scripts / submit-job.mjs
    -> MCP adapter projection
    -> future coordinating skills / CLI consumers

RdbProvider JobSnapshot + Project
  -> canonical run snapshot / project-card views
    -> one polling model
    -> one result retrieval model

trust boundary for this slice:
  localhost / trusted internal network only
  until caller auth exists
```

## Code Evidence

- `apps/control-plane/app/api/projects/route.ts` and
  `apps/control-plane/app/api/projects/[slug]/route.ts` already expose
  normalized `{ project }` and `{ projects }` payloads, but currently use
  route-local `projectError()` helpers that should move to a shared management
  envelope.
- `apps/control-plane/app/api/jobs/route.ts` still returns `jsonError()` output
  from `apps/control-plane/src/lib/http.ts`, which today emits
  `{ error: "invalid_request", issues }` for Zod failures and `{ error: message }`
  for generic failures. That is not stable enough for downstream consumers.
- `apps/control-plane/app/api/jobs/[id]/route.ts` returns the full snapshot on
  success but a raw `{ error: "job_not_found" }` string payload on 404. This is
  the clearest existing contract mismatch.
- `apps/control-plane/app/api/jobs/[id]/cancel/route.ts` is also part of the
  public management surface today and still uses route-local lowercase error
  strings, so it must be normalized in this slice instead of being left behind.
- `apps/control-plane/src/lib/db/rdb-provider.ts` already exposes `JobSnapshot`,
  `ProjectClaim`, and `RunRecord` types. This is the cheapest foundation for the
  canonical polling/read model, but the embedded `project` shape will need to be
  widened to the minimum lane-identity view.
- `apps/control-plane/app/api/routes.test.ts` already exercises project CRUD,
  project-based job creation, cancellation, and MCP job retrieval, so it is the
  right place to add contract parity, restart regression, and lane-attribution
  coverage.
- `apps/control-plane/app/api/mcp/route.ts` already parses and validates payloads
  with shared schemas. It should project the canonical route semantics rather
  than continue inventing text-only semantics as the de facto contract.
- GitNexus was refreshed during this planning step (`npx gitnexus analyze`),
  and `RdbProvider` context confirms the persistence seam is implemented by
  `SqliteRdbProvider` and imported by both DB setup and MCP code. That is enough
  evidence that route and shared-schema work is the right bounded slice here.

## Implementation Order

1. Add shared management error-code schemas, explicit success payload schemas,
   and canonical snapshot schemas in `packages/shared`.
2. Reconcile HTTP project, job list/get/create, and cancel routes to those
   schemas.
3. Reconcile MCP projection helpers in the same implementation slice, and do not
   deploy HTTP changes ahead of MCP parity.
4. Add parity, restart, and lane-attribution tests in `routes.test.ts` and the
   narrow runner tests needed for restart-safe result retrieval.
5. Update nearby docs and quickstart commands before task decomposition closes.

## What Already Exists

- `apps/control-plane/app/api/projects/route.ts` and `[slug]/route.ts` already
  solve basic project listing and lookup with persistence-backed data. `014`
  should reuse and normalize them, not replace them.
- `apps/control-plane/app/api/jobs/route.ts` and `[id]/route.ts` already solve
  submission and snapshot retrieval against durable state. `014` should freeze
  and normalize this flow, not invent a second polling model.
- `apps/control-plane/app/api/jobs/[id]/cancel/route.ts` already provides a
  cancel surface. `014` should bring it into the canonical contract instead of
  treating it as an accidental side route.
- `apps/control-plane/app/api/mcp/route.ts` already proves agents can consume the
  control-plane surface remotely. `014` should adapt its outputs to the canonical
  HTTP semantics.
- `apps/control-plane/src/lib/db/rdb-provider.ts` already provides the snapshot
  seam that later coordinating skill and CLI work should consume through the
  HTTP contract.

## NOT In Scope

- Caller authentication, authorization, and public internet hardening, because
  the MVP boundary still treats this as a private-ops surface.
- A new `/api/management/*` namespace, because it would duplicate behavior before
  the current contract is even frozen.
- Skill or CLI distribution work beyond local repository use, because this slice
  defines the truth they will consume later.
- Rich multi-project lane orchestration behavior beyond minimum identity, because
  that belongs to `015`.
- New workflow/context persistence fields just to make project detail responses
  look richer on paper.

## Verification Plan

| Surface | Evidence |
|---|---|
| Shared contract stability | `pnpm --filter @mystra/shared test` after adding error-code, success-payload, and snapshot schemas |
| HTTP route correctness | `pnpm --filter @mystra/control-plane test` with updated route and parity tests |
| Restart-safe durability | `pnpm --filter @mystra/runner-daemon test` when restart/result behavior is asserted through the canonical snapshot |
| MCP parity | Control-plane tests proving MCP project/job/cancel payloads match canonical route semantics in the same implementation slice |
| Cross-package type safety | `pnpm typecheck` |
| Manual API contract check | `quickstart.md` curl flow covering project list/get, job submit, run poll, result get, and trust-boundary note |

## Risks And Mitigations

- **Risk**: Existing HTTP and MCP envelopes already drift, so downstream consumers
  may accidentally depend on pre-freeze quirks.
  **Mitigation**: Freeze shared errors and explicit success payload schemas in
  `packages/shared`, then update routes and MCP together in one bounded slice
  with parity tests.
- **Risk**: Deferring lane identity fully to `015` would make the API freeze fake.
  **Mitigation**: Freeze the minimum project-lane identity in `014` and leave
  only richer one-host lane behavior to `015`.
- **Risk**: Consumers fan out to multiple reads for polling and result retrieval.
  **Mitigation**: Freeze one canonical run snapshot/read model now and require
  future skill/CLI/MCP projections, and any later SDK, to reuse it.
- **Risk**: Readers assume this first-slice API is public-safe because the trust
  boundary is implicit.
  **Mitigation**: Document and test the private-ops trust boundary explicitly in
  this feature.

## Failure Modes

| Codepath | Realistic failure | Test required | Error handling | User-visible outcome |
|---|---|---|---|---|
| `GET /api/projects` | archived project filtering hides expected lane | yes | yes, structured project list semantics | clear empty/missing lane distinction |
| `GET /api/projects/{slug}` | requested project does not exist | yes | yes, `PROJECT_NOT_FOUND` | clear error |
| `POST /api/jobs` | invalid submission payload or archived/missing project | yes | must be normalized | clear error |
| `GET /api/jobs/{id}` | job missing after restart or result not ready yet | yes | must distinguish missing-job errors from non-terminal snapshot states (`run.state` without `run.result`) | clear error, not silent null |
| `POST /api/jobs/{id}/cancel` | cancel requested for missing or terminal job | yes | must be normalized | clear error |
| MCP projection | HTTP semantics updated but MCP still emits lowercase ad hoc strings | yes, parity test | only if updated atomically | otherwise silent cross-surface drift |

## Worktree Parallelization Strategy

| Step | Modules touched | Depends on |
|---|---|---|
| Shared contract freeze | `packages/shared/` | — |
| HTTP route reconciliation | `apps/control-plane/app/api/`, `apps/control-plane/src/lib/` | Shared contract freeze |
| MCP parity reconciliation | `apps/control-plane/app/api/` | Shared contract freeze |
| Test expansion | `apps/control-plane/app/api/`, `apps/runner-daemon/src/` | HTTP route reconciliation, MCP parity reconciliation |
| Docs and quickstart updates | `specs/014-management-api-truth/`, `docs/` | Shared contract freeze |

- **Lane A**: Shared contract freeze -> HTTP route reconciliation -> test
  expansion (sequential, shared control-plane route modules)
- **Lane B**: Docs and quickstart updates (independent after shared contract
  freeze)
- **Lane C**: MCP parity reconciliation can begin after shared contract freeze,
  but it shares `apps/control-plane/app/api/` with Lane A, so treat it as
  sequential inside Lane A unless worktree coordination is unusually careful.

Launch Lane A and Lane B in parallel after the contract freeze lands. Merge both.
Then finish remaining test work. Because HTTP and MCP both touch
`apps/control-plane/app/api/`, there is a merge-conflict risk if they proceed in
separate worktrees without strict coordination.

## Post-Design Constitution Check

- **Specification Owns Product Boundaries**: PASS. The design keeps auth and
  public exposure out of scope while documenting the resulting trust boundary.
- **Typed Contracts at Service Boundaries**: PASS. Shared Zod schemas own the
  error vocabulary, success payload shapes, and read models.
- **Providers Are Replaceable Boundaries**: PASS. The design consumes
  `RdbProvider` snapshots and route handlers without leaking SQLite specifics.
- **Runner Isolation and Secret Hygiene**: PASS. No new secret or runner-host
  coupling is introduced.
- **Verification And Documentation Before Delivery**: PASS. The design requires
  shared/control-plane/runner verification plus local quickstart docs before
  task generation.
