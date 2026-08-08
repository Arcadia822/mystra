# Implementation Plan: Project Issue 来源与分集成浏览

**Branch**: `045-project-issue-sources` | **Date**: 2026-08-08 | **Spec**: [spec.md](spec.md)
**Input**: Team-owned Linear API-key connections、Project exact Linear Team source、Project-scoped GitHub/Linear read-only lists，以及 Project-first `/issues`。

## Summary

在现有 GitHub exact repository binding、IntegrationConnection、SecretProvider、Prisma `RdbProvider` 和只读 Issue providers 上补齐 Linear connection 与 Project scope。GitHub Issue source 继续由 Project repository connection 派生；Linear source 使用独立 `ProjectIssueSource` 记录 exact connection + provider-stable Linear Team ID。Canonical Project API 返回 provider-specific discriminated responses，Web 只消费该 API；GitHub 与 Linear 不共享列、筛选或 cursor。

本功能没有 Mystra Issue 详情页。行级唯一动作是以新窗口打开经过服务端验证的 provider URL。没有 Task/Session 创建、dispatch 或 write-back。

## Technical Context

**Language/Version**: TypeScript 5.9，Node.js 24.14.0
**Primary Dependencies**: Next.js 16 Route Handlers、React 19、Zod 4、Vitest 4、Prisma 7、Linear GraphQL HTTP API、GitHub REST API
**Storage**: SQLite、PostgreSQL/Supabase-backed PostgreSQL via `RdbProvider`；只保存 connection metadata、secret envelope 与 ProjectIssueSource，不保存 Issue
**Testing**: Vitest shared schema/provider/service/API/UI-model tests、SQLite/PostgreSQL provider contract、真实浏览器 responsive/keyboard 验证
**Target Platform**: self-hosted Linux/macOS control plane；Web 为 secondary client
**Project Type**: TypeScript monorepo web service + shared contracts
**Performance Goals**: 每次列表请求使用常数次 RDB scope lookup 和一次 credential read；Linear 每页一次 provider request，GitHub 因 Project 只持久化稳定 repository external ID，先按 ID 解析当前 repository 再请求 Issues（每页两次）；默认 25 条，最大 100 条；切换 provider 不触发隐藏 provider 请求
**Constraints**: exact connection；Owner/Admin mutate、Member read；no env fallback；no Issue persistence；opaque cursor 绑定 Project/provider/connection/scope；第三方文本不作为 HTML
**Scale/Scope**: 每 Team 多 Linear connections；每 Project 0..1 Linear Team source；每 Project 1 个派生 GitHub source；无聚合

## Constitution Check

- **Product boundary**: PASS。保留只读 IssueProvider；明确排除 dispatch、详情页、write-back、OAuth 和 cache。
- **Typed boundaries**: PASS。所有 request/response、provider payload 和 persistence input 由 shared/local Zod schema 验证。
- **Provider separation**: PASS。GitHub/Linear 使用 discriminated list contracts，只有最小 `IssueReference` 共享。
- **Tenancy/auth**: PASS。active Mystra Team 来自 session；Project、connection 与 source 三方 Team ownership 均由服务端复核。
- **Secret hygiene**: PASS。API key 只经 request -> validation -> SecretProvider；RDB 与 public response 无明文。
- **Persistence ownership**: PASS。Prisma 细节留在 DB module；`RdbProvider` 不泄漏 Prisma 类型。
- **Pre-0.1 policy**: PASS。直接替换环境级 Linear credential 产品路径，不提供 fallback 或 compatibility shim。
- **Verification**: PASS。双数据库 contract、API auth/error、provider parsing、responsive/keyboard 和 secret leak checks 均列入 gate。

## What already exists

| Existing surface | Reuse decision |
|---|---|
| `IntegrationConnection` + RDB secret-envelope transaction | 复用；Linear 新 service 采用 GitHub PAT 的 validate-before-switch 模式 |
| Team auth/RBAC route helpers | 复用；不接受客户端 `teamId` |
| Project exact GitHub connection + repository external ID | 直接派生 GitHub Issue source，不重复持久化 |
| `GitHubIssueProvider` / `LinearIssueProvider` | 复用 transport/error mapping；扩展 provider-specific list projection与 scope |
| generic integration Issue routes | 保留兼容内部 provider contract，但 045 Web 不使用；Project API 成为 canonical UI surface |
| Settings modal + GitHub detail patterns | 复用交互结构，新增 Linear detail |
| Project page placeholder、Task-backed `/tasks` nav | 替换为 Project object tabs 和真正 `/issues` route |
| approved prototype | 作为 UI anatomy 与 responsive 行为基线 |

