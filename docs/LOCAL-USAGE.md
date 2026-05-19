# Local Mystra Usage

This is the fastest path for exercising Mystra's current MVP surfaces locally and on the development machine.

## Management Surface Hierarchy

Use the management surfaces in this order when more than one path exists:

| Surface | Current role |
|---|---|
| HTTP API | Canonical product and operator truth |
| Local skills | Default agent-facing policy layer over the API |
| CLI | Shell-first operator surface over the API |
| MCP | Transport adapter and integration boundary |
| UI | Secondary inspection / explainer surface |

## Start the control plane

```sh
pnpm dev:control-plane
```

The control plane listens on:

```text
http://localhost:3000
```

For the quickest persistent local setup on this Mac, use the LaunchAgent wrapper:

```sh
./scripts/start-local.sh
pnpm run doctor
```

Stop both services with:

```sh
./scripts/stop-local.sh
```

Logs are written to:

```text
/tmp/mystra-control-plane.log
/tmp/mystra-runner.log
```

To use the Docker runner that clones GitLab, runs Codex/Copilot, pushes a branch, and creates a merge request, see [RUNNER-DOCKER-MVP.md](./RUNNER-DOCKER-MVP.md).

## MVP Acceptance Smoke

Use this section as the current acceptance evidence for the MVP happy path. It is intentionally narrow: prove the control plane, runner claim loop, durable state, and review-delivery path all work without pretending every future operator surface is complete.

1. **Local protocol smoke**: start `pnpm dev:control-plane` plus `MYSTRA_CONTROL_PLANE_URL=http://localhost:3000 pnpm dev:runner`, create a Project, submit a job, then fetch `GET /api/jobs/<job-id>`. Evidence: the job is accepted by `projectId`, the fake runner claims it, the run reaches a terminal state, and the returned job JSON includes durable run/result data.
2. **Local MCP smoke**: call `/api/mcp` with `mystra_create_project` or `mystra_create_job` against the same control plane. Evidence: the MCP boundary can create the same Project/job resources as HTTP without a separate hidden path.
3. **Restart durability smoke**: repeat the local protocol smoke with a fixed `MYSTRA_DB_PATH`, restart the control plane, then fetch the same Project and job again. Evidence: Projects, jobs, runners, events, and results survive restart with the same SQLite file.
4. **Development-machine review delivery smoke**: deploy to the configured server, submit a real project-backed job with `pnpm job:submit -- --project ...`, and inspect the final JSON plus preview helpers. Evidence: Mystra resolves `Project.runtime.image`, the Docker runner completes `test -> build`, pushes a branch, opens a GitLab MR or GitHub PR, and leaves a retained preview container inspectable through `pnpm preview -- list|logs|quality`.

When one of the proof points fails, record that gap before calling MVP closure complete. A polite fiction would still be fiction.

## Minimum Operator Runbook

Use this as the shortest operator path for the current MVP. It is not a full
operations manual; it is the "get the system up, prove it is alive, submit one
job, inspect what happened, and shut it down without improvising" path.

### 1. Start services

For the persistent local loop on this machine:

```sh
./scripts/start-local.sh
pnpm run doctor
```

For protocol-only local development without the LaunchAgent wrapper:

```sh
pnpm dev:control-plane
MYSTRA_CONTROL_PLANE_URL=http://localhost:3000 pnpm dev:runner
```

For the real development-machine Docker path, deploy first:

```sh
pnpm run deploy:dev
```

### 2. Check health before submitting work

Use MCP health because it now reflects runner heartbeat status directly:

```sh
curl -sS -X POST http://localhost:3000/api/mcp \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":"health","method":"tools/call","params":{"name":"mystra_health","arguments":{}}}'
```

Healthy output should show:

- `controlPlane.status = "healthy"`
- at least one runner when you expect execution capacity
- no unexpected runner entries with `status = "degraded"`

### 3. Submit work

Preferred operator command:

```sh
pnpm job:submit -- \
  --project castrel-ai \
  --task-id TASK-123 \
  --branch mystra/TASK-123-short-name \
  --title "TASK-123 Short title" \
  --body "Source: TASK-123" \
  --prompt-file /tmp/task-123-prompt.md
```

If you need the raw control-plane path instead, create a Project and submit via
HTTP using the examples later in this document.

### 4. Inspect execution and result

Inspect the durable job snapshot:

```sh
curl -sS http://localhost:3000/api/jobs/<job-id>
```

Useful things to look for:

- `run.state` tells you whether the run is still queued, active, or terminal
- `events[]` tells you which lifecycle step was last observed
- `run.result` carries MR/PR metadata, quality-gate summary, and failure details

For the compact coordination-friendly summary surface:

```sh
pnpm job:status -- --job-id <job-id>
pnpm job:status -- --job-id <job-id> --wait
```

For retained preview containers:

```sh
pnpm preview -- list
pnpm preview -- logs mystra-<run-id>
pnpm preview -- quality mystra-<run-id>
```

### 5. Stop services cleanly

```sh
./scripts/stop-local.sh
```

### 6. Fast failure triage

