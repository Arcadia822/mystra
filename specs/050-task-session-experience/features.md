# 功能说明：Task Session 发起与执行历史

## 摘要

让 Team 操作者在 Task 详情页先准备并确认唯一 Workspace，再在锁定 Runtime 上选择 Provider 与 Agent 发起 Session，并找到历次执行。每次发起可以携带只属于该 Session 的补充说明，执行中的状态、消息、过程、工具调用和结果在 Session 详情页按可靠顺序持续呈现。

## 功能地图

- Task 详情：Workspace 状态/Setup/Retry、Session 列表、空状态、分页、New Session 入口。
- New Session：锁定 Workspace Runtime、选择 Provider/Agent，并提供可选 Manual Context；Project context 来自不可变 Task。
- Session 详情：直接使用 049 Session 当前状态与执行选择；结果与精确时间来自 SessionEvent。
- Event history：最新窗口、更早分页、运行期增量刷新、未知事件安全降级。
- 049 对接：复用 canonical launch/get/listEvents、Session 与 SessionEvent；不增加 summary/detail view。

## 边界

- Session 只引用 Task，不归属于 Task。
- Manual Context 只属于一次 Session，不修改 Task、Project 或 Agent。
- 只展示已验证并脱敏的 Session domain events，不展示任意进程输出。
- ready 表示最近一次响应完成且执行占用已释放，不是 Session 终态。
- 不包含 cancel/retry、全局活动流、日志搜索、仓库物化或 PR 交付。

## 分阶段能力图

1. 先落地 048 Task Workspace，再落地 049 Session/Event attachment 底座。
2. 扩展 Manual Context、直接返回 Session 的 Task-filtered list 与 authenticated Web API。
3. 交付 Workspace/Task launch/list UI 与 Session detail/event UI。
4. 以确定性 Provider fixture 和真实浏览器验证 Task→shared Workspace→Session→Runtime→Events 闭环。
