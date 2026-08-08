# 评审清单：Project Issue 来源与分集成浏览

## Owner 评审

- [x] 一个 Project 最多关联一个 Linear Team。
- [x] 一级 `/issues` 保留，并采用 Project-first。
- [x] 本功能不实现 Issue → Task dispatch。
- [x] 确认 GitHub 表格字段：Number、Title、State、Assignees、Labels、Milestone、Updated。
- [x] 确认 Linear 表格字段：Identifier、Title、Status、Priority、Assignee、Cycle、Updated。
- [x] 评审 Project Issues 与一级 Issues 的交互原型；当前版本可进入规划。
- [x] Mystra Issue 详情页暂不设计，Issue 行只打开 provider 原始页面。

## Spec 就绪度

- [x] Linear self-hosted API-key connection 边界明确。
- [x] Hosted Linear OAuth 明确延期。
- [x] GitHub automatic source 与 Linear explicit source 的关系明确。
- [x] Provider-specific table、filter、pagination 与 failure state 独立。
- [x] Task、Session、Runtime、Issue write-back 与 Integration cache 均在范围外。
- [x] 专用 Issue 详情页已明确延期，不再作为本规格中的隐含行为。
- [x] Requirements quality score 达到规划阈值。

## 后续插件检查

- [ ] `/speckit.plan` 使用 `api-and-interface-design` 定义连接、来源与列表 contract。
- [ ] `plan-eng-review` 检查 exact-connection、Team authorization、pagination 与第三方响应验证。
- [x] 当前 prototype 已完成 Owner review；UI 计划仍须使用 `frontend-ui-engineering` 映射实现边界。
- [ ] 实现前使用 GitNexus 检查 Integration registry、Project persistence 与现有 `/issues` 消费链路。
