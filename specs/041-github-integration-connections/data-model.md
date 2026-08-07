# Data Model: GitHub Integration 多连接与 PAT

> **Superseded persistence model (2026-08-06):** `040-prisma-rdb` owns current Connection capability
> JSON and Project stable Repository identity fields. Any complete Project Repository snapshot or execution-default
> persistence below is historical. Task source, objective and Issue/Repository snapshots are removed, and
> `dispatch_key` becomes `issue_dispatch_key`; cache is deferred. Session persistence is also excluded from 040.

## DeploymentProfile

Server-owned runtime value，not persisted from user input：

```text
DeploymentProfile = "self-hosted" | "hosted"
```

- open-source default assembly：`self-hosted`。
- official Cloud assembly：`hosted`。
- unit/integration tests may inject either profile。
- request、cookie、Host header 与 App env config cannot elevate profile。
- profile is selected by the server composition root，not stored in RDB and not
  exposed as an operator-facing environment switch。
- a Hosted profile is usable only when its typed service bundle includes caller
  auth、Team authorization、durable OAuth transaction storage、managed secrets
  and GitHub App identity；otherwise App availability is
  `PREREQUISITE_UNAVAILABLE`。
- this is a stock-distribution support boundary，not an attempt to prevent an
  open-source fork from replacing the composition root。

## IntegrationMethodCapability

Derived public view，not RDB state：

```text
IntegrationMethodCapability =
  | { method, availability: "available", actionUrl }
  | { method, availability: "unavailable", reasonCode, reason }

reasonCode =
  | "HOSTED_ONLY"
  | "NOT_CONFIGURED"
  | "POLICY_DISABLED"
  | "PREREQUISITE_UNAVAILABLE"
```

For self-hosted，`github-app` is always `HOSTED_ONLY` even when App environment
variables exist。PAT availability depends on SecretProvider health。

## Public IntegrationConnection

| Field | Type | Rule |
|---|---|---|
| `id` | UUID | stable connection identity |
| `integration` | provider kind | `github` in this feature |
| `provider` | provider kind | `github` |
| `connectionType` | enum | `github-app` or `personal-access-token` |
| `externalId` | string optional | App installation id may be public；PAT fingerprint never public |
| `displayName` | string optional | operator label，non-secret |
| `account` | account object | verified GitHub id/login/type/avatar |
| `repositorySelection` | enum | `all` / `selected` / `token` |
| `permissions` | record | non-secret capability summary，never token/scopes copied blindly |
| `credentialState` | enum | `ready` / `missing` / `invalid`；public health only |
| `status` | enum | `active` / `inactive` |
| `createdAt` / `updatedAt` | datetime | server timestamps |

Hosted records additionally carry `teamId`、`createdByActorId` and
`updatedByActorId` in the internal/persistence contract。Self-hosted resolves an
implicit local Team at the service boundary instead of accepting an arbitrary
Team id from the client。

Public parsing is strict。Fields named `token`、`secret`、`credentialRef`、`fingerprint` are rejected。

## Internal IntegrationConnectionRecord

Extends the public business fields with：

| Field | Type | Rule |
|---|---|---|
| `providerExternalId` | string | App installation id or PAT SHA-256 fingerprint；never sent to client for PAT |
| `credentialRef` | string optional | required for PAT，absent for App；opaque SecretProvider key |
| `accessSummary` | JSON object | last verified non-secret repository/capability summary |

Derived `availability` is intentionally absent from the record。A connection can
remain `active` in durable lifecycle terms while being `unsupported` in the
current deployment；the public management response composes both facts without
rewriting storage。

## GitHubOAuthTransaction (Hosted only)

| Field | Type | Rule |
|---|---|---|
| `id` | opaque random id | only value carried by browser cookie |
| `nonceHash` | bytes/string | hash of high-entropy state；raw state is short-lived |
| `pkceVerifierCiphertext` | protected value | never public or logged |
| `actorId` | actor id | caller who initiated binding |
| `teamId` | Team id | exact destination Team |
| `installationIntent` | optional installation id | untrusted until GitHub verification |
| `returnTo` | relative path | validated and frozen at creation |
| `expiresAt` | datetime | 10-minute TTL |
| `consumedAt` | datetime optional | atomic single-use marker |

The OAuth user token is not a field。It exists only between code exchange and
installation verification，then is discarded。

## SecretEnvelope

Internal encrypted persistence entity；never a public API or shared client model。

