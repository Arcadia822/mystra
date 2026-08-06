# 实施计划：MVP 操作 Web UI 框架

**Branch**: 本地 `main`（逻辑 feature id `025-webui`） | **Date**: 2026-05-20 | **Spec**: `specs/025-webui/spec.md`
**Input**: 来自 `/specs/025-webui/spec.md` 的功能规格

## 摘要

将 025 Web UI 框架实现为现有 `@mystra/control-plane` Next.js 应用的 shell 层。当前切片复刻 Castrel 的紧凑侧边栏结构：primary menu 为 `New`、`Search`、`Inbox`、`Issues`，其下用 Project 分组展示 Tasks，Task icon 映射最新 Session 状态，`Settings` 作为底部 modal 入口并承载 theme/language。`/automations` 不进入主菜单，仅保留 `Coming soon` 直接路由；035/036 已交付对象页继续可达。

## 技术上下文

**Language/Version**: TypeScript 5.9, Node.js 24
**Primary Dependencies**: Next.js 16, React 19, 现有 control-plane theme system, Castrel UX implementation/reference, dark-tech design system
**Storage**: 仅使用浏览器 `localStorage` 保存 shell 偏好；不改变业务状态存储
**Testing**: `pnpm --filter @mystra/control-plane typecheck`, `pnpm --filter @mystra/control-plane test`, 浏览器预览验证
**Target Platform**: 桌面优先的内部 Web UI，并响应窄视口
**Project Type**: Next.js Web 应用
**Performance Goals**: shell 只轮询现有 `/api/tasks` 与 `/api/projects`，不新增 API 或持久化合同
**Constraints**: 保持 API-truth 和 headless management 优先级；不加入页面级产品行为、caller auth、logs API、retry API 或 hosted tenancy 功能
**Scale/Scope**: `apps/control-plane/app` 中的一个 shell 框架，五个 primary menu entries、一个 Project-grouped Tasks section、Settings modal、三个 layout archetype，theme/i18n 脚手架

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

- 组件迁移以 `component-migration.md` 为清单：来源固定为 Castrel v2 `castrel-demo-v2` 的 `cdce88e2fff4667f306961ded4995d14b987a17e`，只迁移当前 025 表面实际使用的通用组件 anatomy、density、padding 与交互状态。
- 在 `_components` 下建立 Mystra-owned 共享 UI 原语，并用它替换 shell、New、Search、Inbox、Issues 与 Settings 中的页面级 action、surface、field、dialog 和 state 实现。
- spacing、control height、padding、radius、surface、text、border、focus 和 semantic signal 全部通过 `theme-system.ts` 输出的 CSS token 消费；Castrel 的 `9/7/7/9px` composer inset 等非 4px 特殊值必须使用命名 token。
- 在 `_components/app-shell.tsx` 中定义小型 shell model：已批准菜单项、Project-grouped Task navigation、框架自有 label 和 placeholder state。
- 保留 `theme-system.ts` 的 config-driven 架构；默认暗色 preset 继续使用不经混色的 explicit token map，并以 dark-tech palette 为颜色事实来源；保留其他 preset 以满足 025 的 light/dark theme scaffold。
- 将 Castrel UX 的布局、密度和交互规则与 dark-tech 的 monospaced typography、0/2/4/6px radius、flat elevation、signal semantics、reduced-motion 规则同步到 `globals.css` 和 `mystra-ux` durable reference。
- 为框架自有文案引入 i18n 脚手架，不在本切片翻译页面级业务行为。
- 将现有 Task、Session、Runner 与 Project 对象页保留为直接可达 routes；不通过导航重构删除已交付能力。
- 代码现实依据：现有 shell 在 `apps/control-plane/app/_components/app-shell.tsx`，overview 在 `apps/control-plane/app/page.tsx`，主题在 `apps/control-plane/app/theme-system.ts`，视觉方向和 shell mockup 函数在 `specs/025-webui/mockups/render-mockups.cjs`。

### UX Intent：Settings Modal 布局迁移

