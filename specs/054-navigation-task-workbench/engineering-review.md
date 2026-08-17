---
title: "Engineering Review: 主导航与 Task 工作台"
taco_scope: plan
---

## Verdict

`CLEARED_WITH_GATES`。2026-08-17 owner 将 Session launch 改为 Provider-resolved Runtime 与 automatic Workspace orchestration，明确 Workspace identity 为 `<Task, Runtime>`，并补充 `Task.runtimeId` 首次 launch 原子写入后不可变。新增高风险 gate 已进入 T060–T066；跨 Runtime Workspace sync 与 Task Runtime 解锁/迁移/failover deferred，没有未决产品决策。

## Step 0: Scope Challenge

### What already exists

- `AppShell` 已拥有 sidebar/header collapse、Task resources 与 global actions adapter，复用而非重建。
- `/api/tasks` + `RdbProvider.listTasks()` 已提供 Team scope 基线，但需要 cursor page，而不是第二套 Task service。
- `packages/ui` 已有 `StackedList`、`UiLabelOverflow`、dialog/dropdown/shell/icons；production 只接 adapter，不复制 prototype。
- Task status service、agent CLI、standard prompt 已存在；五态是直接替换，不加 parallel state machine。
- Task detail Session launch API 已存在；054 只恢复 Human UI journey。

### Minimum complete change

一个 Task.metadata contract、一种 page query、一次五态 replacement、一套 shared workbench composition，以及一条由 Session launch 内部拥有的 `<Task, Runtime>` Workspace setup/retry/ready continuation。没有 TaskLabel 子资源、用户可见 Workspace setup、跨 Runtime sync、缓存、snapshot、provider proxy 或 view-preference persistence。

### 2026-08-17 launch correction risks

1. **Runtime lock 与 Workspace cardinality/persistence replacement**，P1：Task 增加 nullable、首次写入后不可变的 `runtimeId`，且 `taskId @unique` 改为 `(taskId, runtimeId) unique`，会影响双 Prisma schema、RdbProvider、production transaction、preparation claim 与 Session attachment。Gate：SQLite/PostgreSQL parity、20-way concurrent first launch 只有一个 Runtime winner、后续写入拒绝、同 pair 20-way race、同 Runtime 不同 Provider 复用；不同 Runtime Workspace 仅做 provider-contract seam 验证。
2. **Long-running launch semantics**，P1：Workspace materialization 不能跨 HTTP/RDB 事务等待。Gate：短事务持久化稳定 launch identity，返回 `202 preparing`，runner ready callback 与 client poll 均幂等续接；不得用同步阻塞伪装自动化。
3. **Task production ownership**，P1：pending Task 的首个 Session launch 必须复用 TaskExecutionContext/status audit，不得并行保留一个需要用户先点 Start 的入口。Gate：route/service E2E 证明一次 Human command 原子进入 `in_progress`，最终一个 Session；后续 Session 不覆盖 TaskExecutionContext 的首个 Session。

### NOT in scope

- 053 Overview metrics/query/empty state：placeholder 后由 053 原位替换。
- Mutable repository/Issue snapshot cache：需要独立 integration-cache spec。
- Kanban drag/write、bulk actions、saved views、swimlanes：第一版只读。
- General table migration：054 只迁移 Tasks consumer。
- Structured handoff reasons：054 只保留 blocked note。
- `/issues` direct route redesign：只移除全局入口，保留 Project Issues。

## Architecture Review

1. **RdbProvider blast radius**，severity P1，confidence 10/10。GitNexus：CRITICAL，42 direct / 149 total / 44 flows。缓解：只增加 Task page/metadata seam；不改通用 transaction/auth/integration signatures；SQLite/PostgreSQL contract suite 和 `detect_changes` 为 gate。
2. **External provider N+1**，severity P1，confidence 10/10。缓解：workbench projection 只用 persisted `repositoryExternalId`/Issue `identifier`，provider calls=0。
3. **Pre-0.1 lifecycle and naming drift**，severity P1，confidence 10/10。`productionStatus` 与 `waiting_for_review` 横跨 shared/RDB/status service/CLI/prompt/API/UI/tests。缓解：单 slice 将 Task 字段收敛为 `status`、将状态收敛为五态并运行 targeted terminology audit；禁止旧字段 alias、双读或双写。
4. **Prototype-to-production duplication**，severity P1，confidence 9/10。缓解：shared primitives stay in `packages/ui`；feature composition + adapters only；static import/DOM/CSS audit。
5. **Query-time Metadata matching portability/performance**，severity P2，confidence 9/10。Owner 明确禁止 normalized shadow columns；缓解：RdbProvider 保持 provider-neutral query contract，SQLite/PostgreSQL adapter 各自在执行时做 case-insensitive comparison，并以 parity contract 与 10k fixture p95 gate 验证。

架构结论：不引入新 service/class 或 child model；只给现有 Task 增加一个 Metadata JSON field 和 page contracts。涉及文件超过 8 个是既有多层 contract replacement 的必然结果，不可通过保留旧状态或复制 UI 安全缩小。

