# Contract：Provider Session Adapter

```ts
type ProviderSessionStartRequest = {
  mystraSessionId: string;
  systemPrompt: string;
  userMessage: string;
  workingDirectory: string; // Runtime-local；不得进入 SessionEvent payload
};

type ProviderSessionContinueRequest = {
  mystraSessionId: string;
  providerSessionId: string;
  userMessage: string;
  workingDirectory: string;
};

type ProviderSessionCommand = {
  argv: string[];
  environment: Record<string, string>;
  executionOptions: ProviderExecutionOptions;
  workingDirectory: string;
}

interface ProviderSessionAdapter {
  readonly providerName: string;
  buildStartCommand(input: ProviderSessionStartRequest): ProviderSessionCommand;
  buildContinueCommand(input: ProviderSessionContinueRequest): ProviderSessionCommand;
  parseResult(result: ProviderProcessResult): ProviderSessionParsedResult;
}
```

## CLI mapping

- Codex start 使用 `codex exec --json`，continuation 使用 `codex exec resume`；Codex thread ID 只作为 providerSessionId。
- Copilot start/continuation 使用同一个 Mystra Session UUID 作为 CLI `--session-id`。
- system prompt 与第一条 user message 仅在 start command 中一次拼接；后续 command 只发送新的 user message。
- adapter 只构造命令与解析 Provider result；Runtime worker 负责进程、typed SessionEvent 与 messageId 关联。
- 外部协议即使使用 turn 术语，也不得暴露为 Mystra turnId 或领域实体。

## 资源语义

每条消息对应一个有界 CLI process。response 完成、取消或失败后 process 结束，Runtime 当前执行占用即释放。providerSessionId 保存在 dispatch lease 供下一条消息续接，但这不是平台 capacity reservation；Runtime loss 时不可假装旧进程仍存在。

## 安全

- workingDirectory 只在 Runtime 内部存在。
- adapter 输出必须经过共享 schema、限长与脱敏。
- 任意 stdout/stderr 不直接进入 SessionEvent；只有明确类型化、允许的 provider/log-derived 事件才能入库。