- **目标**：将 `/Users/arcadia/Documents/castrel-ai/frontend/components/pages/settings/SettingsModal.tsx` 的设置容器布局与紧凑交互语言迁移到 Mystra，并按 `Account`、`Appearance`、`Team`、`Integrations` 四个 Tab 梳理信息架构；Theme 与 Language 归入 Appearance，租户术语使用 Team。
- **保留**：Mystra 现有 Theme/Language 数据、localStorage key、即时切换语义、GitHub connection 行为、中文/英文框架文案和 native dialog 键盘行为。
- **迁移**：`920px × 760px` 上限、`240px + minmax(0,1fr)` 双栏、44px 内容标题栏、左侧 identity/search/tab 导航、28px 紧凑控件、内容区独立滚动，以及窄屏单栏重排。
- **设置行组件**：复用已迁移的 Mystra-owned `SettingGroup` / `SettingRow`，对齐 Castrel v2 的左侧标题/说明、右侧控件 anatomy 和 32px 行间距；不复制 Castrel 业务状态或 palette。
- **不迁移**：Castrel 的 Workspace、Billing、Usage、Agent permissions 等业务能力；Account 与 Team 在当前 MVP 只诚实显示只读/不可用状态，不创建 UI-owned 持久化。Castrel 的暖色具体 token、14px 圆角与 modal shadow也不迁移。
- **状态与无障碍**：覆盖 selected、hover、focus、无搜索结果、320/768/1024/1440px；tab 使用 `tablist/tab/tabpanel` 语义，modal 使用 native `<dialog>` 保持 focus trap、Escape 和 backdrop close。
- **影响依据**：GitNexus 对 `ShellSettings` 与 `AppShell` 的 upstream 分析均为 LOW；唯一直接调用方为 `AppShell`，间接影响 `RootLayout`，不触及 API、持久化或 Runner 流程。

### UX Intent：主题与密度一致性修复

- **体验问题**：当前 shell 在 768px 仍保留 300px sidebar，在 320px 初始覆盖内容；页面、搜索、Inbox、表格和设置多次叠加 inset，桌面按钮统一膨胀到 44px；主题切换还存在首帧回退到默认色和非默认 preset 改用比例字体的问题。
- **影响表面**：共享 shell/header/sidebar、New、Search、Inbox、Issues/Tasks table、Projects 与对象页的通用 page frame、Settings、所有 selectable theme preset，以及 loading/empty/error/selected/focus 状态。
- **固定规则**：使用 4/8/12/16/20/24/32/48/96px spacing scale；page inline 为桌面 16px/窄屏 12px，page top 12px、bottom 32px，panel 16px、modal 20px、popup 16px，layout gap 12px，stack gap 8px；composer 的 9/7/7/9px 是明确来源特例。radius 只允许 0/2/4/6px。Castrel-derived action 为 compact 24px、header/navigation 28px、default 32px，standard field 36px，coarse pointer hit target 44px。
- **主题规则**：所有 preset 保持 Fira Code/Maple Mono monospace；保存的主题必须在 React hydration 前同步应用，hydration 未读取 preference 前不得回写默认主题。
- **响应式与无障碍**：`<=1024px` sidebar 变为默认关闭的 overlay，由共享 header 打开，带关闭按钮、backdrop 和 route-change dismissal；`<=700px` 内容列堆叠。桌面视觉密度不得以牺牲 44px touch hit area、focus、ARIA name 或键盘关闭能力为代价。
- **数据与性能**：shell、Inbox 与 Issues 对 `/api/tasks` 使用同一共享轮询资源，避免三个组件独立请求相同数据；不改变 API、缓存或持久化合同。
- **风险与验证**：GitNexus 对 `AppShell`、`RootLayout`、`buildThemeCssVariables`、`applyThemeToDocument`、`TasksPage` 和 `InboxPage` 的 upstream 风险均为 LOW。用主题单测、control-plane 全量 test/typecheck/build、GitNexus change detection、HTTP 200，以及 1440/1024/768/320px 真实浏览器检查首帧主题、字体、sidebar、overflow、control height、focus 与 console。

### UX Intent：Castrel Appearance 能力迁移