## Code Quality Review

- DRY gate：status labels/icons、date renderer、label overflow、stacked geometry 只有 shared implementation。
- Explicit gate：cursor/filter schemas 与 actor transition table 均为 allowlist；Metadata 只通过 shared JSON-object schema，不接受 Task 外 labels 或 normalized shadow fields。
- Minimal-diff gate：不重命名 `RdbProvider`、不引入 repository wrapper、不创建 `TaskWorkbenchService` 只为转发现有 provider。
- Error handling：invalid cursor/Metadata JSON、stale revision、duplicate submit、provider unavailable、Workspace unavailable 均有 visible recoverable state。

No unresolved code-quality decisions.

## Test Review

```text
CODE PATH COVERAGE PLAN
=======================
shared task schemas
  ├─ status naming / five values / obsolete rejection .. unit + terminology audit
  ├─ metadata default / round-trip / replace ........... unit + RDB contract
  └─ transition actor matrix / required note ........... unit + route contract

Task page query
  ├─ first/next page + cursor fingerprint .............. provider + route contract
  ├─ team scope / cross-team isolation ................. authorization route test
  ├─ search/status/metadata/sort combinations .......... provider contract
  ├─ concurrent insert / stable cursor ................. provider contract
  └─ provider unavailable, zero fan-out ................. route spy + browser journey

UI journeys
  ├─ root placeholder -> future 053 seam ............... component + browser
  ├─ expanded/collapsed/narrow header actions .......... component + browser
  ├─ Table/Kanban same IDs + load more ................. model + browser
  ├─ New Task success/error/double-submit/focus ......... route + browser
  ├─ Task detail/Right Panel ............................ component + browser
  └─ New Session success/precondition/error/focus ....... route + browser

REGRESSION GATES
  └─ 3 current Spec Prototype failures repaired first ... CRITICAL targeted tests
```

目标覆盖：全部新增分支与用户可见失败路径；关键跨 API/RDB/UI journey 使用 browser/integration，不以 mock-only unit test替代。

## Failure Modes

| Codepath | Production failure | Test | Handling | User result |
|---|---|---|---|---|
| page cursor | filter changed with old cursor | route contract | reject 400 | reset filters/page message |
| Metadata replace | non-JSON value | schema/RDB | transaction abort | inline validation |
| list query | provider unavailable | zero-fanout spy | no provider dependency | persisted IDs still visible |
| status replace | stale revision | service/route | conflict | refresh/retry message |
| New Task | double submit | browser/route | idempotency + disabled submit | one Task |
| New Session | Workspace absent/not ready | browser/route/service | automatic setup or accepted poll | Session starting；不暴露 Workspace |
| Metadata label measurement | resize/font change | component/browser | ResizeObserver remeasure | intact labels/+N |

Silent unhandled failures: 0.

## Performance Review

- Page query default 50/max 100，opaque cursor，indexed Team/order/filter fields。
- Metadata 随 Task row 一次读取；无关系表、ordinal、normalized columns 或 per-row query/provider call。
- Metadata query-time lowercase comparison 以 SQLite/PostgreSQL parity 和 10k p95 evidence 约束，不把性能问题转嫁给持久化 shadow fields。
- Kanban 与 Table 共享 accumulated data，不重复 fetch。
- `ResizeObserver`/`MutationObserver` 仅绑定 shared list/label container；测试 observer cleanup。
- 10k fixture p95 < 500ms 为 local contract/perf evidence gate；不引入 cache。

## Parallelization

| Lane | Modules | Depends on |
|---|---|---|
| A | shared schemas + Prisma/RDB | — |
| B | packages/ui shared primitives/tests | approved prototype |
| C | status CLI/prompt/API/docs replacement | shared five-state contract |
| D | Control Plane routes/workbench/AppShell | A + B |
| E | browser verification/docs | C + D |

执行：A 与 B 可并行；A 后 C；A+B 后 D；最后 E。A/C 同触及 shared contracts，必须按顺序，不能用两个 worktree 争抢同一枚举。

## Completion Summary

- Step 0：scope accepted as complete minimal slice。
- Architecture：5 risks，全部有 gates。
- Code quality：0 unresolved issues。
- Tests：完整 diagram，3 个已知 regression 先修，0 silent critical gaps。
- Performance：cursor/batching/index/no-provider-fanout 已冻结。
- Outside voice：未运行；非 gating。
- Parallelization：5 lanes，A+B 可并行，其余依赖顺序明确。
- GitNexus pre-development `detect_changes(compare main)`：LOW，当前 artifact/prototype diff 未命中 execution flow；实现期仍须在 commit 前重新运行。
- Lake score：5/5 风险选择完整修复，不保留 shortcut compatibility。

## Implementation Review — 2026-08-17

### Verdict

`IMPLEMENTED_AND_VERIFIED`。实现没有保留 `productionStatus`、Harness alias、Task 外 labels、TaskLabel 或 normalized shadow fields；没有未决产品决策。

