# 功能规格：主导航与 Task 工作台

**Feature Branch**: `054-navigation-task-workbench`

**Created**: 2026-08-13

**Status**: Draft

**Input**: 调整登录后的信息架构：以 053 Overview 为首页；将 New Task 与 Search 作为 sidebar header 的基础 icon action，并在 sidebar 收起时继续保留于页面 header；移除全局 Issues 主菜单；新增 Team 范围 Tasks 主菜单和 Table/Kanban 工作台；保留只展示活跃 Task 的侧栏快速导航；参考 CastrelTable 与 Linear issue views 建立 Mystra 自有基础表格体验；在 Task detail 主 header 恢复手动发起 Session 的入口与创建 Modal。

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 从 Overview 开始并使用稳定的基础动作 (Priority: P1)

作为已登录的 Mystra 操作者，我希望每次进入产品先看到 053 提供的 Overview，并且无论 sidebar 展开还是收起，都能立即使用 New Task 与 Search，以便首页表达全局态势，而两个高频动作保持一键可达却不占用主导航层级。

**Why this priority**: 首页与全局动作决定整个产品的信息层级。若 New Task 仍是 landing page 或普通导航项，Overview 就只是一张被藏起来的报表；若收起 sidebar 后动作消失，高频能力又会因布局偏好变得不可用。

**Independent Test**: 登录后访问产品根入口；053 尚未落地时验证显示明确的 Overview placeholder，053 可用后验证切换到真实 Overview。分别在 sidebar 展开、桌面收起和窄屏隐藏三种状态下，用一次操作打开 New Task modal 与 Search dialog，且当前页面不会先发生导航。

**Acceptance Scenarios**:

1. **Given** 操作者已登录且 053 尚未提供可用页面，**When** 打开产品根入口，**Then** 系统显示不伪造 Overview 数据的明确 placeholder，而不是 New Task 页面；053 可用后同一路由切换到真实 Overview。
2. **Given** sidebar 展开，**When** 操作者查看 sidebar header，**Then** New Task 与 Search 以两个独立 icon action 出现，且不作为主导航条目出现。
3. **Given** sidebar 已收起或因窄屏而隐藏，**When** 操作者查看页面 header，**Then** 同样的两个基础动作仍可见、可聚焦且可使用。
4. **Given** New Task modal 或 Search dialog 已打开，**When** 操作者取消或关闭，**Then** 回到打开前的页面和上下文，不产生额外导航历史。

---

### User Story 2 - 在 Team 范围管理全部 Tasks (Priority: P1)

作为 Mystra 操作者，我希望从主菜单进入一个 Team 范围的 Tasks 工作台，并在高密度 Table 与按生产状态分栏的 Kanban 之间切换，以便既能精确查找和比较 Task，也能快速观察生产流转分布。

**Why this priority**: Task 是 Mystra 的全局生产对象，不属于 Project。主导航需要提供稳定的 Team 范围入口，而不是依赖 Project 分组或侧栏中有限的快速链接来代表完整 Task 集合。

**Independent Test**: 准备包含全部五种 `status`、有无 Project、不同 Metadata、以及有无 Issue reference 的 Task 数据；从主菜单进入 Tasks，验证默认无表头的堆叠列表显示六个默认字段，通过 Display 切换 Table/Kanban 与附加字段，执行搜索、筛选、刷新和打开详情，并验证切换布局不会丢失当前查看条件。

**Acceptance Scenarios**:

1. **Given** 当前 Team 存在不同状态与上下文的 Tasks，**When** 操作者进入主菜单 Tasks，**Then** 默认 Table 展示完整 Team 范围集合，而不是只展示某个 Project 或活跃子集。
2. **Given** 操作者已应用搜索、筛选或排序，**When** 在 Table 与 Kanban 之间切换，**Then** 当前条件与匹配 Task 集合保持一致。
3. **Given** 操作者使用 Kanban，**When** 浏览各列，**Then** Task 按 `pending`、`in_progress`、`blocked`、`done`、`canceled` 分栏，界面分别显示 Not started、In progress、Needs handoff、Completed、Canceled，并且卡片只能打开详情，不能拖拽改变状态。
4. **Given** 一个 Task 没有 Project 或 Issue reference，**When** 它出现在任一布局，**Then** 系统使用明确的空上下文表达，不隐藏该 Task，也不伪造外部数据；存在引用时只显示持久化的 provider-stable repository external ID 与 Issue identifier。
5. **Given** 操作者首次进入 Tasks，**When** 查看列表，**Then** 页面内容区直接从 toolbar 和 Task rows 开始，没有页面介绍区、列标题行、记录数页脚或分页器；主区域 header 下方和 toolbar 与 rows 之间均没有分割线，只有整个工作台外围的一圈边缘线。
6. **Given** 同一视图包含不同 Task 状态，**When** 操作者比较 status icons，**Then** 每个 icon 使用相同尺寸的圆形基底，并通过圆内进度/符号与语义颜色共同区分状态，不出现眼睛或循环箭头。
7. **Given** stacked Table 同时显示内容长度不同的 Tasks，**When** 操作者纵向比较各行，**Then** Status、Task ID、Updated At、Created At 分别以当前展示 rows 中该 field 的最大自然内容宽度作为 shared track width，使各行中的下一 field 均从统一位置并保持标准 gap 开始；等宽字段只形成左边缘连续前缀或右边缘连续后缀，不在自然宽度字段之间制造伪 column grid。
8. **Given** Kanban card 的 Project、Issue 与 Metadata entries 总宽度超过卡片可用空间，**When** 组件完成布局或卡片宽度发生变化，**Then** 前端按自己的 presentation order 只显示能够完整容纳的前置 `UiLabel`，并用共享 `+N` overflow control 代表其余项目；激活该 control 后，标准全局浮动 popup 展示被折叠的完整属性列表，卡片内不得出现重叠、半截 Label 或换行增高。
9. **Given** 操作者同时显示 Updated At 与 Created At，**When** 比较两个时间字段，**Then** 两者使用同一个共享 time renderer、locale 与 format options，不出现一个字段为相对时间而另一个字段为绝对日期的混合文案。

---

### User Story 3 - 用 modal 创建手工 Task (Priority: P1)

作为 Mystra 操作者，我希望从全局 New Task icon action 打开一个简洁 modal 创建手工 Task，以便在不离开 Overview、Tasks 或其他当前页面的情况下快速记录新的生产意图。

**Why this priority**: New Task 高频但不是产品信息架构的第一层。Modal 保留速度，同时避免让一个简单表单占据首页、主菜单和独立 URL 三套表面。

**Independent Test**: 从 Overview 与 Task detail 分别打开 New Task modal，验证必填标题、可选描述和 Project context、取消行为、失败反馈及成功后进入新 Task 详情；确认应用不再提供可直接访问的 `/new` 页面。

**Acceptance Scenarios**:

1. **Given** 操作者位于任意已登录页面，**When** 点击 New Task icon，**Then** modal 在当前页面之上打开，地址与当前页面不变。
2. **Given** 标题为空，**When** 操作者尝试创建，**Then** modal 保持打开并将焦点引导到可理解的标题错误。
3. **Given** Task 创建成功，**When** 服务返回新 Task，**Then** modal 关闭、全局 Task 数据刷新并进入新 Task 详情。
4. **Given** 操作者直接请求 `/new`，**When** 路由被解析，**Then** 系统不再提供 New Task 页面，也不会借该 URL 自动打开 modal 或重定向到 Overview。
5. **Given** New Task modal 已打开，**When** 操作者查看其结构，**Then** title input 位于 header，description 位于主体，可选 Project 配置位于 footer，三个区域之间没有分割线且整体使用 ghost 表达。
6. **Given** New Task modal 已打开，**When** 操作者选择 Project，**Then** 标准 Project dropdown 展示 No project 与可用 Project（包含持久化的 repository external ID，不要求外部 snapshot），支持指针和键盘选择，并在 footer trigger 中回显选择结果；提交 action 的可见文案为 `Create`。

---

### User Story 4 - 保留活跃 Task 快速导航与 Project Issue intake (Priority: P2)

作为正在监督 Agent 生产的操作者，我希望 sidebar 下方继续提供活跃 Task 的快速入口，并且仍可在具体 Project 内浏览外部 Issues 和创建 Task，以便快速回到进行中的工作，同时维持“Issue 是 Project 范围外部输入、Task 是 Team 范围生产对象”的边界。

**Why this priority**: 完整 Tasks 工作台与侧栏快速入口解决的是不同问题。前者用于全局管理，后者用于快速返回当前生产；Project Issue 入口则保留外部需求进入 Task 的正确路径。

**Independent Test**: 准备非终态与终态 Tasks，以及至少一个带 Issue source 的 Project；验证 sidebar 快速区只显示非终态 Tasks，主菜单不存在 Issues，但 Project 内 Issue 浏览和创建 Task 仍可完成。

**Acceptance Scenarios**:

1. **Given** 当前 Team 同时存在非终态和终态 Tasks，**When** sidebar 展开，**Then** 快速 Task 区沿用现有 Project 分组，只展示 `pending`、`in_progress`、`blocked`，不展示 `done` 或 `canceled`。
2. **Given** 操作者点击快速 Task，**When** 导航完成，**Then** 打开对应 Task 详情；无 Project 的 Task 仍有可理解的归类。
3. **Given** 操作者查看主导航，**When** 扫描入口，**Then** 不存在全局 Issues 菜单项。
4. **Given** 一个 Project 配置了 Issue source，**When** 操作者进入该 Project 的 Issues 表面，**Then** 仍可浏览外部 Issues 并按既有合同创建或打开对应 Task。

### User Story 5 - 在一个详情页理解并监督 Task (Priority: P1)

作为正在监督生产执行的 Mystra 操作者，我希望从 Tasks 工作台、Kanban card 或 sidebar 快速入口进入同一个 Task 详情页，并把 Task 身份、执行内容和属性清楚分层，以便不在多个互相竞争的 panel 中寻找当前状态、Session、Workspace 与外部上下文。

