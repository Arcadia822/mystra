# 数据模型：薄 Task 生产状态机与 mystra-agent CLI

## 关系概览

```text
Team 1 -- * Task 1 -- 0..1 Harness 1 -- 0..1 Session
               |             |
               *             0..1 TaskWorkspace
      TaskStatusTransition   |
                             * claim rotates
                    SessionDispatchLease + executionCodeHash
```

Task/Project/Agent/Harness/Session 都是 Team-scoped sibling objects。Harness 通过 references 关联这些对象，不改变其 ownership。

## Task production projection

在现有 Task 字段上增加：

| 字段 | 类型 | 约束 |
| --- | --- | --- |
| `productionStatus` | enum | `pending|in_progress|blocked|waiting_for_review|done|canceled`；create 默认 pending |
| `statusRevision` | positive integer | create 为 1；每次成功迁移 +1 |
| `statusNote` | string? | 有界、trim；blocked/waiting_for_review 必填；无 note 的新迁移清为 null |
| `statusUpdatedAt` | timestamp | 当前 transition 的 occurredAt |
| `statusActor` | object projection | `{kind,id?,agentId?,harnessId?,sessionId?}`；create 为 system |

title/description/Project/Issue 的现有可变/不可变规则不变。productionStatus 不映射 external Issue status 或 Session.state。

## TaskStatusTransition

| 字段 | 类型 | 约束 |
| --- | --- | --- |
| `id` | UUID | transitionId primary key |
| `teamId` | UUID | tenant filter |
| `taskId` | UUID | Task FK |
| `fromStatus` | enum | transition 前的 productionStatus；Task 创建的初始 pending 不额外制造 transition |
| `toStatus` | enum | 必填 |
| `revision` | positive integer | 对应写入后的 Task.statusRevision；`(taskId,revision)` unique |
| `actorKind` | enum | `system|human|agent` |
| `actorId` | string? | Human user/session subject stable ID；system 可空 |
| `agentId` | UUID? | workload transition 必填 |
| `harnessId` | UUID? | workload transition 必填 |
| `sessionId` | UUID? | workload transition 必填 |
| `note` | string? | 有界不可信文本 |
| `idempotencyKey` | string | 每次 command 必填；`(taskId,idempotencyKey)` unique |
| `requestFingerprint` | SHA-256 hex | 同 key 不同 payload 检测 |
| `occurredAt` | timestamp | 服务端时间 |

相同 key + fingerprint 返回原 transition；相同 key + 不同 fingerprint 返回 `task_status_conflict`。

## Harness

| 字段 | 类型 | 约束 |
| --- | --- | --- |
| `id` | UUID | primary key |
| `teamId` | UUID | tenant boundary |
| `taskId` | UUID | v1 unique；一个 Task 至多一个 attempt |
| `agentId` | UUID | frozen assignment |
| `agentRevision` | positive integer | frozen revision |
| `agentSystemPrompt` | bounded text | frozen prompt snapshot；不含 execution code |
| `taskTitle` | bounded text | Assign 时冻结 |
| `taskDescription` | bounded text | Assign 时冻结 |
| `taskIssue` | bounded JSON? | Assign 时冻结 exact Issue reference；不含 body |
| `runtimeId` | UUID | selected Runtime |
| `providerKey` | provider enum | selected available Provider |
| `workspaceId` | UUID? | ready/setup 后绑定；unique when non-null |
| `plannedSessionId` | UUID | Assign 时预分配的非外键幂等 identity；unique |
| `sessionId` | UUID? | Session 创建后绑定的真实 FK；unique when non-null |
| `firstMessageId` | UUID | Assign 时预分配；用于 idempotent launch |
| `assignIdempotencyKey` | string | 与 Task scope 唯一 |
| `assignRequestFingerprint` | SHA-256 hex | replay validation |
| `capabilityRevokedAt` | timestamp? | Human done/canceled 或显式安全吊销 |
| `setupFailureCode` | bounded string? | Workspace setup/preparation 最近 failure code；不是 Harness state |
| `setupFailureMessage` | bounded string? | redacted operator diagnostic；成功 continuation 清空 |
| `createdAt`,`updatedAt` | timestamp | durable attempt identity |

Harness 没有 `status`、heartbeat、retry counters 或 output fields。Workspace/Session nullable existence 与 setup failure diagnostic 是异步事实，不是 Harness lifecycle。

## SessionDispatchLease execution capability

在既有 lease 上增加：

| 字段 | 类型 | 约束 |
| --- | --- | --- |
| `executionCodeHash` | SHA-256 hex? | 仅 Harness Session claim 存在；不保存明文 |
| `executionCodeExpiresAt` | timestamp? | 不晚于 lease expiry |

每次有效 claim/reclaim 生成新 code/hash。workload authorization 同时验证：

1. indexed hash lookup 匹配当前 lease；未知、过期和吊销对调用方返回同类错误；
2. `now < executionCodeExpiresAt <= leaseExpiresAt`；
3. lease Session 与 Harness.sessionId 相同；
4. Harness、Task、Session、Agent revision、Team references 一致；
5. Harness.capabilityRevokedAt 为空；
6. Task 非 `done|canceled`。

任何失败只返回稳定 capability error，不泄漏对象是否存在。

## TaskExecutionContext

CLI 输出 version `1`：

```ts
type TaskExecutionContext = {
  version: 1;
  execution: {
    teamId: string;
    taskId: string;
    harnessId: string;
    sessionId: string;
    agentId: string;
    agentRevision: number;
  };
  task: {
    title: string;
    description: string;
    issue: ExactIssueReference | null;
  };
  project: {
    id: string;
    repositoryConnectionId: string;
    repositoryExternalId: string;
    repositoryBaseBranch: string;
  };
  workspace: {
    id: string;
    root: string;
    branch: string;
  };
  capabilities: ["context:read", "task-status:read", "task-status:transition"];
};
```

Control Plane response 不含 `workspace.root`，CLI 用 workload `process.cwd()` 合成最终输出。Task 输入来自 Harness frozen fields；Issue reference 仍是 exact immutable reference，不含 Linear body。Project只返回 repository identity/configured base branch，不返回 credential、URL token 或 Integration secret。

## 状态迁移矩阵

| Actor | from | to | note |
| --- | --- | --- | --- |
| Human Assign | pending | in_progress | optional |
| Agent | in_progress | blocked | required |
| Agent | blocked | in_progress | optional |
| Agent | in_progress | waiting_for_review | required |
| Human | blocked | in_progress | optional |
| Human | waiting_for_review | in_progress | optional |
| Human | waiting_for_review | done | optional |
| Human | pending/in_progress/blocked/waiting_for_review | canceled | optional |

其余全部 `invalid_transition`。done/canceled 终态。

## 原子不变量

1. Assign transaction 同时创建 pending->in_progress transition、Task projection 和 Harness；任一失败全部回滚。
2. production transition 同时更新 Task projection/history；terminal Human transition 同时吊销 Harness capability。
3. Harness taskId/plannedSessionId/sessionId unique；未创建 Session 前不得写悬空 session FK；同 Workspace attempt + completion payload 可重放；重复 ready continuation 最多创建一个 Session。
4. Agent status actor identity来自 capability resolution，不接受 request body task/agent/harness/session IDs。
5. execution code 永不进入 Harness、TaskTransition、SessionEvent payload、prompt 或日志。
6. Session projection/event事务不更新 Task；TaskStatusService 不写 Session event/state。