### Architecture and blast radius

- GitNexus index 已用 repo-pinned Node/pnpm toolchain 完成 doctor 与最终 rebuild；index 为 9,848 nodes、17,215 edges、247 clusters、300 flows。
- 实现期 `detect_changes(compare main)` 报告 CRITICAL，原因是本次有意直接替换 `RdbProvider`、`AppShell` 与 Task status 的跨层合同，而不是发现第二套 provider/shell/status path。
- `PrismaRdbProvider` 的直接入口仍只有 initializer 与 contract/e2e fixtures；`AppShell` 仍由 `ControlPlaneGate` 单点拥有；`TaskStatusService` 仍由 factory、Agent execution path 与 tests 消费。
- HIGH/CRITICAL gate 已按规则在实施中向 owner 明示；没有绕过或静默降级。commit 前最终 `detect_changes(compare main)` 为 85 files、214 changed symbols、23 affected flows、CRITICAL。

### Code review findings resolved

- `/api/tasks` 现在让 shared strict Zod schema 看见未知 query keys，因此未知参数返回 400，不再被 route adapter 静默忽略。
- 删除无调用者的旧 `TaskTable`，清除其残留 `/new` link；GitNexus 对该 symbol 的 upstream impact 为 LOW、0 callers、0 processes。
- Next 生成目录中对已删除 `/new` 的陈旧类型缓存已移出工作树并重建；production build route manifest 不再包含该 route。
- Project reference projection 仍采用一次 Team-scoped RDB query 后内存选取当前页 IDs；自定义 Prisma delegate 的允许 where 合同不支持 `id.in`，因此未用逐 ID query 制造数据库 N+1。

### Verification conclusion

- Root typecheck/lint/test/build、terminology audit、schema parity、RDB contracts、10k performance assertion 与 browser journeys 全部通过。
- 646 tests 通过，21 tests 为既有显式 skipped；Control Plane 380 tests 通过。
- 101-row browser fixture、五列 exact counts、load-more、320px overflow、dialog focus return、New Session no-attempt side effect 均有运行时证据。
- Review 结论：0 个未解决 correctness、security、contract 或 UI-fusion finding。

## Automatic Task Runtime Correction Review — 2026-08-17

### Verdict

`IMPLEMENTED_AND_VERIFIED`。Task Runtime Context 由首次 Provider-driven Session launch 原子写入，之后不可变；后续 Session 无 Runtime selector/failover，并复用相同 `<Task, Runtime>` Workspace。跨 Runtime sync、解锁与迁移仍明确 deferred。

### Risk closure

- `mapTask` impact 为 HIGH（9 direct / 19 total），通过 shared strict schema、双 Prisma parity、RDB route/full suites 与浏览器 projection gate 收口；其余 launch/workspace/UI symbols 为 LOW。
- 20-way first Start race 只有一个 Runtime winner；Task row conditional update 包含当前 nullable Runtime，lost race 返回 conflict，不做 last-writer-wins。
- Session HTTP 不跨 Workspace materialization 长事务：`202 preparing` 暴露稳定 `sessionId`，poll/callback 都复用 TaskExecutionContext continuation。`setupFailureCode` 被转为稳定失败，避免无限 preparing。
- UI 完全移除 Workspace-ready precondition。Runtime 只作为 Task property 显示，不成为表单输入；Provider 列表在首启前来自 eligible Runtime，锁定后受 Task Runtime 约束。

## Runtime-authoritative workload contract correction — 2026-08-17

`CLEARED`。Mystra self-hosting Task 暴露了 Workspace checkout 与 deployed Runtime 的版本偏差：Agent 主动构建 Workspace 中的旧 CLI，并用旧 `waiting_for_review` 合同解释 live CLI。修复为 Runner 注入绝对 `MYSTRA_AGENT_PATH`，所有 prompt 明确 live CLI/API 覆盖 Workspace source/docs/generated CLI。GitNexus 对 `assembleSystemPrompt` 的 upstream impact 为 LOW（2 direct / 5 total，Sessions-only）；最终 detect_changes 为 LOW、0 affected processes。完整 typecheck/lint/test/build 通过。

### Verification conclusion

- Root typecheck/lint/test/build、双 schema validate、术语审计、RDB concurrency/parity、Session E2E 与 route/component tests 全绿。
- Browser 观察到首次与后续 Session 均导航成功，Task/两条 Session 只有一个 Runtime，且 Right Panel 显示锁定值；无 framework error overlay。
- Commit 前 `detect_changes(compare main)`：120 files、377 changed symbols、25 affected flows、CRITICAL。风险来自 054 既定的 RdbProvider/AppShell/Task status 跨层直接替换；新增 Runtime correction 的 `mapTask` 为 HIGH，其余 launch/workspace/UI symbols 为 LOW，全部 direct consumers 已由完整 suite 与 browser gate覆盖。
- 最终本地 SQLite 已按 owner 授权清空重建。0 个未解决 correctness、contract 或 UI-fusion finding。
