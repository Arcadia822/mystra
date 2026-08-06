# 任务：MVP 操作 Web UI 框架

**Input**：来自 `/specs/025-webui/` 的设计文档
**Prerequisites**：`plan.md`、`spec.md`、`research.md`、`data-model.md`、`contracts/shell-contract.md`、`prototype.md`

**Tests**：025 会改变用户可见 shell 行为，因此需要包含聚焦 typecheck/test 任务和浏览器验证。

## 阶段 1：准备

- [x] T001 审查 `specs/025-webui/contracts/shell-contract.md`，在编辑 `apps/control-plane/app/_components/app-shell.tsx` 前确认已批准 route taxonomy 与 035/036 对象页迁移策略
- [x] T002 [P] 审查 `apps/control-plane/app/theme-system.ts` 中的当前 theme contract
- [x] T003 [P] 审查 `apps/control-plane/app/globals.css` 中的当前 shell styles
- [ ] T004 [P] 打开 `specs/025-webui/prototype.md` 指向的独立 HTML 原型，确认实现前参考表面可访问

## 阶段 2：基础 Shell 模型

- [x] T005 在 `apps/control-plane/app/_components/app-shell.tsx` 中定义 `New`、`Search`、`Inbox`、`Issues`、Project-grouped Tasks、Settings action 与 framework-owned labels
- [x] T006 在 shell components 中增加 framework-owned locale copy scaffolding，用于 navigation 与 Settings 文案
- [x] T007 在 `apps/control-plane/app/globals.css` 中更新 shell 层 CSS primitives，用于 12px typography、navigation、Task status icon、active state 与 narrow viewport navigation

## 阶段 3：用户故事 1 - 操作员使用已批准的 Shell 框架（优先级：P1）

**目标**：Operator 可以打开 shell，只看到已批准顶层 routes，并在 shell-valid page frames 之间导航。

**独立测试**：在 desktop 与 narrow viewport 打开 app，确认 primary navigation 只包含 `New`、`Search`、`Inbox`、`Issues`，并确认 `/automations` 直接访问时只显示 `Coming soon`、Project-grouped Tasks 与 Settings modal 可达。

- [x] T008 [US1] 在 `apps/control-plane/app/_components/app-shell.tsx` 中用已批准 primary/secondary taxonomy 替换当前 rail taxonomy
- [ ] T009 [US1] 在 `apps/control-plane/app/_components/app-shell.tsx` 与现有 route pages 中为每个已批准 surface 渲染一致 route frame
- [ ] T010 [US1] 确保尚无实现切片的 route page 显示 placeholder 或 read-only framing，同时保留 035/036 已交付对象页
- [x] T011 [US1] 在浏览器中验证 desktop 与 narrow viewport navigation 行为

## 阶段 4：用户故事 2 - 后续页面实现切片接入 Shell 而不重新定义 Shell（优先级：P1）

**目标**：025 的后续页面实现切片可以接入 route content，而不改变全局 taxonomy 或 shell ownership。

**独立测试**：审查 route model，确认单个 route 可以接收专属 content，同时保留 navigation 与 layout contracts。

- [ ] T012 [US2] 在 `apps/control-plane/app/_components/app-shell.tsx` 中通过 route id 与 layout archetype helper 隔离 route content framing
- [ ] T013 [US2] 在 `apps/control-plane/app/page.tsx` 与对象 route pages 中把当前 operational panels 映射到适合的已批准 surface，不删除现有业务能力
- [ ] T014 [US2] 在尚未实现的 route placeholder copy 中记录后续 implementation-slice ownership notes

## 阶段 5：用户故事 3 - 操作员跨设备、主题和语言环境使用 Shell（优先级：P2）

**目标**：Theme、appearance、locale scaffolding 与 responsive navigation 在整个 shell 中保持可用。

**独立测试**：切换 themes，检查 framework-owned copy，并在 desktop 与 narrow viewport 验证 shell。

- [x] T015 [US3] 在 `apps/control-plane/app/_components/app-shell.tsx` 中保留现有 theme persistence，并应用到新的 shell route frames
- [x] T016 [US3] 在 shell components 中把 locale scaffolding 应用到 framework-owned labels 与 Settings text
- [x] T017 [US3] 在 `apps/control-plane/app/globals.css` 中更新 narrow viewport navigation 的 responsive shell styling
- [x] T018 [US3] 用浏览器验证 theme switching 与 narrow viewport 行为

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

