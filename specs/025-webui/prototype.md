# 原型：025-webui

## 原型入口

- [打开交互式高保真 HTML 原型](mockups/index.html)

## 覆盖范围

该原型是独立 HTML 页面，不再引用截图。它用于 025 的 shell/framework 评审，只展示页面级 layout placeholder，不展示任何页面业务内容或组件结构。

- `Overview`：单个 `dashboardLayout` 页面级 placeholder。
- `Inbox`：单个 `readLayout` 页面级 placeholder。
- `New Task`：单个 `chatLayout` 页面级 placeholder。
- `Settings`：左下角入口打开 modal 组件，不再作为 route 页面。
- `Projects`：primary navigation 中的项目入口，复用已完成的 Project object pages。
- `Recent Sessions`：保留为可直接访问的非主菜单 route，用于验证 secondary route 兼容性。
- 左侧 sidebar 保留 `Projects` 分组与 project 下的 task 列表；导航行不展示 layout 类型说明。

## 使用方式

1. 打开本 feature 的 Spec View：`specs/025-webui/index.html`。
2. 切换到 `PROTOTYPE` tab。
3. 点击上方原型入口，在独立页面打开 `mockups/index.html`。
4. 在原型左侧导航中切换 route，检查 navigation、layout archetypes、placeholder framing 与视觉方向是否一致。
5. 拖动左侧栏分割线，检查主侧边栏宽度调整动画。
6. 收起/展开左侧栏，检查 icon rail 状态下导航仍可识别、居中且保持稳定命中区域。
7. 使用主 header 右侧 icon 打开右侧栏，检查右侧栏与主区域并列、全高展示、显式关闭与宽度调整动画；关闭后不保留右侧竖条。

## 补充截图

- [chatLayout](mockups/screenshots/chatlayout.jpg)
- [chatLayout 打开右侧栏](mockups/screenshots/chatlayout-inspector.jpg)
- [readLayout](mockups/screenshots/readlayout.jpg)

## 当前限制

- 原型是交互式高保真 HTML review artifact，不是生产实现。
- 原型中的 route 内容区只放一个大 layout placeholder，不展示页面业务数据、组件网格、消息结构或真实 API 行为，也不会提交任务。
- 所有可见交互都应有动画反馈，包括 route 切换、hover/selected、左侧栏展开/图标收起、右侧栏开合与 placeholder 入场。
- 页面级业务能力仍由 025 内后续实现切片定义；当前原型只确认 shared shell、route taxonomy、layout archetypes 与兼容边界。
- 如果后续 prototype plugin 接管该产物，应保持 `prototype.md` 作为 `PROTOTYPE` tab 的固定入口说明。
