# Quickstart: GitHub 多连接与 PAT

## Runtime

```sh
fnm install 24.14.0
fnm use 24.14.0
corepack use pnpm@10.25.0
```

The control plane upgrades the exact SQLite schema v4 fingerprint to schema v5
in place, preserving connection IDs and Project references. Unknown or mixed
schemas fail closed.

## Global defaults

```text
MYSTRA_DEFAULT_AGENT=copilot
MYSTRA_DEFAULT_DEV_IMAGE=mystra-runner:local
```

Add Project 不显示这两个值；控制面在创建时解析并固化。

## Enable PAT method

Generate one 32-byte base64 key and set it as：

```text
MYSTRA_SECRET_STORE_KEY=<base64-32-byte-key>
```

Optional：

```text
MYSTRA_SECRET_STORE_PATH=/absolute/private/path
```

Do not print the key or PAT in command output。Default secret directory follows the local data root and is gitignored。

## Deployment capability target

Self-hosted is the open-source default：

```text
GitHub App = unavailable / HOSTED_ONLY
PAT        = available when MYSTRA_SECRET_STORE_KEY is valid
```

Configuring `MYSTRA_GITHUB_APP_*` must not elevate a self-hosted process。Those
variables remain inputs to the hosted adapter and tests，not a supported
self-hosted setup path。

Hosted App capability is enabled only by the official hosted runtime assembly
after caller authentication、Team authorization、durable OAuth transaction
storage、App identity secrets and hosted persistence pass startup health gates。

**Current implementation state**：the stock OSS connection list now projects
PAT only，direct App routes fail closed with `HOSTED_ONLY`，and the default
credential resolver cannot mint App tokens。The retained cookie-only OAuth code
is unreachable in stock self-hosted and remains domain scaffolding only；Hosted
activation still requires the private Cloud composition、caller/Team auth and a
durable OAuth transaction implementation。

## Focused verification

```sh
pnpm --filter @mystra/shared test -- integrations.test.ts schemas.test.ts management.test.ts
pnpm --filter @mystra/control-plane test -- sqlite-provider.test.ts github-app.test.ts github-pat.test.ts integration-connections.test.ts resolve-project-input.test.ts
pnpm --filter @mystra/runner-daemon test -- repository-credential.test.ts
pnpm typecheck
pnpm test
pnpm build
```

## Manual browser journey

### Self-hosted

1. Open Settings → Integrations → GitHub Detail。
2. Confirm the public method list and Settings UI contain only PAT；GitHub App text and controls are absent from the DOM。
3. Confirm direct connect/setup/callback requests return the stable hosted-only error and make zero GitHub requests。
4. Add a PAT；confirm token is never displayed after submit。
5. Create a Project from the PAT connection；confirm clone/push/PR uses the bound connection。

### Hosted test environment

1. Log in as a Team Integration administrator。
2. Install/authorize a second App installation；confirm both remain active。
3. Replay、expire or change Team authorization during callback；confirm fail closed。
4. Create a Project from the App connection and run a private-repository Session。
5. Confirm OAuth user token and installation token never enter durable storage or logs。

## Leakage audit

Search only test fixtures/known sentinel values；do not print real secrets。Verify RDB schema/value dump、HTTP response snapshots、browser DOM and logs contain no sentinel PAT。
