# Local Mystra Usage

This is the fastest local loop for using Mystra before Supabase, Docker, GitLab, and real agent execution are wired in.

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

## Submit And Wait For A Castrel Job

Use the combined workflow wrapper instead of separate submit and poll commands:

```sh
pnpm job:castrel -- \
  --task-id CAST-123 \
  --branch mystra/CAST-123-short-name \
  --title "CAST-123 Short title" \
  --body "Linear: CAST-123" \
  --prompt-file /tmp/cast-123-prompt.md
```

The final JSON includes the MR URL, preview URLs, and preview login when the run succeeds.

## Deploy To The Development Machine

Deploy control-plane and runner to the configured development machine:

```sh
pnpm run deploy:dev
```

Defaults:

```text
MYSTRA_DEV_HOST=10.106.2.127
MYSTRA_DEV_USER=root
MYSTRA_REMOTE_DIR=/opt/mystra
```

The deploy script syncs source files, writes `/root/.mystra/runner.env`, installs dependencies, builds `mystra-runner:local`, and installs `mystra-control-plane` plus `mystra-runner` systemd services.

## Development Machine Sentry

The development machine runs Sentry self-hosted at:

```text
http://10.106.2.127:9000
```

Credentials are stored on the development machine in:

```text
/root/.mystra/sentry-admin.env
```

If the login form reports an invalid security token, check that `/opt/sentry-self-hosted/sentry/sentry.conf.py`
contains `CSRF_TRUSTED_ORIGINS` for `http://10.106.2.127:9000`, then restart `web` and `nginx`.

The Mystra deployment script automatically sources `/root/.mystra/sentry.env` when it exists. Use this endpoint to emit a control-plane test event:

```sh
curl -sS -X POST http://10.106.2.127:3000/api/debug/sentry
```

## Manage Preview Containers

Mystra intentionally keeps task containers running after MR creation so reviewers can open the preview URL. Use:

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
curl -sS -X POST http://localhost:3000/api/jobs \
  -H 'content-type: application/json' \
  -d '{
    "taskId": "local-task-1",
    "source": "api",
    "repo": "local/fixture",
    "baseBranch": "main",
    "branchName": "mystra/local-task-1",
    "agent": "codex",
    "prompt": "Smoke test the local Mystra loop"
  }'
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
        "repo": "local/fixture",
        "baseBranch": "main",
        "branchName": "mystra/local-mcp-1",
        "agent": "codex",
        "prompt": "Run this local fake task"
      }
    }
  }'
```

## Current limits

- State is in-memory inside the Next.js dev process.
- Restarting the control plane clears jobs, runners, events, and results.
- The local fake runner does not clone repos, run Codex/Copilot, create branches, or create GitLab MRs.
- The development-machine Docker runner can create real GitLab MRs. Preview URLs are included only when the retained container starts reachable frontend/backend services.
