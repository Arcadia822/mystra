# Shell Contract：025-webui

## Route Taxonomy

MVP shell 使用以下 route 与 shell action taxonomy：

| Surface ID | Label | Placement | Default Layout | 025 State |
| --- | --- | --- | --- | --- |
| `overview` | `Overview` | primary navigation | `dashboardLayout` | placeholder/inspection |
| `inbox` | `Inbox` | primary navigation | `readLayout` | placeholder |
| `new-task` | `New Task` | primary navigation | `chatLayout` | placeholder/inspection |
| `projects` | `Projects` | primary navigation | `readLayout` | current object pages + shell migration |
| `settings` | `Settings` | shell action/modal | `readLayout` | placeholder/inspection |
| `recent-sessions` | `Recent Sessions` | secondary route | `dashboardLayout` | placeholder/inspection |

本功能不得新增其他 primary route。已完成 035/036 中的 `Tasks`、`Runners` 和 Project object pages 在迁移期间保持可访问；025 实施必须明确决定其 secondary placement，不得静默删除对象页能力。

## Layout Archetypes

- `chatLayout`：对话式或 intake-oriented 页面框架。
- `dashboardLayout`：用于快速扫描和操作摘要的页面框架。
- `readLayout`：阅读、检查或 settings 页面框架。

除非 025 的后续变更显式更新 framework contract，否则必须使用上述 layout 之一。

## Placeholder Behavior

当 route 尚无专属页面 spec 时，shell 仍必须渲染：

- route title。
- 框架拥有的 description。
- 与 layout 匹配的 placeholder 或 inspection content。
- 可选的 follow-on spec 指针。

shell 不得为该 route 发明页面级 action、数据解释或编辑行为。

## Theme And Locale

- Theme selection 使用现有 control-plane theme system。
- Locale scaffolding 只适用于本功能中的 framework-owned labels 与 placeholder copy。
- 缺失 locale string 必须使用可预测 fallback。

## Host Compatibility

shell contract 必须同时适用于当前 Web host 与未来 Electron wrapper。Desktop-only affordances 必须隔离在 shared navigation、layout、theme、locale 和 base component contracts 之外。
