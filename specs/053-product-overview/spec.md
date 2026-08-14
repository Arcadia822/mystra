# 功能规格：产品概览

**Planning Branch**: `main`（多个 spec 以 feature directory 并行规划，不创建 spec 分支）  
**Created**: 2026-08-13  
**Updated**: 2026-08-13  
**Status**: Draft  
**Input**: Overview 是登录后的第一个页面，用于掌握 Mystra 整体态势；New Task 由 054 作为全局 modal。根据本轮评审，Overview 只保留一组五状态 Task 看板和一个“需要关注”Task 列表，移除 Runtime、当前生产和 Projects 列表。  
**User Story Discussion**: Owner 已明确删除原 User Story 3；五态顺序、统计时间范围、Task 创建时间筛选、Session 级 attention 聚合和单 Task 单行均已作为正式需求写入。

## 产品决定摘要

Overview 只有两个核心区域：

1. 一组按生命周期顺序排列的五状态 Task 看板：**未执行、执行中、待接手、已完成、已取消**。
2. 当前 Team 的全部“需要关注”Task。一个 Task 只占一行，即使它有多个需要接手的 Session。

顶部数字默认统计最近 7 天创建的 Task，可切换最近 30 天或全部。筛选依据始终是 `Task.createdAt`，归类依据始终是 Task 的**当前** `productionStatus`。这是“创建时间 cohort 的当前状态快照”，不是历史趋势，也不是某段时间内发生过多少次状态转换。

Task 状态与 Session 状态保持独立。一个 Task 可以仍处于“生产中”，同时因为某个 Session `interrupted`、`waiting_for_handoff` 或 `failed` 而出现在“需要关注”列表；其他 Session 仍可继续运行。Overview 不自动修改 Task 状态。

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 用一组五状态数字掌握 Task 现状 (Priority: P1)

作为负责一个 Team 软件生产的操作者，我希望首页第一行只显示一组五个按生命周期排序的状态卡，以便快速理解当前 Task 分布，而不是解释多组看板、列表和互相重叠的指标。

**Why this priority**: 首页首先应该建立一个稳定、单义的生产状态模型。多个并列信息组会迫使用户先理解页面结构，再理解生产事实。那不是态势感知，只是额外劳动。

**Independent Test**: 准备跨越最近 7 天、最近 30 天和更早时间创建的五种状态 Task；分别切换三个时间范围，验证每个 Task 依据 `createdAt` 入选、依据当前 `productionStatus` 进入且只进入一个卡片。

**Acceptance Scenarios**:

1. **Given** Overview 可用，**When** 用户查看首个内容区域，**Then** 只出现一组五个状态卡，顺序固定为未执行、执行中、待接手、已完成、已取消。
2. **Given** 任一状态卡，**When** 用户读取它，**Then** 卡片只显示状态名称和一个数字，不在数字后追加小号解释、状态 code 或第二指标。
3. **Given** 用户首次进入 Overview，**When** 数据加载，**Then** 默认范围为最近 7 天，并仅统计 `createdAt >= observedAt - 7 days` 的 Task。
4. **Given** 用户选择最近 30 天或全部，**When** 统计刷新，**Then** 30 天使用滚动 30 天创建时间窗口，全部不设置创建时间下界；状态仍取每个 Task 当前值。
5. **Given** 一个 Task 在 7 天内创建、之后发生过多次状态变化，**When** 查看 7 天统计，**Then** 它只按当前状态计数一次，不按状态历史重复计数。
6. **Given** 视口不足以容纳五张卡，**When** 页面压缩，**Then** 五态仍保持同一组和固定顺序，可在该组内横向滚动，不拆成多个语义看板。

---

### User Story 2 - 一行一个 Task 查看所有需要关注的工作 (Priority: P1)

作为日常运营 Mystra 的操作者，我希望首页列出所有需要人工关注的 Task，并把同一 Task 下多个 Session 的异常压缩到一行，以便知道需要接手什么，而不会把 Session 数量误当成 Task 数量。

