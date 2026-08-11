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
rg -n 'turnId|SessionTurn|availableSlots|kind: "temporary"|workspace_prepared' \
  packages/shared/src/session.ts apps/control-plane/prisma apps/control-plane/src/lib/sessions apps/runner-daemon/src/session
pnpm lint
pnpm typecheck
```

预期：实现与持久化 schema 不含 turnId/SessionTurn、capacity claim 参数或第二套 temporary Workspace。negative assertions 可以包含这些禁用词的字符串。

## 合同测试

- launch 原子写入 Session + created + system_prompt_configured + workspace_attached + user_message_submitted。
- launch 事务提交前不调用 Runtime/provider。
- 相同 sessionId/messageId 重放与不同 payload 冲突。
- queued 首消息在 provider_started 后进入 message_pending/running，不经过错误 ready。
- response 完成/取消后 Session ready，execute 调用返回，当前执行占用释放。
- claim 请求无 availableSlots，lease 无 capacity/slot。
- 所有成功 launch 的 attachment 与 048 ready TaskWorkspace 一致；缺少/不可见 Task 的 launch 返回 `task_not_found`。
- 1 万 typed events 顺序、重放、schema limit、redaction 与 Team boundary。

## 端到端路径

1. 创建 ready TaskWorkspace 并 launch Task Session；验证同事务一条 Session 与四条初始事件。
2. Runtime claim，复用 Task workspace，启动 fake Provider，执行首消息。
3. Session ready 后依次 sendMessage 两次；连同首条消息共执行三条，验证 messageId 关联和同 Provider session。
4. 验证 approval resume_message、input new_message、handoff、cancel、failure。
5. 尝试 launch Project-only 与 standalone Session；验证两者都失败关闭且不创建第二套 Workspace 记录。
6. response 完成时验证 current execution release；Session 保持 ready 可继续。
7. 分页读取该 Session 全部 typed events；跨 Team 读取失败；无全局 event endpoint。

## HTML 规格视图

```bash
node scripts/render-spec-view.mjs --feature 049-session-launch-framework
```

## 2026-08-10 implementation evidence

- `@mystra/shared`: 18 files / 139 tests passed.
- `@mystra/agent-adapters`: 2 files / 9 tests passed.
- `@mystra/control-plane`: 71 files passed, 1 PostgreSQL-dependent suite skipped; 326 tests passed, 18 skipped.
- `@mystra/runner-daemon`: 9 files / 31 tests passed.
- Root recursive TypeScript check passed for all four packages.
- SQLite contract covers one atomic launch, 20 identical launch replays, 20 identical message submissions,
  claim/lease/event projection, and three sequential messages using one persisted provider session ID.
- Real migrated-SQLite + local HTTP E2E covers launch without a second message call, two continuations,
  same provider session identity, interruption/handoff/duplicate report/close, and offline Runtime lease expiry.
- The same SQLite contract persists 10,000 typed usage events, reads the complete ledger through
  500-event keyset pages, replays all 10,000 original event IDs, and confirms the row count does not change.
- Both Prisma schemas formatted, validated, generated, and remained byte-identical at the logical-model level.
- Real Copilot CLI `1.0.79-6` accepted Mystra Session ID
  `00000000-0000-4000-8000-000000000049` for an initial request and a continuation; both exited 0,
  returned the requested exact marker, and changed no files.
- Real Codex verification is blocked: the installed wrapper resolves to a missing vendor binary and exits with
  `ENOENT`. Fake-process adapter coverage therefore does not masquerade as real Codex execution evidence.
- A real PostgreSQL/Supabase URL was not available; PostgreSQL migration connectivity remains unexecuted.
- Final owner reconciliation added a RED/GREEN regression proving that the frozen Context component carries the Task exact optional Issue reference. The Provider Agent receives provider/connection/scope/external ID/identifier and may resolve live Issue content through Runtime-local tools; 049 still performs no live Issue read and copies no Issue body.
