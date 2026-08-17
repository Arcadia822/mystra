---
title: "Prototype: 主导航与 Task 工作台"
taco_scope: spec
---

## 入口

- 运行：`pnpm dev:prototype`
- 054 route：<http://localhost:3010/054-navigation-task-workbench>
- Task detail route：<http://localhost:3010/054-navigation-task-workbench/tasks/MYS-118>
- 通用起点：<http://localhost:3010/starter>
- 054 composition：`apps/spec-prototype/app/_components/navigation-task-workbench.tsx`
- 可复用 shell：`apps/spec-prototype/app/_components/prototype-shell.tsx`

旧的 `mockups/index.html` 已删除。它只加载生产 CSS、手写复制组件 DOM 与
SVG，不是可迁移的 React 实现，继续保留只会制造第二份事实来源。

## 复用证据

这个 prototype 与生产 Control Plane 分离运行，但不是独立设计系统。

- 生产 `apps/control-plane/app/globals.css` 仅 import
  `@mystra/ui/styles.css`；prototype root layout 也直接 import 同一个入口。
- `UiButton`、`UiIconButton`、`UiInput`、`UiTextarea`、
  `UiDropdown`、`UiPopover`、`UiSegmented`、`UiSurface`、
  `UiDialogSurface`、`UiBreadcrumb`、`UiShellRightPanel`、`UiRightPanelToggle`、
  `ShellIcon`、`MystraLogo`、`TaskStatusIcon`、
  `UiLabel` 与 stacked list 均来自 `packages/ui`。
- 生产 app 原有的 `app/_components/ui-*.tsx`、`shell-icons.tsx` 和
  `mystra-logo.tsx` 保留为薄转发层，因此既有调用方与 prototype 消费的是
  同一份实现，而不是两份相似实现。
- prototype shell 复用生产 `AppShell` 的 `appShell/sidebar/shellMain/`
  `shellHeader/shellMainContent` layout class contract；路由、真实数据、
  RBAC 与偏好持久化仍由生产 `AppShell` adapter 负责。
- 054 只在 `apps/spec-prototype/app/prototype.css` 保留 feature composition
  所需的 Task toolbar、board、composer 和 mock review geometry。若某个规则
  被证明是通用 primitive 或 layout contract，必须先上移到 `packages/ui`。

## 覆盖表面

- sidebar 展开时，New Task 与 Search 是 header icon action；收起时 logo、
  brand、New Task、Search 与展开按钮保持在主 header，所有 icon 使用共享
  16px grid。
- 主导航展示 Overview、Inbox、Tasks、Runtimes，不展示 New、Search、Issues。
- 053 尚未可用时，Overview 入口只显示明确的无数据 placeholder；prototype 不复制
  053 查询、指标、空态或 mock dashboard。
- Active Tasks 保留真实前端的 Project grouping，只展示非终态快捷入口。
- Tasks 主区域直接显示一个有主题圆角、surface 背景和外围边线的 workbench；
  主 header、toolbar 与内容之间均无 divider。
- Search 是填满剩余空间的静态 ghost field；Filter、Display、Refresh 是
  右对齐的共享 ghost icon actions；Refresh 使用同系列 icon 原位旋转。
- Display 使用共享 `UiPopover`，Table/Kanban 使用带 icon 的共享
  `UiSegmented`，Properties 使用共享 sidebar row density。
- Table 使用共享 stacked list，不显示 column title、row divider 或 footer。
  默认字段为左侧 Status + Name，右侧 Project + Issue + Metadata + Created At。
- Properties 顺序固定为 Status、Task ID、Name、Project、Issue、Metadata、
  Updated At、Created At；Task ID、Updated At 默认隐藏，Issue 默认展示但可关闭。
- stacked field 的 `equalWidth` 在共享组件内依据当前展示 rows 的最大自然
  内容宽度解析；Status icon 默认等宽，Task ID 是左侧等宽前缀，Updated At
  与 Created At 是右侧等宽后缀，非法中间配置会被明确拒绝。
- 标准 stacked field 必须声明 `text`、`datetime`、`icon` 或 `labels`
  render type；这里的 `labels` 只是 `UiLabel` collection renderer，不表示
  `TaskLabel` 领域对象。Task ID 使用 `text`，Created At 与 Updated At 使用 `datetime`，
  三者的 typography 与 Name 完全一致；标准 field 不接受 consumer 私有文字
  class。真正特殊的 presentation 只能声明 `custom` 并使用共享
  `StackedListCustomField`。
