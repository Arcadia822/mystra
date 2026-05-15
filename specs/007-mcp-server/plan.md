# Implementation Plan: MCP Server Development

**Branch**: `007-mcp-server` | **Date**: 2026-05-15 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/007-mcp-server/spec.md`

## Summary

Backfill the missing Spec-Kit planning surface for the existing MCP route, then
close the smallest remaining MVP gaps without widening into unfinished workflow
blueprint work. Current code already exposes nine MCP tools and can submit,
inspect, cancel, and list core Mystra resources. The main remaining gaps are a
first-class `mystra_health` tool plus MCP-local error/output contracts that are
more explicit and harder for clients to misuse.

## Technical Context

**Language/Version**: TypeScript 5.9 with Node.js 24 runtime assumptions
**Primary Dependencies**: Next.js 16 route handlers, Zod 4, Vitest 4,
`@mystra/shared`, existing `RdbProvider`/`SqliteRdbProvider`
**Storage**: SQLite through `getDb()` and `RdbProvider`
**Testing**: `pnpm --filter @mystra/control-plane test`, `typecheck`, `build`
**Target Platform**: Local control plane route at `apps/control-plane/app/api/mcp/route.ts`
**Constraints**: Keep MCP a Mystra-owned shim; do not invent workflow blueprint
storage before `005-workflow-blueprint` exists; preserve existing tool payloads
where they already satisfy current clients; avoid high-blast-radius shared error
changes when MCP-local handling is sufficient
**Scale/Scope**: One route handler, focused route tests, feature-doc backfill,
no new persistence layer

## Constitution Check

*GATE: Must pass before implementation. Re-check after design.*

- **Specification Owns Product Boundaries**: PASS. The first slice closes
  current MCP ergonomics gaps without widening MVP into blueprint orchestration.
- **Typed Contracts at Service Boundaries**: PASS, and this is the main gap to
  strengthen. MCP inputs already use Zod; outputs and error envelopes need more
  explicit route-local contracts.
- **Providers Are Replaceable Boundaries**: PASS. MCP stays above `RdbProvider`
  and does not leak SQLite specifics.
- **Runner Isolation and Secret Hygiene**: PASS. Health/reporting surfaces use
  existing runner metadata only.
- **Verification And Documentation Before Delivery**: PASS after this backfill.

## Code Evidence

- `apps/control-plane/app/api/mcp/route.ts` currently implements 9 tools:
  create/list context bundles, create/list/get projects, create/get/cancel jobs,
  and list runners.
- `apps/control-plane/src/lib/db/rdb-provider.ts` already exposes the data needed
  for MCP health and job observation: `getJob()`, `listRunners()`,
  `markStaleRunners()`, `lastHeartbeatAt`, and `staleAfterSeconds`.
- `apps/control-plane/app/api/routes.test.ts` already proves MCP creation,
  runtime validation, lifecycle metadata exposure, and route-level runner/job
  observation paths.
- `mystra_get_job` already returns the full `JobSnapshot` shape from persistence,
  so the remaining observation gap is contract clarity, not missing DB data.

## Impact Analysis Note

GitNexus audit on 2026-05-15:

- `textToolResult` upstream impact: **LOW** (only the MCP `POST` route)
- `jsonError` upstream impact: **CRITICAL** (shared by multiple control-plane
  routes)

Implementation consequence: keep MCP-specific error normalization inside
`apps/control-plane/app/api/mcp/route.ts` and avoid changing
`apps/control-plane/src/lib/http.ts:jsonError` in this slice.

## Design Decisions

1. **Add health as a route-local tool, not a new REST endpoint.** `mystra_health`
   exists to help MCP clients decide whether to submit work; it can be composed
   from current control-plane and runner state.
2. **Preserve existing successful tool payloads where practical.** Existing MCP
   clients already parse the current text payload convention, so the first slice
   should validate and normalize payloads without gratuitous response-shape churn.
3. **Treat workflow blueprint association as deferred dependency work.** The
   spec mentions blueprint names, but `005-workflow-blueprint` is still draft. Do
   not fake persistence that the platform does not yet own.
4. **Keep error semantics MCP-local.** Unknown methods/tools and invalid params
   should return JSON-RPC-style error objects from the MCP route without changing
   generic HTTP helpers used elsewhere.

## Planned Slices

1. **Contract backfill**: add plan/tasks/docs and reconcile the spec against
   current 9-tool reality plus deferred workflow-blueprint dependency.
2. **Health + error slice**: add `mystra_health`, stale-runner health
   classification, and MCP-local structured error responses.
3. **Output-validation slice**: validate the existing MCP payloads returned for
   job/project/runner/context operations without changing their meaning.
4. **Closure docs + verification**: update quickstart/contracts/spec status,
   rerun focused control-plane checks, and explicitly record any deferred items.

## Risks And Mitigations

| Risk | Mitigation |
|---|---|
| MCP error handling change accidentally alters non-MCP HTTP routes | Keep all error normalization local to `app/api/mcp/route.ts`; do not edit shared `jsonError` |
| Health semantics drift from runner durability behavior | Derive health from persisted `lastHeartbeatAt` and `staleAfterSeconds` already used by durability logic |
| Existing MCP clients depend on current text payload shape | Preserve `content[].text` transport and keep payload fields additive |
| Spec demands blueprint association before workflow surfaces exist | Record it as deferred to `005-workflow-blueprint` instead of inventing partial storage |

## Verification Plan

| Surface | Evidence |
|---|---|
| MCP route behavior | `pnpm --filter @mystra/control-plane test -- --run app/api/routes.test.ts` |
| Control-plane type safety | `pnpm --filter @mystra/control-plane typecheck` |
| Control-plane build safety | `pnpm --filter @mystra/control-plane build` |

## Post-Design Constitution Re-Check

PASS. The planned slice strengthens MCP as a typed service boundary, keeps scope
inside current MVP surfaces, and avoids smuggling unfinished workflow concepts
into persistence.
