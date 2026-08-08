# Implementation Plan: Task 上下文容器与创建入口

## UX Intent

`/new` is the immersive manual Task intake surface. It reuses the existing Mystra composer,
shared Project dropdown and shell action levels while replacing the obsolete Project-required
Issue-selection behavior with title, description and optional Project only. The scoped browser
draft covers loading, retry, explicit clear, success clear and Team/user changes; it never acts
as server persistence. The form must keep its single primary commit, bilingual copy, keyboard
submission, visible text status, 44px touch targets and no page-wide overflow at
320/768/1024/1440px. The primary risk is accidentally implying Session launch or making Project
mandatory; network verification must prove neither occurs.

**Branch**: `047-task-context` | **Date**: 2026-08-08 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/047-task-context/spec.md`

## Summary

047 直接替换当前 pre-0.1 Task 合同：Task 是 Team 直属的持久 Agent 工作容器，拥有显式 `title` 与 `description`，可在创建时保存零或一个不可变 Project 上下文引用；Issue-derived Task 另保存一个不可变的 exact Issue source fingerprint。Project 是上下文引用而非所有权，Issue 关联是外部只读引用而非 snapshot。

交付覆盖共享 Zod 合同、SQLite/PostgreSQL Prisma schema 与破坏性迁移、`RdbProvider`、canonical HTTP API、薄 MCP/CLI、`/new` 手动创建页、Task 详情编辑、Task 分组发现，以及 045 GitHub/Linear Issue 行上的 `Create Task` / `Open Task`。所有路径只写 Task；不创建、启动、配置或推导 Session。

## Technical Context

**Language/Version**: TypeScript 5.9，Node.js 24.14.0
**Primary Dependencies**: Next.js 16 Route Handlers、React 19、Zod 4、Prisma ORM/Client 7.9.1、现有 GitHub/Linear Integration providers
**Storage**: SQLite 与 PostgreSQL/Supabase-backed PostgreSQL，通过 `RdbProvider` 暴露领域合同
**Testing**: Vitest 4、共享 schema tests、双数据库 provider contract、API/MCP/CLI tests、UI model/component tests、真实 Chrome 验收
**Target Platform**: 自托管 Mystra control plane；API/MCP/CLI 为可编程面，Web 为次级客户端
**Project Type**: TypeScript monorepo / web service + Web UI + CLI
**Performance Goals**: Task 创建/更新在一个数据库事务内完成；Issue 列表装饰只增加一次 exact-source-scoped batch Task-link 查询；20 个并发同 Issue 请求只产生一行
**Constraints**: Team fail-closed；title 最大 500 字符；description 最大 100,000 字符；关系创建后不可变；无 Issue snapshot；无 Session mutation；无 pre-0.1 compatibility path
**Scale/Scope**: 单 Team 自用规模；一个 Task 表；4 个 Task HTTP 能力；1 个 Issue-to-Task HTTP 能力；New、详情、列表/侧栏和两种 provider Issue 行

## Constitution Check

### Pre-design gate

| Gate | Result | Evidence |
| --- | --- | --- |
| Spec owns product boundary | PASS | 047 明确 supersede 045 的 no-Task-control 子句与旧 Task 临时合同；其余 045/046 边界保持不变 |
| Team 是租户边界 | PASS | Team ID 仅从 authenticated active Team 派生；Task、Project、Issue source 均按同 Team 验证 |
| Task 不属于 Project | PASS | `projectId` 可空且仅为 immutable context reference；Task 总是直接外键到 Team |
| Session 与 Project/Task 独立 | PASS | 本计划不修改 Session schema、route 或启动逻辑；Task Project 不投影为 Session Project |
| Typed service boundaries | PASS | shared Zod 定义手动创建、Issue 创建、更新、记录、详情与错误响应 |
| Provider replaceability | PASS | exact Issue 验证复用 ProjectIssuesService 与 provider-specific lookup，不把 GitHub/Linear 凭据或 Prisma 类型泄漏到 Task API |
| External Issue remains read-only | PASS | 只调用 read/get；不 comment、transition、write-back、cache 或 persist snapshot |
| Prisma stays behind RdbProvider | PASS | 公共类型来自 `@mystra/shared`；Prisma row 只在 DB 模块映射 |
| SQLite/PostgreSQL parity | PASS | 两套 schema 与 migration 同步；parity/provider contract 验证 |
| pre-0.1 direct replacement | PASS | 丢弃旧 Task 数据形态；移除 `issueDispatchKey`、Task `metadata` 与 Project-required contract，不加 alias/dual read |
| Evidence before delivery | PASS | tasks 要求 RED/GREEN、typecheck/build、真实 API/浏览器和 GitNexus changed-flow 审查 |

### Post-design gate

设计没有引入 Constitution 例外。Task `description` 是 Mystra-owned 工作说明，不是外部 Issue description snapshot；Issue source fingerprint 只包含重新解析 exact Issue 所需的稳定身份。047 是 Constitution 所称的 Task follow-up spec，且没有借机恢复旧 Session persistence。

## What Already Exists

- `packages/shared/src/management.ts` 与 `schemas.ts` 已有旧 Task schema，但仍要求 Project 并依赖 `metadata` / `issueDispatchKey`。
- `PrismaRdbProvider` 已有 Task create/get/list 和 repeated issue-key concurrency pattern，可直接替换为 manual idempotency 与 exact Issue uniqueness。
- `/api/tasks`、`/api/tasks/[id]`、MCP tools 和 operator CLI 已形成 canonical HTTP + thin adapter 形状。
- `/` 的 `NewTaskComposer` 已能创建 Task，但错误地强制 Project，且没有 description、draft scope 或客户端幂等键。
- `ProjectIssuesService` 已拥有 exact Project/source/credential 验证和 GitHub/Linear provider 列表能力；providers 已有单 Issue read seam。
- 045 的 `ProjectIssuesBrowser` 与 provider-specific tables 已提供行级外部链接和独立分页状态。
- AppShell、Search、Task table 已消费 Team-scoped Task list，但假设每个 Task 都有 Project。

## Architecture and Data Flow

```text
Manual create
/new | MCP | CLI
      |
      v
