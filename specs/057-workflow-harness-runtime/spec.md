---
title: "功能规格：固定 Task Workflow Runtime"
---

**Feature Branch**: `057-workflow-harness-runtime`

**Created**: 2026-08-24

**Status**: Draft

**Input**: 为 Task 提供一个固定、平台内置的 `mystra.workflow` 工作协议：Human 显式启用或停用，Session 获得固定 Workflow 指引，Agent 通过 Task-scoped `mystra-agent workflow current/transition` 读取和推进阶段，Workspace 按当前阶段投影所需 Skill。首期不实现完整 Harness 产品、Resource Catalog、动态插件或可编辑 Workflow；底层代码只保留未来抽取为可扩展 Harness plugin seam 的清晰边界。

**User Story Discussion**: Owner 已明确收缩此前方案：当前只交付一个固定 Workflow，不建设通用 `HarnessResource`、`TaskHarnessAttachment`、handler registry、插件运行时或 Workflow Resource CRUD。架构应把固定 Workflow 的 Prompt、命令、状态迁移和 Skill contribution 放在一个内聚的内部边界中，使未来规格可以把它替换为可扩展 Harness plugin contract；该未来扩展性不是本期产品能力。

## 决策摘要

- 首期只有一个平台内置 Workflow，稳定 ID 为 `mystra.workflow`；定义随 Mystra 代码/受控静态资产发布，不由 Team 创建、编辑、archive 或选择不同 Resource。
- 固定状态图为 `understand -> implement -> verify -> completed`；`verify` 可通过失败 Action 返回 `implement`。Stage、Action、Prompt 与所需 Skill 都属于 program-owned definition。
- Human 或具备 Task 管理权限的 Control Plane caller 可以显式 enable/disable Workflow；没有 replace、Resource 选择、自动路由或 Agent switch。
- Workflow 运行状态保存在专用 `TaskWorkflowState`，不写入 `Task`，也不创建通用 attachment JSON。它与 `Task.status`、`Session.state`、`TaskExecutionContext` 和 Workspace preparation state 正交。
- Session launch 时若 Workflow active，则 execution code capability 绑定该精确 `TaskWorkflowState`。Disable 后旧 capability 对 Workflow 操作立即失效；旧 Session 不会因为仍指向同一 Task 而重新获得能力。
- 新 Session 的 effective prompt 在 program-owned Standard Execution Prompt 之后加入固定 Workflow base prompt；当前 Stage、Action、Skill 和 stateVersion 只能通过 workload CLI 获取。
- Workflow 定义引用固定 Skill keys。每次 resolve/reconcile 将其解析为当前可交付的精确 Skill Revision/path，并使用来源感知的 Workspace projection；不同来源仍不得相互误删。
- Stage transition 先原子提交专用状态与审计事实，再 reconcile Skill。Skill 投影失败不回滚已提交的 Stage，而是返回权威新阶段与可重试错误，后续 `current` 或 reconcile 修复。
- 实现必须把 Workflow definition、Prompt contribution、workload command handler、state transition 与 Skill contribution 收拢在一个内部模块 seam 中；不得把该 seam 暴露为公共插件 API、通用持久化模型或远程代码加载器。

## User Scenarios & Testing

### User Story 1 - 为 Task 启用或停用固定 Workflow (Priority: P1)

作为 Team 操作者，我希望为一个 Task 显式启用或停用固定 `mystra.workflow`，以便控制该 Task 后续 Session 是否遵循阶段化工作协议，而不修改 Task 数据模型或选择任意 Workflow Resource。

**Why this priority**: 首期价值是让需要结构化执行的 Task 获得一个可靠工作协议，而不是先建设可以容纳尚不存在插件的管理平台。

**Independent Test**: 对同 Team Task enable Workflow，验证专用状态初始化为 `understand`；重复 enable 返回同一 active 结果；disable 后 workload CLI 立即失效，新 Session 不再获得 Workflow prompt，Task/Session 状态均不自动变化。

**Acceptance Scenarios**:

1. **Given** 同 Team Task 尚未启用 Workflow，**When** 有管理权限的 caller 显式 enable，**Then** 系统创建唯一 active `TaskWorkflowState`，当前 Stage 为 `understand`，且 `Task` 不新增 Workflow 字段。
2. **Given** Workflow 已 active，**When** 相同 enable command 重放，**Then** 返回同一 active state，不创建重复记录、不重置 Stage。
3. **Given** Workflow 已 active，**When** caller disable，**Then** 状态立即 inactive，后续 Session 不再获得 Workflow prompt，绑定该状态的 workload capability 立即失效，Skill sources 进入幂等清理。
4. **Given** Agent workload、自动策略或无管理权限 caller，**When** 它尝试 enable/disable Workflow，**Then** 系统拒绝请求；首期不存在 Resource 列表、选择、replace 或自动路由。

