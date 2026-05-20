# Overview 数据分析仪表设计

**页面名称**: Overview  
**页面职责**: 用最少信息回答“Agent 开发体系现在是否有效、是否失控、哪里需要经理或提效负责人介入”。  
**MVP 边界**: Overview 只做总览看板，不做独立分析页，不做 More filters，不做右侧便览，不做任务提交入口。

## 页面边界

- Team / workspace 切换属于产品壳层逻辑，位于所有页面之上；Overview 页面内不设计 team 筛选。
- 左侧 sidebar 是全局应用壳，不属于 Overview 的页面内容。
- Header 左侧已经展示 `Overview` 标题，页面主体不再重复大标题。
- 发起任务只通过 `新工作` 页面进入。
- Overview 中的图表不放角标、解释性小标题或图内说明文字；图表依靠 panel 标题和 hover 解释。
- 页面顶部筛选收缩为两个按钮，单独占一行，位于主图表区上方，不放在 header。

## 目标角色

### 研发经理

关注团队交付是否变快、失败是否可控、哪些项目被 Agent 加速、哪里需要人介入。

核心问题：

- 最近 Agent 帮团队处理了多少工作？
- 成功交付率如何？
- 从提交到可审查 PR/MR 的用时是否可接受？
- 哪些项目、失败原因或运行器最需要关注？

### Agent 提效负责人

关注 agent、model、runner、workflow 的效率、稳定性和成本。

核心问题：

- 哪个 agent/model 组合最稳定？
- 失败集中在提交校验、排队、执行、还是交付阶段？
- LLM 用量和成本是否健康？
- runner 容量是否拖慢吞吐？

## 筛选条件

MVP 只提供页面顶部的少量筛选。所有筛选都应可反映到 URL query，方便复盘和分享。

| 筛选 | 控件 | 默认值 | MVP 说明 |
| --- | --- | --- | --- |
| Project | 下拉按钮 | All projects | 范围限定到 project，不引入 team/workspace 页面内筛选 |
| Time | 下拉按钮 | 7 days | 菜单中只给 3 个预设：Today、7 days、30 days，以及 Custom |

不做：

- Team / workspace 筛选。
- Compare / 环比配置。
- More filters。
- 用户自选图表粒度。

## 时间范围

| 范围 | 用途 | 系统内部粒度 |
| --- | --- | --- |
| Today | 看今天是否异常 | hour |
| 7 days | 默认管理视角 | day |
| 30 days | 月度效率和成本 | day |
| Custom | 复盘和汇报 | day |

说明：

- Custom 只允许选日期，不允许选具体时间。
- 页面可以内部按 hour/day 聚合，但不把粒度暴露给用户。
- 所有时间按部署/用户 timezone 展示，默认 `Asia/Shanghai`。

## 数据模型与聚合口径

MVP 可以先从现有 task/run/event/result 事实聚合；model usage 允许先为空或标记为 estimated，后续由 agent adapter 写入 usage fact。

| 事实 | 来源 | 用途 |
| --- | --- | --- |
| Task fact | task record | 任务量、来源、项目、agent、branch |
| Run fact | run record | 状态、attempt、时间、runner、runtime |
| Event fact | structured lifecycle events | phase、milestone、阶段用时 |
| Result fact | run result | PR/MR、summary、terminal status |
| Model usage fact | agent adapter metadata | token、cost、model、调用次数 |
| Runner session fact | runner sessions | 容量、心跳、并发、stale |

### 基础指标

| 指标 | 聚合逻辑 |
| --- | --- |
| Submitted tasks | `count(task.createdAt in range)` |
| Terminal runs | `count(run.finishedAt in range and state in terminal states)` |
| Success rate | `succeeded terminal runs / terminal runs` |
| Failed runs | `count(run.state in failed/timed_out/canceled)` |
| Median time to review | `p50(run.finishedAt - task.createdAt)` for terminal runs |
| Queue wait | `runner_assigned_at - task.createdAt`; fallback `run.startedAt - task.createdAt` |
| Execution time | `run.finishedAt - run.startedAt` |
| Review delivery time | `review_ready_at - workflow_finished_at` when events exist |
| LLM tokens | `sum(prompt_tokens + completion_tokens + tool_tokens)` when reported |
| LLM cost | actual cost if reported; otherwise estimated from captured pricing snapshot |
| Runner utilization | `sum(active_run_seconds) / sum(capacity_seconds)` |

