---
title: "059 数据模型"
---

## TaskExecutionContext

增加 `initialInstruction: string`：启动请求的有效首条用户指令，在Task进入in_progress与创建生产上下文的同一事务中保存。字段非空、长度遵循Session文本上限；不包含system prompt或凭据。请求可省略，持久化值不得省略，防止延后启动时默认内容变化。

该值参与生产启动请求指纹以及同plannedSessionId的重放一致性比较。不能通过updateExecutionContext的运行时状态更新接口改写。

SQLite与PostgreSQL模型必须一致，RdbProvider不泄漏数据库类型。功能字段部署不删除现存Task/Session，任何必要破坏性重建另需用户授权。

## Session

沿用firstUserMessage和user_message_submitted事件。后续新Session可选择自己的首条指令；已有Session续接使用消息接口，不重写bootstrap。既有launchPayload完整请求比较继续承担Session启动幂等。

## Runtime

type仅host或agentos。AgentOS发现pi；Host发现codex/copilot。本次不保留早期未授权opensandbox值。Runtime身份、Task.runtimeId锁定和Workspace(taskId,runtimeId)唯一语义不变。

## AgentOS私有会话状态

持久化SQLite由Runtime持有，按Mystra Session标识隔离且位于任务仓库外。每次open/get/prompt显式传相同public sessionId。非秘密env如MYSTRA_AGENT_PATH可持久化；execution code只能留在host binding内存中。模型配置依既有模型凭据策略处理，不进入Task/Session事件或用户输出。
