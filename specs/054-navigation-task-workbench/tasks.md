---
title: "Tasks: 主导航与 Task 工作台"
taco_scope: tasks
---

**Input**: [spec.md](spec.md)、[plan.md](plan.md)、[research.md](research.md)、[data-model.md](data-model.md)、[contracts/task-workbench-api.md](contracts/task-workbench-api.md)

## Phase 1: Regression Baseline And Shared Contracts

- [x] T001 修正并先验证 3 个已知 054 prototype regression tests，更新 `apps/spec-prototype/app/prototype-styles.test.ts` 与 `apps/spec-prototype/app/_components/task-detail-prototype.test.ts`
- [x] T002 在 `packages/shared/src/task.test.ts` 先写 `Task.status`、五态、blocked note、obsolete `productionStatus`/`waiting_for_review` rejection 的失败测试
- [x] T003 [P] 在 `packages/shared/src/task.test.ts` 先写 Task.metadata JSON object、默认 `{}`、create/update replace、response nesting 与拒绝 Task 外 `labels` 的失败测试
- [x] T004 在 `packages/shared/src/task.ts` 将 `taskProductionStatusSchema`/`TaskProductionStatus`/`productionStatus` 直接替换为 `taskStatusSchema`/`TaskStatus`/`status`，实现五态 transition matrix 与 strict Task.metadata/Task page schemas，不保留 alias，也不增加 TaskLabel 或 normalized fields
- [x] T005 在 `packages/shared/src/management.ts` 导出 paged workbench request/response contracts，并更新对应 tests
- [x] T006 运行 `pnpm --filter @mystra/shared test`，并把结果记录到 `specs/054-navigation-task-workbench/quickstart.md`

## Phase 2: Persistence Foundation

- [x] T007 对计划修改的 Prisma provider methods 分别运行 GitNexus `impact`，把 direct callers 与 HIGH/CRITICAL gate 记录到 `specs/054-navigation-task-workbench/engineering-review.md`
- [x] T008 [P] 在 `apps/control-plane/prisma/sqlite/schema.prisma` 将 Task `productionStatus @map("production_status")` 直接替换为 `status` field/column，并增加单一 Metadata JSON payload field 与 Task page indexes；不增加兼容 column、relation、ordinal 或 normalized columns
- [x] T009 [P] 在 `apps/control-plane/prisma/postgresql/schema.prisma` 实现完全对等的 Task `status`、Metadata field 与 Task page indexes
- [x] T010 在 `apps/control-plane/src/lib/db/prisma-schema-parity.test.ts` 先写双 schema `status`/Metadata parity 与旧 `production_status` column 缺失的失败测试
- [x] T011 在 `apps/control-plane/src/lib/db/rdb-provider.contract.ts` 先写 Task.status five-state/no-productionStatus、Task.metadata default/round-trip/full-replace、query-time case-insensitive match 与 paged query/cursor/filter/sort/team-isolation contract tests
- [x] T012 在 `apps/control-plane/src/lib/db/rdb-provider.ts` 将 Task status contract 收敛为 `status`，并仅扩展 Task object 的 Metadata persistence 与 Task page query domain seam，不改变通用 provider signatures
- [x] T013 在 `apps/control-plane/src/lib/db/prisma-client.ts`、`prisma-mappers.ts`、`prisma-provider.ts` 实现 `status` mapping、Metadata JSON serialize/parse、create/update mapping 与 query-time case-insensitive search；不保留 productionStatus mapping，不创建 normalized storage
- [x] T014 生成 SQLite/PostgreSQL pre-0.1 schema history并更新 `apps/control-plane/src/lib/db/prisma-schema-parity.test.ts`
- [x] T015 运行 `apps/control-plane/src/lib/db/rdb-provider.contract.ts` 与 `apps/control-plane/src/lib/db/prisma-schema-parity.test.ts`，确认 provider fan-out 为 0

## Phase 3: User Story 1 - Overview And Global Actions (P1)

**Independent Test**: 053 缺失时根入口显示无数据 placeholder；expanded/collapsed/320px 下 New Task/Search 各有一个可聚焦实例。