---

### User Story 2 - Agent 读取并推进固定阶段 (Priority: P1)

作为当前 Task Session 中的 Agent，我希望使用 `mystra-agent workflow current` 读取权威阶段，并使用 `transition <action-id>` 执行当前阶段允许的 Action，以便明确现在应完成什么以及下一步如何推进。

**Why this priority**: 固定 Workflow 的主要产品表面是可查询、可验证的阶段协议，而不是一段只能在 Session 开始时被看见的建议文本。

**Independent Test**: 只注入当前 Session execution code，不传 Task/Workflow/state ID；current 返回固定 definition 的当前 Stage、Prompt、精确 Skill Revision/path 与 Actions；合法 transition 返回完整新阶段；非法、并发、disable 后和跨 scope 调用均无越权写入。

**Acceptance Scenarios**:

1. **Given** Session launch 时 Task Workflow active，**When** Agent 执行 `workflow current`，**Then** 返回 Workflow 摘要、当前 Stage、阶段指引、required Skills、available Actions 和 projection health，不要求或接受任意对象 ID。
2. **Given** 当前 Stage 为 `understand`，**When** Agent transition `understanding-complete`，**Then** 状态进入 `implement`，响应包含新阶段完整上下文和 Skill changes。
3. **Given** 当前 Stage 为 `implement`，**When** Agent transition `implementation-complete`，**Then** 状态进入 `verify`；随后 `verification-failed` 返回 `implement`，`verification-passed` 进入 terminal `completed`。
4. **Given** Action 不属于当前 Stage，**When** Agent 请求 transition，**Then** 状态保持不变并返回 `workflow_action_not_allowed` 与可安全披露的当前阶段。
5. **Given** 20 个请求并发推进同一 stateVersion，**When** 服务提交迁移，**Then** 最多一个成功，其余返回 `workflow_state_conflict` 与最新阶段，不静默覆盖或自动重试到新 Stage。
6. **Given** Workflow disabled、capability 绑定旧 state、execution code 过期/吊销或 scope 不匹配，**When** CLI 调用，**Then** 请求 fail closed，不泄漏其他 Task 或 Workflow 状态。

---

### User Story 3 - Session Prompt 与 Workspace Skill 保持一致 (Priority: P1)

作为平台操作者，我希望 Workflow active 时的新 Session 获得固定基础指引，Workspace 同时投影全局和当前阶段 Skill，以便 Agent 的说明、命令和可用能力都指向同一个权威 Stage。

**Why this priority**: Prompt、CLI 与 Skill 若分别维护状态，系统会获得三个事实来源。它们都可能非常自信，这正是问题所在。

**Independent Test**: enable 后启动 Session，确认 prompt 只加入固定 base prompt；current 返回动态阶段信息；transition 后确认 Skill source diff；模拟 Skill projection 失败、共享 Skill 多来源和 disable，验证状态提交、重试与来源清理语义。

**Acceptance Scenarios**:

1. **Given** Workflow active，**When** 创建新 Session，**Then** effective prompt 保留 Standard Execution Prompt 的最高优先级并加入固定 Workflow base prompt；不得加入当前 stageId、阶段 Prompt、Action、Skill、state ID 或 stateVersion。
2. **Given** 当前 Stage 为 S，**When** Session launch、current 或 transition 触发 reconcile，**Then** desired Skills 等于固定 Workflow global Skills、S 的 Stage Skills 与其他批准来源的并集，每个 Skill 返回精确 Revision/path。
3. **Given** transition 已提交但 Skill projection 失败，**When** CLI 返回，**Then** Workflow 保持新 Stage，响应返回 `workflow_skill_projection_failed`、权威阶段和 retryable 标识；恢复后的 current/reconcile 收敛到同一 desired set，不产生第二次 transition。
4. **Given** 同一 Skill 来自 Workflow 和其他来源，**When** transition 或 disable 移除 Workflow source，**Then** 其他来源仍存在时不得取消该 Skill projection。
5. **Given** Workflow disabled，**When** 后续 Session launch，**Then** 不加入 Workflow prompt、不授予 Workflow capability、不报告 Workflow Skill source；既有 Session 的 frozen prompt evidence 不被改写。

### Edge Cases