- **目标**：把 `/Users/arcadia/Documents/castrel-ai/frontend/components/pages/settings/appearance/AppearanceSettings.tsx`、`useAppearanceSettings.ts` 与 `lib/theme/castrelTheme.ts` 中面向用户的外观能力迁移到 Mystra Appearance Tab，同时保留 Mystra-owned theme definitions、共享组件和 dark-tech semantic token。
- **能力范围**：语言；`System` / `Light` / `Dark`；`Default` / `High Contrast` / `Color High Contrast`；代码表面 `Light` / `Dark`；浅色主题和深色主题分别选择；预览；0–100 对比度；UI/Chat/Code 字体；UI 12–14px 与 Chat 12–16px 字号；复位主题细节。
- **状态模型**：`AppearancePreferences` 是纯浏览器 preference，不是业务实体。`AppShell` 持有 normalized state，`prefers-color-scheme` 只负责把 `System` 解析为当前 variant。状态变化即时应用到 `documentElement`，并写入单一 versioned localStorage JSON；首帧 bootstrap 使用同一 normalization/default contract 的序列化数据。
- **数据流**：`localStorage -> parse/normalize -> resolve active variant -> resolve variant theme -> build semantic CSS variables -> documentElement dataset/style`。Settings 控件只发送 partial preference update，不直接操作 DOM 或选择 palette。
- **复用与隔离**：扩展现有 `theme-system.ts`，不引入 Zustand、`next-themes`、Castrel service API 或数据库表。`UiDropdown` 继续承担 theme select；在 Mystra-owned field/action primitives 中补充 segmented 与 range anatomy，字体使用现有 input。运行时只消费 Mystra 的四个现有 theme presets，不复制 Castrel 全量主题目录。
- **失败策略**：损坏 JSON、未知 mode/border/variant、跨 variant theme id、非有限数值和越界字号必须逐字段回退；`System` listener 必须清理；localStorage 不可用时仍能以 Graphite Signal 默认值启动。Appearance 未产生网络、API 或 RDB failure state。
- **性能**：所有变更是 O(theme token count) 的同步浏览器操作；只在 preference 或 system variant 变化时写 CSS variables，不引入轮询或渲染期存储读取。
- **NOT in scope**：服务端/RDB persistence、账户同步、多设备同步、Castrel SDK theme override、通知 toast、外部字体下载、Castrel 全量 theme preset 迁移，以及当前 Mystra 尚不存在的独立 terminal/chat product surface。
- **验证**：主题纯函数单测覆盖 normalization、variant resolution、bootstrap、contrast/border/code surface/font token；组件契约测试覆盖共享 controls；真实浏览器覆盖 mode/theme 分离、system media change、preview/reset、local refresh、320/768/1024/1440px、键盘与 console。

```text
Appearance controls
        |
        v
partial preference update
        |
        v
normalize + localStorage --------> hydration bootstrap
        |
        v
mode + prefers-color-scheme
        |
        v
lightScheme / darkScheme
        |
        v
theme preset + detail overrides
        |
        v
semantic CSS variables + dataset
```

### 工程评审结论：Castrel Appearance 能力迁移

- **Scope Challenge**：现有 theme presets、CSS variable builder、首帧 bootstrap、AppShell localStorage owner、Settings four-tab anatomy 与 shared dropdown 已覆盖大部分基础；最小完整方案只扩展这些 seams，不迁移 Castrel store/service/dependencies。
- **Architecture**：0 个未解决问题。纯 preference resolver 是运行态和 bootstrap 的唯一真相；服务端 persistence 明确不在范围。
- **Code Quality**：0 个未解决问题。使用显式 union、clamp、variant guard 和 partial update；不在 Settings panel 复制 token 计算。
- **Tests**：覆盖图与 failure modes 已写入 `checklists/engineering-review.md`；损坏 storage、System listener、variant mismatch、细节 reset 和 responsive/browser flow 均进入 tasks。
- **Performance**：0 个问题。固定规模 token map，单一 media listener，只在依赖变化时应用。
- **What already exists**：`CONTROL_PLANE_THEMES`、`buildThemeCssVariables`、`buildThemeBootstrapScript`、`AppShell` preference effects、`UiDropdown`、`SettingGroup` / `SettingRow` 全部复用。
- **NOT in scope**：RDB/API persistence、跨设备同步、Castrel SDK override、toast、外部字体下载、Castrel 全量 preset 和独立 terminal/chat 业务页面。
- **Failure modes**：非法本地值由单元测试覆盖并 fail closed；localStorage 不可用时保留默认主题；没有网络错误路径或 silent critical gap。
- **Parallelization**：顺序实施，无独立 worktree lane；theme model -> shared controls -> shell/settings wiring -> browser/full verification。

