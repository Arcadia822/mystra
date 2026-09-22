# 任务分解：Session 续接与读取可达入口（HTTP / MCP / CLI）

**分支**: `062-session-continuation-entrypoints` | **日期**: 2026-09-22 | **规格**: [spec.md](./spec.md) | **计划**: [plan.md](./plan.md)

---

## Phase 1: Shared Contracts 扩展 (Foundation)

- [x] T001 在 `packages/shared/src/session.ts` 中新增 `sessionSendMessageHttpInputSchema`，支持 `messageId` 可选，支持 `content` 为单字符串或结构化 ContentPart 数组自动归一化
- [x] T002 在 `packages/shared/src/session.ts` 中新增 `sessionSendMessageResponseSchema`，包含 `session`、`created`、`delivery` 与 `messageId` 字段
- [x] T003 在 `packages/shared/src/session.test.ts` 中添加测试用例，覆盖输入 Schema 的可选 messageId、宽容 content 归一化及响应 Schema 校验

---

## Phase 2: SessionService 核心改造 (Core Engine)

- [x] T004 在 `apps/control-plane/src/lib/sessions/session-service.ts` 中升级 `sendMessage`，在请求未提供 `messageId` 时自动兜底生成 `this.#newId()`
- [x] T005 在 `apps/control-plane/src/lib/sessions/session-service.ts` 中保持 busy 状态失败关闭，不创建 Mystra 自有 Queue；当前 Provider 未适配原生 append 时返回 `session_busy`
- [x] T006 更新 `apps/control-plane/src/lib/sessions/session-service.test.ts`，验证空闲状态返回 `delivery: "dispatch"`、busy 状态不追加事件、显式 messageId 重放返回 `created: false` 以及终态拒绝

---

## Phase 3: Canonical HTTP Route 实现 (API Layer)

- [x] T007 创建 `apps/control-plane/app/api/sessions/[id]/messages/route.ts`，实现 `POST` 接口，集成 Team 鉴权与 `team.resource.access` 权限检查
- [x] T008 在 `route.ts` 中统一成功响应为 HTTP 202 Accepted，并由 `delivery` 字段区分 `dispatch | queue | steer`
- [x] T009 在 `apps/control-plane/app/api/sessions/[id]/messages/route.test.ts` 中覆盖统一成功状态、busy 409、消息冲突与终态错误

---

## Phase 4: MCP Tools 接入 (Agent Protocol)

- [x] T010 在 `apps/control-plane/app/api/mcp/route.ts` 的 `TOOL_DEFINITIONS` 中注册 `mystra_get_session`、`mystra_list_task_sessions` 与 `mystra_send_session_message`
- [x] T011 在 `apps/control-plane/app/api/mcp/route.ts` 的 handler 中实现 3 个工具的实际执行逻辑与 Team 权限校验，并对 Client 隐藏 `messageId`
- [x] T012 在 `apps/control-plane/app/api/mcp/route.test.ts` 中增加这 3 个新工具的测试用例

---

## Phase 5: Operator CLI 子命令实现 (CLI Layer)

- [x] T013 在 `scripts/operator-cli.mjs` 中的 `sessionCommands` 增加 `send-message` 子命令，支持 `<id> --content <text> [--in-reply-to <id>] [--json]`
- [x] T014 在命令行工具测试中验证 `send-message` 命令的文本和 JSON 格式输出

---

## Phase 6: 端到端验证与收尾 (Verification & Closure)

- [x] T015 运行全量受影响的单元与集成测试（shared + control-plane）
- [x] T016 运行 `pnpm typecheck` 确保类型安全无报错
- [x] T017 执行端到端多轮流转验证测试（首条消息 + 忙碌中第 2 条 202 消息 + 第 3 条续接消息）
- [x] T018 重新打包 Taco 评审文件并更新状态
