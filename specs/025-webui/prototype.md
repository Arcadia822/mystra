# 原型：025-webui

## 当前实现入口

- 启动 `pnpm --filter @mystra/control-plane exec next dev -p 3100` 后打开 `http://127.0.0.1:3100/`。

## 历史原型入口

- [打开交互式高保真 HTML 原型](mockups/index.html)
- [打开 Settings Modal 布局迁移原型](mockups/settings-modal.html)

## 覆盖范围

当前可运行 Control Plane 是本切片的权威 demo/PR 表面。下列独立 HTML 是此前 shell/layout 探索材料，不再拥有当前 navigation taxonomy。

当前实现平移 Castrel UX 的结构、密度与交互模式，并使用 dark-tech design system 的具体配色；历史 HTML 原型只用于布局交互参考，不再拥有颜色、字体、radius 或 elevation 的设计系统权威性。

当前组件迁移的权威清单见 [`component-migration.md`](component-migration.md)。运行态必须使用 Mystra-owned 共享组件和主题 token；Castrel v2 只拥有来源 anatomy、density、padding 与交互证据，不拥有运行时 palette 或业务语义。

- `New`：主区域居中的产品 Logo 与 Task composer；输入区默认 3 行并使用 9/7/7/9px 内边距，ghost footer 无分隔线，左侧是附件、Repository 和 Issue，右侧是语音输入和发送。
- `Inbox`：使用标准 master-detail 布局；左侧显示最新 Session 处于 `waiting_for_review` 的 Task 卡片，右侧显示当前选中 Task 的只读详情与完整对象页入口。
- `Search`：从侧边栏打开 modal，在不离开当前 route 的前提下过滤并导航 Task。
- `Issues`：`/tasks` 继续使用 Castrel-aligned Task table，不跟随 Inbox 改为 master-detail。
- `Automations`：不进入主菜单；`/automations` 仅保留可直接访问的 `Coming soon` 占位页。
- `Settings`：左下角入口打开 modal 组件，不再作为 route 页面；设置容器采用 Castrel Settings 的 `240px + 内容区` 双栏、左侧 identity/search/tab、44px 内容标题栏和独立滚动区。Tab 固定为 `Account`、`Appearance`、`Team`、`Integrations`。Appearance 原型覆盖 Language、System/Light/Dark、边缘线模式、代码表面 variant、亮暗主题分别设置、对比度与字体/字号细节、即时预览和复位；当前状态只保存在浏览器，不包含数据库/API。GitHub connection 位于 Integrations，Account/Team 的未支持写操作保持只读/不可用。
- `Projects`：位于 primary navigation 下方，heading 不显示 count，右侧 ghost plus 进入 Project 创建表面；Project item 直接导航到 Project detail。
- 左侧 sidebar 的 `Tasks` section 按 Project 分组，Task icon 映射最新 Session 状态。

## 使用方式

1. 打开本 feature 的 Spec View：`specs/025-webui/index.html`。
2. 切换到 `PROTOTYPE` tab。
3. 点击上方原型入口，在独立页面打开 `mockups/index.html`。
4. 在原型左侧导航中切换 route，检查 navigation、layout archetypes、placeholder framing 与视觉方向是否一致。
5. 打开 Search modal，输入无匹配和有匹配查询，确认焦点、空状态、关闭和 Task 导航。
6. 收起/展开左侧栏，检查收起时 sidebar 完整变为 0px 且没有 icon rail；header 显示 Mystra brand、`New` 与重新展开 control。
7. 打开 New、Inbox 和 Issues，检查居中 composer、Inbox 左卡片/右详情布局与 Issues table；确认主 header 不显示环境说明。
8. 打开 `mockups/settings-modal.html` 或运行中的 Settings，检查 920×760 上限、四个 Tab、Appearance 中的 mode、border、code surface、浅/深主题、主题细节与 Language，Integrations 中的 GitHub 状态、搜索过滤、选中态、Escape/backdrop close，以及 320/768/1024/1440px 重排。

## 补充截图

- [chatLayout](mockups/screenshots/chatlayout.jpg)
- [chatLayout 打开右侧栏](mockups/screenshots/chatlayout-inspector.jpg)
- [readLayout](mockups/screenshots/readlayout.jpg)

## 当前限制

- 原型是交互式高保真 HTML review artifact，不是生产实现。
- 原型中的 route 内容区只放一个大 layout placeholder，不展示页面业务数据、组件网格、消息结构或真实 API 行为，也不会提交任务。
- 所有可见交互都应有动画反馈，包括 route 切换、hover/selected、左侧栏完整展开/收起、右侧栏开合与 placeholder 入场。
- 页面级业务能力仍由 025 内后续实现切片定义；当前原型只确认 shared shell、route taxonomy、layout archetypes 与兼容边界。
- 如果后续 prototype plugin 接管该产物，应保持 `prototype.md` 作为 `PROTOTYPE` tab 的固定入口说明。
