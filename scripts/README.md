# Mystra Scripts

`operator-cli.mjs` is the only supported local management client. It is a thin
HTTP adapter over the canonical control-plane API and does not import provider,
persistence, or Integration implementations.

## Preset assets

`presets/` holds the Agent Profiles and Skills that Mystra hosts and distributes.
They are product assets, not scripts; the scripts below only move them.

`publish-presets.mjs` publishes them through the canonical management API using
the operator session store, so repository maintenance needs no second credential
format. It is idempotent: an unchanged asset is skipped, and a changed asset is
published as a new revision rather than overwritten.

```sh
node scripts/publish-presets.mjs                 # Agent Profiles + Skills
node scripts/publish-presets.mjs --only=agents   # Agent Profiles only
node scripts/publish-presets.mjs --only=skills   # Skills only
```

Agent Profiles and Skills have different infrastructure dependencies: Skill
publication needs a reachable S3-compatible endpoint, Agent publication does not.
Use `--only` when only one side is provisioned instead of running a publish that
is known to fail halfway.

`e2e-publish-presets.mjs` verifies the publish path against a real server: it
boots the production bundle on a throwaway SQLite database, registers a real
operator, publishes, and reads the result back. It also proves the idempotent and
minimal-update behaviour by re-publishing and by publishing a drifted copy.

```sh
pnpm --filter @mystra/control-plane build   # dist/server.js needs the .next build
node scripts/e2e-publish-presets.mjs
node scripts/e2e-publish-presets.mjs --with-skills   # once storage is reachable
```

`prewarm-project.sh` prepares disposable local caches manually. Automatic
prewarm remains a future SandboxProvider capability.

## GitNexus

GitNexus is pinned in the root workspace so the CLI, LadybugDB storage reader,
and MCP server do not drift independently. Use these repository scripts:

```sh
pnpm gitnexus:doctor
pnpm gitnexus:status
pnpm gitnexus:analyze
pnpm gitnexus:rebuild
```

Both analyze commands use `--index-only`; the graph is disposable, while
Mystra's tracked `AGENTS.md` and `.agents/skills/` are canonical. Do not use a
global binary, `npx`, `pnpm dlx`, or `.gitnexus/run.cjs` for this repository.

## Operator CLI

The Issue-to-review path is:

```sh
pnpm operator:cli -- issues list --integration linear --limit 10
pnpm operator:cli -- issues get MYS-101 --integration linear
pnpm operator:cli -- issues dispatch MYS-101 --integration linear \
  --project mystra-agent-demo --provider copilot --branch codex/mys-101-demo --json
pnpm operator:cli -- sessions inspect SESSION_ID
pnpm operator:cli -- sessions wait SESSION_ID --interval-seconds 2 --timeout-seconds 3600
```

Tasks can also be created without execution. The current legacy CLI starts a
Session from a Task route; the target model treats that Task reference as an
optional Session input, not ownership:

```sh
pnpm operator:cli -- tasks create --project PROJECT_ID --objective "Investigate the failure"
pnpm operator:cli -- sessions create TASK_ID --title "Reproduce" --objective "Create a deterministic reproduction"
```

All commands accept `--json` and `--control-plane-url`. Session polling treats
`waiting_for_review` as a successful terminal handoff; failed, canceled, and
timed-out Sessions return non-zero.
