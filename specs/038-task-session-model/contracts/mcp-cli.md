# MCP and CLI Contract

HTTP is canonical. MCP and CLI are thin adapters over the same shared request/response schemas and error codes.

## MCP tools

| Tool | Purpose | Canonical operation |
|---|---|---|
| `mystra_create_task` | create an empty Task | `POST /api/tasks` |
| `mystra_list_tasks` | list Task projections | `GET /api/tasks` |
| `mystra_get_task` | inspect Task and Session summary | `GET /api/tasks/:id` |
| `mystra_create_session` | create explicit child Session | `POST /api/tasks/:id/sessions` |
| `mystra_list_sessions` | list Sessions for Task | `GET /api/tasks/:id/sessions` |
| `mystra_get_session` | inspect Session | `GET /api/sessions/:id` |
| `mystra_cancel_session` | cancel/request cancellation | `POST /api/sessions/:id/cancel` |
| `mystra_get_session_summary` | compact coordination polling | `GET /api/sessions/:id/summary` |
| `mystra_list_runners` | list stable Runners | `GET /api/runners` |
| `mystra_get_runner` | inspect stable Runner | `GET /api/runners/:id` |
| `mystra_health` | service health | existing health/control-plane endpoint |

Issue dispatch remains available through the Integration-specific MCP operation only if it maps directly to the canonical dispatch route and returns `{ task, session }`.

There is no MCP event collection/timeline tool. There are no compatibility tool names.

## CLI groups

```text
mystra tasks list
mystra tasks inspect <task-id>

mystra sessions list --task <task-id>
mystra sessions create --task <task-id> --title <text> --objective <text> [--agent] [--branch]
mystra sessions inspect <session-id>
mystra sessions wait <session-id>
mystra sessions cancel <session-id> [--reason]
mystra sessions result <session-id>
mystra sessions failure <session-id>

mystra runners list
mystra runners inspect <runner-id>
```

### Output rules

- Human-readable output labels use Task, Session and Runner only.
- JSON output is the canonical shared schema without compatibility fields.
- `sessions wait` polls the compact Session summary, not internal events.
- `sessions result` and `sessions failure` address Session evidence only.
- Task has no cancel command and no lifecycle status command.
- The old execution command group and aliases are removed from command registration and help text.

## Adapter parity tests

- Every MCP tool input validates with the same shared schema as its HTTP operation.
- Every CLI JSON output validates with the corresponding management response schema.
- Typed errors retain the canonical error code and actionable message.
- Help/tool discovery snapshots contain only Task, Session and Runner business nouns.
- Invoking removed commands/tools fails as unknown, not as a redirect.
