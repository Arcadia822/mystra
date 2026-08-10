# Data Model: Task Workspace Setup

## TaskWorkspace

Durable Team-scoped domain entity。Task 与该实体为 `1 : 0..1`；不是 host path record。

| Field | Type | Rules |
|---|---|---|
| `id` | UUID | primary identity |
| `teamId` | UUID | immutable；与 Task/Project/Runtime Team scope 一致 |
| `taskId` | UUID | immutable；unique |
| `projectId` | UUID | immutable snapshot reference from Task context |
| `runtimeId` | UUID | setup 时冻结；ready 后不可静默变化 |
| `state` | enum | `queued \| preparing \| ready \| failed \| unavailable` |
| `sharingMode` | literal | MVP 固定 `shared-mutable` |
| `connectionId` | UUID | exact Project repository connection |
| `repositoryExternalId` | string | provider-stable identity；非 URL/name snapshot |
| `configuredBaseBranch` | string | Setup 时读取并冻结的 Project `repositoryBaseBranch` |
| `issueProvider` | enum/null | immutable exact Task Issue reference |
| `issueConnectionId` | UUID/null | exact Task Issue reference |
| `issueScopeExternalId` | string/null | exact Task Issue repository/team scope |
| `issueExternalId` | string/null | exact Task Issue reference |
| `baseRef` | string | repository policy result |
| `baseCommit` | string | exact immutable commit identifier |
| `branchName` | string | validated decision |
| `branchStrategy` | string | provider/version or `mystra-task-fallback-v1` |
| `workspaceRef` | string/null | only set for ready；opaque，not an absolute path |
| `activeAttemptSequence` | integer | monotonically increasing fencing token |
| `failureCode` | enum/null | stable public code |
| `failureMessage` | string/null | redacted operator-safe detail |
| `createdAt` | datetime | server time |
| `updatedAt` | datetime | server time |
| `readyAt` | datetime/null | first/current publish time |

### Invariants

1. `taskId` unique，数据库与 service 双重强制。
2. `workspaceRef != null` iff state is `ready`；failed/unavailable 不可消费。
3. repository/Issue provenance 必须与 setup 时 Task/Project references 一致。
4. `configuredBaseBranch`、`baseCommit` 与 `branchName` 在首次 attempt 前冻结；Project 后续修改与 retry 都不重算既有 Workspace intent。
5. `runtimeId` 对 ready Workspace 固定；自动迁移不在 MVP。
6. API 永不返回 absolute path、credential 或 clone URL。

## WorkspacePreparationAttempt

Runner/control-plane operational record；不作为顶级业务对象展示。

| Field | Type | Rules |
|---|---|---|
| `id` | UUID | attempt identity |
| `workspaceId` | UUID | parent TaskWorkspace |
| `sequence` | integer | unique per Workspace，strictly increasing |
| `state` | enum | `queued \| claimed \| succeeded \| failed \| expired` |
| `runnerId` | UUID/null | claim owner |
| `leaseExpiresAt` | datetime/null | server time |
| `claimedAt` | datetime/null | server time |
| `completedAt` | datetime/null | server time |
| `failureCode` | enum/null | stable redacted code |
| `createdAt` | datetime | server time |

### Fencing rules

- 只有 `TaskWorkspace.activeAttemptSequence == attempt.sequence` 的报告可改变 Workspace。
- claim transaction 同时验证 Runtime runner identity、online/capability 与 lease。
- lease 过期可产生下一 sequence；旧 report 返回 conflict。
- successful report 先验证 opaque ref，再原子更新 attempt + Workspace ready。

## RepositoryWorkspaceDecision

通用标准 Git repository service 产生的 provider-neutral transient value；除 provenance fields 外不整体持久化。

```ts
type RepositoryWorkspaceDecision = {
  provider: string;
  connectionId: string;
  repositoryExternalId: string;
  configuredBaseBranch: string;
  baseRef: string;
  baseCommit: string;
  transport: {
    kind: "https";
    endpoint: string; // transient, never returned by Task API
  };
};
```

Credential 不属于该对象；Git reader 和 claim 分别通过 exact connection just-in-time resolve 临时 access context。

## Project repository configuration

`Project.repositoryBaseBranch` 已是现有 Project persistence contract。048 明确其语义：

- 必填、用户可编辑、可在 repository selection 时由 Provider default branch 预填；
- 保存后是普通 Mystra Project repository configuration，不是 Provider observation/cache 或 provider capability state；
- Project update 只影响尚未创建 Task Workspace 的后续 setup；
- 通用标准 Git reader 必须验证它并返回 exact commit，不能静默 fallback。

## GitRemoteBranchPage

即时读取结果，不进入 Project persistence。

| Field | Type | Rules |
|---|---|---|
| `branches` | array | branch name、规范 `refs/heads/*`、当前 exact commit |
| `head` | object/null | standard Git symbolic `HEAD` 解析结果；不自动覆盖 Project 配置 |
| `pageInfo` | object | opaque cursor；失败不得伪装为空页 |

Branch list 用于辅助配置。读取失败时客户端可退化为普通文本设置；Setup 的 authoritative `resolveBranch` 仍必须成功。

## WorkspaceBranchDecision

```ts
type WorkspaceBranchDecision = {
  branchName: string;
  strategy: string;
  source: "issue-provider" | "task-fallback";
};
```

- Issue branch decision 接受 exact Issue reference 与 Task identity。
- 无 Issue fallback 为 `mystra/task-<task-short-id>`。
- 结果必须通过 Git check-ref-format equivalent validation。

## SessionWorkspaceAttachment (feature 049 consumer)

```ts
type SessionWorkspaceAttachment = {
  kind: "task";
  taskWorkspaceId: string;
  runtimeId: string;
  workspaceRef: string;
  sharingMode: "shared-mutable";
};
```

Attachment 是当前 Task-bound launch evidence，不是 filesystem snapshot。Project-only 与 standalone Session 整体 deferred；本合同不猜测 deferred modes 的字段，也不提供第二种 Workspace 类型。

## State transitions

```text
absent --setup--> queued --claim--> preparing --success--> ready
                         |              |
                         |              +--failure--> failed --retry--> queued
                         +--lease expiry---------------> failed/queued(next attempt)

ready --runtime confirms missing--> unavailable
```

不允许：

- `failed -> ready` without active successful attempt
- `unavailable -> ready` automatic rebuild
- `ready -> queued` automatic migration
- changing `runtimeId`, `baseCommit` or `branchName` behind a ready Workspace

## Persistence constraints

- SQLite 与 PostgreSQL 都建立 `UNIQUE(task_id)` 与 `UNIQUE(workspace_id, sequence)`。
- foreign keys 强制 Task/Project/Runtime existence；Team equality 仍由 transaction/service 验证，因为跨表 composite tenant key 不泄漏到 public DTO。
- 不持久化 transport endpoint、absolute path、credential、provider client data 或 Prisma types。
- pre-0.1 不提供旧 workspace 数据迁移或 dual-read；开发数据库按当前 schema 重建。
