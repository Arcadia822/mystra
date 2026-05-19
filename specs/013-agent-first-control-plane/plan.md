# Implementation Plan: Agent-First Control Plane

**Branch**: `013-agent-first-control-plane` | **Date**: 2026-05-15 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/013-agent-first-control-plane/spec.md`

## Summary

Turn Mystra's existing project/job control-plane primitives into an explicit
agent-first management hierarchy: canonical HTTP API as product truth, a local
coordinating skill surface as the default agent surface, a Debian shell
operator CLI as the operator surface, and MCP/UI as derived consumers instead
of competing truths. The implementation should not land as one giant
cross-repo rewrite.
`013` is the umbrella plan that sequences bounded child slices: `014` freezes
the canonical management contract, including the minimum project-lane identity,
shared error vocabulary, trust boundary, and canonical polling snapshot;
`015` extends richer multi-project lane behavior; `016` derives the first
coordinating skill surface for OpenClaw-style agents on the same trusted
host/network; `017` derives the operator CLI; and `018` adds the
coordination-oriented run summary model.

## Technical Context

**Language/Version**: TypeScript 5.9 with Node.js 24 runtime assumptions  
**Primary Dependencies**: Next.js 16 route handlers, Zod 4, Vitest 4,
`better-sqlite3`, `@mystra/shared`, existing MCP route handler, and future
coordinating-skill / CLI surfaces built on the same shared schemas  
**Storage**: SQLite through `RdbProvider`, with durable project, job, run,
runner, event, and result state already owned by the control plane  
**Testing**: `pnpm --filter @mystra/shared test`,
`pnpm --filter @mystra/control-plane test`,
`pnpm --filter @mystra/runner-daemon test`, and `pnpm typecheck`; add focused
skill / CLI tests when those surfaces land  
**Target Platform**: Debian-hosted Mystra control plane and runner deployment,
coordinated by OpenClaw over Lark, with at least `mystra` and `skrya` as target
projects on one host  
**Project Type**: TypeScript pnpm monorepo with a Next.js control plane, Node
runner daemon, shared Zod contracts, existing MCP adapter, and planned
agent-facing coordinating skills plus operator CLI surfaces  
**Performance Goals**: Keep core management actions available in one canonical
contract, avoid UI scraping or verbose prompt manuals for routine operations,
and preserve restart-safe retrieval of the latest durable run state and final
result  
**Constraints**: Stay within current MVP boundaries; use shared Zod contracts at
service boundaries; keep MCP as a derived transport rather than the sole product
truth; preserve durable run/result state across control-plane restart; do not
introduce caller auth, logs API, retry API, callback URLs, or UI-only
completion criteria; treat first-slice API/skill/CLI surfaces as private-ops
interfaces for localhost or trusted internal network use only until auth exists  
**Scale/Scope**: One single-node Debian deployment first, at least two managed
projects (`mystra` and `skrya`), one canonical management contract, one
coordinating skill surface, one shell-first CLI surface, and one
coordination-summary
projection model

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Specification Owns Product Boundaries**: PASS. The plan stays inside the
  current MVP: no caller auth, retry loops, callback URLs, log storage, or
  hosted-only assumptions are introduced.
- **Typed Contracts at Service Boundaries**: PASS. The plan centers shared Zod
  schemas and stable response/error envelopes for API, coordinating skills, CLI,
  and MCP
  derivations.
- **Providers Are Replaceable Boundaries**: PASS. The control-plane contract
  stays Mystra-owned and provider-neutral; repository, workflow, sandbox, and
  runner seams remain behind existing contracts.
- **Runner Isolation and Secret Hygiene**: PASS. No new secret distribution
  model is introduced; the feature consumes durable state and existing
  runtime-injected secret behavior.
- **Verification And Documentation Before Delivery**: PASS. This umbrella plan
  requires feature-local contracts plus focused shared/control-plane/runner
  verification before task decomposition and implementation closure.

## Project Structure

### Documentation (this feature)

```text
specs/013-agent-first-control-plane/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── management-contract.md
│   └── surface-hierarchy.md
└── tasks.md
```

### Source Code (repository root)

```text
apps/control-plane/
├── app/api/
│   ├── jobs/
│   ├── projects/
│   ├── runners/
│   ├── context-bundles/
│   ├── mcp/route.ts
│   └── runner/
├── app/page.tsx
└── src/