shared Task create schema + active Team auth
      |
      v
RdbProvider.createTask (idempotencyKey)
      |
      v
Prisma Task row (projectId nullable)

Issue row create
Project Issue row
      |
      v
POST /api/projects/{slug}/issues/{provider}/task
      |
      v
ProjectIssuesService exact-source verification
  current Project + exact connection/scope + provider GET
      |
      v
RdbProvider.createTaskFromIssue
  unique(provider, connection, scope, externalId)
      |
      v
Task row returned; UI remains on Issue list
      |
      +--> explicit Open Task click --> /tasks/{id}
```

Task detail Issue resolution is best-effort and read-only. The API first compares the persisted source fingerprint with the Project's current exact source; only if it still matches may it perform a provider GET. Any mismatch/upstream failure yields `unavailable` while the Task itself remains readable.

## Public Contract Decisions

- `POST /api/tasks`: strict manual create body `{ title, description?, projectId?, idempotencyKey }`; public callers cannot submit Team or Issue fields. Returns `{ task, created }`, status 201 for create and 200 for replay.
- `GET /api/tasks`: Team-scoped list containing both Project and no-Project Tasks.
- `GET /api/tasks/{id}`: returns Task plus optional live Issue resolution; Issue failure never hides Task content.
- `PATCH /api/tasks/{id}`: updates only `title` and/or `description`; strict schema rejects Project/Issue relation fields.
- `POST /api/projects/{slug}/issues/{provider}/task`: accepts `{ externalId, identifier }`, re-reads the exact provider Issue, then atomically create-or-return the single Task.
- Provider Issue list items gain optional `taskId`; this is local link state, not a persisted Issue snapshot.
- MCP `mystra_create_task` and new `mystra_update_task` use the same shared schemas. CLI `tasks create` and `tasks update` remain thin HTTP clients.
- Manual creation key is caller-generated UUID, unique within Team and stored internally; it is not exposed as Task content.
- Exact Issue uniqueness uses `{ provider, connectionId, scopeExternalId, externalId }`; mutable title, URL and display identifier are never the uniqueness key.
- Stable Task errors: `INVALID_TASK`, `TASK_NOT_FOUND`, `TASK_PROJECT_UNAVAILABLE`, `TASK_ISSUE_UNAVAILABLE`, `TASK_CREATE_CONFLICT` plus existing auth/integration envelopes.

## Data and Persistence Decisions

- Replace the Task table directly. Existing pre-0.1 Task rows are not migrated because they lack valid Team-peer semantics and explicit title/description.
- New Task columns: `id`, `teamId`, `title`, nullable `description`, nullable `projectId`, nullable internal `idempotencyKey`, nullable all-or-none Issue fingerprint columns, `createdAt`, `updatedAt`.
- SQL CHECK constraints enforce Issue all-or-none and Issue-implies-Project. Shared Zod and RdbProvider enforce the same invariant before Prisma.
- `@@unique([teamId, idempotencyKey])` makes manual retry durable; a nullable key does not collide across Issue-created rows.
- `@@unique([issueProvider, issueConnectionId, issueScopeExternalId, issueExternalId])` is the final repeated-Issue boundary.
- Issue list decoration queries links by `{teamId, provider, connectionId, scopeExternalId, externalIds[]}` rather than `projectId`, so two Projects bound to the same exact source still resolve the one existing Task.
- `Project.tasks` remains a nullable relation collection for context navigation only. Team owns every Task row.
- No Task status, priority, assignment, external body, Session count, runtime selection or execution field is added.

## Failure Modes

| Failure | Detection | Stable behavior | Partial write? |
| --- | --- | --- | --- |
| blank/oversized title or description | shared Zod at boundary and RDB | `INVALID_TASK` | no |
| cross-Team/missing/archived Project | Team-filtered active Project lookup | `TASK_PROJECT_UNAVAILABLE` / not found | no |
| repeated manual request | Team + idempotency unique | same Task, `created=false` | no |
| repeated/concurrent exact Issue request | source fingerprint unique + conflict reread | same Task, one row | no |
| Issue source switched/revoked | persisted vs current fingerprint comparison | fail closed; no alternate source | no |
| provider 404/malformed/upstream error | provider read validation | Issue create fails; detail shows unavailable | no |
| PATCH contains Project/Issue fields | strict update schema | request rejected | no |
| Task create/update | code and request audit | zero Session and Issue-write mutations | no |
| draft storage unavailable | guarded localStorage access | current-tab form still usable | n/a |

## Project Structure

```text
specs/047-task-context/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/task-management.md
├── checklists/engineering-review.md
└── tasks.md

