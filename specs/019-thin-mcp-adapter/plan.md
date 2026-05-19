# Implementation Plan: Thin MCP Adapter

**Branch**: `019-thin-mcp-adapter` | **Date**: 2026-05-17 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/019-thin-mcp-adapter/spec.md`

## Summary

Formalize Mystra's MCP route as a thin transport layer by eliminating the
largest remaining drift sources in the live implementation: duplicated tool
metadata vs dispatch wiring, route-local response wrappers without shared typed
owners, and a brittle error boundary that falls back to string-prefix decoding
and request-id loss. This slice still keeps HTTP management truth above MCP, but
it now does the structural hardening needed for that claim to be operationally
true across the full live MCP surface.

## Technical Context

**Language/Version**: TypeScript 5.9 with Node.js 24 runtime assumptions  
**Primary Dependencies**: Next.js 16 route handlers, Zod 4, Vitest 4,
`@mystra/shared`, canonical management schemas from `packages/shared/src/management.ts`,
and the current MCP route in `apps/control-plane/app/api/mcp/route.ts`  
**Storage**: SQLite-backed control-plane persistence through `RdbProvider`; the
adapter itself owns no storage  
**Testing**: `pnpm --filter @mystra/control-plane test`,
`pnpm --filter @mystra/control-plane typecheck`, `pnpm --filter @mystra/shared build`,
and focused MCP manual validation against `/api/mcp`  
**Target Platform**: repo-local and Debian-hosted control-plane MCP endpoint on
localhost or a trusted internal network  
**Project Type**: adapter-boundary and structural-hardening feature over an
existing route implementation  
**Performance Goals**: one MCP tool invocation per management action, no hidden
fan-out reads in the adapter, and explicit transport/business failure separation  
**Constraints**: HTTP management API remains product truth for canonical
management tools; MCP must not become a second business contract; route-local
operational tools must stay explicit exceptions; preserve current
`content[].text` transport wrapper for compatibility unless the canonical
meaning changes; do not reintroduce the deferred SDK-first direction after
`016` pivoted to skills  
**Scale/Scope**: one MCP route, shared contract files in `packages/shared`,
focused route/shared tests, feature-local docs, and no new persistence, package,
or publish pipeline

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Specification Owns Product Boundaries**: PASS. This slice keeps MCP scoped to
  transport adaptation and avoids auth, callback, retry, logs, or hosted API
  expansion.
- **Typed Contracts at Service Boundaries**: PASS. The feature exists to make
  transport-vs-business ownership explicit and to verify parity against shared
  management schemas.
- **Providers Are Replaceable Boundaries**: PASS. The route remains above
  `RdbProvider` and does not leak SQLite details.
- **Runner Isolation and Secret Hygiene**: PASS. The feature only observes
  existing runner/job/project state and does not widen secret movement.
- **Verification And Documentation Before Delivery**: PASS. Delivery requires
  focused parity tests, transport/business error coverage, and updated docs.

## Project Structure

### Documentation (this feature)

```text
specs/019-thin-mcp-adapter/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── contracts/
    ├── mcp-adapter-surface.md
    └── mcp-error-boundary.md
```

### Source Code (repository root)

```text
apps/control-plane/
├── app/api/mcp/route.ts
├── app/api/routes.test.ts
└── src/lib/db/
    ├── index.ts
    └── rdb-provider.ts

packages/shared/src/
├── management.ts
├── result.ts
└── index.ts

specs/007-mcp-server/
specs/014-management-api-truth/
specs/016-agent-runtime-skills/
specs/017-operator-cli-surface/
docs/LOCAL-USAGE.md
```

**Structure Decision**: Keep transport ownership local to
`apps/control-plane/app/api/mcp/route.ts`, keep business contract ownership in
`packages/shared/src/management.ts`, and treat `007`, `014`, `016`, and `017`
as upstream evidence that must stay aligned instead of being reimplemented.

## Complexity Tracking

No constitution violations require justification.

## Phase 0 Research Summary

Detailed decisions live in [research.md](./research.md).

Key conclusions:

1. `apps/control-plane/app/api/mcp/route.ts` already projects canonical project,
   job, cancel, and health behavior through MCP. `019` should backfill and tighten
   this reality, not pretend the route is greenfield.
2. The canonical management semantics now live in
   `packages/shared/src/management.ts`, while MCP still uses route-local
   JSON-RPC wrappers and `content[].text` transport envelopes. That means MCP is
   already an adapter, but the boundary should be documented and tested more
   explicitly.
3. `016-agent-runtime-skills` replaced the SDK-first direction with a skill-first
   coordinating surface. `019` must align to that current hierarchy: HTTP truth,
   skill surface, CLI surface, and MCP as thin adapter.
4. The current route tests already prove a lot of route behavior, but the main
   drift sources still live in structure: hand-written `tools/list` metadata,
   separately hand-written dispatch/parsing, route-local response wrappers, and
   a brittle error boundary.
5. A transport wrapper remaining text-based for compatibility is acceptable as
   long as the payload meaning stays canonical.

## Phase 1 Design Summary

Generated artifacts:

- [data-model.md](./data-model.md)
- [quickstart.md](./quickstart.md)
- [contracts/mcp-adapter-surface.md](./contracts/mcp-adapter-surface.md)
- [contracts/mcp-error-boundary.md](./contracts/mcp-error-boundary.md)

The implementation slice for `019` should:

1. Treat the current MCP route as an existing adapter, not a speculative new one.
2. Replace duplicated route-local tool definitions with a shared descriptor model
   that drives both `tools/list` and `tools/call`.
3. Move canonical MCP response ownership for the full live HTTP-backed surface
   into shared typed wrappers, including project creation, context bundles, and
   runner listing.
4. Preserve the current JSON-RPC and `content[].text` wrapping where clients may
   already depend on it, while continuing to validate the payload inside.
5. Harden the error boundary so business failures do not depend on string-prefix
   decoding and internal failures preserve request correlation.
6. Add or refresh parity tests and docs so future management changes cannot drift
   silently into a second MCP-only truth.

### Boundary Diagram

```text
packages/shared management schemas
  -> canonical HTTP management routes
    -> local MCP adapter
      -> repo-local skills
      -> operator CLI
      -> other MCP clients