- enable 与 disable 并发时，expected revision 与 command identity 必须产生唯一合法结果；不得出现两个 active states。
- disable 后 Skill cleanup 失败时，Workflow capability 失效仍立即生效；残留物化内容不得被报告为有效 Workflow source，并可在 provider 恢复后重试清理。
- terminal `completed` 只表示固定 Workflow 没有后续 Action；不自动设置 `Task.status=done`、停止 Session、关闭 Workspace 或写回外部 Issue。
- 固定 definition 的 Stage/Action ID 在本 feature 生命周期内必须稳定；若未来代码升级破坏 active state，pre-0.1 环境直接重建开发数据，不引入兼容 alias 或迁移 shim。
- 固定 Skill key 无法解析、没有可交付 Revision 或跨 Team 时，current/transition 必须报告稳定 Skill resolution 错误，不按名称、旧缓存或其他 Team 内容回退。
- 同一次 reconcile 为每个 Skill key 建立一个精确 Revision snapshot；若其他来源要求同一 Skill 的不同 Revision，必须返回版本冲突，不得按来源顺序任意选择。
- CLI 网络超时后的同命令重试必须复用内部 command identity，避免重复 transition；同 identity 不同 payload 返回冲突。
- 没有 active Workflow 的 Session 不得仅因为二进制包含 `workflow` 子命令而获得状态能力；命令返回 `workflow_not_enabled`。

## Requirements

### Functional Requirements

