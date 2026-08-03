# 功能说明：025-webui

## 摘要

025 定义 Mystra MVP 操作 Web UI 的框架层能力。它提供面向人类操作者的稳定 shell：统一导航、侧边栏、路由承载、布局范式、基础组件期望、主题与本地化脚手架、响应式行为，以及未来 Electron 宿主兼容边界。

本功能刻意不把页面探索材料等同于已实现业务行为。`Overview`、`Inbox`、`New Job`、`Projects`、`Settings` 和 `Recent Jobs` 的业务语义、数据解释与操作动作，将作为 025 内独立实现切片接入这个 shell。

## 功能地图

- 建立 Mystra MVP 的操作型 Web UI shell。
- 固定 primary navigation：`Overview`、`Inbox`、`New Job`、`Projects`。
- 固定 secondary surfaces：`Settings` shell modal 与可直接访问的 `Recent Jobs` route。
- 为已批准页面提供共享侧边栏与路由框架。
- 定义共享布局范式：`chatLayout`、`dashboardLayout`、`readLayout`。
- 建立 shell 基础组件层，供后续页面复用。
- 保留主题、外观、本地化与响应式脚手架。
- 为未来 Electron 宿主保留兼容边界，但不提前实现桌面专属能力。

## 边界

- API 仍是管理能力的事实来源。
- Skill/MCP 与 CLI 仍是优先的可编程管理界面。
- 具体页面行为按 025 内独立实现切片承担，不能由 shell 重构顺带臆造。
- `workspace` 仍表示 run-scoped 执行上下文，不表示租户或产品组织。
- MVP 排除项继续排除：caller auth、logs API、retry API、公开 SaaS 租户管理、Kubernetes sandbox 以及相关平台能力。

## 分阶段能力图

- 阶段 1：交付共享 shell、固定导航、路由框架和可安全占位的页面槽位。
- 阶段 2：允许页面级 spec 接入具体路由内容，但不重新定义全局 shell taxonomy。
- 阶段 3：通过显式宿主边界扩展未来 Electron packaging，而不是把宿主行为混入 Web shell。
