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
