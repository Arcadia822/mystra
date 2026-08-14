# Specification Quality Checklist: 主导航与 Task 工作台

**Purpose**: 在进入 `/speckit.clarify` 或 `/speckit.plan` 前验证规格完整性与质量

**Created**: 2026-08-13

**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] 不以具体框架、数据库或第三方 API 作为产品要求
- [x] 聚焦操作者价值、信息架构与可观察行为
- [x] 面向产品 owner、设计与工程评审者可直接阅读
- [x] 所有必填章节已完成
- [x] Castrel 与 Linear 被限定为参考，不形成兼容承诺

## Requirement Completeness

- [x] 不存在 `[NEEDS CLARIFICATION]` 标记
- [x] Requirements 可测试且无歧义
- [x] Success Criteria 可度量
- [x] Success Criteria 不依赖实现细节即可验证
- [x] 所有 User Story 均包含独立测试与验收场景
- [x] 已覆盖 sidebar 展开/收起、modal、空态、错误、窄屏与状态变化等边界
- [x] 范围明确包含导航、基础动作、Tasks Table/Kanban、活跃快速区和基础表格体验
- [x] 依赖和假设已识别，尤其是 feature 053 Overview 前置依赖

## Feature Readiness

- [x] 所有 Functional Requirements 均能映射到验收场景或 Success Criteria
- [x] User Stories 覆盖主要操作者路径
- [x] 明确 Kanban 第一版只读，不包含拖拽状态迁移
- [x] 明确 `/new` 直接入口被删除且不重定向
- [x] 明确 Tasks 页面不新增专用 New Task 按钮
- [x] 明确保留只展示非终态 Task 的侧栏快速导航
- [x] 明确 Active Tasks 沿用现有按 Project 分组能力
- [x] 明确 Project 内 Issues 入口继续可用
- [x] UI-facing spec 已安排独立 prototype 产物
- [x] 明确 Tasks 使用无 column title/footer/pagination 的 stacked mode，且 Table/Kanban 切换位于 Display
- [x] 明确默认五字段、icon-only ghost toolbar、静态 Search 与同 glyph Refresh loading 状态
- [x] 明确 Labels 是新增的一等 Task 合同，不是任意 metadata blob
- [x] 明确 Castrel left/grow/spacer/right stacked anatomy，而不是固定宽度的无表头 column grid
- [x] 明确 Project/Metadata 复用统一 Label，Project label 显示 repository provider icon
- [x] 明确 Display 使用 Mystra popup、segmented 与 sidebar-density property rows
- [x] 明确收起 header 保留 logo/brand 并对品牌与 action group 使用现有间距
- [x] 明确所有 list fields 与 Metadata 内部 Labels 共用同一 column gap
- [x] 明确 Issue Label 根据 exact reference 显示 GitHub/Linear provider icon
- [x] 明确 Display Properties 的八项顺序、左右位置和默认显隐状态
- [x] 明确五种 Task 状态使用同尺寸圆形基底及共享 glyph mapping
- [x] 明确 In Progress 使用绿色，Done 使用蓝色，并以圆内图案提供非颜色区分
- [x] 明确 `waiting_for_review` 并入 `blocked`，且 `blocked` 的界面语义为待接手/Needs handoff，不是 error
- [x] 明确 Task 不提供 `error`/`failed`，执行失败继续属于 Session/Harness/attempt 事实
- [x] 明确 New Task 使用 `UiDialogSurface` + 053 Section slots 的标准几何、不可缩放 description、标准 Project dropdown 与 `Create` action
- [x] 明确 stacked field `equalWidth` 的跨行统一宽度、icon 默认值、左右边缘连续性与 Tasks 字段映射
- [x] 明确 Updated At 与 Created At 复用同一个 time renderer、locale 与 format options
- [x] 明确 Task detail Header 恢复 New Session，并通过独立 User Story 覆盖完整 Human launch journey
- [x] 明确 Modal 只显示 Prompt 与 available Provider；Runtime 由服务端解析，Agent Context 在本 UI 中省略/null
- [x] 明确 Prompt copy 映射 canonical `manualContext.text`，不虚构 `prompt` field 或覆盖固定 `firstUserMessage`
- [x] 明确 Workspace/Provider 前置失败、API error、关闭与焦点返回，以及 Task/Harness 无副作用边界

