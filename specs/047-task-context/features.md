# 功能说明：Task 上下文容器与创建入口

## 摘要

Task 是 Team 直属、可持久维护的 Agent 工作容器，不归属于 Project，不是需求管理状态机，也不是 Session 的必需父对象。Task 可以保存零或一个不可变 Project 上下文引用；由 Issue 创建时，同时保存 exact Project 与不可变 Issue 引用。

本功能提供两条创建路径：`/new` 手动创建 Task，以及 Project-scoped Issue 行上的一个 `Create Task` 按钮。两条路径都只创建 Task，绝不顺带启动 Session。

## 功能地图

- Task 对象：稳定 ID、标题、`description`、不可变的可选 Project/Issue 引用。
- New 页面：标题、`description`、可选 Project；不提供 Issue picker。
- Issue 一键创建：从 GitHub/Linear Issue 行直接创建 Task 并留在列表，无中间页面或自动跳转。
- Task 维护：只更新标题与 `description`；Project/Issue 引用创建后不可修改。
- Task 发现：按 Project 分组，并提供明确的 `No project` 分组。
- 防重：同一 exact Issue 最多一个 Task；重试或并发返回同一 Task。

## 边界

- Task 直属 Team，不要求 Project、Issue 或 Session；Project 只是可选上下文引用，不是所有权。
- Issue 关联依赖 Project；有 Issue、无 Project 是非法状态。
- Task 不保存 Issue 的 status、priority、assignee、labels、cycle、milestone、comments 或内容快照。
- Task 不拥有需求状态机，也不提供 backlog、done、blocked、approval 等状态。
- 本功能不设计 Session 启动、四要素默认值或 Project/Task auto routing。
- Issue → Task 不打开 modal、drawer、wizard、New 页面或 Mystra Issue 详情页。
- Session 的 `taskId?` 与 `projectId?` 保持独立；Task 的 Project 引用不得推导 Session Project。

## 分阶段能力图

1. 当前 spec：冻结 Task 对象、可选关系、New 页面和 Issue 一键创建边界。
2. Plan：确定持久化、canonical API、并发防重、草稿与 UI 数据流。
3. Implementation：先交付独立 Task CRUD，再接 New 页面与 Issue 行动作。
4. 后续 Session spec：单独定义 Session 与 Task/Project 的可选关联、四要素默认值和 auto routing；不得反向改写当前 Task 状态模型。