When the system misbehaves, start here:

1. `pnpm run doctor` — quick local preflight
2. `/tmp/mystra-control-plane.log` and `/tmp/mystra-runner.log` — process-level failures
3. `mystra_health` — stale or missing runner capacity
4. `GET /api/jobs/<job-id>` — durable run state, events, and final result
5. `pnpm preview -- quality mystra-<run-id>` — quality gate log for retained containers

## Submit And Wait For A Project Job

Use the combined workflow wrapper instead of separate submit and poll commands:

```sh
pnpm job:submit -- \
  --project castrel-ai \
  --task-id TASK-123 \
  --branch mystra/TASK-123-short-name \
  --title "TASK-123 Short title" \
  --body "Source: TASK-123" \
  --prompt-file /tmp/task-123-prompt.md
```

The final JSON includes the MR URL, preview URLs, and preview login when the run succeeds.

## Deploy To The Development Machine

Deploy control-plane and runner to the configured development machine:

```sh
pnpm run deploy:dev
```

Defaults, override these for the currently provided high-capacity server:

```text
MYSTRA_DEV_HOST=<server-ip-or-hostname>
MYSTRA_DEV_USER=root
MYSTRA_REMOTE_DIR=/opt/mystra
```

The deploy script syncs source files, writes `/root/.mystra/runner.env`, installs dependencies, and installs `mystra-control-plane` plus `mystra-runner` systemd services. If the target host has a local Castrel image context at `MYSTRA_RUNNER_IMAGE_CONTEXT` or `/tmp/mystra-castrel-runner-image`, deployment can build that local image; the image context is intentionally outside the Mystra git repository. Runtime Docker jobs use `Project.runtime.image`.

## Development Machine Sentry

When enabled, the development machine runs Sentry self-hosted at:

```text
http://<server-ip-or-hostname>:9000
```

Credentials are stored on the development machine in:

```text
/root/.mystra/sentry-admin.env
```

If the login form reports an invalid security token, check that `/opt/sentry-self-hosted/sentry/sentry.conf.py`
contains `CSRF_TRUSTED_ORIGINS` for `http://<server-ip-or-hostname>:9000`, then restart `web` and `nginx`.

The Mystra deployment script automatically sources `/root/.mystra/sentry.env` when it exists. Use this endpoint to emit a control-plane test event:

```sh
curl -sS -X POST http://<server-ip-or-hostname>:3000/api/debug/sentry
```

## Manage Preview Containers

Mystra intentionally keeps task containers running after MR/PR creation so reviewers can open the preview URL. Use:

```sh
pnpm preview -- list
pnpm preview -- logs mystra-<run-id>
pnpm preview -- quality mystra-<run-id>
pnpm preview -- stop mystra-<run-id>
pnpm preview -- stop --all
```

## Start the local fake runner

For protocol-only local development, start the fake runner in another terminal:

```sh
MYSTRA_CONTROL_PLANE_URL=http://localhost:3000 pnpm dev:runner
```

The fake runner registers, long-polls for queued jobs, emits structured events, and returns a successful `RunResult`. It is not the development-machine Docker runner used for real GitLab MRs.

## Create a job through HTTP

```sh
PROJECT_ID="$(curl -sS -X POST http://localhost:3000/api/projects \
  -H 'content-type: application/json' \
  -d '{
    "name": "Local Fixture",
    "slug": "local-fixture",
    "repo": "local/fixture",
    "baseBranch": "main",
    "defaultAgent": "codex",
    "runtime": {
      "provider": "docker",
      "image": "mystra-castrel-runner:local"
    }
  }' | node -e 'let d=""; process.stdin.on("data", c => d += c); process.stdin.on("end", () => console.log(JSON.parse(d).project.id));')"

curl -sS -X POST http://localhost:3000/api/jobs \
  -H 'content-type: application/json' \
  -d "{
    \"taskId\": \"local-task-1\",
    \"source\": \"api\",
    \"projectId\": \"$PROJECT_ID\",
    \"branchName\": \"mystra/local-task-1\",
    \"prompt\": \"Smoke test the local Mystra loop\"
  }"
```

Use the returned `job.id`:

```sh
curl -sS http://localhost:3000/api/jobs/<job-id>
```

## Create a job through the local MCP-style endpoint

```sh
curl -sS -X POST http://localhost:3000/api/mcp \
  -H 'content-type: application/json' \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "mystra_create_job",
      "arguments": {
        "taskId": "local-mcp-1",
        "source": "mcp",
        "projectId": "<project-id>",
        "branchName": "mystra/local-mcp-1",
        "prompt": "Run this local fake task"
      }
    }
  }'
```

## Current limits

- Local state is persisted through the SQLite-backed RdbProvider.
- Restarting the control plane preserves projects, jobs, runners, events, and results when `MYSTRA_DB_PATH` points at the same file.
- The local fake runner does not clone repos, run Codex/Copilot, create branches, or create GitLab MRs.
- The development-machine Docker runner can create real GitLab MRs. Preview URLs are included only when the retained container starts reachable frontend/backend services.
