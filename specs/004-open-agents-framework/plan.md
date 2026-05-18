# Implementation Plan: Open Agents Framework Reuse

**Branch**: `004-open-agents-framework` | **Date**: 2026-05-14 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/004-open-agents-framework/spec.md`

## Summary

Treat Open Agents as an upstream reference app and source architecture to fork,
map, and adapt deliberately rather than as an imaginary drop-in framework
package. The first Mystra slice is now explicitly narrowed to four outputs:
pinned upstream provenance, module inventory, fork rules, and one traceable
lifecycle/control handoff alignment slice. Repository-provider and
sandbox-provider contracts are split into `010-repo-provider-contracts` and
`011-docker-sandbox-provider` so 004 can remain the architecture gate instead of
absorbing every provider-specific requirement itself.

## Technical Context

**Language/Version**: TypeScript 5.9 with Node.js 24 runtime assumptions; Open Agents upstream currently uses a Bun/Vercel-oriented stack as the source reference rather than a direct Mystra runtime dependency
**Primary Dependencies**: Next.js 16 route handlers, React 19, Zod 4, Vitest 4, `better-sqlite3`, existing Mystra monorepo packages, and the upstream `vercel-labs/open-agents` repository as the architecture/code reference
**Storage**: Mystra persists state through `RdbProvider` with SQLite first; Open Agents upstream assumes hosted Postgres/KV-style managed services that Mystra must classify as reused concept, replaced seam, or excluded
**Testing**: Focused Vitest package tests, TypeScript typecheck, and documentation-contract review for mapping/provenance artifacts
**Target Platform**: Mystra control plane plus private Linux runner host with Docker sandbox workloads; Open Agents remains the upstream architectural reference, not the deployment target
**Project Type**: TypeScript monorepo with Next.js control plane, Node runner daemon, shared contracts, architecture ADRs, and Spec-Kit artifacts
**Performance Goals**: Preserve the existing queued-to-runner flow shape while adding provenance and boundary clarity; the first alignment slice must not require a full-repository rewrite or introduce new control-plane hops on the hot path
**Constraints**: Do not silently adopt Vercel-managed assumptions as Mystra product architecture; do not introduce MVP-excluded features; do not stall follow-on feature work on a total rewrite; preserve replaceable provider seams and local-first execution boundaries
**Scale/Scope**: Document and classify all MVP-relevant subsystems now; implement one verified lifecycle/control alignment slice first; leave deeper subsystem adoption and provider-specific contract realization for subsequent feature work once the mapping and divergences are trustworthy

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Specification Owns Product Boundaries**: PASS. The plan stays inside the existing MVP boundary and treats framework reuse as architecture alignment, not as a back door for auth, hosted workflow, logs, retry, or Kubernetes expansion.
- **Typed Contracts at Service Boundaries**: PASS. This feature adds documentation contracts for provenance, mapping, provider seams, and divergence ownership so later runtime contracts are not invented ad hoc.
- **Providers Are Replaceable Boundaries**: PASS. The plan explicitly preserves Mystra-owned provider seams where Open Agents relies on managed infrastructure.
- **Runner Isolation and Secret Hygiene**: PASS. The feature does not widen runner/task-container privileges or change secret injection rules; it only classifies upstream and local execution boundaries.
- **Verification And Documentation Before Delivery**: PASS. The first slice requires mapping artifacts, provenance records, targeted tests for any touched packages, and explicit review of downstream feature impact before task decomposition.

## Project Structure

### Documentation (this feature)

```text
specs/004-open-agents-framework/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── framework-alignment.md
│   ├── fork-rules.md
│   ├── module-inventory.md
│   └── provider-seams.md
└── checklists/
    ├── requirements.md
    └── engineering-review.md
```

### Source Code (repository root)

```text
apps/control-plane/
├── app/api/mcp/route.ts
├── app/api/jobs/**/*
└── src/lib/db/
    ├── rdb-provider.ts
    └── sqlite-provider.ts

apps/workflows/src/
└── index.ts

