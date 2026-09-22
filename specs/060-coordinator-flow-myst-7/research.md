# 060 技术研究：DSH Coordinator 接入与飞书/Mystra 协同机制

## 1. DSH Coordinator 运行环境与技能模型

- **运行位置**：host-a1 上的 DSH（DeepSeek Harness / Cordis 架构）实例。
- **通信与工具形态**：
  - DSH Coordinator 通过标准 MCP 协议连接 Mystra Control Plane 服务。
  - DSH 的 Skill 体系遵循通用 Agent Skills（`SKILL.md`）规范，技能作为 Coordinator 上下文的外部注入能力，引导其在飞书群/Thread 场景下的判断逻辑与工具调用。
- **无状态与线程状态隔离**：
  - 飞书以 `chat_id`（群聊）和 `root_id` / `thread_id`（话题线程）组织消息流。
  - Coordinator 会话以飞书 Thread 为隔离粒度：一个 Thread 对应一个独立的协调上下文。

## 2. 状态与映射关系表

Coordinator 需要维护的核心上下文关联：

```text
[飞书 Thread (root_id)]
    │
    ├── 1. 目标 Issue: identifier (如 MYST-4), externalId, provider (linear)
    ├── 2. 所属 Project: slug (如 mystra), id, bound repository
    ├── 3. Mystra Task: taskId (UUID), status (in_progress), initialInstruction
    ├── 4. Mystra Session: sessionId (UUID), activeMessageId
    ├── 5. 交互式评审空间: Taco ID, Taco URL (不可变空间，多轮刷新同一 URL)
    └── 6. 关联工程分支: featureBranchName, Draft PR URL
```

### 防重入与去重规则
- 当收到 `@Bot + Issue ID` 时，Coordinator 首先查询当前内存/持久状态中是否存在该 `Issue ID` 对应的活跃（未完成）Task。
- 若存在活跃 Task，Coordinator 不得调用 `mystra_create_task`，而是返回现有 Thread 链接并引导用户至该 Thread 继续交流。

## 3. Mystra MCP 工具调用链与参数契约

Coordinator 在本阶段使用的核心 Mystra MCP 工具：

1. **`mystra_create_task`**：
   - 输入：`{ title: string, description?: string, projectId?: string }`
   - 动作：在活动 Team 内创建处于 `pending` 状态的 Task。
2. **`mystra_start_task_production`**：
   - 输入：
     - `taskId`: string (UUID)
     - `runtimeId`: string (UUID, 对应 host-c1 AgentOS Runtime)
     - `provider`: string ("pi")
     - `initialInstruction`: string (不可变的首条指令，包含特性分支、提 Draft PR、Spec-Kit 撰写、Taco 发布要求)
     - `expectedRevision`: number (Task 当前状态版本，通常为 1)
     - `idempotencyKey`: string (UUID，基于 Thread 与触发时间计算的防重放密钥)
   - 动作：原子将 Task 状态迁入 `in_progress`，冻结 `initialInstruction`，锁定 Runtime，触发 Workspace 准备并派发首个 Session。
3. **Session 消息续接（反馈与固化）**：
   - 当用户在 Thread 发送“已评论请修改”或“通过”时，Coordinator 向 Mystra 对应的 Task Session 发送新的 User Message。
   - 消息体遵循纯文本语义指令，沙盒工作 Agent 收到后执行增量处理。

## 4. 批处理与意图裁决规范

- **批处理防竞争**：人类在 Taco 批注通常是散点、多次的。Coordinator 只有在飞书 Thread 收到人类明确表示“已完成批注/请修改”的一条汇总指令后，才向沙盒发送单条修改触发消息。中途不监听或转发单条评论事件。
- **严格通过门禁**：
  - 只有匹配明确的批准断言（如“通过”、“确认批准”、“可以固化”）才触发阶段收尾。
  - 模糊肯定（如“感觉差不多了”、“挺好，但再看一下XX”）一律归为普通对话或待修改，严禁冒进触发固化。