## Design Decisions

### D1. 非 repository Issue scope 使用独立关联表

`ProjectIssueSource` 保存 `projectId + integration + connectionId + scopeType + scopeExternalId`，并以 `(projectId, integration)` 唯一。045 只允许 `integration=linear`、`scopeType=linear-team`。GitHub source 不入表。

这比把 `linearTeamId` 塞进 Project 更诚实：external scope 同时依赖 exact credential 与 provider identity，而且连接删除保护需要真实外键/查询边界。

### D2. Project-scoped canonical API

```text
browser / Project page
       |
       v
GET /api/projects/:slug/issues/:provider
       |
       +-- authenticated active Team + active Project
       +-- resolve exact source
       +-- resolve exact credential
       +-- provider-specific request/validation
       v
{ provider: "github", items: GitHubIssueListItem[] ... }
or
{ provider: "linear", items: LinearIssueListItem[] ... }
```

不扩展全局 `defaultIntegrationRegistry` 来选择 Project credential。该 symbol 为 CRITICAL 风险且服务端全局 registry 无法表达 per-request exact connection。新增 Project service 显式构造 scoped provider。

### D3. Linear API-key lifecycle

```text
submit key -> viewer/workspace/teams validation -> seal new version
                  | failure                 | success
                  v                         v
              no write             atomic envelope + connection switch
```

创建/替换使用现有 SecretProvider transaction。`connectionConfig` 只保存非秘密 workspace 摘要；capabilities 保存 Issue read 验证和 Team count。删除时同时检查 repository Project references 与 `ProjectIssueSource` references。

### D4. Scope validation and no fallback

配置 Linear source 时，服务端使用目标 connection 解密 key，并实时查询该 key 可访问 Teams；只在 exact external ID 命中时 upsert source。列表请求不使用 `LINEAR_API_KEY`，connection/source 不可用即返回稳定错误。

### D5. Provider-specific list contracts

- GitHub item: `number,title,state,assignees[],labels[],milestone,updatedAt,url`。
- Linear item: `identifier,title,status,priority,assignee,cycle,updatedAt,url`。
- 两者各自拥有 filter schema、opaque cursor 和 response discriminator。
- 页面可以复用 loading/error primitives，但不能复用一张最小公分母 table schema。

### D6. Cursor is scope-bound

API cursor 封装 provider upstream cursor 加 Project/provider/connection/scope fingerprint，并以 strict schema 解码后对照当前 scope。任何 scope 变化均拒绝旧 cursor。客户端在 Project/provider/connection/source 变化时清空状态；provider 间状态保存在独立 reducer entry。cursor 不是授权凭据，因此不另引入签名密钥；所有授权与 scope 仍从服务端当前状态重建。

### D7. External navigation only

服务端只返回 schema-validated `https` provider URL。UI 使用语义明确的外部链接，不渲染 description HTML，不增加 `[identifier]` Mystra route。现存 generic get-Issue API 不作为 045 UI 导航目标，也不扩展其产品承诺。

## End-to-end Data Flows

### Configure Linear source

```text
Owner/Admin -> PUT source {connectionId, linearTeamExternalId}
  -> session active Team
  -> Project belongs to Team and active
  -> connection belongs to Team, linear/api-key, active/ready
  -> SecretProvider.get(exact credentialRef)
  -> Linear teams query finds exact external ID
  -> RdbProvider.upsertProjectIssueSource (unique project+linear)
  -> public source view (no key, live team display)
```

### List issues

```text
Project + provider + provider filters + cursor
  -> auth + Project lookup
  -> GitHub: Project repositoryConnectionId + repositoryExternalId
  -> Linear: ProjectIssueSource + exact connection + linearTeamExternalId
  -> scoped provider request
  -> strict provider payload parse
  -> provider-specific response
  -> independent UI state/render
```

