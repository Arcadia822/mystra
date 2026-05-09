# Runner Claim Contract: Resolved Runtime

## GET /api/runner/jobs

The runner authenticates with its runner session token and claims compatible queued work. Compatibility is evaluated against the resolved runtime contract before assignment.

## Empty Response

When no compatible work is available:

```ts
{
  job: null;
  run: null;
  project: null;
  runtime: null;
}
```

## Claimed Job Response

```ts
type ClaimedJobResponse = {
  job: {
    id: string;
    spec: {
      taskId: string;
      source: "mcp" | "api";
      projectId: string;
      repo: string;
      baseBranch: string;
      branchName: string;
      agent: "codex" | "copilot";
      prompt: string;
      mergeRequest?: {
        title?: string;
        body?: string;
      };
      metadata: Record<string, unknown>;
    };
  };
  run: {
    id: string;
    state: string;
    attempt: number;
  };
  project: {
    id: string;
    slug: string;
  };
  runtime: {
    provider: "docker";
    environment: {
      image: string;
      pullPolicy?: "if-not-present" | "always" | "never";
      metadata: Record<string, unknown>;
    };
    contextBundles: Array<{
      slug: string;
      required: boolean;
      accessMode: "read-only" | "job-scoped";
      mountPath?: string;
      source: {
        kind: "local-template" | "external-artifact" | "job-inline";
        ref?: string;
        metadata: Record<string, unknown>;
      };
      failureMode: "fail-run" | "warn";
    }>;
    mounts: Array<{
      kind: "workspace" | "gitMirror" | "cache" | "contextBundle" | "secret";
      owner?: "system" | "project" | "runtime";
      target: string;
      sourceRef?: string;
      readOnly: boolean;
    }>;
    exposedPorts: Array<{
      containerPort: number;
      hostBinding?: string;
      name?: string;
    }>;
    cache: {
      coldStartAllowed: boolean;
      entries: Array<{
        kind: string;
        target: string;
      }>;
    };
    secrets: Array<{
      name: string;
      mode: "env" | "file";
      target?: string;
    }>;
    limits?: {
      runTimeoutSeconds?: number;
      containerCpuQuota?: number;
      containerMemoryGb?: number;
    };
  };
};
```

## Runner Requirements

- Runner MUST use `response.runtime.environment.image` as the Docker image when `runtime.provider` is `docker`.
- Runner MUST NOT independently interpret a top-level `response.project.image` field as the normal job runtime image.
- Runner MUST reject or fail clearly when `runtime` is missing for a claimed job.
- Runner MUST NOT mount host home or the host Docker socket into task containers.
- Runner MUST inject secret values only from its runtime environment or approved secret source, never from claim payload values.
- Runner SHOULD treat the `mounts` list as the already resolved effective mount
  set. The control plane or provider adapter is responsible for merging
  system-managed, Project-managed, and runtime/image-declared mounts before
  claim assignment.
- Runner SHOULD emit structured failure reasons for missing context bundles, unsupported mounts, unsupported port exposure, image pull failure, or container startup failure.

## Contract Notes

- Project image is not returned as `project.image`.
- Docker image is returned only through `runtime.environment.image`.
- Tests should ensure Docker execution consumes `runtime.environment.image`.
