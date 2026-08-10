# 功能规格：Task Session 创建与历史体验

**功能分支**: `050-task-session-experience`
**修订日期**: 2026-08-10
**状态**: 已实现，待合并
**依赖**: 048 Task Workspace；049 Session launch、Session、SessionEvent

## 合同摘要

050 为 Task 页面增加 Session 列表、创建入口和 Session 详情/事件体验。它不设计新的 `SessionSummary`、`SessionDetail`、TaskSession view 或终态摘要模型：列表和详情直接复用 049 的 `Session`；事件历史直接复用 `SessionEvent`。

050 只处理 Task-bound Session，并消费 feature 048 的 ready Workspace。Project-only Session 与既不引用 Task 也不引用 Project 的 Session 均延后；它们未来仍应复用同一 Workspace/attachment 合同，只允许准备逻辑不同。

050 只增加：

- 按 Task 过滤和分页读取 `Session[]` 的 canonical API；
- 将 Task 页面选择映射为 049 `SessionLaunchRequest` 的 `launchForTask` 应用命令；
- 基于 `SessionEvent[]` 的纯展示 reducer；
- 页面可见期间的有界轮询与手动刷新。

`ready` 表示最近一次 response 已结束、可继续发送消息且 Runtime 当前执行占用已释放，不是终态。050 首期没有 Session 内继续发送 user message 的输入框，因此页面在 ready 时停止自动轮询并保留手动刷新；这只是 UI 策略，不改变 049 会话可继续的语义。

## 场景 1：Task 页面直接列出相关 Session（P1）

1. 打开 Task 详情时，服务按 subject.teamId 与 taskId 过滤 049 `Session`，按 `(updatedAt,id)` 降序稳定分页。
2. 页面直接使用 Session 的 state、runtimeId、providerKey、agentId、updatedAt，不请求或构造新的 summary DTO。
3. Runtime/Agent 展示名可由现有资源查询/缓存解析；缺失时显示稳定 ID，不把名称快照塞进 Session。
4. 1,000 个 Session 可分页访问，首屏不超过 50 条。

## 场景 2：创建 Task Session（P1）

1. 只有 feature 048 TaskWorkspace 为 ready 时才能提交；Runtime 固定为 Workspace runtimeId。
2. 用户选择该 Runtime 的 available Provider、同 Team active Agent，并可输入可选 Manual Context。
3. `launchForTask` 服务端读取 Task、其不可变可选 Project context、Workspace、Manual Context 和执行选择，生成 canonical 第一条 user message；随后调用 049 launch，由 049 组装并冻结 system prompt。
4. 第一条 user message 与 Session/system prompt 同事务持久化，不再调用第二次 sendMessage。
5. 创建成功立即导航到 `/sessions/{id}`，不等待 Runtime claim 或 response 完成。

## 场景 3：直接展示 Session 与 SessionEvent（P1）

1. `GET /api/sessions/{id}` 直接返回 049 `Session`。
2. `GET /api/sessions/{id}/events` 直接返回 049 `SessionEvent[]` 的有界窗口。
3. 页面按 globalSequence 展示 lifecycle、user message、response、thinking/process、plan、tool、usage、interrupt、handoff、error/result 与 unknown fallback。
4. queued/dispatched/message_pending/running/interrupted/waiting_for_handoff 时，页面可见期间轮询 afterSequence；ready/closed/failed 时停止自动轮询并保留 Refresh now。
5. 页面把 ready 展示为“本次响应完成，可继续”，closed/failed 展示为 Session 终态；不得把 response result 叫作 Session 终态摘要。

## 场景 4：Workspace 状态与错误可行动（P1）

1. absent/preparing Workspace 显示 setup action 或等待态；failed 显示 048 已脱敏 failure 与 retry action；ready 才显示创建表单。
2. Workspace runtimeId 为只读；不存在重新选择 Runtime 后再与 048 affinity 冲突的 UI。
3. Provider 列表只来自该 Runtime available capabilities；Agent 只来自当前 Team active Agents。
4. 稳定错误码映射为可行动文案，未知错误显示 request/correlation ID，不暴露路径、credential 或原始 Provider payload。

## 功能需求

