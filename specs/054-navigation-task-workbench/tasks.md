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
- [x] T028 [US2] 在 production workbench 只用 Task 内 `metadata`、Project `repositoryExternalId` 与 Issue `identifier`，删除 Task 外 labels、TaskExecutionAttempt projection 和 project-name/provider snapshot join；Metadata presentation order 只由前端处理
- [x] T029 [US2] 按 `specs/054-navigation-task-workbench/quickstart.md` 浏览器验证 0/1/50/101/10k Tasks、五态 columns、Table/Kanban ID parity、load-more anchor 与 p95 < 500ms evidence

## Phase 5: User Story 3 - New Task Modal (P1)

**Independent Test**: 任意页面打开 modal；success/validation/API error/double-submit/focus return 均单一可恢复。

- [x] T030 [P] [US3] 在 `apps/control-plane/app/_components/new-task-dialog.test.tsx` 先写 shared composition、20px controls、validation/focus tests
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

- [x] T039 [P] [US5] 在 `apps/control-plane/app/_components/task-detail-main-model.test.ts` 写 canonical Session-only mapping、Task.metadata 直接投影，以及禁止 TaskExecutionAttempt UI/snapshot/derived-current fields tests
- [x] T040 [P] [US5] 在 `apps/control-plane/app/_lib/task-view.test.ts` 写 repositoryExternalId/Issue identifier projection 与 provider-unavailable tests
- [x] T041 [US5] 在 `apps/control-plane/app/tasks/[id]/page.tsx` 接入 shared breadcrumb/Right Panel/Sessions composition，不复制 shell anatomy，也不暴露 internal TaskExecutionAttempt record
- [x] T042 [US5] 在 `apps/control-plane/app/_components/task-detail-panel.tsx` 只显示 persisted external identifiers、Task.metadata 与 status history；Metadata 顺序由前端 renderer 决定
- [x] T043 [US5] 按 `specs/054-navigation-task-workbench/quickstart.md` 浏览器验证 1440/1024/768/320px、panel collapse/reopen、full Session UUID 与 page overflow=0

## Phase 8: User Story 6 - Manual New Session (P1)

**Independent Test**: ready+provider success/precondition/error/close；只提交 providerKey/manualContext，Task/TaskExecutionAttempt 无副作用。

- [x] T044 [P] [US6] 在 `apps/control-plane/app/_components/create-session-dialog.test.tsx` 先写 exact fields/copy/focus/precondition/error tests
- [x] T045 [P] [US6] 在 `apps/control-plane/app/api/task-session-routes.test.ts` 写 runtime server-resolution、agent null、Task/TaskExecutionAttempt no-write regressions
- [x] T046 [US6] 在 `apps/control-plane/app/_components/create-session-dialog.tsx` 接入 existing Task Session launch API 与 returned Session navigation
- [x] T047 [US6] 在 `apps/control-plane/app/tasks/[id]/page.tsx` 的 Main Header 接入唯一 New Session action 与 Right Panel recovery ordering
- [x] T048 [US6] 按 `specs/054-navigation-task-workbench/quickstart.md` 浏览器验证 success/workspace-not-ready/no-provider/API-error/Escape/backdrop/Close journeys

## Phase 9: Five-State Cross-Cutting Replacement

- [x] T049 在 `apps/control-plane/src/lib/tasks/task-status-service.test.ts` 先写 `status` result/view、完整 actor matrix、stale revision、blocked note 与 `productionStatus` rejection tests
- [x] T050 更新 `apps/control-plane/src/lib/tasks/task-status-service.ts`、status routes 与 production panels，统一读写 `Task.status`，直接删除 `productionStatus` 与 `waiting_for_review`
- [x] T051 [P] 更新 `packages/agent-cli` schemas/commands/tests，将所有 Task JSON 输出收敛为 `status`，并将 agent review handoff 改为 `blocked` + note
- [x] T052 [P] 更新 `apps/control-plane/src/lib/sessions/standard-execution-prompt.ts` 与 prompt tests，删除旧状态指令
- [x] T053 [P] 将 `packages/shared/src/harness.ts` 直接替换为 `task-execution-attempt.ts`，更新 `packages/shared/src/result.ts` 及 tests 中所有 Task-level `productionStatus`/旧状态消费，不误改 Session `state` vocabulary，也不保留 Harness alias
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
- [x] T063 [US6] 将 pending Task 的首个 Session launch 与 `pending -> in_progress`/TaskExecutionAttempt 原子链路整合；移除 Human 必须先 Start 或 Setup Workspace 的前置操作
- [x] T064 [US6] 更新 Task detail/Create Session UI 与 prototype：不读取 Workspace 作为可用性 gate，不显示 not-ready/setup/retry，accepted 时显示 Session starting 并自动轮询/导航
- [x] T065 [US6] 添加 shared/service/route/component/browser regression tests，覆盖 absent、queued/preparing、ready、failed retry、provider unavailable、idempotent replay、并发首次 Runtime lock、后续 Session 不切换 Runtime、同 Runtime两 Provider 一个 Workspace；用内部 provider contract fixture 验证不同 Runtime Workspace composite identity，不把它作为 Session failover
- [x] T066 运行双 schema generate/validate、focused/full tests、typecheck/lint/build、GitNexus detect_changes、browser journey、Spec-Kit status/doctor，并刷新 Taco

## Phase 12: Independent Session execution-context correction

- [x] T067 [US6] 复现后续独立 Session 因未绑定首个 `TaskExecutionAttempt` 而缺少 execution code、却被 Standard Execution Prompt 强制调用 `mystra-agent context get` 的合同冲突
- [x] T068 [US6] 在 Standard Execution Prompt 与两类 `execution_context` 中显式区分 attempt-bound capability bootstrap 和 independent embedded-context bootstrap；不得把首个 attempt capability 复用给后续 Session
- [x] T069 [US6] 运行 prompt/session focused regressions，确认独立 Session 不再把缺少 attempt capability 当作 blocker，且首个 Autopilot Session 仍强制执行 `mystra-agent context get`

## Dependencies And Parallel Lanes

- T001–T006 后才能进入 persistence/status/UI consumers。
- Lane A：T007–T015；Lane B：T016–T024 中纯 UI tests/shared primitives可并行。
- T025–T048 依赖 A+B；US3/US4/US5/US6 在 shared contracts稳定后可分 worktree，但共享 `AppShell` 的任务必须串行合并。
- T049–T054 依赖 T004，必须在 final verification 前完成。
- T055–T059 是原实现证据；T060–T066 作为 owner correction 在其后串行替换旧 New Session precondition；T067–T069 修复真实 Runner 验收发现的后续 Session bootstrap 合同冲突。

## Implementation Gate

Owner 已批准 Taco 与实施。T001–T059 在完成最终 status/doctor、Taco refresh 与 commit 前逐项以可重复验证证据收口。
