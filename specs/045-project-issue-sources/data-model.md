# Data Model: Project Issue Sources

## ProjectIssueSource

Durable configuration, not an Issue cache.

| Field | Type | Rule |
|---|---|---|
| `id` | UUID | stable internal identity |
| `teamId` | UUID | Mystra tenant, server-derived |
| `projectId` | UUID | exact owning Project |
| `integration` | string | `linear` in 045 |
| `connectionId` | UUID | exact Team-owned IntegrationConnection |
| `scopeType` | string | `linear-team` in 045 |
| `scopeExternalId` | string | provider-stable Linear Team ID |
| `createdAt`, `updatedAt` | datetime | server timestamps |

Constraints:

- unique `(projectId, integration)` enforces 0..1 Linear source.
- Project, connection and source share the same `teamId` at service boundary.
- connection/project deletion is restricted while referenced.
- mutable Linear Team name/key/icon/archive state is not persisted as identity.
- no Issue body, title, cursor, cache or Task linkage appears here.

```text
Mystra Team 1 ── * IntegrationConnection
     |                    |
     *                    *
   Project 1 ── 0..1 ProjectIssueSource
                         |
                         └── exact Linear connection + Linear Team external ID

Project ── exact GitHub connection + repository external ID
   └────── derived GitHub Issue source (no extra row)
```

## Linear Connection projection

Uses existing `IntegrationConnection`:

- `integration/provider`: `linear`
- `authMethod`: `api-key`
- `providerExternalId`: verified Linear viewer/credential owner ID，用作同一 Team 内 connection 去重身份
- `providerSubject`: non-secret viewer identity and workspace summary
- `connectionConfig`: non-secret workspace identifiers only
- `capabilities.issues`: enabled plus verified Team count/read summary
- `credentialRef`: internal only, `linear-api-key/<connection>/<version>`
- `credentialState/status`: existing lifecycle fields

同一 Linear workspace 中不同 verified viewer 可各自建立 connection；同一 viewer 的新 key 走 replace/upsert，避免重复身份。Replace preserves connection `id` and atomically changes credential version。Workspace ID 保留在非秘密 config/subject 中，不承担 connection 唯一性。

## Provider-specific list projections

### GitHubIssueListItem

`externalId, number, title, state, assignees[], labels[], milestone|null, updatedAt, url`

### LinearIssueListItem

`externalId, identifier, title, status, priority|null, assignee|null, cycle|null, updatedAt, url`

Both validate external URL and timestamps but are not persisted.

## State transitions

```text
Linear connection
  create(valid key)       -> active/ready
  replace(valid new key)  -> same id, active/ready, new secret version
  replace(invalid key)    -> no durable change
  upstream auth failure   -> request error; no fallback
  delete(no references)   -> secret + connection removed atomically
  delete(referenced)      -> conflict, unchanged

Project Linear source
  absent -> PUT verified scope -> present
  present -> PUT new verified scope -> atomically replaced
  present -> DELETE -> absent
  invalid connection/team -> preserved for diagnosis, unavailable at read time
```

## Prisma logical shape

```prisma
model ProjectIssueSource {
  id              String @id
  teamId          String
  projectId       String
  integration     String
  connectionId    String
  scopeType       String
  scopeExternalId String
  createdAt       String
  updatedAt       String

  @@unique([projectId, integration])
  @@index([teamId])
  @@index([connectionId])
}
```

SQLite and PostgreSQL schemas use identical logical fields and constraints. Prisma types remain adapter-internal.
