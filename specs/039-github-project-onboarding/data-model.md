# Data Model: GitHub Project Onboarding

## IntegrationConnection

表示一次已验证的 provider installation 绑定。它是业务实体，但不包含任何 secret。

| Field | Type | Rules |
|---|---|---|
| `id` | UUID | Mystra stable identity |
| `integration` | provider key | MVP `github` |
| `provider` | provider key | repository provider，MVP `github` |
| `externalId` | string | GitHub installation ID；同 integration 唯一 |
| `account` | object | `externalId`、`login`、`type`、可选 avatar URL |
| `repositorySelection` | `all \| selected` | GitHub installation scope summary |
| `permissions` | record | permission name → access level；非秘密 |
| `status` | `active \| inactive` | 同 integration 最多一个 active |
| `createdAt` | datetime | 首次验证时间 |
| `updatedAt` | datetime | 最近验证/状态变化时间 |

### Invariants

- user OAuth token、App JWT、private key、installation token 没有字段。
- `(integration, externalId)` 唯一。
- 同一 `integration` 最多一个 `active` row；新 installation 激活时旧 row 原子变为 inactive。
- inactive 连接不用于新建 Project 的默认仓库发现，但已绑定 Project 可继续尝试使用它。

### State transitions

```text
not persisted
    |
    | verified OAuth + accessible installation
    v
  active <------------------- reconnect same installation
    |
    | another installation becomes active
    v
 inactive ------------------> active (revalidated explicitly)
```

## RepositorySelector

Project create/update 的外部输入。

| Field | Type | Rules |
|---|---|---|
| `integration` | provider key | must match connection.integration |
| `connectionId` | UUID | must resolve to an existing connection |
| `identifier` | string | provider-native remote ID，GitHub 为 `owner/name` |

服务端使用 connection credential 重新解析；selector 不接受 URL、path 或 snapshot fields。

## Project additions

| Field | Type | Rules |
|---|---|---|
| `repositoryConnectionId` | UUID | references `IntegrationConnection.id` |

`repository` 继续是 provider-resolved immutable `RepositorySnapshot`。创建/更新时要求：

```text
connection.integration == selector.integration
connection.provider    == resolvedRepository.provider
connection can access selector.identifier at write time
```

Task 继续冻结 Project repository snapshot，不复制 connection secret。Runner credential route 从 Task → Project 找 connection。

## EphemeralInstallationCredential

非业务实体，仅为控制面内存和私有 Runner response 的短期值。

| Field | Type | Rules |
|---|---|---|
| `provider` | provider key | `github` |
| `username` | string | Git HTTPS username，`x-access-token` |
| `secret` | string | installation token；永不持久化 |
| `expiresAt` | datetime | GitHub response value |

### Lifecycle

```text
App private key -> signed JWT -> GitHub token endpoint
                                 |
                                 v
                    control-plane memory cache
                       |                 |
                  API provider      Runner exchange
                       |                 |
                 request header     phase memory/env
                       |                 |
                       +------> expires/discard
```

## SQLite schema

```sql
integration_connections(
  id TEXT PRIMARY KEY,
  integration TEXT NOT NULL,
  provider TEXT NOT NULL,
  external_id TEXT NOT NULL,
  account TEXT NOT NULL,
  repository_selection TEXT NOT NULL,
  permissions TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(integration, external_id)
)

projects(
  ...,
  repository_connection_id TEXT NOT NULL
    REFERENCES integration_connections(id) ON DELETE RESTRICT,
  repository_snapshot TEXT NOT NULL,
  ...
)
```

Partial unique index enforces one active connection per integration. Schema version increments; the exact recognized v3 local schema is rebuilt under existing destructive-MVP rules.