## Product Requirements Review

使用项目本地 `product-requirements` rubric 评审，并遵守 Spec-Kit 输出规则。

**Quality Score**: 96/100

- Business Value & Goals: 29/30
- Functional Requirements: 25/25
- User Or Operator Experience: 20/20
- Technical Constraints: 13/15
- Scope & Priorities: 9/10

Notes:

- 规格已达到 90+ planning readiness 门槛。
- Owner 已确认三个关键选择：活跃 Task 快速区保留；Kanban 第一版不允许拖拽；New Task 无独立 URL 且 Tasks 页面不新增入口。
- Owner 已明确并行规划多个 specs；054 不创建或占用独立 spec branch。
- Owner 的第二轮原型反馈已冻结 stacked layout、默认字段、toolbar、modal composition 与无分页边界。
- Owner 的后续 modal 反馈已冻结标准 Section/Dialog/Dropdown/Button 组件复用，054 不再维护私有 header/body/footer padding。
- Owner 已冻结 stacked `equalWidth` 为基础表格 field 合同：按完整字段顺序校验边缘连续性，不随 Display 显隐变化。
- Owner 已冻结五态 Task 合同：`pending`、`in_progress`、`blocked`、`done`、`canceled`；review、授权、等待回答/信息等属于未来 handoff reason，不是顶层状态。
- Owner 已冻结 Task detail 主区域为上方 Production/Workspace 概览卡组与下方 Sessions 语义表格；数据直接映射 Task/Harness/TaskWorkspaceView/RuntimeView/Session，禁止 `currentAttempt/currentSession` 等衍生合同。
- Owner 已恢复 Task detail Header 的手动 New Session 入口，并将 Modal 收敛为唯一 Prompt input、footer 左 Provider 与右 Create；Runtime/Agent Context/Cancel 不进入 UI，入口不回到 Sessions content header，也不扩大 Task/Harness 状态副作用。
- 当前 Task shared schema 与 Prisma models 明确没有 `labels`/`metadata`；054 选择新增受限的一等 `labels`，不撤销既有“无通用 metadata”边界。这会使 054 同时成为 Task 合同变更，技术计划必须覆盖 SQLite/PostgreSQL parity、API 投影、写入入口与回归 fixture。
- 剩余 4 分来自两项计划期工作：Labels 的上限/规范化/写入入口尚需技术冻结；其他表格页面迁移顺序留给后续 feature。053 Overview 已同步采用五态合同。
- `/speckit.plan` 必须用可用的 GitNexus toolchain 对 `AppShell`、根路由、`TaskTable`、Task shared/API/RDB contracts、`mystra-agent` 与 Project Issues 表面执行影响分析；当前 MCP/CLI 的 LadybugDB 版本分裂必须先按仓库 doctor/rebuild 流程修复，不能以失败查询冒充低风险。

## Validation Iteration

### Iteration 1 — 2026-08-13

- [x] 将 New Task/Search 从普通主导航改写为 header action，并覆盖 sidebar 展开、收起和窄屏状态。
- [x] 将活跃快速区与完整 Tasks 工作台拆成两个不同目的的入口。
- [x] 将只读 Kanban、状态集合和无拖拽边界写成显式要求。
- [x] 将 `/new` 删除、不重定向和无 URL modal 行为写成独立验收。
- [x] 将基础表格与 Castrel/Linear 参考边界写入规格，避免把第三方产品合同复制进 Mystra。

### Iteration 2 — 2026-08-13

