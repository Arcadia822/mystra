---
title: "Research：固定 Task Workflow Runtime"
taco_scope: plan
---

## Scope Interpretation

调研报告是设计输入，不是最终产品指令。报告中独立状态、Task-scoped CLI、固定 Prompt 指引、Skill 来源感知和 CAS transition 被采用；Harness Resource Catalog、OSS Workflow 配置、通用 Attachment、可编辑资源、replace/switch、routing/editor 与动态插件运行时均被 owner 的最新边界覆盖。

## Decisions

### 1. Dedicated state, not generic attachment

使用 `TaskWorkflowState`、`TaskWorkflowTransition` 和 `SessionWorkflowCapability` 三个专用模型。Typed columns 可约束 stage/lifecycle/version；`TaskHarnessAttachment.stateJson` 为不存在的 handlers 预付抽象成本，Task 字段会混淆业务状态，Session metadata 无法承载 Task-scoped lifecycle。

### 2. Re-enable creates a new identity

Disable 终止当前 row；之后 enable 创建新 state，从 `understand` 开始。nullable `activeKey="mystra.workflow"` + unique `(taskId, activeKey)` 保证最多一个 active row。原 row 原地复活会让旧 Session 重获权限，因此拒绝。

### 3. Explicit Session binding

Launch 创建 `SessionWorkflowCapability(sessionId, workflowStateId)`；workload resolve 必须同时验证 Session、execution lease、relation、state active 和 Team/Task scope。仅按 Task 查询 current active state 会错误绑定 re-enable 后的新 state。

### 4. Static prompt evidence

新增 optional `workflow` component，只说明 `current/transition` 与权威边界；排序为 `standard -> runtime -> provider -> workflow? -> agent_context? -> execution_context`。Stage/Action/Skill/version 不进入 frozen prompt。

### 5. Exact Skill resolution

固定 definition 使用四个 program-owned Skill names；Control Plane 通过 Feature 056 在 Task Team 内解析 active Skill/current ready Revision，并持久化 exact Skill/Revision sources。拒绝 repository-local filesystem、内容复制、fuzzy/跨 Team/旧 cache fallback。

### 6. Desired state in RDB, physical state on Runtime

RDB transaction 写 desired source generation；Runner/Agent CLI 物化后 report applied generation。Control Plane 不保存 host path，也不跨 OSS/filesystem 开事务。

### 7. Two authenticated projection paths

- Initial launch：claim assignment携带 exact manifest；Runner使用 lease token下载/物化，成功后启动 Provider。
- Running Session：`current/transition` 返回 generation；`mystra-agent` 使用 execution code下载并在当前 cwd 物化。

两条路径复用同一 materialization rules；Human Skill download route 不用于 workload。

### 8. Transition audit is the replay receipt

Successful transition row包含 `commandId`、payloadHash、from/to/version，unique `(workflowStateId, commandId)`。Same payload replay返回原 fact；different payload conflict。无需通用 command ledger。

### 9. Projection failure is partial success

Stage CAS先提交。resolve/materialize失败返回 committed Stage、generation、stable code/retryability；`current` 重试 reconcile，不重复 transition。跨系统回滚会制造比失败更精致的不一致，因此拒绝。

### 10. No UI and no public plugin API

只交付 canonical API + thin CLI/MCP。内部 module只对 composition root可见；未来可由新规格替换，但当前不承诺公共 contract。

## Existing Components Reused

- `SessionService` launch/evidence transaction。
- `RuntimeSessionService` claim、lease、execution code。
- `AgentExecutionService.#resolve` exact workload pattern。
- Task Workspace host materializer/provider cwd。
- Feature 056 Skill metadata、ready Revision、manifest/hash、S3 stream。
- static `mystra-agent` parser/client。

## Unresolved Decisions

None。固定 Skill seed 不满足时属于 environment/bootstrap repair，不扩大为 editor、Resource 或 filesystem fallback。