- Project、Issue、Task.metadata entries 共用 `UiLabel` 与同一个 list gap；前端把
  Metadata object 转换为可见 key/value 并决定 presentation order，持久化层不提供
  ordinal。Label key、value 与 `+N` 使用 12px content text，icon 使用 16×16px
  slot。Project 文案只映射
  provider-stable `repositoryExternalId` 并带 repository provider icon；Issue 文案只映射
  exact reference 的 `identifier` 并带 GitHub/Linear icon，不增加外部 snapshot mock。
- Display popup 通过共享 `UiSurfaceBody` 使用标准 `popup-inset`；Properties
  使用共享前置 `UiCheckbox`，必显字段为 checked + disabled，可选字段可切换，
  不使用整行 selected navigation surface 或尾随 check icon。
- Display popup 的共享 `popup-inset` 固定为四边 8px；Properties 的共享
  `UiCheckbox` visual 固定为 16×16px。prototype 不使用 16px panel inset，
  也不覆盖 checkbox width、height、transform 或浏览器原生 appearance。
- 五种 Task 状态共用 `TaskStatusIcon` 的同尺寸圆形基底：Not started 为空心圆，
  In progress 为绿色半圆，Needs handoff、Completed（蓝色）、Canceled 分别显示
  清晰的 handoff arrow、check、cross；内部 mark 使用已定义的主题反色 token。
- Created At 与 Updated At 共用同一 `TaskDate` renderer 和语义
  `<time datetime>`。
- Kanban 只展示五个状态列；compact card 四边使用 8px inset。card 标题固定占
  两行，超过两行截断，因此卡片高度不随标题长短变化。
- Kanban card 的 Project、Issue 与 Metadata entries 使用共享 `UiLabelOverflow`：组件按
  当前容器宽度与每个 `UiLabel` 的自然宽度保留最长完整前缀，其余内容收敛为
  同系列 `+N` control；点击或键盘激活后由共享 `UiPopover` portal 到全局
  popup layer 并列出被折叠属性。`ResizeObserver` 在 card 宽度变化时重新
  解析，不通过固定数量、重叠、半截裁切或换行改变卡片高度。
- New Task 使用共享 `UiDialogSurface` 与 Section slots；composer 只在外层
  使用一次 `space-2`（8px）inset，header/body/footer 自身无
  padding/divider，并以同一个 `space-2` 保持纵向节奏；不得回退到 12px
  generic `content-inset`。title 在 header，以 `Task name` 作为
  placeholder，使用共享 medium typography token；close 使用共享
  `UiDialogCloseButton`/dismiss glyph。description 是无边框、透明且不可拖拽
  的 ghost textarea。Project 使用共享 `UiDropdown` 的 ghost trigger，宽度随
  内容自然解析；menu portal 到全局 popup layer，不参与 modal 排版或裁切。
  Project trigger 与 footer solid `Create` action 都使用共享 20px `inline`
  size，在 28px footer row 内保留上下各 4px 空间。
- Task detail 从 Table row、Kanban card 与 Active Tasks 共用同一个动态 route。
  Main 直接从 Sessions helper row 与 shared stacked list 开始，不再渲染 page-local
  title/description、Production、TaskExecutionAttempt 或 Workspace；Properties 与 Status history 通过全局
  `UiShellRightPanel` 承载。Right Panel header 的共享收起按钮移除第三列并让 Main
  回收宽度；收起后共享展开按钮位于主 header controls 最右侧。两种按钮共用
  `aria-controls`/`aria-expanded`，collapse state 由 shell layout 持有。主 header
  内建可选 `breadcrumbItems`，当前节点使用 Task name，并由共享 `UiBreadcrumb`
  渲染 16px right-chevron arrow；Task ID 只保留在 Properties，页面
  不再手写 nav、分隔符或 breadcrumb CSS。全局 shell 在 320px 下按 Main 后
  Right Panel 堆叠。页面级 8px outer inset 只由 shell Main 提供，详情 feature root
  padding 为 0；section gap 与 Right Panel content padding 均为 8px，inline actions
  为 20px，默认 rows 为 28px。Project、Issue、Metadata Labels、
  status、surface、actions 与 shell 均复用 `@mystra/ui`；prototype 只保留 mock
  execution data 与 detail composition。Main content 不提供 Edit、Start、Workspace
  setup 或 action header；New Session 作为当前 Task surface action 位于 shell Main
  Header 右侧，Right Panel 收起时 recovery control 始终排在其后。
