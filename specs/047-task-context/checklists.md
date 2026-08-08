# 评审清单：Task 上下文容器与创建入口

## Owner 评审

- [x] Task 可以没有 Project，也可以没有 Issue。
- [x] Task 只作为 Agent 上下文容器，不承担复杂需求管理状态机。
- [x] Session 可以没有 Project 和 Task；本 spec 不设计任何 Session 启动逻辑。
- [x] `/new` 直接创建 Task，不是 Session launcher。
- [x] Issue → Task 是行级单按钮直接创建，不提供中间页面。
- [x] Owner 已确认一个 exact Issue 最多关联一个 durable Task；已有 Task 时操作改为 `Open Task`。
- [x] Owner 已确认 Issue 创建成功后留在列表，不自动跳转。
- [x] Owner 已确认 Task 的 Project/Issue 引用创建后不可修改。
- [x] Task 自有内容采用必填标题 + 可选 `description`，不引入 priority、assignee、due date 等字段。

## Spec 就绪度

- [x] `spec.md` 已完成且无 `[NEEDS CLARIFICATION]`。
- [x] 045 的冲突条款已精确覆盖；046 的 Team ownership 与独立 Session 引用已对齐。
- [x] Task、Project、Issue、Session 的关系状态可枚举并可测试。
- [x] New 页面、Issue 一键创建、错误态、防重和可访问性均有验收覆盖。
- [x] requirements checklist 已完成。
- [x] Multica 调研结论已记录在 `research.md`。
- [x] UI 原型入口已记录在 `prototype.md`，独立原型位于 `mockups/index.html`。
- [x] Owner 决策已全部写入；Specify 阶段完成，可进入 `/speckit.plan`。

## 后续插件检查

- [x] `/speckit.plan` 使用 GitNexus 检查当前 Task schema、RdbProvider、`NewTaskComposer`、Issue list 行动作与 Task object route 的 blast radius。
- [x] `plan-eng-review` 评审 Team 授权、Issue 唯一性、Project/Issue 不可变约束、事务边界、失败恢复与草稿存储。
- [x] `/speckit.tasks` 仅在 engineering review 完成或被明确豁免后生成。
- [x] 实现前运行 `/speckit.analyze`，检查 038、040、045、046 与 5xP 中旧的 Task→Session 父级表述。
- [x] UI 实现使用 `frontend-ui-engineering`，并在真实浏览器验证 New 与 Issue 行操作。
