# Runner Daemon

`mystra-runner` enrolls its host as a Runtime through an outbound control-plane
connection. It persists a UUID at `~/.mystra/runner-id`, discovers supported
provider CLIs, sends pure liveness heartbeats, and reports provider changes.
It does not claim or execute Sessions.

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
```

Pass `--endpoint <url>` to override the endpoint for one invocation. Supported
provider CLIs are `codex` and `copilot`. A `MYSTRA_<PROVIDER>_PATH` variable
(for example `MYSTRA_COPILOT_PATH`) explicitly selects an executable and never
falls back when the selected path is unavailable.

## Commands

```sh
pnpm --filter @mystra/runner-daemon test
pnpm --filter @mystra/runner-daemon typecheck
```
