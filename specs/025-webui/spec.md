# 功能规格：MVP 操作 Web UI 框架

**Feature Branch**: 已合并到本地 `main`，保留逻辑 feature id `025-webui`
**Created**: 2026-05-19  
**Status**: Draft  
**Input**: 用户描述：“简单补充 025 的 spec，作为 mvp 版本的操作 ui”；后续范围决策：`025-webui` 只聚焦前端框架层，并纳入主题/design-system、国际化、主侧边栏、共享 layout、基础组件、响应式和未来 Electron 兼容边界。2026-08-05 owner 明确要求 demo/PR 平移 Castrel UX 的结构、密度与交互模式：主菜单为 `New`、`Search`、`Inbox`、`Issues`、`Automations`，其下是 Projects 与按 Project 分组的 Tasks；具体配色采用 dark-tech design system，默认 UI 字号为 12px。随后 owner 要求将当前页面实际使用的 Castrel v2 组件迁移并替换现有页面原语，尤其保证 padding 与配色通过主题 token system 实现。2026-08-06 owner 进一步要求 New 页面使用放大的独立 Logo、统一 `Project` 术语和共享 dropdown，并用 Project 选定后出现的 Issue 卡片列表替代 Issue select；随后要求从主菜单移除 `Automations`，并把 `/automations` 清空为只显示 `Coming soon` 的直接访问占位页。Appearance 后续必须迁入本机当前 Codex 发布包的全部内置主题，并把原 Graphite 正式命名为 Mystra，提供同一 `codeThemeId` 下的明暗双变体。随后 owner 明确共享布局必须由 `Sidebar`、`Main`、可选 `Right Panel` 三列组成，三列分别拥有自己的 Header 与 Content，页面可按需注册 Right Panel，未注册时不得占用主区域宽度。

2026-08-06 后续字体决策：内部统一为 UI / Content / Code 三个角色；Codex v1 导入保持原 schema，并把 `fonts.ui` 同步到 Content。Mystra 自有主题分别使用常见单一 primary family，平台 fallback 由浏览器/system generic 负责。
**Consolidation**: 2026-08-03 起，025 是唯一保留的未完成 UI spec；原 `026`–`031` 的页面探索材料并入 025，已完成的 035/036 对象页继续作为当前代码事实。025 的 shell 实施将显式迁移现有导航，而不是假装当前代码已经采用目标 taxonomy。

## 用户场景与测试 *(mandatory)*

### 用户故事 1 - 操作员使用已批准的 Shell 框架（优先级：P1）

作为内部操作员，我希望 MVP UI 提供稳定的 shell、已批准的顶层导航和共享页面框架，以便我能识别 Mystra 的人类操作界面，同时不让 shell 拥有页面级业务行为。

**优先级原因**：第一个有用的 UI 切片是框架本身：导航、布局、路由框架和共享 chrome。Mystra 仍然以 API 为真相，并保持 agent-first；shell 应先存在，而不是让任意一个页面先变成产品本体。

**独立测试**：在桌面和窄视口打开应用，确认 shell 只暴露已批准的顶层菜单，为每个路由提供一致页面框架，并且不依赖页面级功能先实现才能可用。

**验收场景**：

1. **前提** 操作员打开应用 shell，**当** 主导航渲染，**则** primary navigation 依次且只包含 `New`、`Search`、`Inbox` 和 `Issues`；其下显示 Project list，再下方的 Tasks section 按 Project 分组显示 Task，`Settings` 作为底部 shell action 打开 modal；直接访问 `/automations` 时只显示 `Coming soon`。
2. **前提** 操作员在已批准路由之间切换，**当** 每个路由加载，**则** shell 提供一致的导航、页面框架和共享视觉结构，即使该页面的专属 feature spec 尚未实现。
3. **前提** 某个已批准页面目前只有框架级支持，**当** 操作员打开它，**则** UI 可以显示占位或只读框架内容，而不是发明属于后续实现切片的页面行为。

---

### 用户故事 2 - 后续页面实现切片接入 Shell 而不重新定义 Shell（优先级：P1）

作为未来的 Mystra agent 或前端维护者，我希望页面级工作落在稳定的 shell 合同之后，以便 `New`、`Search`、`Inbox`、`Issues`、Project-grouped Tasks、`Settings` 和不在主菜单中的 `/automations` 占位路由可以在同一 025 边界内按独立实现切片演进，而不反复改变产品分类或共享 UI 所有权边界。

