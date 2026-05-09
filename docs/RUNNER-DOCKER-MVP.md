# Docker Runner MVP

This is the current "usable by me" path:

1. Mystra receives a `JobSpec`.
2. The local runner claims the job.
3. The runner starts one Docker container with `mystra-runner:local`.
4. The container clones the GitLab repository, creates the task branch, runs Codex or Copilot, commits changes, pushes the branch, and creates a GitLab merge request.
5. After the MR is created, the container stays running and exposes preview ports for frontend and backend review.

## Build the Runner Image

```sh
./scripts/build-runner-image.sh
```

The image contains Node 24, pnpm, Python 3, uv, git, Codex CLI, and GitHub Copilot CLI.

The image also includes Mystra task skills under:

```text
/mystra/skills
```

MVP ships `agent-skills` at `/mystra/skills/agent-skills/SKILL.md`. The full bundled skill group is available directly under `/mystra/skills/<skill-name>`, including each skill directory's auxiliary files, templates, and references. The runner injects this path into the agent prompt and explicitly requires it for the whole development workflow: request analysis, repository inspection, implementation, verification, and final summary.

## Prewarm Castrel AI

For `/Users/arcadia/Documents/castrel-ai`, run:

```sh
./scripts/prewarm-castrel-ai.sh
```

This prepares:

```text
~/.mystra/cache/git/<repo-hash>.git
~/.mystra/cache/pnpm-store
~/.mystra/cache/uv
~/.mystra/cache/uv-python
```

The Docker runner mounts these caches into every task container:

```text
/mystra/cache/git/repo.git      read-only Git mirror reference
/mystra/cache/pnpm-store        PNPM_STORE_DIR and npm store-dir
/mystra/cache/uv                UV_CACHE_DIR
/mystra/cache/uv-python         UV_PYTHON_INSTALL_DIR
```

The cache is an acceleration layer, not the source of truth. The runner refreshes the mirror before each task and the container still pushes back to GitLab.

For pnpm, Mystra sets `PNPM_STORE_DIR`, `NPM_CONFIG_STORE_DIR`, and `npm_config_store_dir`, then runs `pnpm config set store-dir` inside the task container. This avoids pnpm silently falling back to a per-user store.

## Preview Containers

Docker jobs run as retained containers named `mystra-<run-id>`. The runner publishes:

```text
0.0.0.0:<dynamic-port> -> container 3000/tcp frontend
0.0.0.0:<dynamic-port> -> container 8000/tcp backend
```

The task script starts `frontend` with `pnpm dev --hostname 0.0.0.0 --port 3000` and attempts to start `backend` with `uv run uvicorn app.main:app --host 0.0.0.0 --port 8000`. The MR description and an MR note include the preview URLs.

Set `MYSTRA_PREVIEW_HOST` to the development machine IP that reviewers can reach. If it is unset, the runner uses the first non-internal IPv4 address it can detect.

For Next.js previews, the task script patches `allowedDevOrigins` in `next.config.*` with the preview host before starting `pnpm dev`. Without this, Next blocks HMR and dev font resources when the page is opened through the development machine IP.

For preview review, Mystra also forces `LOGIN_METHODS=form` and enables a container-local NextAuth credentials user:

```text
preview@mystra.local / mystra-preview
```

This is a preview-only session user for UI inspection. It does not authenticate against the production backend.

## Quality Gate

After the agent finishes and before Git commit, push, MR creation, or preview startup, the container runs a deterministic quality gate in this order:

```text
test -> build
```

The current gate is path-aware:

- Changes under `frontend/` run `pnpm install --frozen-lockfile --ignore-scripts`, then frontend `pnpm test`, then frontend `pnpm build` when those scripts exist.
- Changes under `backend/` run `uv sync`, then `uv run pytest` when backend tests exist.
- Changes outside `frontend/` and `backend/` fall back to root package `pnpm test`, then root package `pnpm build` when those scripts exist.

If the gate fails, Mystra does not push or create an MR. The run result uses `errorCode: "quality_gate_failed"`. The retained workspace stores the gate log at:

```text
/mystra/workspace/quality-gate.log
```

This is only a gate, not a Minion-style fix loop. On failure, Mystra records `metadata.qualityGate`, emits `quality_gate.failed`, and stops. A later workflow can feed `quality-gate.log` back to the agent, let it repair, and rerun `test -> build` for at most `N` rounds.

For retained preview containers, inspect it with:

```sh
pnpm preview -- quality mystra-<run-id>
```

If local proxy variables are set, test preview URLs with:

```sh
curl --noproxy '*' -I http://localhost:<frontend-port>
```

Castrel backend preview requires the repository's database and Redis environment. Without those values, the retained backend port can exist while the FastAPI process exits during startup.

## Configure Secrets

Create `~/.mystra/runner.env`:

```sh
mkdir -p ~/.mystra
cat > ~/.mystra/runner.env <<'ENV'
MYSTRA_EXECUTOR=docker
MYSTRA_RUNNER_IMAGE=mystra-runner:local
MYSTRA_GITLAB_TOKEN=replace-with-gitlab-user-pat
MYSTRA_GITLAB_HTTP_BASE_URL=https://git.cloudwise.com
MYSTRA_CACHE_ROOT=/Users/arcadia/.mystra/cache
MYSTRA_CODEX_AUTH_DIR=/Users/arcadia/.codex
MYSTRA_PREVIEW_HOST=10.1.20.150
MYSTRA_GIT_AUTHOR_NAME=Mystra Runner
MYSTRA_GIT_AUTHOR_EMAIL=mystra-runner@example.invalid
ENV
```

For Copilot, inject a token from GitHub CLI when you start the runner, or store one in the env file if you accept that local tradeoff:

```sh
echo "COPILOT_GITHUB_TOKEN=$(gh auth token)" >> ~/.mystra/runner.env
```

Codex auth cache has been verified in the container by mounting `/Users/arcadia/.codex` to `/root/.codex`.

Copilot does not authenticate from `~/.copilot` alone in the container. It works with `GH_TOKEN` or `COPILOT_GITHUB_TOKEN`, and the runner intentionally avoids mounting host `~/.copilot` so task containers do not inherit interactive MCP entries such as Linear. Task containers also pass `--disable-mcp-server linear` and deny `mcp.linear.app` because real Copilot runs can still discover an interactive Linear MCP server from outside the isolated config directory.

## Start Local Services

```sh
./scripts/start-local.sh
```

The LaunchAgent wrapper sources `~/.mystra/runner.env` before starting the runner.

## Create a Real Job

```sh
curl -sS -X POST http://localhost:3000/api/jobs \
  -H 'content-type: application/json' \
  -d '{
    "taskId": "demo-1",
    "source": "api",
    "repo": "ssh://git@git.cloudwise.com:36000/castrel/castrel-ai.git",
    "baseBranch": "main",
    "branchName": "mystra/demo-1",
    "agent": "codex",
    "prompt": "Implement the requested change and run relevant tests.",
    "mergeRequest": {
      "title": "Mystra demo change",
      "body": "Created by Mystra local docker runner."
    }
  }'
```

Poll the returned job:

```sh
curl -sS http://localhost:3000/api/jobs/<job-id>
```
