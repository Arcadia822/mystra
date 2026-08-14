# Implementation Plan: 产品概览

**Branch**: `main`（并行 spec 以 feature directory 隔离） | **Date**: 2026-08-13 | **Spec**: [spec.md](spec.md)  
**Input**: Feature specification from `/specs/053-product-overview/spec.md`

## Summary

053 收敛为一个可装配到 054 shell 的 Overview surface：顶部是一组五状态 Task 计数卡，默认按最近 7 天 `Task.createdAt` 选择 cohort，可切换 30 天/全部；下方是 Team 范围、Task 去重的全部 attention 列表。Runtime、当前生产和 Projects 列表全部删除。

新增一个 Team-authorized Overview read contract，在服务端完成 Task 当前状态计数和 Session attention 聚合，避免浏览器对每个 Task 发起 Session 请求。Task 与 Session 状态严格独立：Session attention 只使 Task 出现在列表，不自动改变 Task 卡片归类。

## Technical Context

**Language/Version**: TypeScript 5.9, Node.js 24.14.0  
**Primary Dependencies**: Next.js 16, React 19, Zod 4, Vitest 4, Prisma 7.9.1  
**Storage**: 不新增实体或 snapshot；允许为 Team/status/createdAt 与 Team/session-state/task 查询增加 SQLite/PostgreSQL 对等索引  
**Testing**: shared schema、RdbProvider contract、route、pure presentation、component tests，`pnpm typecheck`，浏览器验收  
**Target Platform**: 已认证 Mystra Web control plane，320px–1440px  
**Performance Goals**: 10,000 Task / 100,000 Session 下首个 Overview snapshot p95 < 500ms；默认 attention page 50 行；页面 DOM 不随全部 Session 数增长  
**Constraints**: 当前 canonical Task 状态合同仍多出 `waiting_for_review`，必须先由 054 lifecycle owner 直接删除并并入 `blocked`；不做 UI alias、不从 Session 推断 Task 状态、不读取 SessionEvent  
**Scale/Scope**: 一组五态计数、三个时间范围、一个可分页 attention 列表、一个只读 API；根入口/nav/modal 仍属 054

## Constitution Check

*GATE: 当前设计通过；implementation gate 被 canonical Task 状态替换阻塞。*

- **Spec-first**: 通过。所有变更留在 `specs/053-product-overview/`，规划在 `main`。
- **Task/Session separation**: 通过。Session state 不自动修改 Task `productionStatus`。
- **Typed boundary**: 通过。新 read endpoint 使用 shared Zod request/response schema 与稳定 error shape。
- **Team authorization**: 通过。Team 从认证 subject 服务端解析，caller 不传 `teamId`。
- **RdbProvider boundary**: 通过。read query 不泄漏 Prisma、SQL、URL 或 pool handle；SQLite/PostgreSQL contract 对等。
- **Pre-0.1 replacement**: 通过。目标 Task 五态直接删除旧 `waiting_for_review` 并保留 `blocked` 作为 handoff 状态，不保留 alias 或 dual mapping。
- **No global event feed**: 通过。只读取 Session 当前 state，不读取/搜索 SessionEvent。
- **Parallel spec ownership**: 通过。053 拥有 Overview；054 拥有 root/nav/New Task modal。

## Blocking Upstream Contract

当前 shared schema：

```text
pending → in_progress → blocked / waiting_for_review → done / canceled
```

目标 Task current-state vocabulary：

```text
pending → in_progress → blocked → done
blocked ──────────────→ in_progress
any nonterminal ──────→ canceled
```

这张图只表达 Overview 需要消费的状态集合与自然顺序；完整 transition allowlist 由 054 冻结。`waiting_for_review` 的 review handoff 语义并入 `blocked`，其余细分原因延后。053 不得自行实现这些写路径或恢复第六态。

## Design Direction

```text
Overview                                           [7 天] [30 天] [全部]

┌────────┬────────┬────────┬────────┬────────┐
│ 未执行 │ 执行中 │ 待接手 │ 已完成 │ 已取消 │
│   12   │    7   │    3   │   31   │    4   │
└────────┴────────┴────────┴────────┴────────┘

需要关注  8
  ◌ Task name              [Project] [attention metadata]  time
  ◌ Task name              [Project] [attention metadata]  time
```

- 五卡是一个连续组；桌面同一行，窄屏组内横向滚动。
- 每卡只有 label + number。没有 code、副标题、百分比或趋势。
- 7d/30d/all 只影响数字，不影响 attention 列表。
- attention 直接复用 054 Mystra Table 的 stacked mode 和默认 Task row anatomy；一 Task 一行，行内汇总 Session 原因，不展开 Session。
- 页面不显示 `Task 状态`、筛选规则、observed time、刷新按钮或 attention scope 等解释性文案；数据语义保留在 API 与规格中。
- 主内容采用 054 Task workbench 的 full-width spacing：Section header 与状态组使用 content inset，section 间距只使用 `--layout-gap`，不叠加 page inset 或额外 24px section gap。
- 状态统计与 attention 列表使用同一 `OverviewSection` primitive；Section 内部只使用 `--tight-gap`，shell header/content 与 Section header/body 均不画分割线。
- 删除原 prototype 的四态演示切换、Runtime、Current production、Projects。

