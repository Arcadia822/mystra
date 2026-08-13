# 功能说明：标准执行提示词与可选 Agent 上下文

## 摘要

Mystra 的默认 Task 生产路径不再依赖一个所谓的“默认 Agent”。平台始终提供版本化的标准执行提示词；Team 即使没有任何自定义 Agent，也能直接 Start production。自定义 Agent 只在需要特定角色、领域知识或协作偏好时作为附加上下文参与执行，不替换标准职责。

## 功能地图

- **标准执行提示词**：程序拥有、不可由 Team 用户编辑，定义代码改动、自测、可审查交付与 Task 状态回报的默认职责。
- **无 Agent 默认路径**：Agent 选择可缺席，Task 仍创建 Harness 与唯一 Session。
- **可选 Agent 上下文**：选择 active Team Agent 时冻结其 revision，并以低于标准提示词的优先级叠加。
- **执行证据**：Session 冻结标准提示词版本、可选 Agent snapshot、prompt components 与最终文本。
- **产品入口**：无自定义 Agent 时不显示空 selector；存在扩展能力时明确标记为 Optional Agent Context。

## 边界

- 不初始化、不隐藏、也不合成 Default Agent 数据。
- 不允许自定义 Agent 关闭或替换平台标准执行职责。
- 不改变 051 的 Task 状态机、Workspace preparation、Harness 幂等或单 Session 规则。
- 不新增 Agent 管理 UI、自动分诊、默认绑定、提示词评测、PR 验真或 Task 删除。
- workload 身份仍来自 attempt-scoped execution code，而不是 Agent 的长期身份。

## 分阶段能力图

1. **本期**：标准提示词版本、Agent 可选合同、prompt 叠加与冻结证据、默认 Start UX。
2. **后续可选扩展**：自定义 Agent 管理体验、模板与发现，但仍只能补充标准提示词。
3. **独立后续规格**：Task 删除、任务分诊、Production Recipe、多 Session Harness、Artifact delivery 与质量验证。
