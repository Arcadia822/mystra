---
title: "Data Model: 主导航与 Task 工作台"
taco_scope: plan
---

## Task

沿用现有字段；现有 `productionStatus` 直接重命名为 `status` 并收敛为 `pending | in_progress | blocked | done | canceled`；新增 `metadata: Record<string, JsonValue>`，默认 `{}`。Metadata 是 Task 对象内部字段，不新增 `error/failed/waiting_for_review`，不保存外部 snapshot。

Task object、shared schema、create/read/update API、RDB contract、SQLite/PostgreSQL Prisma field 与底层 column 统一使用 `status`。对应 schema/type 使用 `taskStatusSchema` / `TaskStatus`；不保留 `productionStatus`、`production_status`、`taskProductionStatusSchema`、`TaskProductionStatus` alias、双读或双写。`statusRevision`、`statusNote`、`statusUpdatedAt`、`statusActor` 保留，因为这些后缀区分状态投影的不同属性，而不是重复 Task ownership。

## Task.metadata

- Shared/domain type：`Record<string, JsonValue>`；create 默认 `{}`，PATCH 提供时完整替换。
- SQLite/PostgreSQL Task row：沿用仓库现有 JSON-object persistence pattern，以一个 Task-owned JSON payload 持久化并在 mapper 中 parse/validate。
- API：list/detail/create/update response 都在 `task.metadata` 返回；不存在平行 `labels`。
- Presentation：JSON object 无顺序语义；前端负责 key/value formatting、排序与 overflow，数据库不保存展示顺序。
- Search：需要匹配 Metadata 时，在 query execution 中对原始可搜索文本做大小写不敏感比较；不写回规范化结果。

明确禁止：`TaskLabel` model/relation、`ordinal`、`normalizedKey`、`normalizedValue`、写入时 `lower`/Unicode normalized shadow fields，以及外部 Issue/Project metadata 合并。

## TaskPageQuery

`teamId` 从 authenticated active Team 注入；public query 含 `cursor?`、`limit=50..100`、`query?`、`statuses?`、`sort=updatedAt|createdAt|title|status`、`direction=asc|desc`。`query` 对 title 与 Metadata 可搜索文本执行查询时大小写不敏感匹配。cursor 绑定所有条件 fingerprint，条件改变必须从第一页重新读取。

## TaskWorkbenchItem

复用完整 Task domain fields，包括 Task 内部 `metadata`；Project display projection只包含 persisted `repositoryExternalId` 与 integration/provider key；Issue 复用 exact reference 的 `provider`/`identifier`。缺少引用为 null，provider 不可用不改变 row。

## Relationships

```text
Team 1 ── * Task
                ├── metadata JSON object (Task-owned field)
                ├── 0..1 Project reference
                ├── 0..1 exact Issue reference
                ├── 0..1 TaskExecutionAttempt (internal production-attempt coordination record)
                └── 0..* Session
```

TaskExecutionAttempt 不是 054 的用户可见产品实体、导航资源或 TaskWorkbenchItem 字段；这里仅记录现有 Start/Workspace/Autopilot Session 链路的持久化约束。不存在 TaskLabel 资源或子表。Project/Issue mutable snapshot 不是 TaskWorkbenchItem 的输入。

## State Transition Table

| Actor | From | To |
|---|---|---|
| Start | pending | in_progress |
| Agent | in_progress | blocked |
| Agent | blocked | in_progress |
| Human | blocked | in_progress / done / canceled |
| Human | pending / in_progress | canceled |

进入 `blocked` 必须 non-empty note；done/canceled terminal。
