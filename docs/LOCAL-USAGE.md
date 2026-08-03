# Local Usage

## Start

```sh
pnpm install
pnpm dev:control-plane
```

In another terminal:

```sh
MYSTRA_RUNNER_REGISTRATION_SECRET=local-enrollment-secret \
MYSTRA_CONTROL_PLANE_URL=http://127.0.0.1:3000 \
pnpm dev:runner
```

The control plane and Runner must use the same registration secret.

## Operator CLI

Create a Task without starting execution:

```sh
pnpm operator:cli -- tasks create \
  --project PROJECT_ID \
  --objective "Investigate the failing acceptance test" \
  --json
```

Create two independent child Sessions:

```sh
pnpm operator:cli -- sessions create TASK_ID \
  --title "Reproduce" \
  --objective "Produce a deterministic reproduction" \
  --agent codex \
  --branch codex/reproduce

pnpm operator:cli -- sessions create TASK_ID \
  --title "Fix" \
  --objective "Implement and verify the correction" \
  --agent copilot \
  --branch codex/fix
```

Inspect or wait for one Session:

```sh
pnpm operator:cli -- sessions inspect SESSION_ID
pnpm operator:cli -- sessions wait SESSION_ID --interval-seconds 2 --timeout-seconds 3600
```

## Issue dispatch

```sh
pnpm operator:cli -- issues dispatch MYS-101 \
  --integration linear \
  --project mystra \
  --agent copilot \
  --branch codex/mys-101 \
  --json
```

The response contains `task.id`, `session.id`, and `created`. Repeating the same
Issue/Project dispatch returns the same pair. A conflicting branch is rejected.

## Direct HTTP

```sh
curl -sS http://127.0.0.1:3000/api/tasks
curl -sS http://127.0.0.1:3000/api/tasks/TASK_ID
curl -sS http://127.0.0.1:3000/api/tasks/TASK_ID/sessions
curl -sS http://127.0.0.1:3000/api/sessions/SESSION_ID
curl -sS http://127.0.0.1:3000/api/runners
```

## MCP

List tools:

```sh
curl -sS http://127.0.0.1:3000/api/mcp \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

Create Task, then create Session with the returned Task ID using
`mystra_create_task` and `mystra_create_session`.

## Verification

```sh
pnpm doctor
pnpm audit:task-session-terminology
pnpm typecheck
pnpm test
```

Local database path defaults to `data/mystra.db` and may be overridden with
`MYSTRA_DB_PATH`.
