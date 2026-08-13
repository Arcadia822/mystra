# 功能规格：标准执行提示词与可选 Agent 上下文

**Feature Branch**: `052-standard-agent-context`
**Created**: 2026-08-12
**Status**: Draft
**Input**: 用户要求默认路径无需数据库中的 Agent 即可运行；程序提供标准 system prompt，自定义 Agent 只作为附加上下文，不替换标准提示词。
**Clarification Review**: 2026-08-12 用户明确否定“默认 Agent”概念。平台默认的是程序拥有的标准执行提示词；自定义 Agent 与该提示词是上下文叠加关系，不是替换关系。

## 合同摘要

Mystra 的默认执行行为来自程序版本化的 **Standard Execution Prompt**，而不是一个自动注入 Team 的 Agent 数据对象。任何 Task production attempt 都必须应用这份标准提示词，因此 Team 即使没有任何自定义 Agent，也能直接 Start。

自定义 Agent 继续是 Team-scoped、可修订的行为配置，但只贡献可选的 **Agent Context**。它可以补充角色、领域知识、编码偏好或协作约束，不得替换、关闭或降级标准执行职责。

```text
Effective System Prompt
  = Standard Execution Prompt (required, platform-owned)
  + Optional Agent Context (team-authored, frozen when selected)
  + Runtime / Provider constraints (resolved execution facts)
  + Task / Project / Workspace context (bounded business data)
```

这不是“系统 Agent + 自定义 Agent 二选一”。系统中不存在隐藏的默认 Agent、特殊 Agent ID 或为每个 Team 复制的默认 Agent 记录。自定义 Agent 缺席是正常状态，不是配置错误。

## 关键产品决定

| 决定 | 本期合同 |
| --- | --- |
| 默认行为从哪里来 | 程序拥有并版本化的 Standard Execution Prompt |
| Team 是否必须拥有 Agent | 否；零个自定义 Agent 的 Team 可完整执行 Task |
| 自定义 Agent 的作用 | 可选 Agent Context，只补充标准执行提示词 |
| Start 是否必须选择 Agent | 否；未选择时不创建虚拟引用或 sentinel ID |
| 选择 Agent 后是否替换标准提示词 | 否；标准提示词始终保留且优先级更高 |
| 谁标识 workload | Harness/Session attempt 的 execution code，而不是 Agent 的长期身份 code |
| 历史如何复核 | Session 冻结最终 prompt、标准提示词版本及可选 Agent snapshot |

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 无需配置 Agent 直接开始生产 (Priority: P1)

作为创建 Task 的操作者，我希望无需先创建或选择 Agent 就能开始生产，以便从 Issue 创建 Task 后可以直接进入代码修改、自测和提交 PR 的核心旅程。

**Why this priority**: Agent 配置不是工厂输入的必要条件。把一个空下拉框放在生产入口前，只会把内部抽象伪装成用户必须理解的准备工作。

**Independent Test**: 使用一个没有任何自定义 Agent 的 Team 创建 eligible Project-bound Task，执行 Start，验证 Task 进入 `in_progress`、Harness 与唯一 Session 被创建，Session 使用标准执行提示词且没有 Agent ID。

**Acceptance Scenarios**:

1. **Given** Team 没有自定义 Agent且 Task 满足 051 的 Start 前置条件，**When** 操作者 Start production，**Then** 系统使用当前 Standard Execution Prompt 创建 Harness/Session，且不得要求 Agent ID。
2. **Given** Team 没有自定义 Agent，**When** 操作者打开 Task production surface，**Then** Start 操作可用，界面不得显示必填但为空的 Agent selector。
3. **Given** 未选择 Agent 的 Start 命令被重放，**When** 服务处理同一 idempotency key，**Then** 返回同一 Harness/Session，不因缺少 Agent 生成第二次 attempt 或虚拟 Agent。

---

### User Story 2 - 用自定义 Agent 补充执行上下文 (Priority: P1)

作为需要特定角色或领域偏好的操作者，我希望可以选择一个自定义 Agent 作为附加上下文，以便 Agent 获得专门指令，同时仍遵守 Mystra 的标准完成任务、自测、交付和状态回报职责。

