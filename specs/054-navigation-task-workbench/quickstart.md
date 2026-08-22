---
title: "Quickstart: 验证主导航与 Task 工作台"
taco_scope: tasks
---

## 基线

```bash
fnm use 24.14.0
corepack use pnpm@10.25.0
pnpm typecheck
pnpm lint
pnpm test
```

实现前已知基线：Spec Prototype 有 3 个失败断言（旧 `.taskComposer` selector、旧 footer height、旧 Create Session fields）。实现第一 slice 必须先把这些测试与批准后的 prototype 合同对齐。

2026-08-14 pre-development review evidence：Spec Prototype typecheck 通过；054 Navigation Task Workbench targeted tests 7/7 通过；完整 Spec Prototype tests 34/37 通过，失败项仍仅为上述 3 个已记录基线断言。Metadata 合同变更未引入新失败。

## Focused verification

```bash
pnpm --filter @mystra/shared test
pnpm --filter @mystra/ui test
pnpm --filter @mystra/control-plane test
pnpm --filter @mystra/spec-prototype test
pnpm audit:task-session-terminology
```

## Browser journeys

1. 根入口与 Inbox 仅显示共享、居中的虚线 placeholder，不显示 page title、description、数据或辅助操作。
2. sidebar 展开/收起/320px 下 New Task 与 Search 各只有一个可聚焦实例。
3. Tasks Table/Kanban 在相同 filters 下拥有相同 Task IDs；load more 保持条件。
4. provider 正常/超时/不可用时，Project/Issue external identifiers 均稳定且 provider requests 不随 rows 增长。
5. New Task 成功/validation/API error/double submit；`/new` 不再提供页面。
6. Task detail New Session 覆盖 Workspace absent 自动 setup、preparing continuation、ready reuse、failed retry、Provider error 与 close；Workspace 过程不在 UI 出现。
7. Project detail 在 Header 中显示具有自身 8px horizontal inset 的 Project name，并以 Appearance 同一 `UiSegmented` 显示 Overview/Issues/Settings；Main 不显示重复 Project header 或描述，点击及 Arrow/Home/End 可切换，320px 无页面横向 overflow。Issue provider peer tabs 也使用该共享组件。
8. Settings modal 只显示当前 Tab 的 modal header；Account、Team、Team members 的嵌入式内容直接进入 content pane，不重复页面 root/title/description，也不继承独立 route 的 `settingsPage` outer padding。左侧导航与右侧内容以 layout-owned、贯通整高的可见 1px divider 分开；两侧 pane 与 header title container 均为 8px inset，SettingRow 保留行内 8px text inset。
9. Light/Dark theme 均使用 shared surface hierarchy：table 最浅、Main 次之、sidebar 最深；表格、Shell 与 placeholder 只消费主题 semantic token，不出现 page-local 色值。

## Completion gates

- SQLite/PostgreSQL schema parity 与 RdbProvider contracts 全绿。
- `Task.metadata` 在 shared Task、双 Prisma schema、create/update/list/detail API 和前端 Task model 中保持同一 JSON-object 合同；Task 外 `labels` 与 TaskLabel/ordinal/normalized columns 为 0。
- Task object、shared schema/type、API、RDB、双 Prisma schema、CLI 与 UI 统一使用 `status`；current code 中 Task `productionStatus`、`production_status`、`TaskProductionStatus`、`taskProductionStatusSchema` 及兼容 alias 为 0。
- TaskExecutionContext 仅作为 Start/Workspace/首个 Autopilot Session 链路的 internal coordination record；主导航、Tasks workbench、Task detail UI、TaskWorkbenchItem 与用户 create/update contract 中 TaskExecutionContext 暴露数量为 0。
- Metadata presentation order 只由前端处理；query-time case-insensitive match 在 SQLite/PostgreSQL parity fixtures 中通过。
- `waiting_for_review` 在 Task contract/CLI/prompt/UI/tests/docs 的 current surface 中为 0。
- production/prototype 都只从 `@mystra/ui` 消费标准 components/styles。
- `pnpm typecheck && pnpm lint && pnpm test && pnpm build` 全绿。
- 054 Taco 已在 owner review 后进入 implementation；完成后再次刷新并保留全部 review threads。

## Implementation evidence — 2026-08-17

### Static and automated gates

- `pnpm typecheck`：通过。
- `pnpm lint`：通过。
- `pnpm test`：136 个 test files 通过、1 个 test file 跳过；646 个 tests 通过、21 个 tests 跳过。
- `pnpm build`：通过；Control Plane production route manifest 不包含 `/new`。
- Focused suites：Shared 153/153、UI 30/30、Control Plane 380/380（另 21 skipped）、Spec Prototype 37/37、Agent adapters 9/9、Agent CLI 5/5、Runner daemon 32/32。
- `pnpm audit:task-session-terminology`：通过，检查 591 个 current files。
- `git diff --check`：通过。
- SQLite/PostgreSQL Prisma schema validate/generate、schema parity、RdbProvider contracts 与 10k Task performance assertion：通过；10k query gate `< 500ms`。

### Browser acceptance