成本口径必须记录价格来源和生效时间，不能页面运行时临时查价。模型价格会变；事实不会因为人类喜欢简单而自动变得可审计。

## Overview 主仪表盘

### MVP 布局

1. Header：左侧标题 `Overview`，不放筛选控件。
2. Filter row：两个按钮，分别切换 `Time` 与 `Project`。
3. 第一行：4 个 KPI cards。
4. 第二行：`Tasks` + `Run time composition`。
5. 第三行：带条形可视化的 Toplist 区域。

不放：

- 右侧便览。
- Needs attention 侧栏。
- 5 个主题数字卡。
- deep analytics 入口。
- More filters。

### KPI cards

| Card | 主指标 | 辅助信息 | 聚合逻辑 | 图表类型 |
| --- | --- | --- | --- | --- |
| Tasks | Submitted tasks | terminal runs | `count tasks`, `count terminal` | 迷你柱状图 |
| Success rate | Success rate | failed/timed out count | `succeeded / terminal` | 迷你状态柱 |
| Time to artifact | Median cycle time | reviewable runs | terminal run median and delivered artifact count | 迷你趋势柱 |
| LLM cost | Total cost | cost per success | usage fact 聚合 | 迷你柱状图 |

KPI 不展示环比数字。

### Jobs

- 图表类型：stacked bar。
- X 轴：时间，按系统内部粒度聚合。
- 堆叠：succeeded、failed、running/queued。
- 不叠加 success-rate 折线，降低 MVP 实现和理解复杂度。
- 图内不放标签。hover 时再显示 submitted、succeeded、failed、running/queued。
- 点击柱子跳转 Runs 列表，带 `from/to/project/status` 条件。
- 面板高度与 `Run time composition` 固定对齐。

### Run time composition

替代原 `Bottleneck` 图。

- 图表类型：单条 horizontal stacked bar。
- 指标：所选时间范围内 terminal runs 的总体用时构成。
- 聚合逻辑：
  - 对每个 terminal run 计算各阶段秒数。
  - 对每个阶段求和。
  - 阶段占比 = `stage_total_seconds / all_stage_total_seconds`。
- 阶段：
  - queue wait
  - runner execution
  - artifact delivery
  - review ready / finalization
- MVP 不做：
  - p90 归一化线条。
  - stage p50/p90 混合展示。
  - 环比异常标记。
  - 复杂瓶颈归因模型。

面板下方可以用 3 到 4 行数字解释阶段总时长和占比；图本身不放文字。

### Toplist 区域

底部不再放 5 个主题数字卡，而是放小型 toplist。Toplist 比单值卡更适合研发经理判断“先看哪里”。
每个 toplist 条目都带一条水平条形图，用相对长度表达排序强度，避免只剩数字。

建议 MVP 放 4 个 toplist：

| Toplist | 排序逻辑 | 展示字段 | 点击动作 |
| --- | --- | --- | --- |
| Projects | `submitted tasks desc` | project、tasks | 跳转 Runs 列表，过滤 project |
| Failures | `failed runs desc` | failure category、count | 跳转 Runs 列表，过滤 failure category |
| Models | `llm cost desc` | model、cost | 跳转 Runs 列表，过滤 model |
| Runners | `queue wait total desc` | runner、queue wait | 跳转 Runs 列表，过滤 runner |

每个 toplist 默认显示 Top 3。没有足够数据时显示空状态，不造假。

## 列表页跳转

MVP 不做 deep analytics 仪表盘。所有下钻都跳到现有或后续的列表页，并带条件。

建议 URL/query：

```text
/runs?project=mystra&from=2026-05-13&to=2026-05-19
/runs?status=failed&failure_category=runtime
/runs?model=gpt-5.4
/runs?runner=runner-debian-01
```

## 后续非 MVP

以下可以作为后续能力，不进入当前演示 MVP：

- Task Analysis 深度仪表。
- Project Analysis 深度仪表。
- Agent Analysis 深度仪表。
- Model Analysis 深度仪表。
- Runner Analysis 深度仪表。
- More filters。
- 环比/同比。
- 用户自定义时间粒度。
