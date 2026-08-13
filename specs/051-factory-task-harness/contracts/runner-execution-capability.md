# Contract：Runner execution capability handoff

## Session claim extension

既有 `SessionClaimAssignment` 增加可选字段：

```json
{
  "execution": {
    "code": "opaque-plaintext-returned-once",
    "expiresAt": "date-time",
    "capabilities": ["context:read", "task-status:read", "task-status:transition"]
  }
}
```

只有满足以下条件的 Session 才返回 `execution`：

- 存在 Harness 且 `Harness.sessionId == Session.id`；
- Harness Team/Task/Agent revision 与 Session一致；
- Harness未吊销且 Task非terminal；
- claim 事务成功写入 matching `executionCodeHash`/expiry。

普通手工 Session claim 没有该字段，Runner不得构造假 capability。

## Provider child environment

Runner 构造 command 后 merge：

```text
PATH=<agent-cli-bin-dir>:<existing-path>
MYSTRA_CONTROL_PLANE_URL=<runner-configured-endpoint>
MYSTRA_EXECUTION_CODE=<claim execution.code>
```

只有 assignment.execution 存在时注入 code。Control Plane URL 来自 Runner自身配置，不由 Session prompt/context提供。Provider adapter自己的 HOME/XDG/CODEX_HOME 等环境规则保持生效。

`runProviderProcess` 的日志/错误不得序列化完整 environment。execution code 不写 SessionEvent。

## Lifecycle

- code expiry 不晚于 lease expiry；默认 6 小时，与当前 lease上限一致。
- reclaim 生成新 code/hash，旧 code立即无效。
- Human done/canceled 或安全吊销写 `Harness.capabilityRevokedAt`；后续 workload call fail closed。
- Provider child退出不会自动修改 Task，也不会自动创建 blocked transition。
