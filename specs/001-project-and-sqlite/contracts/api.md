# API Contract: Project + SQLite Persistence

> Reconciliation note: Core Project/task persistence from this contract is implemented. Runtime field shape was refined by `../../002-runtime-profile-context/contracts/api.md`; use that contract as authoritative for `Project.runtime` and resolved runtime payloads.

All error responses use:

```json
{
  "error": {
    "code": "string",
    "message": "string"
  }
}
```

## Project Object

```ts
type Project = {
  id: string;
  name: string;
  slug: string;
  repo: string;
  baseBranch: string;
  defaultAgent: "codex" | "copilot";
  runtime: {
    provider: "docker";
    image: string;
  };
  prewarmConfig: Record<string, unknown>;
  metadata: Record<string, unknown>;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};
```

## POST /api/projects

Request:

```json
{
  "name": "Castrel AI",
  "slug": "castrel-ai",
  "repo": "git@gitlab.example.com:team/castrel-ai.git",
  "baseBranch": "main",
  "defaultAgent": "codex",
  "runtime": {
    "provider": "docker",
    "image": "registry.example.com/castrel-ai/mystra-runner:latest"
  },
  "prewarmConfig": {},
  "metadata": {}
}
```

Responses:

- `201 { project: Project }`
- `400 INVALID_PROJECT`
- `409 PROJECT_SLUG_CONFLICT`

## GET /api/projects

Response:

- `200 { projects: Project[] }`

No pagination in MVP.

## GET /api/projects/{slug}

Responses:

- `200 { project: Project }`
- `404 PROJECT_NOT_FOUND`

## PATCH /api/projects/{slug}

Request: partial editable Project fields:

```json
{
  "name": "Castrel AI",
  "baseBranch": "main",
  "defaultAgent": "copilot",
  "runtime": {
    "provider": "docker",
    "image": "registry.example.com/castrel-ai/runtime:v2"
  },
  "prewarmConfig": {},
  "metadata": {},
  "archivedAt": null
}
```

Responses:

- `200 { project: Project }`
- `400 INVALID_PROJECT_UPDATE`
- `404 PROJECT_NOT_FOUND`
- `409 PROJECT_SLUG_CONFLICT`

## DELETE /api/projects/{slug}

Soft archive only.

Responses:

- `200 { project: Project }` with `archivedAt` set
- `404 PROJECT_NOT_FOUND`

## POST /api/tasks

Request:

```json
{
  "taskId": "CAST-123",
  "source": "api",
  "projectId": "uuid",
  "branchName": "mystra/CAST-123",
  "prompt": "Implement the requested change.",
  "repo": "optional override",
  "baseBranch": "optional override",
  "agent": "codex",
  "mergeRequest": {
    "title": "optional MR/PR title",
    "body": "optional MR/PR body"
  },
  "metadata": {}
}
```

Responses:

- `201 TaskSnapshot`
- `400 PROJECT_ID_REQUIRED`
- `400 PROJECT_NOT_FOUND`
- `400 PROJECT_ARCHIVED`
- `400 INVALID_TASK_SPEC`

## GET /api/tasks/{id}

Response:

- `200 TaskSnapshot`
- `404 TASK_NOT_FOUND`

## POST /api/tasks/{id}/cancel`

Response:

- `200 CancelTaskOutcome`
- `404 TASK_NOT_FOUND`
