# Research：产品概览

## Decision 1：Overview 只保留两个区域

**Decision**: 一组五状态卡 + 一个 attention Task 列表。删除 Runtime readiness、Current production、Projects 和 prototype 状态切换器。

**Rationale**: 五态数字已回答整体分布；attention 列表回答需要行动的对象。其他列表都有既有专页，在 Overview 重复只会增加互相竞争的扫描路径。

## Decision 2：时间范围只影响数字

**Decision**: 7d/30d/all 只作用于顶部 counts；attention 始终是当前 Team 全部需要关注 Task。

**Rationale**: Owner 的限定语是“这个数字”，随后要求“所有需要关注的任务”。把 attention 也按 Task 创建时间过滤会隐藏仍需接手的旧 Task。

**Semantics**: 以 Task `createdAt` 选择 cohort，以 Task 当前 `productionStatus` 统计。不是状态变更事件计数，也不是趋势。

## Decision 3：目标五态是 canonical contract，不是 UI alias

**Decision**: 目标 codes 为 `pending/in_progress/blocked/done/canceled`；`blocked` 的产品文案为“待接手”。054 直接删除 `waiting_for_review`，053 不通过 UI alias 模拟合同替换。

**Rationale**: Task 只需要表达生产执行权当前归属；review、授权、等待回答或等待信息都是 handoff 原因，不值得各占一个顶层状态。Session failed 与 Task 状态继续独立。若 UI 私自映射：

- `failed` 会错误地把一次执行事实固化成 Task 生命周期；
- `waiting_for_review` 与 `blocked` 都要求 Human 接手，顶层并列只会重复表达 ownership；
- Session failure 会让一个 Task 同时被错误地重分类。

因此 implementation 等待 lifecycle owner 直接替换 canonical contract。pre-0.1 不保留 alias。

## Decision 4：Session attention 与 Task status 正交

**Decision**: `interrupted|waiting_for_handoff|failed` Session 使非 done/canceled Task 进入 attention；Task 卡片仍按自身当前状态计数。

**Rationale**: 一个 Task 可有多个 Session；局部 Session 中断不代表整个 Task 中断。Task 与 Session 独立是既有 049/051 合同，不应被 Overview 为了方便而破坏。

## Decision 5：服务端 Task 去重 read model

**Decision**: 新建 typed `GET /api/overview`，在数据库/服务层完成 status counts、Session current-state aggregation 和 Task deduplication。

**Alternatives rejected**:

- 浏览器 `GET /api/tasks` 后逐 Task 请求 sessions：N+1，无法扩展。
- 浏览器读取全部 Session 再 group：传输无界，泄露不需要的执行细节。
- SessionEvent 全局查询：违反 Session-scoped history 边界。
- 持久化 Overview snapshot：当前事实可查询，无需第二事实源。

## Decision 6：一个 endpoint 返回一致 snapshot

**Decision**: `GET /api/overview?window=...&attentionCursor=...` 返回统一 observedAt、counts 和 attention page。

**Rationale**: 页面只有一个 coherent surface；单 endpoint 简化 Team authorization、unknown-status fail-closed 与 observed time。attention pagination 的后续请求可重复 counts，代价小于两个 endpoint 的状态协调。

## Current-contract Evidence

- `packages/shared/src/task.ts` 当前状态是 pending/in_progress/blocked/waiting_for_review/done/canceled；054 计划直接删除 `waiting_for_review`。
- 051 requirements 已明确 Task 没有 failed；054 延续该边界。
- `packages/shared/src/session.ts` 包含 interrupted/waiting_for_handoff/failed。
- `RdbProvider.listSessions` 可按 Task 查询，但 Overview 使用它会形成 N+1。
- Prisma Session 已有 `taskId/state/updatedAt`，足以做 current-state attention 聚合，不需要 SessionEvent。
