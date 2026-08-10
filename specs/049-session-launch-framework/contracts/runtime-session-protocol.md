# Contract：Runtime Session Protocol

## Claim

```http
POST /api/runner/sessions/claim
X-Mystra-Runtime-Id: <runtimeId>
Content-Type: application/json
```

请求不包含 `availableSlots`、capacity 或并发上限。049 的 claim 只按 runtimeId 取得一个可执行 assignment；Runtime 是否并行发起多次 claim 属于 Runtime 内部实现，平台不在本规格施加容量限制。

```ts
type SessionClaimRequest = {
  runnerId: string;
  waitSeconds: number; // 0..25；当前服务允许立即返回 204
};

type SessionClaimAssignment = {
  session: Session;
  lease: {
    id: string;
    sessionId: string;
    runtimeId: string;
    runnerId: string;
    leaseToken: string;
    providerSessionId: string | null;
    leaseExpiresAt: string;
    claimedAt: string;
    updatedAt: string;
  };
  systemPrompt: string;
  workspace: SessionWorkspaceAttachment;
  message: UserMessageInput;
};
```

## 执行顺序

1. claim assignment；
2. resolve feature 048 Task workspace attachment；
3. 根据 `lease.providerSessionId` 构造 Provider start 或 continuation command；
4. 首次 Provider identity 可用时 emit `session.provider_started`；
5. 执行 `assignment.message` 并 emit response/tool/usage/result events；
6. response 结束后 child process 退出、释放当前执行占用，Session 进入 ready；providerSessionId 留在 lease 供下一条消息续接。

`session.workspace_attached` 已在 launch 事务内持久化，Runtime 不重复上报该事件。

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

type SessionEventBatch = {
  leaseToken: string;
  events: RuntimeSessionEvent[];
};
```

Runtime 通过 `POST /api/runner/sessions/{sessionId}/events` 上报，并同时发送 `X-Mystra-Team-Id` 与 `X-Mystra-Lease-Token`。Control Plane 验证 Team、runner/runtime ownership、lease、Session、sourceSequence、activeMessageId、共享 Zod schema、大小与脱敏规则。整批原子追加；失败返回稳定拒绝，不回显 payload 或 token。

## Heartbeat 与失联

Runtime enrollment/online 由 044 提供。lease 可续期，但不表达 capacity。Runtime offline 且 lease 无法恢复时，Control Plane 追加 `session.runtime_lost`/`session.failed`；首期不自动迁移。

## 后续消息

Control Plane 接受 `sendMessage` 后，Runtime 的后续 claim 取得 pending message，并通过 providerSessionId continuation 执行。用户补充文本使用新 messageId；审批/外部动作恢复沿用 activeMessageId。
