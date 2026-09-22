# 实施计划：Session 续接与读取可达入口（HTTP / MCP / CLI）

**分支**: `062-session-continuation-entrypoints` | **日期**: 2026-09-22 | **规格**: [spec.md](./spec.md)

---

## 1. 架构目标与设计原则

为 Mystra 的 Session 续接与读取能力补齐对外部调用方（自动化 Coordinator、AI Coding Agent、运维人员）的全部可达入口，解决 MYST-7 等业务流中无法向运行中/等待中会话推进多轮交互的断层问题。

核心设计原则：
1. **统一的领域逻辑下沉**：HTTP、MCP 和 CLI 全部复用底层已有的 `SessionService`，入口层保持为薄适配器（Thin Adapters）。
2. **面向 Client 的极简体验**：对外统一隐去 `messageId` 的生成负担，支持文本内容自动归一化。
3. **Provider 能力失败关闭**：Mystra 不实现自有 Queue；当前 Provider 未适配 busy append，因此 busy 请求返回 `session_busy`。未来 Provider 原生 append 通过独立能力契约接入。
4. **坚持无 Turn 实体契约**：不引入独立的 Turn 数据表，坚持基于事件溯源与单一 Session 视图。

---

## 2. 涉及模块与改动清单

| 模块 | 文件路径 | 改动内容 |
|---|---|---|
| **Shared Contracts** | `packages/shared/src/session.ts` | 扩展 `sessionSendMessageRequestSchema`（允许 `messageId` optional），新增 `sessionSendMessageResponseSchema`，新增 content 宽容解析辅助。 |
| **Session Service** | `apps/control-plane/src/lib/sessions/session-service.ts` | 保留空闲态续接；busy 状态失败关闭，不创建 Mystra 自有 Queue 事件；成功响应返回 `delivery` 判别字段。 |
| **Canonical HTTP API** | `apps/control-plane/app/api/sessions/[id]/messages/route.ts` | 新建 POST 端点，解析请求、权限校验、调用 `SessionService.sendMessage`；成功统一返回 202，错误沿用稳定映射。 |
| **MCP Route** | `apps/control-plane/app/api/mcp/route.ts` | 在 `TOOL_DEFINITIONS` 中注册 `mystra_get_session`、`mystra_list_task_sessions`、`mystra_send_session_message`，并实现对应的 toolCall 分发与 Team 鉴权。 |
| **Operator CLI** | `scripts/operator-cli.mjs` | 在 `sessions` 命令组中实现 `send-message` 子命令，适配 HTTP 端点并格式化输出。 |

---

## 3. 详细分步实施路径

### 阶段 1：Shared Contracts 扩展与归一化
- 在 `@mystra/shared` 中定义 `sessionSendMessageHttpInputSchema` 与 `sessionSendMessageResponseSchema`。
- 允许外部请求中的 `messageId` 为可选，支持 `content` 为字符串或标准数组。
- 更新 `packages/shared/src/session.test.ts`，验证宽容模式与序列化。

### 阶段 2：SessionService 核心流转与 Provider 能力边界
- 重构 `SessionService.sendMessage`：
  - 若 `request.messageId` 未提供，自动生成 `this.#newId()`。
  - 若 Session 为 `ready` 或 `interrupted:new_message`：追加 `session.user_message_submitted`，迁移至 `message_pending`，返回 `{ session, created, delivery: "dispatch" }`。
  - 若 Session 为 `running` / `dispatched` / `message_pending`：当前 Provider 均无已适配的原生 append 能力，抛出 `SessionFailure("session_busy", ...)`，不写入 Queue 事件。
  - 若 Session 为 `closed` / `failed`：抛出 `SessionFailure("session_terminal", ...)`。
- 更新 `session-service.test.ts`，验证 busy 状态失败关闭且不追加事件。

### 阶段 3：Canonical HTTP Route 落地
- 创建 `apps/control-plane/app/api/sessions/[id]/messages/route.ts`。
- 提取 Session ID，校验 `requireHumanSession` 和 `requireTeamPermission(db, subject, "team.resource.access")`。
- 成功发送与重放统一返回 202；响应以 `delivery` 区分 `dispatch | queue | steer`，当前仅产生 `dispatch`；处理 409（busy/内容冲突）与 400（终态或格式错误）。
- 编写完整的 API 路由集成测试。

### 阶段 4：MCP Tools 补齐
- 在 `apps/control-plane/app/api/mcp/route.ts` 暴露 3 个 Session 工具：
  - `mystra_get_session`
  - `mystra_list_task_sessions`
  - `mystra_send_session_message`
- 复用 Team 隔离与权限检查，编写 `route.test.ts` 覆盖 3 个新工具的正常与异常场景。

### 阶段 5：Operator CLI 补齐
- 在 `scripts/operator-cli.mjs` 中的 `sessionCommands` 增加 `send-message`。
- 支持 `--content`、`--in-reply-to` 和 `--json` 参数。

---

## 4. 验证计划

1. **Focused Unit & Route Tests**:
   - `pnpm --filter @mystra/shared test`
   - `pnpm --filter @mystra/control-plane test`（涵盖 `session-service.test.ts`、`route.test.ts`、`mcp/route.test.ts` 等）
2. **Multi-Turn End-to-End Test**:
   - 复用真实 SQLite/Runner 测试，在 Session 每次回到空闲状态后连续发送消息并验证复用同一 Provider session；busy append 由单元/路由测试证明失败关闭。
3. **Typecheck & Lint**:
   - `pnpm typecheck`
   - `pnpm lint`
