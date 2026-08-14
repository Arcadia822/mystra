# Data Model：产品概览

## Persistence Impact

不新增 Overview entity、snapshot、统计表、缓存表或后台 job。053 只读取现有 Task 与 Session 当前事实。

可能增加的唯一 schema 变化是查询索引；SQLite/PostgreSQL 必须保持对等，且需由 query-plan evidence 证明必要性。

## Canonical Input Dependency

目标 Task current status：

| Code | 中文 | Top card | Task-level attention |
| --- | --- | --- | --- |
| `pending` | 未执行 | yes | no |
| `in_progress` | 执行中 | yes | no |
| `blocked` | 待接手 | yes | yes |
| `done` | 已完成 | yes | no |
| `canceled` | 已取消 | yes | no |

当前代码仍额外使用 `waiting_for_review`。054 以 pre-0.1 直接替换方式将其 handoff 语义并入 `blocked`；053 不定义兼容 alias。

## Overview Window

```ts
type OverviewWindow = "7d" | "30d" | "all";
```

窗口只筛选顶部 status counts：

```text
7d   -> task.createdAt >= observedAt - 7 days
30d  -> task.createdAt >= observedAt - 30 days
all  -> no lower bound
```

下界 inclusive；`observedAt` 由服务端在一次 read 中生成。attention 不受 window 影响。

## Task Status Counts

```ts
type TaskStatusCounts = {
  pending: number;
  inProgress: number;
  blocked: number;
  done: number;
  canceled: number;
};
```

Invariant：五值之和等于 cohort 内合法 Task 数，每个 Task 按当前状态只进入一项。

## Session Attention

Session 继续复用 049 canonical states：

| Session state | Attention label | Triggers attention |
| --- | --- | --- |
| `interrupted` | 已中断 | yes |
| `waiting_for_handoff` | 待接手 | yes |
| `failed` | 执行错误 | yes |
| other canonical states | — | no |

Session attention 只影响 attention list，不改变 Task status count。

## Attention Task Row

```ts
type AttentionTaskRow = {
  taskId: string;
  title: string;
  productionStatus: TaskProductionStatus;
  latestAttentionAt: string;
  taskAttention: "blocked" | null;
  sessionAttention: {
    interrupted: number;
    waitingForHandoff: number;
    failed: number;
  };
};
```

Deduplication：

```text
Task
  ├─ Task status attention? ───────────┐
  ├─ Session A interrupted ────────────┤
  ├─ Session B running                 ├─> one AttentionTaskRow
  └─ Session C failed ─────────────────┘
```

Rules：

- `done|canceled` Task 抑制旧 Session attention。
- `blocked` Task 本身是 attention，并显示为待接手。
- `latestAttentionAt` 是有效 Task/Session attention timestamps 的 max。
- 一行不返回 Session IDs；进入详情只使用 `taskId`。
- pagination key 为 `(latestAttentionAt, taskId)` descending。

## Read State

```ts
type OverviewReadState =
  | { status: "loading"; previous: OverviewSnapshot | null }
  | { status: "available"; data: OverviewSnapshot }
  | { status: "empty"; data: OverviewSnapshot }
  | { status: "unavailable"; previous: OverviewSnapshot | null; error: string };
```

单一 Overview endpoint 不提供“半个 snapshot 成功”的伪原子结果。请求失败时可保留 previous data 并明确标为 stale；不得把失败转为五个零。

## Index Candidates

实施时以 query plan 决定是否增加：

```text
Task    (teamId, createdAt, productionStatus, id)
Session (teamId, state, taskId, updatedAt, id)
```

索引不是产品实体，也不改变 API；SQLite/PostgreSQL schema parity 与 contract tests 必须同步。
