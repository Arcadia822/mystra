# 研究：标准执行提示词与可选 Agent 上下文

## Decision 1：标准提示词是程序合同，不是默认 Agent 数据

**Decision**: 在 Control Plane sessions module定义不可变 content，由 SHA-256内容寻址产生 version；shared package定义 evidence schema，Session launch解析并冻结实例。

**Rationale**: 默认职责属于平台版本，Team 不需要初始化数据；程序升级只影响新 Session，历史执行由事件证据解释。

**Alternatives considered**:

- 每 Team 创建 Default Agent：拒绝，会制造隐藏数据、迁移与归档语义。
- 环境变量 prompt：拒绝，无法稳定版本化，部署差异会破坏历史解释。
- 只保存最终文本：拒绝，无法区分标准版本与可选 Agent snapshot。
- 人工维护语义版本：拒绝，prompt文本和版本容易分离；内容寻址无需兼容表或部署配置。

## Decision 2：Agent 可选性直接进入领域与持久化合同

**Decision**: Harness 和 Session 的 `agentId/agentRevision` 均 nullable；Harness另存 nullable name/prompt snapshot，SessionEvent保存完整 prompt evidence。

**Rationale**: 无 Agent attempt 是合法业务状态。使用 sentinel ID 或仅在 API层 optional都会把不存在的实体重新伪造成必填关系。

**Alternatives considered**:

- 特殊 UUID：拒绝，仍是虚拟 Agent。
- Session 保持必填、Harness nullable：拒绝，Workspace ready 后仍无法启动。
- 删除 Agent 管理模型：拒绝，自定义 Agent 仍是有效的可选行为上下文。

## Decision 3：显式 Agent 在 Start 事务内冻结

**Decision**: RDB atomic Start command接收 nullable `agentId`，在事务内验证 Team/status并构造 snapshot。

**Rationale**: 现有 service预读后再写 Harness存在 update/archive竞态；052 的 edge case要求一致 revision或失败。

**Alternatives considered**:

- service预读并依赖 revision字段：拒绝，事务边界外仍可变化。
- launch Session时重新解析 Agent：拒绝，Workspace异步等待会改变 attempt语义。

## Decision 4：prompt evidence 是一次性有序结构

**Decision**: 初始事件保存 Standard Prompt version/content、nullable Agent snapshot、ordered components与 finalPrompt；继续消息只读取已有 finalPrompt。

**Rationale**: 049 已把初始 prompt event作为 claim source。扩展同一事实避免第二份可漂移配置。

**Alternatives considered**:

- Runner现场拼装：拒绝，会让 adapter拥有优先级并破坏历史一致性。
- 每次继续消息重新拼装：拒绝，程序或 Agent更新会改写同一 Session语义。
- 只把版本写 Session metadata：拒绝，无法审查组成和最终文本。

## Decision 5：Start adapters统一，旧 assign 直接替换

**Decision**: canonical contract命名为 Start；API使用 `/production/start`，operator CLI、MCP、Web调用同一 service/schema。

**Rationale**: 052 已明确 supersede “Assign Agent才能Start”。项目低于 0.1，不需要保留旧路径或 alias。

**Alternatives considered**:

- 保留 `/assign` alias：拒绝，违反 pre-0.1 one-version rule。
- 各 adapter自行将缺失 Agent替换为默认：拒绝，会产生入口级行为分叉。

## GitNexus 证据

- 刷新后的索引基于当前未提交 051 工作树：11,198 nodes、18,582 edges、300 flows。
- `TaskProductionService.assign` 是 production route 的 canonical service；`PrismaRdbProvider.assignTaskForProduction`拥有原子 Task/Harness写入。
- `SessionService.launchHarness`复用 `launch`；`assembleHarnessSystemPrompt`目前直接把 frozen Agent prompt放入 `agent` component。
- `RuntimeSessionService.claim`从 `session.system_prompt_configured`读取 `finalPrompt`；`executeSessionAssignment`和 `packages/agent-adapters`不需要知道 Agent snapshot。
- `AgentExecutionService.context`与 `executionIdentity`当前假定 Harness/Session Agent必填，是 workload projection替换点。
- `TaskProductionPanel`是 Web唯一 Start控制面，当前自动选择第一个 Agent并用 `!agentId`阻断。
