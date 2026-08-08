# Data Model: Agent

## Agent

| Field | Type | Constraints | Meaning |
| --- | --- | --- | --- |
| `id` | UUID string | PK, immutable | stable Agent identity |
| `teamId` | UUID string | FK → Team, immutable, required | tenant ownership |
| `name` | string | trim 后 1..120 | display metadata; not identity |
| `systemPrompt` | text | trim 后非空，max 32,768 | only behavior/effect configuration |
| `revision` | integer | >=1, monotonic | prompt semantic revision |
| `status` | enum string | `active` / `archived` | lifecycle |
| `archivedAt` | datetime nullable | status archived 时非空 | archive evidence |
| `createdAt` | datetime | immutable | creation time |
| `updatedAt` | datetime | monotonic best effort | last metadata/config write |

### Relationships

```text
Team 1 -------- * Agent

Agent -- no Project relation
Agent -- no Task relation
Agent -- no Session ownership relation
Agent -- no Runtime/Provider/Context relation
```

### Indexes

- PK/unique: `id`
- `teamId, status, id` for active-Team listing
- `teamId, id` is covered logically by ID lookup plus explicit Team predicate

名称不唯一。重复名称不会影响使用稳定 ID 的选择与 snapshot。

## State transitions

```text
create
  |
  v
active(revision=1)
  |  rename: revision unchanged
  |  prompt changes: revision + 1
  |  archive(expectedRevision)
  v
archived ----> terminal for MVP
```

Archived Agent 仍可读取；不能更新、不能再次解析为新 Session 输入。重复归档返回当前 archived 记录，不恢复 active。

## Update invariants

1. `teamId` 永不变化。
2. `expectedRevision` 必须等于当前 revision，即使操作仅重命名；这让 archive/prompt/rename 的竞争都有稳定结果。
3. `systemPrompt` 逐字相同则 revision 不变。
4. `systemPrompt` 逐字不同则 revision 恰好增加 1。
5. 条件更新 predicate 至少包含 `id + teamId + status=active + revision`。
6. 条件更新 count=0 后重新读取，用于区分 not found、archived 与 revision conflict。

## ResolvedAgentSnapshot

非持久化值对象，由 `resolveActiveAgent(agentId, teamId)` 原子读取 active Agent 后返回：

| Field | Type | Meaning |
| --- | --- | --- |
| `agentId` | UUID string | selected stable identity |
| `revision` | integer | prompt revision at resolution |
| `systemPrompt` | string | exact prompt delivered to system-level execution input |

它不包含 `projectId`、`taskId`、Runtime、Provider、Context、name 或 lifecycle 字段。未来 Session 保存此值，而不是执行时重新读取 Agent。

## Validation schemas

- `agentCreateRequestSchema`: strict `{ name, systemPrompt }`
- `agentCreateSchema`: internal strict `{ teamId, name, systemPrompt }`
- `agentUpdateRequestSchema`: strict `{ expectedRevision, name?, systemPrompt? }`，至少一个可变字段
- `agentArchiveRequestSchema`: strict `{ expectedRevision }`
- `agentListQuerySchema`: strict `{ limit=50, cursor?, includeArchived=false }`
- `agentSchema`: full response record
- `resolvedAgentSnapshotSchema`: strict snapshot

由于所有 request schema 都是 strict，`projectId`、`provider`、`runtimeId`、`contextId`、`skills`、`tools`、`model`、`teamId` 等字段会在公共入口被拒绝。