```text
SecretEnvelope {
  reference: string primary key
  version: 1
  algorithm: "aes-256-gcm+aes-256-gcm-wrap"
  keyId: string
  ciphertext: base64
  ciphertextIv: base64
  ciphertextAuthTag: base64
  wrappedDataKey: base64
  wrappedDataKeyIv: base64
  wrappedDataKeyAuthTag: base64
  createdAt: ISO-8601
}
```

- ref grammar：`github-pat/<connection-uuid>/<credential-version-uuid>`。
- KEK：`MYSTRA_SECRET_STORE_KEY`，base64-decoded 32 bytes，never persisted。
- KEK label：`MYSTRA_SECRET_STORE_KEY_ID`，non-secret，default `env-v1`。
- DEK：random 32 bytes per credential version，stored only after KEK wrapping。
- plaintext lifetime：request parse → GitHub validation → encrypt，或 decrypt → one provider/Runner phase。
- SQLite/PostgreSQL use the same Prisma logical model；connection reference switch and envelope lifecycle share one serializable transaction。

## Project

Existing fields remain：

- `repositoryConnectionId`：immutable connection reference。
- `repository`：provider-resolved immutable snapshot。
- `defaultAgent`：resolved at create from request override or platform default。
- `runtime`：resolved at create from request override or default development image。

No PAT、credential ref or connection fallback list enters Project。

## SQLite schema v5

```text
integration_connections(
  id                    TEXT PRIMARY KEY,
  integration           TEXT NOT NULL,
  provider              TEXT NOT NULL,
  connection_type       TEXT NOT NULL CHECK (...),
  external_id           TEXT NOT NULL,
  display_name          TEXT,
  account               TEXT NOT NULL,
  repository_selection  TEXT NOT NULL CHECK (...),
  permissions           TEXT NOT NULL,
  access_summary        TEXT NOT NULL DEFAULT '{}',
  credential_ref        TEXT,
  status                TEXT NOT NULL CHECK (...),
  created_at            TEXT NOT NULL,
  updated_at            TEXT NOT NULL,
  UNIQUE(integration, external_id),
  CHECK (
    (connection_type = 'github-app' AND credential_ref IS NULL) OR
    (connection_type = 'personal-access-token' AND credential_ref IS NOT NULL)
  )
)

projects.repository_connection_id
  -> integration_connections.id ON DELETE RESTRICT
```

The v4 partial unique active index is removed。An ordinary `(integration, status)` index supports active listing。

## Identity and uniqueness

- GitHub App：`external_id = installation id`。Repeated OAuth upserts same row。
- PAT：`external_id = pat:<sha256(token)>`，internal only。Same token cannot create duplicate connection；different PATs for one account can coexist。
- Replacement：stable connection `id`，new immutable credential ref；new PAT fingerprint and ref replace old values atomically after validation。
- Hosted App：`(appRegistrationId, installationId)` has one owning Team。The
  same Team reconnect is idempotent；another Team receives a non-enumerating
  ownership conflict。

SHA-256 fingerprint is a dedupe key for a high-entropy token，not an authentication secret；nevertheless it is not returned publicly。

## State transitions

```text
create App/PAT
  -> active/ready

validation/use 401 or missing secret
  -> inactive/invalid
  -> reconnect/replace success
  -> active/ready

delete request
  -> Project refs > 0: blocked, no state change
  -> refs = 0: inactive -> secret delete -> row delete
```

Adding another connection never changes these transitions for existing rows。

Deployment availability is a parallel derived state：

```text
connection active
  + self-hosted + github-app -> unsupported (read-only, no credential)
  + hosted + prerequisites healthy -> available
  + hosted + prerequisite missing -> unavailable
```

## Migration v4 → v5

Precondition：exact table set、exact v4 columns、schema version 4、expected active index SQL。

Transaction：

1. add new columns with App-compatible defaults；
2. existing rows become `github-app`，credential ref null；
3. drop unique active index；
4. add active-list index；
5. update version to 5；
6. foreign-key check。

Postcondition：all Project ids and `repository_connection_id` values byte-for-byte unchanged。

Deployment capability does not require schema v6。Existing App rows remain
inspectable when a deployment becomes self-hosted，but discovery and credential
resolution fail closed。Hosted Team/audit fields and OAuth transaction storage
land with the future caller-auth/Team persistence phase；041 defines their
contracts now and does not simulate them in SQLite as anonymous global state。