为避免破坏 owner 的旧本地数据库，浏览器验收使用副本 `/tmp/mystra-spec054-browser.UUuPjG/mystra.db`；原数据库只读检查后未修改。

- 根入口与 `/inbox` HTTP 200，均显示无 page title/description 的居中虚线 placeholder。
- light Mystra theme 的 computed surface order 为 table `surface1`（白）→ Main canvas → sidebar `surface2`；浏览器 console 无 warning/error。
- 1440/1024/768/320px 下 expanded/collapsed shell 均只有一个可见 New Task 与一个 Search；320px 页面 `scrollWidth === innerWidth`。
- New Task、Search、Create Session 的 Escape/backdrop/Close 均关闭并把焦点还给触发器；显式 Escape handler 修复后复测通过。
- Tasks 初始页 50 条，第二页累计 100 条，第三页累计 101 条且 Load more 消失；Table/Kanban 使用相同 101 个 Task ID。
- Kanban 五列计数为 pending 22、in_progress 20、blocked 20、done 20、canceled 19；列表请求均 HTTP 200，观察值约 5–240ms，低于 500ms gate。
- Task detail Main 只显示 Sessions；Right Panel 显示 repository external ID、Issue identifier、Task metadata 与 status history；完整 Session UUID 可见，panel 可收起/恢复。
- Task detail 320px 页面无横向溢出；Sessions 列表保留自己的内部横向 viewport，不扩张页面。
- 原实现证据：手动 New Session 只在 ready Workspace 上成功，并允许 pending Task 保持 pending。该证据已被 2026-08-17 owner correction 废止，不再作为验收结果。
- 新验收要求：New Task 成功仍只创建 `runtimeId=null` 的 pending Task；首次 New Session 根据 Provider 解析 Runtime、原子锁定 `Task.runtimeId`、自动创建 `<Task, Runtime>` Workspace、原子进入 in_progress，并在 ready 后导航到 canonical Session。Workspace not ready 不得显示或禁用提交；后续 New Session 只能使用锁定 Runtime 上 available 的 Provider，同 Runtime 两个 Provider共用一个 Workspace。不同 Runtime Workspace 仅作为未来 sync 的持久化 seam，跨 Runtime sync、解锁、迁移与 failover 不在本期实现。
- 应用 console 无错误；浏览器工具自身一次 Statsig timeout 不属于应用页面日志。

### Automatic Task Runtime correction evidence — 2026-08-17

- Shared Task response 增加 `runtimeId: UUID | null`；create/PATCH strict schemas 拒绝 caller 写入。SQLite/PostgreSQL Task schema 对等，`TaskWorkspace` 唯一键为 `(taskId, runtimeId)`。
- RDB 20-way concurrent first Start contract 只有一个成功 Runtime winner；Task conditional update 与后续 mismatch rejection 保证 first non-null write immutable。
- `POST /api/tasks/:id/sessions` 现在返回 `202 preparing` 或 `ready` result；pending Task 首次 launch 原子进入 `in_progress`、冻结 TaskExecutionContext launch input，并自动 setup/continue Workspace。终态准备失败返回稳定错误，不会让 UI 无限轮询。
- Create Session 不读取 Workspace API 作为 gate。Task 无 Runtime 时聚合 eligible Runtime 的 available Providers；锁定后只显示该 Runtime 的 Providers。相同 `sessionId` 自动轮询，ready 后进入 canonical Session URL；Right Panel 只读显示 Task Runtime。
- 2026-08-17 最终 root gates：typecheck、lint、build、双 Prisma validate、术语审计均通过；137 个 test files 通过、1 个 file 跳过，653 tests 通过、22 tests 跳过。其中 Control Plane 387/387、Shared 153/153、UI 30/30、Spec Prototype 37/37、Agent adapters 9/9、Agent CLI 5/5、Runner daemon 32/32。
- Session replay 回归覆盖 Runtime 在 Session 已持久化后离线的情况：相同 `sessionId` 仍返回 canonical Session，不让当前 liveness 改写幂等历史。
- 真实浏览器：Task 创建 Session 的 POST 返回 201 并自动进入 `/sessions/:id`；Task Right Panel 显示锁定 Runtime；第二个 Session 再次返回 201。持久化检查为 2 Sessions、1 distinct Runtime，且 Task/Session Runtime 一致；页面无 framework error overlay。
- 浏览器 QA 使用临时本地账号、Runtime 与伪 ready Workspace 仅验证 UI/API/lock/navigation。伪 Workspace 的 runner-side attachment 按预期失败，不作为真实 repository materialization 成功证据；Workspace absent/preparing/retry 由 service/route/RDB integration contracts覆盖。
- QA 后已停止临时 Runner/Browser，并按 owner 授权再次 reset `/apps/control-plane/data/mystra.db`；测试数据未保留、未备份。

### Independent Session execution-context correction — 2026-08-17

