# Mystra Scripts

`submit-job.mjs` is the primary local job submission helper. It resolves a Project
by slug and posts a job with `projectId` so callers do not repeat repository,
base branch, agent, or image defaults.

`prewarm-project.sh` is a manual cache preparation helper. Automatic prewarm is a
future sandbox-provider capability; the current bare Docker runner only consumes
the Project image returned by the claim API. The helper requires
`--project <slug>` and reads that Project's resolved remote clone URL and base
branch; local directories and ad hoc repository URL environment variables are
not inputs.

## Operator CLI

`operator-cli.mjs` is a thin HTTP client for the canonical control-plane API. It
does not import Linear, SQLite, Integration, Job, or runner implementations.

The five-command Issue-to-review path is:

```sh
pnpm operator:cli -- issues list --integration linear --limit 10
pnpm operator:cli -- issues get MYS-101 --integration linear
pnpm operator:cli -- issues dispatch MYS-101 --integration linear \
  --project mystra-agent-demo --agent copilot --branch codex/mys-101-demo
pnpm operator:cli -- runs inspect JOB_ID
pnpm operator:cli -- runs wait JOB_ID --interval-seconds 2 --timeout-seconds 3600
```

All commands accept `--json` and
`--control-plane-url http://127.0.0.1:3000`. `issues dispatch` resolves the
Project slug through `GET /api/projects/{slug}` before posting the explicit
project ID to the dispatch endpoint. `runs wait` treats
`waiting_for_review` as a successful terminal handoff; failed, canceled, and
timed-out Runs return non-zero.

## Spec View

`render-spec-view.mjs` renders a feature review page from fixed Spec-Kit
artifact paths using `.specify/templates/spec-view-template.html`. It reads
whole files such as `spec.md`, `features.md`, `checklists.md`, `plan.md`, and
`tasks.md`; it does not parse `spec.md` sections. Example:
`node scripts/render-spec-view.mjs --feature 025-webui`.
