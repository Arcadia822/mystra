# 研究与架构决策：Session 续接、读取与 Provider append 边界

**Feature**: `062-session-continuation-entrypoints`  
**Date**: 2026-09-22  

---

## 1. 现状与断层分析

1. **执行引擎已支持多轮消息续接**：
   - Feature 049 已在领域模型中定义了 `session.user_message_submitted`，并在 `applySessionEventProjection` 中支持从 `ready`（或 `interrupted:new_message`）迁移到 `message_pending`。
   - `SessionService.sendMessage` 已经实现了校验、幂等检查与事件追加。
   - Runner 端在执行完一轮后会将 Session 状态置为 `ready`，等待下一条消息。

2. **当前断层与关键痛点**：
   - **对外无 HTTP 路由**：`apps/control-plane/app/api/sessions/[id]/messages` 尚未建立。
   - **MCP 缺乏 Session 域工具**：外部 AI Agent 无法通过 MCP 读取任务会话列表、单会话详情或发起追问。
   - **CLI 缺少消息命令**：`scripts/operator-cli.mjs` 中的 `sessions` 命令组无 `send-message` 子命令。
   - **Busy append 尚未适配**：当前 Codex、Copilot 与 AgentOS Pi 接入只支持空闲后的下一轮续接，没有通过现有协议暴露 busy 状态 queue/steer。

---

## 2. 核心架构决策

### 决策 1：Client 端对 `messageId` 完全透明
- **问题**：底层 `userMessageInputSchema` 强校验 `messageId: z.string().uuid()`。若强制要求外部 Agent、CLI 用户或 Webhook 发送方提供 UUID，极大增加调用心智负担，且容易引发客户端伪随机生成的不良实践。
- **决定**：
  - **HTTP API**：请求体中的 `messageId` 定义为 `z.string().uuid().optional()`。若提供则透传（用于特定系统的幂等重试），若省略则由服务端在路由层或 Service 层自动生成 `crypto.randomUUID()`。
  - **MCP Tool**：输入 Schema 仅暴露 `sessionId` 和 `content`（字符串或数组），可选 `inReplyToMessageId`。MCP Handler 负责自动生成 `messageId`。
  - **Operator CLI**：命令行参数仅要求 `<sessionId>` 和 `--content <text>`，内部自动生成 `messageId`。

### 决策 2：不实现 Mystra 自有 Queue，Provider append 失败关闭
- **问题**：ACP v1 的 `session/prompt` / `session/cancel` 没有标准 queue/steer 模式；当前 Codex 与 Copilot 还是阻塞式 CLI 子进程接入，AgentOS Pi 的 ACP adapter 也未声明 busy append 能力。
- **决定**：
  1. Session 空闲时按既有 `session.user_message_submitted` 路径调度，响应为 `delivery: "dispatch"`。
  2. Session busy 时，只有 Provider 明确声明并实现原生 append 后才允许调用；能力模式为 `queue` 或 `steer`。
  3. 当前三个 Provider 均未适配该能力，因此统一抛出 `session_busy`，不创建 Mystra 自有 Queue 或待消费事件。
  4. 所有成功发送与显式重放统一返回 HTTP 202，由响应字段 `delivery: "dispatch" | "queue" | "steer"` 表示实际处理方式。
  5. 省略 `messageId` 时由服务端生成 UUID，不承诺跨请求网络重试幂等。

### 决策 3：Content 格式的宽容归一化
- **问题**：`content` 底层要求为 `Array<{ type: "text", text: string }>`。外部 Agent 或 CLI 调用时，最自然的格式是直接传一段字符串。
- **决定**：对外统一支持 `string | UserMessageContentPart[]`，并在入口层自动归一化：若为 `string`，自动转为 `[{ type: "text", text: input }]`。

### 决策 4：严格遵循无 Turn 实体契约
- 坚持 Mystra Constitution 原则：不引入 `Turn` / `SessionTurn` 或自有消息队列；空闲续接继续依靠 `SessionEvent`（`session.user_message_submitted`）与 Session 投影。
