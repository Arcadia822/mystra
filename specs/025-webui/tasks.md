# 任务：MVP 操作 Web UI 框架

**Input**：来自 `/specs/025-webui/` 的设计文档
**Prerequisites**：`plan.md`、`spec.md`、`research.md`、`data-model.md`、`contracts/shell-contract.md`、`prototype.md`

**Tests**：025 会改变用户可见 shell 行为，因此需要包含聚焦 typecheck/test 任务和浏览器验证。

## 阶段 1：准备

- [ ] T001 审查 `specs/025-webui/contracts/shell-contract.md`，在编辑 `apps/control-plane/app/_components/app-shell.tsx` 前确认已批准 route taxonomy 与 035/036 对象页迁移策略
- [ ] T002 [P] 审查 `apps/control-plane/app/theme-system.ts` 中的当前 theme contract
- [ ] T003 [P] 审查 `apps/control-plane/app/globals.css` 中的当前 shell styles
- [ ] T004 [P] 打开 `specs/025-webui/prototype.md` 指向的独立 HTML 原型，确认实现前参考表面可访问

## 阶段 2：基础 Shell 模型

- [ ] T005 在 `apps/control-plane/app/_components/app-shell.tsx` 中定义四个 primary routes、Settings action、Recent Jobs secondary route、labels、layout archetypes 与 placeholder state
- [ ] T006 在 `apps/control-plane/app/_components/app-shell.tsx` 中增加 framework-owned locale copy scaffolding，用于 route labels 和 placeholder text
- [ ] T007 在 `apps/control-plane/app/globals.css` 中更新 shell 层 CSS primitives，用于 navigation、active route state、route content frames 与 narrow viewport navigation

## 阶段 3：用户故事 1 - 操作员使用已批准的 Shell 框架（优先级：P1）

**目标**：Operator 可以打开 shell，只看到已批准顶层 routes，并在 shell-valid page frames 之间导航。

**独立测试**：在 desktop 与 narrow viewport 打开 app，确认 primary navigation 只包含 `Overview`、`Inbox`、`New Job`、`Projects`，并确认 Settings modal 与 Recent Jobs secondary route 可达。

- [ ] T008 [US1] 在 `apps/control-plane/app/_components/app-shell.tsx` 中用已批准 primary/secondary taxonomy 替换当前 rail taxonomy
- [ ] T009 [US1] 在 `apps/control-plane/app/_components/app-shell.tsx` 与现有 route pages 中为每个已批准 surface 渲染一致 route frame
- [ ] T010 [US1] 确保尚无实现切片的 route page 显示 placeholder 或 read-only framing，同时保留 035/036 已交付对象页
- [ ] T011 [US1] 在浏览器中验证 desktop 与 narrow viewport navigation 行为

## 阶段 4：用户故事 2 - 后续页面实现切片接入 Shell 而不重新定义 Shell（优先级：P1）

**目标**：025 的后续页面实现切片可以接入 route content，而不改变全局 taxonomy 或 shell ownership。

**独立测试**：审查 route model，确认单个 route 可以接收专属 content，同时保留 navigation 与 layout contracts。

- [ ] T012 [US2] 在 `apps/control-plane/app/_components/app-shell.tsx` 中通过 route id 与 layout archetype helper 隔离 route content framing
- [ ] T013 [US2] 在 `apps/control-plane/app/page.tsx` 与对象 route pages 中把当前 operational panels 映射到适合的已批准 surface，不删除现有业务能力
- [ ] T014 [US2] 在尚未实现的 route placeholder copy 中记录后续 implementation-slice ownership notes

## 阶段 5：用户故事 3 - 操作员跨设备、主题和语言环境使用 Shell（优先级：P2）

**目标**：Theme、appearance、locale scaffolding 与 responsive navigation 在整个 shell 中保持可用。

**独立测试**：切换 themes，检查 framework-owned copy，并在 desktop 与 narrow viewport 验证 shell。

- [ ] T015 [US3] 在 `apps/control-plane/app/_components/app-shell.tsx` 中保留现有 theme persistence，并应用到新的 shell route frames
- [ ] T016 [US3] 在 `apps/control-plane/app/_components/app-shell.tsx` 中把 locale scaffolding 应用到 framework-owned labels 与 placeholder text
- [ ] T017 [US3] 在 `apps/control-plane/app/globals.css` 中更新 narrow viewport navigation 的 responsive shell styling
- [ ] T018 [US3] 用浏览器验证 theme switching 与 narrow viewport 行为

## 阶段 6：用户故事 4 - 前端维护者复用共享布局和组件（优先级：P2）

**目标**：Maintainer 可以用 `chatLayout`、`dashboardLayout`、`readLayout` 和 shared shell primitives 组合后续页面。

**独立测试**：检查 route frames，确认每个已批准 layout archetype 都作为 reusable pattern 出现。

- [ ] T019 [US4] 在 `apps/control-plane/app/_components/app-shell.tsx` 或专用共享组件中实现 `chatLayout`、`dashboardLayout`、`readLayout` frame variants
- [ ] T020 [US4] 在 `apps/control-plane/app/globals.css` 中增加三个 layout archetypes 的 CSS classes
- [ ] T021 [US4] 验证现有 route pages 中每个 layout archetype 至少被一个已批准 surface 使用

## 阶段 7：用户故事 5 - 未来桌面封装保留同一框架合同（优先级：P3）

**目标**：shared shell contract 对未来 Electron host 保持可移植。

**独立测试**：审查 shell code，确认 host-specific behavior 没有写入 route taxonomy、theme、locale 或 layout ownership。

- [ ] T022 [US5] 在 `apps/control-plane/app/_components/app-shell.tsx` 中避免把 host-specific assumptions 写入 shell route definitions
- [ ] T023 [US5] 在 `apps/control-plane/app/_components/app-shell.tsx` 的 shell constants 附近增加显式 host compatibility comment

## 阶段 8：验证

- [ ] T024 运行 `pnpm --filter @mystra/control-plane typecheck`
- [ ] T025 运行 `pnpm --filter @mystra/control-plane test`
- [ ] T026 使用 `node scripts/render-spec-view.mjs --feature 025-webui` 重新渲染 `specs/025-webui/index.html`
- [ ] T027 在 Codex browser 中验证 `SPEC`、`FEATURES`、`CHECKLISTS`、`PROTOTYPE`、`PLAN`、`TASKS` tabs

## 依赖与执行顺序

- 阶段 1 可以立即执行。
- 阶段 2 阻塞所有 story work。
- US1 与 US2 都是 P1；先实现 US1，让 route navigation 存在，再实现 US2，让后续页面实现切片获得稳定 attachment points。
- US3 与 US4 可在阶段 2 完成、且 US1 route frame 存在后推进。
- US5 在 shell constants 存在后独立推进。
- 验证在选定 implementation slice 之后执行。

## 并行机会

- T002、T003、T004 可以并行。
- T015/T016 与 T017 可以在 route frames 存在后按 `page.tsx` 与 `globals.css` 拆分。
- T019 与 T020 可以在 layout names 固定后按 `page.tsx` 与 `globals.css` 拆分。

## 实施策略

1. 先构建 shell route model 和 navigation。
2. 在优化 content 前，让每个已批准 route 都渲染一个有效 frame。
3. 除非另一个 spec 拥有页面行为，否则保持 placeholder/read-only。
4. 每个 story 独立验证后，再继续更广泛的 polish。
