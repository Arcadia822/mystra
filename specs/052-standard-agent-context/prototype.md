# 原型：标准执行提示词与可选 Agent 上下文

## 入口

- [打开独立 HTML 原型](mockups/index.html)

## Design Intake

- **目标用户**：从 Issue 创建 Task 后立即开始生产的 Team 操作者。
- **首要行动**：在不配置 Agent 的情况下 Start production。
- **核心信息**：标准执行职责始终生效；自定义 Agent 只是可选附加上下文。
- **硬约束**：不得呈现隐藏的 Default Agent，也不得让空 Agent selector 阻断生产。
- **变体范围**：只验证无自定义 Agent与存在自定义 Agent两个入口状态，不设计 Agent 管理页。

## 界面方向

Task production card 默认直接展示 Runtime、Provider 与 Start production。标准执行提示词以简短的只读说明呈现，不暴露编辑器。只有当 Team 存在可选自定义 Agent 时，才出现折叠的 “Add Agent context” 控件；其默认状态为 None，并明确说明它不会替换标准执行职责。

## 覆盖状态

- **Default path**：Team 无自定义 Agent；无 selector，Start 可用。
- **Optional context**：Team 有自定义 Agent；操作者可保持 None 或选择一个 revision。
- **Frozen evidence**：开始后显示 Standard Prompt version 与可选 Agent Context snapshot。

## 当前限制

- 静态 fixture 不连接真实 Task API、Agent API、Harness 或 Session。
- 不表示最终视觉设计。
- 不设计自定义 Agent 创建/编辑、默认绑定、分诊、PR 验真或 Task 删除。