**Why this priority**: 列表只能帮助操作者定位对象；Task detail 才是监督单个生产意图、查看执行上下文和进入 Session 的稳定入口。详情页若继续把可编辑字段、状态、Workspace 与 Sessions 平铺成同权重 cards，重要性会退化为边框数量。

**Independent Test**: 从 Table row、Kanban card 与 Active Tasks 分别打开同一个 fixture，验证 route 与 Task ID 一致；在 1440px、1024px 与 768px 宽度下验证 shell 主内容与全局 Right Panel，在 320px 下验证全局窄屏顺序；确认 header breadcrumb、New Session、New Task/Search、Project/Issue/Metadata Labels 与 Sessions 均使用共享组件并保持键盘可达，且 Main 在 Sessions 之前没有 page-local identity、Production、TaskExecutionAttempt 或 Workspace 内容。

**Acceptance Scenarios**:

1. **Given** 同一个 Task 同时出现在 Table、Kanban 与 Active Tasks，**When** 操作者从任一入口打开它，**Then** 系统进入相同 Task detail route，且 shell 主标题栏中的 arrow-separated breadcrumb 使用 Task name，Task ID、title 与 status 仍对应同一个对象。
2. **Given** Task detail 已加载，**When** 操作者扫描首屏，**Then** shell header 负责 Task name，Main 直接从共享 Sessions stacked list 开始；Main 不重复 title、description、`status`、Production、TaskExecutionAttempt 或 Workspace，Project、Issue、Metadata、Task ID、时间与 Status history 仍位于全局 Right Panel。
3. **Given** Task detail Main 已渲染，**When** 操作者从顶部开始键盘或视觉扫描，**Then** 第一个内容集合就是 Sessions rows，且不存在 page-local Edit、Start、Workspace setup 或 action header；New Session 只出现于 shell Main Header 右侧。
4. **Given** viewport 无法容纳 shell 主内容与 Right Panel，**When** 全局 shell contract 响应式收窄，**Then** 主执行内容先于 Right Panel 顺序堆叠，不出现横向页面溢出，也不隐藏全局 New Task/Search。
5. **Given** Task 有 Project、Issue 与 Metadata，**When** 属性侧栏呈现这些值，**Then** Project 使用持久化的 provider-stable repository external ID，Issue 使用持久化的 exact `identifier`，Metadata 使用 Task 对象内部的原始 key/value，并由前端决定展示顺序；三者复用共享 `UiLabel`，Project/Issue 使用 provider icon。不得为显示目的保存 repository/Issue snapshot。日期语义使用 `<time>`，但继承属性值的标准 typography。

---

### User Story 6 - 选择 Provider 并自动进入 Session (Priority: P1)

作为正在监督 Task 的 Mystra 操作者，我希望从 Task detail 的主 Header 打开一个精简的 Create Session Modal，只填写本次 Session 的提示词并选择 Provider；首次 launch 应根据 Provider 解析 Runtime、原子锁定 Task 的 Runtime Context，再查找 `<Task, Runtime>` Workspace、缺失时自动初始化，并在 ready 后自动创建及进入 Session。后续 Session 必须留在该 Task 已锁定的 Runtime，使 Workspace 不成为用户需要理解或预先操作的前置步骤。

**Why this priority**: Task 已支持 `0..N` Sessions，且真实 API 已提供 Human-owned 手动 launch；若新版详情只允许打开既有 Session，操作者会失去已实现的核心执行入口。入口必须属于当前 Task surface，而不是混入全局 New Task 或 Sessions 列表正文。

**Independent Test**: 打开一个具有 Project 且 `runtimeId=null` 的 Task detail，使用 Header 右侧 New Session 打开 Modal，在 body 的唯一 Prompt input 填写提示词、在 footer 左侧选择 Provider，并用 footer 右侧 Create 提交；验证生产实现只提交 Provider 与 canonical `manualContext.text`，由服务端解析 Runtime、原子写入 Task `runtimeId`，并省略/null `agentId`。再从 Workspace absent、queued/preparing、ready、failed-retry 与 Provider unavailable 条件验证：请求自动创建或复用精确 `<Task, Runtime>` Workspace，非 ready 时返回可轮询的 accepted 结果而不是业务错误，最终只创建一个 Session；后续 launch 只能使用已锁定 Runtime 上 available 的 Provider，且 Task `runtimeId` 不可改写。`TaskWorkspace` 仍以 `(taskId, runtimeId)` 唯一，为未来跨 Runtime 同步保留独立副本能力，但 054 不允许后续 Session 切换 Runtime；UI 全程不显示 Workspace 状态或 setup action。

**Acceptance Scenarios**:

1. **Given** Task detail 已加载，**When** 操作者查看 Main Header，**Then** New Session 作为当前 surface 的 compact ghost action 出现在右侧；Right Panel 收起时，其恢复按钮仍是 controls group 的最后一项。
2. **Given** 操作者激活 New Session，**When** Modal 打开，**Then** header 标题逐字为 `Create Session` 且只包含统一 Close control；body 只包含一个 aria-label=`Prompt` 的提示词输入；footer 左侧是平台当前可解析的 available Provider dropdown，右侧是文案逐字为 `Create` 的 primary action。Runtime、Workspace 与 Agent Context 的可见文案、只读行、dropdown 或 placeholder 数量均为 0。
3. **Given** Task 尚未锁定 Runtime 且操作者完成合法输入，**When** 提交 Create，**Then** 系统将 Prompt 展示值映射到 canonical `manualContext.text`，省略/null `agentId`，按 `providerKey` 解析 Runtime，并在同一短事务中仅当 `runtimeId=null` 时写入 Task；随后查找精确 `<Task, Runtime>` Workspace，不存在则自动创建，failed 则自动重试，queued/preparing 则复用并等待，ready 后创建 Task-bound Session。并发首发只能有一个 Runtime 胜出。UI 不新增 `prompt` domain field，也不直接调用 Workspace setup API。
4. **Given** 精确 `<Task, Runtime>` Workspace 尚未 ready，**When** launch 被接受，**Then** API 返回可轮询的 accepted launch，而不是 `workspace_missing`/`workspace_not_ready` 用户错误；UI 显示 Session 正在启动并轮询同一个幂等 launch，ready 后自动进入服务端返回的 Session detail。
5. **Given** Provider 无法解析到支持 Task repository materialization 的 online Runtime，或自动 setup/retry 最终失败，**When** launch 无法继续，**Then** Modal 保留输入并只展示 Provider/Session 启动失败；不得要求用户准备、重试或理解 Workspace。
6. **Given** Modal 已打开，**When** 操作者按 Escape、点击 header Close 或点击 backdrop，**Then** Modal 关闭且焦点回到 New Session action，Task route 与已填写持久状态均不改变；footer 不渲染重复的 Cancel action。
7. **Given** launch API 返回错误，**When** Modal 呈现失败，**Then** Modal 保持打开、保留当前输入并显示可理解错误；Sessions 列表、Task 状态与 TaskExecutionAttempt 均不被本地乐观伪造。
8. **Given** Task 已有不可变 `runtimeId`，**When** 操作者发起后续 Session，**Then** 服务端不得重新选择或改写 Runtime，只能验证所选 Provider 在该 Runtime 上 available 并复用该 Runtime 的 Task Workspace；Provider 不可用时返回稳定失败，不能静默切换到另一 Runtime。

### Task 详情主区域 UX/Data Design

本节核对 Production、Sessions、Workspace 的数据边界，但当前 prototype composition 只在
Main 渲染 Sessions。Shell、breadcrumb、
Right Panel 收展、Right Panel Properties、Status history 与全局 typography 继续由其
原 owner 维护；本节不得借“页面统一”之名修改这些表面。

#### 信息架构与 composition

1. Main 不再拥有 page-local identity、Production、TaskExecutionAttempt 或 Workspace composition。
   `taskDetailPrototype` 根节点保持 `padding: 0`，由 shell Main 唯一提供页面级 `8px`
   outer inset；Main 的第一个且唯一内容集合是 Task 关联的 Sessions。
2. Sessions 直接使用 `packages/ui` 已有 `StackedList`、`StackedListRow`、
   `StackedListField` 及其 shared helper row。不得新建 table wrapper、复制
   `<table>/<thead>/<tbody>` anatomy、模拟 column header，或使用 page-local grid
   重写同一 row contract。每个共享 row 本身是可聚焦的 Session detail navigation。
3. 列表默认使用 helper row 显示当前已加载 Session 数量。row field order 固定为：
   左侧 Session state（带 icon 的 label、跨 rows 等宽）、Provider（provider icon）、
   name slot；右侧 Runtime（label，默认 hidden）、Updated（datetime）。当前 canonical
   `Session`/list API 没有 title，因此 name slot 必须显示完整 `Session.id`，不得截短、
   添加 `Session ` 前缀或在 mock 增加 `title`。真正的 Session Title 需要另一个
   source-authoritative contract，属于未决问题。
4. 共享 row 保持既有 stacked-list density，内部 gap 沿用 8px/4px 基线。stacked mode
   中左侧最后一个 field/name slot 必须 `grow` 并占用左右固定 fields 之间的剩余宽度，
   spacer 只保留最小 gap；列表可在自身 viewport 横向滚动，不制造 page-level overflow，
   不新增全局 typography 规则。
5. Humanlayer 截图只提供 Session 列表的视觉密度参考。其上方 identity/actions、组织共享、
   artifact tabs、命名 Session、目录路径、Draft/Idle/Done 状态和多种彩色 session
   type tags 都不是 Mystra 数据合同，禁止照搬。

#### 关系、查询与字段映射

