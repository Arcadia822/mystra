# Quickstart: Real Linear → Copilot → GitHub Review

This is the acceptance runbook. It must not print or persist secret values.

## Runtime

```sh
fnm install 24.14.0
fnm use 24.14.0
corepack use pnpm@10.25.0
pnpm install
```

## Verify credentials without printing them

```sh
test -n "${LINEAR_API_KEY:-}"
gh auth status
test -n "$(gh auth token)"
```

At service startup, derive transient runner variables in that process only:

```sh
export MYSTRA_GITHUB_TOKEN="$(gh auth token)"
export COPILOT_GITHUB_TOKEN="$MYSTRA_GITHUB_TOKEN"
```

Do not write these values to `.env`, runner image, evidence or repository files.

## Docker and generic image

```sh
docker info
pnpm runner:image:build
docker run --rm mystra-copilot-runner:1.0.69-0 copilot --version
```

## Start services with a disposable database

```sh
export MYSTRA_DB_PATH=/tmp/mystra-033-e2e.db
export MYSTRA_EXECUTOR=docker
pnpm dev:control-plane
pnpm dev:runner
```

Before a clean acceptance rerun, stop both services, verify the exact path is
`/tmp/mystra-033-e2e.db`, remove that one file, then restart. No directory-recursive
deletion is part of this runbook.

## Select and dispatch

```sh
pnpm operator:cli -- issues list --integration linear --limit 10
pnpm operator:cli -- issues get ISSUE-123 --integration linear
pnpm operator:cli -- issues dispatch ISSUE-123 \
  --integration linear \
  --project mystra-agent-demo \
  --agent copilot \
  --branch codex/ISSUE-123-demo
pnpm operator:cli -- runs inspect JOB_ID
pnpm operator:cli -- runs wait JOB_ID --timeout-seconds 3600
```

These five commands all call the Web API. The CLI never reads
`LINEAR_API_KEY`, opens SQLite, or invokes the runner.

## Acceptance checks

```sh
pnpm operator:cli -- runs inspect JOB_ID --json
docker ps --filter label=mystra.run-id=RUN_ID
curl --fail --show-error PREVIEW_URL
curl --fail --show-error PREVIEW_URL
gh pr view PR_URL --json state,url,headRefName,baseRefName
```

Expected: `waiting_for_review`, runner active count zero, retained container, Copilot
`1.0.69-0` in autopilot with cap 10, passed test/build, preview reachable twice, and an
open private GitHub PR referencing Linear + Job/Run.

## Verification gates

```sh
pnpm --filter @mystra/shared test
pnpm --filter @mystra/control-plane test
pnpm --filter @mystra/agent-adapters test
pnpm --filter @mystra/runner-daemon test
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Then run GitNexus change detection and repository code review.

## Evidence

Write `specs/033-issue-agent-execution/evidence/e2e-<timestamp>.md` with Issue, CLI,
Job/Run, image/container, Copilot version/cap, test/build, two preview probes, PR,
final state, runner capacity and secret scan. Never include headers, token values,
credential-bearing git URLs or full environment dumps.
