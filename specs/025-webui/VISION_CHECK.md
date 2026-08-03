# 视觉检查

视觉检查时间：2026-05-19 Asia/Shanghai

## 检查方式

使用本地渲染脚本生成 6 张 `1990x1248` PNG，并逐张通过视觉检查确认：

- 参考图风格是否一致：浅灰桌面、固定左侧导航、中间工作画布、右侧 inspector、低饱和边框。
- 是否存在明显文本重叠、按钮溢出、内容被右栏遮挡。
- 是否存在过度营销化的 hero、强渐变、装饰性图形。
- 配置页是否覆盖 project/runtime、MCP/skills、runner/platform 三类配置。

## 第一轮发现

- `01-command-center.png`: 中央 composer 与右侧 inspector 有轻微侵入，提交按钮靠近右栏。
- `02-new-work-intake.png`: 弹窗预检区底部字段被裁切。
- `05-skills-mcp.png`: 右侧 inspector 与主内容 hero/search 有轻微叠压感。

## 修正

- 为带 inspector 的页面增加 `center.inspectorAware` 布局，使主内容在左侧可用工作区内居中。
- 将新增工作弹窗高度从 `560px` 调整为 `620px`。
- 缩短控制台卡片中的机器值，减少窄卡片内的尴尬换行。

## 第二轮产品反馈修正

- 将原 `控制台 / Command Center` 改为 `Overview`。
- 删除 Overview 中的任务输入入口；发起任务只保留在 `新工作` 页面。
- 将 Overview 改成克制的数据分析仪表盘，覆盖 task、项目、agent、model、runner 五个主题。
- 生成新截图 `01-overview.png`，删除旧的 `01-command-center.png`。

## 第三轮产品反馈修正

- 页面主体删除重复大标题，只保留 header 左侧 `Overview` 标题。
- 删除 right brief / Needs attention / More filters / Compare / 环比展示。
- Team / workspace 不作为 Overview 页面筛选；它属于页面之上的产品壳层逻辑。
- 时间范围只保留 `Today`、`7 days`、`30 days` 三个预设；`Custom` 只到日期，不提供小时/分钟粒度。
- 底部 5 个主题数字卡改为 4 个 Toplist：Project workload、Failure reasons、Model cost drivers、Runner queue pressure。
- 原 Bottleneck 改为 `Time composition`，只展示所选范围内 terminal runs 的阶段总用时占比。
- 不做深入 analytic 仪表盘；下钻只带条件跳转到 Runs 列表页。
- 图表内部不放角标或解释性标题，依靠 panel 标题、hover 和下方简短数值说明。

## 第四轮产品反馈修正

- Toplist 改为带条形图的列表，不再只是纯数字排序。
- `Jobs` 与 `Run time composition` 面板高度固定对齐。
- 右上角筛选控件收缩为两个按钮：`Time` 与 `Project`。
- 筛选控件从 header 挪到主内容区顶部，单独占一行。
- Overview 文案回收到 021 术语：`project`、`task`、`run`、`artifact`、`runner`，减少自造标签。

## 复查结论

- 6 张截图均保持同一浅灰、克制、桌面工作台风格。
- 没有明显互相覆盖的 UI 文本或按钮。
- 配置相关页面覆盖了项目配置、技能/MCP 配置、平台配置。
- Overview 主仪表盘不再包含任务输入框，符合“发起工作入口独立”的页面职责。
- Overview 主体没有重复大标题；筛选、构成图和 Toplist 已符合第三轮反馈。
- Overview 的筛选、文案和 Toplist 可视化已符合第四轮反馈。
- 截图适合用于老板能力演示前的产品界面方向讨论，而不是直接作为实现承诺。

## 第五轮 shell 交互复查

- 主区域 header title 改为静态标题，不再作为 route button。
- 右侧 sidebar header title 改为静态标题，关闭动作拆成独立 icon button。
- 右侧 sidebar 只保留 closed 与 expanded 两种状态；closed 状态 grid 列宽为 `0px 0px`，不再保留 icon rail 或 1px 残留竖条。
- 左侧与右侧 toggle icon 尺寸复查为 `15px x 15px`，与 sidebar menu item 前置 icon 保持一致。
- 左侧 sidebar 展开态 toggle 右边缘与当前菜单行右边缘对齐；收起态 toggle 在 `52px` rail 内居中，中心误差约 `0.5px`。
- 右侧 sidebar 展开时主 header 与 inspector header 的分界线使用同一 `border-strong` token，左右分割线通过 resizer header 伪元素补齐。