| Section / card | 权威实体与关系 | Canonical query / projection | 可显示字段 | 明确禁止 |
| --- | --- | --- | --- | --- |
| Production / Task state | `Task 1`；`status` 是 Task business state；`runtimeId` 是 nullable、首次 Session launch 原子写入后不可变的 Task Runtime Context | `GET /api/tasks/:id/production` 的 `task`；基础身份可来自 `GET /api/tasks/:id` | Right Panel 可只读显示已锁定 Runtime；当前 Main 不渲染 | client create/PATCH 设置 `runtimeId`；后续 launch 改写 Runtime；在 Sessions row 推断、同步或复制 Task 状态；Task `failed/error` |
| Internal production attempt | `Task 1 -- 0..1 TaskExecutionAttempt`；当前 v1 `TaskExecutionAttempt.taskId` unique；`TaskExecutionAttempt 1 -- 0..1 Session`。它是 Start 后、Session 创建前保存冻结输入与幂等关联的内部协调记录，不是操作者管理的产品对象 | production projection 的 `attempt`、`latestSession`、`promptEvidence` | 当前 Main 不渲染；不把 TaskExecutionAttempt facts 塞进 Session row | 导航入口、用户创建/编辑、`currentAttempt`、attempt sequence、attempt status、把 latest Session 当作 current Session |
| Workspace | `Task 1 -- 0..N TaskWorkspace`，`(taskId, runtimeId)` 唯一；Workspace `1 -- 0..N WorkspacePreparationAttempt`，attempt 不是顶级业务对象；当前 Session 路径只使用 Task `runtimeId` 对应的 Workspace；其他 Runtime 副本仅为未来同步保留 | 首次 launch 内部按 Provider 解析并锁定 Runtime；后续 launch 直接使用 Task `runtimeId`，再按 `<Task, Runtime>` 解析 Workspace；Workspace API 仅供内部/诊断调用 | 当前 Main 不渲染；不把 Workspace facts 塞进 Session row | 用户可见 setup/retry、后续 Session 切换 Runtime、host absolute path、opaque `workspaceRef`、credential、虚构 repository full name、把 Workspace state 当 Session state |
| Sessions | `Task 1 -- 0..N Session`；每个 Session 独立保存 Runtime、Provider、optional Agent Context reference 与 execution state；TaskExecutionAttempt 最多只引用其中 `0..1` | `GET /api/tasks/:id/sessions?limit=50&cursor=...` 原样返回 `Session[]`；Runtime 显示名可由既有资源查询解析，缺失时回退稳定 ID | helper count；左 `state` icon label（等宽）、`providerKey` provider icon、完整 `Session.id` name；右 Runtime `UiLabel`（默认 hidden）、`updatedAt`；row navigation 到 Session detail | 截短 Session ID、`SessionSummary`/`TaskSession` DTO、mock `title`、objective label、completedAt、terminal summary、Workspace path、根据数组位置虚构 current/latest badge |

`latestSession` 只是 production API 按既有 Session 排序取得的最新一条读取投影，
不建立 `Task.currentSessionId` 或 `Task.currentAttempt` 字段。Sessions 列表的稳定 identity
必须使用数据库 Session UUID 作为 React key 和链接目标，不得使用数组 index。

#### 状态与空态

- **Production / Task、internal TaskExecutionAttempt record、Workspace**：合同仍按上述边界独立存在，但当前 Main
  不渲染其状态、空态或 action，也不得把这些事实转写成 Session badge/copy。
- **Sessions**：逐字采用 `queued | dispatched | message_pending | running | ready |
  interrupted | waiting_for_handoff | closed | failed`。`ready` 表示当前 response 已结束、
  Session 可继续，不得显示为 Completed；只有 `closed`/`failed` 是 Session 终态。
- **Sessions empty**：查询成功且数组为空时显示“No sessions yet”。New Session 保持在
  shell Main Header，不复制到 empty state 或 Sessions section。Loading、empty、filtered
  no-results 与 request error 必须是不同状态。
- **独立失败**：Session failed 不得自动改变或暗示 Task、TaskExecutionAttempt、Workspace 状态；
  后三者未在 Main 呈现不等于它们不存在或已成功。

#### Actions 与 actor ownership

| Action | 条件 | Actor / owner | 状态副作用 |
| --- | --- | --- | --- |
| Start production | Task=`pending`，Project/Runtime/Provider 前置条件满足 | Human；canonical Task production command | 原子 `pending -> in_progress` 并创建唯一 TaskExecutionAttempt；提交后请求 Workspace preparation，ready 后幂等创建 attempt 的 `0..1` Session |
| Report Needs handoff / resume | `in_progress -> blocked` 或 `blocked -> in_progress` | 当前 attempt 的 Agent capability | 只改变 Task business state；不隐式控制 Session |
| Resume / Mark completed / Cancel | blocked 时 Human 可 resume 或 mark completed；任意非终态 Human 可 cancel | Human | 仅执行 FR-040 allowlist；`done/canceled` 终态 |
| Setup / Retry Workspace | 精确 `<Task, Runtime>` Workspace absent 或 `failed` | Session launch orchestration；不是 Human action | 自动创建/重试内部 Workspace，不单独改变 Task business state |
| New Session | Task 有 Project，选择 available Provider；首次 Runtime 与 Workspace 由服务端解析，后续 Runtime 来自 Task lock | Human Task Session action | 首次原子写入不可变 `Task.runtimeId`，自动解析或初始化 `<Task, Runtime>` Workspace，ready 后创建 Task-bound Session；pending Task 同一命令原子进入 `in_progress` 并建立 TaskExecutionAttempt；后续 Session 不得切换 Runtime；Workspace 过程不暴露给用户 |
| Open Session | Session row 存在 | Human navigation | 无 mutation；共享 row 进入 `/sessions/:id` |

Prototype 没有真实 mutation/API：New Session Modal 可完整演示字段选择、关闭与焦点返回，
但 Launch 只能停在 API dispatch 边界，不得向列表追加 mock Session、伪造成功或假装进入新
Session。真实 success/error journey 由 production API、component 与 browser tests 验证。

#### 当前 prototype 必须移除的 datamodel 不一致表达

- 删除 “current execution attempt” 与 “current Session”；当前合同只有 singular
  `0..1 TaskExecutionAttempt`、`0..N Sessions` 和可选 `attempt.sessionId`，没有 current 字段。
- 删除 “Agent is working in the current Session”；Task=`in_progress` 不能证明任一
  Session=`running`。
- 删除 `attempt 01`；TaskExecutionAttempt 没有 sequence 或展示编号，必须使用 attempt UUID。
- 删除 Session raw state `Completed`；fixture 改用 canonical `ready` 或 `closed`，并
  让 UI 明确区分二者。
- Sessions 文案不得声称列表记录本身“attached to shared Workspace”；列表 API 只
  返回 `Session[]`，Workspace attachment 是每次 launch 的事件证据。
- Workspace 删除虚构的 repository full name、目录式 `worktrees/...` 和 7 位 mock
  commit；改用 `TaskWorkspaceView` 的 `configuredBaseBranch`、合法 40/64 hex
  `baseCommit` 与 `branchName`，且只把 commit 缩写作为 renderer 结果。
- 主区域 fixture 的 Task/TaskExecutionAttempt/Workspace/Runtime/Session identity 必须使用 UUID；
  `MYS-118` 只能作为 Issue identifier。Right Panel 现有 route fixture 的 ID 表达不在
  本独立任务修改范围，必须作为原 task 的待办而不是在主区域复制。
- 删除 Main 中 Sessions 之前的 page-local Task identity、Production/TaskExecutionAttempt 卡和
  Workspace 卡；这些内容既不迁移到 Sessions row，也不由本任务改写 Right Panel。
- 删除本任务新增的 `UiTable` wrapper、native table anatomy、caption 与 column header；
  Sessions 必须复用现有 shared stacked-list composition。
6. **Given** 全局 Right Panel 已展开，**When** 操作者激活其 header 中的收起按钮，**Then** Right Panel track 被移除且 Main 立即回收宽度；主 header 最右侧出现可访问的展开按钮，恢复后该按钮回到 Right Panel header。此状态由 shell layout 持有，详情页面不得自行实现。

### Edge Cases

