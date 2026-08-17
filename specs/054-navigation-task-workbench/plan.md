---
title: "Implementation Plan: 主导航与 Task 工作台"
taco_scope: plan
---

**Branch**: `054-navigation-task-workbench` | **Date**: 2026-08-14 | **Spec**: [spec.md](spec.md)

## Summary

054 将 Task 状态字段从无必要的 `productionStatus` 直接重命名为 `status` 并收敛为五态，建立 Team-scoped、cursor-paged Tasks read model，把 Metadata 增加为前后端共享 Task 对象的顶层 JSON field，并把已批准的 shared-code prototype composition 接入 production Control Plane。根入口先提供无数据 Overview placeholder，053 后续原位替换。Project/Issue 只显示持久化 external identifiers，不保存 snapshot，也不为列表逐行访问 provider。

## Technical Context

**Language/Version**: TypeScript 5.9，Node.js 24.14.0
**Primary Dependencies**: Next.js 16、React 19、Zod 4、Prisma 7.9.1、Vitest 4、`@mystra/ui`
**Storage**: SQLite 与 PostgreSQL/Supabase-backed PostgreSQL，通过 `RdbProvider`；在两套 Task row 增加单一 Metadata JSON payload，不新增关系表或 normalized columns
**Testing**: Vitest unit/contract/component/route tests，Prisma schema parity，production browser journey，`pnpm typecheck`/`pnpm test`/`pnpm lint`
**Target Platform**: 已认证 Mystra Control Plane，320px–1440px；独立 Spec Prototype route `/054-navigation-task-workbench`
**Project Type**: TypeScript monorepo web application
**Performance Goals**: 默认每页 50、最大 100；10,000 Tasks 下首屏 read model p95 < 500ms；无逐行 provider request
**Constraints**: pre-0.1 直接替换，无 alias/shim/dual read；Task object/API/RDB/Prisma/CLI/UI 统一使用 `status`，不保留 `productionStatus`；Web 是次级 client；Task/Project/Session 为 Team-scoped sibling；external snapshots 不进入 Task/Project persistence
**Scale/Scope**: 单 Team 至少 10,000 Tasks；Table/Kanban 共享同一查询与异步追加集合；Metadata 保持 Task-owned JSON object

## Constitution Check

- **Open Agents / Mystra seam**: PASS。054 不改变 execution framework/provider ownership。
- **RDB abstraction**: PASS WITH HIGH-RISK NOTE。只在现有 Task persistence seam 增加 page query 与单一 Metadata JSON field，SQLite/PostgreSQL 对等；查询时的 case-insensitive implementation 保持在 provider 内，不泄漏 Prisma/dialect。GitNexus 对整个 `RdbProvider` 报 CRITICAL（42 direct、149 total、44 flows），任务必须限制变更并跑全 contract suite。
- **Team authorization**: PASS。所有列表、写入与 detail 均使用 active Team，不接受 caller-supplied cross-Team fallback。
- **External ownership**: PASS。Project 显示 `repositoryExternalId`，Issue 显示 exact `identifier`；不保存/缓存 snapshot，不逐行解析 provider。
- **Task/Session separation**: PASS WITH REPLACEMENT。五态 Task 与 Session/internal TaskExecutionAttempt/Workspace facts 正交；首次 Session launch 根据 Provider 解析 Runtime，并把 nullable `Task.runtimeId` 原子写入为不可变 Runtime Context，再以 `<Task, Runtime>` 解析或自动初始化 Workspace。pending Task 的首个 launch 复用 TaskExecutionAttempt 并进入 `in_progress`；后续 `in_progress` launch 不替换 attempt 首 Session，也不得切换 Runtime。Workspace 过程不进入导航或工作台。
- **UI prototype reuse**: PASS。prototype 路由已存在；production/prototype 直接消费 `packages/ui`，只迁移 feature composition 与 production adapters。
- **Verification/docs**: PASS。计划包含 schema/API/UI/CLI/prompt/tests/docs 与 browser evidence。

