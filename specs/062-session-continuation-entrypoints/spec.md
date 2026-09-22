---
title: "功能规格：Session 续接与读取入口（HTTP / MCP / CLI）"
feature_id: "062-session-continuation-entrypoints"
created: "2026-09-22"
status: "Draft"
input: |-
  User description: "为 Session 续接与读取补齐可达入口（HTTP / MCP / CLI），对齐 MYST-28 闭环要求，支持 busy 状态下的 Queue / Steer 机制，消除底层已就绪但无对外调用入口的断层。"
---

## 概述与背景

在 MYST-7（飞书触发需求设计、Taco 评审与开发移交闭环）中，Coordinator 收到用户的修改批注或批准通知后，需要向原需求 Session 追发一条普通用户消息（User Message）以驱动会话批改循环或触发固化收尾。

然而当前控制面处于“底层有实现，外层无可达入口”的状态：
1. `SessionService.sendMessage` 已经在 Feature 049/055 中实现空闲 Session 的续接逻辑，但没有对应的 HTTP 路由对外暴露；当前已接入 Provider 均未通过现有接入协议暴露 busy 状态 append 能力。
2. MCP 工具集缺少 Session 域相关的任何操作工具（既不能读取 Session 详情，也不能列出任务下的 Session，更无法发送消息续接）。
3. Operator CLI 的 `sessions` 命令组拥有 `list/create/inspect/wait/cancel/result/failure`，但独缺发送消息的能力。

本特性将既有的 Session 读取与空闲态续接能力通过标准的 **Canonical HTTP API**、**MCP Tools** 和 **Operator CLI** 完整暴露，并保证调用端无需生成底层 `messageId`。Mystra 不实现自有消息队列；Session busy 时，只有 Provider 明确声明并实现原生 append 能力后才能选择 `queue` 或 `steer`，当前 Provider 一律返回稳定的 `session_busy` 错误。

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 外部协调系统通过 HTTP API 续接与干预会话 (Priority: P1)

作为外部编排系统或 webhook 回调处理者（如 MYST-7 Coordinator），我希望调用标准 HTTP 端点向空闲 Session 追加后续用户输入；当 Session 正在执行且 Provider 尚未适配原生 append 时，我需要收到明确错误，而不是得到无法兑现的排队承诺。

**Why this priority**: 这是自动化需求批改与多轮会话交互的基础协议入口，阻断了飞书闭环的自动推进。

**Independent Test**:
创建一个 Session，通过 `POST /api/sessions/:id/messages` 发送纯文本内容。在 Session 为 `ready` 时验证统一返回 202 Accepted、`delivery: "dispatch"` 并切为调度状态；在 `running` / `dispatched` / `message_pending` 状态时验证返回 `session_busy` 且不写入待消费事件。

**Acceptance Scenarios**:
1. **Given** 处于 `ready`（或处于 `interrupted` 且 `continuationMode === "new_message"`）状态的 Session，
   **When** 客户端发送 `POST /api/sessions/:id/messages`，传入 `content`（支持简单字符串或标准 content parts），
   **Then** 服务端自动补充内部 `messageId`，将消息追加并调度 Provider，统一返回 HTTP 202 Accepted、`delivery: "dispatch"` 与 Session 视图。
2. **Given** Session 正在执行中（`running` / `dispatched` / `message_pending`），且当前 Provider 未声明原生 append 能力，
   **When** 客户端发送 `POST /api/sessions/:id/messages`，
   **Then** 请求返回 HTTP 409 Conflict（`session_busy`），且 Mystra 不创建自有 Queue 事件。
3. **Given** 客户端显式携带相同的 `messageId` 与相同的 `content`，
   **When** 再次发送请求，
   **Then** 服务端返回同一统一成功状态与 `created: false, delivery: "dispatch"`，不产生重复事件；省略 `messageId` 的请求不承诺跨请求幂等。
4. **Given** 客户端复用了已存在的 `messageId` 但发送了篡改的内容，
   **When** 发送请求，
   **Then** 服务端拒绝并返回 HTTP 409 Conflict（`session_conflict`）。
5. **Given** Session 已处于终态（`closed`/`failed`），
   **When** 发送追加消息请求，
   **Then** 服务端拒绝并返回 HTTP 400 Bad Request（`session_terminal`）。

---

### User Story 2 - AI Coding Agent 通过 MCP 工具查询与续接 Session (Priority: P1)

作为接入 Mystra MCP 的 AI Agent（如 Claude Code、Codex 或 OMP），我希望通过直观的 MCP 工具读取 Task 下的会话状态并发送消息，使得 Agent 能够直接参与任务诊断、进度跟踪和多 Agent 协同。

**Why this priority**: MCP 是 Mystra 面向外部 Agent 与 Skill 交互的核心协议面。外部 Agent 无法读取和续接 Session 将导致平台 Agent 间无法自协作。

**Independent Test**:
在 MCP 客户端中依次调用 `mystra_list_task_sessions`、`mystra_get_session` 与 `mystra_send_session_message`，验证从发现会话到成功续接的全流程。

**Acceptance Scenarios**:
1. **Given** 一个存在会话的 Task，
   **When** Agent 调用 `mystra_list_task_sessions({ taskId, limit?: number })`，
   **Then** 校验当前 Team 权限后，返回结构化的 Session 列表与分页信息。
2. **Given** 任意有效的 `sessionId`，
   **When** Agent 调用 `mystra_get_session({ id: sessionId })`，
   **Then** 返回该 Session 的详细运行时状态、锁定 Runtime、Provider、最后消息等。
3. **Given** 处于有效状态的 Session，
   **When** Agent 调用 `mystra_send_session_message({ sessionId, content: "请根据反馈调整文档" })`，
   **Then** Agent 无需提供或生成 `messageId`，工具内部自动装配并调用控制面，返回发送成功的响应，指示是即时调度（created）还是已排队/steer（accepted）。