- 053 Overview 尚未可用时，054 先提供明确的 Overview placeholder；placeholder 不复制 053 查询、指标、空态或 mock 数据，053 可用后在同一路由直接替换。
- sidebar 展开与收起状态切换时，不能同时留下两组可聚焦的 New Task/Search 控件；视觉隐藏的副本必须同时退出辅助技术与键盘导航。
- New Task modal 与 Search dialog 不能同时处于可交互状态；打开其中一个应关闭另一个或阻止第二个打开。
- modal 提交过程中关闭、重复点击或按 Enter 不得创建重复 Task；失败后保留已输入内容以便重试。
- 当前 Team 没有 Task、只有终态 Task、或活跃 Task 数量超过 sidebar 可视高度时，完整列表与快速区必须分别显示正确空态并保持独立滚动。
- Task 在列表加载后发生状态更新时，Tasks 工作台与 sidebar 快速区应在下一次既有数据刷新后收敛，不显示永久矛盾状态。
- Kanban 某个状态没有 Task 时仍应表达该状态列或提供一致的隐藏空列策略；第一版不允许从空列创建或拖入 Task。
- Project 或 Issue 外部读取不可用时，Task 仍显示其 Mystra-owned title、status，以及 Project 的 provider-stable `repositoryExternalId` 和 Issue exact reference 的 `identifier`；不得缓存或回退到 repository/Issue snapshot，也不把外部读取失败解释为 Task 不存在。
- 一个 Task 的 `metadata` 为空、包含多个 entries 或序列化值过长时，堆叠行必须保持 Name 可读，并以明确空值、截断或受控折叠表达 Metadata；不得从外部 Issue/Project metadata 临时合并进 Task。
- Kanban card 的 Label 集合在初次布局、横向浏览、viewport resize 或字体宽度变化后必须按当前实际可用宽度重新计算；当任何 Label 都无法与 overflow control 同时完整容纳时，只显示 `+N`，不得依赖固定显示数量猜测空间。
- Display 隐藏或显示字段不得改变 `equalWidth` 配置是否合法；合法性按完整的 canonical field order 判断，避免同一配置随可见性切换而忽然改变布局合同。
- 搜索、筛选、异步追加或字段显隐改变当前展示 rows/cells 后，`equalWidth` 的 resolved width 必须按新展示集合的最大自然内容宽度重新计算；不得保留不再对应当前集合的像素常量。
- 首批 Task 加载完成后若还有更多记录，列表应以异步追加方式继续加载并保持当前滚动锚点；不得突然插入分页页脚。
- 320px 窄屏下，基础动作必须保留；Tasks Table 可以横向滚动，Kanban 可以横向浏览，但不能遮挡页面 header 或关键对话框操作。

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 已登录产品根入口 MUST 归属 Overview surface。Feature 053 尚未可用时，054 MUST 提供明确的 Overview placeholder；placeholder MUST NOT 复制或伪造 053 的内容、查询、指标、mock 数据或空态。053 可用后 MUST 在同一路由以真实 Overview 替换 placeholder，不改变导航合同。
- **FR-002**: 主导航 MUST 提供 `Overview`、`Inbox`、`Tasks` 与 `Runtimes`；`New`、`Search` 与 `Issues` MUST NOT 作为主导航条目出现。
- **FR-003**: sidebar header MUST 提供语义明确、具有 tooltip 与可访问名称的 New Task 和 Search icon action。
- **FR-004**: sidebar 收起或在窄屏隐藏时，页面 header MUST 继续提供 Mystra logo、New Task、Search 与展开 sidebar 控制；logo/brand 与 action group MUST 沿用现有 shell header 间距，不得压缩成无分组的连续 icon。展开与收起状态同一时刻每项动作 MUST 只有一个可见且可聚焦的实例。
- **FR-005**: New Task 与 Search MUST 在当前页面上方打开 modal/dialog，不得先导航到独立页面。
- **FR-006**: `/new` 页面与直接访问合同 MUST 被移除；直接请求 `/new` MUST NOT 自动打开 modal，也 MUST NOT 重定向到 Overview。
- **FR-007**: Search MUST 保留当前 Team 范围的既有 Task 搜索和预览能力；本功能不把 Search 扩展为新的跨对象索引。
- **FR-008**: sidebar 下方的 Task 快速导航 MUST 保留，并且 MUST 只展示 `pending`、`in_progress`、`blocked` 的 Tasks。
- **FR-009**: 快速 Task 区 MUST 沿用当前前端按 Project 分组的结构，并保留 status icon、Task title、详情链接、`No project` 分组与独立滚动；`done` 与 `canceled` MUST NOT 出现。
- **FR-010**: 主菜单 `Tasks` MUST 打开 Team 范围的完整 Task 工作台；它 MUST 包含非终态与终态 Task，也 MUST 包含无 Project 或无 Issue reference 的 Task。
- **FR-011**: Tasks 页面内容区 MUST 直接呈现工作台 toolbar 与结果区域；MUST NOT 在列表上方增加 page title、说明、统计、view tabs 或其他介绍区域。页面名称只在既有 shell header 表达，shell header 与页面内容之间 MUST NOT 显示分割线。
- **FR-012**: Tasks 工作台 MUST 默认使用无 column-title 行的 stacked Table；Table/Kanban 布局切换 MUST 位于 Display 菜单内，不得作为 toolbar 上的独立 segmented control。
- **FR-013**: Table 与 Kanban MUST 使用同一 Task 查询范围和当前搜索、筛选、排序与字段显示条件；切换布局 MUST NOT 改变匹配集合。
- **FR-014**: stacked Table 每行默认 MUST 只显示六种字段，并复用 CastrelTable 的弹性行模型：左侧固定区为 Task `status` icon，grow 区为 Name，中间 spacer 吸收剩余宽度，右侧堆叠 Project、Issue、Metadata、Created At。Project、Issue 与 Metadata 保持自然宽度；只有符合 `equalWidth` 边缘连续性合同的字段可以使用跨行统一列宽，不得为其他右侧值设置固定宽度来伪装成无表头 column grid。所有相邻 list field 使用同一个 column-gap token；一个 Metadata group 内多个 `UiLabel` 的间距 MUST 与 Metadata group、Project、Issue 和日期之间的间距相同。点击任意 Task 行 MUST 打开 Task detail。
- **FR-015**: Display Properties MUST 按以下固定顺序呈现：Status（默认显示、锁定、左侧、`equalWidth`）、Task ID（默认隐藏、左侧、`equalWidth`）、Name（默认显示、锁定、grow）、Project（默认显示、右侧）、Issue（默认显示、右侧）、Metadata（默认显示、右侧）、Updated At（默认隐藏、右侧、`equalWidth`）、Created At（默认显示、右侧、`equalWidth`）。从行的最右边缘向内计数，Created At 是第一等宽字段，Updated At 是第二等宽字段。Updated At 与 Created At MUST 复用基础表格同一个 time field renderer、locale 与 format options；不得由 consumer 分别拼接相对时间和绝对日期文案。默认状态下不得显示 Task ID、Updated At 或其他字段；Issue 必须仍可由 Display checkbox 隐藏。
- **FR-016**: toolbar MUST 让静态 Search field 以 ghost 形式填满 Filter/Display/Refresh 以外的全部剩余宽度；Search 容器和 input 在 resting state MUST 没有边框、填充背景或私有定宽。Filter、Display、Refresh MUST 作为三个仅有 icon 的 ghost actions 右对齐，不显示按钮文字，并提供 tooltip 与可访问名称。toolbar 与 Table/Kanban 内容之间 MUST NOT 显示分割线。
- **FR-017**: shell header 与 Tasks toolbar 的 icon action MUST 共用 Mystra 的 16px icon grid、28px action box、round cap/join 与 `1.7` stroke 语法；同一 header/toolbar 中不得出现不同 SVG intrinsic size。实现 MUST 为缺失的 Filter、Display 与布局 glyph 扩展 Mystra icon set，而不是在消费页面散落第三方 icon。Refresh 请求期间 MUST 让同一个 refresh glyph 进入旋转状态，请求结束后恢复静态状态。
- **FR-018**: 所有 Task `status` icons MUST 在相同 24px viewBox 内使用相同 `r=9` 圆形基底，并在所有 sidebar、Table、Kanban、Search 与 Task surfaces 复用同一映射：`pending`（未执行 / Not started）为空心圆；`in_progress`（执行中 / In progress）为绿色精确半圆填充；`blocked`（待接手 / Needs handoff）为 warning 色实心圆内反色 handoff 箭头；`done`（已完成 / Completed）为蓝色实心圆内反色勾；`canceled`（已取消 / Canceled）为中性实心圆内反色叉。所有实心状态的内部 mark MUST 通过已定义的主题反色 token 清晰可见，不得引用未定义 token 而退化为无图案实心圆。MUST NOT 使用眼睛代表 review、循环箭头代表 in progress，或 error 红色/感叹号代表 `blocked`；颜色不得作为唯一状态信号。
- **FR-019**: Display MUST 使用 Mystra 默认 popup/dropdown surface、placement、outside click、Escape、focus return 与 `aria-expanded` 行为；popup 内容 MUST 通过标准 `UiSurfaceBody` 获得四边精确 8px 的主题 `popup-inset`，不得使用 16px panel inset、叠加内层 padding 或任何 page-local override。Table/Kanban MUST 使用标准 `UiSegmented` 选项并各自显示 16px layout icon。Properties MUST 使用与 sidebar 同密度的 24–28px ghost row，并以共享 `UiCheckbox` 作为每行前置的显隐状态控件；checkbox visual MUST 精确为 16×16px，不得继承 row hit target、浏览器原生尺寸或 consumer 私有 width/height/transform。MUST NOT 再用整行 selected navigation surface 或尾随 check icon 模拟 checkbox，也不得使用大间距 checkbox cards。默认必显字段使用 checked + disabled 表达约束，可选字段使用可交互 checkbox。
- **FR-020**: Project、Issue 与每个 Task Metadata key/value entry MUST 复用同一个 Mystra Label component。Label 的 key、value 与 `+N` overflow control MUST 使用标准 12px content text，集成 icon MUST 使用 16×16px 标准 icon slot；consumer MUST NOT 单独缩小 key 或 overflow text。Project Label 的文字 MUST 使用持久化的 provider-stable `repositoryExternalId`，并在其前显示 Project repository Integration provider icon；Issue Label 的文字 MUST 使用 exact Issue reference 已持久化的 `identifier`，并根据 provider 显示 GitHub 或 Linear icon。列表与详情 MUST NOT 为此读取或保存 repository/Issue snapshot；无 Project/Issue 时不得伪造 provider icon。
- **FR-021**: stacked Task rows MUST 使用 ghost row styling：resting state 无行间 divider、card border 或填充，hover/selected/focus 才显示必要 surface feedback。Tasks 工作台只在包含 toolbar 与 Table/Kanban 内容的整体外围显示一圈边缘线，不得用内部边线重复切割结构。外框 MUST 使用 Mystra `radius-panel` 与语义 `color-surface-panel`；surface MUST 与页面 `color-canvas` 可辨但保持低对比，不得使用 page-local 色值、阴影或更深的日志式 inset 表达。row hover 与 Label 等内层反馈 MUST 使用下一层语义 surface，不能因 panel 背景而失去可见性。
- **FR-022**: stacked Table MUST NOT 呈现 column-title/header row、记录数 footer、分页 footer 或分页器。超过首批查询范围的 Task MUST 使用保持滚动上下文的异步追加加载；具体批次大小由技术计划确定。
- **FR-023**: Mystra 基础表格体验 MUST 支持共享的 stacked/column presentation mode、left/grow/stack/spacer/right column groups、字段定义与显隐、stacked field `equalWidth`、行点击、可选行选择、toolbar slots、搜索、筛选、排序、加载/空/错误状态和异步追加能力；054 的 Tasks consumer MUST 使用 stacked mode，其他 consumer 可使用 column mode。
- **FR-024**: 基础表格 MUST 直接复用 Mystra 自有 design tokens、`UiAction`、`UiDropdownMenu`、`UiSegmented`、sidebar row、Label、field/surface primitives、Shell icon grammar、密度和可访问性合同；CastrelTable 与 Linear 仅作为交互参考，不得把 Castrel 业务 API、产品术语、CSS 或运行时依赖变成 Mystra 产品合同。
- **FR-025**: Task MUST 新增 Mystra-owned `metadata` 字段，并把它作为 Task 顶层 JSON object 的一部分贯穿 shared Task schema、SQLite/PostgreSQL Task row、RDB mapping、create/update inputs 以及 list/detail/create/update responses；默认值 MUST 为 `{}`。API MUST 在每个 `task` 对象内部返回 `metadata`，不得在 Task 外平行返回 `labels`，也不得创建 `TaskLabel` model、relation、`ordinal`、`normalizedKey`、`normalizedValue` 或派生唯一性列。Task PATCH 对 `metadata` 使用完整对象替换；New Task modal 可继续不暴露 Metadata editor并提交默认 `{}`。持久化 MUST 保留 caller 提供的 JSON，不做写入时大小写或 Unicode 规范化；前端 MUST 负责 Metadata entries 的展示顺序，顺序不是持久化合同。Tasks `query` 如匹配 Metadata，MUST 在查询时执行大小写不敏感比较（例如 `lower`/`tolower` 等 provider implementation），不得依赖预计算 normalized columns。
- **FR-026**: Kanban MUST 按 Task `status` 的五个值分栏，并在卡片中至少展示 Status、Name、Project、Metadata 与 Created At。每张 compact workbench card MUST 使用四边精确 8px 的主题 spacing inset，不得误用 12px generic content inset。每张卡片的 Name 区域 MUST 固定预留两行高度；不足两行时保留该高度，超过两行时在第二行末截断，使相同字段配置的卡片保持一致高度。卡片的 Project、Issue 与 Metadata entries MUST 由前端按 presentation order 组成同一个 Label 集合并使用共享 overflow primitive：组件 MUST 依据容器实际宽度和每个 Label 的自然宽度显示最长的完整前缀，并为未显示项保留一个同系列 `+N` control；激活后 MUST 通过标准全局 portal popover 列出全部被折叠属性，并支持 outside click、Escape、focus return、可访问名称与容器 resize 后重新测量。MUST NOT 以持久化 ordinal、固定数量、重叠、部分裁切、换行增高或 card-local popup 代替该行为。
- **FR-027**: Kanban 第一版 MUST 是只读布局；MUST NOT 通过拖拽、列内创建或卡片快捷编辑改变 Task `status` 或其他 Task 字段。
- **FR-028**: Table 与 Kanban MUST 允许打开同一个 Task detail，并对空状态、加载、错误、超长标题、空 Metadata 和缺失外部上下文提供等价且可理解的表达。外部读取失败时 MUST 继续使用 Project `repositoryExternalId` 与 Issue `identifier`，不得发起逐行外部解析、显示 mutable snapshot 或隐藏 Task。
- **FR-029**: New Task modal MUST 保留既有手工创建字段：必填 title、可选 description、可选 Project context；Issue 驱动创建仍属于 Project Issues 表面。
- **FR-030**: New Task modal MUST 使用标准 `UiDialogSurface` 承载 053 建立的共享 Section anatomy，并由标准 `UiSurfaceHeader`、`UiSurfaceBody`、`UiSurfaceFooter` slots 提供语义结构。composer surface MUST 只在最外层拥有一次主题 `space-2`（8px）inset，三个 slots MUST 移除各自的 padding 与 divider，并以同一个 `space-2` 作为唯一纵向间距；MUST NOT 使用 12px generic `content-inset` 或叠加 slot inset 制造额外留白。title input MUST 作为 header 主要内容、以 `Task name` 作为 placeholder，并使用主题 medium weight（比正文重、比 strong heading 轻）；header close MUST 使用标准 `UiDialogCloseButton` 与适配 16px icon grid 的 dismiss glyph。description MUST 位于 body，使用无边框、透明背景的 ghost textarea，并禁用用户拖拽缩放。当前唯一 Task 配置 Project MUST 位于 footer 并使用标准 `UiDropdown` 的 ghost variant；trigger 宽度 MUST 由内容/owning row 自然决定，不得由 054 设定私有固定宽度；menu MUST portal 到全局 popup layer，根据 trigger 与 viewport 浮动定位，不得参与、撑开或被裁切于 modal content flow，同时保留 No project、可用 Project、repository 描述、选中回显、outside/Escape/Arrow/Home/End/Tab 行为。Project trigger 与提交 action MUST 都使用共享 `inline` action size，其标准高度为 20px，从而在 28px footer row 内保留上下各 4px 空间；提交 action MUST 使用 solid `UiButton`，且可见文案必须为 `Create`。其余容器、字段与配置 action MUST 使用 Mystra ghost styling。
- **FR-031**: New Task modal MUST 支持明确的关闭/取消、提交中状态、字段错误、请求失败重试和键盘焦点约束；取消 MUST NOT 创建 Task 或改变当前页面。
- **FR-032**: Task 创建成功后，系统 MUST 关闭 modal、刷新 shell/Tasks 使用的 Task 数据并导航到新 Task detail。
- **FR-033**: Tasks 页面 MUST NOT 为满足 054 再增加一个专用 New Task 按钮；空态可以提示操作者使用始终可见的 header New Task action。
- **FR-034**: 全局主菜单 MUST 移除 Issues；Project 内既有 Issues tab/entry、provider scope、外部读取和 Issue-to-Task 行为 MUST 保持可用。
- **FR-035**: 054 不要求删除或重新设计现有 `/issues` 直接路由；其是否保留不是本功能的验收条件，Project 内入口是唯一要求继续公开的导航表面。
- **FR-036**: 所有新增或迁移的 icon、view switch、table controls、cards、rows 与 dialogs MUST 支持键盘操作、清晰焦点、可访问名称和状态公告。
- **FR-037**: 展开 sidebar、收起 sidebar 与 320px–1440px 宽度 MUST 保持一致的信息层级；布局压缩不得移除 Mystra logo、New Task、Search、Overview 或 Tasks 基础入口。
- **FR-038**: 基础表格的 stacked field definition MUST 提供布尔属性 `equalWidth`。启用后，该 field MUST 以当前实际展示 rows 中该 field 的最大自然内容宽度解析自身的 shared track width，并把该宽度应用到当前展示集合的所有同 field cells；field 与下一 field 之间仍只使用基础表格的标准 column-gap token，resolved width 不得包含或重复该 gap。不同 `equalWidth` fields 之间不要求具有相同数值，也不得用预设像素常量代替内容测量。搜索、筛选、字段显隐、数据刷新或异步追加改变展示集合后 MUST 重新解析。`renderType: icon` 的 field MUST 默认 `equalWidth: true`，其他 field 默认 false。显式或默认启用后的等宽字段，在完整 canonical field order 中只能组成 left group 从最左边缘开始的连续前缀，或 right group 到最右边缘结束的连续后缀：左侧字段之前或右侧字段之后一旦出现非等宽字段，该方向不得重新出现等宽字段。Display 的字段显隐 MUST NOT 改变该校验结果；不满足连续性约束的 field configuration MUST 被组件明确拒绝，而不是静默降级或重排。
- **FR-039**: 054 MUST 直接采用五态 Task `status` 合同：`pending`（未执行）、`in_progress`（执行中）、`blocked`（待接手）、`done`（已完成）、`canceled`（已取消）。现有 `productionStatus` field、`production_status` column、`taskProductionStatusSchema`、`TaskProductionStatus` 与同义复合命名 MUST 分别替换为 `status`、`status`、`taskStatusSchema`、`TaskStatus` 和简洁的 Task-status 命名；Task/API/RDB/CLI/UI MUST 使用同一字段名。`waiting_for_review` MUST 从 Task 状态枚举、迁移合同和所有 Task UI 中移除。作为 pre-0.1 直接替换，不得保留 `productionStatus` alias、双读、双写或展示层映射；原有 review handoff 语义并入 `blocked`。`blocked` MUST 表示“执行权需要 handoff 给 Human”，而不是 error 或单一阻塞原因，并继续要求非空 note。Review、授权、等待回答、等待信息等细分原因属于后续结构化 handoff reason，不得在 054 中重新扩展顶层状态。
- **FR-040**: 五态迁移 MUST 延续 actor ownership：Assign/Start 只执行 `pending -> in_progress`；Agent 可执行 `in_progress -> blocked` 与 `blocked -> in_progress`；Human 可执行 `blocked -> in_progress|done`，并可将任意非终态 `pending|in_progress|blocked` 置为 `canceled`；`done` 与 `canceled` 为终态。Task MUST NOT 提供 `error` 或 `failed` 状态，Session/TaskExecutionAttempt 的执行失败事实不得自动改变 Task `status`。
- **FR-041**: 054 interactive prototype MUST 运行于独立 Spec Prototype app，但 MUST 与生产 Control Plane 直接依赖同一个 Mystra UI package 和 theme stylesheet。标准 action、field、surface、dialog、dropdown、popover、segmented control、icon、logo、Label、stacked list 与 shell layout class contract MUST NOT 在 prototype 中复制实现；缺失的共享能力 MUST 先加入共享 package，再由 production 与 prototype 同时消费。Prototype 只允许保留 mock data、feature composition 与尚未成为通用合同的局部布局。
- **FR-042**: 基础表格的标准 field definition MUST 要求显式 `renderType`，第一版标准白名单固定为 `text`、`datetime`、`icon`、`labels`。`labels` 在这里仅表示 `UiLabel` 集合的 presentation renderer，不是 `TaskLabel` 领域类型。`text` 与 `datetime` 只允许在 value renderer、语义元素和格式化行为上不同，最终文字 MUST 与 Name 共用相同的 font family、font size、font weight、line height 与 text color；Task ID、Created At、Updated At 或其他 consumer MUST NOT 通过 standard field 的 `className`、私有 selector 或 render type variant 改变这些 typography properties。`icon` 与 `labels` 由各自共享 primitive 持有非文字 anatomy。确需特殊 presentation 时 MUST 使用显式 `renderType: custom` 与独立 `StackedListCustomField`，不得向标准 render type 添加页面级样式逃生口。
- **FR-043**: Task detail MUST 由 Table row、Kanban card 与 sidebar Active Tasks 使用真实 link/button 导航到同一 Task object route；不得只通过手输 URL、不可聚焦 card click handler 或复制出的 review-only route 才能到达。Prototype route MUST 为 `/054-navigation-task-workbench/tasks/:taskId`，生产迁移目标仍为既有 `/tasks/:id`。
- **FR-044**: Task detail 首屏 MUST 以 Task `status` icon、24px title 与 12px description 形成主要身份区，并提供不长期暴露 form chrome 的 title/description 编辑状态。Task name MUST 作为 shell 主标题栏 breadcrumb 的当前节点；Task ID 只位于 Properties，不得替代 name 或与 title 争夺主标题层级。breadcrumb 层级之间 MUST 使用共享 16px right-chevron arrow，不得使用 page-local slash 或字符分隔实现。
- **FR-045**: Task detail MUST 把 Production、Sessions、Workspace 放入 shell 主内容，并通过全局 `UiShellRightPanel` layout contract 承载 Properties 与 Status history；不得在页面正文中再创建 `taskDetailAside`、局部双列 grid、复制 `rightPanel/rightPanelHeader/rightPanelContent` anatomy 或持有 panel collapse state。Right Panel header MUST 在最右侧提供收起按钮；收起后 Main MUST 回收 panel track，且主 header 最右侧 MUST 提供展开按钮。两处按钮 MUST 共享 `aria-controls`、准确 `aria-expanded`、可访问名称与同一 16px icon contract。窄屏顺序 MUST 由全局 shell contract 解析为主内容后 Right Panel，不得制造 page-level horizontal overflow。
- **FR-046**: Task detail MUST 复用 `PrototypeShell`/生产 shell contract、`UiBreadcrumb`、`UiSurface` section slots、`UiAction`、standard fields、`TaskStatusIcon`、`UiLabel`、provider icons 与语义 tokens。页面级 8px outer inset MUST 只由 shell Main layout 提供，详情 feature root MUST 为 `padding: 0`，不得重复 8px 形成 16px gutter；详情内部 section gap 和无关行内元素 gap MUST 为 8px，成组行内元素 gap MUST 为 4px，默认 row MUST 为 28px，inline controls MUST 为 20px。054 不得通过详情设计新增任意 status transition：actor ownership 与五态转换继续遵循 FR-039/FR-040；Prototype 中不可用的 mutation 必须 disabled 或只读，不得伪造成功。
- **FR-047**: `@mystra/ui` MUST 提供 arrow-separated `UiBreadcrumb`，shell 主标题栏布局 MUST 以内置可选 `breadcrumbItems` contract 消费该组件。页面只能声明 breadcrumb items；不得手写 `<nav>`、separator icon 或 breadcrumb CSS。页面不传 `breadcrumbItems` 时 shell MUST 隐藏 breadcrumb 并允许普通 title 或空标题状态。
- **FR-048**: breadcrumb 当前节点、Right Panel `Properties`、Task detail 的 Production/Sessions/Workspace section title 与 Status history title MUST 共用 12px compact heading token，其标准 weight MUST 为 500（正文为 400）。层级主要由 primary/secondary semantic color 与该一级 weight 差表达；这些标题不得使用 600 或更重的局部覆盖。
- **FR-049**: Task detail Main MUST 直接从 Sessions shared stacked list 开始；Sessions 之前和之外不得渲染 page-local identity、title/description editor、Production、TaskExecutionAttempt、Workspace、概览卡或 action header。New Session 只属于 shell Main Header 右侧，不形成 Main content action header。TaskExecutionAttempt MUST 只作为 Start/Workspace/Autopilot Session 链路的内部持久化协调记录，不得成为用户可见产品对象、导航资源、独立页面、创建/编辑入口或 TaskWorkbenchItem 字段。Production/TaskExecutionAttempt/Workspace 数据合同仍保留为 source-of-truth 约束，但本 composition 不显示、复制或迁移它们。054 MUST NOT 修改 breadcrumb、Right Panel 收展、Right Panel Properties、Status history 或全局 typography；FR-048 的 heading token 仅约束实际存在的 shared headings，不要求为 Sessions 新增 heading。
- **FR-050**: Task `status` MUST 继续被定义为 Task business state；internal attempt facts MUST 继续只来自 `attempt | null`、`latestSession | null`、prompt evidence 与 Runtime display resolution。TaskExecutionAttempt 只负责冻结可变启动输入、承载 assignment idempotency/capability identity，并在 Workspace ready 后幂等关联首个 Autopilot Session；它不拥有用户可见状态或生命周期。当前 Main 不渲染这些 facts，也不得把它们压入 Session row。任何实现 MUST NOT 引入、模拟或命名 `currentAttempt`/`currentSession` 字段，也不得从 Task `status` 推断 Session state。
- **FR-051**: Workspace MUST 继续逐字段服从 `TaskWorkspaceView` 及其 absent、queued、preparing、ready、failed、unavailable 与 transport loading/error 合同；当前 Main 不渲染 Workspace，也不得把 Workspace state/path/ref 复制到 Session row。Workspace/attempt failure 不得改变或被展示为 Task/Session state。
- **FR-052**: Sessions MUST 直接复用 `packages/ui` 既有 `StackedList` composition 与 shared helper row 呈现 `Session[]`，不得新建 table wrapper、复制 native table anatomy、伪造 caption/column header 或用 page-local grid 重写 row。默认 field order MUST 为左侧 Session state（带 icon 的 label，`equalWidth`）、Provider（provider icon）、name；右侧 Runtime（label，默认 hidden）、Updated（datetime）。helper row MUST 显示当前已加载 Session count。每个 row MUST 以 Session UUID 作为 stable key、完整 name 文本和可聚焦导航进入 Session detail；不得截短 UUID 或添加虚构标题前缀。当前 `Session` 无 title，MUST NOT 在 fixture/DTO 增加 Session title、SessionSummary/TaskSession view、objective、completedAt 或 terminal summary。
- **FR-053**: Sessions state copy MUST 覆盖 049 的九态，明确 `ready` 可继续而非 completed，`closed|failed` 才是终态。列表必须区分 loading、request error、empty、rows 与 next-cursor loading；Session/Workspace/TaskExecutionAttempt failure 与 Task status 必须独立并列。
- **FR-054**: Main content 内唯一 action 是 Open Session navigation。Start、Human Task transition 与 Workspace setup/retry 均不得在 Main content 出现。New Session MUST 位于 shell Main Header 右侧，打开 FR-059 Modal；不得与其他 action 互相冒充副作用或用本地 state 伪造成功。
- **FR-055**: Main-area prototype mock MUST 使用与 `Task`、`TaskExecutionAttempt`、`TaskWorkspaceView`、`RuntimeView`、`Session` 同名字段、canonical enum literal、UUID identity、ISO datetime、合法 Git branch/ref 与 40/64 hex commit。展示名、短 commit、状态文案和相对时间必须是 renderer 派生值，不得回写成 mock domain fields。
- **FR-056**: 主区域 feature root MUST 保持 `padding: 0`，页面级 `8px` outer inset 只由 shell Main 提供；Sessions MUST 原样采用 shared stacked-list 的 `42px` row density、`16px` icon 与既有 8px/4px internal gap，不得为满足通用 `28px` compact-row baseline 而在 feature 中覆盖该共享 component。054 不得新增 table primitive，不得改变全局 typography role、font family、font size scale 或 Right Panel density。
- **FR-057**: shell Main Header 右侧 MUST NOT 展示 username、avatar、TeamSwitcher 或 Account navigation。该区域只允许当前 surface action 与 shell-owned recovery control；Task detail MUST 显示 New Session，Right Panel 收起时其共享恢复按钮 MUST 排在 New Session 之后并保持 controls group 最后一项。
- **FR-058**: shared `StackedList` stacked-mode geometry MUST 让左侧最后一个 field/name slot 使用 `flex-grow` 消耗剩余宽度；其后的 spacer 仅保留 tokenized minimum gap，不得继续成为主要 grow track。该合同由 `packages/ui` 统一持有，Tasks 与 Sessions consumer 均不得用 feature-local CSS 覆盖。Provider icon MUST 按 canonical `providerNameSchema` 的 `codex|copilot` 映射到共享、可访问的品牌 glyph；`copilot` 不得回退为 generic automation icon。GitHub 自 2025 年起弃用旧 standalone Copilot logo，prototype 使用现行 Copilot product icon，不把旧 logo 或 mascot 当 provider mark。
- **FR-059**: New Session Modal MUST 复用 shared `UiDialogSurface` compact-row composition、`UiSurfaceHeader/Body/Footer`、`UiDropdown`、`UiTextarea`、`UiButton` 与统一 close control。Surface 只拥有一次 8px inset 与 8px section gap；header/footer MUST 是无独立 padding/divider 的 28px rows，不得表现为额外 padded container。Header 标题 MUST 逐字为 `Create Session`，且 Close glyph 是唯一 header action。Body MUST 只有一个 aria-label=`Prompt`、最多 `SESSION_TEXT_MAX_LENGTH` 的文字输入；该 input MUST 无边框、透明背景、不可 resize，并保留 placeholder `Session-only context, constraints, or a specific focus`。Footer MUST 左对齐必选 available Provider dropdown、右对齐文案逐字为 `Create` 的 solid inline action；两者为 20px controls。Runtime row、Runtime selector、Agent Context、intro/notice、Cancel 与 `Launch Session` 的出现次数 MUST 为 0。Modal MUST 支持 backdrop、Escape 与 Close，关闭后焦点返回 trigger；窄屏不得产生 page-level overflow。
- **FR-060**: Production launch MUST 使用当前 Task ID 调用 canonical Task Session API，生成/提交 UUID launch/session identity、必选 `providerKey`、省略/null `agentId` 与可选 trimmed `manualContext.text`。UI 的 `Prompt` 只是 `manualContext.text` 的 presentation copy，不得新增 `prompt` request/domain field。`runtimeId` 与 Workspace ID MUST NOT 由表单提交。Task MUST 新增 `runtimeId: UUID | null` 作为 Task Runtime Context；create/PATCH input MUST NOT 接受该字段。首次 launch MUST 按 Provider 从支持 Task repository materialization 的 online eligible Runtimes 中按稳定 Runtime ID 确定性选择，并在短事务内以 `runtimeId IS NULL` 条件原子写入；并发首发必须收敛到一个 Runtime。该字段首次写入后 MUST 不可变。后续 launch MUST 仅使用 Task 已锁定 Runtime，并验证所选 Provider 在该 Runtime available；不得重新选择、改写或静默 fail over 到其他 Runtime。服务端 MUST 按 `(taskId, runtimeId)` 查找 Workspace：absent 自动 setup，failed 自动 retry，queued/preparing 返回幂等 accepted，ready 幂等创建 Session。同一 Runtime 上不同 Provider MUST 复用同一个 Task Workspace。`TaskWorkspace` 继续允许不同 Runtime 的独立副本，为未来同步保留数据模型，但 054 的 Session path 不使用其他 Runtime；跨 Runtime 同步明确 deferred。成功 MUST 进入返回的 Session detail；等待期间 UI 只表达 Session 正在启动，不得显示 Workspace 状态或 setup/retry action。Provider/自动初始化/API 最终失败 MUST 保留 Modal 输入并显示可理解错误。Prototype MUST 停在 dispatch 边界，不得追加 mock Session 或伪造成功。

