# Integrations

Integrations expose named, independently composable capabilities:
`RepoProvider` discovers and resolves remote repositories, `IssueProvider`
lists and reads work items and owns deterministic working-branch policy for
exact Issue references, and `IntegrationEventCapability` (feature 058) parses
provider webhooks and matches normalized events for online subscriptions.

The default registry contains exactly:

- GitHub: repositories and repository-scoped Issues.
- Linear: read-only Issues plus the `linear.issue.state_changed` event capability.

## Event capability and unified ingress

- `IntegrationPlugin.capabilities.events` is an optional compile-time contract.
  It is injected through the existing registry constructor; there is no dynamic
  registration API, handler registry product or remote plugin runtime.
- One provider-neutral ingress owns every webhook: `POST /api/webhooks?token=<endpointId>`.
  The token is the stable, server-generated `IntegrationWebhookEndpoint` UUID
  bound to exactly one connection; it is read repeatedly from
  `GET /api/integration-connections/:id/webhook` and has no create, rotate,
  revoke, regenerate or hash lifecycle.
- The HTTP handler only authenticates the endpoint, reads a bounded allowlisted
  body, admits the request into the bounded volatile `EventRuntime` inbox and
  returns `200 {"received":true}`. Payload parsing, Project resolution,
  organization checks, dedup and delivery all run asynchronously afterwards.
- Events and subscriptions are process memory only: no event table, no offline
  replay, no ACK/offset, and no delivery guarantee across restarts or windows.
- Authorization for a subscription Upgrade is always an explicit human
  AuthSession Bearer token. Cookie-only, webhook endpoint ids and workload
  execution codes are never subscription credentials.
- The subscription protocol (`mystra.events.v1`) is served by the same
  composition root that owns ingress; `server.ts` is the only entry point, and
  it keeps the Next dev HMR upgrade path separate.

## Invariants

- The registry selects by capability and contains no GitHub/Linear branching.
- GitHub repository and Issue access uses the REST API. GitHub Issues require a
  repository scope and Pull Requests are filtered from Issue results.
- Linear access is read-only: list and get use the native GraphQL API.
- Project repository onboarding resolves a RepositorySelector before persistence. Project Issue
  browsing later resolves the current GitHub repository by its persisted stable external ID.
- Legacy provider routes retain normalized Issue contracts. Project Issue list routes return a
  provider-discriminated native contract; GitHub and Linear columns, filters and cursors are not fused.
- Provider errors are mapped to stable public codes without leaking credentials.
- Pagination cursors remain opaque.
- `RepoProvider` remains repository discovery/identity only. Project branch
  inspection and exact configured-branch resolution use the provider-neutral
  standard Git reader (`git ls-remote`) with the Project's exact connection.
  Branch enumeration never calls a provider-specific branches API.
- `Project.repositoryBaseBranch` is ordinary Mystra configuration. A provider
  default branch or symbolic Git `HEAD` may prefill the setting, but refresh
  never overwrites the saved value. Setup resolves it to an exact commit and
  fails closed when it is absent.
- Standard Git access is created just in time as an opaque in-memory handle.
  Tokens are passed through process environment configuration, never clone
  URLs or argv, and Git stderr is not surfaced in stable failures.
- Feature 045 is read-only and adds no Issue detail or Issue-to-Task dispatch control. Task runtime
  creation remains undefined and requires a separate specification.
- The HTTP API is the canonical implementation. The operator CLI only calls
  those routes and does not import provider or persistence code.
- Every GitHub repository operation resolves the exact
  `repositoryConnectionId` bound to its Project. Missing selection with more
  than one active connection fails closed.
- A GitHub connection is explicitly either one App installation or one PAT.
  The resolver never falls back from one mode or connection to another.
- GitHub connection methods are deployment capabilities. Stock self-hosted
  exposes only PAT in its public method projection and returns `HOSTED_ONLY`
  from every direct App entry point；hosted may enable App only after
  caller/Team/OAuth-state and secret prerequisites pass.
- Capability is resolved from trusted server bootstrap policy, not request
  input or the presence of `MYSTRA_GITHUB_APP_*` variables. Management routes,
  repository discovery, and Runner credential resolution enforce the same
  decision.
- App connections mint short-lived installation tokens. PAT plaintext is held
  only by `SecretProvider`; public contracts and RDB receive no plaintext. RDB
  stores only an authenticated envelope with a wrapped per-secret DEK; the KEK
  remains in deployment secret management.