**Why this priority**: Task 是用户接手和判断的业务单位；Session 是执行事实。同一 Task 的一个 Session 中断而其他 Session 仍运行时，既不能把 Task 错改为中断，也不能把同一 Task 展示成多行。

**Independent Test**: 构造一个 `in_progress` Task，关联一个 `running` Session、一个 `interrupted` Session 和一个 `failed` Session；验证顶部只在“生产中”计数一次，attention 列表只出现一行，并显示需要关注的 Session 汇总。

**Acceptance Scenarios**:

1. **Given** Task 当前状态为 `blocked`，**When** Overview 加载，**Then** 该 Task 以“待接手”出现在需要关注列表。
2. **Given** Task 当前状态仍为 `in_progress`，但至少一个关联 Session 为 `interrupted`、`waiting_for_handoff` 或 `failed`，**When** Overview 加载，**Then** Task 仍计入“生产中”，同时在需要关注列表出现一行。
3. **Given** 同一 Task 有多个需要关注的 Session，**When** 列表渲染，**Then** 只显示一个 Task 行，并在该行汇总 Session attention 数量和类型，不生成重复 Task 行。
4. **Given** Task 同时有需要关注和仍在运行的 Session，**When** 用户查看该行，**Then** 页面不得把整个 Task 描述成已停止；Task 当前状态与 Session attention 原因必须分别呈现。
5. **Given** 用户打开 attention Task 行，**When** 导航发生，**Then** 只进入既有 Task 详情页；本规格不设计 Task 详情内的 Session 定位或自动选中。
6. **Given** Task 当前为 `done` 或 `canceled`，**When** 旧 Session 仍保留 interrupted/failed 历史，**Then** 该 Task 不进入当前 attention 列表；终态不会因旧执行事实重新进入 attention。
7. **Given** 顶部时间范围为 7 天或 30 天，**When** 用户查看 attention 列表，**Then** 列表仍覆盖当前 Team 的全部需要关注 Task，不受顶部统计时间范围限制。

### Edge Cases

- 五个状态卡必须始终同时存在；某状态没有 Task 时显示 `0`，不得隐藏卡片。
- 7 天和 30 天都是以页面 `observedAt` 为基准的滚动窗口，不按自然周或自然月切分。
- `createdAt` 恰好等于窗口下界时必须纳入统计；无效时间值使该 Task 进入数据错误处理，不得随意归类。
- 后端返回未知 Task 状态时，整个五态统计标记为不可用，不增加第六张“未知”卡，也不把未知计入任何已知状态。
- Task 与 Session 数据部分失败时，不得把 attention 显示为空；应显示不可用和重试。
- 同一 Session 状态重复返回、分页重叠或重试不得增加 Task 行或 attention 次数。
- Session `ready`、`closed`、`queued`、`dispatched`、`message_pending`、`running` 不单独触发 attention。
- Task `blocked` 在 Overview 中按“待接手”呈现；Session `waiting_for_handoff`、`interrupted`、`failed` 分别按“待接手”“已中断”“执行错误”呈现，且不得自动改变 Task 状态。

## Requirements *(mandatory)*

### Functional Requirements — 单组五状态看板

