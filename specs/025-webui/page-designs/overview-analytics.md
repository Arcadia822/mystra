# Overview 页面设计

Overview 是克制的操作摘要，不是深度分析产品。

## 数据来源

只使用公开业务投影：

| 投影 | 用途 |
| --- | --- |
| Task summary | Task 总量、零 Session Task、最近更新 |
| Session records | queued、active、waiting review、succeeded、failed |
| Runner projections | healthy/stale、容量、当前 Task/Session assignment |
| Session results | 质量、preview、review evidence |

内部执行事实不作为公开 analytics 数据集。activity timeline 公开方式保持
未决，不在 025 中提前定义。

## MVP 布局

1. Control Plane health 与刷新时间。
2. 四个指标：Task 总量、active Sessions、waiting review/failed Sessions、
   Runner available capacity。
3. Recent Tasks：展示 objective、Session count、latest Session 状态。
4. Runner health：healthy/stale、active Sessions、max concurrency。

Task 卡片不得显示一个虚构的 Task state。没有 Session 的 Task 显示
`No Sessions`。Session 状态只属于 latest Session 或明确选中的 Session。

## 下钻

- Task 指标或最近项进入 `/tasks/:id`。
- Session 状态进入 `/sessions/:id`。
- Runner capacity 进入 `/runners/:id`。

## 不做

- 不公开内部 fact/event collection。
- 不定义 activity timeline。
- 不做模型成本、阶段耗时、队列归因或跨期趋势推断。
- 不把 Runner credential 或内部协议身份暴露到页面。
