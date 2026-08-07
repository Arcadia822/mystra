# Data Model: 远程仓库 Integration

> **Superseded persistence model (2026-08-06):** `040-prisma-rdb` replaces Project
> `repository_snapshot` with `repository_connection_id + repository_external_id`; Repo Info retrieval/cache is
> deferred. The Task `repository_snapshot` keeps its existing contract. The Job schema
> below is obsolete.

## IntegrationDescriptor

| Field | Type | Rule |
|---|---|---|
| `name` | string | registry 内唯一，例如 `github` |
| `provider` | string | provider family |
| `capabilities` | string[] | 唯一集合：`repositories`、`issues` |

## RepositorySelector

| Field | Type | Rule |
|---|---|---|
| `integration` | string | 必须对应已注册 Integration |
| `identifier` | string | provider-native identifier；GitHub 为 `owner/name` |

只允许出现在 Project create/update request。不得持久化为执行事实。

## RepositorySnapshot

| Field | Type | Rule |
|---|---|---|
| `integration` | string | 解析它的 Integration |
| `provider` | string | 选择 Runner delivery implementation 的稳定 key |
| `externalId` | string | provider-native immutable id |
| `fullName` | string | 人类可读远程身份 |
| `url` | URL | Web review URL |
| `cloneUrl` | URL | HTTPS clone URL；不得是 `file://` |
| `defaultBranch` | string | Provider 当前默认分支 |
| `visibility` | `private/public/internal` | 规范化可见性 |
| `isArchived` | boolean | Project create 默认拒绝 archived repository |
| `fetchedAt` | datetime | snapshot 解析时间 |

## RepositoryListRequest / Response

- request：`first` 1..100，opaque `after`。
- response：`items: RepositorySnapshot[]` 与 `pageInfo`。
- Provider 保持 cursor opaque；核心不解析 cursor。

## Issue scope

`IssueProvider` 的 list/get input 可带 `repository: RepositorySnapshot`。GitHub provider 必须要求 scope 并验证 `repository.provider === "github"`；Linear provider忽略缺失 scope。GitHub Issue 的 `IssueReference.repository` 保存最小 Repository reference。

## Project

- `repository: RepositorySnapshot` 为必填且不可为 null。
- `baseBranch` 仍是 Project execution override，默认取 `repository.defaultBranch`。
- repository update 必须以新 selector 重新 resolve 后完整替换。
- 不存在 `repo` compatibility field。

## Job / Lane / ExecutionSpec

- `repository: RepositorySnapshot` 从 Project 冻结。
- 不接受 job submission override。
- Project 后续更新不修改已提交 Job 的 snapshot。

## SQLite

### projects

- 删除 `repo TEXT`.
- 新增 `repository_snapshot TEXT NOT NULL`.

### jobs

- 删除 `repo TEXT`.
- 新增 `repository_snapshot TEXT NOT NULL`.

JSON decode 失败必须包含 table、record id 与 field name。旧 schema 不自动升级。
