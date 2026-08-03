# 实施计划：MVP 操作 Web UI 框架

**Branch**: 本地 `main`（逻辑 feature id `025-webui`） | **Date**: 2026-05-20 | **Spec**: `specs/025-webui/spec.md`
**Input**: 来自 `/specs/025-webui/spec.md` 的功能规格

## 摘要

将 025 Web UI 框架实现为现有 `@mystra/control-plane` Next.js 应用的 shell 层。实现目标是把当前 `Control Plane`、`Tasks`、`Runners`、`Projects` 导航迁移到已批准的 shell 合同：primary navigation 为 `Overview`、`Inbox`、`New Job`、`Projects`，`Settings` 作为 shell modal，`Recent Jobs` 作为 secondary route；035/036 已交付对象页继续可达。

## 技术上下文

**Language/Version**: TypeScript 5.9, Node.js 24
**Primary Dependencies**: Next.js 16, React 19, 现有 control-plane theme system
**Storage**: 仅使用浏览器 `localStorage` 保存 shell 偏好；不改变业务状态存储
**Testing**: `pnpm --filter @mystra/control-plane typecheck`, `pnpm --filter @mystra/control-plane test`, 浏览器预览验证
**Target Platform**: 桌面优先的内部 Web UI，并响应窄视口
**Project Type**: Next.js Web 应用
**Performance Goals**: 本 shell 切片不新增超出现有 control-plane 数据获取之外的轮询或 API 调用
**Constraints**: 保持 API-truth 和 headless management 优先级；不加入页面级产品行为、caller auth、logs API、retry API 或 hosted tenancy 功能
**Scale/Scope**: `apps/control-plane/app` 中的一个 shell 框架，四个 primary routes、两个 secondary surfaces、三个 layout archetype，theme/i18n 脚手架

## 宪章检查

- **规格拥有产品边界**：通过。025 仍是 shell/framework 范围，并明确延后页面级行为。
- **服务边界使用类型化合同**：通过。本计划不引入 API、持久化、MCP 或 runner 合同变更。
- **Provider 是可替换边界**：通过。不变更 provider 实现。
- **Runner 隔离和 secret hygiene**：通过。不变更 runner、容器或 secret 处理。
- **交付前验证与文档**：必须执行。plan、contracts、tasks 和浏览器验证需要与 shell 行为保持一致。

## 项目结构

### 本功能文档

```text
specs/025-webui/
├── spec.md
├── features.md
├── checklists.md
├── prototype.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── shell-contract.md
└── tasks.md
```

### 源码结构

```text
apps/control-plane/
└── app/
    ├── _components/app-shell.tsx
    ├── globals.css
    ├── layout.tsx
    ├── page.tsx
    └── theme-system.ts
```

**结构决策**：本切片保留在现有 control-plane app 中。`_components/app-shell.tsx` 是 shell taxonomy、主题和 Settings action 的第一实现面；现有 route pages 继续拥有对象页内容，尚未实现的页面保持 placeholder/read-only。

## 设计与实施方向

- 在 `_components/app-shell.tsx` 中定义小型 shell model：已批准导航项、route id、layout archetype、框架自有 label 和 placeholder state。
- 保留 `theme-system.ts` 中的现有主题系统；只在 shell preference 需要稳定表面时扩展。
- 为框架自有文案引入 i18n 脚手架，不在本切片翻译页面级业务行为。
- 将当前 Control Plane、Tasks、Runners 与 Projects 对象页显式映射到目标 primary/secondary surfaces；不通过导航重构删除已交付能力。
- 代码现实依据：现有 shell 在 `apps/control-plane/app/_components/app-shell.tsx`，overview 在 `apps/control-plane/app/page.tsx`，主题在 `apps/control-plane/app/theme-system.ts`，视觉方向和 shell mockup 函数在 `specs/025-webui/mockups/render-mockups.cjs`。

## 阶段 0：研究

研究决策记录在 `research.md`。

## 阶段 1：设计

设计产物：

- `data-model.md`：shell 级实体和偏好概念。
- `contracts/shell-contract.md`：路由 taxonomy、layout archetype、placeholder、theme、locale 和 Electron 兼容合同。
- `quickstart.md`：桌面、窄视口、主题、语言环境和路由 placeholder 行为的验证路径。
- `prototype.md`：可打开的独立 HTML 原型入口和覆盖范围。

## 复杂度追踪

不需要 constitution 例外或复杂度豁免。