### Key Entities

- **Primary Navigation Item**: 表示具有稳定目的地的全局页面入口；054 后包含 Overview、Inbox、Tasks 与 Runtimes，不包含 New Task、Search 或 Issues。
- **Header Action**: 不改变当前页面即可打开全局能力的 icon action；054 定义 New Task 与 Search 两项，并根据 sidebar 可见状态在 sidebar header 或页面 header 中呈现。
- **Active Task Shortcut**: Team 范围 Task 的快速导航投影，只包含三种非终态 `status`，并按可选 Project context 分组；它不是完整 Tasks 查询或新的持久化对象。
- **Task Workbench View**: 同一 Team Task 集合的 stacked Table 或 Kanban 呈现以及当前搜索、筛选、排序和字段显示配置；第一版不要求服务器端保存自定义视图。
- **Table Field**: 基础表格中一个可呈现、筛选、排序或隐藏的数据属性描述；基础组件支持 stacked 与 column mode，Tasks consumer 只使用 stacked mode。stacked field 可通过 `equalWidth` 请求一个由当前展示 rows 的最大自然内容宽度解析、供这些 rows 共用但不与其他 fields 共用数值的 track width；该属性受左右边缘连续性约束。
- **Task Metadata**: Mystra-owned、Team-authorized 的 Task 顶层 JSON object 字段；随 Task 一起创建、读取和更新。它不是外部 Issue/Project snapshot，不产生独立 `TaskLabel` 对象，展示顺序由前端决定。
- **Task Runtime Context**: Task 顶层 nullable `runtimeId`。首次 Session launch 由服务端解析并原子写入，随后不可修改；后续 Session 必须在该 Runtime 上运行。它不是用户可编辑配置，也不把 Runtime 变成 Task 的 ownership parent。
- **New Task Draft**: modal 中尚未提交的 title、description 与可选 Project context；沿用现有按操作者与 Team 隔离的草稿行为，不形成新的业务实体。
- **Task Handoff**: `blocked` 状态表达的 Human 接手边界；当前仅以必填 note 记录上下文，不把 review、授权、问题或信息等待固化为顶层状态或结构化 reason。

