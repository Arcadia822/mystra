# 评审清单：025-webui

## Owner 评审

- [ ] 确认 primary navigation 严格为 `Overview`、`Inbox`、`New Job`、`Projects`，并确认 `Settings` modal 与 `Recent Jobs` secondary route 的可达性。
- [ ] 确认 025 只负责 shell/framework 范围，不吞并页面级业务行为。
- [ ] 确认并入 025 的页面探索材料仍与已实现行为分离，后续按独立实现切片推进。
- [ ] 确认 Web UI shell 仍低于 API、Skill/MCP 和 CLI 等管理事实来源。
- [ ] 确认 `prototype.md` 已提供可打开的独立 HTML 原型入口，而不是把文字说明伪装成原型。

## Spec 就绪度

- [ ] `spec.md` 已描述 shell 层用户场景、需求、实体与成功标准。
- [ ] 框架负责的事项已经明确：导航、侧边栏、路由承载、布局范式、基础组件、主题、本地化、响应式与 Electron 兼容边界。
- [ ] 被推迟的页面行为已与 shell 行为分离。
- [ ] MVP 排除项足够可见，避免后续 agent 把它们偷偷塞回当前切片。
- [ ] 面向用户、评审者和后续 agent 的说明默认使用中文，必要英文仅保留为标识符、路径、命令或产品名。

## 后续插件检查

- [ ] `FEATURES` tab 通过固定路径加载本文件的同级 `features.md`。
- [ ] `CHECKLISTS` tab 通过固定路径加载本文件。
- [ ] `PROTOTYPE` tab 通过固定路径加载 `prototype.md`，并由该文件指向独立 HTML 原型。
- [ ] renderer 不解析 `spec.md` heading，也不从标准 Spec-Kit 文件中推断产品结构。
