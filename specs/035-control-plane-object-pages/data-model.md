# 数据模型

本功能不新增持久化模型，只定义读投影。

## ControlPlaneProjection

- `checkedAt`
- `status`: `ready | degraded`
- `tasks`: total、queued、active、waitingForReview、succeeded、failed
- `runners`: total、online、stale、activeRuns、maxConcurrency、availableCapacity
- `recentTasks`: 最多 5 个现有 JobSnapshot 摘要

## RunnerProjection

直接使用 `PublicRunnerSession`：

- id、runnerName
- capabilities（agents、executor、image）
- maxConcurrency、activeRunCount
- lastHeartbeatAt、createdAt
- 详情页额外关联 `assignedTasks`，由现有 JobSnapshot 的
  `run.assignedRunnerSessionId` 投影。

## TaskProjection

直接使用 `JobSnapshot`：

- Job identity 与 immutable spec
- Run identity、state、attempt、timestamps、assigned runner
- Issue snapshot（可选）
- Project/lane/runtime
- events
- result，包括 quality、preview、review、sandbox、Agent evidence

## State Rules

- active: `assigned | starting | running`
- waiting: `waiting_for_review`
- terminal: `succeeded | failed | canceled | timed_out | waiting_for_review`
- cancel 可用：非 terminal；服务端仍是最终裁决者。