- [x] T024 运行 `pnpm --filter @mystra/control-plane typecheck`
- [x] T025 运行 `pnpm --filter @mystra/control-plane test`
- [x] T026 使用 `node scripts/render-spec-view.mjs --feature 025-webui` 重新渲染 `specs/025-webui/index.html`
- [ ] T027 在 Codex browser 中验证 `SPEC`、`FEATURES`、`CHECKLISTS`、`PROTOTYPE`、`PLAN`、`TASKS` tabs
- [x] T028 [US3] 在 `apps/control-plane/app/theme-system.ts` 中增加 Graphite Signal explicit token preset、设为默认，并用单元测试验证源 token 与 flat swatch
- [x] T029 [US4] 将 Graphite Signal 的 token、monospaced typography、0–4px radius、flat elevation 与 reduced-motion 规则同步到 `globals.css` 和 `.agents/skills/mystra-ux/`
- [x] T030 用真实浏览器验证 Graphite Signal 默认主题、Settings theme 切换、320/768/1024/1440px 视口、console 和窄视口可访问名称
- [x] T031 [US1] 实现居中 New composer，并按批准顺序呈现附件、Repository、Issue、语音与发送 controls
- [x] T032 [US1] 将 Search 实现为 native dialog modal，并复用 Task filter model
- [x] T033 [US1] 实现可持久化的 sidebar 收起/展开，并在 primary navigation 后增加 Project list
- [x] T034 [US1] 为 Inbox 新增 route，并让 Inbox 与 Issues 复用 Castrel-aligned Task table component
- [x] T035 [US1] 从主区域 header 移除本地控制平面环境说明
- [x] T036 为 shell filter、Inbox selection 和 Project grouping 增加聚焦单元测试
- [x] T037 运行最终 control-plane typecheck/test/build、GitNexus change detection、HTTP 与真实浏览器回归
- [x] T038 [US1] 将 Inbox 从共享 table 改为响应式 master-detail 布局，左侧呈现 review Task 卡片列表，右侧呈现选中 Task 详情，并保留搜索、刷新、加载、空态与完整 Task 导航
- [x] T039 [US4] 将 Castrel UX 的结构、密度、层级和交互规则平移到 `.agents/skills/mystra-ux/`，并以 dark-tech design system 替换具体配色
- [x] T040 [US1] 将 New composer 收敛到 Castrel 的 3 行高度、9/7/7/9px 输入 padding 与无分隔线 ghost footer
- [x] T041 [US1] 移除 Projects/Tasks heading count，并为 Projects heading 增加 ghost add action
- [x] T042 [US1] 将 sidebar collapse 改为完整 0px 隐藏，并在主 header 提供 brand、New 与重新展开 control
- [x] T043 运行 skill validation、control-plane typecheck/test/build、GitNexus change detection、HTTP 与真实浏览器回归
- [x] T044 [US4] 以 `component-migration.md` 固定 Castrel v2 来源提交、当前表面迁移边界、源到目标组件映射和 token 约束
- [x] T045 [US3] 扩展 `theme-system.ts` 与 `globals.css` 的 semantic token 输出，覆盖通用 spacing、control height、padding、radius、modal/popup inset 和 composer 特殊 inset，并增加自动测试
- [x] T046 [US4] 建立 Mystra-owned action、surface、dialog、field 与 state 共享组件，保留原生 button/link/input/select/dialog 语义
- [x] T047 [US1] 用共享组件替换 shell、New、Search、Inbox、Issues 和 Settings 当前页面级原语，同时保留现有 API、路由和业务状态行为
- [x] T048 [US3] 审计上述表面的可见 color、background、border、focus、padding、gap、height 与 radius，消除新增页面级裸值并验证主题切换
- [x] T049 运行聚焦测试、control-plane typecheck/test/build、GitNexus `detect_changes`、HTTP 与 320/768/1024/1440px 真实浏览器回归；79/79 tests、typecheck、production build、HTTP 200、四档 breakpoint、theme/modal/sidebar/accessibility 与零 console error/warning 均通过
- [x] T050 [US3] 将 spacing/radius/control-height/responsive role token 与首帧主题合同写入 025 UX Intent 和 `.agents/skills/mystra-ux/`
- [x] T051 [US3] 用主题测试锁定所有 preset 的 monospace、0/2/4/6px radius 与 hydration 前保存主题 bootstrap
- [x] T052 [US1] 将 `<=1024px` sidebar 改为默认关闭的 accessible overlay，并让 shell、Inbox 与 Issues 复用单一 `/api/tasks` 轮询资源
- [x] T053 [US3] 用命名 role token 收敛 shell、Search、Inbox、table、Settings、Projects 与共享 page frame 的 padding、gap、radius 和 control density，保留 composer 9/7/7/9px 特例
- [x] T054 重新渲染 025 Spec View，并运行 control-plane test/typecheck/build、GitNexus `detect_changes`、HTTP 与 320/768/1024/1440px 真实浏览器回归
- [x] T055 [US3] 将 Castrel Settings Modal 的 920×760 双栏容器、240px identity/search/tab 导航、44px 内容标题栏与 responsive reflow 迁移到 `shell-settings.tsx` 和 `globals.css`，同时保留 Mystra Theme/Language 契约与 dark-tech token
- [x] T056 更新 Settings 专用独立 HTML 原型并重新渲染 025 Spec View
- [x] T057 运行 control-plane typecheck/test/build、GitNexus change detection、HTTP 与真实浏览器 Settings 回归；76/76 tests、production build、1280 桌面与 320/768/1024/1440 responsive、tab/search/Escape/backdrop 和 accessibility tree 均通过。Settings 交互未产生 console 错误；页面仍有一条来自并发 `layout.tsx` theme bootstrap `<script>` 的 React console error，本切片未越界修改该启动路径
- [x] T058 [US4] 按 owner feedback 移除所有 input/textarea/select 及 Settings/New/Inbox field container 的 focus accent border、outline 与 halo，保留非输入命令控件的 keyboard-visible focus，并完成自动测试和真实浏览器回归；80/80 tests、New/Search/Settings/Inbox/Issues computed-style 验证与零 console error/warning 均通过
- [x] T059 [US3] 按 owner feedback 将 Settings 重组为 `Account`、`Appearance`、`Team`、`Integrations` 四个 Tab，把 Theme/Language 收入 Appearance、GitHub connection 保留在 Integrations，并用 Mystra-owned `SettingGroup` / `SettingRow` 对齐 Castrel v2 设置行 anatomy；Account/Team 未支持写操作保持诚实只读。
- [x] T060 重新渲染 025/039 Spec View，并运行 11/11 focused tests、96/96 control-plane tests、typecheck、production build、`git diff --check` 与真实浏览器回归；四 Tab、搜索、Theme/Language、GitHub 状态、320/768/1024/1440px、accessibility tree 和 0 console error/warning 均通过。本地 `file://` Spec View 被应用内浏览器安全策略拒绝，未规避策略。
- [x] T061 [US4] 按 owner feedback 新增 `SidebarVisual` 组件族，将 sidebar leading icon、mark、status、trailing badge 与 icon button 收敛到统一 16px icon、24px desktop trailing slot、1.7 stroke 和同一 transition 模板，并用结构测试、computed-style 和 320/768/1024/1440px 真实浏览器验证。
- [x] T062 [US1] 按 owner feedback 修复 New Task 页面：Logo 放大并移除相邻文案；以 Mystra-owned `UiDropdown` 和 `Project` 术语替换 native Repository select；移除无效配置提示与 Issue select；Project 选定后在输入框下方加载、选择 repository-scoped Issue 卡片并复用既有 dispatch API；以 2px 右下补偿把 composer 有效视觉 inset 统一为 9px。
- [x] T063 [US1] 按 owner feedback 从 primary navigation 移除 `Automations`，删除 shell-local utility view 状态，并新增只显示 `Coming soon` 的 `/automations` 直接路由；同步 5xP、constitution、025 合同、回归测试与浏览器验证。136/136 control-plane tests、typecheck、production build、直接路由与主菜单浏览器回归均通过。
- [x] T064 [US3] 先用 `theme-system.test.ts` 写失败测试，再在 `theme-system.ts` 建立 versioned `AppearancePreferences` default/parse/normalize/resolve contract；覆盖损坏 JSON、无效 mode/border/code variant、跨 variant theme id、越界 contrast/font size、light/dark/System resolution 与 hydration bootstrap。验证：4 项预期失败后实现，theme suite 与全量 control-plane tests 通过。
- [x] T065 [US4] 先扩展组件迁移契约测试，再新增 Mystra-owned `ui-preference-controls.tsx` 共享 segmented 与 range controls；保证真实 input/button、ARIA group/pressed、keyboard focus、共享 24/28px density 和 semantic token styling。验证：组件契约先红后绿。
- [x] T066 [US3] 将 `AppShell`、`ShellSettings` 与 `AppearanceSettingsPanel` 接入 normalized Appearance state：Language、System/Light/Dark、三种 border mode、code surface、亮暗主题分别设置、预览、contrast、UI/Chat/Code font、UI/Chat size 和 reset；只写 versioned localStorage，不创建 API/RDB。验证：focused tests、typecheck 与 production build 通过。
- [x] T067 [US3] 用真实浏览器验证 Appearance mode/theme 分离、border/code surface、细节预览与 reset、刷新恢复、keyboard、320/768/1024/1440px 和 0 console error/warning；System resolution、media contract、损坏值 fallback 由 deterministic unit/static contract 覆盖；同步 `prototype.md`、`mockups/settings-modal.html` 与 Spec View。
- [x] T068 运行 control-plane 全量 test/typecheck/build、`git diff --check`、HTTP 200 与 GitNexus `detect-changes`；143/143 tests、typecheck、production build、diff check、HTTP 200 和 Spec View render 通过。GitNexus 对整个未暂存 dirty worktree 报告 70 files / 262 symbols / 112 flows / CRITICAL；其中包含 5xP、Prisma、integration connection 等并发改动，不能归因于本 Appearance 切片；本切片预编辑 upstream 结果为 `buildThemeCssVariables` / `AppearanceSettingsPanel` HIGH、`AppShell` / bootstrap / settings shell LOW，实际修改限制在 theme、Settings、AppShell、共享 preference controls、CSS/tests 与 025 artifacts。

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