**Why this priority**: “柔性”来自可选上下文，而不是复制整套执行合同。否则每个自定义 Agent 都必须重新正确描述工厂职责，最终会以非常高效的方式制造不一致。

**Independent Test**: 对同一个 Task 分别不选择 Agent 和选择一个 active Team Agent 发起两个独立 attempt；验证两者都包含相同版本的标准提示词，后者额外包含所选 Agent revision 的 context，且标准职责未被替换。

**Acceptance Scenarios**:

1. **Given** Team 存在 active 自定义 Agent，**When** 操作者在 Start 时选择它，**Then** 最终 system prompt 同时包含标准执行提示词与该 Agent 的已冻结上下文。
2. **Given** 自定义 Agent context 与标准执行职责冲突，**When** 系统组装提示词，**Then** 标准执行提示词保持更高优先级，并把自定义内容明确标记为补充上下文。
3. **Given** 操作者明确选择的 Agent 不存在、已归档或属于其他 Team，**When** Start 执行，**Then** 命令明确失败且不静默退回无 Agent 模式。
4. **Given** Team 没有自定义 Agent，**When** 查看默认生产入口，**Then** 不展示 Agent 配置负担；当自定义 Agent 能被选择时，该控件明确标注为可选上下文。

---

### User Story 3 - 复核每次执行实际使用的提示词 (Priority: P2)

作为 Reviewer，我希望知道一次 Session 使用了哪个标准提示词版本以及是否叠加了哪个自定义 Agent revision，以便历史执行在程序升级或 Agent 修改后仍可解释。

**Why this priority**: 程序提示词与自定义上下文都会变化。若只保存“当前值”，历史执行语义就会在不通知任何人的情况下自行改写，确实非常神奇。

**Independent Test**: 启动 Session 后分别升级 Standard Execution Prompt 和更新自定义 Agent，再读取原 Session；验证最终 prompt、标准版本与可选 Agent snapshot 逐字不变，新 Session 使用新版本。

**Acceptance Scenarios**:

1. **Given** Session 已创建，**When** 程序中的标准提示词升级，**Then** 既有 Session 的标准版本与最终 prompt 不变，之后创建的 Session 使用新版本。
2. **Given** Session 选择了自定义 Agent revision 3，**When** Agent 更新到 revision 4，**Then** 既有 Session 仍引用 revision 3 的 context，新 Session 使用 revision 4。
3. **Given** Session 未选择自定义 Agent，**When** Reviewer 读取其 prompt evidence，**Then** 能明确区分“未选择 Agent”与“Agent 数据缺失”。

### Edge Cases

- Team 中没有任何 Agent 是有效的常态；不得触发默认数据注入、自动创建或修复流程。
- Agent selector 的空值表示“不附加 Agent Context”，不是名为 Default、Built-in 或 System 的 Agent。
- 调用方省略 `agentId` 与显式传入空值必须规范化为同一个无 Agent 选择；空字符串、未知 ID 和跨 Team ID 必须拒绝。
- 明确选择的 Agent 在 Start 校验与 Session 创建之间被更新或归档时，必须使用同一原子边界冻结一致 revision，或让命令失败；不得混合两个 revision。
- Standard Execution Prompt 不可用、无法识别版本或无法组装时，Start 必须失败关闭；不得用自定义 Agent prompt 单独执行。
- 自定义 Agent context 为空、超长或包含凭据时，继续遵守 046 的校验与非秘密边界。
- 自定义 Agent context 试图取消自测、PR 交付、Task 状态回报或覆盖 Runtime/Provider 安全约束时，标准合同仍保持优先；Mystra 不承诺模型绝对服从，但必须保证输入结构与优先级没有把补充内容当作替代内容。
- Runtime、Provider、Project、Task、Workspace 或 Issue context 无效时，仍按其所属规格失败；无 Agent 模式不构成任何 fallback 权限。

## Requirements *(mandatory)*

### Functional Requirements — Standard Execution Prompt