## Scope Boundaries and Assumptions

- Feature 054 可以先于 053 落地，并在根入口提供无数据的 Overview placeholder；054 只拥有根入口、placeholder 与导航重排，真实 Overview 内容仍由 053 独占。
- “活跃 Task”固定表示 `pending`、`in_progress`、`blocked`；它不引入新的状态或派生持久化字段。
- 054 以 pre-0.1 直接替换方式收敛 051 的六态 Task 合同：删除 `waiting_for_review`，将其 handoff 语义并入 `blocked`，不创建兼容 alias、迁移 shim 或双写路径。技术计划必须同步 shared Task/TaskExecutionAttempt schema、迁移白名单、TaskStatusService、`mystra-agent`、标准执行 prompt、API/UI、RDB fixtures 与 tests。
- Tasks 是 Team-scoped 全局对象，Project 只是可选上下文；Table/Kanban 不得按 Project 所有权裁剪数据。
- 第一版不提供 Kanban 拖拽、状态快捷修改、批量状态更新、swimlane、保存/共享自定义视图或服务端视图偏好。
- 第一版建立 Mystra 基础表格并迁移 Tasks consumer；其他现有表格页面的批量迁移属于后续工作。
- Linear 的 list/board、group/order/display-property 分离是交互参考；Linear 的 Issue 字段、协作模型、快捷键全集和拖拽写入语义不进入 Mystra 范围。
- CastrelTable 的密度、toolbar、filter/display、grouping、selection 和 table/card 切换是代码与交互参考；Mystra 不承诺其 API 兼容或完整复制。
- 全局 Issues 菜单移除不改变 provider、Project Issue source、Issue-to-Task 幂等或外部数据所有权合同。
- 本功能不新增业务实体或 view preference 持久化模型，但会扩展现有 Task 合同与 Task row 以承载顶层 `metadata` JSON object；不新增 `TaskLabel`、关系表、ordinal 或 normalized 派生列。
- Owner 已要求 054 使用独立规格分支 `054-navigation-task-workbench` 完成实现前全部阶段；分支不改变 feature directory 的 canonical 所有权。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% 的已登录根入口验收用例首先显示 Overview surface；053 未落地时显示零伪造数据的明确 placeholder，053 落地后显示真实 Overview，且两种情况下均不显示或跳转 New Task page。
- **SC-002**: 在 sidebar 展开、桌面收起和 320px 窄屏隐藏三种状态下，操作者均可用一次点击或一次键盘激活打开 New Task 与 Search；每项动作在可访问树中只有一个实例。
- **SC-003**: 主导航审计中 `New`、`Search`、`Issues` 条目为 0，`Overview` 与 `Tasks` 各有且仅有 1 个稳定页面入口。
- **SC-004**: 对覆盖 Task 五种 `status` 和多个 Project context 的验收数据，sidebar 快速区对 `pending`、`in_progress`、`blocked` 的展示准确率为 100%，Project 分组准确率为 100%，对 `done`/`canceled` 的误展示为 0。
- **SC-005**: 对同一筛选数据集，Table 与 Kanban 展示的 Task ID 集合、总数和详情目的地保持 100% 一致；布局切换后搜索、筛选与排序条件零丢失。
- **SC-006**: 键盘操作者能够完成打开/关闭 New Task、打开/关闭 Search、进入 Tasks、切换 Table/Kanban、打开 Task detail 的完整路径，过程中无焦点陷阱或不可见焦点。
- **SC-007**: 在 320px、768px、1024px 与 1440px 视口检查中，两个 header actions、Overview、Tasks 和对话框主要操作均保持可用；Table/Kanban 溢出只发生在各自内容浏览区域。
- **SC-008**: New Task 成功、字段失败、请求失败、取消和重复提交五类验收路径均产生单一、可理解结果；重复提交测试创建的 Task 数量不超过 1。
- **SC-009**: Mystra 基础表格验收 fixture 证明 stacked/column mode、搜索、筛选、排序、字段显隐、异步追加、空/加载/错误状态与可选行选择均可由页面独立配置；Tasks consumer 默认只出现六个字段、零个 column-title row、零个 footer 和零个分页器。
- **SC-010**: 对 Refresh 的静态、加载和完成状态截图比较中，三个 toolbar actions 均为 Mystra ghost icon action；Refresh 在加载前后使用同一个 glyph，加载时持续旋转且完成后停止。
- **SC-011**: Task API/持久化合同 fixture 证明 `{}`、多个 key、嵌套 JSON value 与更新替换均通过 `task.metadata` 原样 round-trip；list/detail/create/update response 的每个 Task 都包含 `metadata`，Task 外 `labels`、`TaskLabel` relation、`ordinal`、`normalizedKey` 与 `normalizedValue` 的出现次数均为 0。
- **SC-012**: 五种 Task 状态在 sidebar、Table、Kanban 与 Search 中使用相同直径的圆形 icon family；`in_progress` 与 `done` 同时通过内部图案和绿色/蓝色区分，`blocked` 以 warning handoff glyph 表达待接手；眼睛、循环箭头、error 感叹号状态 icon 的出现次数均为 0。
- **SC-013**: Tasks 默认视图的边线与 surface 审计结果为：工作台外围 1 个使用 `radius-panel` 的闭合边缘线和 1 个 `color-surface-panel`；shell header 下方分割线 0 个，toolbar 与结果区之间分割线 0 个，Task rows 之间分割线 0 个，page-local 背景色和装饰性阴影均为 0。
- **SC-014**: 使用一行、两行和超过两行的 Task titles 验收 Kanban 时，所有相同字段配置的卡片高度一致；长标题只显示两行且无内容溢出。
- **SC-015**: New Task modal 的静态与键盘验收中，composer computed padding 四边均为 8px，Project trigger 与 Create action 的 computed height 均为 20px，footer row 为 28px；区域 divider 为 0，description resize handle 为 0，Project dropdown 可选择 3 个样例值且提交文案精确为 `Create`。
- **SC-016**: 使用长度不同的 Task ID、Updated At 与 Created At fixture 验收 stacked Table 时，同一 `equalWidth` field 在所有可见 rows 的 computed width 差值为 0px，且该值等于当前展示 rows 中该 field 的最大自然内容宽度；每个 field 与下一 field 的 computed gap 等于标准 column-gap token。搜索到较短集合、重新显示完整集合及异步追加更长值后，resolved width 均正确缩小或扩大。Status icon field 默认进入左侧等宽前缀，Task ID 紧随其后，Created At 与 Updated At 从右边缘向内形成等宽后缀。至少覆盖一个中间字段错误启用 `equalWidth` 的 invalid fixture，并验证组件明确拒绝该配置。
- **SC-017**: Updated At 与 Created At 的 renderer fixture 使用相同 timestamp 输入合同、locale 和 format options，输出形态一致；054 prototype 的 12 个样例 time cells 均使用同一 renderer，`ago`/`Yesterday` 与 `MMM D` 混用次数为 0。
- **SC-018**: `@mystra/ui`、生产 Control Plane 与 Spec Prototype 三者 typecheck 均通过；静态依赖审计确认生产和 prototype 各只有一个共享 theme stylesheet 入口，prototype 中手写复制标准组件 SVG 或 DOM anatomy 的数量为 0。
- **SC-019**: 使用 0、1、3、10 个不同宽度 Metadata entries，并在至少三种 Kanban card 宽度下验收：前端 presentation order 稳定且不依赖持久化 ordinal；可见 Labels 均完整且互不重叠，`+N` 数值与隐藏项数量 100% 一致；最窄情形只显示 `+N`，popup 完整列出所有隐藏项；扩大卡片后可见前缀自动增长且 `+N` 相应减少或消失。
- **SC-020**: 同时显示 Name、Task ID、Updated At 与 Created At 后读取四者 computed typography，font family、font size、font weight、line height 与 text color 的差异数量为 0；标准 field API 对未列入 `text|datetime|icon|labels` 的 render type 产生 TypeScript 错误，只有 `renderType: custom` 可交给 `StackedListCustomField` 自定义 presentation。
- **SC-021**: 同一个 Task fixture 从 Table、Kanban 与 Active Tasks 打开后，三个入口的最终 `taskId` 与 detail route 匹配率为 100%；每个入口均使用可聚焦的 button/link，键盘 Enter 可完成导航。
- **SC-022**: Task detail 在 1440px 下呈现 sidebar、Main、全局 Right Panel 三列，在 1024px/768px 下呈现 Main 与全局 Right Panel，在 320px 下按 Main 后 Right Panel 堆叠；四个 viewport 的 page-level horizontal overflow 均为 0，title、New Task、Search 与 New Session 均保持可见可达。Shell Main 是唯一 page-level 8px inset owner，Task detail feature root computed padding 为 0px，section computed gap 与 Right Panel content computed padding 为 8px；主要 title 为 24px，section title/description/body 为 12px，Open Session row navigation 保持 shared row density，Header New Session 高度为 28px。
- **SC-023**: Task detail 静态依赖审计确认 shell、`UiBreadcrumb`、surface sections、actions、status icons、Project/Issue/Metadata Labels 均来自 `@mystra/ui`，feature component 中手写 `<nav>`、breadcrumb separator、局部 `taskDetailAside`、SVG、复制 standard component DOM anatomy 或 page-local raw color 的数量均为 0。
- **SC-024**: 展开 Right Panel 时，其 header collapse button 的 `aria-expanded=true`；收起后 shell 不再保留第三列，Main computed width 增加，主 header 最后一个 control 的 `aria-expanded=false` 且可恢复同一 panel。两种状态中重复 Right Panel DOM anatomy 和 page-owned collapse state 的数量均为 0；breadcrumb 当前节点等于 Task name，Task ID 只在 Properties 出现；指定 compact headings 的 computed font-size/weight 均为 `12px/500`。
- **SC-025**: Task detail Main 在 1440px、768px 与 320px 的第一个且唯一内容集合均为 Sessions shared stacked list；Sessions 之前的 page-local identity、Production、TaskExecutionAttempt、Workspace、概览卡、caption、column header 与 action header 数量均为 0。列表只在自身 viewport 内横向溢出，page-level horizontal overflow 为 0。
- **SC-026**: fixture 静态 schema 审计中 Task/TaskExecutionAttempt/Workspace/Runtime/Session ID 的 UUID 合格率为 100%，ISO datetime、Git ref/branch 与 40/64 hex commit 合格率为 100%；主区域不存在 `currentAttempt`、`currentSession`、`attempt 01`、raw `Completed`、host absolute path、workspaceRef 或虚构 repository full name。
- **SC-027**: Sessions 100% 使用共享 `StackedList` composition 与 helper row；page-local `UiTable`、`<table>/<caption>/<thead>/<tbody>/<th>/<td>` anatomy 与 copied row grid 数量均为 0。helper count 等于当前 rows 数；field order/visibility 为左 state icon label（跨 rows 等宽）、provider icon、完整 Session UUID name，右 Runtime label hidden、Updated datetime visible。每个 row key/navigation target/name 使用同一 Session UUID；fixture 的 `title` 字段数量为 0，`ready` 文案明确可继续，`closed/failed` 文案明确终态。
- **SC-028**: 用 Task.status=`in_progress`+Session.state=`failed`、Task.status=`blocked`+Session.state=`ready`、Workspace.state=`failed`+Task.status=`in_progress` 三组 fixture 验收 presentation mapping 时，Sessions 只显示自身 state，不从未渲染的 Task/Workspace/TaskExecutionAttempt facts 自动映射 badge 或 copy；Task UI 中 `failed/error` status 出现次数为 0。
- **SC-029**: 主区域 CSS/组件审计确认 feature root padding 为 0、shared stacked-list row 保持其既有 42px minimum height、helper row 为 28px compact height、内部 gap 为既有 8px/4px token、icon 为 16px，并且新增 table primitive、全局 typography 与 Right Panel selector 的 diff 均为 0。
- **SC-030**: production AppShell 与 PrototypeShell 的 Main Header 中 username、avatar、TeamSwitcher 和 Account link 出现次数均为 0；Task detail Right Panel 展开时 Header right controls 只包含 New Session，收起时包含 New Session 与恰好 1 个共享 reopen control，且 reopen 始终位于最后。
- **SC-031**: shared CSS contract 审计确认 `.uiStackedListName` 的 grow factor 为 1、`.uiStackedListSpacer` 的 grow factor 为 0 且保留标准 minimum gap；Tasks 与 Sessions feature CSS 对这两个 selector 的覆盖数量均为 0。三条 Session row 的 state label computed width 差值为 0px，`codex` 与 `copilot` 均输出其共享 provider glyph，generic automation glyph 数量为 0，且 Session UUID 可见文本与 fixture 完整 ID 的匹配率为 100%。
- **SC-032**: Task detail 在 1440px、768px 与 320px 下均只显示一个 Header New Session action；Right Panel 收起时 recovery control 排在其后。Modal header/footer computed height 均为 28px，header/footer 自有 padding 与 divider 均为 0；header 标题为 `Create Session`，body 可交互元素只有 1 个 Prompt input，其 computed border width 为 0px、background 为 transparent、resize 为 none 且 placeholder 逐字匹配 FR-059；footer 顺序为左 Provider dropdown、右 Create。Runtime/Agent Context/Cancel/Launch Session/intro/notice 的 DOM 数量均为 0；Escape、backdrop 与 Close 均能退出并将焦点返回 trigger，page-level horizontal overflow 为 0。
- **SC-033**: production component/browser tests 覆盖 Workspace absent 自动 setup、queued/preparing accepted+poll、ready reuse、failed auto-retry、无可解析 Provider/Runtime 与 API error 六条路径；请求 100% 通过 shared launch schema。同一 idempotency key 的重放和 20-way 并发首次 launch 最终只写入一个不可变 `Task.runtimeId`、一个 `<Task, Runtime>` Workspace 与一个 Session；后续 launch 使用锁定 Runtime，所选 Provider 在该 Runtime 不可用时稳定失败且其他 Runtime Session 数为 0。测试可由内部 fixture 为同一 Task 建立另一 Runtime Workspace 以证明 composite identity 与未来 sync seam，但 054 Session path 不得使用它。成功导航使用返回 Session ID；DOM 中 Runtime selector、Workspace setup/retry control、Workspace not ready 文案与 Workspace 状态数量均为 0。
- **SC-034**: 使用同一批 Task fixture 在外部 provider 正常、超时和不可用三种条件下验收，Table、Kanban、Active Tasks 与 detail Properties 显示的 Project 文案均严格等于持久化 `repositoryExternalId`，Issue 文案均严格等于持久化 `identifier`；逐行外部解析请求数、repository/Issue snapshot 新字段数与因外部失败消失的 Task 数均为 0。

