# Contract: Agent Management

Base path: `/api/agents`

Authentication uses the existing human bearer/session contract. Team scope always comes from the active Team; request bodies never accept `teamId`.

## Types

```ts
type Agent = {
  id: string;
  teamId: string;
  name: string;
  systemPrompt: string;
  revision: number;
  status: "active" | "archived";
  archivedAt?: string;
  createdAt: string;
  updatedAt: string;
};
```

## Create

`POST /api/agents`

```json
{ "name": "Reviewer", "systemPrompt": "Review changes clinically." }
```

Response `201`:

```json
{ "agent": { "id": "...", "teamId": "...", "name": "Reviewer", "systemPrompt": "Review changes clinically.", "revision": 1, "status": "active", "createdAt": "...", "updatedAt": "..." } }
```

Permission: `team.settings.manage`.

## List

`GET /api/agents?limit=50&cursor=<opaque>&includeArchived=false`

Response `200`:

```json
{ "agents": [], "nextCursor": null }
```

Permission: `team.resource.access`. Results never cross active Team. `includeArchived` defaults false.

## Get

`GET /api/agents/{agentId}`

Returns active or archived Agent in the active Team. Cross-Team IDs are indistinguishable from missing IDs.

## Update

`PATCH /api/agents/{agentId}`

```json
{ "expectedRevision": 3, "name": "Strict Reviewer", "systemPrompt": "Review every changed contract." }
```

At least one of `name` or `systemPrompt` is required. Prompt change increments revision exactly once; rename-only keeps revision unchanged.

Permission: `team.settings.manage`.

## Archive

`POST /api/agents/{agentId}/archive`

```json
{ "expectedRevision": 4 }
```

Returns the archived Agent. Archived records remain readable but cannot be updated or resolved for a new Session.

## Errors

```json
{ "error": { "code": "AGENT_REVISION_CONFLICT", "message": "..." } }
```

| Code | HTTP | Meaning |
| --- | ---: | --- |
| `INVALID_AGENT` | 400 | strict schema or prompt/name validation failed |
| `AGENT_NOT_FOUND` | 404 | missing or outside active Team |
| `AGENT_ARCHIVED` | 409 | update/resolve attempted on archived Agent |
| `AGENT_REVISION_CONFLICT` | 409 | expected revision is stale |
| existing auth codes | 401/403 | unauthenticated or insufficient permission |

## MCP tools

- `mystra_create_agent`
- `mystra_list_agents`
- `mystra_get_agent`
- `mystra_update_agent`
- `mystra_archive_agent`

Inputs and outputs mirror the shared Agent schemas. MCP returns stable domain errors as tool text results; malformed JSON-RPC parameters remain `-32602`.

## CLI

```text
mystra agents list [--limit N] [--cursor ID] [--include-archived] [--json]
mystra agents inspect <agent-id> [--json]
mystra agents create --name NAME --system-prompt TEXT [--json]
mystra agents update <agent-id> --expected-revision N [--name NAME] [--system-prompt TEXT] [--json]
mystra agents archive <agent-id> --expected-revision N [--json]
```

CLI does not add Agent semantics; it only issues authenticated requests to these endpoints.