## Data Flow

```text
054 AppShell
  └─ 053 OverviewPage
       └─ GET /api/overview?window=7d&attentionLimit=50&attentionCursor=...
            ├─ resolve authenticated active Team
            └─ OverviewReadService.readSnapshot(...)
                 ├─ observedAt = server clock once
                 ├─ count Task by current productionStatus
                 │    └─ filter Task.createdAt by 7d / 30d / none
                 └─ list current attention Tasks (window-independent)
                      ├─ Task status blocked
                      ├─ OR Session state interrupted / waiting_for_handoff / failed
                      ├─ suppress done / canceled Task session history
                      ├─ GROUP BY Task
                      └─ paginate latestAttentionAt DESC, taskId DESC
```

同一请求内 `observedAt` 只生成一次，计数与 attention page 使用同一 Team scope。切换时间范围会更新 counts；客户端保留已经成功读取的 attention page，除非显式刷新、Team 变化或 attention cursor 变化。

## API Contract

完整 schema 见 [contracts/overview-api.md](contracts/overview-api.md)。首版使用：

```http
GET /api/overview?window=7d&attentionLimit=50&attentionCursor=<opaque>
```

```ts
type OverviewSnapshot = {
  observedAt: string;
  window: "7d" | "30d" | "all";
  taskStatusCounts: {
    pending: number;
    inProgress: number;
    blocked: number;
    done: number;
    canceled: number;
  };
  attention: {
    items: AttentionTaskRow[];
    nextCursor: string | null;
  };
};
```

请求不接受 `teamId`、任意时间戳或任意状态数组。窗口使用 enum，避免浏览器控制统计语义。cursor 对 Team/sort tuple 绑定并验证，非法值返回稳定 `overview_cursor_invalid`。

## Project Structure

### Documentation

```text
specs/053-product-overview/
├── 053-product-overview.taco.html
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── prototype.md
├── mockups/index.html
├── contracts/overview-api.md
└── checklists/requirements.md
```

### Planned source surface

```text
packages/shared/src/
└── overview.ts                              # query/response Zod schemas

apps/control-plane/
├── app/api/overview/route.ts                # thin authenticated adapter
├── app/_components/
│   ├── overview-page.tsx
│   ├── overview-page.test.tsx
│   └── shell-copy.ts
├── src/lib/overview/
│   ├── overview-read-service.ts             # window + attention policy
│   └── overview-read-service.test.ts
├── src/lib/db/
│   ├── rdb-provider.ts                      # dialect-neutral read methods
│   ├── rdb-provider.contract.ts
│   └── prisma-provider.ts                   # grouped queries
└── prisma/{sqlite,postgresql}/schema.prisma  # only justified indexes
```

## Implementation Slices

### Slice 0 — Canonical Task lifecycle dependency

- 等待 054 lifecycle owner 落地 `pending/in_progress/blocked/done/canceled` 并删除 `waiting_for_review`。
- 更新所有 shared schema、transition callers、fixtures 和 docs；不由 053 偷做。
- 053 tasks/implementation 不得在该依赖未完成时生成 alias。

### Slice 1 — Shared Overview contract

- 定义 `overviewWindowSchema`、counts、attention row/page 和 response schema。
- cursor opaque；request limit 有默认/最大值；response 严格校验五态 key。
- 记录稳定 errors：invalid request/cursor、unsupported Task status、read unavailable。

### Slice 2 — Dialect-neutral read query

- `RdbProvider` 增加 Task status counts 和 deduplicated attention page read methods，返回领域中立 row。
- SQLite/PostgreSQL contract harness 验证相同 cohort boundary、状态计数、Task 去重和 pagination。
- 只有 query plan 证明需要时增加对等 composite indexes；不新增表或 snapshot。

### Slice 3 — Overview service/route

- 服务端一次生成 `observedAt` 和窗口下界。
- counts 基于 Task `createdAt` + 当前 Task status；attention 不接受 window。
- route 从 active Team subject 解析 scope，Zod 验证 query/response，设置 `cache-control: no-store`。

### Slice 4 — 单组看板与 attention UI

- 五卡固定顺序，label + number；range segmented control 默认 7d。
- attention consumer 复用 054 基础 Table stacked mode；状态使用同一 status icon，Name 使用 grow column，Project/attention metadata/latest time 使用 right columns。
- 空态只表达“暂无需要关注的 Task”；read error 不显示成零。
- Task row 链接 `/tasks/{taskId}`，不加 Session deep-link。

### Slice 5 — 054 装配与浏览器验收

- 054 root mount 一份 053 Overview，不复制 read model。
- Team switch 使旧请求失效；range change 只更新 counts，attention 事实保持。
- 验证 1440/1024/390/320px、横向五卡组、分页和 stale response。

