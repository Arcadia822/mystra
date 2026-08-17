---
title: "Research: 主导航与 Task 工作台"
taco_scope: plan
---

## Decision 1：054 先行使用 Overview placeholder

**Decision**: 根入口归属 Overview surface；053 未落地时显示明确、无数据 placeholder，后续原位替换。
**Rationale**: Owner Taco review 明确要求 054 先行。placeholder 不拥有 053 query/metric/empty state。
**Alternatives considered**: 等待 053（已否决）；复制 mock Overview（违反 ownership）。

## Decision 2：外部引用只显示持久化 identifier

**Decision**: Project 显示 `repositoryExternalId`；Issue 显示 exact reference 的 `identifier`。
**Rationale**: 两者已在 source-of-truth schema/Prisma row 中持久化，列表无需 provider fan-out；符合不保存 mutable snapshot 的边界。
**Alternatives considered**: 显示 Mystra Project name（不是外部引用）；逐行实时解析（N+1、失败耦合）；缓存 snapshot（不在 054 范围）。

## Decision 3：Metadata 属于 Task 对象

**Decision**: 在 shared Task schema、create/update contracts、SQLite/PostgreSQL Task row、RDB mapper 与所有 Task API response 中增加 `metadata: Record<string, JsonValue>`；默认 `{}`，PATCH 提供时完整替换。New Task modal 暂不暴露 Metadata editor并提交默认 `{}`。
**Rationale**: Metadata 是 Task 本体属性，必须在前后端使用同一个 Task contract；不能为了 UI 展示另外制造平行 `labels`。这也与 Project/Session 已有 JSON-object persistence pattern 一致。
**Alternatives considered**: `TaskLabel[]` 子资源（owner 否决，错误拆分 Task 本体）；Task 外 response-only labels（owner 否决，前后端合同分叉）；从 Issue/Project metadata 派生（违反外部 ownership）。

## Decision 4：不持久化展示顺序或 normalized 派生值

**Decision**: Task row 只保存原始 Metadata JSON object；不创建 `TaskLabel` relation、`ordinal`、`normalizedKey`、`normalizedValue` 或 uniqueness shadow fields。前端决定 Metadata entries 的 presentation order；查询在执行时以 `lower`/`tolower` 等 provider-local方式做大小写不敏感比较，不写回规范化字段。
**Rationale**: 顺序是 presentation concern，规范化只服务查询执行；把它们持久化会制造没有产品语义的领域状态。
**Alternatives considered**: ordinal（把前端排序固化成业务合同）；normalized shadow columns（冗余且需要同步）；独立 Label catalog（没有用户需求）。

## Decision 5：Tasks 使用 cursor page read model

**Decision**: active Team 必填；default 50/max 100；opaque cursor 绑定 sort/filter fingerprint；默认 `updatedAt desc, id desc`；支持对 title/Metadata 可搜索文本的 case-insensitive query、status set 与 allowlisted sort；Table/Kanban 消费同一 accumulated ID set。
**Rationale**: 现有 `listTasks()` 全量读取不满足 10k 与 async append；opaque cursor 防止条件漂移。
**Alternatives considered**: client 全量过滤（规模不稳）；offset pagination（并发插入漂移）；两个 layout endpoints（集合容易分叉）。

## Decision 6：五态直接替换

**Decision**: 删除 `waiting_for_review`，Agent handoff 统一为 `blocked` + non-empty note；Human 可从 blocked resume/done/cancel。
**Rationale**: pre-0.1 政策与 054 owner contract；无兼容数据要求。
**Alternatives considered**: alias/UI mapping/dual read（全部违反 pre-0.1）。

## Decision 7：Task 状态字段使用 `status`

**Decision**: 将 Task object、API、shared schema、RDB contract、SQLite/PostgreSQL field/column、CLI 与 UI 的 `productionStatus` 直接重命名为 `status`；schema/type 同步收敛为 `taskStatusSchema` / `TaskStatus`，不保留旧名 alias。
**Rationale**: 状态已经处于 Task 命名空间内，`production` 前缀没有提供额外信息；外部 Issue 的 `status` 与 Session 的 `state` 位于不同对象边界，不构成字段冲突。transition request 已使用 `status`，统一命名还能消除输入/输出不一致。
**Alternatives considered**: 保留 `productionStatus` 强调与 Session/Issue 分离（语义说明应由对象边界与文档承担，不应重复编码进字段名）；只在 UI 显示 `status`（导致前后端合同分叉）；兼容 alias（违反 pre-0.1 one-version rule）。

