# Implementation Plan: Product Surface Positioning

**Branch**: `021-product-surface-positioning` | **Date**: 2026-05-18 | **Spec**: [`spec.md`](./spec.md)
**Input**: Feature specification from `/specs/021-product-surface-positioning/spec.md`

## Summary

Plan 021 as a terminology-migration feature, not a product-model redesign. The active slice performs a direct `Job* -> Task*` cut across current repository surfaces: 5xP wording, historical specs, public contracts, and core exported/function naming that already exists today. It explicitly excludes page redesign, page IA, and object-structure definition.

The implementation approach is documentation-first and contract-aware:

1. Normalize durable docs and historical specs so they stop using `workspace` as an aspirational tenancy object.
2. Preserve runtime `workspace` wording where it already names the execution directory, mount, or path surface.
3. Rename job-centric public/core names in one coordinated hard cut, using `contracts/terminology-migration.md` as the single normative source for batch rules and rename-matrix inventory.
4. Keep future-only object design and page/object-model design out of scope, but do not use compatibility aliases for current repository surfaces.

## Technical Context

**Language/Version**: TypeScript 5.9, Markdown feature artifacts, Node.js 24 runtime assumptions  
**Primary Dependencies**: Next.js 16, React 19, Zod 4, Vitest 4, pnpm workspace tooling  
**Storage**: Markdown Spec-Kit artifacts plus SQLite-backed runtime/provider contracts already modeled behind `RdbProvider`  
**Testing**: Vitest, `pnpm --filter @mystra/shared {build,test,typecheck}`, `pnpm --filter @mystra/control-plane {build,test,typecheck}` when contract surfaces change  
**Target Platform**: Mystra monorepo covering durable docs, shared contracts, and control-plane/runner TypeScript packages  
**Project Type**: Monorepo with documentation, shared library contracts, and Next.js control-plane service  
**Performance Goals**: Preserve current API/MCP/runtime behavior; terminology migration must not add runtime hops or change runner hot-path semantics  
**Constraints**: No MVP boundary expansion; no page redesign; no object-structure redesign; no compatibility aliases or dual naming for current repository surfaces; repository-wide rename must not leave mixed `Job*` / `Task*` semantics behind  
**Scale/Scope**: 5xP files, `README.md`, current feature specs, shared schemas, control-plane API/MCP naming, DB/provider method naming, runner-facing current code surfaces, and later internal cleanup for implementation-local names

## Test Strategy

Current job-facing surfaces already have focused coverage in shared and control-plane tests. The plan must preserve that baseline and add explicit regression requirements for the direct hard cut so the repository does not retain mixed naming.

```text
Regression gate
===============

Current `Job*` symbol found?
    |
    +--> no ----------------> existing tests sufficient
    |
    +--> yes ---------------> direct rename + regression test proving `Task*` surface works
```

Required test additions for the direct-cut execution slice:

1. **Shared schema regression**: if `JobSpec` or related exported contract names change, add tests proving the renamed `Task*` contract preserves the intended payload shape and validation semantics.
2. **HTTP route regression**: if `/api/jobs` changes to `/api/tasks`, add tests proving the new route is the only supported route and behaves correctly end to end.
3. **MCP tool regression**: if `mystra_create_job` or related tool names change, add tests proving the renamed tool surface works and no old name remains in the supported interface.
4. **Provider/core function regression**: if `createJob`/`getJob`/`listJobs`/`cancelJob` or similar outward/core names change, add focused tests proving renamed lifecycle semantics remain stable.
5. **Repository consistency regression**: add a focused check or test proving no supported public surface in the touched scope still exposes `Job*` naming after the cut.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Pre-research check**

- **Specification Owns Product Boundaries**: Pass. The feature remains terminology-only and keeps the MVP intake path text-first. No excluded MVP capability is added.
- **Typed Contracts at Service Boundaries**: Pass with caution. Any outward/core rename touching Zod schemas, API routes, MCP tool names, or persisted labels must be renamed in one coordinated pass and backed by regression tests.
- **Providers Are Replaceable Boundaries**: Pass. Provider seams remain explicit; the plan only renames stable surfaces around them and does not collapse provider boundaries.
- **Runner Isolation and Secret Hygiene**: Pass. No isolation or secret-handling change is introduced.
- **Verification And Documentation Before Delivery**: Pass. The feature is documentation-heavy and contract-sensitive, so the plan includes repo artifact updates plus focused shared/control-plane verification when code-facing names eventually change.

**Post-design check**

- Still pass, provided the direct cut is repository-wide on current surfaces and does not invent page or object-model scope.
- No plan artifact may leave mixed `Job*` / `Task*` public naming behind after implementation.

## Project Structure

### Documentation (this feature)

```text
specs/021-product-surface-positioning/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── terminology-migration.md
├── checklists/
│   └── requirements.md
└── tasks.md             # Not created yet
```

### Source Code (repository root)