## Design Evidence

- Castrel source reference: `/Users/arcadia/Documents/castrel-ai/frontend/components/castrel/table/`，重点关注 `CastrelTable.tsx`、`types/table.ts`、filter/display controls、grouping、selection 与 table/card state sharing。
- Mystra shared UI baseline: `packages/ui` 是生产 Control Plane 与独立 Spec Prototype 的共同 theme/component source；`apps/control-plane/app/_components/app-shell.tsx` 保留生产数据/路由 adapter，`apps/spec-prototype` 只拥有 mock data 和 feature composition。
- Current lifecycle evidence: `packages/shared/src/task.ts` 与旧 `packages/shared/src/harness.ts` 仍包含 `waiting_for_review`；`apps/control-plane/src/lib/tasks/task-status-service.ts`、`packages/agent-cli`、标准执行 prompt、API/UI 与 tests 均消费该旧合同。054 必须一次性替换这些调用面并将 shared file/schema/type 收敛到 `task-execution-attempt.ts` / `taskExecutionAttemptSchema` / `TaskExecutionAttempt`；原型不是兼容层。
- Task detail main-area source evidence: `packages/shared/src/{task,task-execution-attempt,session,task-workspace}.ts`、SQLite/PostgreSQL Prisma schemas、`RdbProvider`、`GET /api/tasks/:id/production`、`GET /api/tasks/:id/sessions`、`GET /api/tasks/:id/workspace` 与 production Task detail panels。048/049/050/051/052 分别拥有 Workspace、Session、Task Session UX、TaskExecutionAttempt/Task status 与 optional Agent Context 边界；prototype mock 与旧 UI 均不拥有领域合同。
- Linear 官方 issue views 将 layout、grouping、ordering、filter 与 display properties 分离；054 采用这种信息层级，但明确去掉第一版拖拽写入和保存共享视图。
