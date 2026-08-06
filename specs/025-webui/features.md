# 功能说明：025-webui

## 摘要

025 定义 Mystra MVP 操作 Web UI 的框架层能力。它提供面向人类操作者的稳定 shell：统一导航、侧边栏、路由承载、布局范式、基础组件期望、主题与本地化脚手架、响应式行为，以及未来 Electron 宿主兼容边界。

本功能刻意不把页面探索材料等同于已实现业务行为。`New`、`Search`、`Inbox`、`Issues`、`Automations`、Project-grouped Tasks 和 `Settings` 的业务语义、数据解释与操作动作，将作为 025 内独立实现切片接入这个 shell。

## 功能地图

- 建立 Mystra MVP 的操作型 Web UI shell。
- 固定 primary navigation：`New`、`Search`、`Inbox`、`Issues`、`Automations`。
- 固定 secondary surfaces：Project-grouped Tasks 与 `Settings` shell modal。
- 为已批准页面提供共享侧边栏与路由框架。
- 为 `Inbox` 提供标准 master-detail 检查面：左侧 review Task 卡片列表，右侧选中 Task 详情。
- 定义共享布局范式：`chatLayout`、`dashboardLayout`、`readLayout`。
- 建立 shell 基础组件层，供后续页面复用。
- 保留主题、英语/简体中文、本地化与响应式脚手架；默认 UI 字号为 12px。
- 默认平移 Castrel UX 的结构、密度和交互模式，并采用 dark-tech 的精确 palette、统一等宽字体、语义 signal colors、0/2/4/6px radius 与 flat elevation；禁止阴影、渐变、辉光、glass 和 noise。
- 为未来 Electron 宿主保留兼容边界，但不提前实现桌面专属能力。

## 边界

- API 仍是管理能力的事实来源。
- Skill/MCP 与 CLI 仍是优先的可编程管理界面。
- 具体页面行为按 025 内独立实现切片承担，不能由 shell 重构顺带臆造。
- `workspace` 仍表示 session-scoped 执行上下文，不表示租户或产品组织。
- MVP 排除项继续排除：caller auth、logs API、retry API、公开 SaaS 租户管理、Kubernetes sandbox 以及相关平台能力。

## 分阶段能力图

- 阶段 1：交付共享 shell、固定导航、路由框架和可安全占位的页面槽位。
- 阶段 2：允许页面级 spec 接入具体路由内容，但不重新定义全局 shell taxonomy。
- 阶段 3：通过显式宿主边界扩展未来 Electron packaging，而不是把宿主行为混入 Web shell。