- **FR-001**: System MUST 只提供一个平台内置、program-owned Workflow，稳定 ID 为 `mystra.workflow`；第一阶段 MUST NOT 创建 Team-scoped Workflow/Harness Resource、Catalog、Revision、市场或可编辑定义。
- **FR-002**: 固定 Workflow definition MUST 随 Mystra 代码或受控静态资产发布，包含固定 global prompt、global Skills、Stages、Stage prompts、Stage Skills 与 Actions；普通 Control Plane caller MUST NOT 修改它。
- **FR-003**: 固定状态图 MUST 包含 `understand`、`implement`、`verify` 和 terminal `completed`，并只允许 `understanding-complete`、`implementation-complete`、`verification-failed` 与 `verification-passed` 对应的明确迁移。
- **FR-004**: System MUST 使用专用、Team/Task-scoped `TaskWorkflowState` 保存 `stageId`、stateVersion、active lifecycle 与审计时间；MUST NOT 使用通用 `TaskHarnessAttachment`、handler-owned arbitrary JSON 或 Task 复制字段。
- **FR-005**: 每个 Task 最多 MUST 有一个 active `TaskWorkflowState`；`Task` schema 与公共表示 MUST NOT 增加 `workflowId`、`workflowState`、`harnessIds` 或等价字段。
- **FR-006**: enable/disable MUST 由 canonical management API 的共享 service contract 拥有；`mystra` CLI 与 remote MCP MAY 作为薄适配器，Web UI 与 Workflow editor MUST NOT 属于本期。
- **FR-007**: 只有 Team Owner/Admin 或等价 Task 管理权限 caller MAY enable/disable Workflow；Agent workload、普通 Member 与自动策略 MUST NOT 执行管理操作。
- **FR-008**: enable MUST 以 `understand` 创建 active state；相同 command identity/payload 重放 MUST 返回同一结果，active state 上重复 enable MUST NOT 重置 Stage。
- **FR-009**: disable MUST 立即标记 state inactive、记录审计事实并撤销相关 workload capability；Prompt 与 Skill cleanup 外部副作用 MUST 在提交后幂等执行和可重试。
- **FR-010**: 第一阶段 MUST NOT 提供 Workflow Resource CRUD、选择/replace、Issue/Task 自动分类、RoutingPolicy、standing order、trigger 或 Agent `workflow switch`。
- **FR-011**: Workflow Stage MUST 与 `Task.status`、`Session.state`、`TaskExecutionContext`、Workspace preparation 与 Runtime state 分离；任何一方的变化 MUST NOT 自动写入其他状态机。
- **FR-012**: Session launch MUST 只在 Workflow active 时把 execution capability 绑定到精确 `TaskWorkflowState`；disable 后旧 capability MUST 失效，且旧 Session MUST NOT 按 Task identity 解析后来重新 enable 的 state。
- **FR-013**: `mystra-agent` MUST 静态提供 `workflow current`、`workflow transition <action-id>` 与 help；命令 MUST 通过 execution code capability 解析 state，不得要求或接受 taskId、workflowId、stateId 或 harnessId。
- **FR-014**: `workflow current` MUST 返回 machine-readable Workflow 摘要、当前 Stage ID/name/instructions、精确 required Skill ID/Revision/path、available Action ID/label/next Stage 与 projection health。
- **FR-015**: `workflow transition` MUST 只接受当前 Stage 固定 allowlist 中的 Action；成功响应 MUST 返回 previous/current Stage、完整新阶段上下文、available Actions 与 Skill source changes。
- **FR-016**: transition MUST 在短 RDB 事务内用 stateVersion conditional update 原子写 state/stateVersion 并追加不可变 transition audit；事务 MUST NOT 跨越 Workspace、Runtime 或 Skill materialization I/O。
- **FR-017**: transition MUST 使用内部 command identity；同 identity/payload 重放返回同一结果，同 identity/different payload 返回稳定冲突。
- **FR-018**: 并发 transition 失败 MUST 返回 `workflow_state_conflict` 与最新可安全披露阶段；服务端 MUST NOT 自动把失败请求解释为新 Stage 上的 Action。
- **FR-019**: CLI/API 错误 MUST 至少区分 `workflow_not_enabled`、`workflow_action_not_allowed`、`workflow_state_conflict`、`workflow_skill_resolution_failed`、`workflow_skill_projection_failed`、`scope_mismatch` 与 `capability_expired`，并定义稳定 exit/retry classification。
- **FR-020**: Session prompt composition MUST 保持 Standard Execution Prompt 为最高优先级，再加入 program-owned Workflow base prompt 与既有 optional Agent Context；后者不得覆盖平台安全、身份、secret 或 capability 约束。
- **FR-021**: Workflow prompt contribution MUST 只包含固定命令指引与固定全局说明；MUST NOT 包含当前 Stage、Action、Skill、state identity、stateVersion 或 projection 内部事实。
- **FR-022**: 新 Session MUST 冻结 effective prompt evidence；disable、transition 或未来重新 enable MUST NOT 改写既有 Session evidence。
- **FR-023**: effective Skill sources MUST 合并固定 Workflow global source、当前 Stage source 与其他批准来源；source identity MUST 区分 Workflow global/stage 和非 Workflow 来源。
- **FR-024**: 每次 Skill resolve MUST 为固定 Skill key 建立同 Team 精确 Revision snapshot 并返回 Workspace path；不同来源要求不同精确 Revision 时 MUST 返回冲突，不得任意选择、按名称回退或跨 Team 解析。
- **FR-025**: Session launch、current、成功 transition 与显式恢复 MUST 可触发幂等 Skill reconcile；物理 materialization MAY 懒执行，但 state commit 后的 desired sources MUST 立即成为权威逻辑状态。
- **FR-026**: transition state commit 成功而 Skill projection 失败时 MUST NOT 回滚或再次推进 Stage；响应 MUST 返回 `workflow_skill_projection_failed`、权威新 Stage、desired Skill set 与 retryable classification。
- **FR-027**: 移除 Workflow Skill source MUST NOT 移除仍由其他 source 引用的 Skill；只有来源集合为空时才允许取消 Workspace projection。
- **FR-028**: terminal `completed` MUST 只表示固定 Workflow 没有可用 Action；MUST NOT 自动改变 Task/Session/Issue/Workspace 状态。
- **FR-029**: Prompt、Stage/Action label 与错误详情 MUST 应用有界长度、schema allowlist 与敏感信息清理；execution code、Skill 内容和凭据不得进入 Prompt、审计 note 或普通日志。
- **FR-030**: 实现 MUST 把固定 Workflow 的 definition、Prompt contribution、command handling、state transition 与 Skill contribution 置于一个内部模块 boundary；该 boundary MUST 可在未来规格中被替换或提升为 Harness plugin interface，但本期 MUST NOT 暴露公共 registry、plugin SDK、动态命令注册、远程代码加载或通用 persistence contract。

### Key Entities

- **FixedWorkflowDefinition**: program-owned 静态定义，描述唯一 `mystra.workflow` 的全局 Prompt/Skills、Stages 和 Actions；不是 Team 资源，也没有 CRUD、Revision 或对象存储 identity。
- **TaskWorkflowState**: Team/Task-scoped 专用运行状态，保存当前 Stage、stateVersion 与 active lifecycle；它不是通用 Harness attachment，也不属于 Session。
- **TaskWorkflowTransition**: append-only 状态迁移事实，记录 state、from/to Stage、Action、stateVersion、actor Session/execution identity、command identity 与时间；不成为顶级产品对象或日志 API。
- **WorkflowSkillSource**: 固定 Workflow global 或当前 Stage 对精确 Skill Revision 的逻辑需求；物理 Skill 仅在全部来源消失后移除。
- **Internal Workflow Extension Boundary**: 代码内部把 definition、Prompt、commands、state 与 Skills 聚合在一起的模块 seam；首期只有一个实现，不是产品实体或公共插件合同。

