# Runner Claim Contract

> Reconciliation note: Project/job claim flow from this feature is implemented, but runtime delivery was refined by `../../002-runtime-profile-context/contracts/runner-claim.md`. Use `002` as authoritative for executable runtime fields.

## GET /api/runner/jobs

The runner authenticates with its runner session token and claims a queued run.

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
    prewarmConfig: Record<string, unknown>;
  };
  runtime: {
    provider: "docker";
    environment: {
      image: string;
    };
  };
};
```

## Runner Requirements

- Runner MUST use `response.runtime.environment.image` as the Docker image.
- Runner MUST NOT read `MYSTRA_RUNNER_IMAGE` as the normal job runtime image after this feature.
- Runner SHOULD include image pull/start failures in run failure reason.
- Runner MUST treat missing `runtime` or empty `runtime.environment.image` as a control-plane contract violation and fail the run clearly.
