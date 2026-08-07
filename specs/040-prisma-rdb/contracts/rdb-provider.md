# Contract：异步 RdbProvider

## Stable domain surface

保留的方法继续使用 Mystra-owned domain types；合同变化包括返回值统一包装为 `Promise`、删除 Session
persistence、遗留 Session summary/artifact identity、ContextBundle/Runner persistence，以及把 IntegrationConnection
修订为 connection + inline capabilities JSON：

```ts
interface RdbProvider {
  close(): Promise<void>;
  upsertIntegrationConnection(input: IntegrationConnectionUpsert): Promise<IntegrationConnection>;
  updateIntegrationConnectionCapabilities(
    connectionId: string,
    capabilities: IntegrationCapabilities,
  ): Promise<IntegrationConnection>;
  createProject(input: ProjectCreate): Promise<Project>;
  getProjectBySlug(slug: string): Promise<Project | undefined>;
  // ...其余现有方法同样异步化
}
```

039/041 的 IntegrationConnection 方法必须在同步 main baseline 后一并异步化。

## Observable behavior

- 除明确删除 Session persistence、event-derived Session coordination summary/`artifactId`、ContextBundle/Runner persistence、
  Project execution defaults、Project Repository snapshot persistence、Task source/objective/snapshots 与 Integration capability payload 修订外，未删除的 HTTP status、response
  body、MCP result 和 CLI payload 不变。
- list ordering 与 SQLite 当前实现一致。
- not found 仍 resolved 为 `undefined`，由 route 映射既有 404。
- domain conflicts 仍使用现有 machine-readable error prefix。
- provider/Prisma errors不得直接越过 boundary。

## Transaction groups

以下操作必须是单数据库 transaction：

- activate IntegrationConnection；
- replace IntegrationConnection capabilities JSON；
- dispatch Issue -> Task；

## Concurrency

Issue dispatch 使用 Prisma transaction、unique constraint normalization 与必要的 `P2034` 有界重试。
Capability JSON 由单一 Connection service 进行整份原子替换；第一期不提供
per-capability 并发写接口。运行时业务路径禁止 raw SQL。

## Removed surface

- 删除 `appendSessionEvent`、`listInternalSessionEvents` 与 `getSessionSummary`。
- 删除 `CoordinationSessionSummary` route/MCP/shared projection，不增加 phase/summary 替代字段。
- 删除 `ExecutionContractReference.artifactId`，并将 `ExecutionSpecArtifact` 改为
  `ExecutionSpecSnapshot`；不设置替代 Artifact identity。
- 删除 ContextBundle create/get/list provider surface。
- 删除 Runner register/authenticate/heartbeat/claim/list/credential rotation provider surface。
- 删除全部 Session create/get/list/state/result/cancel/complete/stale/assignment provider surface。
- 删除 Task detail 的 child Session count/latest relation projection。
- 删除 Task source、objective、issue snapshot 与 repository snapshot 的读写合同；`dispatchKey` 改名为
  `issueDispatchKey`，旧值在 adoption 时无损迁移。

## Integration capability boundary

- `IntegrationConnection` 不再要求 repository-specific fields；`authMethod`、`providerSubject`、
  `connectionConfig` 是 provider-neutral connection metadata。
- `displayName` 是 nullable、可独立编辑的 operator label；清空写入 `null`，不得触发 credential rotation、
  capability replacement 或 provider identity 变更。
- repository selection、permissions 与 access summary 移入 `IntegrationConnection.capabilities` JSON。
- capability map 必须使用统一 `state/config/permissions/accessSummary/verifiedAt` envelope，并在整份
  对象写入前由 plugin-owned Zod schema 校验；未知或 plugin 未实现 capability fail closed。
- `Project.repositoryConnectionId` 保留，但 Project create/re-resolution 必须同时验证该 connection
  存在 enabled `repositories` capability。

## Project/Task external-information boundary

- `Project.repositorySnapshot` 从持久化/写入合同删除，替换为非空
  `Project.repositoryExternalId`。它是 provider-defined opaque stable identity，不是 repository slug。
- `Project.repositoryConnectionId + Project.repositoryExternalId` 构成不可变 binding；普通 Project update
  不得更换该 tuple。
- Task 只保留 identity、Project relation、nullable unique `issueDispatchKey` 与 metadata；source、objective、
  Issue/Repository snapshots 不进入 RDB，也不得藏入 metadata。
- 040 不修改 `RepoProvider`，不新增 stable-ID lookup、Issue/Repo Info API/service、cache、TTL、refresh 或
  invalidation。未来 cache 由 Integration 规格设计；受影响调用者作为后续适配项记录。

## Approved compatibility break

批准删除面（包括 Session persistence）导致的既有 UI、API、MCP、Runner 和测试失败不在 040 修复。实现必须记录受影响 surface，
但不得为使其继续运行而恢复旧表/字段、保留 direct-SQL owner 或伪造兼容数据。

## Boundary audit

下列位置不得 import Prisma generated modules、`@prisma/adapter-*`、`pg` 或 `better-sqlite3`：

- `packages/shared/**`
- `apps/control-plane/app/api/**`
- MCP/CLI packages
- Integration service contracts

允许 import 的范围仅为 `apps/control-plane/src/lib/db/**` 和 provider-specific migration/adoption
scripts。