- [x] T016 [P] [US1] 在 `apps/control-plane/app/page.test.tsx` 先写 Overview placeholder 与非 New Task landing failure tests
- [x] T017 [P] [US1] 在 `apps/control-plane/app/_components/app-shell-navigation.test.ts` 写 Overview/Inbox/Tasks/Runtimes 与无 global Issues/New/Search nav contract
- [x] T018 [US1] 在 `apps/control-plane/app/page.tsx` 实现 053-owned replacement seam 的 Overview placeholder
- [x] T019 [US1] 在 `apps/control-plane/app/_components/app-shell.tsx` 接入 shared global New Task/Search actions 与 collapsed/narrow ownership
- [x] T020 [US1] 删除 `apps/control-plane/app/new/` 的直接页面合同并增加 `/new` no-redirect route test
- [x] T021 [US1] 按 `specs/054-navigation-task-workbench/quickstart.md` 浏览器验证 root/expanded/collapsed/320px 的 route、focus、dialog exclusivity 与 duplicate accessible instances=0

## Phase 4: User Story 2 - Team Tasks Workbench (P1)

**Independent Test**: 同一 filter 下 Table/Kanban Task IDs 完全一致，cursor load-more 稳定，external provider 不可用时 persisted IDs 仍可见。

- [x] T022 [P] [US2] 在 `apps/control-plane/app/api/tasks/route.test.ts` 先写 page query、Task.status/no productionStatus、Task 内 metadata response、query-time case-insensitive Metadata match、invalid cursor、Team authorization、provider-zero-fanout route tests
- [x] T023 [P] [US2] 在 `apps/control-plane/app/_components/task-workbench-model.test.ts` 先写 shared query state、layout identity、five-column grouping 与 empty/error states
- [x] T024 [P] [US2] 在 `packages/ui/src/task-list-model.test.ts` 补 equalWidth edge validation、observer remeasure/cleanup 与 label overflow boundary tests
- [x] T025 [US2] 在 `apps/control-plane/app/api/tasks/route.ts` 接入 strict cursor page contracts 与 active Team scope
- [x] T026 [US2] 将批准的 composition 从 `apps/spec-prototype/app/_components/navigation-task-workbench.tsx` 迁移为 production `apps/control-plane/app/_components/task-workbench.tsx`，只接 production adapters
- [x] T027 [US2] 在 `apps/control-plane/app/tasks/page.tsx` 接入 paged query、search/filter/sort/layout state 与 async append
- [x] T028 [US2] 在 production workbench 只用 Task 内 `metadata`、Project `repositoryExternalId` 与 Issue `identifier`，删除 Task 外 labels、TaskExecutionContext projection 和 project-name/provider snapshot join；Metadata presentation order 只由前端处理
- [x] T029 [US2] 按 `specs/054-navigation-task-workbench/quickstart.md` 浏览器验证 0/1/50/101/10k Tasks、五态 columns、Table/Kanban ID parity、load-more anchor 与 p95 < 500ms evidence

## Phase 5: User Story 3 - New Task Modal (P1)

**Independent Test**: 任意页面打开 modal；success/validation/API error/double-submit/focus return 均单一可恢复。

- [x] T030 [P] [US3] 在 `apps/control-plane/app/_components/new-task-dialog.test.tsx` 先写原 shared composer composition、validation/focus tests（尺寸合同已由 T079–T081 替换）
- [x] T031 [P] [US3] 在 `apps/control-plane/app/api/tasks/route.test.ts` 写 create idempotency、metadata 默认 `{}`/显式 input 与 response nesting contract tests
- [x] T032 [US3] 将 prototype TaskComposer 接入 production `apps/control-plane/app/_components/new-task-dialog.tsx`，Project option 只显示 persisted external ID
- [x] T033 [US3] 在 `apps/control-plane/app/_components/app-shell.tsx` 连接 create success refresh/navigation 与 error/double-submit state
- [x] T034 [US3] 按 `specs/054-navigation-task-workbench/quickstart.md` 浏览器验证 Overview/Tasks/detail 打开、Escape/backdrop/Close、field/API error 与单次创建

## Phase 6: User Story 4 - Active Tasks And Project Issue Intake (P2)

**Independent Test**: sidebar 只显示 pending/in_progress/blocked，按 Project/No project 分组；Project Issues 入口和 issue-to-task 仍工作。

- [x] T035 [P] [US4] 在 `apps/control-plane/app/_components/shell-model.test.ts` 先写 five-state active projection 与 external-ID grouping tests
- [x] T036 [P] [US4] 在 `apps/control-plane/app/api/project-issues.test.ts` 保留 Project Issue browse/create/open regression tests
- [x] T037 [US4] 更新 `apps/control-plane/app/_components/app-shell.tsx` 与 shell model 只消费三种非终态，删除 global Issues nav
- [x] T038 [US4] 按 `specs/054-navigation-task-workbench/quickstart.md` 浏览器验证 Project Issues intake、No project group、终态排除与长列表独立滚动

## Phase 7: User Story 5 - Task Detail Workbench (P1)

