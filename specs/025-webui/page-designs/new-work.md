# New Task 页面设计

**页面职责**：创建 durable Task intent，不隐式伪装成执行已经开始。

## 用户旅程

1. 用户选择 Project。
2. 用户输入长期目标或工作意图。
3. 用户创建 Task。
4. 页面跳转到 Task detail。
5. Task detail 可以保持零 Session，也可以显式创建一个或多个不同
   Session 处理不同子任务。

## 首屏

- Project selector：必选。
- Objective composer：必填，支持目标、背景、验收标准和链接。
- Create Task：只创建 Task，不选择 Agent、branch 或 runtime。

```json
{
  "source": "api",
  "projectId": "<project-id>",
  "objective": "<durable work intent>"
}
```

## Task detail 的 Session 创建

Session 创建是第二个显式动作：

```json
{
  "title": "Reproduce the failure",
  "objective": "Produce a deterministic reproduction",
  "agent": "codex",
  "branch": "codex/reproduce"
}
```

Agent 和 branch 属于 Session。Project/Repository context 从 Task 继承，不能
由 Session 替换。多个 Session 是 sibling 子任务，不是覆盖或隐式重试计数。

## 状态

| 状态 | 行为 |
| --- | --- |
| No Project | 提交 disabled，保留已输入 objective |
| Ready | Project 与 objective 均有效 |
| Creating | 防重复提交 |
| Created | 跳转 Task detail；允许零 Session |
| Failed | 就近展示错误并保留输入 |

## 不做

- 不在 Task 创建页选择 Agent、branch、runtime 或 Runner。
- 不自动创建 Session。
- 不展示内部执行事实或 activity timeline。
- 不提供 retry；再次执行就是显式创建新的 Session。
