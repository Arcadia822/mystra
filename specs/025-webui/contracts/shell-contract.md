# Shell Contract：025-webui

## Route Taxonomy

MVP shell 使用以下 route 与 shell action taxonomy：

| Surface ID | Label | Placement | Default Layout | 025 State |
| --- | --- | --- | --- | --- |
| `new` | `New` | primary navigation | `chatLayout` | centered Task composer |
| `search` | `Search` | primary navigation | shell utility | modal Task filtering and navigation |
| `inbox` | `Inbox` | primary navigation | `dashboardLayout` | master-detail review queue; latest Session waiting for review |
| `issues` | `Issues` | primary navigation | `readLayout` | shared table over current `/tasks` object list |
| `automations` | `Automations` | direct route only | `readLayout` | `Coming soon` placeholder |
| `projects` | `Projects` | secondary sidebar section | navigation list | directly below primary navigation; Project detail links |
| `project-tasks` | `Tasks` | secondary sidebar section | navigation list | grouped by Project; latest Session status icon |
| `settings` | `Settings` | shell action/modal | `readLayout` | placeholder/inspection |

本功能不得新增其他 primary entry。已完成 035/036 中的 Task、Session、Runner 和 Project object pages 保持可直接访问，不得静默删除对象页能力。`Automations` 不出现在主菜单中；`/automations` 仅保留可直接访问的 `Coming soon` 占位页，在本切片中不拥有 API 或持久化行为。

主侧边栏提供显式收起/展开 control，并持久化 preference。收起时 sidebar 完整压缩为 0px，不保留 icon rail；主区域 header 显示 Mystra brand、`New` action 和重新展开 control。展开时 header 只显示 surface title，不显示本地环境说明。

`New` composer 平移 Castrel 的紧凑结构：默认 3 行输入、9/7/7/9px 输入区内边距、透明且无分隔线的 ghost footer。它只调用现有 canonical Task API。附件、Issue selection 与语音输入在没有已批准 contract 时必须保持清楚的 disabled state；Repository selection 与发送可接入现有 Project/Task API。

Projects 与 Tasks section heading 不显示 count。Projects heading 右侧提供 ghost-style add action，并导航到现有 Project 创建表面。

## Global Column Anatomy

共享 shell 的桌面结构固定为 `Sidebar | Main | Right Panel?`。三列均由同高的 shell Header 和对应 Content 组成：

- `Sidebar`：`SidebarHeader + SidebarContent`，继续拥有 brand、primary navigation、Projects、Project-grouped Tasks 与 Settings。
- `Main`：`MainHeader + MainContent`，header 只承载当前 surface/path，页面继续在 content 内选择 layout archetype。
- `Right Panel`：`RightPanelHeader + RightPanelContent`，只在页面显式注册时出现，用于页面上下文、检查器或辅助操作，不拥有新的 route、API 或业务状态。

Right Panel 未注册、注册页面卸载或 route 切换后必须完全移除，Main 自动取得释放的宽度。页面不得通过 pathname 表或 shell-owned switch 伪造页面内容；注册 seam 由页面拥有并负责清理。Task 详情以 `Create Session` 作为第一个生产接入，继续调用既有 canonical Session API。

宽视口使用三列 grid；Sidebar 收起时仅其列变为 0px，Right Panel 保持页面决定的启用状态。`<=1024px` 时 Sidebar 继续使用既有 overlay 行为，Main 与 Right Panel 保持内容列；`<=700px` 时 Right Panel 按 DOM 顺序堆叠在 Main 后方。所有模式都不得产生 page-wide 横向 overflow。

## Layout Archetypes

- `chatLayout`：对话式或 intake-oriented 页面框架。
- `dashboardLayout`：用于快速扫描和操作摘要的页面框架。
- `readLayout`：阅读、检查或 settings 页面框架。

除非 025 的后续变更显式更新 framework contract，否则必须使用上述 layout 之一。

`Inbox` 是 `dashboardLayout` 的 master-detail 特化：左侧列表拥有搜索、刷新、数量、加载、空态和选中态；右侧详情只读取现有 Task 与 latest Session 投影，并链接到完整 Task 对象页，不在 Inbox 内新增执行或审批写操作。窄视口下两栏按列表在前、详情在后的顺序堆叠。

