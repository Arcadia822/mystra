# Tasks: Thin MCP Adapter

**Input**: Design documents from `/specs/019-thin-mcp-adapter/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md, contracts/

**Backfill note**: This execution record was reconstructed after a broader
hardening draft replaced the original narrower implementation checklist. The
completed scope below matches the MCP behavior that is actually landed on
`main`.

## Completed Tasks

- [x] T001 Reconfirm that the HTTP management API remains product truth and document MCP as the transport adapter in `specs/019-thin-mcp-adapter/plan.md`, `research.md`, and the feature contracts
- [x] T002 Keep the live MCP route in `apps/control-plane/app/api/mcp/route.ts` scoped to transport concerns while reusing shared schemas for project, job, context-bundle, and runner payload validation
- [x] T003 Cover the live MCP management surface in `apps/control-plane/app/api/routes.test.ts`, including `mystra_create_project`, `mystra_create_job`, `mystra_get_job`, `mystra_list_context_bundles`, `mystra_list_runners`, and `tools/list` lifecycle metadata
- [x] T004 Preserve transport-specific JSON-RPC failures for invalid params, unknown tools, and unknown methods while keeping business payloads machine-readable
- [x] T005 Keep `mystra_health` as an explicit MCP-owned operational exception rather than promoting it to a competing business contract
- [x] T006 Refresh nearby docs/status surfaces after reconciling the landed thin-adapter scope
