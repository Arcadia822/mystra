# 工程评审：Task Session 创建与历史体验

**状态**: 通过
**分支**: `050-task-session-experience`
**日期**: 2026-08-10

## 已有能力核对

| 能力 | 当前事实 | 050 决策 |
| --- | --- | --- |
| Session launch | 049 `SessionService.launch` 负责校验、prompt 组装、首消息与事务 | 增加窄的 `launchForTask` 编排并调用它 |
| Task Workspace | 048 提供单一 Workspace readiness/runtime affinity | Task 页面直接复用，不创建第二套 Workspace 模型 |
| Task Session list | RDB 已支持 `listSessions({ teamId, taskId })` | 直接复用，不增加 `listSessionsByTask` |
| Event history | 049 持久化 `SessionEvent`，after window 已存在 | 仅扩展 latest/before window，仍返回原始事件 |
| Session detail | 现有页面为 unavailable placeholder | 用 Session 与 SessionEvent 构建页面，不增加 view DTO |

## 范围决策

050 展示全部已知事件类别并提供 unknown fallback，但不跨事件聚合 tool call、响应摘要或终态摘要。没有 `SessionSummary`、`SessionDetail`、`TaskSession` view，也不增加重复持久化。Project-only 与 standalone Session、capacity、cancel/retry、message composer 和 delivery 均延后。

## GitNexus 检查

- `SessionService`: MEDIUM，8 个受影响符号、6 个直接调用者、无已识别高风险流程。
- `TaskDetailPage`: LOW。
- `TaskWorkspacePanel`: LOW，直接调用者仅 `TaskDetailPage`。
- `SessionDetailPage`: LOW。
- `RdbProvider.listSessionEvents` 与 `PrismaRdbProvider.listSessionEvents`: LOW，最大 3 个直接影响。

未发现 HIGH 或 CRITICAL blast radius。改动应保持为现有方法的向后兼容可选查询参数与页面内组合。

## 架构与数据流

1. Task Session 列表直接调用现有 `listSessions` 的 Task filter。
2. `launchForTask` 从 Task、ready Workspace、选定 Provider 和 Agent 映射 049 launch 请求；Runtime 来自 Workspace，Project 来自 Task 不可变 context。
3. 049 继续独占 Session 校验、system prompt 组装、Workspace attachment、首条 user message 与原子事务。
4. Event latest/before 在存储层倒序有界读取并于 API 边界恢复升序；after 保持升序。没有新表或 projection。
5. `TaskWorkspacePanel` 通过回调向父页面暴露最新 Workspace；客户端以 `eventId` 和 `globalSequence` 合并事件。

## 安全与边界

- 所有新 human route 使用现有 human authentication 与 Team permission gate。
- UI/API 不展示 system prompt、workspaceRef、providerSessionId、凭证或原始 runner stdout。
- 所有事件文本按普通文本渲染，不执行 HTML。
- 050 不引入 cancel/retry、全局 feed、Runtime capacity 或非 Task Session 准备逻辑。

## 代码质量约束

- Transport schema 直接引用共享 `Session` / `SessionEvent` schema。
- `launchForTask` 只做 Task-bound 编排并调用 `launch`，不复制执行状态机。
- Event presentation 是纯函数；unknown event 必须可展示。
- Workspace 回调为可选，避免破坏现有调用者。
- 新文案进入双语 `shell-copy.ts`，样式复用语义 token。

## 测试设计

```text
ready Workspace
  -> launchForTask
  -> 049 launch transaction
  -> contract + HTTP E2E

Task list route -> RDB task filter -> 1,000 Session pagination
Event route -> latest/before/after -> 10,000 Event pagination
Presentation reducer -> known + unknown event fixtures
Components/browser -> workspace states + launch + history + responsive + keyboard
```

## 失败与恢复

| 场景 | 预期 |
| --- | --- |
| Workspace absent/preparing/failed | 禁止 launch，并指向 Workspace 操作 |
| Provider capability drift | 稳定 capability error，保留页面状态 |
| 重复 session ID | `session_conflict`，不产生部分事件 |
| 非法 event window | `event_window_invalid` |
| 轮询重叠或页面隐藏 | 不并发请求；隐藏时停止 |
| unknown event | 通用事件卡片，保留类型与时间 |
| 刷新请求失败 | 保留已有内容并提供手动重试 |

## 性能边界

- Task 首屏最多 50 个 Session。
- Event 默认 100、最大 200，使用索引和有界窗口。
- 可见且活动时 3 秒轮询，错误退避至 15 秒；ready/closed/failed 停止自动轮询。
- 客户端合并为有界 O(n)，Runtime/Agent 选项读取同样有界。

## 结论与门禁

旧静态 prototype 的结论被豁免，改由真实页面浏览器验收。当前架构、数据、失败模型、测试和性能方案一致；无未解决的高风险项，可进入任务拆解与实现。