## Assumptions & Dependencies

- Feature 056 Skill Library 在 057 运行时切片前提供 Team-scoped Skill、current ready Revision、安全内容读取与内容交付基础；057 首次定义固定 Workflow 到 Workspace 的 Skill source/reconcile 语义。
- 现有 `MYSTRA_EXECUTION_CODE` 已绑定 Team、Task、TaskExecutionContext 与 Session；057 只扩展 capability allowlist 并绑定精确 `TaskWorkflowState`，不创建长期 Agent identity。
- 现有 Session launch 会冻结 effective prompt evidence；057 只在该 composition seam 添加固定 Workflow base prompt，不改变 Runtime/Provider 选择、Task runtime lock 或 Workspace cardinality。
- 项目处于 pre-0.1；未来若通用 Harness plugin spec 替换本期专用状态或接口，可直接更新 schema、callers、fixtures 和文档，不为本期内部形态保留兼容层。
- 固定 Skill keys 的具体集合与部署方式在 Plan 阶段依据 Feature 056 的已实现合同确定；不得因此扩大为可编辑 Workflow Resource。

## Deferred / Out of Scope

- 通用 `HarnessResource`、`TaskHarnessAttachment`、handler registry、plugin SDK、动态 CLI module、远程代码加载与通用 handler state JSON。
- Workflow Resource CRUD、Catalog、对象存储配置、业务 Revision、ETag、历史快照、编辑器、Skill Picker UI 或 marketplace。
- 多个 Workflow、选择/replace、自动路由、Issue 分类、standing orders、arbitrary triggers 与 Agent 主动 switch。
- DAG 节点执行、数据流、自动工具调用、并行分支、guard 表达式、脚本、自动 retry scheduler、子流程或 Production Recipe executor。
- 根据 terminal Stage 自动改变 Task.status、Session.state、Issue 状态、PR/Artifact delivery 或质量验证。
- 多 Runtime Workspace 同步、Task Runtime migration/failover、Skill marketplace、跨 Runtime 共享 cache、Skill 依赖解析或供应链签名。
- 顶级 Workflow 导航、跨 Task activity feed、日志 API 或任意 state inspector UI。

## Success Criteria

### Measurable Outcomes

- **SC-001**: schema、API、CLI、MCP 与持久化中可管理的 Workflow/Harness Resource、Catalog、Revision、plugin registry 和通用 attachment 类型数量均为 0。
- **SC-002**: Task 新增 Workflow/Harness 复制字段数量为 0；每个 Task 最多有一个 active 专用 `TaskWorkflowState`。
- **SC-003**: 同一 Task 的 20 个并发 enable 请求最多产生一个 active state；同一 command identity/payload 的 20 次重放只产生一个 lifecycle 结果且不重置 Stage。
- **SC-004**: 固定状态图的全部合法与非法 Action fixture 100% 返回确定结果；terminal Stage 不产生任何 Task/Session/Issue/Workspace 自动写入。
- **SC-005**: 同一 stateVersion 的 20 个并发 transition 最多一个成功，其余均返回最新 Stage 的 `workflow_state_conflict`，且 transition audit 数量为 1。
- **SC-006**: current 与 transition 的 100% 成功响应都包含完整当前 Stage、精确 required Skill Revision/path 与 available Actions；调用所需任意 Task/Workflow/state ID 参数数量为 0。
- **SC-007**: 100% 新 Session prompt fixture 保留既有 Standard/Runtime/Provider/Execution Context 组件及 optional Agent Context，并且 Workflow 新增内容只包含固定 base prompt；动态 Stage/Action/Skill/state 泄漏数量为 0。
- **SC-008**: Task.status、Session.state、TaskExecutionContext 与 Workflow Stage 的独立性测试 100% 通过；任何单方变化自动写入其他状态机的次数为 0。
- **SC-009**: Skill source fixture 中，同一 Skill 来自至少三个来源时逐一移除，前两个移除不取消 projection，最后一个移除后才取消；100 次重放结果一致。
- **SC-010**: transition 后 Skill projection failure injection 的所有样例都保留唯一新 Stage 和唯一 transition audit；provider 恢复后 current/reconcile 100% 收敛到同一 desired set。
- **SC-011**: disable 后绑定旧 state 的所有 Workflow command 100% fail closed；后来重新 enable 不会让旧 Session capability 操作新 state。
- **SC-012**: 内部模块边界测试可用一个测试替身替换固定 Workflow 的 Prompt/command/Skill contribution 而无需修改 Session builder、CLI transport 或 Workspace reconcile caller；生产可注册实现数量仍为 1，公共插件 API 数量为 0。