**Independent Test**: Table/Kanban/Active 三入口进入同一 `/tasks/:id`；Main 只有 Sessions，Right Panel external IDs/Task Metadata/status history 正确。

- [x] T039 [P] [US5] 在 `apps/control-plane/app/_components/task-detail-main-model.test.ts` 写 canonical Session-only mapping、Task.metadata 直接投影，以及禁止 TaskExecutionContext UI/snapshot/derived-current fields tests
- [x] T040 [P] [US5] 在 `apps/control-plane/app/_lib/task-view.test.ts` 写 repositoryExternalId/Issue identifier projection 与 provider-unavailable tests
- [x] T041 [US5] 在 `apps/control-plane/app/tasks/[id]/page.tsx` 接入 shared breadcrumb/Right Panel/Sessions composition，不复制 shell anatomy，也不暴露 internal TaskExecutionContext record
- [x] T042 [US5] 在 `apps/control-plane/app/_components/task-detail-panel.tsx` 只显示 persisted external identifiers、Task.metadata 与 status history；Metadata 顺序由前端 renderer 决定
- [x] T043 [US5] 按 `specs/054-navigation-task-workbench/quickstart.md` 浏览器验证 1440/1024/768/320px、panel collapse/reopen、full Session UUID 与 page overflow=0

## Phase 8: User Story 6 - Manual New Session (P1)

**Independent Test**: ready+provider success/precondition/error/close；只提交 providerKey/manualContext，Task/TaskExecutionContext 无副作用。

- [x] T044 [P] [US6] 在 `apps/control-plane/app/_components/create-session-dialog.test.tsx` 先写 exact fields/copy/focus/precondition/error tests
- [x] T045 [P] [US6] 在 `apps/control-plane/app/api/task-session-routes.test.ts` 写 runtime server-resolution、agent null、Task/TaskExecutionContext no-write regressions
- [x] T046 [US6] 在 `apps/control-plane/app/_components/create-session-dialog.tsx` 接入 existing Task Session launch API 与 returned Session navigation
- [x] T047 [US6] 在 `apps/control-plane/app/tasks/[id]/page.tsx` 的 Main Header 接入唯一 New Session action 与 Right Panel recovery ordering
- [x] T048 [US6] 按 `specs/054-navigation-task-workbench/quickstart.md` 浏览器验证 success/workspace-not-ready/no-provider/API-error/Escape/backdrop/Close journeys

## Phase 9: Five-State Cross-Cutting Replacement

- [x] T049 在 `apps/control-plane/src/lib/tasks/task-status-service.test.ts` 先写 `status` result/view、完整 actor matrix、stale revision、blocked note 与 `productionStatus` rejection tests
- [x] T050 更新 `apps/control-plane/src/lib/tasks/task-status-service.ts`、status routes 与 production panels，统一读写 `Task.status`，直接删除 `productionStatus` 与 `waiting_for_review`
- [x] T051 [P] 更新 `packages/agent-cli` schemas/commands/tests，将所有 Task JSON 输出收敛为 `status`，并将 agent review handoff 改为 `blocked` + note
- [x] T052 [P] 更新 `apps/control-plane/src/lib/sessions/standard-execution-prompt.ts` 与 prompt tests，删除旧状态指令
- [x] T053 [P] 将 `packages/shared/src/harness.ts` 直接替换为 `task-execution-context.ts`，更新 `packages/shared/src/result.ts` 及 tests 中所有 Task-level `productionStatus`/旧状态消费，不误改 Session `state` vocabulary，也不保留 Harness alias
- [x] T054 更新 current specs/docs/fixtures 的 Task `status` five-state terminology，运行 `pnpm audit:task-session-terminology`，并以 targeted search 证明 current code 中 Task `productionStatus`/`production_status`/`TaskProductionStatus`/`taskProductionStatusSchema` 为 0

## Phase 10: Final Verification And Review Handoff

- [x] T055 运行 `pnpm typecheck && pnpm lint && pnpm test && pnpm build` 并把结果记录到 `specs/054-navigation-task-workbench/quickstart.md`
- [x] T056 运行 GitNexus `detect_changes({repo:"mystra", scope:"compare", base_ref:"main"})`，把 RdbProvider/AppShell/status flow 结果记录到 `specs/054-navigation-task-workbench/engineering-review.md`
- [x] T057 执行 `specs/054-navigation-task-workbench/quickstart.md` 全部 browser journeys并在该文件记录 HTTP/content/screenshot evidence
- [x] T058 运行 Spec-Kit status/doctor 与 targeted consistency searches，并把结果记录到 `specs/054-navigation-task-workbench/checklists/requirements.md`
- [x] T059 刷新 `specs/054-navigation-task-workbench/054-navigation-task-workbench.taco.html`，保留 review threads并交 owner review

