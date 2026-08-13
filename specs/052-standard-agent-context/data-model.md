# 数据模型：标准执行提示词与可选 Agent 上下文

## 关系

```text
Program StandardExecutionPrompt(version, content)
                    |
                    v always
Task 1 -- 0..1 Harness 1 -- 0..1 Session
               |                    |
               +-- AgentContext?    +-- EffectiveSystemPromptEvidence
                   frozen snapshot      AgentContext? + ordered components
```

## StandardExecutionPrompt

程序值，不是 RDB entity。

| Field | Type | Rule |
| --- | --- | --- |
| version | `sha256:<64 hex>` | 由content确定，稳定且自动变化 |
| content | bounded string | 程序拥有；覆盖生产职责与工具责任边界 |

## AgentContextSnapshot

| Field | Type | Rule |
| --- | --- | --- |
| agentId | UUID | selected Agent ID |
| name | string | Start事务时冻结，用于历史审查 |
| revision | positive int | 与冻结 prompt同一 revision |
| systemPrompt | bounded string | 046 active Agent snapshot；只作补充上下文 |

整体类型为 `AgentContextSnapshot | null`。`null`表示明确未选择，不表示缺失数据。

## Harness

052 对 051 字段的替换：

- `agentId: UUID | null`
- `agentName: string | null`
- `agentRevision: positive int | null`
- `agentSystemPrompt: string | null`

四个字段必须全 null 或全 non-null。其余 Task/Project/Runtime/Provider/Workspace/Session/idempotency字段保持 051 合同。

## Session

- `agentId: UUID | null`
- `agentRevision: positive int | null`

二者必须同时存在或同时缺席。Agent name/prompt不复制到 Session row；完整快照属于初始 prompt evidence。

## EffectiveSystemPromptEvidence

| Field | Type | Rule |
| --- | --- | --- |
| standardPrompt | `{version, content}` | required |
| agentContext | snapshot or null | explicit absence |
| components | ordered array | 4 entries无 Agent，5 entries有 Agent |
| finalPrompt | bounded string | exact Runner input |

固定 component 顺序：

1. `standard`
2. `runtime`
3. `provider`
4. `agent_context`，仅选中 Agent时存在
5. `execution_context`

## Canonical Start request

```ts
{
  runtimeId: UUID;
  providerKey: ProviderName;
  agentId?: UUID | null;
  expectedRevision: positiveInt;
  idempotencyKey: boundedString;
}
```

规范化规则：omitted与 `null`都变为 `agentId:null`；空字符串不被规范化并直接 validation error。

Start fingerprint包含：Task、Runtime、Provider、normalized Agent ID、expected revision与其他既有 intent facts。同 key不同 normalized Agent ID是 conflict。

## Workload execution identity

```ts
{
  teamId: UUID;
  taskId: UUID;
  harnessId: UUID;
  sessionId: UUID;
  agentContext: null | {
    agentId: UUID;
    name: string;
    revision: positiveInt;
  };
  expiresAt: datetime;
}
```

execution code绑定 attempt，不绑定长期 Agent身份。scope validation对 optional snapshot执行成对一致性检查。

## Invariants

- 没有任何 persisted StandardExecutionPrompt、Default Agent或 sentinel ID。
- Harness snapshot四字段全有或全无。
- Session Agent字段全有或全无，并与 Harness optional snapshot一致。
- prompt evidence的 `agentContext`与 Harness/Session一致。
- 任何 selected Agent都在 Start同一 transaction内验证 active、Team与revision。
- 既有 Session prompt evidence在程序或 Agent更新后不可修改。