Post-design re-check：PASS。没有新增 MVP-excluded provider、automation、workflow、external write-back 或 snapshot cache。

## Architecture And Data Flow

```text
active Team
   │
   ├─ GET /api/tasks?cursor&limit&query&status&sort
   │      └─ Task page query ── Task(metadata included) + persisted external identifiers
   │                              └─ no provider fan-out
   │
   ├─ AppShell ── Overview placeholder / Inbox / Tasks / Runtimes
   │      ├─ header New Task + Search
   │      └─ non-terminal Active Tasks projection
   │
   └─ Tasks workbench
          ├─ shared query state ── Table
          └─ same IDs/state ───── Kanban
                 └─ /tasks/:id ── Sessions + Right Panel
```

```text
Task status transition ownership

pending ──Start──> in_progress ──Agent──> blocked
   │                    │                    │
   └─Human cancel───────┴─Human cancel──────┼─Human resume──> in_progress
                                            ├─Human done────> done
                                            └─Human cancel──> canceled

done/canceled are terminal. Session/TaskExecutionAttempt failures do not enter this graph.
```

## Project Structure

```text
packages/shared/src/
├── task.ts                         # five-state + metadata + page contracts
└── management.ts                   # public request/response schemas

apps/control-plane/
├── prisma/{sqlite,postgresql}/     # parity Task metadata field/page indexes
├── src/lib/db/                     # provider page query + mappings/contracts
├── src/lib/tasks/                  # status transition service
└── app/
    ├── api/tasks/                  # paged list/create/update/status routes
    ├── _components/                # AppShell + production adapters
    ├── tasks/                      # workbench composition
    └── page.tsx                    # Overview placeholder boundary

packages/ui/src/                    # shared shell/icons/list/dialog primitives
apps/spec-prototype/                # approved mock composition, no production data
packages/agent-cli/                 # five-state workload CLI
specs/054-navigation-task-workbench/# contracts, tests, review artifacts
```

**Structure Decision**: 沿用现有 monorepo 与 `RdbProvider`/shared-schema/Control Plane 分层；不新建服务或平行 UI package。

## Implementation Slices

1. 五态与 Task.metadata shared contracts、双 Prisma schema、provider mappings/tests。
2. Team-scoped cursor page API 与 external-identifier-only projection。
3. `waiting_for_review` 全调用面直接替换：status service、agent CLI、prompt、API/UI/fixtures/docs。
4. 共享 UI 缺口与 production AppShell/root placeholder。
5. Tasks Table/Kanban、New Task/Search、Active Tasks、Task detail/New Session adapters。
6. Owner correction：将 TaskWorkspace 从 `taskId` 唯一直接替换为 `(taskId, runtimeId)` 唯一；Task 新增 nullable `runtimeId`，首次 Session launch 根据 Provider 自动解析并原子锁定，后续 Session 只能在该 Runtime 运行；setup/retry Workspace 以 accepted continuation 隐藏异步准备过程。跨 Runtime Workspace sync、Task Runtime 解锁/迁移/failover deferred。
6. browser acceptance、performance evidence、terminology audit、Taco/status refresh。

## Engineering Review Gate

工程评审记录见 [engineering-review.md](engineering-review.md)。结论：`CLEARED_WITH_GATES`，无未决产品决策；实现前必须遵守 RdbProvider blast-radius gate、五态全调用面 gate、provider fan-out=0 gate，以及现有 3 个 prototype regression 的先修测试任务。

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | — |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | — | — |
| Eng Review | `/plan-eng-review` | Architecture & tests | 1 | CLEAR WITH GATES | 5 risks, 0 unresolved product decisions, 0 silent critical gaps |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | prototype reviewed | Taco owner feedback imported |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | — |

**VERDICT**: ENG CLEARED WITH EXPLICIT IMPLEMENTATION GATES；等待 owner 审阅 Taco 后才能进入 implementation。
