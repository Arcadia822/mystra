# 功能说明：Agent 定义与 Session 选择边界

## 摘要

Agent 是发起 Session 的四个独立要素之一。Runtime 决定在哪里执行，Provider 决定使用哪个 agent CLI / 协议族，Agent 只提供行为角色的 system prompt，Context 提供 workspace、仓库材料、skills 与其他上下文。

Agent 是 Team-scoped 配置，不属于 Project。Session 同样直属 Team，不属于 Task 或 Project；它可以分别携带 `0..1` 个 Task 引用与 `0..1` 个 Project 引用。Agent 可以被更新和归档；每次 Session 发起会固定所选 Agent 的 revision 与 system prompt，使之后的 Agent 修改不改写历史执行语义。

## 功能地图

- Agent 管理：在 Team 边界内创建、读取、列出、重命名、更新 system prompt、归档；不要求 Project 参数。
- 唯一效果配置：Agent 只有 `systemPrompt` 会影响执行行为。
- Session 选择：`Runtime + Provider + Agent + Context` 四项分别解析，不互相推断。
- 兼容性门槛：Runtime 必须提供 Provider；Agent 必须存在、active 且与 Session 同 Team；Agent 不做 Project 归属校验；四项都必须可用。
- 可选业务引用：Session 的 `taskId?` 与 `projectId?` 彼此独立，均为 `0..1`，二者都不拥有 Session。
- 可复核执行：Session 固定 Agent ID、revision 与 resolved system prompt。

## 边界

- Agent 不保存 Provider、Runtime、Context、skills、tools、模型参数、凭据或 workflow 行为。
- `codex`、`copilot` 等是 Provider，不是 Agent。
- skills、工作目录、仓库材料和知识文件属于 Context，不属于 Agent。
- 本功能不实现 Session 生命周期、Context 管理、调度、Runner claim 或执行结果。
- 本功能不提供 Agent UI、marketplace、多 Agent 层级、自动编排或 prompt 优化。

## 分阶段能力图

1. 当前 spec：冻结 Agent 的 Team Scope、system-prompt-only 效果配置、Session 四要素边界，以及 Project/Task 的独立可选引用语义。
2. Agent 独立切片：交付 canonical API 以及薄 MCP/CLI 管理面，支持创建、读取、列出、更新与归档。
3. Session/Context 后续规格：接入四要素解析、兼容性校验与 Resolved Agent Snapshot。
4. 后续可选能力：只有在独立产品规格授权后，才讨论 UI、模板或评测；同一 Team 内跨 Project 使用是当前模型的固有能力，不是后续共享功能。
