# 研究记录：MVP 操作 Web UI 框架

## 决策：在现有 control-plane app 中实现 025

**理由**：`apps/control-plane/app/_components/app-shell.tsx` 已经承载当前 primary navigation、route title、主题选择器和 Settings modal；`apps/control-plane/app/page.tsx` 承载 Control Plane overview。把 025 留在这个 app 中，可以避免创建第二个 UI 入口，并复用现有本地验证命令。

**备选方案**：

- 新建独立 demo app：拒绝。025 是 MVP shell framework，不是脱离产品的原型展示。
- 只维护静态 mockups：拒绝。shell contract 必须成为 025 后续页面实现切片的接入框架。

## 决策：025 中页面行为保持占位或只读

**理由**：025 应先建立稳定导航、路由承载、布局范式、主题、本地化和占位行为。并入本目录的页面材料是实现输入，不自动成为已交付的 `Overview`、`Inbox`、`New Task`、`Projects`、`Settings` 或 `Recent Sessions` 行为。

**备选方案**：

- 现在实现完整页面行为：拒绝。这样会把后续页面级 spec 折叠回 025。
- 等页面实现完成后再添加路由：拒绝。shell taxonomy 本身必须先具体、可导航。

## 决策：先使用框架拥有的固定 shell data，再考虑更深层 routing

**理由**：第一阶段 shell 可以在 `_components/app-shell.tsx` 中使用本地 route model，并让现有 route pages 提供内容。这样能先验证产品 taxonomy 和布局 contract，而不另建平行 shell。

**备选方案**：

- 立即为每个页面添加 filesystem routes：推迟到页面级 spec 需要 route-level code splitting 或数据边界时再做。
- 保留当前 workbench 的 anchor-only 导航：拒绝。它不能表达已批准的 shell taxonomy。

## 决策：保留当前主题系统，只增加 shell 层 preference seam

**理由**：`theme-system.ts` 已定义 config-driven themes 和 CSS variables。025 应复用该系统，只在必要处增加 framework-owned locale/theme preference scaffolding，而不是重启 design-system 工作。

**备选方案**：

- 替换主题系统：拒绝。没有必要，风险也过高。
- 完全推迟主题和本地化：拒绝。它们是 025 中明确的框架层要求。

## 决策：不新增 service contract

**理由**：本功能不新增 API endpoint、持久化、MCP tool、runner protocol field 或 provider 行为。相关 contract 是 `contracts/shell-contract.md` 中记录的 UI shell contract。

**备选方案**：

- 增加后端 route metadata API：拒绝。当前切片使用静态 shell taxonomy 已经足够。