## Phase 11: Automatic `<Task, Runtime>` Workspace launch correction

- [x] T060 [US6] 更新 shared Task/Workspace/launch schemas 与 SQLite/PostgreSQL schema：Task 增加 nullable `runtimeId`，public create/PATCH 不可写；`TaskWorkspace` 以 `(taskId, runtimeId)` 唯一并保留 provider-neutral Runtime attachment
- [x] T061 [US6] 更新 RdbProvider、Prisma mapper/provider 与 provider contract tests，覆盖首次 `Task.runtimeId` conditional write、20-way 并发唯一赢家、首次写入后不可变、相同 Task/Runtime pair 并发去重与 dialect parity
- [x] T062 [US6] 将 `POST /api/tasks/:id/sessions` 收敛为 Provider-driven orchestration：首次自动解析并锁定 Runtime，后续只验证 Provider 在锁定 Runtime available；自动查找/setup/retry Workspace、以 202 表达 preparing、ready 后幂等创建 Session
- [x] T063 [US6] 将 pending Task 的首个 Session launch 与 `pending -> in_progress`/TaskExecutionContext 原子链路整合；移除 Human 必须先 Start 或 Setup Workspace 的前置操作
- [x] T064 [US6] 更新 Task detail/Create Session UI 与 prototype：不读取 Workspace 作为可用性 gate，不显示 not-ready/setup/retry，accepted 时显示 Session starting 并自动轮询/导航
- [x] T065 [US6] 添加 shared/service/route/component/browser regression tests，覆盖 absent、queued/preparing、ready、failed retry、provider unavailable、idempotent replay、并发首次 Runtime lock、后续 Session 不切换 Runtime、同 Runtime两 Provider 一个 Workspace；用内部 provider contract fixture 验证不同 Runtime Workspace composite identity，不把它作为 Session failover
- [x] T066 运行双 schema generate/validate、focused/full tests、typecheck/lint/build、GitNexus detect_changes、browser journey、Spec-Kit status/doctor，并刷新 Taco

## Phase 12: Independent Session execution-context correction (superseded)

- [x] T067 [US6] 复现后续独立 Session 因未绑定首个 `TaskExecutionContext` 而缺少 execution code、却被 Standard Execution Prompt 强制调用 `mystra-agent context get` 的合同冲突
- [x] T068 [US6] 曾按首个 Session capability 与后续 embedded context 区分 bootstrap；该方案已被 owner 的 Task 级 capability 决策替换
- [x] T069 [US6] 保留真实故障与 focused regression 证据，作为 Phase 13 的 RED 基线

## Phase 13: Task-scoped execution context capability

- [x] T070 [US6] 将 `TaskExecutionAttempt` 及 persistence/API/domain symbols 直接替换为 `TaskExecutionContext`，不保留 pre-0.1 alias 或迁移兼容层
- [x] T071 [US6] 将 dispatch capability lookup 改为 `Session.taskId -> TaskExecutionContext`；每个 Task Session 签发独立短期 code，scope fence 固定 Team/Task/Project/Runtime/Workspace
- [x] T072 [US6] 保持 `TaskExecutionContext.sessionId` 仅关联首个 Autopilot Session；后续 Session 可选择不同 Provider/Agent，但不得切换 Task Runtime 或覆盖该字段
- [x] T073 [US6] 更新 Standard Execution Prompt、Agent CLI identity、Task status actor、production projection、Prisma 双 schema 与回归合同
- [x] T074 运行完整 tests/typecheck/lint/build、双 Prisma validate、术语审计、GitNexus detect_changes、重置本地 pre-0.1 数据并刷新 Taco

## Phase 14: Runtime-authoritative workload contract

- [x] T075 复现 Mystra self-hosting Workspace 中旧 `waiting_for_review` 合同诱导 Agent 构建并调用 Workspace CLI，而 live Runtime CLI 仅接受 `blocked|in_progress` 的版本偏差
- [x] T076 为 Runner dispatch 增加 Runtime CLI 绝对路径 `MYSTRA_AGENT_PATH`，并以测试证明每个 capability-bearing Session 都注入该路径
- [x] T077 更新 Standard Execution Prompt、execution-context prompt 与 Agent CLI 文档：live Runtime CLI/API 覆盖 Workspace 源码、文档和生成 CLI，禁止构建或调用 Workspace copy
- [x] T078 运行 focused/full tests、typecheck/lint/build、GitNexus detect_changes、Session 状态复核并刷新 Taco

