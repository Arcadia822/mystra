# Tasks: MCP Server Development

**Input**: Design documents from `/specs/007-mcp-server/`
**Prerequisites**: `spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/`

## Phase 1: Audit And Artifact Backfill

- [x] T001 Audit current MCP tool coverage in `apps/control-plane/app/api/mcp/route.ts` and `apps/control-plane/app/api/routes.test.ts`.
- [x] T002 Record the current code reality in `plan.md`, `research.md`, `data-model.md`, `quickstart.md`, and `contracts/mcp-tools.md`.

**Checkpoint**: The feature directory is an honest map of the current MCP surface.

## Phase 2: Health And Error Semantics

- [x] T003 [P] Add focused route tests in `apps/control-plane/app/api/routes.test.ts` for `mystra_health`, healthy/degraded runner projection, and JSON-RPC-style unknown-tool / invalid-request errors.
- [x] T004 [P] Add route-local Zod schemas and helpers in `apps/control-plane/app/api/mcp/route.ts` for health payloads and MCP error envelopes.
- [x] T005 Implement `mystra_health` in `apps/control-plane/app/api/mcp/route.ts` using `getDb().listRunners()` and heartbeat-age projection without changing persistence contracts.
- [x] T006 Normalize MCP route errors in `apps/control-plane/app/api/mcp/route.ts` so unknown methods/tools and invalid params return structured JSON-RPC errors without editing shared `jsonError`.

**Checkpoint**: MCP clients can ask whether Mystra is healthy and get predictable route-local errors.

## Phase 3: Output Validation And Observation Polish

- [x] T007 [P] Add route tests proving `mystra_get_task` and `mystra_list_runners` keep their current useful payloads after output validation is introduced.
- [x] T008 Validate existing MCP tool outputs in `apps/control-plane/app/api/mcp/route.ts` with route-local Zod schemas while preserving `content[].text` transport.
- [x] T009 Reconcile `spec.md` wording so workflow-blueprint association is explicitly deferred to `005-workflow-blueprint` rather than implied as silently implemented.

**Checkpoint**: The implemented MCP tools are explicit, validated, and honest about what is still deferred.

## Phase 4: Closure

- [x] T010 Update `quickstart.md`, `contracts/mcp-tools.md`, and `spec.md` to match the landed implementation details.
- [x] T011 Run focused verification: `pnpm --filter @mystra/control-plane test -- --run app/api/routes.test.ts`
- [x] T012 Run broader verification: `pnpm --filter @mystra/control-plane typecheck && pnpm --filter @mystra/control-plane build`

**Closure note (2026-05-15)**: Explicit review of the MCP closure slice found one
required fix: the route-level catch-all error path leaked internal error
messages to external MCP callers. The closure fix added a regression test and
sanitized the JSON-RPC internal-error response without widening shared HTTP
helpers used by other routes.

## Notes

- `mystra_get_task` is already materially useful because it returns the persisted `TaskSnapshot`; this feature does not need to invent a second observation store.
- `workflowBlueprintName` is intentionally deferred until `005-workflow-blueprint` defines the durable workflow contract.
