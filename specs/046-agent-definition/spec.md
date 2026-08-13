# 功能规格：Agent 定义与 Session 选择边界

**Feature Branch**: `046-agent-definition`
**Created**: 2026-08-08
**Status**: Complete
**Input**: 用户要求“启动新 spec：定义 Agent；效果相关只配置 sys prompt 就行；Agent 是发起 Session 的四要素之一：Runtime、Provider、Agent、Context”。
**Scenario Rationale**: 本功能首先定义平台内部业务对象与跨边界契约，使用具名操作者/调用方的技术场景比虚构消费型用户故事更准确。用户已明确确认两个核心产品决定：Session 发起使用四个正交要素；Agent 唯一影响执行效果的可配置内容是 system prompt。
**Clarification Review**: 2026-08-08 用户明确确认 Team 是租户边界；Agent、Task、Project、Session 都是 Team 直属对象。Agent、Task、Session 均不属于 Project，Session 也不属于 Task；Project 与 Task 只是 Session 上彼此独立的 `0..1` 可选引用。该澄清已写入全部场景、要求和成功标准；其余 system prompt 长度、错误码、持久化形态与符号 blast radius 属于 plan/research 决策。

> **052 supersession (2026-08-12)**: Agent 不再是每次 Session 的必选项。
> Runtime、Provider、execution Context 仍为显式输入；`Agent Context` 是可选、
> 低优先级的补充输入。每次 Session 无论是否选择 Agent，都必须使用 feature
> 052 的 program-owned Standard Execution Prompt。下文所有“Agent 必选”表述均由
> `052-standard-agent-context` 直接替换；Team ownership 与 Agent 定义本身继续有效。

## Contract Summary

发起一次 Session 时，平台必须解析四个彼此独立的执行选择。Project 与 Task 不属于这四个执行选择；它们分别只是 Session 的 `0..1` 可选业务引用，且都不是 Session 父级。

| 要素 | 回答的问题 | 本功能中的边界 |
| --- | --- | --- |
| **Runtime** | 在哪里执行 | 提供执行后端与可用 Provider；由 `044-host-runtime-daemon` 及后续 Runtime 规格拥有 |
| **Provider** | 用哪个 agent CLI / 协议族执行 | 如 `copilot`、`codex`；必须由所选 Runtime 提供，不属于 Agent 配置 |
| **Agent** | 以怎样的稳定行为角色执行 | Team-scoped 配置；不属于 Project，唯一影响执行效果的可配置字段是 `systemPrompt` |
| **Context** | 带着哪些工作目录、仓库材料和上下文执行 | 独立选择；skills、文件、知识与 workspace 交付不进入 Agent |

本规格把历史文档中的 `Agent(provider + prompt + skills)` 方向收窄为：

```text
Agent = Team identity + lifecycle metadata + systemPrompt
```

其中只有 `systemPrompt` 是效果配置。Provider、模型/CLI、skills、工具、Context、Runtime、资源规格、凭据与 workflow 行为都不是 Agent 字段。

## Clarifications

### Session 2026-08-08

- Q: Agent 是否归属于 Project？ → A: 不属于；Agent 直属 Team，Team 是租户边界。
- Q: Session 是否归属于 Task 或 Project？ → A: 都不属于；Session 直属 Team，`taskId?` 与 `projectId?` 是彼此独立的 `0..1` 可选引用。
- Q: Task 是否归属于 Project？ → A: 不属于；Task 直属 Team。

## User Scenarios & Testing *(mandatory)*

### Technical Scenario 1 - 创建 Team-scoped Agent 行为配置 (Priority: P1)

作为 Team 的 Agent 管理者，我希望创建有稳定身份和名称、但不归属于任何 Project 的 Agent，并只通过 system prompt 定义其执行行为，以便同一 Team 内的 Session 都可以引用同一个行为角色，而不会把 Project、Task 或其他三个启动要素固化进 Agent。