**优先级原因**：页面功能需要拆成独立实现切片。025 必须定义什么属于框架、什么必须延后，否则下一个 agent 会再次即兴发挥。非常可预期。也非常不必要。

**独立测试**：审查 shell 合同，确认后续页面实现切片可以向某个已批准路由添加具体内容，而不改变顶层导航、管理面层级或 shell 级偏好设置。

**验收场景**：

1. **前提** 后续实现切片定义具体的 `Recent Sessions` 行为，**当** 实现该工作，**则** 它接入现有已批准 shell 的 secondary route，而不是添加新的主导航入口或替换 shell 所有权。
2. **前提** 某个页面能力需要新数据、动作或视觉解释，**当** 指定该能力，**则** 它由 025 中明确的实现切片拥有，而不是悄悄扩张 shell 任务。
3. **前提** shell 框架已经存在，**当** 后续页面实现切片增量到来，**则** 它们可以独立交付，而不迫使全局导航、布局原语或共享偏好设置重设计。

---

### 用户故事 3 - 操作员跨设备、主题和语言环境使用 Shell（优先级：P2）

作为内部操作员，我希望 shell 框架处理响应式导航、外观、主题和语言环境脚手架，以便后续页面实现切片继承可用的横切基础，而不是每个页面重新发明一遍。

**优先级原因**：响应式、视觉偏好和本地化属于框架问题，应在 shell 层解决一次，而不是每个页面重复争论。

**独立测试**：在窄视口和宽视口打开 shell，切换 light/dark 外观、主题和语言环境，确认即使页面级功能仍是占位，shell 也保持可用。

**验收场景**：

1. **前提** 操作员使用窄视口，**当** 在已批准路由之间导航，**则** shell 仍可使用，且主要导航策略不是横向滚动。
2. **前提** 操作员切换 light/dark 外观或主题，**当** shell 重新渲染，**则** 共享导航和页面框架在所有已批准路由中保持视觉一致。
3. **前提** 操作员切换语言环境，**当** 再次访问 shell，**则** 共享导航和框架自有文案显示所选语言或可预测 fallback。
4. **前提** 操作员将主题模式设为 `System`，**当** 操作系统明暗偏好变化，**则** shell 在不刷新页面的情况下使用分别配置的浅色或深色主题。
5. **前提** 操作员分别选择浅色主题和深色主题，**当** 在 `System`、`Light`、`Dark` 间切换，**则** 每种模式使用对应 variant 的主题，不接受跨 variant 的无效 theme id。
6. **前提** 操作员调整边缘线模式、代码表面明暗、对比度、字体或字号，**当** 控件值变化，**则** Settings 预览与整个 shell 即时反映结果，并可把主题细节复位为当前主题默认值。
7. **前提** 当前版本没有服务端 Appearance persistence，**当** 操作员刷新同一浏览器，**则** 有效设置从 localStorage 恢复；损坏或过期值回退为安全默认值，且不得创建 API 或 RDB 写入。
8. **前提** 维护者提供 `codex-theme-v1:{...}` 字符串，**当** Mystra 解析并应用该主题，**则** `codex-theme-v1` 只作为 schema version，JSON 内 `codeThemeId` 作为主题 ID，payload 可无损序列化回同一 v1 格式；未知 schema version、额外 synthetic `id` 或非法 payload 必须被拒绝。
9. **前提** 操作员打开 Appearance 的亮色或暗色主题选择器，**当** 查看可选项，**则** 本机 Codex 26.730.61639 注册的 28 个主题族、43 个受支持变体全部可选，Mystra 另以同一 `codeThemeId: "mystra"` 提供 light/dark 两个变体。
10. **前提** 维护者导入一个合法 Codex v1 theme，**当** Mystra 建立内部字体角色，**则** `theme.fonts.ui` 的首个 primary family 同步到 UI 与 Content，`theme.fonts.code` 同步到 Code；v1 JSON 不得新增 `content` 字段。

---

### 用户故事 4 - 前端维护者复用共享布局和组件（优先级：P2）