## GitNexus Impact Record

| Symbol | Risk | Plan response |
|---|---:|---|
| `RdbProvider` | CRITICAL, 19 direct dependents / 38 flows | additive methods only; SQLite + PostgreSQL contract suite mandatory |
| `defaultIntegrationRegistry` | CRITICAL, 5 direct API callers | do not add per-Project credential logic here |
| `ShellSettings` | HIGH, 3 shell flows | isolate Linear detail component/model; shell change limited to detail discriminator |
| `LinearIssueProvider` | LOW | extend with explicit Team scope and provider-specific mapping tests |
| `ProjectDetailPage` | LOW | replace placeholder with shared Project Issues surface |
| `AppShell` | LOW | switch Issues link `/tasks` -> `/issues`; retain direct Task routes |

## Project Structure

```text
specs/045-project-issue-sources/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── linear-connections.md
│   ├── project-issue-sources.md
│   └── provider-issue-lists.md
├── checklists/engineering-review.md
└── tasks.md

packages/shared/src/
├── integrations.ts
├── issue-core.ts
└── project-issues.ts              # provider-specific public contracts

apps/control-plane/
├── prisma/{sqlite,postgresql}/
├── src/lib/db/
├── src/lib/integrations/
├── app/api/integration-connections/linear/api-key/
├── app/api/projects/[slug]/issue-sources/linear/
├── app/api/projects/[slug]/issues/[provider]/
├── app/_components/
├── app/issues/
└── app/projects/[slug]/
```

**Structure Decision**: 保持现有 monorepo 分层。shared 只放公开类型；credential/source orchestration 在 control-plane service；Prisma 隔离于 DB adapter；Project 页面与 `/issues` 复用同一 client surface。

## Implementation Slices

1. Shared provider-specific contracts and failing tests.
2. Prisma/RdbProvider `ProjectIssueSource` with SQLite/PostgreSQL contract tests.
3. Linear validation/credential/source services with secret lifecycle tests.
4. Project-scoped GitHub/Linear list service and API route tests.
5. Linear Settings detail and Project source configuration.
6. Shared Issues browser, Project tab, Project-first `/issues`, shell route correction.
7. Full static/runtime/browser/security verification and spec reconciliation.

## NOT in scope

- Mystra Issue detail page/drawer：owner 明确延期，行只开 provider URL。
- Issue -> Task / Session / Runtime dispatch：Task 创建执行合同尚未定义。
- Issue mutation、comment、webhook、sync/write-back：045 为 read-only。
- Hosted Linear OAuth：cloud auth/refresh policy 需独立规格。
- Issue cache/snapshot/search：当前必须 live read，缓存需 freshness contract。
- 多 Linear Team、workspace-wide scope、provider/project aggregation：与 exact scope 冲突。
- CLI/MCP list adapter：canonical API contract 可供后续薄适配，但本功能只交付 Web。

## Complexity Tracking

| Complexity | Why needed | Simpler alternative rejected because |
|---|---|---|
| New `ProjectIssueSource` entity | exact connection + provider scope is durable Project configuration | Project JSON/metadata lacks FK, uniqueness and deletion protection |
| Separate provider list schemas | owner requires native fields and non-fused state | shared minimal table discards milestone/cycle/priority semantics |

## Engineering Review Gate

Status: **CLEARED**. Full findings and test diagram: [checklists/engineering-review.md](checklists/engineering-review.md).

- Architecture: no unresolved issue. Global registry scope leak avoided.
- Code quality: no unresolved issue. Shared orchestration is limited to Project source resolution, not provider row shape.
- Tests: all planned branches have named unit/contract/API/browser coverage; no silent failure accepted.
- Performance: no N+1 provider calls; hidden provider is not fetched; cache deliberately excluded.
- Parallelization: sequential implementation recommended because shared contracts and RDB model gate every later slice.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|---|---|---|---:|---|---|
| Eng Review | `/plan-eng-review` | Architecture & tests | 1 | CLEAR | 3 risks resolved in plan, 0 critical gaps |
| Design Review | approved prototype | UI behavior | 1 | CLEAR | provider separation and no-detail boundary approved |

**VERDICT:** ENG + DESIGN CLEARED; ready for task decomposition.
