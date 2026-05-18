# MCP Contract: Project + Job Tools

Mystra exposes Streamable HTTP MCP from `apps/control-plane`.

## mystra_create_project

Input:

```ts
{
  name: string;
  slug: string;
  repo: string;
  baseBranch?: string;
  defaultAgent: "codex" | "copilot";
  image: string;
  prewarmConfig?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}
```

Output:

```ts
Project
```

Errors:

- `INVALID_PROJECT`
- `PROJECT_SLUG_CONFLICT`

## mystra_list_projects

Input:

```ts
{
  includeArchived?: boolean;
}
```

Output:

```ts
{ projects: Project[] }
```

## mystra_get_project

Input:

```ts
{
  slug: string;
}
```

Output:

```ts
Project
```

Errors:

- `PROJECT_NOT_FOUND`

## mystra_create_job

Input changes:

```ts
{
  taskId: string;
  source: "mcp";
  projectId: string;
  branchName: string;
  prompt: string;
  repo?: string;
  baseBranch?: string;
  agent?: "codex" | "copilot";
  mergeRequest?: {
    title?: string;
    body?: string;
  };
  metadata?: Record<string, unknown>;
}
```

Output:

```ts
JobSnapshot
```

Errors:

- `PROJECT_ID_REQUIRED`
- `PROJECT_NOT_FOUND`
- `PROJECT_ARCHIVED`
- `INVALID_JOB_SPEC`
