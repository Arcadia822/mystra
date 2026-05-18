# API Contract: Runtime Config Resolution and Context Bundles

This contract describes the intended HTTP API shape. Exact route handler files may evolve during implementation, but request and response semantics must stay consistent.

## Project Runtime Config

Project create/update accepts a typed runtime object:

```ts
type ProjectRuntimeConfig = {
  provider: "docker";
  image: string;
  contextBundleRefs?: Array<{
    slug: string;
    required: boolean;
    accessMode: "read-only" | "job-scoped";
  }>;
  mounts?: Array<{
    kind: "workspace" | "gitMirror" | "cache" | "contextBundle" | "secret";
    owner?: "system" | "project" | "runtime";
    target: string;
    sourceRef?: string;
    readOnly?: boolean;
  }>;
  exposedPorts?: Array<{
    containerPort: number;
    hostBinding?: string;
    name?: string;
  }>;
  cache?: {
    coldStartAllowed?: boolean;
    entries?: Array<{
      kind: string;
      target: string;
    }>;
  };
  secretRefs?: Array<{
    name: string;
    mode: "env" | "file";
  }>;
  overridePolicy?: {
    allowImageOverride?: boolean;
    allowContextBundleAdditions?: boolean;
    allowedContextBundleSlugs?: string[];
  };
  metadata?: Record<string, unknown>;
};
```

MVP note:

- `runtime` is the Project default runtime.
- Future versions may introduce Project-managed named runtime profiles, but the
  first version does not expose profile CRUD.
- Mounts are resolved from system-managed mounts, Project-managed mounts, and
  runtime/image-declared mounts. API payloads must not blur those ownership
  levels into a single untracked "default mount" bucket.

Validation:

- Docker provider requires non-empty `image`.
- Secret refs are names only, never values.
- Host home and host Docker socket mounts are rejected.
- Top-level `image` is rejected; image belongs at `runtime.image`.
- Route handlers validate runtime payloads at the API boundary using shared
  schemas before persistence.

## Context Bundles

Contract notes:

- Context bundles may include run-scoped frozen execution artifacts, such as the approved spec snapshot created at job submission time.
- Accepted runs consume injected artifacts rather than a live pointer to the collaborative workspace that produced them.

### POST /api/context-bundles

Creates a context bundle reference.

```ts
type CreateContextBundleRequest = {
  slug: string;
  displayName: string;
  source: {
    kind: "local-template" | "external-artifact" | "job-inline";
    ref?: string;
    metadata?: Record<string, unknown>;
  };
  accessMode: "read-only" | "job-scoped";
  mountPath?: string;
  freshness?: Record<string, unknown>;
  failureMode: "fail-run" | "warn";
  metadata?: Record<string, unknown>;
};
```

Success: `201 { "contextBundle": ContextBundle }`

Errors:

- `400 VALIDATION_ERROR`
- `409 CONTEXT_BUNDLE_SLUG_CONFLICT`
- `400 FORBIDDEN_CONTEXT_BUNDLE` when the source or mount path violates policy.

### GET /api/context-bundles

Success: `200 { "contextBundles": ContextBundle[] }`

### PATCH /api/context-bundles/{slug} *(post-MVP management surface)*

Success: `200 { "contextBundle": ContextBundle }`

### DELETE /api/context-bundles/{slug} *(post-MVP management surface)*

Archives a context bundle. The first implementation slice only needs create/list plus runtime resolution; update/archive belongs to the later operator management surface.

Success: `200 { "contextBundle": ContextBundle }`

## Job Submission Runtime Override

Job create accepts an optional runtime override:

```ts
type JobRuntimeOverride = {
  runtimeProfile?: string;
  provider?: "docker";
  image?: string;
  contextBundleRefs?: Array<{
    slug: string;
    required?: boolean;
  }>;
  metadata?: Record<string, unknown>;
};
```

Validation:

- Override fields must be allowed by Project runtime override policy.
- MVP accepts only constrained provider/image/context-bundle/metadata overrides.
  Runtime profile selection is a reserved future field and must not be accepted
  as executable behavior until profile management exists.
- Job payloads must not override mounts, secrets, cache, or exposed ports in the
  MVP.
- Job submission freezes execution-facing spec context into a run-scoped artifact before execution starts.
- Collaborative edits after submission require a new job instead of mutating an accepted run.
- Override provider must be supported by the Project and runner pool.
- Job-scoped context bundles must resolve before runner claim.
- Invalid runtime overrides return `400` and create no run.

## Project Response

```ts
type ProjectResponse = {
  project: {
    id: string;
    name: string;
    slug: string;
    repo: string;
    baseBranch: string;
    defaultAgent: "codex" | "copilot";
    runtime: ProjectRuntimeConfig;
    prewarmConfig: Record<string, unknown>;
    metadata: Record<string, unknown>;
    archivedAt: string | null;
    createdAt: string;
    updatedAt: string;
  };
};
```

Contract note: consumers read Docker image from `project.runtime.image`, not top-level `project.image`.