packages/shared/src/
├── task.ts
├── project-issues.ts
├── management.ts
├── schemas.ts
└── index.ts

apps/control-plane/
├── prisma/{sqlite,postgresql}/schema.prisma
├── prisma/{sqlite,postgresql}/migrations/<timestamp>_task_context/migration.sql
├── src/lib/db/{rdb-provider,prisma-provider,prisma-client,prisma-mappers}.ts
├── src/lib/tasks/task-service.ts
├── src/lib/integrations/{project-issues,github,linear}.ts
├── app/api/tasks/{route.ts,[id]/route.ts}
├── app/api/projects/[slug]/issues/[provider]/task/route.ts
├── app/new/page.tsx
├── app/tasks/{page.tsx,[id]/page.tsx}
└── app/_components/
    ├── new-task-composer.tsx
    ├── project-issues-browser.tsx
    ├── project-issue-tables.tsx
    ├── task-table.tsx
    └── app-shell.tsx

scripts/operator-cli.mjs
```

**Structure Decision**: 复用 shared → RdbProvider → Prisma → Route Handler 分层。仅新增一个 Task service 以集中 exact Issue 解析与详情 availability；不新增 package、repository abstraction、事件总线或 Session 占位层。

## Verification Strategy

1. Shared schema RED/GREEN：字段白名单、长度、可空 Project、Issue all-or-none、immutable update、response union。
2. Provider contract RED/GREEN：无 Project Task、Project Task、手动幂等、20-way Issue 并发、跨 Team、归档 Project、更新只改内容。
3. Migration/parity：两数据库 schema/索引/check 语义一致；旧 Task 数据明确丢弃。
4. Issue resolution：GitHub/Linear exact source、external ID 校验、source switch/revoke、404/invalid response、无 write-back。
5. HTTP/MCP/CLI：active Team 派生、create/list/get/update、strict relation immutability、稳定错误。
6. UI models/components：No project 分组、每 Task 仅一次、draft scope、Issue button create/open 状态。
7. 真实 runtime：迁移 SQLite，创建无 Project/带 Project Task，Issue create stay-on-list，Task update，刷新后 Open Task，console/network/a11y/320–1440px。
8. 全量 `pnpm test`、`pnpm typecheck`、`pnpm build`，完成前 GitNexus `detect_changes(compare main)`。

## Parallelization and Order

```text
shared contracts
      |
      +--> Prisma/RdbProvider ----> Task HTTP/MCP/CLI
      |
      +--> provider exact lookup -> Issue-to-Task route
      |
      +--> UI models ------------> New/Task/Issue UI