**Why this priority**: 如果 Agent 继续只是 `codex`/`copilot` 的别名，Session 四要素实际上只剩三个；如果 Agent 同时携带 tools、skills 或模型参数，边界又会悄悄长回一个混合配置袋。那当然也能运行，只是无法解释。

**Independent Test**: 在一个 Team 内创建 Agent 并读取其完整配置；可观察字段包含稳定身份、Team ID、名称、system prompt、修订和生命周期元数据，不包含 Project ID、Provider、Runtime、Context、skills、tools、模型参数或凭据。

**Acceptance Scenarios**:

1. **Given** 调用方具备 Team `T1` 的 Agent 管理权限，**When** 以名称和非空 system prompt 创建 Agent，**Then** 平台返回属于 `T1` 的稳定 Agent 身份，不要求或接受 Project 归属字段。
2. **Given** Team `T1` 已存在 Agent，**When** 调用方读取或列出 Agents，**Then** 管理面按 Team 隔离并完整返回其 system prompt 与非效果元数据，不按 Project 过滤，也不返回任何隐式 Provider、Runtime 或 Context 默认值。
3. **Given** 同一 Team 的 Session 分别带有 Project、Task、二者同时存在或二者都为空，**When** 它们选择同一个 active Agent，**Then** Agent 本身不被复制、不被重新归属，也不被修改。

---

### Technical Scenario 2 - 以四个正交要素发起 Session (Priority: P1)

作为人类操作者或调用 Agent，我希望发起 Session 前明确解析 Runtime、Provider、Agent、Context 四个要素，以便“在哪里执行”“由哪个执行器执行”“采用什么行为角色”“携带什么上下文”不会由同一个字段含混承担。

**Why this priority**: 这是 Agent 定义能够成立的使用边界，也是 044 已记录但尚未交付的后续契约。

**Independent Test**: 组装两组 Session 发起选择：同一个 Agent 搭配两个不同且可用的 Provider，以及同一个 Provider 搭配两个不同 Agent；平台分别保留四个独立引用，并把正确的 resolved system prompt 交给执行边界。

**Acceptance Scenarios**:

1. **Given** Runtime `R1` 提供 Provider `codex`，且 Agent `A1` 与 Context `C1` 可用，**When** 调用方以 `R1 + codex + A1 + C1` 发起 Session，**Then** 四个选择分别解析，Agent 只贡献 `A1` 当前修订的 system prompt。
2. **Given** Runtime `R1` 不提供 Provider `copilot`，**When** 调用方选择 `R1 + copilot + A1 + C1`，**Then** Session 在执行开始前失败，系统不得通过 Agent 猜测或替换 Provider。
3. **Given** Team `T1` 中存在 Project `P1` 与 Task `K1`，**When** 调用方创建四个 Session，分别携带 `projectId=P1`、`taskId=K1`、二者同时存在、二者都为空，**Then** 四个 Session 均可独立创建，且 Project/Task 不改变四要素解析。
4. **Given** Team `T1` 的 Session 选择 Team `T2` 的 Agent、Project 或 Task，**When** 发起请求到达解析门槛，**Then** 系统因租户不一致失败，且不把任何对象重新归属。
5. **Given** 四个执行要素中任一项未能解析，**When** 发起请求到达执行门槛，**Then** 系统明确指出缺失或不兼容要素，不使用静默 fallback。

---

### Technical Scenario 3 - 更新 Agent 而不改写历史执行语义 (Priority: P2)

作为 Agent 管理者和 Reviewer，我希望修改 Agent 的 system prompt 只影响之后发起的 Session，而已创建 Session 仍保留其发起时解析的 Agent 修订与 prompt 快照，以便执行证据可复核。

**Why this priority**: 可变 Agent 若没有解析快照，会让同一个 Session 在不同时间看起来使用了不同指令。那会使“复现”成为一种文学体裁。

