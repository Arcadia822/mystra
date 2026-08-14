# Prototype：产品概览

## 入口

- [mockups/index.html](mockups/index.html)

```text
open specs/053-product-overview/mockups/index.html
```

## 本轮设计调整

- 直接加载真实前端的 `apps/control-plane/app/globals.css`，复用 Mystra 的 token、控件尺寸、字体、表面和交互状态。
- 以 054 原型为 shell 基线：复用相同的展开侧栏、折叠后顶栏入口、导航分组、Team identity、Search 和 New Task modal。
- 删除上一版独立设计的品牌、巨型页面标题、说明卡和表格视觉；Overview 主内容改为与 054 Task workbench 相同的紧凑密度。
- 删除原 User Story 3 的独立体验区域。
- 删除“正常/需要关注/空/部分不可用”四个 prototype state switch。
- 顶部只保留一组五张状态卡：未执行、执行中、待接手、已完成、已取消。
- 每卡只显示名称和数字，不显示小号解释文字。
- 时间范围只提供 7 天、30 天、全部，默认 7 天。
- 下方只保留一个需要关注 Task 表格；同 Task 多 Session 只占一行。
- 删除 Runtime、当前生产和 Projects 列表。
- 删除顶部 `Task 状态`、筛选规则、observed time 和刷新按钮；只保留时间范围控件。
- 删除“全 Team · 不受统计时间范围影响”等 attention scope 说明文字。
- attention 不再维护独立 `attentionRow` 样式，改为复用 054 的 `taskStack / taskRow / rowGrow / rowRightColumns` stacked Table anatomy。
- 主区域改用 054 Task workbench 的 full-width 空间模型：页面容器不重复添加 page inset，Section header 使用 `0 × --content-inset`，状态组使用 `--content-inset`，section gap 统一为 `--layout-gap`。
- 两个内容区统一使用 `overviewSection / overviewSectionHeader / overviewSectionBody` 组件结构；内部使用 `--tight-gap`，彼此使用 `--layout-gap`。
- shell header 与内容之间、Section header 与 body 之间均不使用分割线。

## 信息层级

1. 054 shell 顶栏中的 Overview 标题和 Team identity。
2. 右对齐的 7 天/30 天/全部 segmented control。
3. 单组五态数字卡；窄屏在组内横向滚动。
4. 全部 attention Tasks，以 054 stacked-row 语法一 Task 一行。

## Attention Row

一行沿用 054 的默认 Task table 配置表达：

- 左侧 Task 当前状态 icon；Task ID 默认隐藏。
- grow 区 Task 标题。
- 右侧 Project Label。
- Metadata slot 中的 Task/Session attention 摘要。
- 末端最近 attention 时间。

原型示例包含：Task 仍是“生产中”，但一个 Session 中断、一个 Session failed。它仍只显示一行。

## 当前限制

- 固定样例数据，不调用真实 API。
- 时间范围切换只演示五个数字变化；attention 列表故意保持不变，不提供手动刷新按钮。
- 不验证 canonical Task 五态迁移、数据库聚合、Team authorization 或 pagination。
- shell 只用于高保真联调语境；其最终路由、导航和 New Task modal 契约仍由 054 拥有。
- 不实现 Task detail 内 Session 定位或接手动作。