apps/runner-daemon/
├── src/index.ts
└── assets/container-task.sh

packages/shared/src/
├── schemas.ts
├── events.ts
└── state.ts

packages/agent-adapters/src/
└── index.ts

docs/
├── SPEC.md
├── ARCHITECTURE.md
├── ADR-0001-control-plane-runner.md
└── ADR-0004-open-agents-local-provider-boundary.md
```

**Structure Decision**: Keep the existing Mystra monorepo layout. This feature
should first produce documentation contracts and a subsystem mapping that cover
`apps/control-plane`, `apps/workflows`, `apps/runner-daemon`,
`packages/shared`, and `packages/agent-adapters`. The first code slice should
touch only the smallest necessary subset of those paths after the mapping picks
an implementation target. Do not vendor or import large Open Agents surfaces
blindly before the provenance record and seam classification exist.

## Phase 0 Research Summary

Detailed decisions live in [research.md](./research.md).

Key conclusions:

1. Open Agents must be treated as a fork/adapt reference app, not a presumed
   package dependency.
2. The strongest reusable upstream invariant is the three-layer separation:
   web/control surface, durable agent workflow, isolated execution environment.
3. Mystra already mirrors that three-layer shape structurally, but several
   implementation surfaces remain stubs or local-only replacements.
4. The largest intentional divergence is agent placement: Open Agents keeps the
   agent outside the sandbox, while Mystra's MVP currently executes Codex or
   Copilot CLI inside the task container. This must be documented explicitly,
   not mistaken for failed reuse.
5. The first alignment slice should target provenance plus one
   lifecycle/control-handoff mapping slice, not auth/UI parity, placeholder
   modules, or a full upstream port.
6. GitNexus was refreshed successfully for the current commit, and direct source
   inspection confirms that `apps/workflows` and `packages/agent-adapters` are
   still effectively placeholders.

## Phase 1 Design Summary

Generated artifacts:

- [data-model.md](./data-model.md)
- [quickstart.md](./quickstart.md)
- [contracts/framework-alignment.md](./contracts/framework-alignment.md)
- [contracts/fork-rules.md](./contracts/fork-rules.md)
- [contracts/module-inventory.md](./contracts/module-inventory.md)
- [contracts/provider-seams.md](./contracts/provider-seams.md)

The first build slice should be:

1. Record the exact upstream Open Agents source reference used for this feature.
2. Add a durable architecture mapping plus module-inventory artifact that
   classifies every MVP-relevant subsystem and marks each surface as adopt,
   extend, fork, defer, or Mystra-only extension where appropriate.
3. Add explicit fork rules and seam records for persistence, workflow, sandbox,
   repository, and agent execution boundaries, including which Mystra contract
   owns the replacement.
4. Reconcile the current repository-provider wording drift across `PRODUCT.md`,
   `PLATFORM.md`, `README.md`, and `ADR-0004` before downstream features rely on
   conflicting assumptions.
5. Choose one implementation slice that demonstrates traceable alignment at the
   lifecycle/control handoff boundary without rewriting unrelated packages.

## GitNexus / Code Evidence

- GitNexus index was stale on branch creation. It was refreshed successfully at
  the current repo state with `npm exec --yes --package gitnexus@1.6.4 -- gitnexus analyze`.
- `apps/workflows/src/index.ts` currently exports only `workflowAppName`, so
  the workflow layer exists structurally but not yet as a substantive adopted
  framework surface.
- `packages/agent-adapters/src/index.ts` currently exports only
  `agentAdaptersPackageName`, so the agent boundary is declared but not yet
  implemented.
- `apps/control-plane/app/api/mcp/route.ts` already exposes a Mystra-owned MCP
  control surface with job/project/context-bundle tools and shared schema use.
- `apps/runner-daemon/src/index.ts` shows the current execution boundary:
  register -> heartbeat -> claim -> execute, with Docker execution and runtime
  translation handled locally on the runner.
- `packages/shared/src/events.ts` defines Mystra-owned lifecycle event types,
  which means event compatibility must be mapped deliberately instead of assumed
  from an upstream package contract.

## Implementation Order

1. Establish provenance: pin the upstream Open Agents source reference and add
   the mapping, module-inventory, fork-rule, and seam artifacts defined by this
   plan.
2. Reconcile document-level architecture drift that would otherwise invalidate
   the mapping, especially repository-provider scope statements.
3. Select the first subsystem alignment slice using the mapping contract:
   the approved candidate is the lifecycle/control handoff boundary centered on
   `packages/shared/src/events.ts` and the control-plane submission handoff, not
   placeholder modules or runner execution migration.
4. Implement the minimal code/doc changes needed for that slice while preserving
   Mystra-owned provider seams and local-first execution.
5. Add or update focused tests for any touched package and record the verified
   divergence or reuse outcome.
6. Use the completed mapping to constrain follow-on specs before task
   decomposition expands into workflow, MCP, UI, or agent-adapter work.

## Verification Plan

| Surface | Evidence |
|---|---|
| Upstream provenance | Mapping artifact includes repository plus pinned revision/release and referenced upstream paths |
| Architecture mapping | Every MVP-relevant subsystem is classified in the alignment contract |
| Module inventory and fork policy | Approved first-slice surfaces have module inventory entries and explicit fork rules |
| Provider seams | `contracts/provider-seams.md` records owner contract, first implementation, and leakage guard for each seam |
| Current-code alignment | Direct source inspection remains consistent with mapping claims for `apps/control-plane`, `apps/workflows`, `apps/runner-daemon`, `packages/shared`, and `packages/agent-adapters` |
| Focused runtime/code safety | Relevant package tests for any touched implementation slice |
| Broad type safety | `pnpm typecheck` when the touched slice crosses package boundaries |

## Risks And Mitigations

| Risk | Mitigation |
|---|---|
| Framework reuse collapses into vague inspiration | Require pinned provenance plus per-subsystem mapping before implementation claims count as reuse |
| Team assumes upstream package contracts that do not exist | Treat Open Agents as source architecture/code reference until a specific reusable surface is proven |
| Mystra accidentally copies Vercel-managed assumptions | Force every managed upstream capability into reused, replaced, or excluded classification with reason |
| Agent placement divergence stays hidden | Record explicitly that Mystra's MVP agent CLI runs inside the task container, unlike Open Agents' agent-outside-sandbox design |
| Follow-on specs build on conflicting repo-provider assumptions | Reconcile `PRODUCT.md`, `PLATFORM.md`, `README.md`, and `ADR-0004` as part of the first slice |
| 004 absorbs provider-specific contract work and loses focus | Split repository and sandbox provider contracts into 010 and 011 while keeping 004 as the architecture gate |
| The feature turns into a repository rewrite | Limit the first implementation slice to one verifiable subsystem boundary and defer deeper adoption with explicit status |

## Post-Design Constitution Re-Check

PASS. The design keeps feature artifacts under
`specs/004-open-agents-framework/`, records typed documentation contracts before
changing runtime behavior, preserves Mystra-owned provider seams, does not widen
runner privileges or secret exposure, and defines explicit verification for both
documentation truthfulness and any touched code paths.

## Engineering Review

Review artifact: [checklists/engineering-review.md](./checklists/engineering-review.md)

Outcome: Proceed to tasks only after preserving the following constraints:

1. Do not force package-level dependency reuse where the upstream project only
   supports fork/adapt reuse.
2. Do not hide Mystra's agent-in-container execution model; record it as a
   deliberate divergence unless the first slice changes it.
3. Do not let workflow, MCP, UI, or adapter features invent new abstractions
   before the mapping classifies the upstream relationship.
4. Treat repository-provider wording drift as a real planning issue, not a
   cosmetic note, because it changes downstream feature assumptions.

### Step 0 Scope Challenge Outcome

Scope reduced for 004.

The approved first slice is:

1. Pin the Open Agents upstream revision and authoritative source files.
2. Produce the 004-owned module inventory and fork rules.
3. Align one real lifecycle/control handoff boundary, centered on
   `packages/shared/src/events.ts` and the control-plane submission handoff.

The following work is explicitly **not** part of 004's first slice:

- runner execution model migration inside `apps/runner-daemon/src/index.ts`
- filling out `apps/workflows/src/index.ts` into a full workflow engine
- agent-adapter runtime adoption beyond dependency notes and split planning
- broad MCP server expansion
- companion skill packaging
- control-plane UI redesign

### What Already Exists

These current surfaces already solve meaningful parts of the problem and should
be reused rather than rebuilt:

| Existing surface | Reuse in 004 |
|---|---|
| `apps/control-plane/app/api/mcp/route.ts` | Existing submission/control surface stays Mystra-owned; 004 aligns the lifecycle handoff beneath it, not MCP as a protocol |
| `packages/shared/src/events.ts` | First non-placeholder boundary for Open Agents-aligned lifecycle vocabulary |
| `apps/runner-daemon/src/index.ts` | Evidence of current execution ownership and explicit divergence; not the first migration target |
| `docs/ADR-0004-open-agents-local-provider-boundary.md` | Existing provider-boundary rationale reused as architecture baseline |
| `specs/004-open-agents-framework/research.md` | Existing repo-vs-upstream findings reused as the truth surface for package-vs-source adoption |

### Downstream Spec Split Initialization

004 now acts as the architecture gate for follow-on work. These downstream specs
should initialize from 004 outputs rather than rediscover the framework
boundary:

| Spec | Role after 004 scope reduction | Initialization dependency from 004 |
|---|---|---|
| `005-workflow-blueprint` | Build workflow provider and DAG execution | Consume pinned upstream workflow/lifecycle sources, module inventory, and fork rules before replacing `container-task.sh` |
| `006-control-plane-ui` | Improve operator UI and job visibility | Can proceed mostly in parallel; should treat 004 lifecycle vocabulary as source of truth for statuses/events |
| `007-mcp-server` | Expand remote MCP capabilities | Must treat MCP as a Mystra-owned submission shim over the 004 lifecycle boundary, not as the framework contract itself |
| `008-mcp-skills` | Add ergonomic submission/status skills | Depends on 007 tool shapes and 004 terminology for job/run/result semantics |
| `009-agent-adapters` | Define typed agent adapter contracts | Must classify each adapter surface as adopt / extend / fork using 004's inventory and fork rules before replacing hardcoded runner logic |

Initialization rule for all downstream specs:

```text
004 pinned upstream + 004 module inventory + 004 fork rules
    -> downstream spec clarification
    -> downstream plan