作为前端维护者，我希望 shell 框架提供主侧边栏、共享 layout archetype 和与 Mystra design-system 方向一致的基础组件层，以便后续页面实现切片能组合一致 UI，而不是临时重建结构和原语。

**优先级原因**：如果框架现在不拥有 sidebar、layout mode 和 base components，每个后续页面实现切片都会从侧门把框架决策塞回来。这并不优雅，只是可预测。

**独立测试**：审查 shell 合同，确认后续页面实现切片可以选择已批准 layout archetype 和共享基础组件，而不用重新定义 sidebar、token model 或基础交互模式。

**验收场景**：

1. **前提** 操作员使用 shell，**当** 显示导航，**则** 主侧边栏仍是已批准顶层路由的共享主导航容器。
2. **前提** 后续页面实现切片需要会话式、仪表盘式或阅读式界面，**当** 实现它，**则** 它可以接入 `chatLayout`、`dashboardLayout` 或 `readLayout`，而不是默认发明新的顶层框架模型。
3. **前提** 后续页面实现切片需要按钮、输入框、badge、panel、list 或类似原语，**当** 实现它，**则** 它可以依赖框架共享组件层和 design-system 对齐，而不是引入无关视觉语法。
4. **前提** 当前 025 表面已经存在页面级 action、surface、field、dialog 和 state，**当** Castrel v2 组件迁移完成，**则** shell、New、Search、Inbox、Issues 与 Settings 都消费 Mystra-owned 共享组件，且 padding、颜色、border、focus、height 与 radius 可追溯到主题 token。
5. **前提** 页面需要补充上下文、检查器或页面级操作，**当** 页面注册 Right Panel，**则** shell 在 Sidebar 与 Main 之外渲染拥有独立 Header/Content 的第三列；页面未注册或离开该路由时第三列消失，Main 自动恢复全部可用宽度。

---

### 用户故事 5 - 未来桌面封装保留同一框架合同（优先级：P3）

作为未来 Mystra 维护者，我希望 shell 框架与后续 Electron wrapper 兼容，以便 Mystra 可以获得桌面 shell，而不用重写导航、布局、主题、本地化或基础组件合同。

**优先级原因**：owner 明确希望未来兼容 Electron。这应被视为框架切片的架构护栏，而不是发布前一周添加的道歉。

**独立测试**：审查框架要求，确认 shell concern 的表达既能运行在当前 web delivery 形态中，也能兼容未来 Electron-hosted shell。

**验收场景**：

1. **前提** Mystra 当前以 web control-plane UI 交付，**当** 实现 shell 框架，**则** 它不假设浏览器唯一产品模型，以至于未来 Electron 需要重新设计路由分类、主题处理或布局所有权。
2. **前提** 未来 Electron shell 包裹同一前端，**当** 迁移发生，**则** 主侧边栏、共享布局、i18n 和主题系统保持可复用，而不是成为 web-only 特例。
3. **前提** 某个框架能力确实依赖 host 环境，**当** 指定或实现它，**则** 环境特定 seam 必须显式存在，而不是藏在共享 shell 行为内部。

---

### 边界情况