- [x] Prototype 改为直接加载 Mystra `globals.css`，复用真实 shell、action、field、surface 与 logo 语法。
- [x] New Task composer 改为 header title、body description、footer Project 的无分割线 ghost composition。
- [x] 恢复并明确 Active Tasks 的 Project grouping。
- [x] Tasks 工作台移除 intro、column title row、footer 与 paginator，采用 stacked rows。
- [x] 将 Table/Kanban 与可选字段移入 Display，固定默认五字段。
- [x] 将 toolbar 固定为左侧静态 Search、右侧三个 icon-only ghost actions，并定义同 glyph refresh loading。
- [x] 识别 Labels 不存在于当前 Task 合同，明确新增受限 `labels` 而非通用 `metadata`。

### Iteration 3 — 2026-08-13

- [x] 统一 sidebar/header/toolbar icon 为 Mystra 16px grid 与 28px action box。
- [x] Search 改为 fill remaining width 的无边框、无背景 ghost input。
- [x] Task row 改为 Castrel left/grow/spacer/right 弹性堆叠，移除固定字段宽度和 row divider。
- [x] Project 与 Metadata KV 改用同一个 Label anatomy，并为 GitHub Project 显示 provider icon。
- [x] Display 改用 `uiDropdownMenu`，layout 改用带 icon 的 `uiSegmented`，Properties 改用 sidebar `navItem` 密度。
- [x] 收起 header 恢复 logo/brand，并分离 brand 与 New/Search/expand action group 的间距。

### Iteration 4 — 2026-08-13

- [x] 将 row、左右 field groups 与 Metadata 内部多个 Labels 收敛到同一个 column-gap token。
- [x] 为 Issue Label 增加 GitHub/Linear provider icon；无 Issue 不显示伪 provider icon。
- [x] Display Properties 重排为 Status、Task ID、Name、Project、Issue、Metadata、Updated At、Created At。
- [x] 增加默认隐藏的 Task ID，并保持 Task ID、Issue、Updated At 三项默认关闭。

### Iteration 5 — 2026-08-13（glyph 基线，状态集合已由 Iteration 12 取代）

- [x] 依据 owner 提供的 Linear 状态参考，将所有 Task status glyph 收敛为同一 `r=9` 圆形基底。
- [x] 当时为六态候选建立统一圆形 glyph；当前状态集合与 handoff glyph 以 Iteration 12 为准。
- [x] 保留 Done/Canceled 的同尺寸实心圆内反色勾/叉语法。
- [x] In Progress 使用 Mystra executor green，Done 使用 info blue，避免两者继续呈现为近似绿色。

### Iteration 6 — 2026-08-13

- [x] 移除主区域 header 与页面内容之间的分割线。
- [x] 移除 toolbar 与 Table/Kanban 内容之间的分割线。
- [x] 只在包含 toolbar 与内容的整个 Tasks 工作台外围保留一圈边缘线。

### Iteration 7 — 2026-08-13

- [x] Kanban card 标题区固定预留两行高度，短标题不压缩卡片。
- [x] 超过两行的标题在第二行截断，保持相同字段配置的卡片等高。

### Iteration 8 — 2026-08-13

- [x] Tasks 工作台外框改用 Mystra `radius-panel`，不再呈现直角边框。
- [x] 工作台背景改用语义 `color-surface-panel`，与主区域 `color-canvas` 形成低对比区隔；默认深色主题采用略亮而非更深的工作面。
- [x] row hover 与 Label 提升到 `color-surface-hover`，避免 panel 背景降低交互和 metadata 可辨性。

### Iteration 9 — 2026-08-13

- [x] New Task 改为标准 `UiDialogSurface` 套 053 Section anatomy，并直接复用 `UiSurfaceHeader/Body/Footer` 的高度与 padding。
- [x] 只移除 composer slot divider，不再用 054 私有 padding 重画 header、body、footer。
- [x] Description 禁用 resize handle；Project 改为带 No project/repository 描述、选中态与键盘行为的标准 `UiDropdown` 样例。
- [x] 提交 action 改用 header-size solid `UiButton` 几何，文案收敛为 `Create`。