transport concerns owned by MCP:
  jsonrpc envelope
  tools/list
  tools/call
  invalid params / unknown method / unknown tool

business concerns owned elsewhere:
  project payload meaning
  job snapshot meaning
  machine-readable management errors
  current-vs-frozen lane truth

MCP-owned operational exceptions:
  server/tool health summary
  JSON-RPC capability advertisement

shared MCP descriptor model:
  one tool definition
    -> tools/list advertisement
    -> tools/call validation + dispatch
```

## Code Evidence

- `apps/control-plane/app/api/mcp/route.ts` already validates tool arguments,
  exposes transport-local JSON-RPC errors, and reuses `projectListResponseSchema`,
  `projectDetailResponseSchema`, `jobListResponseSchema`, `cancelJobResponseSchema`,
  and `managementErrorResponseSchema` for business payload meaning.
- The same route also exposes `mystra_create_context_bundle`,
  `mystra_list_context_bundles`, `mystra_create_project`,
  `mystra_list_runners`, and `mystra_health`, so the plan must classify the
  whole live surface instead of pretending only the six core management tools
  exist.
- The largest live drift source is structural, not descriptive:
  `tools/list` metadata and `tools/call` dispatch/validation are hand-maintained
  separately inside the same route.
- `mystra_create_project` is still an adapter outlier today: HTTP returns
  `{ project }`, MCP returns a raw project payload, and shared management
  schemas do not yet define a create-project response wrapper.
- Internal MCP failures currently return `id: null`, which breaks request
  correlation for the very failures clients most need to debug.
- `apps/control-plane/app/api/routes.test.ts` already covers happy-path MCP job
  creation, job retrieval, business failures, transport invalid-params failures,
  and unknown tool/method behavior.
- `specs/014-management-api-truth/plan.md` already freezes HTTP management API as
  product truth and MCP as a projection over that truth.
- `specs/016-agent-runtime-skills/plan.md` already treats MCP as the transport
  below the repo-local skills, not the primary agent-facing contract.
- `specs/017-operator-cli-surface/plan.md` already treats CLI as another consumer
  of the canonical management API rather than an MCP-owned business surface.
- `specs/007-mcp-server/plan.md` already records the current MCP route shape and
  its compatibility constraints, including the text payload wrapper.

## What Already Exists

| Existing code / flow | Already solves | Reuse plan |
|---|---|---|
| `apps/control-plane/app/api/mcp/route.ts` | Existing MCP adapter route, tool registry, JSON-RPC envelope, and current projection logic | Keep as the implementation surface; clarify and tighten it rather than replacing it |
| `apps/control-plane/app/api/routes.test.ts` | MCP parity and transport-error regression coverage | Reuse as the main verification surface and add only missing adapter-boundary checks |
| `packages/shared/src/management.ts` | Canonical management payload and business-error schemas | Keep as the semantic owner; MCP only projects them |
| `apps/control-plane/app/api/context-bundles/route.ts`, `projects/route.ts`, and `runners/route.ts` | Existing HTTP truth for additional MCP-exposed surfaces outside the six core route mappings | Classify them explicitly so the plan matches the live MCP route |
| `specs/014-management-api-truth/` | Canonical HTTP/API truth and parity rationale | Treat as the upstream truth this feature protects |
| `specs/016-agent-runtime-skills/` | Current agent-facing skill surface over MCP | Keep as downstream evidence that MCP must stay thin |
| `specs/017-operator-cli-surface/` | Current operator-facing CLI surface over HTTP | Keep as downstream evidence that MCP is not the operator truth |

## NOT in scope

- Replacing JSON-RPC or `content[].text` transport wrapping, because the first
  slice is about business-semantic thinness, not transport redesign.
- Adding a new SDK or typed runtime package, because `016` already deferred that
  work until the management API is mature and stable.
- Adding new management capabilities that do not already exist in the canonical
  API, because this feature is about adapter hardening, not API expansion.
- Forcing route-local operational tools such as `mystra_health` into fake HTTP
  parity, because that would invent a second layer of product surface just to
  satisfy the plan wording.
- Reducing the live MCP surface in this slice, because the accepted direction is
  to harden the already-shipped surface rather than silently unship parts of it.
- Replacing HTTP as product truth, because that would violate the current control-
  plane hierarchy already locked in by `014`, `016`, and `017`.

## Implementation Order

1. Reconcile the `019` spec and docs with the current post-`016` hierarchy so MCP
   is no longer described as sitting beside a current SDK surface.
2. Build a shared MCP descriptor model that becomes the single route-local source
   for `tools/list` advertisement, validation, and dispatch wiring.
3. Add missing shared response wrappers in `packages/shared/src/management.ts`
   for the live HTTP-backed MCP surfaces that currently lack them, starting with
   project creation and extending to context-bundles / runners where needed.
4. Normalize canonical MCP projections to those shared wrappers, including
   `mystra_create_project`, context-bundle tools, and runner listing.
5. Harden the error boundary so business failures map through stable typed rules
   and internal failures preserve request ids.
6. Strengthen route/shared regression coverage for the full live tool surface,
   internal-error correlation, and expanded canonical parity.
7. Refresh quickstart/contracts/spec status after the route and tests settle.
8. Engineering review is complete before task generation. Tasks should reflect
   the structural-hardening scope accepted here.

## Verification Plan

| Surface | Evidence |
|---|---|
| Canonical MCP parity | `pnpm --filter @mystra/control-plane test -- --run app/api/routes.test.ts` |
| Control-plane type safety | `pnpm --filter @mystra/control-plane typecheck` |
| Shared contract availability | `pnpm --filter @mystra/shared test && pnpm --filter @mystra/shared build` |
| Manual MCP smoke | `curl` against `/api/mcp` for `tools/list`, one create-project flow, one create-project conflict, one create-job flow, one get-job flow, one runner list/health flow, and one invalid-params failure |

## Test Coverage Requirements

1. Add shared-contract tests in `packages/shared/src/management.test.ts` for the
   new response wrappers introduced by this slice, starting with
   `projectCreateResponseSchema` and any wrapper added for context-bundles or
   runners.
2. Add MCP regression tests in `apps/control-plane/app/api/routes.test.ts` that
   the live HTTP-backed tool set returns canonical wrapped payloads, not raw
   route-local objects.
3. Add an MCP regression test that a valid `mystra_create_project` call hitting
   slug conflict returns a canonical business error instead of falling into a
   transport-level internal error. This is a **critical regression requirement**.
4. Add regression coverage that internal MCP failures preserve the request id.
5. Extend `tools/list` coverage so the full live tool surface and lifecycle
   metadata stay observable when descriptors change.
6. Keep the existing fixture-backed skill route coverage from `016` intact and
   re-run it as downstream proof that the widened MCP hardening does not drift
   from the already-aligned skill surface.

## Risks And Mitigations

| Risk | Mitigation |
|---|---|
| `019` redefines MCP as a second business contract even though `014` already froze the truth | Keep all business semantics anchored to shared management schemas and HTTP route meanings, and classify MCP-owned operational exceptions explicitly |
| The spec still assumes an active SDK-first hierarchy | Update `019` wording to match the current post-`016` architecture before implementation |
| Adapter hardening grows without proving downstream compatibility | Reuse existing route tests, widen shared tests, and re-run the fixture-backed skill coverage from `016` |
| Transport compatibility changes break existing MCP clients | Preserve the current JSON-RPC envelope and `content[].text` wrapper unless the business payload itself changes |
| Shared contract ownership stays partial even after widening the live MCP surface scope | Add shared wrappers for all accepted HTTP-backed MCP surfaces touched by this slice |
| Error mapping stays string-prefix based and silently falls through on new domain errors | Harden the adapter boundary while the registry and wrappers are being centralized |

## Post-Design Constitution Re-Check

PASS. The plan keeps MCP thin, reuses existing canonical schemas, and strengthens
adapter clarity without widening scope into a new transport or business surface.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | — |
| Codex Review | `/codex review` | Independent 2nd opinion | 1 | ISSUES_FOUND | 10 findings, including descriptor drift, broader shared-owner gaps, error-boundary hardening, and verification depth |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | CLEAR | 8 issues/gaps reviewed, 0 unresolved, 0 critical gaps remaining after plan updates |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | — |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | — |

**CODEX:** Pushed the plan beyond minimal parity work into structural hardening: shared descriptor model, broader shared typed ownership, error-boundary hardening, and stronger verification.
**CROSS-MODEL:** Both reviews agreed on `mystra_create_project` parity and stronger verification; Codex pushed broader structural cleanup and error-boundary scope, and those recommendations were accepted.
**UNRESOLVED:** 0
**VERDICT:** ENG CLEARED + CODEX REVIEW INCORPORATED — ready for task generation.