**Independent Test**: 用 Agent revision 1 创建 Session 选择，随后更新 Agent 为 revision 2；读取旧选择仍得到 revision 1 与原 prompt，新选择得到 revision 2 与新 prompt。

**Acceptance Scenarios**:

1. **Given** Agent 已被一个 Session 解析，**When** 操作者更新其 system prompt，**Then** Agent 修订递增，既有 Session 的 resolved Agent snapshot 不变。
2. **Given** Agent 被归档，**When** 读取历史 Session，**Then** 仍可审查其 resolved Agent snapshot；新 Session 不得再选择该 Agent。
3. **Given** 两次并发更新基于同一旧修订，**When** 服务端应用更新，**Then** 至多一次成功，另一次返回明确冲突而不静默覆盖。

### Edge Cases

- system prompt 为空、只包含空白或超过平台显式上限时，创建/更新失败；确切上限在 plan 中根据 Provider 输入限制统一确定。
- Agent 名称是显示信息而不是身份；所有选择与引用 MUST 使用稳定 Agent ID 消除歧义。名称唯一性或冲突规则由 plan 决定，但不得借此引入 Project Scope。
- Agent 不存在、已归档、不属于 Session 的 Team，或调用方无权读取时，不得解析为 Session 输入；Project 不得成为 Agent 查找或选择条件。
- Session 的 `projectId` 与 `taskId` 都为空是有效状态；仅存在任一项或二者同时存在也有效。二者不得相互推导，Task 不得隐式带出 Project。
- Agent 在 Session 发起与执行之间被更新或归档时，已完成的原子解析结果保持有效；不得在执行时重新读取“最新 prompt”。
- Runtime 在线但所选 Provider 不可用时，四要素不兼容，不能切换到 Agent 名称暗示的 Provider。
- Context 中存在 skills 或额外指令文件时，它们仍是 Context 内容，不得反写或持久化为 Agent 的隐藏配置。
- system prompt 是授权成员可读取的普通配置，不是 SecretProvider；其中不得用来存放凭据或秘密材料。

## Requirements *(mandatory)*

### Functional Requirements — Agent 定义

- **FR-001**: Agent MUST 是独立于 Runtime、Provider 与 Context、直属一个且仅一个 Team、且不归属于任何 Project 的业务配置。
- **FR-002**: Agent MUST 拥有稳定 ID、不可变 Team ID、显示名称、`systemPrompt`、单调递增 revision、active/archived 生命周期以及创建/更新时间；MUST NOT 拥有 Project ID 或 Project scope discriminator。
- **FR-003**: Agent 的效果相关可配置字段 MUST 只有 `systemPrompt`。名称、身份、归属、revision、状态与时间属于管理元数据，不得改变执行行为。
- **FR-004**: Agent MUST NOT 保存或隐式选择 Provider、Runtime、Context、skills、tools、模型、模型参数、资源规格、branch、Task、Session、凭据或授权状态。
- **FR-005**: `systemPrompt` MUST 是非空、去除首尾空白后仍有内容且长度受显式上限约束的文本；平台 MUST 在持久化前统一校验。
- **FR-006**: 授权调用方 MUST 能在 Team 边界内创建、读取、列出、重命名、更新 system prompt 与归档 Agent；这些操作 MUST NOT 要求 Project 参数，MVP 不要求硬删除。
- **FR-007**: 每次 system prompt 变化 MUST 产生新的单调递增 revision；仅重命名不得改变 revision 或执行效果。
- **FR-008**: 并发更新 MUST 使用可观察的 revision 冲突保护，禁止 last-write-wins 静默覆盖 system prompt。
- **FR-009**: 归档 Agent MUST 保持可读以支持历史审查，但 MUST NOT 用于新的 Session 发起。

### Functional Requirements — Session 四要素边界

