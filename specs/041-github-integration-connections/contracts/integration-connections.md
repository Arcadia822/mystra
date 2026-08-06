# Contract: Integration Connections

## List

`GET /api/integration-connections?integration=github`

Returns deployment-derived provider methods and public connection views。No credential ref、PAT fingerprint、token or App private material。The stock OSS projection omits hosted-only methods and connections；direct unsupported routes return a structured reason code。

```json
{
  "providers": [{
    "integration": "github",
    "methods": [
      { "type": "personal-access-token", "configured": true, "createUrl": "/api/integration-connections/github/pat" }
    ]
  }],
  "connections": [{
    "id": "00000000-0000-4000-8000-000000000001",
    "integration": "github",
    "provider": "github",
    "connectionType": "personal-access-token",
    "account": { "externalId": "42", "login": "Arcadia822", "type": "User" },
    "repositorySelection": "token",
    "permissions": { "contents": "write", "pull_requests": "unverified" },
    "credentialState": "ready",
    "status": "active",
    "createdAt": "2026-08-06T00:00:00.000Z",
    "updatedAt": "2026-08-06T00:00:00.000Z"
  }]
}
```

The private Hosted distribution may extend the same method union with an actionable GitHub App variant only when caller-auth、Team、OAuth transaction store and App secret prerequisites are healthy：

```json
{
  "type": "github-app",
  "configured": true,
  "connectUrl": "/api/integration-connections/github/connect"
}
```

Stock OSS does not emit an unavailable App card at all。The internal deployment capability keeps the stable `HOSTED_ONLY` reason；a future Hosted contract may replace `configured` with the planned availability discriminant when the private distribution is implemented。

## Create PAT

`POST /api/integration-connections/github/pat`

Request body，`cache-control: no-store`：

```json
{ "token": "<one-time-input>", "displayName": "Arcadia delivery" }
```

Response `201`：`{ "connection": <public IntegrationConnection> }`。

The request schema accepts `token`; every response schema rejects it。Handler must not interpolate request body/error into logs or public messages。

## Replace PAT

`PUT /api/integration-connections/github/pat/:id`

Body same as create。Only a PAT connection can be replaced。Success keeps connection `id` unchanged。

## Delete

`DELETE /api/integration-connections/:id`

- `204`：secret and metadata removed。
- `409 INTEGRATION_CONNECTION_IN_USE`：Project references exist；details may include non-secret Project ids/slugs。
- `409 INTEGRATION_CONNECTION_DELETE_INCOMPLETE`：connection remains inactive and retryable。

## OAuth return state

Hosted OAuth success/failure redirects use the safe relative path frozen in the server-side transaction and preserve：

```text
?settings=integrations&integration=github&result=connected|connection_failed
```

The browser cookie contains only an opaque transaction id。The callback atomically consumes the transaction and re-checks authenticated actor + Team authorization before exchanging the GitHub code。

## Self-hosted App route behavior

These routes all return `409 INTEGRATION_CONNECTION_METHOD_UNAVAILABLE` with `reasonCode=HOSTED_ONLY` before redirect、OAuth exchange、database mutation or installation-token mint：

```text
GET /api/integration-connections/github/connect
GET /api/integration-connections/github/setup
GET /api/integration-connections/github/oauth/callback
```

The exact connection credential resolver returns the same stable error when repository discovery or Runner delivery references an App connection under self-hosted profile。

## Stable errors

- `INTEGRATION_CONNECTION_NOT_FOUND`
- `INTEGRATION_CONNECTION_MISMATCH`
- `INTEGRATION_CONNECTION_SELECTION_REQUIRED`
- `INTEGRATION_CONNECTION_IN_USE`
- `INTEGRATION_CONNECTION_METHOD_DISABLED`
- `INTEGRATION_CONNECTION_METHOD_UNAVAILABLE`
- `INTEGRATION_CONNECTION_OWNED_BY_ANOTHER_TEAM`
- `INTEGRATION_OAUTH_TRANSACTION_INVALID`
- `INTEGRATION_OAUTH_TRANSACTION_EXPIRED`
- `INTEGRATION_OAUTH_TRANSACTION_CONSUMED`
- `INTEGRATION_CREDENTIAL_INVALID`
- `INTEGRATION_CREDENTIAL_UNAVAILABLE`
- existing timeout/rate-limit/upstream codes
