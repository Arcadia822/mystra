# MCP Tool Contract Notes

## Current First-Slice Tools

- `mystra_create_context_bundle`
- `mystra_list_context_bundles`
- `mystra_create_task`
- `mystra_create_project`
- `mystra_list_projects`
- `mystra_get_project`
- `mystra_get_task`
- `mystra_cancel_task`
- `mystra_list_runners`
- `mystra_health`

## Transport Shape

Mystra's MCP route currently returns JSON-RPC responses with tool payloads encoded
through `result.content[].text` JSON strings. The first implementation slice
preserves that transport convention so existing local clients do not break.

## Error Contract

The MCP route should return JSON-RPC-style errors for:

- unknown method
- unknown tool
- invalid params / schema validation failure

These errors should be normalized inside the MCP route instead of reusing the
shared HTTP `jsonError` helper, because that helper has wider control-plane blast
radius than this feature needs.

## Deferred Contract

`workflowBlueprintName` remains deferred until `005-workflow-blueprint` defines
the durable workflow contract that MCP can safely reference.