- 当已批准页面还没有专属 feature spec 时怎么办？shell 仍应渲染有效路由，显示占位或只读框架，而不是省略路由或发明页面语义。
- 当页面级后端能力尚不足以支持编辑或实时数据时怎么办？框架可以保持 inspection-first，不应伪装为已完成产品行为。
- 当小屏导航空间不足时怎么办？shell 应保留所有已批准菜单入口，而不是为移动端创造不同产品分类。
- 当选中主题或语言环境不完整时怎么办？shell 应可预测 fallback，同时保持导航可理解。
- 当 localStorage 中 Appearance JSON 损坏、字段越界或引用错误 variant 的主题时怎么办？主题模型应逐字段 normalize，并回退到对应 variant 的有效默认主题，不能让首帧脚本或 React hydration 崩溃。
- 当 `System` 模式下操作系统明暗偏好在页面打开后变化时怎么办？shell 应监听 `prefers-color-scheme` 并即时重新解析 active theme，同时在组件卸载时移除监听。
- 当旧版 localStorage 保存的是 `notion-light`、`notion-dark`、`linen-light` 或 `graphite-signal` synthetic preset id 时怎么办？解析必须按 variant 迁移为有效 canonical `codeThemeId`，其中 `graphite-signal` 迁移到 `dark:mystra`，并让首帧 bootstrap 与 hydration 后解析得到相同结果。
- 当本机 Codex 发布版本更新主题目录时怎么办？Mystra 不在运行时读取应用包；维护者必须以明确版本重新提取、测试并更新静态 catalog，不能悄悄混合不同 Codex 版本的主题事实。
- 当页面形态不明显适配 `chatLayout`、`dashboardLayout` 或 `readLayout` 时怎么办？默认映射到已批准 archetype，除非 025 的后续变更证明需要新的框架级 layout。
- 当页面设计偏离共享 design system 时怎么办？页面应论证对框架的扩展，而不是静默绕过共享 token 和原语。
- 当未来 Electron host 引入桌面专属 affordance 时怎么办？框架应保持共享 UI 合同可移植，并把 host-only 行为隔离在显式 seam。
- 当后续页面实现切片试图引入新的主菜单或 UI-owned 管理语义时怎么办？该变化超出既定 shell 范围，必须先更新 025 并对照项目管理面层级证明。
- 当注册 Right Panel 的页面卸载或导航到不使用 Right Panel 的页面时怎么办？shell 必须同步清理旧 panel，不得保留跨路由的陈旧标题、内容或宽度。
- 当窄视口无法同时容纳 Main 与 Right Panel 时怎么办？Right Panel 必须按共享响应式规则堆叠到 Main 之后，并且不得制造 page-wide 横向滚动。

## 需求 *(mandatory)*

### 功能需求

