# 功能说明：薄 Task 生产状态机与 mystra-agent CLI

## 摘要

051 的第一版只增加一套业务状态：Task.productionStatus。Assign/Start 的短事务把 pending Task 原子推进到 in_progress 并创建轻量 Harness attempt；Workspace ready 后再幂等启动其唯一 Autopilot Session。随后由 Agent 通过 workload-local `mystra-agent` 报告 blocked、恢复 in_progress 或声明 waiting_for_review；done 与 canceled 仍由人控制。

## 状态边界

- Task productionStatus：pending、in_progress、blocked、waiting_for_review、done、canceled。
- Session.state：执行会话是否 queued、running、ready、failed 等。
- Harness attempt：冻结 Agent revision 并关联一次 Session，不拥有第二套状态机。
- External Issue status：仍由 Linear/GitHub Provider 拥有，不复制、不回写、不映射。

## 两个 CLI 的边界

- `mystra`：Human、外部 Agent 和自动化使用的 Control Plane 管理 CLI。
- `mystra-agent`：当前 Agent workload 使用的 attempt-scoped CLI。
- `mystra-agent whoami`：解析当前 execution identity。
- `mystra-agent context get`：取得版本化 `TaskExecutionContext`。
- `mystra-agent task status get`：读取当前状态、revision 和允许迁移。
- `mystra-agent task status set blocked`：报告阻塞，必须带 note。
- `mystra-agent task status set in_progress`：从 blocked 恢复。
- `mystra-agent task status set waiting_for_review`：声明等待人工审查，必须带 note。
- Runtime 只注入 Control Plane URL 与短期 execution code；CLI 不允许 Agent 指定任意 Task。

`TaskExecutionContext` 提供冻结 Task 输入、exact Issue reference、Project repository 配置和 Workspace 路径/分支，但不复制 Linear body，也不返回任何外部凭据。Agent 使用宿主机已认证的 `linctl` 读取 Linear，使用已认证的 `gh` 推送并创建 PR。Agent note 可包含 PR 和自测摘要，但这些只是 Agent reported。Mystra 不代理这些 CLI、不回退到 Project Integration credential、不查询 PR、不运行测试、不验证交付结果。

## 第一版边界

- 一个 Harness attempt 只启动一个 goal/autopilot Session。
- Session state 不自动驱动 Task productionStatus。
- 所有状态迁移使用专用 TaskStatusService，并应用 transition allowlist、expectedRevision、idempotency key 和 append-only history。
- Agent 不能设置 pending、done、canceled，也不能通过 CLI 修改 Task requirement。
- `linctl` 或 `gh` 缺失/未认证时，由 Agent 报告 blocked；Mystra 不代为执行。
- 完整 Harness 心跳、事件订阅、多 Session、通用 Artifact、Production Recipe 和质量验收均延后。
