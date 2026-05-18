# Quickstart: Runtime Config Resolution and Context Bundles

This quickstart describes the expected operator and verification flow after implementation.

## 1. Create A Project With Runtime Config

Create a Project that owns its Docker image as structured runtime configuration:

```json
{
  "name": "Castrel AI",
  "slug": "castrel-ai",
  "repo": "gitlab.example.com/group/castrel-ai",
  "baseBranch": "main",
  "defaultAgent": "codex",
  "runtime": {
    "provider": "docker",
    "image": "mystra-castrel-runner:local",
    "contextBundleRefs": [
      {
        "slug": "agent-skills",
        "required": true,
        "accessMode": "read-only"
      }
    ],
    "mounts": [
      { "kind": "workspace", "target": "/mystra/workspace" },
      { "kind": "gitMirror", "target": "/mystra/cache/git/repo.git", "readOnly": true },
      { "kind": "cache", "target": "/mystra/cache/pnpm-store" }
    ],
    "exposedPorts": [
      { "containerPort": 3000, "name": "frontend" },
      { "containerPort": 8000, "name": "backend" }
    ],
    "cache": {
      "coldStartAllowed": true,
      "entries": [
        { "kind": "pnpm-store", "target": "/mystra/cache/pnpm-store" },
        { "kind": "uv", "target": "/mystra/cache/uv" },
        { "kind": "uv-python", "target": "/mystra/cache/uv-python" }
      ]
    },
    "secretRefs": [
      {
        "name": "MYSTRA_GITLAB_TOKEN",
        "mode": "env"
      }
    ],
    "overridePolicy": {
      "allowImageOverride": false,
      "allowContextBundleAdditions": true,
      "allowedContextBundleSlugs": ["agent-skills"]
    }
  }
}
```

Expected result:

- The Project stores `runtime.image` as valid Docker runtime config.
- Secret values are not stored.
- Forbidden mounts such as host home and Docker socket are rejected.

## 2. Create A Context Bundle Reference

Create a context bundle reference for local agent skills through
`POST /api/context-bundles` or the MCP `mystra_create_context_bundle` tool:

```json
{
  "slug": "agent-skills",
  "displayName": "Agent Skills",
  "source": {
    "kind": "local-template",
    "ref": "/tmp/mystra-castrel-runner-image/skills"
  },
  "accessMode": "read-only",
  "mountPath": "/mystra/skills",
  "failureMode": "fail-run"
}
```

Expected result:

- Mystra stores a bundle reference and access policy.
- The bundle content is treated as local development template content unless released externally.

## 3. Submit A Job

Submit a job with the normal small caller contract:

```json
{
  "projectId": "<project-id>",
  "branchName": "mystra/runtime-config-smoke",
  "prompt": "Make a small safe change and run focused checks."
}
```

Expected result:

- Mystra resolves runtime from `Project.runtime`.
- The created run stores or can reconstruct the resolved runtime snapshot.
- Job submission freezes the approved execution-facing spec into a run-scoped artifact.
- Invalid runtime overrides are rejected before agent execution.
- Later edits in the collaborative workspace do not mutate the accepted run.

## 4. Register A Compatible Runner

Register a runner with Docker provider capabilities:

```json
{
  "runnerName": "local-runner",
  "capabilities": {
    "agents": ["codex"],
    "executor": "docker",
    "providers": ["docker"],
    "contextBundleModes": ["read-only", "job-scoped"],
    "mountKinds": ["workspace", "gitMirror", "cache", "contextBundle", "secret"],
    "secretInjectionModes": ["env", "file"]
  },
  "maxConcurrency": 1
}
```

Expected result:

- A compatible runner can claim the job.
- An incompatible runner receives no work.

## 5. Claim And Inspect Resolved Runtime

When the runner claims work, the claim response includes a resolved runtime contract:

```json
{
  "job": { "id": "...", "spec": { "projectId": "...", "branchName": "..." } },
  "run": { "id": "...", "state": "assigned", "attempt": 1 },
  "project": { "id": "...", "slug": "castrel-ai" },
  "runtime": {
    "provider": "docker",
    "environment": {
      "image": "mystra-castrel-runner:local"
    },
    "contextBundles": [
      { "slug": "agent-skills", "accessMode": "read-only", "required": true },
      { "slug": "execution-spec", "accessMode": "read-only", "required": true }
    ],
    "mounts": [],
    "exposedPorts": [
      { "containerPort": 3000, "name": "frontend" },
      { "containerPort": 8000, "name": "backend" }
    ],
    "secrets": [{ "name": "MYSTRA_GITLAB_TOKEN", "mode": "env" }]
  }
}
```

Expected result:

- Docker runner uses `runtime.environment.image`.
- Normal execution does not independently interpret top-level `project.image`.
- Missing required bundles or unsupported capabilities fail before agent execution.
- The sandbox reads the injected `execution-spec` artifact as the execution contract instead of relying on collaborative chat history.
- Reviewers can trace the completed run back to the frozen execution-facing spec created at submission time.

## Verification Commands

Run focused checks first:

```sh
pnpm --filter @mystra/shared test
pnpm --filter @mystra/control-plane test
pnpm --filter @mystra/runner-daemon test
```

Run broader checks when the feature is implemented:

```sh
pnpm typecheck
pnpm test
```