以下条款是 046 对后续 Session 规格施加的前向契约，不表示 046 实现 Session 持久化、创建或执行。046 的实现责任限于：提供无 Project/Task 参数的 active Agent resolver、不可变 Resolved Agent Snapshot，以及可组合但不落库的四要素/可选业务引用共享 schema。

- **FR-010**: Session 进入执行前 MUST 解析且固定四个独立要素：Runtime、Provider、Agent、Context。
- **FR-011**: Provider MUST 作为独立字段表达 agent CLI / 协议族；任何公共或 Session 发起契约中的 `agent: "codex"` / `agent: "copilot"` 旧语义均视为过时，当前模型 MUST 分别使用 Provider 选择和 Agent 引用，不保留 pre-0.1 兼容别名。
- **FR-012**: 所选 Runtime MUST 明确声明所选 Provider 可用；不兼容时 MUST 在执行开始前失败，不得从 Agent 名称或 prompt 推断 Provider，也不得 fallback 到其他 Provider。
- **FR-013**: 所选 Agent MUST 存在、处于 active 状态且与 Session 属于同一 Team；Agent 选择 MUST 与 Session 的可选 Project/Task 引用无关。
- **FR-014**: Session 发起时 MUST 原子解析 Agent 当前 revision 与 system prompt，形成不可变的 Resolved Agent Snapshot；后续 Agent 更新或归档不得改变该快照。
- **FR-015**: Agent system prompt MUST 作为 system-level 行为指令交付；Session objective、Task/Issue 内容和 Context 材料 MUST 保持各自来源，不得拼装回 Agent 配置。
- **FR-016**: 默认选择策略 MAY 在后续 Session 规格中定义，但任何默认值在执行前 MUST 解析为四个显式结果；本功能 MUST NOT 通过 Project/Task 绑定或静默 fallback 推断 Agent。
- **FR-017**: Session MUST 直属一个且仅一个 Team，MUST NOT 归属于 Task 或 Project。Session MAY 各自保存最多一个 `taskId` 与最多一个 `projectId`；两者 MUST 可独立为空、独立存在或同时存在，且都 MUST 引用同一 Team 内的对象。
- **FR-018**: Task MUST 直属一个且仅一个 Team，MUST NOT 归属于 Project。Session 的 `taskId` MUST NOT 推导、要求或覆盖 `projectId`，反之亦然。
- **FR-019**: 四要素中任一项不存在、不可访问、已归档或彼此不兼容时，平台 MUST 返回稳定、可区分的失败结果，且不得创建可执行的部分 Session。

### Functional Requirements — 管理与安全边界

- **FR-020**: Agent 管理 MUST 首先具备 canonical programmable surface；MCP、CLI 与未来 Web 只能作为同一授权与验证规则的客户端，不得各自解释 Agent 字段。
- **FR-021**: Agent 的 canonical 管理与读取入口 MUST 按 Team 隔离但不嵌套于 Project；Agent 列表、读取和 Session 选择 MUST NOT 按 Project membership 过滤。
- **FR-022**: system prompt MUST 被视为同一 Team 内授权调用方可见的普通配置，不得承担 SecretProvider 职责；Agent 响应、审计或错误信息不得附带执行凭据。
- **FR-023**: Agent 配置 MUST NOT 引入 workflow graph、standing order、子 Agent 层级、自动任务分解、自动重试或平台拥有的编排行为。
- **FR-024**: 本功能 MUST 使用明确的 Agent / Provider 术语，使 Provider adapter 与 Agent 业务配置在共享契约、管理面和后续 Session 规格中不可混淆；具体符号重命名和 blast radius 由 plan + GitNexus 分析确定。

### Key Entities

