# Contract: Project onboarding with exact connection

## Repository list and resolve

```text
GET /api/integrations/github/repositories?connectionId=<uuid>&limit=50&cursor=<opaque>
GET /api/integrations/github/repositories/resolve?connectionId=<uuid>&identifier=owner/repo
```

`connectionId` is required whenever more than one active GitHub connection exists。Only a sole active connection may be inferred for backward-compatible callers。

## Create Project

Minimal Web request：

```json
{
  "name": "mystra",
  "slug": "mystra",
  "repository": {
    "integration": "github",
    "connectionId": "00000000-0000-4000-8000-000000000001",
    "identifier": "Arcadia822/mystra"
  }
}
```

`defaultAgent` and `runtime` are optional compatibility/advanced API fields。When absent，control plane resolves global defaults and persists the resolved values。The Add Project Web UI does not expose them。

Before persist，server refetches repository with the exact connection，rejects inactive/mismatched/inaccessible/archived targets，then atomically persists `repositoryConnectionId` and snapshot。

## Runner credential

Runner requests remain assignment-scoped and `no-store`。Resolver dispatches only by the Project-bound connection：

- `github-app` -> short-lived installation token
- `personal-access-token` -> PAT under a short response lease

No other connection or env token is consulted。