---

### User Story 3 - 维护与测试人员通过 Operator CLI 发送消息与读取 (Priority: P2)

作为平台运维或测试人员，我希望在终端直接运行 `mystra sessions send-message <id> --content <text>`，以便在命令行快速完成联调、触发测试或注入干预指令。

**Why this priority**: 保证命令行工具链（Operator CLI）与 Canonical API 的能力平权，提供最直接的排障与回归工具。

**Independent Test**:
通过 `scripts/operator-cli.mjs sessions send-message <id> --content "..."` 执行命令，检查终端格式化输出及退出的状态码。

**Acceptance Scenarios**:
1. **Given** 处于可接收状态的 Session，
   **When** 运行 `mystra sessions send-message <id> --content "测试内容"`，
   **Then** 命令自动装配 `messageId`，向控制面发送请求，并打印 `delivery: "dispatch"`；busy Session 返回稳定错误。
2. **Given** 脚本化自动化调用需要，
   **When** 附加 `--json` 参数，
   **Then** 输出结构化 JSON，包含 `created`、`delivery`、`messageId` 与 Session 实体。

---

## Edge Cases

1. **会话执行中接收到新消息**：
   - Mystra 不实现自有消息队列。当前 Codex、Copilot 与 AgentOS Pi 接入均未暴露 busy 状态 Provider append 能力，因此返回 `session_busy`，且不追加事件。
   - 后续 Provider 若声明原生 append 能力，可按其真实能力返回 `delivery: "queue"` 或 `delivery: "steer"`；该适配由独立 Issue 跟踪。
2. **并发发送冲突**：两个调用方几乎同时向同一个空闲 Session 发送不同内容时，先提交者进入调度，后提交者因 Session 已 busy 而失败关闭；Mystra 不代替 Provider 排队。
3. **Content 格式宽容性**：
   - 调用方可能传入简单的字符串（如 `"请重新生成"`），也可能传入标准的 `[{ type: "text", text: "..." }]` 数组。
   - 处理方式：在 HTTP 路由层、MCP 工具层以及 CLI 适配层做自动归一化，单字符串自动包裹为标准的单文本 ContentPart 结构，向底层传递严格合规的 shared schema。
4. **Task 归属与跨租户安全隔离**：
   - 调用 `mystra_list_task_sessions` 时，传入的 `taskId` 不属于当前鉴权上下文所在的 Team。
   - 处理方式：返回 404 Not Found 或权限拒绝，杜绝横向越权。

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001 (Canonical HTTP Route)**: 控制面必须提供 `POST /api/sessions/[id]/messages` 路由，接受 `sessionSendMessageRequestSchema`（支持 content 字符串或数组自动归一化），复用已有 `SessionService.sendMessage` 执行入库。
- **FR-002 (MessageId 客户端透明化)**: HTTP API 请求体中的 `messageId` 字段必须为可选；若调用方省略，控制面服务端必须通过 `crypto.randomUUID()` 自动生成。MCP 工具和 CLI 命令对使用者完全隐藏 `messageId` 生成逻辑。
- **FR-003 (HTTP 状态码契约)**:
  - 所有成功发送与显式 `messageId` 重放统一返回 `202 Accepted`，响应通过 `delivery: "dispatch" | "queue" | "steer"` 描述 Provider 处理方式；
  - 当前实现只产生 `delivery: "dispatch"`；
  - busy Session 返回 `409 Conflict`（`session_busy`），消息内容冲突返回 `409 Conflict`，终态返回 `400 Bad Request`。
- **FR-004 (Provider append 边界)**: Mystra 不实现自有 Queue。只有 Provider 明确声明并实现原生 append 后才能支持 busy 状态 `queue` 或 `steer`；当前已接入 Provider 均未适配该能力，因此 busy 状态失败关闭。
- **FR-005 (MCP 会话读取工具)**: MCP 服务端必须新增 `mystra_get_session` 与 `mystra_list_task_sessions` 工具，严格对齐 Team-scoped 访问控制。
- **FR-006 (MCP 会话续接工具)**: MCP 服务端必须新增 `mystra_send_session_message` 工具，输入参数仅要求 `sessionId` 与 `content`，可选 `inReplyToMessageId`。
- **FR-007 (Operator CLI 薄封装)**: `scripts/operator-cli.mjs` 必须在 `sessions` 命名空间下补齐 `send-message` 命令，支持 `--content`、`--in-reply-to` 和 `--json` 参数。
- **FR-008 (无 Turn 实体契约)**: 全流程不得引入 `Turn` 或 `SessionTurn` 数据表与业务对象，所有状态流转与事件完全挂接在现有的 `Session` 与 `SessionEvent`（kind: `session.user_message_submitted`）中。

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 外部系统通过一次单向 HTTP / MCP 请求即可成功向 Session 追加消息，完全无需前置申请 `messageId`。
- **SC-002**: 当前 Provider 的 busy Session 请求稳定返回 `session_busy`，且不产生不可消费的队列事件。
- **SC-003**: 单元与端到端测试证明同一 Session 在每次回到空闲状态后可连续续接，并复用同一 Provider session。
- **SC-004**: 显式提供相同 `messageId` 时保持既有幂等冲突语义；省略 `messageId` 不承诺跨请求重试幂等。

---

## Assumptions

1. 现有的 `SessionService.sendMessage` 核心框架与事件追加体系结构良好，本特性通过解除 busy 硬阻断并接入 Queue/Steer，使得多轮与并发追加具备完整的生命周期承载力。
2. 权限模型完全沿用已有的 Team 鉴权逻辑（`requireTeamPermission(..., "team.resource.access")`）。
