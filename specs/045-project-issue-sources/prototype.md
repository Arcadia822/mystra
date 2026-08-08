# 交互原型：Project Issue 来源与分集成浏览

## 原型入口

[打开独立 HTML 原型](mockups/index.html)

## Intake

- **目标**：验证 Project-first 范围、GitHub/Linear 明确切换、provider-specific 表格与 Linear 未配置状态。
- **主要用户**：浏览 Project 工作来源的 Mystra 操作者，以及配置 Linear source 的 Team Owner/Admin。
- **主要动作**：选择 Project、进入 Issues、切换 provider、筛选/翻页、查看只读 Issue、进入 Linear 配置。
- **限制**：不创建 Task，不执行 dispatch，不修改或同步外部 Issue，不模拟 Hosted Linear OAuth。
- **视觉约束**：沿用 Mystra dark-tech 语义 token、12px 紧凑密度、平面 surface 与独立 header/content；不使用融合表或装饰性卡片堆叠。

## Wireframe 方向

评估了三种结构：

1. 单表加 Integration 列：扫描简单，但直接违反“不允许融合”。淘汰。
2. Project 选择 + 左侧 provider rail：层级明确，但窄屏会与主侧栏争夺宽度。
3. Project 上下文 + 顶部 provider tabs + 独立表格：复用 Project 详情与一级 `/issues`，切换成本最低。采用。

页面分为五个结构区：shell 导航、Project 上下文、provider tabs、provider-specific tools、只读 Issue table/status。Linear 未配置态替换表格区域，不发起无范围请求。

## 覆盖页面与状态

原型顶部可切换三个关键表面：

1. **Project Issues**：Project 详情中的 Issues tab，包含 GitHub/Linear provider switch。
2. **Top-level Issues**：一级入口先选择 Project，再显示同一 provider view。
3. **Linear Setup**：Project 中选择 exact Linear connection 与一个 Linear Team。

原型内可切换 GitHub、Linear 与 Linear 未配置状态。两个 provider 使用不同列和筛选，分页位置分别保存。行级操作只表达打开 provider 原始页面，不提供 Mystra Issue 详情。

## Interaction Notes

- Project 变化会清空旧 Project 的 Issue、filter 与 cursor。
- Provider 往返切换保留各自的 filter 与当前页，但不共享状态。
- GitHub source 显示为 repository-derived，不可在 Issue 设置中改绑其他仓库。
- Linear source 先选 connection，再选该 connection 可见的 Linear Team；connection 变化清空 Team。
- 页面不出现 Issue detail、Create Task、Dispatch、Sync、Comment 或 Change status。

## 当前限制

- 原型使用静态示例数据，不调用 GitHub、Linear 或 Mystra API。
- 不模拟 secret 输入、API key replacement、permission failure 或 rate limit 的完整恢复流程。
- Owner 已接受当前表格字段与列表结构；专用 Mystra Issue 详情页等待后续规格。
- 原型只验证需求结构，不代表实现或运行时验收。

## High-fidelity 升级目标

- 在计划阶段映射现有 AppShell、Project object page 与 Settings components。
- 增加 loading、empty、unauthorized、rate-limited 与 connection unavailable 视觉状态。
- 验证 320、768、1024、1440px 布局和键盘焦点顺序。
- 在真实 API 合同确定后校准 provider-specific filters 与分页反馈。
