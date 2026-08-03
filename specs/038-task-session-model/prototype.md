# Prototype：Task / Session 对象层级

## 入口

- [独立 HTML 原型](./mockups/index.html)

## 覆盖范围

- Task 可独立存在，并在详情中列出多个 Session。
- Session 作为独立执行与 Review 对象。
- Runner 使用稳定身份，不展示 RunnerSession。
- 025 shell 的目标文案使用 `New Task` / `Recent Sessions`。

## 使用方式

直接在浏览器打开 `mockups/index.html`。该原型只验证对象层级、命名和导航归属，
不作为视觉风格或最终布局依据。

## 当前限制

- 不展示 activity timeline、事件 ID 或事件查询入口。
- 不设计 Task completion/archive。
- 不展示多 Session orchestration；Session 由人或调用 Agent 显式创建。