- **FR-001**: 平台 MUST 定义一个程序拥有、非 Team 数据、不可由产品用户编辑的 Standard Execution Prompt，并为每个可执行版本提供稳定版本标识。
- **FR-002**: 每个 051 Task-bound Harness 创建的 Session MUST 应用 Standard Execution Prompt；缺失或无法解析该提示词时 MUST fail closed。
- **FR-003**: Standard Execution Prompt MUST 定义默认生产职责：读取已交付的 Task/Project/Issue-reference/Workspace context，完成代码改动，执行适当自测，使用 workload 可用的本地工具提交可审查交付，并通过 `mystra-agent` 回报 Task 状态。
- **FR-004**: Standard Execution Prompt MUST 保留 051 的工具责任边界：Linear 内容由 workload 使用 host-local `linctl` 读取，PR 由 host-local `gh` 创建；Mystra MUST NOT 代理、提供凭据或验证这些结果。
- **FR-005**: Standard Execution Prompt MUST NOT 被建模为 Agent、Team 初始化数据、Project 默认值、环境变量 fallback、隐藏 Agent ID 或其他持久化 Agent 记录。
- **FR-006**: Standard Execution Prompt 的版本变化 MUST 只影响之后创建的 Session；既有 Session 的最终 prompt evidence MUST 保持不变。

### Functional Requirements — Optional Agent Context

- **FR-007**: 自定义 Agent MUST 继续是 Team-scoped、可修订、可归档的显式配置，但在 Session 发起中 MUST 是可选输入。
- **FR-008**: 未提供 Agent 选择时，Start MUST 使用标准执行提示词继续执行，并 MUST 将 Agent snapshot 表达为明确缺席，而不是合成默认 Agent。
- **FR-009**: 提供 Agent 选择时，系统 MUST 校验它 active、同 Team，并原子冻结其 ID、revision 与 systemPrompt 作为 Agent Context；无效的显式选择 MUST 失败，禁止静默忽略。
- **FR-010**: Agent Context MUST 作为标记清晰、低于 Standard Execution Prompt 优先级的补充行为上下文组装；MUST NOT 替换标准执行提示词、Runtime/Provider 约束或 Task/Workspace 事实。
- **FR-011**: Agent Context MAY 补充角色、领域知识、编码风格与协作偏好；MUST NOT 获得 Provider、Runtime、Context、凭据、workflow 或 Task lifecycle 的隐式所有权。
- **FR-012**: 更新或归档自定义 Agent MUST NOT 改写既有 Session 已冻结的 Agent Context；新 Session 只解析当时有效的 revision。

### Functional Requirements — Start、Harness 与 Session

- **FR-013**: 051 Assign/Start 输入中的 Agent reference MUST 从必填改为可选；`pending → in_progress`、Harness 幂等、Workspace preparation 和唯一 Session 规则保持不变。
- **FR-014**: Harness MUST 冻结 `0..1` Agent snapshot reference；没有选择 Agent 的 attempt 是完整有效的生产 attempt，且 execution code 仍绑定准确 Team、Task、Harness 与 Session。
- **FR-015**: `mystra-agent context get` MUST 能区分并报告可选 Agent Context 是否存在，但 execution code MUST NOT 被描述为 Agent 的长期身份。
- **FR-016**: Session launch MUST 冻结 Standard Execution Prompt version、可选 Agent snapshot、各 prompt component 与最终 system prompt；后续继续消息不得重复注入或重新解析这些输入。
- **FR-017**: 最终提示词的固定优先级与组成 MUST 在 API、Runner 与 Provider adapter 间保持一致；不得由某个 adapter 把 Agent Context 当作完整 system prompt 覆盖其他组件。
- **FR-018**: Start API、CLI、MCP 与 Web adapter MUST 对 Agent 可选性使用同一 canonical application contract；任一入口不得单独要求默认 Agent。

### Functional Requirements — Product Experience

- **FR-019**: 没有可选自定义 Agent 时，Task production surface MUST 不显示必填 Agent selector，且 Start 操作 MUST 保持可用。
- **FR-020**: 当产品暴露自定义 Agent 选择时，控件 MUST 明确表达“可选 Agent Context”，默认值 MUST 是不附加额外上下文；不得使用“Default Agent”措辞。
- **FR-021**: 标准执行提示词 MUST 作为平台行为而非用户配置呈现；本期 MUST NOT 增加其查看、编辑、Team 初始化或 Project 配置入口。
- **FR-022**: 历史 Session/attempt 的审查投影 MUST 显示标准提示词版本，以及可选 Agent 的名称/ID/revision或明确的“无附加 Agent Context”。

