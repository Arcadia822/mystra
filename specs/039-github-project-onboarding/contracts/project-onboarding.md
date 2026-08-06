# Contract: Project Onboarding

## Repository list

`GET /api/integrations/github/repositories?connectionId={uuid}&limit=100&cursor=...`

- `connectionId` must identify a GitHub IntegrationConnection.
- The provider uses an installation token and `/installation/repositories`.
- Response remains the existing `RepositoryListResponse`; token and connection internals are absent.
- The Modal follows `pageInfo.endCursor` through an explicit Load more action, appends by repository `externalId`, and preserves already loaded items if a later page fails.

If `connectionId` is omitted, the single current active connection is used for list/Issue compatibility. Project writes never infer it.

## Project create request

`POST /api/projects`

```json
{
  "name": "Mystra",
  "slug": "mystra",
  "repository": {
    "integration": "github",
    "connectionId": "1e0b2a7d-8e0d-45a0-bde9-f7db056e8e88",
    "identifier": "arcadia/mystra"
  },
  "defaultAgent": "copilot",
  "runtime": {
    "provider": "docker",
    "image": "mystra-runner:local"
  }
}
```

The server loads the exact connection, resolves `identifier` remotely, rejects archived/inaccessible repositories, and persists both `repositoryConnectionId` and the normalized snapshot atomically.

## Modal state contract

```text
closed
  -> sourceSelection(github default)
      -> connectionRequired
      -> repositoryLoading
          -> repositoryError --retry--> repositoryLoading
          -> repositoryEmpty
          -> repositoryList --select--> configuration
                                  |
                                  +--change--> repositoryList
                                  +--submit failure--> configuration (fields retained)
                                  +--success--> closed + project detail
```

Opening and closing the Modal does not mutate the browser route. Closing discards an unsubmitted draft. Repository selection controls whether the remaining settings are visible.

## Styling/business components

- `SettingGroup`: flat grouped rows, no card-within-card decoration.
- `SettingRow`: `minmax(0,1fr) auto`, title + description left, control/status right, 32px desktop gap.
- compact controls use existing Mystra UI primitives and theme tokens.
- at narrow widths each row becomes one column with description before control.
