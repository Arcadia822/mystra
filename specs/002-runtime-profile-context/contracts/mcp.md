# MCP Contract: Runtime Config Resolution and Context Bundles

Mystra remote MCP remains the primary submission path for other agents and skills. Runtime config keeps the job submission contract small while letting Project configuration own the default image and context policy.

MVP boundary: MCP creates one Project default runtime. Future named runtime
profiles are allowed by the product model but not exposed as a first-version
management surface.

## Tool: mystra__create_context_bundle

Creates a context bundle reference.

Input mirrors `CreateContextBundleRequest` from [api.md](./api.md).

Output:

```ts
{
  contextBundle: ContextBundle;
}
```

## Tool: mystra__list_context_bundles

Lists active context bundle references, optionally including archived entries.

Input:

```ts
{
  includeArchived?: boolean;
}
```

Output:

```ts
{
  contextBundles: ContextBundle[];
}
```

## Tool: mystra__create_project

Project creation accepts runtime config:

```ts
{
  name: string;
  slug: string;
  repo: string;
  baseBranch?: string;
  defaultAgent: "codex" | "copilot";
  runtime: {
    provider: "docker";
    image: string;
    contextBundleRefs?: Array<{
      slug: string;
      required: boolean;
      accessMode: "read-only" | "job-scoped";
    }>;
    secretRefs?: Array<{
      name: string;
      mode: "env" | "file";
    }>;
    overridePolicy?: Record<string, unknown>;
  };
  metadata?: Record<string, unknown>;
}
```

Contract note:

- MCP callers must use `runtime.image`; top-level `image` is not accepted.

## Tool: mystra__submit_job

Existing job submission gains optional runtime override fields:

```ts
{
  projectId: string;
  branchName: string;
  prompt: string;
  runtime?: {
    provider?: "docker";
    image?: string;
    contextBundleRefs?: Array<{
      slug: string;
      required?: boolean;
    }>;
  };
  mergeRequest?: {
    title?: string;
    body?: string;
  };
  metadata?: Record<string, unknown>;
}
```

Rules:

- If `runtime` is omitted, Mystra uses `Project.runtime`.
- If provided, runtime overrides must be allowed by `Project.runtime.overridePolicy`.
- MVP job overrides are constrained to provider/image/context bundle references
  and metadata. MCP callers cannot override mounts, secrets, cache, or ports in
  the first version.
- Future MCP callers may select a Project-managed runtime profile, but profile
  selection must fail closed until profile management exists.
- MCP callers do not need to know runner-local paths for image or context mounting.
- Missing required context bundles reject the job or fail the run before agent execution, depending on when the bundle is resolved.

## Tool: mystra__get_job

Job snapshots include runtime resolution summary when available:

```ts
{
  job: JobRecord;
  run: RunRecord;
  project: {
    id: string;
    slug: string;
    runtime: {
      provider: string;
      image?: string;
    };
  };
  runtime?: {
    provider: string;
    environment: Record<string, unknown>;
  };
}
```

The MCP contract must not require callers to inspect runner-local image lookup logic.