- **FR-001**: Overview 首个内容区域 MUST 只包含一组五个 Task 状态卡，固定顺序为未执行、执行中、待接手、已完成、已取消。
- **FR-002**: 五张卡 MUST 分别对应 canonical Task `productionStatus`：`pending`、`in_progress`、`blocked`、`done`、`canceled`；中文文案与 054 冻结的五态完全一致。
- **FR-003**: 053 MUST 直接消费 054 冻结的五态 Task 合同，不得在展示层恢复 `waiting_for_review`、`interrupted`、`failed` 或任何第六状态。`blocked` 只显示为“待接手”，具体 handoff reason 延后。
- **FR-004**: 每张状态卡 MUST 只显示状态名称和数字；MUST NOT 显示数字旁说明文字、code、百分比、趋势或第二数值。
- **FR-005**: 时间范围 MUST 提供最近 7 天、最近 30 天、全部三项；默认 MUST 为最近 7 天。
- **FR-006**: 7 天/30 天 MUST 按 `Task.createdAt` 与统一 `observedAt` 的滚动窗口筛选；全部 MUST 无创建时间下界。
- **FR-007**: 入选 Task MUST 按其查询时的当前 `productionStatus` 进入且只进入一个状态卡；状态历史与 Session 状态不得增加卡片计数。
- **FR-008**: 五卡计数之和 MUST 等于该时间范围内具有合法五态的 canonical Task 总数。
- **FR-009**: 时间范围切换 MUST 原位更新五个数字，不增加第二组卡片，不把卡片变成 Tasks 列表筛选器。

### Functional Requirements — 需要关注 Task

- **FR-010**: Overview MUST 在五态看板下只提供一个“需要关注”Task 列表；Runtime、当前生产和 Projects 列表 MUST NOT 出现在 Overview。
- **FR-011**: attention 列表 MUST 覆盖当前 Team 的全部当前 attention Task，并 MUST 不受顶部 7 天/30 天/全部选择影响。
- **FR-012**: Task 当前状态为 `blocked` 时 MUST 触发 Task-level attention，并以“待接手”表达；本期不解析结构化 handoff reason。
- **FR-013**: 非 `done`/`canceled` Task 只要存在 `interrupted`、`waiting_for_handoff` 或 `failed` Session，就 MUST 触发 Session-level attention；Session 状态 MUST NOT 自动改变 Task `productionStatus`。
- **FR-014**: 同一 Task 无论命中多少 Task/Session attention 条件都 MUST 只输出一行。
- **FR-015**: 每行 MUST 以 canonical Task 为 row identity，并显示 Task 标题、当前 Task 状态、attention 原因摘要、需要关注的 Session 数量和最近 attention 时间；Task ID 的默认显隐 MUST 跟随 054 的共享 Tasks Table 配置，MUST NOT 展开 Session 子列表。
- **FR-016**: attention 原因 MUST 分别保留 Task-level 和 Session-level truth；一个仍为 `in_progress` 的 Task 不得因 Session 中断被标成 Task `blocked`。
- **FR-017**: attention 行 MUST 导航到 canonical Task 详情页；Session deep-link、详情页内定位与接手动作均不属于 053。
- **FR-018**: attention 列表 MUST 支持稳定分页并保证跨页 Task 不重复；排序 MUST 为 `latestAttentionAt DESC, taskId DESC`。
- **FR-018a**: attention 列表 MUST 复用 054 定义的 Mystra 基础 Table stacked mode、ghost row、left/grow/spacer/right anatomy、column-gap、Task status icon、Project Label 和字段显隐合同；MUST NOT 创建 Overview 专用的平行 row/table 组件。Attention 原因使用该 consumer 的 Metadata slot，最近 attention 时间使用末端时间 slot。

### Functional Requirements — 数据可信与集成

- **FR-019**: Overview MUST 使用当前 Team 鉴权；Task 与 Session 均按 active Team 过滤。
- **FR-020**: Overview MUST 使用一个服务端 read model 聚合五态计数和 Task-deduplicated Session attention，MUST NOT 对每个 Task 发起一次 Session 请求。
- **FR-021**: 响应 MUST 返回统一 `observedAt`、选定范围、五态计数和 attention page；未知 Task 状态 MUST 使统计失败关闭，而不是映射到五态之一。
- **FR-022**: loading、empty 和 unavailable MUST 有明确表达；单一 snapshot 无法安全完成时整份结果 MUST fail closed，unknown/unavailable MUST NOT 显示为 `0` 或 healthy。
- **FR-023**: Team 切换 MUST 丢弃旧 Team 未完成响应；旧 Team Task/Session attention 不得闪现为新 Team 数据。
- **FR-024**: 页面 MUST 复用现有 shell 语言与 appearance 偏好；中文状态文案使用本规格五个名称。
- **FR-024a**: Overview 的状态统计与 attention 列表 MUST 复用同一个 Section primitive（header + body）；shell header 与内容之间、Section header 与 body 之间 MUST NOT 使用分割线。Section 内部间距 MUST 使用 `--tight-gap`，Section 之间 MUST 使用 `--layout-gap`。
- **FR-025**: 053 MUST NOT 创建持久化 Overview snapshot、统计表、后台统计 job、跨 Team feed 或 SessionEvent 全局流。
- **FR-026**: 053 只拥有 Overview；默认根入口、主导航和 New Task modal 继续由 054 拥有。

