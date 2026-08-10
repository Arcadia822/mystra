# 实施计划：Task Session 创建与历史体验

**分支**: `050-task-session-experience` | **日期**: 2026-08-10 | **规格**: [spec.md](./spec.md)

## 摘要

050 把 048 Task Workspace 与 049 Task-bound Session execution contract 接入 Web。Task 页面列出直接复用的 `Session[]`；创建表单通过 `launchForTask` 组装 049 launch 输入；Session 页面直接读取 Session 与 SessionEvent。没有 SessionSummary、SessionDetail、TaskSession view、终态摘要列或重复持久化。Project-only 与 standalone Session 延后，不在 050 创建入口或准备逻辑中出现。

## 依赖与边界

| 责任 | Owner | 050 行为 |
| --- | --- | --- |
| Task Workspace readiness/affinity | 048 | 读取并锁定 Runtime |
| Session launch + first message | 049 | 直接调用 canonical service |
| Session/SessionEvent schema | 049 | API 原样复用 |
| Runtime/Provider capability | 044 | 读取 available providers |
| Agent | 046 | 读取 Team active agents |
| Task/Project Context | 047 | 服务端冻结 snapshot |

050 不增加 Runtime capacity、Session message composer、日志平台、repository materialization、Project-only/standalone Session 或 delivery。后续非 Task 场景必须复用同一 Workspace/attachment 合同。

## 数据流

```text
Task page
  -> GET TaskWorkspace (048)
  -> GET sessions by task -> Session[] (049 type)
  -> POST launch input
      -> launchForTask:
           authorize Task/Workspace/Runtime/Provider/Agent
           normalize Manual Context
           generate canonical firstUserMessage
           call 049 SessionService.launch
  -> navigate /sessions/{id}

Session page
  -> GET Session (049 type)
  -> GET SessionEvent window (049 type)
  -> pure presentation reducer
```

## API 与 RDB

- `GET /api/tasks/{taskId}/sessions` 复用 049 `listSessions({teamId,taskId,cursor})`，用现有 `(updatedAt DESC,id DESC)` 顺序返回 `Session[]` 与 opaque next cursor。
- `POST /api/tasks/{taskId}/sessions` 调用 `SessionService.launchForTask`，返回 `{session,created}`。
- `GET /api/sessions/{id}` 返回 `{session: Session}`。
- `GET /api/sessions/{id}/events` 返回 `SessionEvent[]` latest/beforeSequence/afterSequence window。
- 不增加 `listSessionsByTask`；RdbProvider 只扩展既有 `listSessionEvents` 的 before/descending window 能力，返回 shared SessionEvent，不定义 projection。

## launchForTask

1. 从 subject 解析 Team；读取 Task 及其不可变可选 Project context，不提供第二个 Project selector。
2. 读取 048 ready Workspace；runtimeId 固定为 workspace.runtimeId。
3. 验证 provider available、Agent active/same Team。
4. 校验 Manual Context schema 与长度。
5. 接受调用方 sessionId，服务端生成 canonical firstUserMessage.messageId 与稳定执行指令。
6. 调用 049 launch，使 Session/system prompt/Workspace attachment/first user message 同事务持久化。
7. 立即返回 queued Session；不等待 Runtime claim 或 response。

Web adapter 不自行拼 system prompt、不自行追加首消息、不复制 049 状态机。

## 列表与详情 UI

- Task 首屏最多 50 个 Session，直接显示 state/runtimeId/providerKey/agentId/updatedAt；Task Workspace panel 把最新 Workspace 状态传给 Sessions panel，不重复维护第二套 Workspace state machine。
- Runtime/Agent label 通过现有资源读取解析；失败时回退 ID。
- Session 页面 header 直接使用 Session；时间、消息与结果从 SessionEvent 事实展示。
- 不计算 objectiveLabel、terminalSummary、created/started/finished projection。

## Event window 与轮询

1. 首屏 `latest=100`，RDB 倒序有界读取后在 API 边界恢复 globalSequence 升序。
2. Load earlier 使用 beforeSequence，并在客户端按 eventId/globalSequence 去重后 prepend。
3. 活动/等待状态且页面可见时，每 3 秒 afterSequence 拉取；错误退避至 15 秒。
4. ready/closed/failed 停止自动轮询并保留 Refresh now。
5. ready 的 UI 标签为“本次响应完成，可继续”；closed/failed 才标终态。
6. 纯 reducer 显示全部已知类型及 unknown fallback；050 不做跨事件聚合、terminal summary 或新的持久化/传输 view。

## 实施顺序

1. shared API response 引用 049 Session/SessionEvent schema。
2. 复用 RdbProvider Task filter，并扩展 SessionEvent before/descending window 与 SQLite/PostgreSQL contract tests。
3. `launchForTask` service 与 048/049 contract tests。
4. Task Workspace states + Session list + launch form。
5. Session header + event presentation/window/可见性轮询。
6. error mapping、redaction、accessibility 与 responsive states。
7. 真实 Runtime/provider E2E 与浏览器验证。

## 验证

- Static：仓库无 050 SessionSummary/SessionDetail types；API schema 引用 049。
- Contract：Task/Team/Workspace/Provider/Agent 校验；同事务首消息；稳定 lowercase error codes。
- Pagination：1,000 Sessions、10,000 events 的 latest/before/after window，无重复/缺口、请求有界。
- UI：workspace absent/preparing/failed/ready；locked Runtime；unknown event；ready 与终态文案。
- E2E：ready Workspace -> launch -> Runtime claim -> first message -> response events -> ready；记录 IDs 与连续 globalSequence。

## 工程评审状态

2026-08-10 新版 plan-eng-review 通过：复用现有 Session Task filter；只扩展既有 event read window；选择完整事件类别但不做跨事件聚合。prototype 不作为实现前阻塞，真实浏览器实现验收取代旧静态 prototype 结论。详见 [engineering-review.md](./engineering-review.md)。