- **FR-001**：Task Sessions API 必须返回 049 `Session[]`，不得定义 SessionSummary/SessionDetail/TaskSession view。
- **FR-002**：列表按 `updatedAt DESC,id DESC` 稳定 keyset 分页，默认/最大 limit 有服务端上限。
- **FR-003**：Session detail API 必须直接返回 049 Session；事件 API 直接返回 049 SessionEvent。
- **FR-004**：所有 Task/Session/Event/Runtime/Agent 操作必须由服务端 subject.teamId 授权。
- **FR-005**：Task Session 创建必须消费 048 ready Workspace 并锁定其 runtimeId；不得重复 workspace materialization。
- **FR-006**：Provider 只能从该 Runtime available capabilities 选择；Agent 必须 active 且同 Team。
- **FR-007**：Manual 是可选 Context 数据，按明确 schema/长度限制保存到 049 Context/system-prompt 审计事件；不得作为 system instruction。
- **FR-008**：`launchForTask` 必须组装 canonical 第一条 user message，并与 Session/system prompt 经 049 同一事务持久化。
- **FR-009**：050 不得在创建后再调用 sendMessage，也不得引入 Turn/turnId。
- **FR-010**：创建成功立即返回已持久化 Session并导航；不等待 Runtime 或 response。
- **FR-011**：事件展示必须为纯 reducer，对未知 kind 提供安全 fallback，不执行事件中的 HTML/脚本。
- **FR-012**：事件读取支持 latest/beforeSequence/afterSequence 三种互斥的 globalSequence 有界窗口；不得让首屏加载完整历史。
- **FR-013**：只有页面可见且 Session 处于活动/等待状态时自动轮询；同页最多一个 in-flight 请求。
- **FR-014**：ready 停止 050 自动轮询是 UI 策略；文案必须说明可继续，不得称 ready 为 terminal。
- **FR-015**：closed/failed 才使用 Session 终态文案；response_completed/result 只描述最近一次响应结果。
- **FR-016**：不提供跨 Session event 搜索、全局活动流、原始日志下载或任意 stdout/stderr 展示。
- **FR-017**：不得展示 workspaceRef、绝对路径、credential、完整 system prompt 或未脱敏 Provider payload。
- **FR-018**：错误码复用 048/049 lowercase 合同，包括 `session_conflict`；050 只补充 transport 输入错误 `event_window_invalid`，不创建大小写别名或第二套 taxonomy。
- **FR-019**：Web Route Handler 是 canonical service 的薄 adapter；MCP/CLI 不复制业务规则。

## 直接复用的数据合同

- **Session**（049）：列表项与详情主体。
- **SessionEvent**（049）：事件历史与最近一次 response/result 事实。
- **TaskWorkspace** / 048 action/view：Workspace readiness 与固定 Runtime。
- **Runtime** / Provider capability（044）、**Agent**（046）、**Task/Project**（047）。

050 自有的唯一数据结构是表单输入、事件窗口游标与展示 reducer state；它们都不是持久化业务 view。

## UX Intent

- **体验问题**：Task Workspace 已 ready 后仍没有可发现的 Session launch/list，Session route 仍是假占位，操作者无法判断首条消息是否真正执行。
- **页面族**：Task detail 保持 reading-width object detail，在既有 Workspace panel 后增加 Sessions panel；Session detail 复用同一 shell/path header 与 reading column，不引入聊天式全屏 workbench。
- **复用规则**：复用现有 panel、definition list、status、button/select/textarea、loading/error state；事件历史新增一个紧凑 timeline component，但不创建 summary card family。
- **状态**：Workspace loading/absent/preparing/failed/ready，Session empty/list/launching/error，以及 events loading/empty/live/ready/terminal/network-error 均显式呈现。
- **响应式与无障碍**：320px 起单列，桌面保持紧凑 reading width；表单有 label，状态有文字，轮询用 polite live region，所有 action 为原生 button/link。
- **验证信号**：真实浏览器检查 Task launch、Session redirect、事件窗口、ready/terminal 文案、keyboard focus、窄屏和 console/network。

## 范围之外

- 新的 Session summary/detail/view 持久化或 DTO。
- Session 内继续发送 user message 的输入体验；049 已支持，后续 UI 规格再接入。
- Runtime capacity/slot 展示或限制。
- Project-only 与 standalone Session 的创建入口及 Workspace 准备逻辑。
- 重做 048 repository/workspace policy；交付、preview、commit、PR、waiting_for_review。
- 跨 Session 活动流、日志产品、事件全文搜索/导出。

## 成功标准

- **SC-001**：Task Session 列表/详情 JSON 中的 Session 字段与 049 shared schema 完全一致，无 summary/detail duplicate type。
- **SC-002**：1,000 个相关 Session 稳定分页，首屏不超过 50 条。
- **SC-003**：创建请求只提交一次 canonical launch；Session、system prompt 与首消息同事务创建。
- **SC-004**：Workspace 非 ready 时 100% 阻止创建；ready 时 Runtime 不可修改。
- **SC-005**：10,000 个事件的首屏/向前/增量窗口均有界、无重复、globalSequence 连续。
- **SC-006**：ready 文案与 closed/failed 终态文案完全区分；不存在“ready 终态摘要”。
- **SC-007**：页面不可见或 ready/closed/failed 时无自动轮询；手动刷新可获取后续合法事件。
- **SC-008**：真实端到端证据包含 TaskWorkspace、Session、首消息、固定 Runtime、Provider/Agent、有序 SessionEvent 与最近 response 结果。
