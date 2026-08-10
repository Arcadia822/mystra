# Tasks: Task Session 创建与历史体验

**Input**: `spec.md`, `plan.md`, `data-model.md`, `contracts/`, `engineering-review.md`
**Tests**: contract、service、RDB、Route Handler、component、真实 HTTP/Runtime 与浏览器验证均为必需。

## Phase 1 — 规格与架构门禁

- [x] T001 对齐 048 Workspace、049 Session/Event 与 050 UI/API 边界。
- [x] T002 删除 SessionSummary/SessionDetail/TaskSession view 与额外 Project selector 设计。
- [x] T003 运行 GitNexus query/context/impact 并记录 SessionService MEDIUM、页面/RDB LOW。
- [x] T004 完成 `/speckit.plan` 与 `plan-eng-review`，确认无 HIGH/CRITICAL 风险。

## Phase 2 — Shared transport 与 event window

- [ ] T005 [P] 在 `packages/shared` 添加直接引用 Session/SessionEvent 的 050 request/response schema 与边界测试。
- [ ] T006 [P] 为 latest/beforeSequence/afterSequence 互斥、limit 上限和 Manual Context 长度先写失败测试。
- [ ] T007 扩展既有 RdbProvider `listSessionEvents` 可选 before/descending window，不增加新 view 方法。
- [ ] T008 [P] 为 SQLite 与 PostgreSQL 合同补齐 latest/before/after 窗口、顺序与边界测试。
- [ ] T009 验证 10,000 events 窗口读取有界，API 返回 globalSequence 升序。

## Phase 3 — Task-bound launch service

- [ ] T010 为 `SessionService.launchForTask` 的 Task/Team/Workspace/Provider/Agent 校验先写失败测试。
- [ ] T011 为 Task 不可变 Project、Workspace runtimeId、Manual Context 与 canonical first message 映射写测试。
- [ ] T012 为重复 sessionId、事务回滚和单次 launch/不调用 sendMessage 写测试。
- [ ] T013 实现窄的 `launchForTask`，复用 049 `launch` 事务与 prompt ownership。
- [ ] T014 验证 Workspace attachment、system prompt audit、first user message 与 queued Session 同事务。

## Phase 4 — Authenticated HTTP API

- [ ] T015 [P] 为 Task Session list/launch route 写 human auth、Team permission、schema 与错误映射测试。
- [ ] T016 [P] 为 Session get/events route 写 auth、Team boundary 与 event window 测试。
- [ ] T017 实现 `GET/POST /api/tasks/[taskId]/sessions` 薄 adapter。
- [ ] T018 实现 `GET /api/sessions/[sessionId]` 与 events route 薄 adapter。
- [ ] T019 验证 API JSON 只返回共享 Session/SessionEvent，不泄露 system prompt、workspaceRef 或 provider payload。

## Phase 5 — 纯展示与客户端状态

- [ ] T020 [P] 为全部已知 event kind、unknown fallback、ready/terminal 文案写 presentation 测试。
- [ ] T021 [P] 为 event prepend/append 去重、globalSequence 排序与轮询状态写纯函数测试。
- [ ] T022 实现纯 event presentation/merge/polling helpers，不跨事件生成 summary。
- [ ] T023 [P] 在 `shell-copy.ts` 增加中英文 Task Sessions、launch、history、错误与状态文案。

## Phase 6 — Task 页面 Sessions

- [ ] T024 为 `TaskWorkspacePanel` 可选 Workspace 回调与现有状态兼容性写 component 测试。
- [ ] T025 实现 Workspace 回调，父页面仅维护一份 Workspace state。
- [ ] T026 为 Session empty/list/loading/error/pagination 与 launch disabled states 写 component 测试。
- [ ] T027 实现 Task Sessions panel：直接渲染 Session 字段、锁定 Runtime、选择 available Provider/active Agent。
- [ ] T028 实现可选 Manual Context、提交错误与成功导航 `/sessions/{id}`。

## Phase 7 — Session 详情与事件历史

- [ ] T029 为 Session loading/not-found/header 与 events loading/empty/error/unknown 写 component 测试。
- [ ] T030 实现直接使用 Session 的 header 与有界 latest event history。
- [ ] T031 实现 Load earlier、Refresh now、按 eventId/globalSequence 合并与请求互斥。
- [ ] T032 实现只在可见且活动/等待状态下的 3 秒轮询、错误 15 秒退避和 ready/closed/failed 停止。
- [ ] T033 补齐 320px 单列、reading width、键盘 focus、polite live region 与语义 token 样式。

## Phase 8 — 集成、性能与验收

- [ ] T034 运行 shared、control-plane、RDB、runner 相关 targeted tests 与 typecheck。
- [ ] T035 运行全量受影响 package tests，确认无 048/049 回归。
- [ ] T036 用 migrated SQLite 运行真实 HTTP E2E：ready Workspace -> launch -> claim -> events -> ready。
- [ ] T037 验证 1,000 Sessions 稳定分页与 10,000 events 有界窗口。
- [ ] T038 使用真实浏览器检查 Task launch、redirect、history、ready/terminal、console/network。
- [ ] T039 [P] 浏览器检查 320/768/1280 宽度、键盘路径、隐藏页停止轮询与手动刷新。
- [ ] T040 运行 `gitnexus detect-changes`、targeted diff review、Spec-Kit status/doctor/repoindex。
- [ ] T041 使用 `code-review-and-quality` 处理发现，并执行 `aaa-spec-close`。
- [ ] T042 提交 050、fast-forward 合并到本地 `main`，复核保留用户已有 dirty changes。
