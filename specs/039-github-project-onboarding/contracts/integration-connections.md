# Contract: Integration Connections

## List status

`GET /api/integration-connections`

```json
{
  "providers": [
    {
      "integration": "github",
      "connectionType": "github-app-installation",
      "configured": true,
      "connectUrl": "/api/integration-connections/github/connect"
    }
  ],
  "connections": [
    {
      "id": "1e0b2a7d-8e0d-45a0-bde9-f7db056e8e88",
      "integration": "github",
      "provider": "github",
      "externalId": "18492",
      "account": {
        "externalId": "42",
        "login": "arcadia",
        "type": "User"
      },
      "repositorySelection": "selected",
      "permissions": { "contents": "write", "pull_requests": "write" },
      "status": "active",
      "createdAt": "2026-08-05T08:00:00.000Z",
      "updatedAt": "2026-08-05T08:00:00.000Z"
    }
  ]
}
```

Only non-secret values are returned. `configured=false` means deployment configuration is incomplete; missing env names are documented server-side, not returned as secrets.

## Start installation

`GET /api/integration-connections/github/connect?returnTo=%2F`

- validates `returnTo` as same-origin relative path;
- redirects to `https://github.com/apps/{configured-slug}/installations/new`;
- sets only a short-lived validated return target cookie.

Reconnect may add `mode=reconnect`; when an active connection exists it starts OAuth validation for that exact installation without changing durable state first.

## Setup callback

`GET /api/integration-connections/github/setup?installation_id=18492&setup_action=install`

- treats `installation_id` as untrusted;
- creates state + PKCE verifier/challenge;
- stores short-lived HttpOnly transaction cookies;
- redirects to GitHub user authorization.

No durable write occurs here.

## OAuth callback

`GET /api/integration-connections/github/oauth/callback?code=...&state=...`

Success sequence:

1. constant-time state validation;
2. exchange code with client ID/secret and PKCE verifier;
3. list installations accessible to the user token;
4. require exact pending installation and configured App ID;
5. discard user token;
6. atomically activate connection metadata;
7. clear transaction cookies and redirect to `returnTo?settings=integrations&github=connected`.

Failure redirects with a stable public code such as `github=connection_failed&reason=oauth_state_invalid`; upstream bodies and tokens are never reflected.

## Error shape

```json
{
  "error": {
    "code": "GITHUB_APP_NOT_CONFIGURED",
    "message": "GitHub App connection is not configured"
  }
}
```

Other stable codes include `GITHUB_OAUTH_INVALID`, `GITHUB_INSTALLATION_UNVERIFIED`, `INTEGRATION_TIMEOUT`, `INTEGRATION_RATE_LIMITED`, and `INTEGRATION_UPSTREAM_ERROR`.
