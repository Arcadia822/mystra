# 评审清单：薄 Task 生产状态机

## Owner 决策

- [x] Task 是基本生产任务，并拥有 Mystra-owned productionStatus。
- [x] 状态仅为 pending、in_progress、blocked、waiting_for_review、done、canceled。
- [x] Agent 只可报告 blocked、恢复 in_progress、声明 waiting_for_review。
- [x] done 与 canceled 由 Human 控制。
- [x] Task productionStatus 与 Session.state 独立，不自动同步。
- [x] `mystra` 保留为 Control Plane 管理 CLI；workload-local 客户端定名为 `mystra-agent`。
- [x] `mystra-agent` 通过 attempt-scoped execution code 提供 whoami、context get 与 Task status 命令，不接受任意 Task ID。
- [x] Agent 使用本地已认证的 `linctl` 读取 Linear、使用本地已认证的 `gh` 提交 PR；Mystra 不代理、不提供凭据、不验证。
- [x] PR 和自测信息只是 Agent 声明；Mystra 不验证。
- [x] 一个 Harness attempt 仍只启动一个 goal/autopilot Session。
- [x] 已通过 shared contract、CLI command tests、真实 HTTP smoke 与浏览器 Task detail 验证状态机和 CLI 交互。

## Spec 就绪度

- [x] transition table、actor 权限和终态明确。
- [x] expectedRevision 与 idempotency 规则明确。
- [x] `mystra-agent` execution scope、`TaskExecutionContext` 与字段 allowlist 明确。
- [x] TaskStatusTransition 审计事实明确。
- [x] 047 的旧无状态边界被显式、有限地取代。
- [x] 外部 Issue status、Session state 和 Agent report 的边界明确。
- [x] Assign/Start 短事务与 Workspace-ready 后 Session launch 的边界已在 Spec 明确。
- [x] plan 与实现已确认 claim-time 签发、SHA-256 hash 持久化、六小时过期、终态吊销、Runner 环境传输和敏感信息清理。

## 后续边界

- [x] 已确认 PR/自测验真排除于 051，必须由后续独立 Spec 引入。
- [x] 已确认多 Session、心跳和事件订阅排除于 051，必须由后续独立 Spec 引入。
- [x] 已确认通用 Artifact/Delivery 与 Production Recipe 不是 051 的隐藏依赖。
- [x] 已确认 Mystra 不代理 `linctl`/`gh`、不托管本地 CLI 凭据；改变该边界必须另立 Spec。
