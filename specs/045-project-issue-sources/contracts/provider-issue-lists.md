# Contract: Provider-specific Project Issue Lists

## Route

`GET /api/projects/:slug/issues/:provider`

`provider` is exactly `github` or `linear`. Common query fields are `first` and opaque `after`; provider-specific filters are parsed by separate schemas.

## GitHub response

```json
{
  "provider": "github",
  "items": [{
    "externalId": "123",
    "number": 42,
    "title": "Example",
    "state": "open",
    "assignees": [{ "id": "1", "login": "octocat", "avatarUrl": "https://..." }],
    "labels": [{ "id": "1", "name": "bug", "color": "d73a4a" }],
    "milestone": { "id": "1", "title": "v1" },
    "updatedAt": "2026-08-08T00:00:00.000Z",
    "url": "https://github.com/.../issues/42"
  }],
  "pageInfo": { "hasNextPage": false, "endCursor": null }
}
```

GitHub request uses the Project repository exact connection/external ID and filters Pull Requests.

## Linear response

```json
{
  "provider": "linear",
  "items": [{
    "externalId": "uuid",
    "identifier": "ENG-42",
    "title": "Example",
    "status": { "id": "uuid", "name": "In Progress", "type": "started" },
    "priority": { "value": 2, "label": "High" },
    "assignee": { "id": "uuid", "name": "Ada" },
    "cycle": { "id": "uuid", "name": "Cycle 12", "number": 12 },
    "updatedAt": "2026-08-08T00:00:00.000Z",
    "url": "https://linear.app/.../issue/ENG-42"
  }],
  "pageInfo": { "hasNextPage": false, "endCursor": null }
}
```

Linear request applies exact Team filter from `ProjectIssueSource`.

## Invariants

- response is a discriminated union; no `all` provider.
- provider-specific filters/cursors are not translated across providers.
- cursor validation binds Project, provider, connection and external scope.
- no Issue detail body, Task action or mutation endpoint is part of this contract.
- third-party strings render as text; `url` must be validated HTTPS.
