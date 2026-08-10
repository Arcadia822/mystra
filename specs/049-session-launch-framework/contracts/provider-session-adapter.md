# Contract：Provider Session Adapter

```ts
type ProviderStartInput = {
  sessionId: string;
  providerKey: string;
  systemPrompt: string;
  cwd: string; // Runtime-local；不得进入公共合同或事件 payload
  metadata: Record<string, unknown>;
};

type ProviderMessageInput = {
  messageId: string;
  content: UserMessageInput["content"];
};

type ProviderSessionEvent = {
  messageId?: string;
  kind: string;
  payload: Record<string, unknown>;
  occurredAt: string;
};

interface ProviderSessionHandle {
  readonly providerSessionId: string;
  executeMessage(
    input: ProviderMessageInput,
    emit: (event: ProviderSessionEvent) => Promise<void>,
    signal: AbortSignal,
  ): Promise<{ stopReason: string; result?: Record<string, unknown> }>;
  resumeMessage(
    messageId: string,
    response: Record<string, unknown>,
    emit: (event: ProviderSessionEvent) => Promise<void>,
    signal: AbortSignal,
  ): Promise<{ stopReason: string; result?: Record<string, unknown> }>;
  cancelCurrent(): Promise<void>;
  close(): Promise<void>;
}

interface ProviderSessionAdapter {
  readonly providerKey: string;
  readonly protocolFamily: "acp" | "native" | string;
  readonly systemPromptStrategy: "native" | "context-message" | "unsupported";
  start(input: ProviderStartInput): Promise<ProviderSessionHandle>;
}
```

## ACP mapping

- `start()` 最多调用一次 ACP `session/new`。
- `executeMessage()` 可映射为 ACP `session/prompt`；ACP 的 turn 术语不暴露为 Mystra `turnId` 或领域实体。
- adapter 把 `session/update` 规范化为 message/thought/plan/tool/usage/input/approval/handoff 事件。
- stopReason 原样进入 `session.response_completed | session.response_canceled | session.interrupted` payload。
- 用户补充文本是新 messageId；审批或结构化外部动作恢复沿用 activeMessageId。
- 同一 handle 首期只串行执行一个 response。

## 资源语义

一次 response 完成、取消或失败后，`executeMessage` 返回，Runtime 当前执行占用即释放。Provider handle 可以由 Runtime 暂存以支持下一条消息，但这不是平台 capacity reservation。Session close 时必须释放 handle；Runtime loss 时不可假装旧 handle 可跨 Runtime 复用。

## 安全

- cwd 只在 Runtime 内部存在。
- adapter 输出必须经过共享 schema、限长与脱敏。
- 任意 stdout/stderr 不直接进入 SessionEvent；只有明确类型化、允许的 provider/log-derived 事件才能入库。
