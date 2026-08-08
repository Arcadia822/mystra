# Research: Agent 定义与管理面

## R1. Agent 的最小可执行定义

**Decision**: `Agent = Team identity + lifecycle metadata + systemPrompt`。唯一效果字段为 `systemPrompt`。

**Rationale**: Runtime 回答执行位置，Provider 回答 CLI/协议族，Context 回答执行材料。把其中任何一项复制进 Agent 都会破坏 Session 四要素正交性。

**Rejected**:
- Project-scoped Agent：与用户确认的 Team 直属模型冲突。
- Agent profile 包含 Provider/model/skills/tools：重新制造混合配置袋。
- prompt 只在 Session 请求内传递：失去稳定身份、复用与 revision 审查。

## R2. Prompt 长度与存储语义

**Decision**: 上限 32,768 个 JavaScript 字符；`trim()` 后必须非空；持久化保留原始文本，不自动裁剪边缘空白。

**Rationale**: 32 Ki 字符足以表达复杂角色，又对 API payload、数据库记录和 Provider 输入留下明确上界。仅用 trim 判断可避免纯空白配置，同时不擅自修改调用方的多行 prompt。

**Rejected**:
- 无上限：会把 Provider token 限制和数据库负载变成隐式故障。
- 按某个 Provider token 数限制：Agent 与 Provider 无关，tokenizer 也不稳定。
- 存储前 trim：会改变 system-level 指令原文。

## R3. Revision 与并发

**Decision**: Agent 初始 revision 为 1；system prompt 发生逐字变化时 `+1`；仅改名不变。更新与归档必须提供 `expectedRevision`，数据库条件更新保证至多一个并发写成功。

**Rationale**: revision 表达执行语义版本，不是通用行版本。显式 expected revision 让冲突可观察，并防止 prompt 静默覆盖。

**Rejected**:
- `updatedAt` 并发控制：时间精度和序列化行为不够稳定。
- last-write-wins：违反可复核执行要求。
- 每次改名也增 revision：会把非效果元数据冒充执行语义变化。

## R4. 历史语义

**Decision**: 046 提供 `resolveActiveAgent`，返回 `{agentId, revision, systemPrompt}` 值对象。Agent 表只保存当前配置；Session 后续负责持久化 resolved snapshot。

**Rationale**: 这证明 Agent 可以原子解析，又不伪造尚未定义的 Session persistence。返回值不含名称、Team 或 Provider，因为执行语义只需要稳定引用、revision 与 prompt。

**Rejected**:
- Agent revision history 表：超出 MVP；Session snapshot 已承担执行证据。
- 执行时重新读取 Agent：历史语义会漂移。
- 在 046 创建空 Session 表：违反明确范围。

## R5. 生命周期

**Decision**: active/archived 软生命周期；归档记录可按 ID 读取、可在列表显式包含，但不能更新或用于新解析；MVP 无硬删除。

**Rationale**: 保留历史审查引用且避免孤立 snapshot 的管理语义。归档比硬删除更符合现有 Project 管理模式。

## R6. 名称与分页

**Decision**: 名称不是身份，不强制 Team 内唯一；所有引用使用 UUID。列表以 ID 升序稳定分页，默认 50、最大 100，cursor 为服务器返回的 opaque ID。

**Rationale**: 名称唯一会把显示文案变成间接 scope 规则。稳定分页避免未来 API 形状迁移，且实现成本很低。

## R7. 权限

**Decision**: 读取/选择使用 `team.resource.access`；创建、更新、归档使用 `team.settings.manage`。Team ID 永远从 active human session 派生，公共请求不接受 `teamId`。

**Rationale**: 复用 043 已交付的权限，不增加 Agent 专用 RBAC 字符串。MCP 与 CLI 遵循同一授权边界。

## R8. Provider 术语替换

**Decision**: 直接将 `agentNameSchema` / `AgentName` 以及公共请求中承载 `codex|copilot` 的 `agent` 字段替换为 `providerNameSchema` / `ProviderName` / `provider`。Adapter 层符号同步使用 Provider 命名，不添加 aliases。

**Rationale**: `codex` 与 `copilot` 是 Runtime 暴露的 Provider 能力；继续叫 Agent 会令新 Agent ID 无法在同一请求中无歧义出现。项目版本低于 0.1，constitution 明确禁止兼容垫片。

**Scope note**: 仅清理公共 schema、issue/session 请求契约、adapter 符号、CLI flags 和无调用方的 Project 默认 Agent 残留；不实现 Session 存储或调度。

## R9. Existing code reuse and GitNexus findings

- `authorizeTeamResource` / `requireTeamPermission` 已提供 active Team 与 RBAC。
- Task/Project Route Handlers 展示了 canonical API 的错误映射和测试模式。
- `PrismaRdbProvider` 与双 Prisma schema 已是唯一 RDB 实现路径。
- MCP 是单一 JSON-RPC Route Handler；新增 tools 应调用同一 RdbProvider，不另建服务。
- operator CLI 已有认证会话、JSON/human 输出、limit/cursor flags 与退出码映射。
- GitNexus 索引已刷新至 6,667 nodes / 11,427 edges / 300 flows；实现前仍需对每个被修改的现有 symbol 执行 upstream impact。
