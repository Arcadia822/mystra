# Runner Daemon

`mystra-runner` enrolls its host as a Runtime through an outbound control-plane
connection. It persists a UUID at `~/.mystra/runner-id`, discovers supported
provider CLIs, sends pure liveness heartbeats, reports provider changes, and
materializes claimed Task repository Workspaces. It still does not create or
execute Sessions; feature 049 consumes the ready Workspace attachment.

## Local configuration

```sh
MYSTRA_RUNNER_ENDPOINT=http://localhost:3000
MYSTRA_RUNNER_NAME=local-runner
# Optional: default is ~/.mystra/runner-id
MYSTRA_RUNNER_ID_PATH=$HOME/.mystra/runner-id
# Defaults: heartbeat 15 seconds; provider rescan 60 seconds; retries 5 seconds.
MYSTRA_RUNNER_HEARTBEAT_INTERVAL_SECONDS=15
MYSTRA_RUNNER_DISCOVERY_INTERVAL_SECONDS=60
MYSTRA_RUNNER_RETRY_INTERVAL_SECONDS=5
# Optional: absolute safe root; default is ~/.mystra/workspaces
MYSTRA_RUNNER_WORKSPACE_ROOT=$HOME/.mystra/workspaces
# Bounded claim long poll, 0..25 seconds; default 25.
MYSTRA_RUNNER_WORKSPACE_POLL_WAIT_SECONDS=25
```

Pass `--endpoint <url>` to override the endpoint for one invocation. Supported
provider CLIs are `codex` and `copilot`. A `MYSTRA_<PROVIDER>_PATH` variable
(for example `MYSTRA_COPILOT_PATH`) explicitly selects an executable and never
falls back when the selected path is unavailable.

## Task Workspace materialization

The daemon advertises `task-repository` / `shared-mutable`, claims only work
bound to its stable runner identity, and maps the opaque
`host-task-workspace:<uuid>` reference beneath the configured safe root. The
control plane supplies an exact base commit and provider-owned working branch.
The daemon clones without a checkout, fetches and verifies the exact commit,
rejects an existing remote working branch, creates the branch, writes an
internal marker, and atomically publishes the directory.

Git is always spawned with argv and interactive prompts disabled. The transient
credential is passed through Git process configuration, never argv, disk,
operator responses, or logs. Partial directories are removed on failure.
Before a future Task Session uses an attachment, the runner-side resolver
rechecks directory, repository, configured branch, and that the frozen base
commit remains an ancestor of the current `HEAD`. The current commit may advance
because the Workspace is shared-mutable. Missing or divergent state is reported
as `workspace_missing`, which makes the control-plane Workspace unavailable.

Feature 048 owns Task Workspace setup/materialization and the ready Task
Workspace attachment resolver contract. Feature 049 owns canonical Task-bound
Session creation and consumes the same `taskWorkspaceId`, `runtimeId`, and
opaque `workspaceRef`. Project-only and standalone Sessions are deferred; any
future preparation path must reuse the same Workspace/attachment contract
instead of introducing a parallel Workspace type.

## Commands

```sh
pnpm --filter @mystra/runner-daemon test
pnpm --filter @mystra/runner-daemon typecheck
```
