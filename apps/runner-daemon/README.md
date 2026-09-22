# Runner Daemon

`mystra-runner` enrolls its host as a Runtime through an outbound control-plane
connection. It persists a UUID at `~/.mystra/runner-id`, discovers supported
provider CLIs, sends pure liveness heartbeats, reports provider changes, and
materializes claimed Task repository Workspaces, claims Session work assigned
to its Runtime, executes Codex or Copilot, and reports typed Session events.

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

## Runtime type

`MYSTRA_RUNNER_RUNTIME_TYPE` selects the execution backend and defaults to
`host`. A host Runtime discovers `codex` and `copilot`. The AgentOS Runtime
requires the explicit pair below; it must use its own `MYSTRA_RUNNER_ID_PATH`,
because the control plane rejects re-registering one runner id under a second
Runtime type.

```sh
MYSTRA_RUNNER_RUNTIME_TYPE=agentos
# Absolute path to the deployed pi-agentos-shim.mjs; never resolved from PATH.
MYSTRA_PI_PATH=/opt/agentos/pi-agentos-shim.mjs
# Optional: AgentOS Session state root, default /root/.mystra/agentos-sessions.
MYSTRA_AGENTOS_SESSION_STATE_ROOT=/root/.mystra/agentos-sessions
# Optional: model configuration JSON, default /opt/agentos/task-config.json.
MYSTRA_AGENTOS_MODEL_CONFIG=/opt/agentos/task-config.json
# Optional: per-Session deadline and idle bounds, seconds.
MYSTRA_AGENTOS_DEADLINE_SECONDS=900
MYSTRA_AGENTOS_IDLE_SECONDS=180
# Optional: host directory projected read-only into the guest as the workload CLI bundle;
# default is <package>/dist/agentos (produced by `pnpm --filter @mystra/runner-daemon run build:agentos-cli` -> dist/agentos/mystra-agent.cjs).
MYSTRA_AGENTOS_GUEST_CLI_DIR=/opt/agentos/agent-cli
# Optional: guest-reachable Control Plane origin, default matches runner MYSTRA_CONTROL_PLANE_URL.
# On a single host, this must be http://127.0.0.1:<port> because the guest reaches the host
# loopback through AgentOS loopbackExemptPorts; the adapter derives the exempted port from this URL.
MYSTRA_AGENTOS_CONTROL_PLANE_URL=http://127.0.0.1:3000
# Optional: enables preinstalled Taco CLI/Skill and one exact additional HTTPS egress origin.
# Omit to retain the existing model + Control Plane-only policy.
MYSTRA_AGENTOS_TACO_HOST_URL=https://tacobin.arcadia-han.com
```

Startup fails when `MYSTRA_PI_PATH` is set without
`MYSTRA_RUNNER_RUNTIME_TYPE=agentos`, or when `agentos` is selected without
`MYSTRA_PI_PATH`; a silent host fallback would register an AgentOS deployment as
a host Runtime and report `pi` as unavailable.

The AgentOS guest receives one writable Task Workspace, a read-only workload CLI
bundle projection at `/opt/mystra-agent-cli/mystra-agent.cjs`, and a read-only empty
shadow over `<workspace>/.pi/extensions` so repository content cannot execute while the
ephemeral model credential exists. Model credentials are written to an ephemeral in-guest
mount and removed before the first caller-controlled prompt; guest egress is denied by
default and allowed only for the configured model endpoint's `tcp://<host>:<port>`
resource (so `model.baseUrl` must be an HTTPS URL without embedded credentials) and the
local Control Plane's `tcp://127.0.0.1:<port>`, plus the explicit Taco origin when enabled. See `specs/059-agentos-pi-runtime/research.md`
and `specs/060-agentos-direct-control-plane/research.md` for measured pattern semantics.

