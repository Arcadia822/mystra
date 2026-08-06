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
- GitHub repository discovery and delivery use short-lived GitHub App
  installation tokens only. There is no repository PAT fallback.
- `LINEAR_API_KEY` and GitHub App deployment secrets are read by the control
  plane only; values are never included in API responses, events, evidence, or
  logs.

## GitHub App deployment

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

## Canonical routes

```text
GET  /api/integrations
GET  /api/integration-connections
GET  /api/integration-connections/github/connect
GET  /api/integration-connections/github/setup
GET  /api/integration-connections/github/oauth/callback
GET  /api/integrations/:integration/repositories
POST /api/integrations/:integration/repositories/resolve
GET  /api/integrations/:integration/issues
GET  /api/integrations/:integration/issues/:identifier
POST /api/integrations/:integration/issues/:identifier/dispatch
```

The operator CLI and Web Projects surface call these routes. They do not import
provider implementations.
