# Quickstart：Feature 050 验证

## 静态合同

```bash
rg -n 'SessionSummary|SessionDetail|terminalSummary|objectiveLabel|lastEventSequence' specs/050-task-session-experience packages apps
node scripts/render-spec-view.mjs --feature 050-task-session-experience
```

预期：050 不定义上述 duplicate view；API 直接引用 049 Session/SessionEvent。

## 端到端

1. 创建 Task 与 ready TaskWorkspace。
2. 打开 Task 页面，确认 Runtime 锁定、Provider/Agent 可选、Manual Context 可选。
3. 提交一次 launch；确认 Session/system prompt/first user message 同事务创建，无第二次 sendMessage。
4. 立即进入 `/sessions/{id}`；不等待 Runtime。
5. Runtime claim 并执行第一条消息；页面按 globalSequence 展示 typed events。
6. response completed 后 Session 为 ready，页面显示“本次响应完成，可继续”，自动轮询停止，Refresh now 可用。
7. closed/failed 显示真正终态；unknown event 安全 fallback。
8. Task list 直接显示 Session 字段，并用 updatedAt/id 分页。

## 必须保留的证据

- Task/TaskWorkspace/Session ID 与固定 runtimeId。
- Provider/Agent/Manual Context 审计事件。
- Session 创建事务包含首消息的数据库/服务测试。
- 连续 SessionEvent globalSequence 与最近 response result。
- 真实浏览器的 Workspace 状态、列表分页、事件窗口和 ready/terminal 文案。