## Placeholder Behavior

当 route 尚无专属页面 spec 时，shell 仍必须渲染：

- route title。
- 框架拥有的 description。
- 与 layout 匹配的 placeholder 或 inspection content。
- 可选的 follow-on spec 指针。

shell 不得为该 route 发明页面级 action、数据解释或编辑行为。

## Theme And Locale

- Theme selection 使用现有 control-plane theme system；默认外观平移 Castrel UX 的结构与密度，并使用 dark-tech 具体配色。
- Theme import/export 使用 `codex-theme-v1:{JSON}`：`codex-theme-v1` 是 schema version，JSON 内 `codeThemeId` 是主题 ID；Mystra label/description/explicit tokens 不得写入 Codex v1 payload。
- Appearance selection 与 DOM dataset 使用 `(variant, codeThemeId)` 解析主题；同一 `codeThemeId` 可以同时拥有 light/dark variant，旧 synthetic preset id 只作为 localStorage migration input。
- 静态 Codex catalog 的来源版本固定记录为 26.730.61639，包含该版本注册的 28 个 family / 43 个 variant；更新 catalog 必须重新核对签名应用包，而不是补写记忆中的主题名称。
- Mystra 自有 family 使用 `codeThemeId: "mystra"`，light/dark 均可选；dark 保留原 Graphite explicit tokens，`graphite-signal` 仅迁移到 `dark:mystra`。
- dark-tech 必须逐项映射已批准 canvas、surface、hairline、ink、executor 与 signal tokens，不得通过 seed mixing 生成近似值。
- 全部 preset 共享 flat elevation、0/2/4/6px radius、可见 focus 与无阴影/渐变/辉光/glass/noise 规则。
- Locale scaffolding 只适用于本功能中的 framework-owned labels 与 placeholder copy。
- 默认 UI font size 为 12px。
- 内部字体角色固定为 UI / Content / Code，每个角色只保存一个 primary family；Mystra 使用 Arial / Georgia / Courier New，CSS 分别追加系统 sans / serif / monospace generic fallback。
- Codex v1 payload 仍只包含 `theme.fonts.ui` / `theme.fonts.code`；adapter 将 UI 同步给 UI 与 Content，将 Code 映射给 Code，不向外部 schema 添加字段。旧 `chatFont` 偏好只在迁移边界读取。
- 保存的 theme MUST 在 React hydration 之前同步应用；preference hydration 完成前 runtime MUST NOT 用默认 preset 覆盖 localStorage。
- spacing MUST 使用 4/8/12/16/24/32/48/96px scale 与命名角色：page inline 16px desktop/12px narrow、page top 12px、page bottom 32px、panel/row inline 12px、compact row inline 8px、layout gap 12px、stack gap 8px、reading body 24px desktop/16px narrow。Composer 的 9/7/7/9px inset 是显式例外。
- radius MUST 只使用 0/2/4/6px。Castrel-derived action 角色高度为 compact 24px、header/navigation 28px、default 32px，standard field 为 36px；coarse-pointer target MUST 达到 44px。
- 缺失 locale string 必须使用可预测 fallback。

## Responsive Navigation

- `>1024px` 使用 300px desktop sidebar，并允许 operator 持久化完整 collapse preference。
- `<=1024px` sidebar MUST 脱离 content grid，默认关闭，并以 header opener、explicit close、backdrop 和 route-change dismissal 提供 overlay navigation。
- 窄视口初始加载时 sidebar MUST NOT 覆盖内容，content MUST NOT 为 sidebar 预留宽度；page-wide horizontal overflow 不得作为 responsive 策略。
- 页面启用 Right Panel 时，`>700px` 的 Main 与 Right Panel 保持相邻内容列；`<=700px` 时 Right Panel 堆叠到 Main 后方，并保持独立 Header/Content anatomy。

## Shared Task Resource

Shell project/task navigation、Inbox 和 Issues MUST 消费同一 `/api/tasks` polling resource。共享只改变前端请求所有权，不改变 canonical API response、轮询语义或业务状态。

## Host Compatibility

shell contract 必须同时适用于当前 Web host 与未来 Electron wrapper。Desktop-only affordances 必须隔离在 shared navigation、layout、theme、locale 和 base component contracts 之外。