## Test Strategy

```text
Contract
  ├─ window enum / limit / cursor validation
  ├─ exact six-key response
  └─ no caller-supplied teamId or arbitrary status filters

RdbProvider parity
  ├─ createdAt lower boundary inclusive
  ├─ current Task status counted exactly once
  ├─ multiple attention Sessions collapse to one Task row
  ├─ active Session + interrupted Session keeps Task in_progress
  ├─ done/canceled suppress old Session attention
  └─ stable cursor has no duplicate/missing Task

Route/service
  ├─ active Team authorization
  ├─ one observedAt per response
  ├─ window changes counts, not attention scope
  ├─ unknown Task status fails closed
  └─ stale Team response discarded

UI/browser
  ├─ one group, six cards, fixed order, no subtitle
  ├─ default 7d; 30d/all update numbers
  ├─ one Task row with aggregated Session reasons
  ├─ row navigates only to Task detail
  └─ no Runtime / production / Projects sections
```

### Production Failure Modes

| Code path | Failure | Test | Handling | User-visible result |
| --- | --- | --- | --- | --- |
| window cutoff | client/server clocks differ | fixed server-clock test | server owns observedAt/cutoff | consistent cohort |
| status count | obsolete/unknown Task status remains | contract fixture | fail closed with stable error | statistics unavailable, not zero |
| attention join | 100 Session rows duplicate one Task | RDB parity test | group by Task + aggregate counts | one Task row |
| mixed Sessions | one interrupted, one running | service test | Task status unchanged | production count + attention row |
| terminal Task | canceled Task has old failed Session | query test | terminal suppression | no stale attention |
| cursor | Team switch reuses old cursor | route test | Team-bound signed/opaque cursor rejected | first page reload |
| large Team | attention query scans all Sessions | query-plan/perf test | composite index or stop gate | bounded response |
| network | range request fails after old success | component test | keep previous numbers marked stale + retry | no false zero |

无“无测试 + 无 handling + 静默”的 critical gap。

## Performance Plan

- counts 在数据库按 Team、createdAt、productionStatus 聚合，不把所有 Task 传给浏览器。
- attention 在数据库按 Task 聚合 Session current state，分页只返回 Task rows 和小型 counts；不返回 Session 列表或事件。
- 目标 fixture：10,000 Task / 100,000 Session，首 snapshot p95 < 500ms，page 50；若无法达到，先检查 composite indexes 与 query plan，不引入缓存表。
- 建议索引候选：Task `(teamId, createdAt, productionStatus, id)`；Session `(teamId, state, taskId, updatedAt, id)`。实施前用 SQLite/PostgreSQL explain/contract evidence 决定，不能只凭审美添加。

## What Already Exists

- `Task.createdAt`、`productionStatus` 已持久化；但当前 status enum 与目标不一致。
- `Session.taskId/state/updatedAt` 已持久化，且 Task 可关联多个 Session。
- `RdbProvider.listSessions({teamId, taskId})` 支持单 Task Session 读取，但不适合 Overview N+1。
- 050 已确立 Session 列表直接使用 canonical Session；053 只聚合 current states，不新建 Session summary 对象。
- 051 测试已证明 Task 与 latest Session 状态独立；053 延续该不变量。
- 054 已声明 mount 053 Overview，并拥有导航与 New Task modal。

## NOT in Scope

- Task 五态 transition/actor/write API 的设计与实现。
- Session resume/claim/handoff 操作和 Task 详情页内定位。
- Runtime、当前生产、Projects Overview 列表。
- 状态历史、趋势、图表、卡片点击筛选。
- SessionEvent、日志、跨 Team activity feed。
- 持久化 Overview snapshot、缓存表或后台统计 job。

## Worktree Parallelization Strategy

当前仍只规划，并留在 `main`。未来实现必须先完成 canonical Task lifecycle dependency；随后 shared contract + RDB query 可作为 Lane A，Overview UI 静态结构可作为 Lane B 并行；route/service 等待 Lane A，054 集成等待 API 与 UI。两个 lane 最终都会触碰 control-plane tests，合并前需顺序跑 contract suite。

## Engineering Review Delta

- **Scope**: 明显缩小视觉表面，删除 3 个列表和独立退化故事；数据合同因 Session attention 从 client projection 升级为 server read model。
- **Architecture issue resolved**: 禁止 per-Task Session N+1；Task 去重在服务端完成。
- **Blocking issue exposed**: 目标五态与当前 051 contract 的 `waiting_for_review` 冲突。053 不实现假映射，implementation 明确等待 054 lifecycle owner。
- **Data semantics locked**: range 只影响 counts；attention 始终全 Team；Session attention 不改变 Task status。
- **Review result**: SPEC/PLAN READY FOR OWNER REVIEW；IMPLEMENTATION BLOCKED BY TASK LIFECYCLE CONTRACT。
