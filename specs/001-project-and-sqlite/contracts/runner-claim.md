# Runner Claim Contract

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
    image: string;
    prewarmConfig: Record<string, unknown>;
  };
};
```

## Runner Requirements

- Runner MUST use `response.project.image` as the Docker image.
- Runner MUST NOT read `MYSTRA_RUNNER_IMAGE` as the normal job runtime image after this feature.
- Runner SHOULD include image pull/start failures in run failure reason.
- Runner MUST treat missing `project` or empty `project.image` as a control-plane contract violation and fail the run clearly.