```

合同必须先完成。其后 provider lookup 与纯 UI model tests 可并行；Prisma/RdbProvider 完成后 HTTP 与 Issue service 才能集成。由于本次执行没有被授权使用子 Agent，实际按相同依赖顺序单线程推进。

## GitNexus Evidence

- 收口索引重建：7,523 nodes、13,080 edges、300 flows。
- `PrismaRdbProvider.createTask`：LOW，5 个 impacted symbols，2 条 affected processes；interface dispatch 使结果是 lower bound。
- `NewTaskComposer`：LOW，1 个直接上游。
- `ProjectIssuesBrowser`：LOW，4 个 impacted symbols。
- `groupTasksByProject`：LOW，2 个 impacted symbols。
- 运行中的 MCP 存储引擎比 CLI 索引版本旧（40 vs 42），因此本阶段使用同一 GitNexus CLI 的 query/impact；没有把 MCP 失败伪装为成功。

## NOT in scope

- Session create/launch/default resolution/auto routing；047 只保证 Task 对它们不是前置条件。
- Issue write-back、缓存、详情页、需求状态机或批量 dispatch。
- Task archive/delete/history、模板、subtask、依赖图或 workflow automation。
- 新 provider、新 artifact distribution pipeline 或 hosted multi-tenancy。
- 为旧 Task 数据推测 title/source 的兼容迁移。

## Complexity Tracking

无 Constitution 例外。文件跨度来自一个现有业务对象必须在 RDB、API/MCP/CLI 和三个现有 Web 入口上同时替换。唯一新 service 只处理 Issue exact-source read 与 Task create/read composition；它不拥有 Session、workflow 或 provider credentials。

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
| --- | --- | --- | --- | --- | --- |
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | Product decisions already fixed by owner |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | — | Outside voice skipped; no delegation authorized |
| Eng Review | `/plan-eng-review` | Architecture & tests | 1 | CLEAR | 5 issues resolved, 0 critical gaps, 0 unresolved |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | Runtime browser verification remains in implementation |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | No new developer artifact |

- **UNRESOLVED:** 0
- **VERDICT:** ENG CLEARED — ready for task generation.
- **METADATA NOTE:** gstack review-log/read binaries are absent on this machine; the durable review is [checklists/engineering-review.md](./checklists/engineering-review.md).