```text
PRODUCT.md
PLATFORM.md
PROCESS.md
README.md

packages/shared/src/
├── schemas.ts
├── result.ts
├── sandbox.ts
└── index.ts

apps/control-plane/
├── app/api/jobs/
├── app/api/mcp/
├── app/page.tsx            # Evidence-only unless a later task explicitly allows label changes
└── src/lib/db/
    ├── rdb-provider.ts
    └── sqlite-provider.ts

apps/runner-daemon/src/
├── index.ts
├── workflow-providers.ts
└── repo-providers/

specs/
├── 002-runtime-profile-context/
├── 007-mcp-server/
├── 008-mcp-skills/
├── 010-repo-provider-contracts/
├── 013-agent-first-control-plane/
├── 014-management-api-truth/
└── 021-product-surface-positioning/
```

**Structure Decision**: Plan the migration from the outside in. Start with durable docs and active feature artifacts, then move to shared/public contract surfaces in `packages/shared`, `apps/control-plane`, and current runner-facing code surfaces, and only then allow internal mechanical cleanup in implementation-local names. `apps/control-plane/app/page.tsx` stays evidence-only in this phase because the current-page surface is explicitly out of scope. All batch rules, protected meanings, and rename-matrix policy live in `contracts/terminology-migration.md`; this plan references that contract instead of re-defining it.

## What Already Exists

- `packages/shared/src/schemas.ts` and `packages/shared/src/schemas.test.ts` already centralize the shared submission contract and its validation coverage.
- `apps/control-plane/app/api/jobs/route.ts`, `apps/control-plane/app/api/mcp/route.ts`, and `apps/control-plane/app/api/routes.test.ts` already centralize the public HTTP and MCP naming surface plus route-level regression coverage.
- `apps/control-plane/src/lib/db/rdb-provider.ts` and `apps/control-plane/src/lib/db/sqlite-provider.test.ts` already centralize the core provider lifecycle names and their persistence semantics.
- 5xP files plus historical specs already contain the durable wording conflicts this feature needs to reconcile. The plan reuses those artifacts as the authoritative migration inventory instead of inventing a parallel terminology registry.

## NOT in Scope

- Redesigning current pages or page IA, because the owner explicitly plans to redo the page surface later.
- Defining product object hierarchy or ownership structure, because this feature is terminology migration, not domain modeling.
- Introducing issue-id intake or other non-text submission modes, because MVP intake stays text-first in this round.
- Inventing names for future-only objects that do not yet exist in the repository, because that would turn terminology cleanup into speculative product design.
- Adding compatibility aliases, dual routes, or dual tool names, because the project is pre-launch and the chosen plan is a direct cut.

## Failure Modes

| Surface | Realistic failure | Test coverage required | Error handling expectation | User-visible outcome |
|---|---|---|---|---|
| Shared schema rename | `TaskSpec` accepts or rejects a different payload shape than `JobSpec` did | Shared schema regression tests | Validation errors must stay explicit | Clear validation failure, not silent coercion |
| HTTP route rename | callers still hit `/api/jobs` after the cut and get an unclear failure | Route regression tests for `/api/tasks` plus absence of legacy support | Route layer should return explicit not-found or method errors | Clear failure, not silent no-op |
| MCP tool rename | agent/tool clients keep calling `mystra_create_job` and silently miss the new entrypoint | MCP regression tests for supported `Task*` names | Unsupported tool names must fail explicitly | Clear tool error, not silent ignore |
| Provider/core rename | renamed provider methods drift from persisted lifecycle semantics | Provider regression tests | Storage/provider errors must propagate cleanly | Explicit failure in tests and runtime logs |
| Mechanical cleanup | a leftover `Job*` symbol remains on a supported public path after Batch C | Repository consistency check or focused grep-backed test | Build/test should fail on mixed public naming | No silent mixed naming allowed |

## Worktree Parallelization Strategy

| Step | Modules touched | Depends on |
|---|---|---|
| Batch A docs/spec wording | repo root docs, `specs/` | — |
| Batch B shared/control-plane contract rename | `packages/shared/`, `apps/control-plane/` | Batch A rename matrix finalized |
| Batch B runner-facing rename follow-through | `apps/runner-daemon/`, shared contract consumers | Batch B shared/control-plane contract rename |
| Batch C internal/mechanical cleanup | touched implementation modules and tests | Batch B contract rename |

- **Lane A**: Batch A docs/spec wording, sequential inside docs/spec artifacts.
- **Lane B**: Batch B shared/control-plane contract rename, starts after Batch A naming inventory is fixed.
- **Lane C**: Batch B runner-facing rename follow-through, starts after Lane B because it consumes renamed contracts.
- **Lane D**: Batch C internal/mechanical cleanup, starts after Lanes B and C settle.

Execution order: Lane A first. Then launch the shared/control-plane contract lane. After that merge point, run runner-facing follow-through and internal cleanup in sequence because they both depend on the renamed contract surface.

Conflict flags: `packages/shared/` is a shared dependency for the contract and runner-facing lanes, so those lanes should not run in parallel before the shared rename lands.

## Complexity Tracking

No constitution violations are currently justified.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | — |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | — | — |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | CLEAR | 3 issues resolved, 0 critical gaps |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | — |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | — |

- **UNRESOLVED:** 0
- **VERDICT:** ENG CLEARED — ready for `/speckit.tasks`
- **NOTE:** gstack review log binaries were unavailable in this environment, so this report was written directly into the plan instead of being synced from `gstack-review-read`.
