# Contract: Task Management and Issue-to-Task

## Shared values

```ts
type Task = {
  id: string;
  teamId: string;
  title: string;
  description: string | null;
  projectId: string | null;
  issue: {
    provider: "github" | "linear";
    connectionId: string;
    scopeExternalId: string;
    externalId: string;
    identifier: string;
  } | null;
  createdAt: string;
  updatedAt: string;
};

type ManualTaskCreateRequest = {
  title: string;              // trimmed, 1..500
  description?: string | null;// max 100000
  projectId?: string | null;
  idempotencyKey: string;     // UUID
};

type TaskUpdateRequest = {
  title?: string;
  description?: string | null;
}; // at least one; strict
```

## HTTP

### `POST /api/tasks`

Creates or safely replays a manual Task operation. Team is derived from the authenticated session.

- 201: `{ task, created: true }`
- 200: `{ task, created: false }` for the same Team/idempotency key
- 400: strict validation failure (`INVALID_TASK`)
- 404: selected Project is missing, archived or outside active Team

The body rejects Team identity and every Issue/Session/execution field.

### `GET /api/tasks`

Returns `{ tasks: Task[] }` for the active Team, newest first. It includes both Project and no-Project Tasks.

### `GET /api/tasks/{id}`

Returns:

```ts
{
  task: Task;
  issueResolution?:
    | { status: "available"; title: string; identifier: string; url: string }
    | { status: "unavailable" };
}
```

Cross-Team and missing IDs both return `TASK_NOT_FOUND`. Issue resolution failure does not change the Task response status.

### `PATCH /api/tasks/{id}`

Updates title and/or description only. Project and Issue relation keys are rejected by the strict schema.

- 200: `{ task }`
- 400: empty or invalid update
- 404: missing/cross-Team Task

### `POST /api/projects/{slug}/issues/{provider}/task`

Body:

```ts
{ externalId: string; identifier: string }
```

The server re-resolves the active Team Project, exact current connection/scope and provider Issue. It verifies provider-stable external ID before passing the fingerprint to the atomic RDB create-or-return operation.

- 201: `{ task, created: true }`
- 200: `{ task, created: false }`
- provider/auth/source errors: existing fail-closed Integration error envelope

The route never creates a Session and never writes to the external provider.

## Issue list decoration

GitHub and Linear Issue list item schemas add:

```ts
taskId?: string;
```

The value comes from one local batch query scoped by the current exact `{team, provider, connection, source scope}` and the page's external IDs after the remote list succeeds. It deliberately does not filter by Project ID: two Projects may bind the same exact source, but the exact Issue still has only one Task. The value is not sent upstream and is not an Issue cache.

## MCP

- `mystra_create_task`: `ManualTaskCreateRequest` → `{ task, created }`
- `mystra_list_tasks`: `{}` → `{ tasks }`
- `mystra_get_task`: `{ id }` → Task detail response
- `mystra_update_task`: `{ id, title?, description? }` → `{ task }`

All tools derive active Team and parse the same Zod contracts as HTTP. No Task tool accepts Session launch factors.

## CLI

```text
tasks create --title TEXT [--description TEXT] [--project PROJECT_ID]
             [--idempotency-key UUID]
tasks list
tasks inspect TASK_ID
tasks update TASK_ID [--title TEXT] [--description TEXT]
```

CLI generates a UUID when `--idempotency-key` is omitted. Supplying it makes an external retry durable. CLI calls the HTTP routes and does not reproduce relationship validation.

## UI behavior

- Primary `New` navigation resolves to `/new`.
- New form fields: title, description, optional Project only.
- Invalid title focuses title input; submission exposes text loading/error states.
- Successful manual create clears scoped draft and enters `/tasks/{id}`.
- Issue rows retain the provider link and add one Task action.
- Create success remains on the list, announces success and changes that row to `Open Task`.
- Only explicit `Open Task` navigation changes page.

## Forbidden effects

Every route/tool/UI path above has zero Session create/start/configure/cancel requests and zero provider write requests. Project and Issue references have no update contract.
