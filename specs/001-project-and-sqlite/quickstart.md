# Quickstart: Project Abstraction + SQLite Persistence

## Prerequisites

- `pnpm install`
- Docker available for runner image smoke tests
- `MYSTRA_DB_PATH` points to a writable SQLite file, or unset to use the default local path

## 1. Verify Shared Contracts

```sh
pnpm --filter @mystra/shared test
```

Expected:

- Project schemas validate valid create/update payloads.
- JobSpec accepts `projectId` and rejects missing `projectId`.
- Explicit job overrides are typed.

## 2. Verify SQLite Provider

```sh
pnpm --filter @mystra/control-plane test
```

Expected:

- Provider creates and queries Projects.
- Provider creates jobs from active Projects.
- Provider persists data across close/reopen.
- Corrupt JSON test throws with field name and record id.

## 3. Run Control Plane Locally

```sh
MYSTRA_DB_PATH=./data/mystra.dev.db pnpm dev:control-plane
```

## 4. Create A Project

```sh
curl -sS -X POST http://localhost:3000/api/projects \
  -H 'content-type: application/json' \
  -d '{
    "name": "Castrel AI",
    "slug": "castrel-ai",
    "repo": "git@gitlab.example.com:team/castrel-ai.git",
    "baseBranch": "main",
    "defaultAgent": "codex",
    "image": "registry.example.com/castrel-ai/mystra-runner:latest",
    "prewarmConfig": {},
    "metadata": {}
  }'
```

Expected: `201` with `{ "project": ... }`.

## 5. Submit A Job By Project

```sh
curl -sS -X POST http://localhost:3000/api/jobs \
  -H 'content-type: application/json' \
  -d '{
    "taskId": "SMOKE-1",
    "source": "api",
    "projectId": "<project-id>",
    "branchName": "mystra/smoke-1",
    "prompt": "Make a minimal README update."
  }'
```

Expected:

- `201` with job snapshot.
- Snapshot includes resolved `repo`, `baseBranch`, and `agent`.

## 6. Claim A Run

Register a runner and poll:

```sh
curl -sS http://localhost:3000/api/runner/jobs \
  -H "authorization: Bearer <runner-session-token>"
```

Expected:

- Claim response includes `project.image`.
- Runner daemon uses `project.image`, not `MYSTRA_RUNNER_IMAGE`.

## 7. Submit Through Script

```sh
pnpm job:submit --project castrel-ai --task-id SMOKE-2 --branch mystra/smoke-2 --title "Smoke" --body "Smoke" --prompt-file /tmp/prompt.md
```

Expected:

- Script resolves Project by slug.
- Script posts `projectId`.

## 8. Restart Persistence Check

1. Stop control plane.
2. Start with the same `MYSTRA_DB_PATH`.
3. Query the created job and project.

Expected: records survive restart.

## 9. Implementation Verification Notes

Verified on 2026-05-09:

- `pnpm --filter @mystra/shared test`
- `pnpm --filter @mystra/control-plane test`
- `pnpm --filter @mystra/control-plane typecheck`
- `pnpm --filter @mystra/runner-daemon test`
- `pnpm --filter @mystra/runner-daemon typecheck`
- `pnpm typecheck && pnpm test`
- `pnpm build`
- `pnpm job:submit -- --project local-fixture --task-id SMOKE-SUBMIT --branch mystra/smoke-submit --title "Smoke submit" --body "Smoke submit" --prompt-file /tmp/mystra-submit-prompt.md --no-wait`
- `./scripts/prewarm-project.sh --project local-fixture --dry-run`

GitNexus change detection reports critical scope because this feature migrates
shared schemas, API routes, runner claim behavior, UI submission, scripts, and
documentation in one coordinated slice. No HIGH/CRITICAL pre-edit symbol impact
was reported for the edited runtime symbols/routes; the final critical rating is
the expected feature-wide blast radius, not a newly discovered failing check.