- New Session 打开共享 `UiDialogSurface` compact-row composition。Surface 统一持有
  8px inset/gap；header/footer 是 28px rows 且没有自己的 padding/divider。Header 标题为
  `Create Session`，只保留共享 Close；body 只有一个无边框、透明背景、不可 resize 的
  `UiTextarea` Prompt input，并保留 placeholder `Session-only context, constraints, or a
  specific focus`；footer
  左侧是 available Provider 的 inline `UiDropdown`，右侧是文案为 `Create` 的 solid
  inline action。Runtime 由服务端根据 ready Workspace 解析，不显示也不提交；Agent
  Context 省略/null，不出现控件；不渲染 Cancel、intro、notice 或 `Launch Session`。
  Close、Escape 与 backdrop 均可退出，关闭后焦点返回 Header trigger。
- Prompt 是 `manualContext.text` 的 UI copy，不添加 `prompt` request/domain field，也不
  声称覆盖服务端固定 `firstUserMessage`。Prototype 明确停在 API dispatch 边界，不向
  Sessions 列表追加 mock、不改变 Task/TaskExecutionAttempt/Workspace，也不伪造成功导航。

## Task detail 主区域 Data Design

054 本次独立任务核对 Production、Sessions、Workspace 的数据边界，但 Main 只渲染
Sessions；
Shell、breadcrumb、Right Panel 收展、Properties、Status history 与全局 typography
保持现状。

### Composition

- **Production / internal TaskExecutionAttempt record / Workspace** 只保留 source-of-truth 映射说明；TaskExecutionAttempt 不是用户可见产品对象；当前 Main
  不渲染这些 section/card，也不把其 facts 转写到 Session row。
- **Sessions** 是 Main 的第一个且唯一内容集合。它复用 Tasks 页面同源的
  `StackedList` composition，并默认显示 shared helper row（当前已加载 Session count）。
- 默认 fields：左侧 Session state（带 icon 的 `UiLabel`，`equalWidth`）、Provider
  （共享 `ProviderIcon`）、name；右侧 Runtime（`UiLabel`，默认 hidden）、Updated
  （datetime）。row 整体导航到 Session detail。
- helper row 使用 28px compact height；record row 原样复用 Tasks stacked-list 的
  42px density，不做 feature-local 压缩覆盖。
- canonical `Session` 和 list API 没有 title。prototype 不增加 mock `title`；name slot
  逐字显示完整 `Session.id`，不截短也不加虚构 `Session ` 前缀。真正的 Session Title
  是待 source contract 明确后的后续工作，不得由 prototype 越权决定。
- stacked mode 的 name slot 是左侧最后一个 field，由共享 `.uiStackedListName` grow
  消耗剩余宽度；`.uiStackedListSpacer` 只保留 tokenized minimum gap。这个 geometry
  属于 `packages/ui`，prototype 不添加覆盖。
- `providerKey` 只接受 canonical `codex|copilot`；两者通过共享、可访问的 provider
  glyph 呈现。Copilot 使用 GitHub 现行 product icon，不使用已弃用的 standalone logo、
  mascot 或 generic automation icon。

### Mock shape

Prototype 仍使用固定 mock，但字段必须忠实对应当前 public contracts：

- `Task`: UUID、五态 `status`、status revision/note/actor/ISO timestamps；
- `TaskExecutionAttempt | null`（internal）: UUID references、frozen optional Agent Context、Runtime/Provider、
  nullable Workspace/Session、setup failure；不得出现 `currentAttempt` 或 sequence；
- `TaskWorkspaceView | null`: canonical five-state Workspace enum、合法 Git branch/ref、
  40/64 hex commit、`shared-mutable` 与 public failure；
- `RuntimeView`: Runtime UUID/name 与 available Provider capabilities，用于隐藏 Runtime
  label 的显示名解析；
