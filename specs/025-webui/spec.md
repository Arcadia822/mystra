# 功能规格：MVP 操作 Web UI 框架

**Feature Branch**: 已合并到本地 `main`，保留逻辑 feature id `025-webui`
**Created**: 2026-05-19  
**Status**: Draft  
**Input**: 用户描述：“简单补充 025 的 spec，作为 mvp 版本的操作 ui”；后续范围决策：`025-webui` 只聚焦前端框架层，并纳入主题/design-system、国际化、主侧边栏、共享 layout、基础组件、响应式和未来 Electron 兼容边界。
**Consolidation**: 2026-08-03 起，025 是唯一保留的未完成 UI spec；原 `026`–`031` 的页面探索材料并入 025，已完成的 035/036 对象页继续作为当前代码事实。025 的 shell 实施将显式迁移现有导航，而不是假装当前代码已经采用目标 taxonomy。

## 用户场景与测试 *(mandatory)*

### 用户故事 1 - 操作员使用已批准的 Shell 框架（优先级：P1）

作为内部操作员，我希望 MVP UI 提供稳定的 shell、已批准的顶层导航和共享页面框架，以便我能识别 Mystra 的人类操作界面，同时不让 shell 拥有页面级业务行为。

**优先级原因**：第一个有用的 UI 切片是框架本身：导航、布局、路由框架和共享 chrome。Mystra 仍然以 API 为真相，并保持 agent-first；shell 应先存在，而不是让任意一个页面先变成产品本体。

**独立测试**：在桌面和窄视口打开应用，确认 shell 只暴露已批准的顶层菜单，为每个路由提供一致页面框架，并且不依赖页面级功能先实现才能可用。

**验收场景**：

1. **前提** 操作员打开应用 shell，**当** 主导航渲染，**则** primary navigation 只包含 `Overview`、`Inbox`、`New Task` 和 `Projects`；`Settings` 作为 shell action 打开 modal，`Recent Sessions` 作为 secondary route 保持可达。
2. **前提** 操作员在已批准路由之间切换，**当** 每个路由加载，**则** shell 提供一致的导航、页面框架和共享视觉结构，即使该页面的专属 feature spec 尚未实现。
3. **前提** 某个已批准页面目前只有框架级支持，**当** 操作员打开它，**则** UI 可以显示占位或只读框架内容，而不是发明属于后续实现切片的页面行为。

---

### 用户故事 2 - 后续页面实现切片接入 Shell 而不重新定义 Shell（优先级：P1）

作为未来的 Mystra agent 或前端维护者，我希望页面级工作落在稳定的 shell 合同之后，以便 `Overview`、`Inbox`、`New Task`、`Projects`、`Settings` 和 `Recent Sessions` 可以在同一 025 边界内按独立实现切片演进，而不反复改变产品分类或共享 UI 所有权边界。

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

---

### 用户故事 4 - 前端维护者复用共享布局和组件（优先级：P2）

作为前端维护者，我希望 shell 框架提供主侧边栏、共享 layout archetype 和与 Mystra design-system 方向一致的基础组件层，以便后续页面实现切片能组合一致 UI，而不是临时重建结构和原语。

**优先级原因**：如果框架现在不拥有 sidebar、layout mode 和 base components，每个后续页面实现切片都会从侧门把框架决策塞回来。这并不优雅，只是可预测。

**独立测试**：审查 shell 合同，确认后续页面实现切片可以选择已批准 layout archetype 和共享基础组件，而不用重新定义 sidebar、token model 或基础交互模式。

**验收场景**：

1. **前提** 操作员使用 shell，**当** 显示导航，**则** 主侧边栏仍是已批准顶层路由的共享主导航容器。
2. **前提** 后续页面实现切片需要会话式、仪表盘式或阅读式界面，**当** 实现它，**则** 它可以接入 `chatLayout`、`dashboardLayout` 或 `readLayout`，而不是默认发明新的顶层框架模型。
3. **前提** 后续页面实现切片需要按钮、输入框、badge、panel、list 或类似原语，**当** 实现它，**则** 它可以依赖框架共享组件层和 design-system 对齐，而不是引入无关视觉语法。

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
- 当页面形态不明显适配 `chatLayout`、`dashboardLayout` 或 `readLayout` 时怎么办？默认映射到已批准 archetype，除非 025 的后续变更证明需要新的框架级 layout。
- 当页面设计偏离共享 design system 时怎么办？页面应论证对框架的扩展，而不是静默绕过共享 token 和原语。
- 当未来 Electron host 引入桌面专属 affordance 时怎么办？框架应保持共享 UI 合同可移植，并把 host-only 行为隔离在显式 seam。
- 当后续页面实现切片试图引入新的主菜单或 UI-owned 管理语义时怎么办？该变化超出既定 shell 范围，必须先更新 025 并对照项目管理面层级证明。

## 需求 *(mandatory)*

### 功能需求

