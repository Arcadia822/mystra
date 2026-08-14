# Contract：Overview Read API

## Endpoint

```http
GET /api/overview?window=7d&attentionLimit=50&attentionCursor=<opaque>
```

认证沿用 Human session；active Team 从服务端 subject 解析。请求不接受 `teamId`。

## Query

```ts
const overviewQuerySchema = z.object({
  window: z.enum(["7d", "30d", "all"]).default("7d"),
  attentionLimit: z.coerce.number().int().min(1).max(100).default(50),
  attentionCursor: z.string().min(1).max(2_000).optional(),
}).strict();
```

- `7d`：`Task.createdAt >= observedAt - 7 * 24h`。
- `30d`：`Task.createdAt >= observedAt - 30 * 24h`。
- `all`：无创建时间下界。
- window 只影响 `taskStatusCounts`；不影响 `attention`。
- caller 不可传任意 timestamp、status array 或排序字段。

## Success Response

```ts
type OverviewSnapshot = {
  observedAt: string;
  window: "7d" | "30d" | "all";
  taskStatusCounts: {
    pending: number;
    inProgress: number;
    blocked: number;
    done: number;
    canceled: number;
  };
  attention: {
    items: AttentionTaskRow[];
    nextCursor: string | null;
  };
};

type AttentionTaskRow = {
  taskId: string;
  title: string;
  productionStatus:
    | "pending"
    | "in_progress"
    | "blocked"
    | "done"
    | "canceled";
  latestAttentionAt: string;
  taskAttention: "blocked" | null;
  sessionAttention: {
    interrupted: number;
    waitingForHandoff: number;
    failed: number;
  };
};
```

Response 使用 shared strict Zod schema，并设置：

```http
Cache-Control: no-store
```

## Invariants

1. `taskStatusCounts` 五个值之和等于窗口内合法 Task 数。
2. 每个 Task 只进入一个 status count。
3. attention 中每个 `taskId` 最多出现一次。
4. Task status 为 `blocked`，或非 `done|canceled` Task 存在 attention Session 时，Task 才进入 attention。
5. Session attention states 仅为 `interrupted|waiting_for_handoff|failed`。
6. `latestAttentionAt` 是匹配的 Task `statusUpdatedAt` 与 Session `updatedAt` 的最大值。
7. 排序固定为 `latestAttentionAt DESC, taskId DESC`。
8. cursor 绑定 Team 与最后一个排序 tuple；跨 Team、损坏或过期 cursor fail closed。
9. Response 不返回 Session ID、Session 列表、SessionEvent、Runtime 或 Project summary。

## Stable Errors

| Code | HTTP | Meaning |
| --- | --- | --- |
| `overview_request_invalid` | 400 | window/limit/query shape 无效 |
| `overview_cursor_invalid` | 400 | cursor 损坏、跨 Team 或与排序合同不符 |
| `overview_status_unsupported` | 500 | 数据中存在目标五态以外的 Task status |
| `overview_unavailable` | 500 | read model 无法安全完成 |

错误体沿用：

```json
{"error":{"code":"overview_unavailable","message":"Overview is temporarily unavailable"}}
```

不得在 message/details 中暴露 SQL、Prisma、Team ID、Session metadata 或 failure payload。

## Component Seam

```ts
type OverviewPageProps = {
  onRequestNewTask?: () => void; // optional 054 action seam; 053 does not own modal
};
```

Overview 不接受 caller-provided counts、teamId 或 Session rows，避免不同 shell consumer 绕过 canonical read contract。