### UX Intent：Sidebar Visual Slot 一致性修复

- **体验问题**：sidebar 的 leading icon、Task status、section mark、trailing count badge 和 icon button 分别维护尺寸、padding 与位置，导致同一右侧列的 badge 与按钮中心线漂移，图标视觉规范也无法由一个组件合同保证。
- **影响表面**：共享 sidebar header、primary navigation、Projects/Tasks section、Project/Task row 与 Settings 入口；不改变 route、API、数据加载或业务状态。
- **复用规则**：所有 sidebar 图标、mark、status、count badge 与 icon button 必须通过 `SidebarVisual` 组件族。leading slot 固定为 16px；desktop trailing slot 固定为 24px；Shell icon 固定为 16px、`stroke-width: 1.7`，共享相同的颜色、透明度、位移与背景 transition 模板。coarse pointer 下 trailing slot 与 icon button 一起扩大为 44px。
- **对齐规则**：trailing icon、badge 与 icon button 共享同一 slot 宽度和右边界；badge 只改变内部内容宽度，不改变 slot 中心线。Project mark 与 Task status 也先进入统一 leading slot，再与 label 建立固定间距。
- **状态与无障碍**：icon-only button 继续使用真实 button 与显式 `aria-label`；Task status 保留 `role="img"`、可访问名称和语义颜色；active spinner 保留现有旋转，并由全局 `prefers-reduced-motion` 规则降级。
- **风险与验证**：GitNexus 对 `AppShell` 的 upstream 风险为 LOW，唯一直接调用方是 `RootLayout`。用 sidebar component contract test、control-plane typecheck/test、1440/1024/768/320px 真实浏览器 computed-style 与 console 检查验证。

### UX Intent：New Task Project 与 Issue 选择修复

- **体验问题**：New 页面重复显示 Logo 右侧文案，原生 select 与 composer ghost controls 不同构，`Repository` 错误替代了 `Project`，不可用 Issue select 和配置提示还占用空间；32px send action 令 9/7/7/9px 基础 inset 的右下边缘在视觉上更紧。
- **影响表面**：仅限 New Task composer、Mystra-owned dropdown primitive、Project 选项、repository-scoped Issue loading/selection、Issue dispatch submission，以及 desktop/narrow 布局；不改变 API、数据库或 provider contract。
- **复用规则**：新增 `UiDropdown`，沿用 Castrel trigger/content/item anatomy，但使用 Mystra action、icon、surface、border、radius、motion 与 accessibility tokens。New 页面选项 label 使用 Project name，repository full name 只作为说明。Issue 不再使用下拉，改为输入框下方的紧凑可选择卡片列表。
- **几何规则**：Logo 使用 48px token 且不带相邻文案。composer 保留 9/7/7/9px 基础 inset，在 textarea 右侧和 footer 右侧/底部各补偿 2px，使四边有效视觉 inset 都为 9px；send action 保持共享 32px solid action。
- **状态与无障碍**：Project 未选定时不请求或显示 Issue；Project dropdown 支持 button/listbox 语义、方向键、Home/End、Escape、外部点击和显式 label。Issue 卡片使用真实 button、`aria-pressed`、selected surface，并覆盖 loading/error 状态。无 Project 时只保持 disabled Project trigger，不显示额外引导句。
- **风险与验证**：GitNexus 对 `NewTaskComposer` upstream 风险为 LOW，只有首页 `Page` 一个直接调用者。用先红后绿的 composer contract test、control-plane typecheck/test/build、HTTP、真实浏览器 computed-style、accessibility tree、responsive 与 console 检查验证。

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

## GSTACK REVIEW REPORT

| Review | Count | Result |
|---|---:|---|
| Engineering review | 1 | CLEAR — local-only preference model, first-frame bootstrap, failure modes and verification map defined |
| CEO review | 0 | Not requested |
| Design review | 0 | Existing Castrel Appearance reference and approved Mystra Settings anatomy used |
| Security review | 0 | No credential, API, database or new trust boundary introduced |
| Test plan | 1 | Theme-model unit tests, component contracts and browser matrix documented |

**Verdict:** ENG CLEARED. Zero unresolved issues and zero silent critical gaps.