### Key Entities

- **Overview Window**: `7d | 30d | all`，只影响顶部 Task 状态数字，以 `Task.createdAt` 选择 cohort。
- **Task Status Counts**: 五个 canonical Task 当前状态的互斥计数。
- **Attention Task Row**: 以 Task 为唯一单位的只读聚合行，组合 Task 当前状态与多个 Session attention reason，不拥有独立生命周期。
- **Session Attention Summary**: 一个 Task 下 `interrupted`、`waiting_for_handoff`、`failed` Session 的数量及最近 attention 时间；不修改 Task。

## Assumptions & Dependencies

- 目标 Task 状态合同为 `pending / in_progress / blocked / done / canceled`，由 054 冻结；当前代码仍多出 `waiting_for_review`，因此 053 implementation 继续等待 054 的 canonical lifecycle 替换。
- pre-0.1 策略要求直接替换旧 Task 状态及调用者，不保留双读、alias 或兼容映射。
- `waiting_for_review` 的 handoff 语义并入 `blocked`；review、授权、等待回答与等待信息等原因延后，不由 053 推断。
- Session 继续使用 049 的独立状态机。Task 下允许多个 Session，attention read model 只读取 Session 当前状态，不读取全局 SessionEvent。
- 054 拥有默认根入口、导航和 New Task modal；053 交付 Overview surface。

## Deferred / Out of Scope

- Task 五态的允许转换、actor ownership、`waiting_for_review` 删除与 handoff reason：由 054 lifecycle contract 拥有。
- 点击 attention Task 后在详情页自动定位具体 Session、接手 Session 或恢复执行。
- Runtime readiness、当前生产 Task 列表、Projects 列表。
- 状态卡点击筛选、图表、趋势、百分比、同比/环比或历史状态转移分析。
- 自定义 dashboard、widgets、保存筛选器、成本、SLA 和通知规则。
- 全局 SessionEvent/Runner 日志时间线或日志搜索。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Overview 首屏只出现 1 组五状态卡；状态卡数量恒为 5，顺序 100% 符合本规格，额外说明文字数量为 0。
- **SC-002**: 7 天、30 天、全部三个范围测试中，100% Task 依据 `createdAt` 入选并依据当前 Task 状态互斥计数；五态之和等于入选 Task 数。
- **SC-003**: 含一个 running、一个 interrupted、一个 failed Session 的 `in_progress` Task，在顶部“生产中”计数 1 次，在 attention 列表出现 1 行。
- **SC-004**: 任意 Task 关联 1–100 个 attention Session 时，attention 列表 Task 行数始终为 1，Session attention 计数准确。
- **SC-005**: 顶部范围切换不改变 attention Task 集合；attention 只随 Task/Session 当前事实变化。
- **SC-006**: Runtime、当前生产、Projects 三类 Overview 列表渲染数量均为 0。
- **SC-007**: 未知 Task 状态、Task 查询失败或 Session attention 查询失败时，界面显示不可用/重试，错误数据被显示为 `0` 的次数为 0。
- **SC-008**: attention 任一行点击后 100% 导航到正确 Task 详情页，不尝试 Session deep-link。
- **SC-009**: 320px–1440px 视口下五态保持同一组和同一顺序；窄屏只在该组内部横向滚动。
