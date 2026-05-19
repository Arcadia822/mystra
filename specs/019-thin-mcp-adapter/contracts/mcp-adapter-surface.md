# Contract: MCP Adapter Surface

## Purpose

Define the current MCP surface as a transport layer that is mostly an adapter
over Mystra's canonical management contract, with a small explicit subset of
MCP-owned operational tools. The adapter should derive tool advertisement and
dispatch from one shared descriptor model instead of maintaining parallel
definitions.

## Adapter Rules

1. MCP owns transport concerns such as `jsonrpc`, `id`, `method`, `tools/list`,
   `tools/call`, and transport-local validation failures.
2. Business payload meaning remains owned by the canonical management contract
   and shared schemas for canonical-management tools.
3. MCP may wrap payloads in `content[].text` for compatibility, but must not
   change the embedded business meaning.
4. New management capabilities are not complete in MCP unless they remain
   derivable from the canonical management contract.
5. MCP-owned operational tools are allowed only when they expose route-local
   operational state rather than redefining a business contract already owned by
   HTTP/shared schemas.
6. The live HTTP-backed MCP surface should reuse shared typed response wrappers
   rather than route-local response conventions.

## Route / Tool Classification

| MCP tool | Classification | Canonical truth behind it |
|---|---|
| `mystra_list_projects` | Canonical-management projection | `GET /api/projects` |
| `mystra_get_project` | Canonical-management projection | `GET /api/projects/{slug}` |
| `mystra_create_project` | Canonical-management projection | `POST /api/projects` |
| `mystra_create_job` | Canonical-management projection | `POST /api/jobs` |
| `mystra_get_job` | Canonical-management projection | `GET /api/jobs/{id}` |
| `mystra_list_jobs` | Canonical-management projection | `GET /api/jobs` |
| `mystra_cancel_job` | Canonical-management projection | `POST /api/jobs/{id}/cancel` |
| `mystra_create_context_bundle` | Canonical-management projection | `POST /api/context-bundles` |
| `mystra_list_context_bundles` | Canonical-management projection | `GET /api/context-bundles` |
| `mystra_list_runners` | Canonical-management projection | `GET /api/runners` |
| `mystra_health` | MCP-owned operational tool | No canonical HTTP management contract today; route-local health projection |

## Verification Rule

The adapter should be verified against existing route tests and focused
transport/business boundary checks in `apps/control-plane/app/api/routes.test.ts`,
including coverage that:

1. the tool classification stays honest as the route evolves,
2. the shared descriptor model keeps `tools/list` and dispatch in sync,
3. canonical MCP projections use shared typed response wrappers, and
4. internal failures preserve request correlation.
