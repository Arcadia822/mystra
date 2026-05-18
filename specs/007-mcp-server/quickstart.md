# Quickstart: MCP Server Development

## Current Tool Surface

Start the control plane:

```sh
pnpm dev:control-plane
```

Initialize MCP:

```sh
curl -sS -X POST http://localhost:3000/api/mcp \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":"init","method":"initialize"}'
```

List tools:

```sh
curl -sS -X POST http://localhost:3000/api/mcp \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":"tools","method":"tools/list"}'
```

## Health Smoke

```sh
curl -sS -X POST http://localhost:3000/api/mcp \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":"health","method":"tools/call","params":{"name":"mystra_health","arguments":{}}}'
```

Expected after the health slice lands:

- `controlPlane.status` is `healthy`
- runner counts reflect persisted runner sessions
- stale runners appear as `degraded`

## Task Observation Smoke

After creating a task through HTTP or `mystra_create_task`, poll:

```sh
curl -sS -X POST http://localhost:3000/api/mcp \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":"task","method":"tools/call","params":{"name":"mystra_get_task","arguments":{"taskId":"<task-id>"}}}'
```

Expected:

- payload includes the persisted task/run snapshot
- events are present when the runner has emitted them
- `run.result` appears after terminal completion

## Focused Verification

```sh
pnpm --filter @mystra/control-plane test -- --run app/api/routes.test.ts
pnpm --filter @mystra/control-plane typecheck
pnpm --filter @mystra/control-plane build
```

## Verification Note

Verified on 2026-05-15:

- `pnpm --filter @mystra/control-plane test -- --run app/api/routes.test.ts`
- `pnpm --filter @mystra/control-plane typecheck`
- `pnpm --filter @mystra/control-plane build`
