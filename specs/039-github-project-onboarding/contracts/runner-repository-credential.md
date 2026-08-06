# Contract: Runner Repository Credential

## Request

`POST /api/runner/sessions/{sessionId}/repository-credential`

Headers:

```http
Authorization: Bearer {runner-credential}
Content-Type: application/json
```

Body:

```json
{ "purpose": "clone" }
```

`purpose` is one of `clone`, `push`, `review`. It exists for audit-safe error context and future least-privilege token narrowing; it is not persisted.

## Success response

```json
{
  "credential": {
    "provider": "github",
    "username": "x-access-token",
    "secret": "<short-lived installation token>",
    "expiresAt": "2026-08-05T09:00:00.000Z"
  }
}
```

Headers:

```http
Cache-Control: no-store, private
Pragma: no-cache
```

This is an authenticated Runner protocol response, not a public management response. Middleware, request logs and errors must never include its body.

## Authorization

The server MUST, in order:

1. authenticate Runner bearer credential;
2. verify Session is assigned to that Runner;
3. load Task and active Project;
4. load Project `repositoryConnectionId`;
5. require connection provider equals Task repository provider;
6. mint/reuse a valid installation token.

Failures before step 6 do not call GitHub.

## Error responses

- `401 RUNNER_UNAUTHORIZED`
- `404 SESSION_ASSIGNMENT_MISMATCH`
- `409 REPOSITORY_CONNECTION_MISMATCH`
- `503 REPOSITORY_CREDENTIAL_UNAVAILABLE`

Error messages are sanitized and never include token, private key, OAuth code, Git URL credentials or upstream response bodies.

## Runner consumption

- clone: pass `secret` only to the clone process environment.
- push/review: pass credential as a separate in-memory provider argument; do not mutate global `process.env`.
- `RepositoryAuthBinding` uses `runtime-ref` as a non-secret descriptor and never contains the token value.
- GitHub provider does not read `MYSTRA_GITHUB_TOKEN`.
- The credential object is not copied into events, Session result, delivery metadata or captured exception context.
