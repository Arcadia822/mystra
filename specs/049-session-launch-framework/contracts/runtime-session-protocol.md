# Contract：Runtime Session Protocol

## Claim

```http
POST /internal/runtimes/{runtimeId}/sessions/claim
Authorization: Bearer <runtime credential>
```

请求不包含 `availableSlots`、capacity 或并发上限。049 的 claim 只按 runtimeId 取得一个可执行 assignment；Runtime 是否并行发起多次 claim 属于 Runtime 内部实现，平台不在本规格施加容量限制。

```ts
type RuntimeSessionAssignment = {
  dispatchId: string;
  leaseToken: string;
  leaseExpiresAt: string;
  session: Session;
  systemPrompt: string;
  firstUserMessage: UserMessageInput;
  workspace: {
    taskWorkspaceId: string;
    runtimeId: string;
    workspaceRef: string;
    sharingMode: "shared-mutable";
  };
};
```

## 执行顺序

1. claim assignment；
2. resolve feature 048 Task workspace attachment；
3. emit `session.workspace_attached`；
4. start Provider session；
5. emit `session.provider_started`；
6. execute assignment.firstUserMessage；
7. emit response/tool/usage/result events；
8. response 结束后释放当前执行占用，Session 进入 ready；Provider handle 是否暂存由 Runtime 内部管理。

`SessionDispatchLease` 是 ownership/auth，不是 Runtime slot reservation。

## Event batch

```ts
type RuntimeSessionEvent = {
  eventId: string;
  sourceSequence: number;
  messageId?: string;
  kind: string;
  version: 1;
  payload: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  occurredAt: string;
};

type RuntimeSessionEventBatch = {
  dispatchId: string;
  leaseToken: string;
  sourceId: string;
  events: RuntimeSessionEvent[];
};
```

Control Plane 验证 runtimeId、lease、Session、sourceSequence、activeMessageId、共享 Zod schema、大小与脱敏规则。整批原子追加；失败返回 `expectedNextSourceSequence`。

## Heartbeat 与失联

Runtime enrollment/online 由 044 提供。lease 可续期，但不表达 capacity。Runtime offline 且 lease 无法恢复时，Control Plane 追加 `session.runtime_lost`/`session.failed`；首期不自动迁移。

## 后续消息

Control Plane 接受 `sendMessage` 后，Runtime 从既有 Session assignment stream 获取 pending message 并在同一有效 Provider session 上执行。用户补充文本使用新 messageId；审批/外部动作恢复沿用 activeMessageId。