```

### First Slice Evidence: Lifecycle / Control Handoff

The first approved proof slice now has concrete repository evidence:

1. `packages/shared/src/events.ts` exports
   `controlPlaneLifecycleHandoffEventTypes` and `terminalRunEventTypes` so the
   control-plane boundary can use shared lifecycle vocabulary rather than
   route-local strings.
2. `apps/control-plane/app/api/mcp/route.ts` advertises that shared lifecycle
   metadata on `mystra_create_job` and `mystra_get_job` in `tools/list`.
3. Focused proof commands for this slice are:
   - `pnpm --filter @mystra/shared exec vitest run src/events.test.ts -t "exports control-plane handoff and terminal event vocabularies from the shared lifecycle schema"`
   - `pnpm --filter @mystra/control-plane exec vitest run app/api/routes.test.ts -t "advertises shared lifecycle handoff metadata in MCP tools/list"`

Deferred from this slice on purpose:

- no runner-daemon execution model migration
- no workflow engine replacement for `container-task.sh`
- no new MCP tools or transport semantics
- no repository or sandbox provider implementation work beyond the explicit 004
  artifact links consumed by 010 and 011

## Complexity Tracking

No constitution violations are required. The design intentionally favors a
small verified alignment slice, durable mapping artifacts, and explicit
divergence records over a speculative full-framework migration.
