# Quickstart：Feature 049 验证

## 环境

```bash
fnm install 24.14.0
fnm use 24.14.0
corepack use pnpm@10.25.0
pnpm install
```

## 静态验证

```bash
rg -n 'turnId|SessionTurn|availableSlots|kind: "temporary"|workspace_prepared' specs/049-session-launch-framework packages apps
pnpm lint
pnpm typecheck
```

预期：049 的 Mystra 领域 schema/API 不含 turnId/SessionTurn、capacity claim 参数或第二套 temporary Workspace；ACP 文档可以出现其外部协议术语，但不能泄漏到领域合同。

## 合同测试

- launch 原子写入 Session + created + system_prompt_configured + user_message_submitted。
- launch 事务提交前不调用 Runtime/provider。
- 相同 sessionId/messageId 重放与不同 payload 冲突。
- queued 首消息在 provider_started 后进入 message_pending/running，不经过错误 ready。
- response 完成/取消后 Session ready，execute 调用返回，当前执行占用释放。
- claim 请求无 availableSlots，lease 无 capacity/slot。
- 所有成功 launch 的 attachment 与 048 ready TaskWorkspace 一致；缺少 Task 的 launch 返回 `session_task_required`。
- 1 万 typed events 顺序、重放、schema limit、redaction 与 Team boundary。

## 端到端路径

1. 创建 ready TaskWorkspace 并 launch Task Session；验证同事务四条记录。
2. Runtime claim，复用 Task workspace，启动 fake Provider，执行首消息。
3. Session ready 后依次 sendMessage 三次；验证 messageId 关联和同 Provider session。
4. 验证 approval resume_message、input new_message、handoff、cancel、failure。
5. 尝试 launch Project-only 与 standalone Session；验证两者都失败关闭且不创建第二套 Workspace 记录。
6. response 完成时验证 current execution release；Session 保持 ready 可继续。
7. 分页读取该 Session 全部 typed events；跨 Team 读取失败；无全局 event endpoint。

## HTML 规格视图

```bash
node scripts/render-spec-view.mjs --feature 049-session-launch-framework
```