- **FR-001**: 系统 MUST 提供内部 MVP web UI 框架，作为 Mystra 现有管理能力之上的二级操作与 inspection shell。
- **FR-002**: MVP demo UI 的 primary navigation MUST 依次且只包含 `New`、`Search`、`Inbox` 和 `Issues`；`Automations` MUST NOT 出现在主菜单中；`Settings` MUST 是底部 shell action/modal。
- **FR-003**: 本 spec MUST 只拥有 shell 级 concern，包括已批准导航、路由框架、共享布局结构、共享视觉语言、shell-wide preference plumbing 和未来兼容 host-shell 边界。
- **FR-004**: 本 spec MUST NOT 把页面探索材料伪装为已实现产品行为；`New`、`Search`、`Inbox`、`Issues`、`Settings` 或 Project-grouped Tasks 的具体行为 MUST 作为 025 内独立实现切片明确计划和验证，`/automations` 在对应实现切片出现前 MUST 保持占位状态。
- **FR-005**: 每个已批准 navigation surface MUST 有路由或等价 shell entry，以便在页面级功能实现前导航模型已经具体。
- **FR-006**: 当某个已批准路由的专属 feature spec 尚未落地时，shell MUST 允许该路由渲染 placeholder、unavailable 或 read-only 框架内容。
- **FR-007**: shell MUST 提供主侧边栏，作为已批准 primary routes 与 Project-grouped Tasks 的共享导航容器。
- **FR-008**: shell MUST 定义并拥有三个核心 layout archetype：`chatLayout`、`dashboardLayout` 和 `readLayout`。
- **FR-009**: 后续页面级 spec MUST 默认组合到 `chatLayout`、`dashboardLayout` 或 `readLayout`，除非单独论证的框架变更扩展已批准 layout 集合。
- **FR-010**: shell MUST 为各已批准路由使用的常见 UI 原语提供共享基础组件层。
- **FR-011**: 基础组件层和 shell 视觉语言 MUST 与 Mystra 的 Claude design-system 方向保持一致，以便主题、token 和组件行为在框架内一致。
- **FR-011a**: 当前 025 表面使用的 Castrel v2 通用组件 anatomy、density、padding 和交互状态 MUST 迁移到 Mystra-owned 共享组件；Castrel palette、业务 API 和未使用的领域组件 MUST NOT 被机械复制。
- **FR-011b**: shell、New、Search、Inbox、Issues 与 Settings 的可见 color、background、border、focus、padding、gap、height 和 radius MUST 通过 semantic theme token 消费，非 4px 特殊值 MUST 使用命名 token。
- **FR-012**: shell MUST 为导航、页面框架和共享交互模式提供跨路由一致结构，而不是让每个页面定义不兼容 shell。
- **FR-013**: shell MUST 在支持的窄视口和宽视口中提供共享响应式行为。
- **FR-014**: shell MUST 支持 light mode 和 dark mode。
- **FR-015**: 当产品定义不同视觉主题时，shell MUST 支持超出 light/dark 外观模式的主题切换。
- **FR-016**: shell MUST 支持国际化，使已批准导航和框架自有文案可以用受支持语言或可预测 fallback 呈现。
- **FR-017**: shell MUST 保持项目管理面层级：API 为真相，skill/MCP 和 CLI 仍是优先 programmable interfaces；UI 框架 MUST NOT 成为管理语义的唯一 owner。
- **FR-018**: shell MUST 将 workspace 视为 session-scoped execution-context 概念，MUST NOT 用 workspace 表示 hosted product structure 的 tenancy。
- **FR-018a**: Settings MUST 按 `Account`、`Appearance`、`Team`、`Integrations` 四个 Tab 组织；Theme 与 Language MUST 归入 `Appearance`，租户术语 MUST 使用 `Team`。当前 MVP 不支持的 Account 或 Team 写操作 MUST 显示为 read-only/unavailable，不得由 UI 伪造持久化。
- **FR-019**: MVP shell 框架 MUST 保持 private-operations focused，MUST NOT 在可用前要求 caller auth、logs API、retry API、public SaaS tenancy management 或其他当前 out-of-scope platform features。
- **FR-020**: 025 的后续页面实现切片 MUST 能在不改变已批准 navigation taxonomy 或 shell-level ownership model 的前提下，为某个已批准 surface 添加路由内容、动作和数据呈现。
- **FR-021**: shell 框架 MUST 保持与未来 Electron host 的兼容性，使导航、layout archetype、theme system、internationalization 和 base components 可复用，而无需重新定义框架合同。
- **FR-022**: 未来 Electron shell 所需的任何环境特定行为 MUST 被隔离在显式 seam 之后，而不是作为 web-only 假设嵌入共享框架合同。
- **FR-023**: shell 默认 UI 字号 MUST 为 12px，sidebar menu row MUST 使用 28px 紧凑行高和 token-derived hover/selected state。
- **FR-024**: Tasks section MUST 按 Project 分组；每个 Task 的 icon MUST 表达其最新 Session 状态，无 Session 时使用明确的 idle icon。
- **FR-025**: `/automations` 在本 demo/PR 切片中 MUST 是不出现在主菜单中的直接路由，页面 MUST 只显示 `Coming soon`，且 MUST NOT 引入 workflow API、持久化、配置入口或平台编排语义。
- **FR-026**: shell MUST 平移 Castrel UX 的结构、密度、层级与交互模式，并以 dark-tech design system 作为具体颜色来源：canvas `#111513`，surface `#181C1A` / `#202522` / `#2B312D`，ink `#E7ECE8` / `#AAB4AD` / `#76817A`，executor `#74B98B`，以及已批准 signal colors；统一使用等宽字体、0/2/4/6px radius、flat elevation，且不得使用 gradient、glow、glass 或 noise。
- **FR-027**: `New` surface MUST 在主内容区域居中显示放大的独立产品 Logo，不得在 Logo 右侧重复产品文案。Task composer MUST 保持默认 3 行输入高度、无分隔线且透明的 ghost footer，并在 Castrel 9/7/7/9px 基础 inset 上补偿右侧与底部 2px，使 textarea、footer controls 与 32px send action 的有效视觉 inset 四边一致。footer 左侧 MUST 提供附件和由 Mystra-owned shared dropdown 实现的 `Project` control，右侧 MUST 提供语音输入和发送 controls；不得用 `Repository` 指代 Project。Project 选定前不得呈现 Issue selector；选定后 MUST 在输入框下方加载该 Project repository scope 内的 Issue 卡片列表，卡片 MUST 可选择并通过既有 Issue dispatch API 创建对应 Task/initial Session。不得显示无行动价值的 Project 配置引导文案；未被现有 API contract 支持的 control MUST 清楚表现为不可用，不得伪造提交成功。
- **FR-028**: `Search` MUST 以 modal 形式覆盖当前 route，并支持按 Task id、objective、Issue、repository 或最新 branch 过滤和导航。
- **FR-029**: 主侧边栏 MUST 支持显式收起与展开，并持久化该 preference；收起状态 MUST 将侧边栏完整压缩为 0px 并移除其交互命中，不得保留 icon rail。此时主区域 header MUST 提供 Mystra brand、`New` action 与重新展开 control。
- **FR-030**: primary navigation 之后 MUST 显示 Projects section，且 Project item MUST 导航到对应 Project detail route；Projects 与 Tasks section heading MUST NOT 显示 count，Projects heading 右侧 MUST 提供 ghost-style add Project action；Project-grouped Tasks 继续作为其后的独立 section。
- **FR-031**: `Inbox` MUST 使用标准 master-detail 布局：左侧为最新 Session 处于 `waiting_for_review` 的 Task 卡片列表，右侧为当前选中 Task 的只读详情；`Issues` 继续使用当前 Task table。Inbox 列表 MUST 支持搜索、刷新、明确选中态、加载态、空态与窄视口降级，右侧详情 MUST 提供进入完整 Task 对象页的入口。
- **FR-032**: `Appearance` MUST 迁移 Castrel 的外观能力模型：`System` / `Light` / `Dark` 模式、分别配置的浅色与深色主题、`Default` / `High Contrast` / `Color High Contrast` 边缘线模式、代码与终端表面的浅色/深色 variant，以及 Theme Details 中的预览、对比度、UI/Content/Code 字体、UI/Content 字号和复位动作。所有控件 MUST 使用 Mystra-owned 共享原语、双语文案和 semantic theme token，不得复制 Castrel palette、Zustand、`next-themes` 或业务服务依赖。
- **FR-033**: 本切片的 Appearance preference MUST 只保存在当前浏览器 localStorage，并在 hydration 前应用有效保存值以避免错误主题闪烁。解析 MUST 对损坏 JSON、未知字段、越界数值、无效 mode/border/variant 和跨 variant theme id fail closed 到可预测默认值。不得新增 Appearance API、RDB schema、server action 或伪造跨设备同步；未来数据库存储属于独立 contract change。
- **FR-034**: 主区域 header MUST 只显示当前 surface title，不得显示 `local control plane`、`本地控制平面` 或等价环境说明。
- **FR-035**: Theme import/export contract MUST 完全兼容 `codex-theme-v1:{JSON}`。冒号前的 `codex-theme-v1` 是 schema version，不是主题 ID；JSON payload MUST 且只能包含 `codeThemeId`、`theme`、`variant`，其中 `codeThemeId` 是 canonical theme id。Mystra display metadata 与 explicit token extensions MUST 保持在该 payload 之外；未知 version、额外 `id`、字段缺失、非法 variant/contrast/font/color 值 MUST fail closed。
- **FR-036**: Appearance 的 `lightThemeId` / `darkThemeId`、Settings option value、运行时 dataset 和 hydration bootstrap MUST 使用 `codeThemeId`。同一 `codeThemeId` MAY 分别提供 light/dark variant，查找时 MUST 使用 `(variant, codeThemeId)`；旧 synthetic preset id MUST 仅作为受限本地迁移输入，不能继续成为输出合同。
- **FR-037**: Mystra MUST 从明确记录版本的本机签名 Codex 应用包迁移全部已注册内置主题族与其实际支持的 light/dark variant。catalog MUST 保留 Codex `codeThemeId`、variant 和完整 v1 theme payload，且 MUST NOT 以社区列表、主题名称猜测或未标版本的数据替代来源事实。
- **FR-038**: Mystra 自有主题 MUST 使用 canonical `codeThemeId: "mystra"` 并同时提供 light/dark variant。dark variant MUST 保留原 Graphite explicit tokens；light variant MUST 使用同一矿物灰、绿色强调和 restrained semantic signal 视觉语法。旧 `graphite-signal` 只作为 `dark:mystra` 迁移输入。
- **FR-039**: 内部 theme adapter MUST 暴露 UI / Content / Code 三个字体角色，每个角色只允许一个 normalized primary family；运行时 MUST 分别追加 `system-ui, sans-serif`、`ui-serif, serif`、`ui-monospace, monospace` fallback。Mystra 两个 variant MUST 使用 UI=`Arial`、Content=`Georgia`、Code=`Courier New`。Codex v1 导入 MUST 将 `theme.fonts.ui` 同步到 UI 与 Content，将 `theme.fonts.code` 映射到 Code，并保持外部 payload exact round-trip。旧 `chatFont` / `chatFontSize` 与原 Graphite family stack MUST 在 localStorage normalization/bootstrap 边界迁移。
- **FR-040**: 全局 shell MUST 将可视结构表达为 `Sidebar`、`Main` 与可选 `Right Panel` 三列；每列 MUST 分别包含语义明确的 Header 与 Content。页面 MUST 通过共享 page-owned seam 显式注册 Right Panel header/content；缺省、卸载或跨路由清理后 Right Panel MUST 不渲染且不占 grid 宽度。桌面宽视口使用右侧列，`<=700px` 时 Right Panel MUST 堆叠到 Main 之后。Task 详情 MUST 作为首个接入页面，将 `Create Session` 表单放入 Right Panel，而不改变 canonical Session API。