### Iteration 10 — 2026-08-13

- [x] 为 stacked field 增加 `equalWidth` 合同：以当前展示 rows 中该 field 的最大自然内容宽度解析 shared track，不使用预设像素常量，也不要求不同 fields 彼此同宽。
- [x] 将等宽字段限制为 canonical order 的左边缘连续前缀或右边缘连续后缀，并规定非法配置必须被明确拒绝。
- [x] icon field 默认启用 `equalWidth`，Display 显隐不改变配置合法性。
- [x] Tasks 样例映射为左侧 Status/Task ID、右侧 Updated At/Created At 等宽；Project、Issue、Metadata 保持自然宽度。
- [x] 搜索、筛选、字段显隐、刷新或异步追加改变展示集合时重新测量，并继续由标准 column-gap token 提供 field 间距。

### Iteration 11 — 2026-08-13

- [x] 将 Updated At 与 Created At 都改为带 `datetime` 的语义 `<time>` field。
- [x] 两个字段统一经过同一个 `taskDateFormatter`，demo 稳定输出 `MMM D`，移除相对时间与绝对日期混排。
- [x] 日期 renderer 完成后再测量 `equalWidth`，确保 shared track 根据最终可见文案计算。

### Iteration 12 — 2026-08-13

- [x] 将 Task 顶层状态收敛为 `pending`、`in_progress`、`blocked`、`done`、`canceled` 五态。
- [x] 删除独立 `waiting_for_review`；其 review handoff 语义并入 `blocked`，未来再为 review、授权、等待回答与等待信息设计结构化 handoff reason。
- [x] 将 `blocked` 的界面文案改为待接手 / Needs handoff，并用 warning 色圆形 handoff glyph 取代 error 红色感叹号。
- [x] 明确 Task 不提供 `error`/`failed` 状态；Session/Harness/attempt 错误不得自动改变 Task。
- [x] 将 Active Tasks 收敛为三种非终态，并将 Kanban 从六列收敛为五列。
- [x] 记录 pre-0.1 直接合同替换范围；正式实现不得保留 `waiting_for_review` alias、shim 或双写。

### Iteration 13 — 2026-08-14

- [x] 将手动 New Session 恢复为 Task detail shell Main Header 的 current-surface action。
- [x] 新增独立 User Story，覆盖打开 Modal、字段选择、成功导航、前置失败、API error 与关闭/焦点返回。
- [x] Modal 字段直接映射既有 Task Session launch contract：locked Runtime、available Provider、optional Agent Context 与 optional Manual Context。（已由 Iteration 14 的 owner 决策取代。）
- [x] 保持 Main content 从 Sessions shared stacked list 开始，不新增 page-local action header 或 empty-state duplicate action。
- [x] Prototype 停在 API dispatch 边界，不向列表追加 mock Session，不改变 Task、Harness 或 Workspace，也不伪造成功。

### Iteration 14 — 2026-08-14

- [x] 将 Create Session Modal 收敛为 28px header/footer rows；标题为 `Create Session`，header Close 是唯一取消入口。
- [x] Body 只保留一个 Prompt input；footer 左侧为 Provider dropdown，右侧为 `Create`，删除 Cancel 与 `Launch Session`。
- [x] Prompt input 保留既有 placeholder，并使用共享 textarea 的无边框、透明背景、不可 resize composition。
- [x] Runtime 继续由服务端从 ready Workspace 解析，不在表单显示/提交；Agent Context 在本 UI 中省略/null。
- [x] Prompt UI copy 映射既有 `manualContext.text`，不新增 `prompt` domain/request field，也不覆盖固定 `firstUserMessage`。

## Notes

- 所有产品选择已写清；下一阶段可继续原型评审，然后执行 `/speckit.plan`。Labels 的约束值和写入入口属于 plan 阶段必须冻结的合同细节，不是可在实现中随意猜测的装饰字段。
- Prototype 的视觉审查不能替代静态一致性检查、后续浏览器验收或应用运行时证据。
