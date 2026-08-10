# Contract：SessionEvent Presentation

presentation adapter 是纯函数：输入 049 SessionEvent，输出 UI display model。它不改变、汇总或持久化事件。

| 049 event kind | category | 展示 |
| --- | --- | --- |
| `session.created/runtime_dispatched/provider_started/workspace_attached/system_prompt_configured` | `lifecycle` | 紧凑状态节点；不展示 prompt/ref/provider session identifiers |
| `session.user_message_submitted` | `user-message` | 用户消息内容/Artifact 引用 |
| `session.agent_message_chunk` | `response` | Agent 输出流 |
| `session.agent_thought_chunk` | `thinking` | 默认折叠 |
| `session.plan_updated` | `plan` | 结构化计划 |
| `session.tool_call*` | `tool` | 每个事件独立显示并可展开安全 payload；不跨事件创建聚合 view |
| `session.usage_updated` | `usage` | token/成本 |
| `session.input_* / approval_* / interrupted / resumed` | `interrupt` | 下一步动作 |
| `session.handoff_*` | `handoff` | 人类接管状态 |
| `session.response_completed/canceled` | `result` | 最近一次 response 的结果；不是 Session 终态摘要 |
| `session.response_failed/session.failed/runtime_lost` | `error` | 已脱敏错误；failed 才是 Session 终态 |
| 未知 kind | `unknown` | kind、时间与安全 JSON 摘要 |

## 轮询

- active/waiting states：页面可见时每 3 秒 afterSequence 拉取，失败退避上限 15 秒。
- ready：停止自动轮询，显示“本次响应完成，可继续”，保留手动刷新。
- closed/failed：停止自动轮询，显示 Session 终态，保留手动刷新。
- 同页最多一个 in-flight event request；按 eventId/globalSequence 去重并检查连续性。

ready 的停止策略只属于 050 UI，因为本规格没有后续 user-message composer；049 Session 仍可被其他调用方继续。

## 安全

- text 以文本渲染，不信任 HTML。
- Artifact 通过授权下载接口解析。
- 不展示 workspaceRef、绝对路径、credential、完整 system prompt 或 raw Provider payload。
- unknown fallback 仍受 JSON depth/size 与 redaction 限制。