- 真实 Session `43b54f0d-4f2f-474c-b894-934c9d2f61e4` 已被 Runner 正常领取并完成 Provider response；事件序列包含 `runtime_dispatched`、`provider_started`、`response_started` 与 `response_completed`，排除 Runner 未领取与网络阻塞。
- 该 Session 是同一 Task 的后续独立 Session；唯一 `TaskExecutionContext` 的 `sessionId` 正确保留首个 Session `c7f00b8f-f4f0-435c-94a7-7fbc083a7ddc`，但旧 dispatch 错误地只按该字段查 capability，导致后续 Session 没有 execution code。Agent 因 `MYSTRA_EXECUTION_CODE` 缺失报告 blocker。
- 修复将 capability lookup 改为 `leased Session -> taskId -> TaskExecutionContext`：所有 Task Session 各自获得短期 execution code，共享 Task 级 Context 与 Workspace；后续 Session 不覆盖首个 Autopilot Session 关联。
- TDD 证据：新增 AgentExecutionService 与 SQLite RDB contract 回归在旧实现上分别以 `scope_mismatch` 和缺少 `executionCodeExpiresAt` 失败；修复后 prompt/session/RDB focused tests 48/48 通过。
- 最终门禁：双 Prisma schema validate、术语审计、root typecheck/lint/build 全部通过；137 个 test files 通过、1 个 file 跳过，657 tests 通过、22 tests 跳过。GitNexus 对 71 个文件的直接合同替换报告 HIGH scope（139 changed symbols、15 affected processes），其风险来自跨层重命名范围；对应 shared、RDB、route、Session、Runner 与 UI contracts 均已由全量门禁覆盖。
- 本地 pre-0.1 SQLite 已按 owner 授权无备份 reset，并应用 `20260811210000_factory_task_execution_context`；Control Plane `/login` 返回 HTTP 200/title `Mystra`，Runner 已重新注册。

### Runtime-authoritative workload contract — 2026-08-17

- 真实 Session `c3ed8b6a-3baf-4188-b67c-bfc6afe1134b` 已完成至 `ready`，事件序列到达 `session.response_completed`；Task 被 Agent 置为 `blocked`，并提交 PR #27。它没有卡死，但 Agent 因 Mystra self-hosting Workspace 中的旧 `waiting_for_review` 源码合同而构建 Workspace CLI，造成约 7 分钟无效工作并产生错误 blocker。
- Runner 现在为 capability-bearing Session 注入 Runtime CLI 的绝对路径 `MYSTRA_AGENT_PATH`；Standard Execution Prompt 与两类 execution-context prompt 都要求通过 `"$MYSTRA_AGENT_PATH" context get` 获取活合同，并禁止构建或调用 Workspace copy。
- Focused TDD：Control Plane prompt/session suites 17/17，Runner session-worker suite 3/3。完整门禁：typecheck、lint、build 通过；139 个 test files 通过、1 个跳过，657 tests 通过、22 tests 跳过。
- GitNexus `detect_changes(scope=all)` 报告 11 个文件、12 个 changed symbols、0 affected processes、LOW risk；`assembleSystemPrompt` 预编辑 impact 为 LOW，2 个直接调用点、5 个总受影响符号，限定在 Sessions 模块。

### Shared Modal and Section Body correction — 2026-08-17

- New Task runtime geometry：Header/Footer 均为 44px、公共横向 padding 为 8px；业务 Body 为 8px 四边结果，其中横向来自 `UiSurfaceBody`、上下来自 `taskComposerBody`。Task name、Project 与 Create 实际高度均为 28px，横向 padding 均为 8px；Header title 为 12px/500。
- Search runtime geometry：Header 为 44px，搜索 input 为 28px/12px，workspace Body computed padding 为 `0px 8px`。list pane right divider 与 Body 顶部/底部差值均为 0px，证明竖线连续贯穿可用高度。
- Search 的可访问标题层级为 dialog `h2`，Actions、Tasks 与 preview title 均为 `h3`；modal 内 dropdown 通过 top-layer popover 位于 dialog 之上。以新页面会话复测 New Task/Search 后，应用 console 日志为空。
- 最终 focused gates：UI 14 files/38 tests、Control Plane 88 files/394 tests（另 1 file/22 tests skipped）、Spec Prototype 8 files/37 tests 全部通过；root lint/typecheck 与 `git diff --check` 通过。
- GitNexus `detect_changes(scope=all)` 对当前累计工作区报告 30 files、31 changed symbols、1 affected process、MEDIUM risk；唯一受影响 process 是此前 Project Create Modal 的既有改动，New Task/Search 未引出额外 execution flow。
- Search Actions、Tasks 与 preview 使用共享 `UiSurfaceHeader/Body/Title`；标题语义顺序为一个 dialog `h2` 后跟三个 `h3`，computed typography 均为 12px/500。`compactIconButton` 数量为 0，Close 使用 `UiDialogCloseButton`。
- New Task Project dropdown 仍 portal 到当前 `DIALOG` 的 native popover top layer，`:popover-open=true`，最上层命中 `uiDropdownOption`；未被 Modal 遮挡。
- 最终 fresh navigation 后应用 console warning/error 为 0；旧 HMR 导出错误发生在 adapter export 补齐之前，不属于最终页面状态。
