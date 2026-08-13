# Quickstart：验证无 Agent Start 与可选 Agent Context

## 前置

```sh
fnm use 24.14.0
corepack use pnpm@10.25.0
corepack pnpm --filter @mystra/control-plane db:generate
```

准备一个 online host Runtime、可用 Provider、ready repository Project和两个 pending Task。Team可以没有 Agent。

## 默认路径：不选择 Agent

```sh
pnpm mystra tasks start <task-id> \
  --runtime-id <runtime-id> \
  --provider codex \
  --expected-revision 1 \
  --idempotency-key 052-no-agent-1
```

验证：

- Task进入 `in_progress`；
- Harness `agentId/agentRevision/agentName/agentSystemPrompt`均为 null；
- Workspace ready后只创建一个 Session，Session Agent字段为 null；
- `session.system_prompt_configured.standardPrompt.version`存在；
- evidence `agentContext`为 null，components没有 `agent_context`；
- 重放相同命令返回同一 Harness/Session。

## 可选路径：附加自定义 Agent Context

```sh
pnpm mystra tasks start <second-task-id> \
  --runtime-id <runtime-id> \
  --provider codex \
  --agent-context-id <active-agent-id> \
  --expected-revision 1 \
  --idempotency-key 052-agent-context-1
```

验证 evidence顺序为：

```text
standard -> runtime -> provider -> agent_context -> execution_context
```

更新或归档该 Agent后，原 Session的 name/revision/systemPrompt/finalPrompt不变；新 Task选择归档 Agent必须失败。

## workload 检查

在 claimed Workspace中：

```sh
mystra-agent whoami
mystra-agent context get
```

默认路径输出 `agentContext:null`；可选路径输出冻结的 Agent ID/name/revision。两者都只凭 execution code定位 attempt。

## 质量门禁

```sh
corepack pnpm --filter @mystra/shared test
corepack pnpm --filter @mystra/control-plane test
corepack pnpm --filter @mystra/agent-cli test
corepack pnpm --filter @mystra/runner-daemon test
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build
git diff --check
```

PostgreSQL runtime证据只有在设置 `MYSTRA_TEST_POSTGRES_URL`并实际运行对应 contract时成立。