apps/runner-daemon/
└── src/

packages/shared/
└── src/
    ├── schemas.ts
    ├── result.ts
    └── ...

packages/agent-adapters/
└── src/

.agents/skills/
├── mystra-submit-implementation-request/
├── mystra-submit-user-journey/
└── mystra-check-job-status/

apps/operator-cli/                  # planned in 017
└── src/

specs/014-management-api-truth/
specs/015-multi-project-lanes/
specs/016-agent-runtime-skills/
specs/017-operator-cli-surface/
specs/018-coordination-run-summaries/
```

**Structure Decision**: `013` owns the hierarchy, sequencing, and boundary
contracts across management surfaces. Direct implementation work should stay in
bounded child specs and the existing package layout: canonical route and schema
work in `apps/control-plane` plus `packages/shared`, coordinating skill behavior
in `.agents/skills/`, and shell UX in `apps/operator-cli`.

## Complexity Tracking

No constitution violations require justification.

## Phase 0 Research Summary

Detailed decisions live in [research.md](./research.md).

Key conclusions:

1. Mystra already has the beginnings of the canonical surface in
   `apps/control-plane/app/api/projects/*`, `jobs/*`, and `runners/*`; the main
   gap is that the product hierarchy is not explicit, stable, or packaged for
   agent/runtime consumers.
2. `packages/shared/src/schemas.ts` and `packages/shared/src/result.ts` are the
   correct shared-contract owners for project, runtime, job, run, and result
   shapes. Derived surfaces should project from those contracts rather than
   redefining payloads in UI or MCP code.
3. The current MCP route is a useful adapter but not the right long-term product
   truth. It validates inputs with shared schemas, yet still returns text-wrapped
   JSON payloads via `textToolResult`, which is appropriate for transport
   compatibility but not for typed runtime ownership.
4. `013` should not be implemented as a single feature branch that rewires every
   surface simultaneously. It should sequence the child specs so `014` freezes
   the canonical contract first, then `015`, `016`, `017`, and `018` layer on
   top of it.
5. GitNexus is useful for this planning slice now that the local index was
   refreshed, but the code evidence recorded here still cites concrete source
   files so the plan remains durable if the graph drifts later.

## Phase 1 Design Summary

Generated artifacts:

- [data-model.md](./data-model.md)
- [quickstart.md](./quickstart.md)
- [contracts/management-contract.md](./contracts/management-contract.md)
- [contracts/surface-hierarchy.md](./contracts/surface-hierarchy.md)

The first implementation slice for `013` should be:

1. Freeze the canonical management action set, shared response/error vocabulary,
   minimum project-lane identity, trust boundary note, and canonical polling
   snapshot in `014-management-api-truth`.
2. Extend the same contract for richer one-host multi-project lane behavior in
   `015-multi-project-lanes` without redefining the base selection/attribution
   model already frozen by `014`.
3. Derive the first coordinating skill surface in `016-agent-runtime-skills` for the first real
   consumer, OpenClaw-style coordinating agents on the same trusted host or
   internal network.
4. Derive the shell-first operator surface in `017-operator-cli-surface`,
   including machine-readable output modes over the same canonical contract.
5. Add stable coordination/milestone projections in
   `018-coordination-run-summaries` after the underlying run/result contract is
   stable.
6. Keep MCP and UI behavior as consumers of the canonical management contract
   instead of allowing either to become a competing source of truth.

### Boundary Diagram

```text
packages/shared Zod contracts
  -> canonical management API in apps/control-plane
    -> coordinating skill surface (016)
    -> operator CLI (017)
    -> coordination summary projections (018)
    -> MCP adapter
    -> UI consumers

project + runtime + context inputs
  -> work submission
    -> durable run snapshot
      -> result reference + coordination summary

non-goals in this umbrella seam:
  UI-first management completion
  new auth/log/retry/callback product surfaces
  replacing SQLite or runner durability ownership
```

## Code Evidence

- `apps/control-plane/app/api/projects/route.ts` and
  `apps/control-plane/app/api/projects/[slug]/route.ts` already expose stable
  project CRUD entrypoints; these are the natural base for the future canonical
  management API surface.
- `apps/control-plane/app/api/jobs/route.ts` and
  `apps/control-plane/app/api/jobs/[id]/route.ts` already own job submission and
  job inspection, while `jobs/[id]/cancel/route.ts` owns the cancellation
  action.
- `apps/control-plane/app/api/mcp/route.ts` already validates MCP tool inputs
  with shared Zod schemas and reads/writes through the same `getDb()` control
  plane boundary, but returns transport-oriented text payloads. That confirms
  MCP is a useful adapter over existing truth, not the ideal owner of typed
  runtime semantics.
- `packages/shared/src/schemas.ts` already owns `projectSchema`,
  `jobSpecSchema`, `resolvedRuntimeContractSchema`, and runtime/context bundle
  shapes; `packages/shared/src/result.ts` already owns normalized terminal
  result vocabulary.
- `apps/control-plane/app/page.tsx` currently lists MCP tool names in the UI.
  That is fine as a consumer, but it is also evidence that the UI should not be
  allowed to harden its own competing management model.
- GitNexus was refreshed during this plan (`npx gitnexus analyze`), and local
  `status` is now up to date at commit `c794162`. Query quality for this repo is
  still imperfect without a force rebuild of FTS indexes, so direct source
  inspection remains the durable planning evidence.

## Implementation Order

1. Freeze the management contract, shared envelope vocabulary, minimum
   lane-selection/attribution fields, trust boundary, and canonical polling
   snapshot in `014`.
2. Add richer lane-scoped project/run/result identity in `015` without
   redefining the core management actions already frozen in `014`.
3. Build the coordinating skill surface in `016` for the first concrete
   consumer, OpenClaw-style coordinating agents on the same trusted host/network.
4. Build the shell-first CLI in `017`, with machine-readable output required for
   every inspection path.
5. Add stable coordination-oriented summary and failure projection rules in
   `018`.
6. Reconcile MCP and UI usage so they consume the same contract instead of
   preserving parallel semantics.

## Verification Plan

| Surface | Evidence |
|---|---|
| Shared contract stability | `pnpm --filter @mystra/shared test` after any schema, result-shape, or shared error-envelope change |
| Canonical management route behavior | `pnpm --filter @mystra/control-plane test` for project/job/result route behavior, trust-boundary docs, and MCP adapter parity |
| Runner durability compatibility | `pnpm --filter @mystra/runner-daemon test` when route/result changes affect runner-observed state or restart-resume semantics |
| Cross-package type safety | `pnpm typecheck` after skill/CLI or shared-contract changes |
| Cross-surface parity | One golden success scenario plus one golden error scenario asserted across API, coordinating skills, CLI JSON mode, and MCP projection |
| Restart durability | Regression test for `submit -> restart -> poll -> final result/summary` |
| One-host multi-project behavior | Automated overlap test with active `mystra` and `skrya` runs proving attribution and result isolation |
| Agent/runtime ergonomics | Skill-path validation proving structured submission, status inspection, canonical polling snapshot consumption, and result retrieval |
| Operator ergonomics | CLI tests proving inspect/list/result flows and machine-readable output parity without the UI |

## Risks And Mitigations

- **Risk**: API, MCP, coordinating skills, and CLI drift into separate response/error semantics.
  **Mitigation**: Freeze shared envelope and projection vocabulary in `014`,
  then require derived surfaces to consume it rather than redefining it.
- **Risk**: `013` becomes an umbrella spec with no enforceable implementation
  slices.
  **Mitigation**: Treat `013` as sequencing/governance only and keep actual code
  work in `014` through `018`.
- **Risk**: The future CLI or coordinating-skill path lands in an ad hoc location that does not
  match existing monorepo patterns.
  **Mitigation**: Reserve coordinating behavior for `.agents/skills/` and
  executable behavior for `apps/operator-cli`.
- **Risk**: Coordination summaries flatten too much detail or diverge from
  durable run/result truth.
  **Mitigation**: Make `018` an explicit projection layer that derives from
  existing durable run/result data instead of inventing parallel state.
- **Risk**: Coordinating skills or CLI implementations cheat by importing server internals,
  creating a secret second control plane.
  **Mitigation**: Require both surfaces to consume the canonical external API
  contract, even inside the monorepo.
- **Risk**: The first-slice surfaces are misunderstood as safe public APIs
  despite auth being out of scope.
  **Mitigation**: Freeze an explicit private-ops trust boundary in `014` and
  document it in all derived surfaces.

## Review Incorporations

Accepted review decisions now in force:

1. `013` remains governance/sequencing only, not a giant implementation slice.
2. Skill packaging beyond local repository surfaces is explicitly deferred in the
   first slice; local repository consumption is enough until `014` stabilizes
   the contract.
3. Coordinating skills and CLI must consume the canonical management API over the external
   contract, not import server internals directly.
4. `014` owns the shared management error vocabulary and envelope schema in
   `packages/shared`.
5. `017` must support machine-readable output for every inspection path.
6. Verification must include cross-surface parity, restart regression, and
   overlapping multi-project coverage.
7. `014` must expose one canonical polling snapshot/result view rather than
   letting each surface fan out reads independently.
8. `014` must freeze the minimum project-lane identity needed for selection,
   attribution, and result ownership; `015` extends that base model.
9. The first named consumer for `016` is an OpenClaw-style coordinating agent on
   the same trusted host/network.
10. First-slice API/skill/CLI surfaces are private-ops interfaces only until auth
   exists.

## What Already Exists

| Existing code / flow | Already solves | Reuse plan |
|---|---|---|
| `apps/control-plane/app/api/projects/*` | Project listing, lookup, archive/update primitives | Reuse as the base for canonical project inspection |
| `apps/control-plane/app/api/jobs/*` | Job submission, polling, cancellation primitives | Reuse as the base for work submission and run observation |
| `apps/control-plane/app/api/mcp/route.ts` | Existing adapter surface over shared schemas and `getDb()` | Keep as a derived adapter, do not let it own truth |
| `packages/shared/src/schemas.ts` | Shared project, runtime, job, context schemas | Extend for error envelopes and management projection schemas |
| `packages/shared/src/result.ts` | Normalized terminal result vocabulary | Reuse as the base for result retrieval and coordination projections |
| `apps/control-plane/app/page.tsx` | Existing UI consumer of control-plane state | Keep as a consumer only, not a contract owner |

## Test Coverage Diagram

```text
CODE PATH COVERAGE
===========================
[+] Canonical management contract (014)
    │
    ├── list/get project
    │   ├── [REQUIRED] success path with minimum lane identity
    │   └── [REQUIRED] missing/archived project shared error envelope
    │
    ├── submit work
    │   ├── [REQUIRED] durable handle + initial state
    │   └── [REQUIRED] invalid submission shared error envelope
    │
    └── get run/result snapshot
        ├── [REQUIRED] canonical polling snapshot success path
        ├── [REQUIRED] result-not-ready vs result-missing vs terminal-failed
        └── [REQUIRED] restart-resume regression

[+] Derived surfaces
    │
    ├── coordinating skills (016)
    │   └── [REQUIRED] submission/status parity with canonical API for one success + one error
    ├── CLI JSON mode (017)
    │   └── [REQUIRED] machine-readable parity with canonical API for one success + one error
    └── MCP adapter
        └── [REQUIRED] projection parity with canonical API for one success + one error

USER FLOW COVERAGE
===========================
[+] OpenClaw-style coordination flow
    │
    ├── [REQUIRED] choose `mystra` vs `skrya`
    ├── [REQUIRED] inspect selected project context
    ├── [REQUIRED] submit work and start polling
    ├── [REQUIRED] restart control plane mid-flow and resume
    └── [REQUIRED] retrieve final result + coordination summary

[+] One-host overlap flow
    │
    └── [REQUIRED] active runs for `mystra` and `skrya` stay attributable through status, result, and summary

─────────────────────────────────
COVERAGE TARGET: 100%
CRITICAL REQUIRED TESTS: parity, restart regression, overlap isolation
─────────────────────────────────
```

## Failure Modes

| Codepath | Real production failure | Test required? | Error handling required? | Silent failure allowed? |
|---|---|---:|---:|---:|
| Project selection | Archived or ambiguous target chosen for submission | Yes | Yes | No |
| Run polling | Surface fans out reads and returns stale/mismatched state | Yes | Yes | No |
| Restart resume | Control plane restarts and polling loses latest durable state | Yes | Yes | No |
| Multi-project overlap | `mystra` run returns `skrya` context/result metadata | Yes | Yes | No |
| CLI JSON output | Human formatting diverges from canonical payload semantics | Yes | Yes | No |
| Coordination summary | Summary says success while underlying result is missing/failed | Yes | Yes | No |

## NOT in scope

- Public internet exposure for management API/skill/CLI, because caller auth is
  still outside the MVP boundary.
- Artifact distribution pipeline for skill/CLI packaging beyond local repository
  use, because first-slice consumption is private-ops only until the canonical
  contract stabilizes.
- Replacing MCP with a new transport model, because MCP remains a supported
  adapter over the same contract.
- Replacing SQLite or runner durability ownership, because earlier specs already
  established those seams and this feature should consume them, not relitigate
  them.
- UI-first management completion, because the feature succeeds only when the
  programmatic surfaces are complete first.

## Worktree Parallelization Strategy

| Step | Modules touched | Depends on |
|---|---|---|
| 014 canonical API freeze | `apps/control-plane/app/api`, `packages/shared` | — |
| 015 richer multi-project lanes | `apps/control-plane/app/api`, `packages/shared`, `apps/runner-daemon/src` | 014 |
| 016 coordinating skills | `.agents/skills`, `packages/shared` | 014 |
| 017 operator CLI | `apps/operator-cli`, `packages/shared` | 014 |
| 018 coordination summaries | `apps/control-plane/app/api`, `packages/shared`, possible `apps/operator-cli` formatting consumers | 014, and ideally 015/016/017 contracts stabilized |

Parallel lanes:

- **Lane A**: `014` (must go first, foundational)
- **Lane B**: `015` after `014` (sequential with API/shared changes)
- **Lane C**: `016` after `014` (parallel-capable)
- **Lane D**: `017` after `014` (parallel-capable)
- **Lane E**: `018` after `014`, ideally after `015` plus the first skill/CLI contract settle

Execution order:

1. Launch `014` first.
2. After `014` lands, launch `015`, `016`, and `017` in parallel worktrees.
3. Merge `016` and `017` as they finish.
4. Start `018` once the canonical polling snapshot and lane attribution model are stable.

Conflict flags:

- `015` and `018` both touch `apps/control-plane/app/api` and `packages/shared`,
  so they should not run blindly in parallel.
- `016` and `017` both depend on shared contract details, but touch different
  primary modules; they are the safest parallel pair after `014`.

## Post-Design Constitution Check

- **Specification Owns Product Boundaries**: PASS. The generated design still
  stays inside the current MVP and does not add excluded product surfaces.
- **Typed Contracts at Service Boundaries**: PASS. The generated contracts keep
  `packages/shared` and canonical route envelopes as the typed source of truth
  for all derived surfaces.
- **Providers Are Replaceable Boundaries**: PASS. No provider-specific product
  truth is introduced; this feature only reorganizes management surfaces over
  existing Mystra-owned seams.
- **Runner Isolation and Secret Hygiene**: PASS. The design consumes existing
  runner/runtime behavior and does not widen the secret model.
- **Verification And Documentation Before Delivery**: PASS. The plan includes
  feature-local research, data model, contracts, quickstart, and explicit
  verification requirements before tasks/implementation.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | — |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | — | — |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | CLEAR | 8 issues, 0 critical gaps |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | — |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | — |

- **OUTSIDE VOICE:** Claude fallback ran for `codex-plan-review`; 3 structural findings were accepted into the plan: minimum lane identity moves into `014`, private-ops trust boundary is explicit, and `016` names OpenClaw-style agents as the first real consumer.
- **UNRESOLVED:** 0
- **VERDICT:** ENG CLEARED — ready to decompose into tasks. No public-distribution or caller-auth work should sneak back into scope before implementation.