## Decision 8：共享 UI 单一事实源

**Decision**: production 与 prototype 继续直接消费 `packages/ui`；仅将 054 composition 与 production data/routing adapters 接合。
**Rationale**: 现有 `packages/ui` 已含 shell、icons、stacked list、label overflow、dialog/dropdown primitives。
**Alternatives considered**: 复制 prototype DOM/CSS（constitution gate failure）；在 production 保留第二份 components（DRY/视觉漂移）。

## Decision 9：TaskExecutionContext 是内部协调记录，不是用户产品对象

**Decision**: 保留 `Task 1 -- 0..1 TaskExecutionContext` 持久化约束，并在 054 中将旧 `TaskExecutionAttempt` 合同直接重命名为 `TaskExecutionContext`。它在 Start 后、Session 创建前冻结 Agent/Task/Runtime/Provider 输入、承载 assignment idempotency 与 Task 级 execution capability identity，并在 Workspace ready 后幂等关联首个 Autopilot Session。每个后续 Task Session 获得独立短期 execution code，解析同一 TaskExecutionContext；`sessionId` 只记录首个 Autopilot Session。它不进入导航、TaskWorkbenchItem、独立页面或用户创建/编辑表面。
**Rationale**: 当前实现需要一个可早于 Session 存在、并被同一 Task 多个 Session 共享的 durable identity，才能跨事务保持 Workspace preparation、Session launch continuation 与 workload capability 幂等；`Attempt` 会错误暗示每个 Session 或每次运行各有一份记录，`TaskExecutionContext` 才准确描述 Task 级边界。
**Alternatives considered**: 保留 Harness（owner 否决，产品语义不清）；命名 InitHarnessSnapshot（记录会在初始化后继续关联 Workspace/Session 与失败事实，snapshot 语义不实）；保留 TaskExecutionAttempt（与 1:1 Task、跨 Session 共享的实际语义冲突）；直接折叠进 Session（Session 创建前无法承载 Task 级 identity/冻结输入，也无法供后续 Session 共享）。

## Decision 10：Workspace identity 是 `<Task, Runtime>`，launch 内部拥有 setup

**Decision**: `TaskWorkspace` 由 `(taskId, runtimeId)` 唯一标识。Human 发起 Session 时只选择 Provider。首次 launch 用 Provider availability 解析 Runtime，并将其原子写入 nullable `Task.runtimeId`；该 Task Runtime Context 首次写入后不可变。后续 launch 只验证 Provider 在锁定 Runtime available，查找该 Runtime 的精确 Workspace，absent 自动 setup、failed 自动 retry、queued/preparing 幂等续接，ready 后创建 Session。同一 Runtime 上不同 Provider 复用 Workspace。
**Rationale**: Workspace 是 Runtime 上的实际执行工作目录，不应错误归属于 Provider，也不应成为 Human 需要提前创建或理解的产品步骤。Task Runtime Context 防止同一 Task 的多个 Session 静默落在不同主机上，避免尚未定义同步协议时出现分叉工作目录；composite Workspace identity 仍为未来跨 Runtime 同步保留副本表达能力。
**Deferred**: 不同 Runtime Workspace 之间的内容同步、复制、合并、冲突解决和一致性协议，以及解锁、迁移或 failover Task Runtime Context 均不属于 054；不得为未来同步预置双写、后台复制或抽象 Workflow。
**Alternatives considered**: Task 全局唯一 Workspace（无法表达多 Runtime）；`(Task, Provider)` Workspace（owner 更正，Provider 不是物理 Workspace owner）；每 Session Workspace（破坏同一 Task/Runtime 的共享工作目录）；要求 Human 先 Setup Workspace（暴露内部编排并造成当前 UX 故障）。

## GitNexus Evidence

- `AppShell`: LOW，2 total upstream impacts。
- `TasksPage`: LOW，0 indexed upstream impacts。
- `TaskStatusService`: MEDIUM，5 direct / 14 total，2 status API flows。
- `RdbProvider`: CRITICAL，42 direct / 149 total / 44 flows；必须做 narrow seam change 与全 provider contracts。
- 索引已在 `4f8de4a` 上重建：9,691 nodes / 17,002 edges / 300 flows。
