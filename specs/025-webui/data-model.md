# 数据模型：MVP 操作 Web UI 框架

## OperationsShell

框架拥有的外层容器，负责导航、偏好、布局选择和路由承载。

- 拥有已批准的导航模型。
- 一次渲染一个 active shell route。
- 为尚无专属页面 spec 的 route 提供可安全占位的框架。
- 仍低于 API、Skill/MCP 和 CLI 等管理事实来源。

## ShellRoute

MVP shell 中已批准的 route 或 shell action。

字段：

- `id`：稳定 surface id，例如 `new`、`search`、`inbox`、`issues`、`automations`、`project-tasks` 或 `settings`。
- `label`：框架拥有的展示标签。
- `placement`：`primary`、`secondary` 或 `shell-action`。
- `layout`：已批准的布局范式之一。
- `status`：`placeholder`、`inspection` 或 `ready`。
- `ownerSlice`：可选，指向拥有具体页面行为的 025 实现切片。

校验：

- 025 中只有五个 primary menu entries、一个 Project-grouped Tasks section 和一个 Settings shell action 是有效的。
- route label 属于框架拥有的 copy，必须为后续本地化做好准备。
- 除非 025 的后续实现切片明确拥有页面行为，否则不得添加页面业务行为。

## LayoutArchetype

shell 层页面承载模型。

取值：

- `chatLayout`：对话式或 intake-oriented 页面框架。
- `dashboardLayout`：KPI、列表和操作概览页面框架。
- `readLayout`：阅读、检查或设置页面框架。

校验：

- 025 的页面实现切片默认组合到这些布局之一。
- 新增 layout 必须通过 framework-level spec 更新。

## ShellPreference

框架拥有的 UI preference 状态。

字段：

- `lightThemeId` / `darkThemeId`：分别保存对应 variant 的 canonical `codeThemeId`；不是 schema version，也不是 Mystra synthetic preset id。
- `CodexThemeCatalogEntry`：从明确 Codex app version 提取的静态 `CodexThemeV1Payload` 加 display label；当前来源 26.730.61639，28 个 family / 43 个 variant。
- `MystraThemeDefinition`：`codeThemeId: "mystra"` 下的 light/dark 双变体；dark 持有原 Graphite explicit tokens，light 持有配套 explicit tokens。
- `ThemeFontRoles`：Mystra 内部 `{ ui, content, code }` primary family；每项是单一 family 或 null，不包含平台 fallback list。Codex v1 adapter 由 `fonts.ui` 派生 UI/Content，由 `fonts.code` 派生 Code。
- `appearance`：由 mode、system variant 与 `(variant, codeThemeId)` 解析出的 active theme。
- `locale`：框架拥有 copy 的选中或默认 locale。

校验：

- preference 只属于本地 UI concern。
- preference 不得变成产品租户、项目或 runtime state。
- 旧版 synthetic preset id 只允许在 parse/bootstrap 边界迁移，normalized preference 必须输出 `codeThemeId`；`graphite-signal -> dark:mystra`，`linen-light -> light:notion`。
- 旧版 `chatFont` / `chatFontSize` 迁移为 `contentFont` / `contentFontSize`；原 Graphite 多 family 默认 stack 迁移为新的 Mystra 单 family defaults，用户显式保存的单 family 保留。

## SidebarTaskGroup

由 `projectId` 标识的侧边栏导航分组，显示 Project label 与其 Tasks。每个
Task row 使用最新 Session state 派生 icon；没有 Session 时使用 idle icon。
它只消费现有 Project/Task API，不创建新的服务合同。

## PlaceholderRouteState

已批准 route 在对应实现切片尚未落地时的有效状态。

字段：

- `routeId`：已批准 shell route id。
- `message`：简洁的框架拥有 placeholder 文案。
- `nextSlice`：可选，指向负责该页面的后续 025 实现切片。

校验：

- placeholder 可以说明 ownership 与 availability。
- placeholder 不得伪造已经完成的页面行为。

## HostShellBoundary

未来 Electron wrapper 的兼容 seam。

字段：

- `sharedShell`：导航、布局、主题、本地化和基础组件。
- `hostSpecificSurface`：未来 desktop-only affordances，隔离在 shared shell behavior 之外。

校验：

- 当前 Web 实现不得依赖 Electron。
- 未来 Electron 行为不得重写 shared shell contract。
