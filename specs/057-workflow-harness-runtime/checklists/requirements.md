---
title: "Requirements checklist：固定 Task Workflow Runtime"
taco_scope: spec
---

## Specification Quality Checklist

- [x] Owner 已明确当前只需要固定 Workflow，完整 Harness 与插件能力延期。
- [x] 没有待澄清标记。
- [x] 用户故事覆盖显式 enable/disable、Agent current/transition 与 Skill 投影。
- [x] 每个故事均提供独立测试与 Given/When/Then 验收场景。
- [x] 已固定唯一 Workflow ID、Stage、Action 与迁移图。
- [x] 已区分 `Task.status`、`TaskWorkflowState`、`Session.state` 与 `TaskExecutionContext`。
- [x] 已明确 Task 不增加 Workflow/Harness 复制字段。
- [x] 已明确不创建 Harness Resource、Task Harness Attachment、Catalog、Revision 或 handler registry。
- [x] 已明确只允许 Human/API/MCP/management CLI 显式 enable/disable，没有 replace、Resource 选择、自动路由或 Agent switch。
- [x] 已明确 workload CLI 不接受任意 Task、Workflow 或 state ID。
- [x] 已明确 Session capability 绑定精确 active `TaskWorkflowState`，disable/re-enable 后旧 Session 不能推进新 state。
- [x] 已覆盖 transition 乐观并发、幂等、append-only audit 与稳定错误语义。
- [x] 已明确固定 Workflow guidance 的 Prompt 顺序和信任边界。
- [x] 已明确动态 Stage、Action 与 Skill 信息不进入 frozen Session System Prompt。
- [x] 已明确 Skill ID 到 current ready Revision 的解析、来源感知与 Workspace projection。
- [x] 已明确同一 reconcile 的 Skill Revision snapshot 以及不同精确 Revision 要求的冲突语义。
- [x] 已选择 Stage commit 成功但 Skill projection 失败时不回滚，并给出可重试收敛语义。
- [x] 已覆盖 disable 后权限失效、Skill cleanup 重试与旧 Session frozen prompt 语义。
- [x] 已明确 terminal Stage 不自动改变 Task、Session、Issue 或 Workspace 生命周期。
- [x] 已明确内部模块 seam 只是未来替换边界，不是公共插件 API、持久化抽象或运行时能力。
- [x] 已明确 Web 编辑器、prototype、RoutingPolicy、DAG、远程插件与 marketplace 不在本期。
- [x] 成功标准包含并发、跨 Team、Prompt 泄漏、状态独立性、Skill 多来源与故障恢复的可测指标。

## Product Requirements Review

Reviewed with the project-local `product-requirements` rubric, adapted to Spec-Kit output rules.

**Quality Score: 97 / 100（高置信度）**

| Dimension | Score |
|---|---:|
| Business Value & Goals | 28 / 30 |
| Functional Requirements | 25 / 25 |
| User Or Operator Experience | 19 / 20 |
| Technical Constraints | 15 / 15 |
| Scope & Priorities | 10 / 10 |
| **Total** | **97 / 100** |

Notes:

- 需求已达到 planning readiness threshold。
- Plan 阶段需验证现有 Session prompt composition、Feature 056 Skill delivery、Task-scoped execution capability 与跨 RDB 并发实现接缝。
- Web UI 与编辑器不在本期，因此不要求 UI prototype。
- 未来通用 Harness 插件能力必须另立规格；本期仅要求固定 Workflow 模块具有清晰、可替换的内部边界。