By explicit architectural decision (Linear MYST-23 / GitHub #44), the Session-scoped
execution code now enters the guest to allow direct communication with the Control Plane.
The credential is strictly bounded: short-lived, capability-scoped to the active Session,
and carried solely in the durable Session env (`MYSTRA_AGENT_PATH`, `MYSTRA_CONTROL_PLANE_URL`,
`MYSTRA_EXECUTION_CODE`, and `MYSTRA_WORKSPACE_ROOT`), never written to a guest file, argv,
event payload, or log output. The 059 host binding and its `guest-bin` wrapper were deleted
as unusable in agentos-core 0.2.19. The guest reaches the Control Plane directly over the
exempted loopback port (`loopbackExemptPorts: [<port>]`) combined with the `tcp://127.0.0.1:<port>`
egress rule.

Before writing any model credential, the adapter executes `node "$MYSTRA_AGENT_PATH" whoami`
inside the guest with the injected environment. If this probe fails or times out, the Session
fails closed immediately without leaving model credentials in the sandbox. Exceeding the
deadline or idle bound aborts the response as a resumable `response_canceled` (not a terminal
failure); only a genuine Provider failure ends the Session. `MYSTRA_AGENTOS_DEADLINE_SECONDS`
and `MYSTRA_AGENTOS_IDLE_SECONDS` must be positive integers and are validated at startup.

### Optional Taco capability

Run `pnpm --filter @mystra/runner-daemon build:agentos-cli` with the pinned
toolchain and network access during deployment. Alongside `mystra-agent.cjs`, it
builds `dist/agentos/taco-cli.aospkg` using `@tacobin/cli@0.1.3` and the official
`@rivet-dev/agentos-toolchain@0.2.19`. The build fetches `SKILL.md` and
`taco-shell.html` from immutable upstream commit
`410a425e50bcc10b7c89ad6015c4b67e7dc7d418` into `dist/agentos/taco-skill/`.
Deploy all three artifacts under `MYSTRA_AGENTOS_GUEST_CLI_DIR`; guests never
download or install them. Template packs are not included.

With `MYSTRA_AGENTOS_TACO_HOST_URL` set, every new VM loads the canonical
`.aospkg` through AgentOS `software`, exposing `taco-cli` directly on PATH.
An intermediate toolchain `.tar` is not a valid `.aospkg`. The Skill is
read-only at `$TACO_SKILL_PATH`; `$TACO_HOST_URL` carries the approved origin.
Only HTTPS origins without credentials, path, query, fragment, or wildcards
are accepted. Missing artifacts fail closed before VM creation.

The Runtime adds operational instructions to use `taco-cli help` for
`binaryVersion`, assemble locally with the Skill, and run `publish --dry-run`
before publication. This is not an Agent Context override. Version 0.1.3 has
no `bundle` command and no implemented network `update`. The approved host
currently accepts public unauthenticated publication: no Taco token, Project
credential, or execution code is supplied as publication authentication.
Only explicitly shareable content may be published; do not upload private
repository, Session, or credential data.

Unset the Taco host and restart the AgentOS runner to disable the software
and additional egress. Host Runtime behavior is unchanged. See
`specs/061-agentos-taco-cli/quickstart.md` for deployment evidence and the
owner-approved waiver deferring same-Session continuation verification to MYST-28.

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

## Session execution

The daemon claims only Sessions whose `runtimeId` matches its enrolled Runtime.
The claim returns an opaque lease token, the frozen system prompt, the feature
048 Workspace attachment, and the pending user message. The runner resolves
the opaque Workspace ref beneath its configured safe root, starts or continues
the selected Provider session, and sends typed, source-sequenced events. A
completed response releases local execution ownership; the durable Session
remains `ready` and may receive another user message. No Runtime capacity or
slot value is sent or persisted.

Provider discovery is also the execution authority: the Session worker executes the
exact absolute CLI path that discovery probed as available. It never resolves a
second bare `codex` or `copilot` command from `PATH`; a missing discovered path
fails the Session as `provider_unavailable`.

The frozen prompt is the Control Plane's single effective prompt. It always
contains the content-addressed Standard Execution Prompt. When a Start request
explicitly selects an Agent, its frozen name/revision/system prompt appears only
as lower-priority Optional Agent Context. The runner and Provider adapters do
not reconstruct, replace, or inject a separate Agent prompt or Agent-specific
environment variable.

Event batches reuse stable IDs on retry and carry the lease token in both the
request body and header. The control plane validates the lease, source sequence,
payload limits, idempotency, and state projection in one transaction.

For a feature 051 Harness Session only, the claim also returns a short-lived,
attempt-scoped execution capability. This capability identifies the attempt
even when no Agent Context was selected. The runner prepends the bundled
`mystra-agent` bin directory to that Provider process's `PATH` and injects
`MYSTRA_CONTROL_PLANE_URL` plus `MYSTRA_EXECUTION_CODE`. The raw code is never
written to Session events or runner logs; only its SHA-256 digest and expiry are
persisted by the Control Plane. Generic Sessions receive no workload capability.

The first self-use deployment expects `linctl` and `gh` to be installed and
authenticated for the same host OS user running the Provider process. Mystra
does not issue those credentials, proxy either CLI, or fall back to the Project
Integration credential. An Agent that cannot use either tool reports `blocked`
through `mystra-agent`.

## Commands

```sh
pnpm --filter @mystra/runner-daemon test
pnpm --filter @mystra/runner-daemon typecheck
```