### Contract Supersession

- **FR-023**: 本规格 MUST supersede 046/049 中“Agent 是每次 Session 必填的四要素之一”的条款；当前模型是 Runtime、Provider、执行 Context 必须解析，Agent Context 可选，Standard Execution Prompt 始终必填。
- **FR-024**: 本规格 MUST supersede 051 中“Assign Agent 才能 Start”及“Harness 必须冻结 Agent revision”的必填语义；操作语义改为 Start production，并只在明确选择自定义 Agent 时冻结 revision。
- **FR-025**: 046 的 Agent 管理、Team 隔离、revision、active/archived 与非秘密规则继续有效；本规格只改变 Agent 在执行组装中的必填性和优先级。

### Key Entities

- **Standard Execution Prompt**: 程序拥有的版本化平台执行合同；始终参与 Task-bound Session 的 system prompt 组装，不是 Agent 或 Team 数据。
- **Agent Context**: 从可选自定义 Agent 当前 revision 冻结的补充行为上下文；包含 Agent ID、revision 与 prompt snapshot，缺席是合法值。
- **Effective System Prompt Evidence**: Session 创建时冻结的标准版本、组成组件、可选 Agent snapshot 与最终文本，用于历史审查。
- **Harness Attempt**: Task 的一次生产 attempt；可引用 `0..1` Agent snapshot，但其 workload 身份来自 attempt-scoped execution code。

## 假设与依赖

- 046 继续提供自定义 Agent 的管理与 revision 合同；052 不新增 Agent 管理 UI。
- 049 继续拥有 Session 原子 launch、prompt evidence 与 Provider adapter 边界；052 修改其 prompt 组成和 Agent 可选性。
- 051 继续拥有 Task productionStatus、Harness、Workspace-to-Session 启动和 `mystra-agent`；052 只解除 Agent 必填门槛。
- Standard Execution Prompt 的具体逐字内容与版本机制在 plan 中确定，但不得把它持久化为 Team Agent。
- 现有 pre-0.1 本地数据可以按当前合同直接重建；不提供默认 Agent 数据迁移或兼容 fallback。

## 范围之外

- 自定义 Agent 创建、编辑或市场化模板体验。
- 将自定义 Agent 自动绑定到 Team、Project、Task 类型、Workflow 或 Production Recipe。
- 多 Agent 编排、Agent 自动分诊、任务路由或角色推荐。
- 用户编辑、覆写或关闭 Standard Execution Prompt。
- 提示词效果评测、PR/自测验证、质量门禁或自动修复循环。
- Task 删除；该产品能力由独立规格拥有。
- Harness 心跳、事件订阅、多 Session 与通用 Artifact submission。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 对没有任何自定义 Agent 的 Team，100% eligible Task 可成功 Start，并创建一个有效 Harness 与一个使用 Standard Execution Prompt 的 Session。
- **SC-002**: 默认 Task production journey 中需要用户完成的 Agent 配置或选择步骤数量为 0，且不存在空 Agent selector 阻断 Start。
- **SC-003**: 抽样 100 个无 Agent attempt，Agent ID/snapshot 均明确缺席，且没有生成默认 Agent、sentinel ID 或 Team 初始化 Agent 数据。
- **SC-004**: 抽样 100 个选择自定义 Agent 的 Session，100% 同时包含正确 Standard Execution Prompt version 与所选 Agent revision context；0 个 Session 仅使用自定义 Agent prompt。
- **SC-005**: 标准提示词或 Agent 更新后，100% 既有 Session 的最终 prompt evidence 保持逐字不变，之后的 Session 使用新版本。
- **SC-006**: API、CLI、MCP、Web 与 Runner 的合同测试对同一输入得到一致的 Agent 可选性和 prompt component 顺序；不存在入口级默认 Agent fallback。
- **SC-007**: 术语审计中 100% 的默认路径使用“Standard Execution Prompt / 标准执行提示词”和“Optional Agent Context / 可选 Agent 上下文”，不再把系统默认行为称为“Default Agent”。