- **FR-001**: 系统 MUST 提供内部 MVP web UI 框架，作为 Mystra 现有管理能力之上的二级操作与 inspection shell。
- **FR-002**: MVP UI 框架的 primary navigation MUST 只包含 `Overview`、`Inbox`、`New Task` 和 `Projects`；`Settings` MUST 是 shell action/modal，`Recent Sessions` MUST 是可直接访问的 secondary route。
- **FR-003**: 本 spec MUST 只拥有 shell 级 concern，包括已批准导航、路由框架、共享布局结构、共享视觉语言、shell-wide preference plumbing 和未来兼容 host-shell 边界。
- **FR-004**: 本 spec MUST NOT 把页面探索材料伪装为已实现产品行为；`Overview`、`Inbox`、`New Task`、`Projects`、`Settings` 或 `Recent Sessions` 的具体行为 MUST 作为 025 内独立实现切片明确计划和验证。
- **FR-005**: 每个已批准 navigation surface MUST 有路由或等价 shell entry，以便在页面级功能实现前导航模型已经具体。
- **FR-006**: 当某个已批准路由的专属 feature spec 尚未落地时，shell MUST 允许该路由渲染 placeholder、unavailable 或 read-only 框架内容。
- **FR-007**: shell MUST 提供主侧边栏，作为已批准 primary routes 的共享主导航容器。
- **FR-008**: shell MUST 定义并拥有三个核心 layout archetype：`chatLayout`、`dashboardLayout` 和 `readLayout`。
- **FR-009**: 后续页面级 spec MUST 默认组合到 `chatLayout`、`dashboardLayout` 或 `readLayout`，除非单独论证的框架变更扩展已批准 layout 集合。
- **FR-010**: shell MUST 为各已批准路由使用的常见 UI 原语提供共享基础组件层。
- **FR-011**: 基础组件层和 shell 视觉语言 MUST 与 Mystra 的 Claude design-system 方向保持一致，以便主题、token 和组件行为在框架内一致。
- **FR-012**: shell MUST 为导航、页面框架和共享交互模式提供跨路由一致结构，而不是让每个页面定义不兼容 shell。
- **FR-013**: shell MUST 在支持的窄视口和宽视口中提供共享响应式行为。
- **FR-014**: shell MUST 支持 light mode 和 dark mode。
- **FR-015**: 当产品定义不同视觉主题时，shell MUST 支持超出 light/dark 外观模式的主题切换。
- **FR-016**: shell MUST 支持国际化，使已批准导航和框架自有文案可以用受支持语言或可预测 fallback 呈现。
- **FR-017**: shell MUST 保持项目管理面层级：API 为真相，skill/MCP 和 CLI 仍是优先 programmable interfaces；UI 框架 MUST NOT 成为管理语义的唯一 owner。
- **FR-018**: shell MUST 将 workspace 视为 session-scoped execution-context 概念，MUST NOT 用 workspace 表示 hosted product structure 的 tenancy。
- **FR-019**: MVP shell 框架 MUST 保持 private-operations focused，MUST NOT 在可用前要求 caller auth、logs API、retry API、public SaaS tenancy management 或其他当前 out-of-scope platform features。
- **FR-020**: 025 的后续页面实现切片 MUST 能在不改变已批准 navigation taxonomy 或 shell-level ownership model 的前提下，为某个已批准 surface 添加路由内容、动作和数据呈现。
- **FR-021**: shell 框架 MUST 保持与未来 Electron host 的兼容性，使导航、layout archetype、theme system、internationalization 和 base components 可复用，而无需重新定义框架合同。
- **FR-022**: 未来 Electron shell 所需的任何环境特定行为 MUST 被隔离在显式 seam 之后，而不是作为 web-only 假设嵌入共享框架合同。

### 关键实体

- **Operations Shell**: 组织顶层导航和共享页面框架的框架级 UI 容器。
- **Main Sidebar**: 已批准顶层路由的共享主导航栏。
- **Navigation Model**: 已批准顶层菜单集合及其路由身份。
- **Page Frame Contract**: 后续页面级 spec 添加内容时继承的共享 shell 结构。
- **Layout Archetypes**: 已批准框架布局 `chatLayout`、`dashboardLayout` 和 `readLayout`。
- **Base Component Layer**: 各路由共享的 UI 原语和交互模式集合。
- **Theme System**: 框架拥有的主题、token 和外观模型，与 Mystra Claude design-system 方向对齐。
- **Shell Preferences**: 框架拥有的 appearance、theme、locale 和其他跨路由共享 UI 设置。
- **Placeholder Route State**: 已批准页面在专属 feature spec 尚未实现时的有效 shell-level 状态。
- **Host Shell Compatibility Boundary**: 保持共享 UI 可在当前 web host 与未来 Electron host 之间移植的框架约束。

## 成功标准 *(mandatory)*

### 可衡量结果

- **SC-001**: MVP UI 的 primary navigation 只暴露 `Overview`、`Inbox`、`New Task` 和 `Projects`；`Settings` 与 `Recent Sessions` 仍按各自 shell action/secondary route 语义可达，不出现额外主导航区域。
- **SC-002**: shell 提供主侧边栏以及已批准的 `chatLayout`、`dashboardLayout` 和 `readLayout` archetype，作为后续页面实现切片可复用框架原语。
- **SC-003**: shell 提供共享主题/design-system 对齐、国际化脚手架、基础组件和响应式行为，后续页面实现切片可继承而不重新定义。
- **SC-004**: 操作员可访问每个已批准 navigation surface，并看到一致的 shell-valid 页面框架，即使页面级行为被延后。
- **SC-005**: 后续页面级 spec 可添加具体路由行为，而不改变已批准 shell taxonomy 或重新定义共享 layout、component 和 preference。
- **SC-006**: 操作员可在窄视口和宽视口使用 shell，并可切换 light/dark mode、theme 和受支持语言，而不破坏 shell 导航。
- **SC-007**: 同一框架合同可用于当前 web host，并且不会以阻塞未来 Electron wrapper 的方式被指定。
- **SC-008**: UI 框架保持为 API、skill/MCP 和 CLI 管理面的二级辅助界面，不需要 MVP excluded platform capabilities 才能有用。