## Phase 15: Shared Modal and Section Body correction

- [x] T079 [P] [US3] 将 `UiSurfaceBody` 的公共 padding 收敛为 `0 8px`，由 Project/New Task/prototype 等业务 consumer 显式拥有所需上下 padding，并更新共享 CSS contract tests
- [x] T080 [US1] [US3] 将 production 与 prototype 的 New Task/Search Modal 收敛到 `UiDialogSurface`、44px Header/Footer、28px inline controls、`UiSurfaceTitle` 与统一 Close；Search actions/results/preview 复用 Section slots并让 split-pane divider 贯穿 Body
- [x] T081 运行 UI/Control Plane/Spec Prototype tests 与 typecheck、浏览器测量 New Task/Search computed geometry、检查 console/a11y structure、运行 GitNexus `detect_changes` 并刷新 Taco

## Phase 16: Project detail Header navigation

- [x] T082 在 `@mystra/ui` 增加共享 `UiNavTabs`，将 production 与 prototype Project detail 的 Project name + Overview/Issues/Settings 切换注册到 Shell Header；删除 page-local Project header、描述和 private tabs，并在浏览器验证点击/Arrow key/320px overflow

## Phase 17: Settings modal density and split boundary

- [x] T083 移除 Settings modal 内 Account、Team、Team members 的重复页面 header；将 navigation/header/content pane 收敛至 8px inset，title container 另有 8px horizontal inset，并由双栏 layout 绘制不继承左侧 Surface radius 的 shared strong divider；浏览器验证各 Tab 与控制台

## Phase 18: Owner correction — shared title, tabs, and embedded Settings

- [x] T084 让 Shell Main 的普通 title 与 Project title 都使用 `UiSurfaceTitle` 自身 8px horizontal inset；以 Appearance 已验证的 `UiSegmented` 统一 production/prototype Project Header tabs 与 Issue provider peer tabs，保留 tablist/Arrow/Home/End 语义并移除 `UiNavTabs` 第二套组件与样式
- [x] T085 修正 Account、Team、Team members 的 embedded render 直接返回 Setting content，不创建额外 page root，消除继承 `settingsPage` 产生的二次 outer padding；复核 Settings 三页的共享 controls、明确高度角色、row/list surface 与 Appearance 基线，不改变独立管理路由
- [x] T086 运行共享 UI、Control Plane、Spec Prototype focused/full tests、typecheck/build、真实浏览器 computed style/keyboard/console 验证、GitNexus `detect_changes` 与 Taco refresh

## Phase 19: Owner correction — surface depth and paused-route placeholders

- [x] T087 将 sidebar/Main/table 分别绑定至 theme `surface2`/`canvas`/`surface1` 的共享语义 role；Overview 与 Inbox 复用居中的 `PagePlaceholder`，不再渲染 title、description、数据获取或辅助状态；更新 production/prototype table role，并以 focused tests、light-theme computed style 与 console 验证

## Dependencies And Parallel Lanes

- T001–T006 后才能进入 persistence/status/UI consumers。
- Lane A：T007–T015；Lane B：T016–T024 中纯 UI tests/shared primitives可并行。
- T025–T048 依赖 A+B；US3/US4/US5/US6 在 shared contracts稳定后可分 worktree，但共享 `AppShell` 的任务必须串行合并。
- T049–T054 依赖 T004，必须在 final verification 前完成。
- T055–T059 是原实现证据；T060–T066 作为 owner correction 在其后串行替换旧 New Session precondition；T067–T069 修复真实 Runner 验收发现的后续 Session bootstrap 合同冲突；T079–T081 以 owner 最新公共 Modal/Section 尺寸与 Body padding 决策替换原 New Task/Search presentation contract。
- T082 依赖共享 Shell Header 与 `@mystra/ui`；其 `UiNavTabs` 方案已由 owner correction T084 以 `UiSegmented` 取代。
- T083 依赖 Settings shared Surface shell 与既有 embedded management views；不改变独立 Account/Team/Team members route 的页面 header。
- T084–T086 是 owner 对 T082/T083 的运行时复核修正：Appearance 的 `UiSegmented` 与 Settings pane 是基线，禁止用视觉近似的新组件替代共享 primitive。
- T087 依赖现有 Appearance token builder、shared shell 和 table frames；禁止为 light theme 写独立色值或让 sidebar 使用 popup/table surface。

## Implementation Gate

Owner 已批准 Taco 与实施。T001–T059 在完成最终 status/doctor、Taco refresh 与 commit 前逐项以可重复验证证据收口。
