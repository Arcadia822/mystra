# Integrations

Integrations expose named, independently composable capabilities:
`RepoProvider` discovers and resolves remote repositories, while
`IssueProvider` lists and reads work items.

The default registry contains exactly:

- GitHub: repositories and repository-scoped Issues.
- Linear: read-only Issues.

## Invariants

- The registry selects by capability and contains no GitHub/Linear branching.
- GitHub repository and Issue access uses the REST API. GitHub Issues require a
  repository scope and Pull Requests are filtered from Issue results.
- Linear access is read-only: list and get use the native GraphQL API.
- Project inputs carry a RepositorySelector. The control plane resolves it
  through the selected RepoProvider before a persistence method is called.
- Provider-specific payloads are normalized into shared Issue contracts.
- Provider errors are mapped to stable public codes without leaking credentials.
- Pagination cursors remain opaque.
- Dispatch always refetches the selected Issue and atomically creates or reuses
  one Task plus its initial Session using a unique dispatch key.
- The dispatch request explicitly selects the initial Session's Agent and
  branch; subsequent sibling Sessions may make independent selections.
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
  only by `SecretProvider`; public contracts and SQLite receive no plaintext.
- `LINEAR_API_KEY` and GitHub App deployment secrets are read by the control
  plane only; values are never included in API responses, events, evidence, or
  logs.

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
GET  /api/integrations/:integration/repositories
POST /api/integrations/:integration/repositories/resolve
GET  /api/integrations/:integration/issues
GET  /api/integrations/:integration/issues/:identifier
POST /api/integrations/:integration/issues/:identifier/dispatch
```

The operator CLI and Web Projects surface call these routes. They do not import
provider implementations.

Project creation resolves omitted execution defaults server-side from
`MYSTRA_DEFAULT_AGENT` and `MYSTRA_DEFAULT_DEV_IMAGE`. Repository onboarding
does not ask the operator to choose either value.
