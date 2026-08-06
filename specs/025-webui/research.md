# 研究记录：MVP 操作 Web UI 框架

## 决策：在现有 control-plane app 中实现 025

**理由**：`apps/control-plane/app/_components/app-shell.tsx` 已经承载当前 primary navigation、route title、主题选择器和 Settings modal；`apps/control-plane/app/page.tsx` 承载 Control Plane overview。把 025 留在这个 app 中，可以避免创建第二个 UI 入口，并复用现有本地验证命令。

**备选方案**：

- 新建独立 demo app：拒绝。025 是 MVP shell framework，不是脱离产品的原型展示。
- 只维护静态 mockups：拒绝。shell contract 必须成为 025 后续页面实现切片的接入框架。

## 决策：025 中页面行为保持占位或只读

**理由**：025 应先建立稳定导航、路由承载、布局范式、主题、本地化和占位行为。并入本目录的页面材料是实现输入，不自动成为已交付的 `New`、`Search`、`Inbox`、`Issues`、`Automations`、Project-grouped Tasks 或 `Settings` 业务行为。

**备选方案**：

- 现在实现完整页面行为：拒绝。这样会把后续页面级 spec 折叠回 025。
- 等页面实现完成后再添加路由：拒绝。shell taxonomy 本身必须先具体、可导航。

## 决策：先使用框架拥有的固定 shell data，再考虑更深层 routing

**理由**：第一阶段 shell 可以在 `_components/app-shell.tsx` 中使用本地 route model，并让现有 route pages 提供内容。这样能先验证产品 taxonomy 和布局 contract，而不另建平行 shell。

**备选方案**：

- 立即为每个页面添加 filesystem routes：推迟到页面级 spec 需要 route-level code splitting 或数据边界时再做。
- 保留当前 workbench 的 anchor-only 导航：拒绝。它不能表达已批准的 shell taxonomy。

## 决策：保留主题架构，以 Castrel UX 结构配合 dark-tech 配色

**理由**：`theme-system.ts` 已定义 config-driven themes 和 CSS variables。owner 最新要求将 Castrel UX 的结构、密度和交互模式平移到 Mystra，同时以 dark-tech design system 作为具体 palette 来源。因此既有 explicit token map 继续保留，但颜色事实来源更新为 dark-tech；geometry、focus、flat elevation 与禁止渐变/阴影/glow/glass/noise 的规则同步到 `mystra-ux`。

**备选方案**：

- 删除现有主题架构并改成单一静态 CSS：拒绝。会破坏 025 已批准的 theme/appearance preference seam。
- 仅新增一组相近暗色 seed：拒绝。动态混色无法保证 dark-tech surface、hairline 和 signal token 精确落地。
- 完全推迟主题和本地化：拒绝。它们是 025 中明确的框架层要求。

**偏好迁移**：现有 local theme preference key `mystra-control-plane-theme-v2`
保持不变，避免仅因视觉来源说明更新而破坏 operator preference；operator 仍可在
Settings 中重新选择其他 preset。

## 决策：不新增 service contract

**理由**：本功能不新增 API endpoint、持久化、MCP tool、runner protocol field 或 provider 行为。相关 contract 是 `contracts/shell-contract.md` 中记录的 UI shell contract。

**备选方案**：

- 增加后端 route metadata API：拒绝。当前切片使用静态 shell taxonomy 已经足够。

## 决策：复用 Castrel 的结构原则，不复制其业务状态层

**理由**：当前参考实现使用 300px sidebar、28px row、token-derived selected/hover、
底部 Settings、root-level theme 与独立语言偏好。Mystra 只复用这些 shell
原则；Tasks 使用现有 `/api/tasks` 与 `/api/projects`，Automations 保持
presentation-only，不引入 Castrel 的会话、workspace 或 automation runtime。
