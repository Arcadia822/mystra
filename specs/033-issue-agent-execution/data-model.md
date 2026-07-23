# Data Model: Issue 驱动的 Agent 自主执行

## Integration

进程级配置对象，不持久化 secret。

| Field | Type | Rules |
|-------|------|-------|
| `name` | string | 非空、进程内唯一；MVP 为 `linear` |
| `provider` | string | MVP 为 `linear` |
| `capabilities` | string[] | MVP 包含 `issues` |

`LINEAR_API_KEY` 不属于该对象，只在构造 Linear adapter 时从环境读取。

## IssueReference

| Field | Type | Rules |
|-------|------|-------|
| `integration` | string | 注册的 Integration 名 |
| `provider` | string | `linear` |
| `externalId` | string | provider 稳定 ID |
| `identifier` | string | 人类可读标识，如 `ENG-123` |
| `url` | URL | 外部 Issue URL |

唯一身份为 `(integration, externalId)`；`identifier` 用于操作和展示。

## Issue

| Field | Type | Rules |
|-------|------|-------|
| `reference` | IssueReference | required |
| `title` | string | 1..500 |
| `description` | string \| null | 最多 100,000 字符 |
| `state` | `{ id, name, type? }` | provider 状态投影 |
| `priority` | `{ value, label } \| null` | 可选展示信息 |
| `assignee` | `{ id, name } \| null` | 只读 |
| `labels` | `{ id, name }[]` | 最多 100 |
| `createdAt` | datetime | 外部时间 |
| `updatedAt` | datetime | 外部时间 |
| `fetchedAt` | datetime | Mystra 获取时间 |

## IssueSnapshot

dispatch 时冻结并进入 JobSpec 与 execution spec。字段与 `Issue` 相同，但语义为
immutable。不得包含 API key、Authorization、raw GraphQL response 或 provider
client object。

## IssueDispatchRequest

| Field | Type | Rules |
|-------|------|-------|
| `projectId` | UUID | required，存在且未归档 |
| `agent` | `codex \| copilot` | required；今晚用 `copilot` |
| `branchName` | string | required，安全 git branch |
| `mergeRequest.title` | string? | 默认包含 Issue identifier/title |
| `mergeRequest.body` | string? | 默认引用 Issue URL/identifier |
| `runtime` | existing override? | 复用现有 policy-limited schema |

integration 和 identifier 来自 route path，不在 body 重复。

## JobSpec changes

- `jobSourceSchema` 增加 `issue`。
- `JobSpec.issue?: IssueSnapshot`。现有 API/MCP submission 仍可无 Issue；Issue
  dispatch contract 强制存在。
- `taskId` 使用 Issue identifier。
- Job row 新增 `issue_snapshot` JSON column。
- 本功能不读取旧 row；开发数据库以新 schema 重建。

## ExecutionSpecArtifact changes

新增 optional `issue` snapshot，使 sandbox Agent 从冻结 contract 获取完整任务，不再
访问 Linear。artifact version 从 1 升为 2；不保留 v1 reader。

## Run state

```text
queued
  ├─> assigned
  ├─> canceled
  └─> timed_out

assigned
  ├─> starting
  ├─> failed
  ├─> canceled
  └─> timed_out

starting
  ├─> running
  ├─> failed
  ├─> canceled
  └─> timed_out

running
  ├─> waiting_for_review
  ├─> failed
  ├─> canceled
  └─> timed_out
```

`waiting_for_review` 是机器执行终态：

- `finishedAt` 已设置；
- runner `active_run_count` 已递减；
- retained sandbox 可继续运行；
- result 必须包含完整 ReviewHandoff。

删除 `needs_human_review`，不保留双枚举。

## Execution phases and events

不持久化 node graph，只记录线性 phase 事实：

| Event | Required data |
|-------|---------------|
| `execution.started` | `pipelineVersion` |
| `repository.clone.started/succeeded` | repo，base commit |
| `agent.started/succeeded/failed` | agent，version，mode，cap，changed file count |
| `quality.test.started/passed/failed` | command，duration，exit status |
| `quality.build.started/passed/failed` | command，duration，exit status |
| `preview.started/ready/failed` | container，URL，probe count |
| `git.push_succeeded` | branch，commit SHA |
| `review.created/reused` | provider，URL，number |
| terminal `run.*` | summary |

这些事件描述事实，不构成可配置 workflow/node abstraction。

## QualityResult

| Field | Type | Rules |
|-------|------|-------|
| `test.status` | `passed \| failed` | required |
| `test.command` | string | required，脱敏 |
| `test.durationMs` | non-negative integer | required |
| `build.status` | `passed \| failed` | test passed 后 required |
| `build.command` | string | required，脱敏 |
| `build.durationMs` | non-negative integer | required |
| `logPath` | string | workspace 内路径，不是 logs API |

## AgentExecutionMetadata

| Field | Type | Rules |
|-------|------|-------|
| `agent` | `copilot` | required |
| `cliVersion` | string | required |
| `mode` | `autopilot` | required |
| `maxAutopilotContinues` | integer | 1..100，默认 10 |
| `exitCode` | integer | required |
| `changedFiles` | string[] | secret-safe relative paths |

## ReviewHandoff / RunResult

成功 result 的 status 为 `waiting_for_review`，并要求：

| Field | Type |
|-------|------|
| `issue` | IssueReference |
| `branch` | string |
| `commitSha` | string |
| `reviewResult.review.url` | URL |
| `quality` | QualityResult |
| `preview.url` | URL |
| `preview.containerName` | string |
| `sandboxOutcome` | existing SandboxOutcome |
| `agentExecution` | AgentExecutionMetadata |

失败/cancel/timeout result 不要求 ReviewHandoff，但必须有 `errorCode` 和 stage-aware
message。