### 关键实体

- **Operations Shell**: 组织顶层导航和共享页面框架的框架级 UI 容器。
- **Main Sidebar**: 已批准顶层路由的共享主导航栏。
- **Navigation Model**: 已批准顶层菜单集合及其路由身份。
- **Page Frame Contract**: 后续页面级 spec 添加内容时继承的共享 shell 结构。
- **Layout Archetypes**: 已批准框架布局 `chatLayout`、`dashboardLayout` 和 `readLayout`。
- **Base Component Layer**: 各路由共享的 UI 原语和交互模式集合。
- **Theme System**: 框架拥有的主题、token 和外观模型，与 Mystra Claude design-system 方向对齐。
- **Shell Preferences**: 框架拥有的 appearance、theme、locale 和其他跨路由共享 UI 设置。
- **Project-grouped Tasks**: 侧边栏中的 Task 导航列表，按 Project 聚合，并用最新 Session 状态决定 Task icon。
- **Placeholder Route State**: 已批准页面在专属 feature spec 尚未实现时的有效 shell-level 状态。
- **Host Shell Compatibility Boundary**: 保持共享 UI 可在当前 web host 与未来 Electron host 之间移植的框架约束。

## 成功标准 *(mandatory)*

### 可衡量结果

- **SC-001**: MVP demo UI 的 primary navigation 只暴露 `New`、`Search`、`Inbox` 和 `Issues`；其下依次显示 Project list 和 Project-grouped Tasks，`Settings` 保持底部 shell action 语义；`/automations` 直接访问时只显示 `Coming soon`。
- **SC-002**: shell 提供主侧边栏以及已批准的 `chatLayout`、`dashboardLayout` 和 `readLayout` archetype，作为后续页面实现切片可复用框架原语。
- **SC-003**: shell 提供 Castrel-derived UX 结构与共享 dark-tech 默认配色、英语/简体中文切换、12px 默认字号、基础组件和响应式行为；dark-tech 源 token 可由自动测试逐项验证，后续页面实现切片无需重新定义。
- **SC-004**: 操作员可访问每个已批准 navigation surface，并看到一致的 shell-valid 页面框架，即使页面级行为被延后。
- **SC-005**: 后续页面级 spec 可添加具体路由行为，而不改变已批准 shell taxonomy 或重新定义共享 layout、component 和 preference。
- **SC-006**: 操作员可在窄视口和宽视口使用 shell，并可切换 light/dark mode、theme 和受支持语言，而不破坏 shell 导航。
- **SC-007**: 同一框架合同可用于当前 web host，并且不会以阻塞未来 Electron wrapper 的方式被指定。
- **SC-008**: UI 框架保持为 API、skill/MCP 和 CLI 管理面的二级辅助界面，不需要 MVP excluded platform capabilities 才能有用。
- **SC-009**: 操作员可在 `New` 页面看到 Castrel 密度的 ghost-footer composer controls、以 modal 搜索 Task、将侧边栏完整收起并从 header 恢复；Projects 与 Tasks heading 不显示 count 且 Projects 提供 add action；在 `Inbox` 中通过左侧卡片切换右侧详情，在 `Issues` 中继续使用 Task table；header 不再出现本地控制平面说明。
- **SC-010**: 组件迁移清单覆盖当前 025 的全部可见原语，shell、New、Search、Inbox、Issues 与 Settings 不再各自拥有平行 action/surface/field/state 视觉实现；自动测试和浏览器计算样式可验证关键 padding 与配色来自 token。