- `Session[]`: UUID、canonical nine-state enum、Runtime/Provider、optional
  `agentId+agentRevision`、ISO timestamps；不添加 title、objective、completedAt 或
  terminalSummary。

UI renderer 可以派生 status label、Runtime fallback、短 commit 和相对时间，但不得把
这些 display values 作为 mock domain fields。Session name 是完整 UUID，不属于可截短
display value。`ready` 显示为“Ready · can continue”，不是 Completed；`closed` 与
`failed` 才显示 terminal 语义。

### States and actions

- Production/TaskExecutionAttempt/Workspace 状态仍彼此独立，但当前 Main 不显示。
- Sessions: loading、request error、empty、rows、load-more，以及九种 Session state。
- Main content 中只保留 row-level Open Session navigation；New Session 只在 shell Main
  Header 打开 Modal，不作为 Sessions section 或 empty-state action。

### Removed mismatches

- `current execution attempt`、`current Session`、`Agent is working in the current
  Session`、`attempt 01`；
- raw Session state `Completed`；
- Workspace repository full name、目录式 `worktrees/...`、7 位 domain commit；
- 把 Session list row 描述成自身持有 Workspace attachment；
- Main 中 Sessions 之前的 page-local identity、Production/TaskExecutionAttempt/Workspace cards；
- 本任务新增的 `UiTable` wrapper、native table anatomy、caption 与 column headers；
- 主区域中任何非 UUID entity identity。`MYS-118` 只可作为 Issue identifier；当前
  Right Panel route fixture 仍把它用作 Task ID 的问题属于原 task，不在本次独立任务
  修改范围。

## UX Intent：详情页 Shell 修正

- **Intent**：让对象身份、主执行内容和检查器各自只拥有一个稳定位置，并把
  inspector 的显隐变成 shell 能力，而不是详情页面的临时状态。
- **Reuse evidence**：production 与 prototype 均直接消费 `@mystra/ui` 的
  `UiBreadcrumb`、`UiShellRightPanel` 与 `UiRightPanelToggle`；feature 只提供
  Task name breadcrumb item 以及 Properties/Status history 内容。
- **Hierarchy**：breadcrumb current、Properties 和 section headings 均为
  12px/500；正文为 12px/400，强调主要依赖 semantic text color，不使用 600。
- **Interaction**：New Session 始终属于主 header controls；展开按钮在出现时永远是
  该 controls group 的最后一项，收起按钮永远在 Right Panel header。Main Header 右侧
  不展示 username、avatar、TeamSwitcher 或 Account；隐藏 panel 时第三列不存在，Main
  回收完整可用宽度，右侧保留 New Session 与共享恢复按钮。
- **Verification**：静态合同检查 name/ID ownership 与 shared component reuse；
  SSR 检查可访问属性，typecheck/build 检查 production/prototype 同源消费。

## 当前限制

- 使用固定 mock data，不调用 Mystra API，不验证 053 Overview 查询、RBAC、
  routing、偏好持久化或真实异步追加。
- New Session Modal 只验证入口、字段 composition、关闭与焦点行为；Create 停在 API
  dispatch 边界，不宣称创建成功。production 成功/错误 journey 仍需接入既有
  `POST /api/tasks/:id/sessions` 后单独验证。
- 主区域会用 contract-faithful mock 覆盖 loaded/full 组合；loading、empty、error、
  Workspace 各状态和独立失败组合通过纯 presentation model/tests 固定，不宣称已连接
  真实 production API。
- Prototype 证明的是主题、primitive、icon 与 shell geometry 的代码级复用；
  生产 `AppShell` 的数据/路由 adapter 不会被 prototype 伪造。
- Task.metadata 的持久化合同、五态状态迁移以及 production Tasks
  查询仍由 054 后续实现完成。原型不是后端合同已经落地的证据。
- Kanban 不支持拖拽；Filter 只展示入口；不提供分页器、批量状态更新、保存
  view、swimlane 或跨页面偏好。

## 迁移边界

正式开发时，可直接迁移 054 feature composition 和 feature-only styles，
并接入生产 `AppShell`、API 与 locale。共享组件不得复制回页面；发现缺口时
修改 `@mystra/ui`，让 production 与 prototype 在同一次变更中共同验证。
