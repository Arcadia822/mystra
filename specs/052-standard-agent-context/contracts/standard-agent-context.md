# Contract：Standard Execution Prompt 与 Optional Agent Context

## Program contract

```json
{
  "version": "sha256:<64-hex-content-digest>",
  "content": "bounded immutable program text"
}
```

该对象不接受 API/MCP/CLI/Web输入，不来自环境变量，不保存为 Agent或 Team数据。

## Prompt evidence

无 Agent：

```json
{
  "standardPrompt": { "version": "sha256:<64-hex-content-digest>", "content": "..." },
  "agentContext": null,
  "components": [
    { "name": "standard", "content": "..." },
    { "name": "runtime", "content": "..." },
    { "name": "provider", "content": "..." },
    { "name": "execution_context", "content": "..." }
  ],
  "finalPrompt": "..."
}
```

选择 Agent时在 provider 与 execution_context之间增加：

```json
{
  "name": "agent_context",
  "content": "<optional_agent_context>..."
}
```

同时 `agentContext`保存 `{agentId,name,revision,systemPrompt}` snapshot。Runner只接收 `finalPrompt`。

## Human Start API

`POST /api/tasks/{taskId}/production/start`

```json
{
  "runtimeId": "uuid",
  "providerKey": "codex",
  "agentId": null,
  "expectedRevision": 1,
  "idempotencyKey": "start-052-1"
}
```

`agentId`可以省略或为 null；UUID表示显式选择。空字符串非法。旧 `/production/assign`不保留。

Success保持 051 Task/transition/Harness shape，但 Harness Agent snapshot字段nullable。

## MCP

Tool: `mystra_start_task_production`

```json
{
  "taskId": "uuid",
  "runtimeId": "uuid",
  "providerKey": "codex",
  "agentId": "optional uuid",
  "expectedRevision": 1,
  "idempotencyKey": "start-052-mcp-1"
}
```

MCP只做 auth、schema parse和 canonical service调用，不解析默认 Agent。

## Operator CLI

```text
mystra tasks start <task-id>
  --runtime-id <uuid>
  --provider <key>
  [--agent-context-id <uuid>]
  --expected-revision <positive-int>
  --idempotency-key <bounded-string>
```

未提供 `--agent-context-id`时 request省略 Agent；CLI不查询或创建默认 Agent。

## Workload API/CLI projection

`whoami`与 `context get`中的 execution identity包含：

```json
{
  "agentContext": null
}
```

或：

```json
{
  "agentContext": {
    "agentId": "uuid",
    "name": "Reviewer",
    "revision": 3
  }
}
```

不得只返回 nullable `agentId`而没有明确 `agentContext`，否则调用方无法区分旧数据缺失与主动未选择。

## Stable errors

沿用 051 errors，并保留：

- `agent_unavailable`: 显式选择 unknown、foreign或archived Agent；不降级。
- `invalid_request`: 空字符串 Agent ID、prompt evidence schema或standard prompt解析失败的边界输入。
- `task_status_conflict`: 同 idempotency key改变 Agent选择。
- `scope_mismatch`: Harness、Session、evidence的 optional Agent snapshot不一致。
