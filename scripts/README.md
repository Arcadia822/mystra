# Mystra Scripts

`operator-cli.mjs` is the only supported local management client. It is a thin
HTTP adapter over the canonical control-plane API and does not import provider,
persistence, or Integration implementations.

`prewarm-project.sh` prepares disposable local caches manually. Automatic
prewarm remains a future SandboxProvider capability.

## Operator CLI

The Issue-to-review path is:

```sh
pnpm operator:cli -- issues list --integration linear --limit 10
pnpm operator:cli -- issues get MYS-101 --integration linear
pnpm operator:cli -- issues dispatch MYS-101 --integration linear \
  --project mystra-agent-demo --agent copilot --branch codex/mys-101-demo --json
pnpm operator:cli -- sessions inspect SESSION_ID
pnpm operator:cli -- sessions wait SESSION_ID --interval-seconds 2 --timeout-seconds 3600
```

Tasks can also be created without execution, then receive independent child
Sessions:

```sh
pnpm operator:cli -- tasks create --project PROJECT_ID --objective "Investigate the failure"
pnpm operator:cli -- sessions create TASK_ID --title "Reproduce" --objective "Create a deterministic reproduction"
```

All commands accept `--json` and `--control-plane-url`. Session polling treats
`waiting_for_review` as a successful terminal handoff; failed, canceled, and
timed-out Sessions return non-zero.

## Spec View

`render-spec-view.mjs` renders a feature review page from fixed Spec-Kit artifact
paths using `.specify/templates/spec-view-template.html`.