- Self-hosted Linear credentials are explicit Team-owned API-key connections behind
  `SecretProvider`. Product request paths do not fall back to `LINEAR_API_KEY`; values are never
  included in API responses, events, evidence, or logs.
- The event data plane imports no Next.js module. Provider failures live in
  `failure.ts`; only the HTTP adapter `error-response.ts` depends on Next.
- `MYSTRA_PUBLIC_URL` is the trusted deployment origin used to compose webhook
  URLs. It is never derived from the request `Host` or `Forwarded` header, and
  production must serve it over HTTPS.

## Deployment origin and environment

```text
MYSTRA_PUBLIC_URL   Trusted deployment origin for webhook URLs (HTTPS in production;
                    loopback HTTP is accepted only for local fixtures).
```


## Hosted GitHub App deployment

These variables belong to the hosted adapter and development tests. They do not
constitute a supported self-hosted configuration surface and must not elevate a
self-hosted deployment capability by themselves.

```text
MYSTRA_GITHUB_APP_ID
MYSTRA_GITHUB_APP_CLIENT_ID
MYSTRA_GITHUB_APP_CLIENT_SECRET
MYSTRA_GITHUB_APP_SLUG
MYSTRA_GITHUB_APP_PRIVATE_KEY
MYSTRA_GITHUB_APP_CALLBACK_URL
```

Set the GitHub App Setup URL to
`/api/integration-connections/github/setup` and the OAuth callback URL to the
absolute value of `MYSTRA_GITHUB_APP_CALLBACK_URL`. Keep "Request user
authorization (OAuth) during installation" disabled because GitHub treats that
option and the Setup URL as mutually exclusive.

Hosted activation also requires authenticated caller/Team authorization and a
durable one-time OAuth transaction store. Until those prerequisites exist, the
App method must remain unavailable even when the identity variables are valid.

## Canonical routes

```text
GET  /api/integrations
GET  /api/integration-connections
GET  /api/integration-connections/github/connect
GET  /api/integration-connections/github/setup
GET  /api/integration-connections/github/oauth/callback
POST /api/integration-connections/github/pat
PUT  /api/integration-connections/github/pat/:id
DELETE /api/integration-connections/:id
POST /api/integration-connections/linear/api-key
PUT  /api/integration-connections/linear/api-key/:id
DELETE /api/integration-connections/linear/api-key/:id
GET  /api/integration-connections/linear/api-key/:id/teams
GET  /api/integration-connections/:id/webhook
POST /api/webhooks?token=:endpointId
GET  /api/events/catalog?teamId=:teamId
GET  /api/events/stream?teamId=:teamId     (WebSocket upgrade, subprotocol mystra.events.v1)
GET  /api/projects/:slug/issue-sources
PUT  /api/projects/:slug/issue-sources/linear
DELETE /api/projects/:slug/issue-sources/linear
GET  /api/projects/:slug/issues/:provider
GET  /api/projects/:slug/repository/branches
GET  /api/integrations/:integration/repositories
POST /api/integrations/:integration/repositories/resolve
GET  /api/integrations/:integration/issues
GET  /api/integrations/:integration/issues/:identifier
```

The operator CLI and Web Projects surface call these routes. They do not import
provider implementations.

## `mystra-agent events`

The workload CLI's `events` family is a thin client of the routes above. It
reuses the existing operator session store (`--session-file`, then
`MYSTRA_OPERATOR_STATE_PATH`, then `~/.mystra/operator-session.json`) and never
accepts `MYSTRA_EXECUTION_CODE` as a fallback credential.

```sh
mystra-agent events list --team <mystra-team-uuid>
mystra-agent events subscribe --team <mystra-team-uuid> --project <project-uuid> \
  --integration linear --event-type linear.issue.state_changed \
  [--subscription-id <id>] [--filter key=value ...] [--control-stdin]
```

stdout carries only protocol JSON; diagnostics, reconnect backoff and the
online-only loss window go to stderr. `--server` must equal the session file's
normalized origin. Exit codes: 0 success/controlled stop, 2 usage or session
configuration, 3 transport, 4 authentication or authorization, 130/143 on
signal. The CLI does not start Agents and does not append Session events.

Project creation binds only an exact IntegrationConnection and stable remote
repository identity. Agent, Runtime, Provider and Context are independent
Session launch choices; Project onboarding does not accept, resolve or persist
execution defaults. The operator CLI currently exposes Project list/inspect but
not create, pending a thin client for the current connection-ID contract.