- **Agent**: Team-scoped 行为配置。包含稳定身份、不可变 Team 归属、显示名称、唯一效果配置 `systemPrompt`、revision、active/archived 生命周期与管理时间；不包含 Project 关系。
- **Task**: Team 直属业务意图；不属于 Project。它可被 Session 以 `0..1` 方式引用，但不拥有 Session。
- **Session**: Team 直属执行对象；不属于 Task 或 Project。它可分别引用 `0..1` 个 Task 与 `0..1` 个 Project，并固定四个执行要素。
- **Resolved Agent Snapshot**: Session 发起时从 Agent 原子解析出的不可变执行输入，至少包含 Agent ID、revision 与 resolved system prompt。它是 Session 输入投影，不是独立管理对象。
- **Session Launch Selection**: 四个独立引用 `runtime + provider + agent + context` 的解析结果；本规格只拥有其中 Agent 的定义与交付边界。

## Assumptions & Dependencies

- Team 是 Owner 已明确的租户边界；Agent、Task、Project、Session 都直属 Team。它们之间的引用不得改变这一归属。
- system prompt 可更新；新 Session 使用新 revision，既有 Session 保留 resolved snapshot。这是可复核执行的默认要求，而不是完整 Agent 版本管理产品。
- Agent 配置可以在 Session 持久化重新设计前独立交付和管理；真正创建/执行 Session 仍依赖后续 Session 与 Context 规格。
- `044-host-runtime-daemon` 已定义 Runtime 与 Provider 能力；本功能不修改其注册、发现、可用性或心跳语义。
- `043-identity-team-rbac` 拥有 Team 租户与授权边界；046 只定义 Agent 的 Team 归属以及 Session 解析时的同 Team 约束。
- 本功能不是 UI-facing spec；首期以 API/MCP/CLI 可管理和可验证为准，不要求 Agent 管理页或视觉原型。

## Out of Scope

- Context、workspace、worktree、skills、知识文件或 prompt assembly 的完整设计。
- Session 持久化、生命周期、调度、claim、Runner 分配、取消、结果或 Review evidence。
- Runtime/Provider 注册、Provider 安装/登录、Provider 版本探测或自动选择。
- 模型选择、temperature、reasoning effort、token budget、tools、MCP server、hooks、skills 或其他效果调参。
- Agent marketplace、模板库、继承、组合、多 Agent/子 Agent 层级、自动编排或 standing orders。
- Agent 密钥、workload identity、Agent 级权限主体或以 system prompt 存放秘密。
- Web 管理 UI、Agent 测评、A/B test、效果评分、prompt 自动优化或历史 diff 页面。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 评审者检查任一 Agent 创建/读取结果时，100% 的效果相关可配置内容只有一个 system prompt；Provider、Runtime、Context、skills、tools 与模型参数均不出现在 Agent 配置中。
- **SC-002**: 对同一 Agent 搭配两个不同 Provider、以及同一 Provider 搭配两个不同 Agent 的契约测试均能保留四个独立选择，不发生字段复用或隐式推断。
- **SC-003**: 046 的共享契约测试可表达 Project/Task 两个独立 `0..1` 引用的四种组合，并且四种组合都使用同一个 `agentId` 而不修改 Agent；Agent resolver 对同 Team active Agent 返回 snapshot，对跨 Team、缺失或 archived Agent 返回可区分失败。Runtime/Provider 兼容性与完整 Session 原子创建由后续 Session 规格验证。
- **SC-004**: Agent system prompt 更新后，所有既有 Session 的 Resolved Agent Snapshot 保持逐字不变；之后发起的 Session 100% 使用新 revision。
- **SC-005**: 两个并发 system prompt 更新基于同一 revision 时，恰有一个成功，另一个返回可识别冲突；不存在静默丢失更新。
- **SC-006**: API、MCP、CLI 与共享文档中的抽样术语审计达到 100%：`Provider` 表示 CLI/协议族，`Agent` 表示 system-prompt 行为配置，不再用 `agent` 字段承载 `codex`/`copilot` Provider 键。
- **SC-007**: 独立 Agent 管理切片可在尚未实现 Session/Context 的环境中完成创建、读取、列出、更新与归档验证，不伪造 Session 执行能力。
