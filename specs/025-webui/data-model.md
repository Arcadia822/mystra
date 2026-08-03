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

- `id`：稳定 surface id，例如 `overview`、`inbox`、`new-task`、`projects`、`settings` 或 `recent-sessions`。
- `label`：框架拥有的展示标签。
- `placement`：`primary`、`secondary` 或 `shell-action`。
- `layout`：已批准的布局范式之一。
- `status`：`placeholder`、`inspection` 或 `ready`。
- `ownerSlice`：可选，指向拥有具体页面行为的 025 实现切片。

校验：

- 025 中只有四个 primary routes、一个 secondary route 和一个 shell action 是有效的。
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

- `themeId`：当前选中的 control-plane theme id。
- `appearance`：由 theme 派生的 light/dark appearance。
- `locale`：框架拥有 copy 的选中或默认 locale。

校验：

- preference 只属于本地 UI concern。
- preference 不得变成产品租户、项目或 runtime state。

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
