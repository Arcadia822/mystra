# 功能规格：Task 上下文容器与创建入口

**Feature Branch**: `047-task-context`
**Created**: 2026-08-08
**Status**: Implemented
**Input**: 定义新的 Task 对象：Task 直属 Team，可保存零或一个 Project 上下文引用、关联零或一个 Issue，作为面向 Agent 的工作容器；New 页面用于手动创建 Task，Issue 列表通过一个按钮直接创建 Task；Task 不承担复杂需求状态机，也不设计任何 Session 启动逻辑。

**Owner Decisions**:

- Task 是 Team 直属、可独立存在的持久工作容器，不归属于 Project，也不是 Session 的父级前置条件。
- Session 可以没有 Project、没有 Task；本规格不得设计 Session 创建、四要素默认值或自动路由算法。
- Project 与 Task 未来只可为 Session 附加上下文，并为四要素自动路由提供策略输入；这些策略不属于本规格。
- `/new` 是手动创建 Task 的页面，不是启动 Session 的页面。
- Issue → Task 没有中间页面或配置步骤；它是 Issue 行上的单一显式按钮。
- 一个 exact Issue 最多关联一个 Task；已有 Task 时显示 `Open Task`。
- Issue 行创建成功后留在当前列表，不自动跳转。
- Task 的可选 Project 与 Issue 引用只在创建时确定，创建后不得修改。

## Contract Summary

Task 保存人类或 Agent 要持续处理的意图与工作说明。它直属 Team，可以独立存在，也可以在创建时保存一个可选 Project 上下文引用；该引用不构成 Project ownership。当 Task 由外部 Issue 创建时，只保存可解析该 Issue 的稳定引用，不复制外部需求管理状态。

| 关系或能力 | 本规格合同 |
| --- | --- |
| Team | 每个 Task 属于且隔离于一个 Mystra Team |
| Project | 零或一个不可变可选引用；不是所有权，没有 Project 的 Task 合法且必须可发现 |
| Issue | 零或一个不可变引用；只由 Issue 行创建路径写入，并同时写入该 Issue 所属 Project |
| Session | 无必需关系；创建或更新 Task 不得创建、启动、排队或配置 Session |
| 生命周期 | 不引入需求管理状态机；Issue status、priority、assignee、cycle、milestone 等继续由外部 Issue 拥有 |

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 从 New 页面手动创建 Task（Priority: P1）

作为 Mystra 操作者，我希望在 `/new` 输入 Task 标题和工作说明，并按需选择一个 Project 上下文引用，以便先建立一个可持续补充的 Agent 工作容器，而不被迫立即启动 Session。

**Why this priority**: New 是主导航中的快速入口。若它仍要求 Project 或把创建等同于执行，独立 Task 与独立 Session 都只是文档上的装饰品。

**Independent Test**: 分别创建无 Project 和带 Project 引用的 Task；每次只产生一个 Task，成功后进入 Task 对象页，Issue 与 Session mutation 数量始终为零。

**Acceptance Scenarios**:

1. **Given** 操作者位于 active Team，**When** 在 `/new` 输入有效标题并提交，**Then** 系统创建无 Project、无 Issue 的 Task，并进入其 Task 对象页。
2. **Given** 操作者选择一个可访问 Project，**When** 创建 Task，**Then** Task 保存该 Project 的可选上下文引用，但仍直属 Team，且不要求 Issue、Agent、Runtime、Provider、Context 或 Session 参数。
3. **Given** 操作者使用 `/new`，**When** 查看全部创建控件，**Then** 页面不存在 Issue picker、Issue 搜索或 Issue 引用输入；Issue 关联只能从 Project-scoped Issue 行创建。
4. **Given** 标题为空或只有空白，**When** 提交，**Then** 页面在本地与服务端边界均拒绝创建并把焦点移到标题字段。
5. **Given** 创建请求进行中，**When** 操作者重复点击或请求被安全重试，**Then** 同一个创建操作最多产生一个 Task。
6. **Given** Task 创建成功，**When** 页面导航到 Task 对象页，**Then** 未完成草稿被清除，之前选择的 Project 不会自动继承给下一次 New 创建。

---

### User Story 2 - 从 Issue 行一键创建 Task（Priority: P1）

作为正在浏览 Project Issues 的操作者，我希望点击 Issue 行上的 `Create Task` 按钮就直接创建 Task，以便把外部需求变成 Mystra 的 Agent 上下文，而不经过表单、详情页或 Session 配置。

**Why this priority**: 045 已经故意把 Issue → Task 留给后续规格。本功能必须完成这条边界，而不是再发明一个“即将开始”的过渡页面。

**Independent Test**: 在 GitHub 与 Linear 的 Project-scoped Issue 列表各选择一个 Issue，点击行级按钮；每次直接创建带 Project + Issue 引用的 Task 并留在当前列表，不出现 modal、drawer、wizard、自动跳转或 Session 请求。

**Acceptance Scenarios**:

1. **Given** 操作者可访问 Project 与其 GitHub Issue，**When** 点击 `Create Task`，**Then** 系统以当前 Issue 标题作为初始 Task 标题，保存 exact Project 上下文引用与 GitHub Issue 稳定引用，并留在当前 Issue 列表。
2. **Given** 操作者可访问 Project 与其 Linear Issue，**When** 点击 `Create Task`，**Then** 系统执行相同的一步创建行为，并保留 exact Linear connection/source scope 所需的稳定引用。
3. **Given** 同一 Issue 已有关联 Task，**When** 再次呈现该 Issue 行，**Then** 行级 Task 操作显示 `Open Task`；只有操作者随后点击它时才打开既有 Task，不创建重复 Task。
4. **Given** 两个并发或重试请求尝试从同一 exact Issue 创建 Task，**When** 服务端处理完成，**Then** 最多创建一个关联 Task，所有成功响应解析为同一 Task ID。
5. **Given** Issue 在点击后被上游重命名、关闭或改变优先级，**When** 查看 Task，**Then** Task 的自主标题不被静默改写，Issue 当前状态仍由 provider 实时读取；Task 不保存或同步需求管理快照。
6. **Given** Issue source、connection、Project 或操作者权限已失效，**When** 点击按钮，**Then** 创建 fail closed，页面保留在 Issue 列表并显示可恢复错误，不产生无来源或跨 Team Task。
7. **Given** 一键创建完成，**When** 检查所有请求，**Then** 不存在 Session 创建、Session 启动、Issue write-back 或外部 Issue 修改。

---

### User Story 3 - 维护 Task 自有内容并保持来源固定（Priority: P1）

作为 Task 的协作者，我希望读取和更新 Task 自有的标题与工作说明，同时让创建时确定的 Project/Issue 引用保持固定，以便在多次 Agent 工作之间保留稳定意图和来源，而不把 Task 变成另一套 Issue 管理系统。

**Why this priority**: 只会被创建、无法被维护的“上下文容器”只是一次性表单提交留下的化石。

**Independent Test**: 分别创建手动 Task 和 Issue-derived Task，更新标题与工作说明；Task ID 和创建时的 Project/Issue 引用保持不变，不创建 Session，也不复制外部 Issue 状态。

**Acceptance Scenarios**:

1. **Given** 已存在 Task，**When** 授权操作者更新标题或工作说明，**Then** 同一 Task 身份保留并更新修改时间。
2. **Given** 已存在手动 Task，**When** 调用方尝试附加、替换或移除其 Project 引用，**Then** 系统拒绝更新；需要不同 Project 上下文时必须创建新 Task。
3. **Given** 已存在任意 Task，**When** 调用方尝试附加、替换或解除 Issue 引用，**Then** 系统拒绝更新；Issue 引用只能由 Issue 行创建路径在创建时写入。
4. **Given** Issue-derived Task 的外部 Issue 已不可访问，**When** 读取 Task，**Then** Task 自身内容仍可用，Issue 引用显示不可用状态且不回退到其他 connection 或同名 Issue。
5. **Given** Task 被 Session 通过 `taskId` 引用，**When** Session 没有或另行指定 `projectId`，**Then** Task 自身的 Project 引用不得推导、要求或覆盖 Session 的 Project 引用。

---

### User Story 4 - 发现有 Project 与无 Project 的 Task（Priority: P2）

作为操作者，我希望 Task 列表同时显示按 Project 分组的 Task 与明确的 `No project` 分组，以便手动创建的独立 Task 不会在离开详情页后消失。

**Why this priority**: 可创建但不可再次发现的数据通常被称为 bug。为了保持仪式感，也可以称为“极简信息架构”。

**Independent Test**: 创建两个无 Project Task 和两个带不同 Project 引用的 Task；列表分别显示在 `No project` 与对应 Project 分组，每个 Task 始终只出现一次。

**Acceptance Scenarios**:

1. **Given** Team 同时存在有 Project 与无 Project Task，**When** 打开 Task 列表或主导航 Task 分组，**Then** 两类 Task 均可发现，无 Project Task 进入明确的 `No project` 分组。
2. **Given** Task 在创建时带有 Project 引用，**When** 列表刷新，**Then** Task 只出现在该 Project 对应的一个分组中；分组不改变 Task 的 Team ownership。
3. **Given** 当前 Team 没有 Task，**When** 打开列表，**Then** 页面提供进入 `/new` 的入口，不伪造示例数据或 Session 状态。

### Edge Cases

- 允许的创建结果只有：无 Project/无 Issue、一个 Project/无 Issue、一个 Project/一个 Issue；最后一种只可由 Issue 行创建。有 Issue/无 Project 为非法状态。
- Issue 引用必须包含 provider-stable external identity，并通过 Task 的 exact Project source 解析；可变标题、编号展示文本或 URL 不能单独承担身份。
- 同名 Task 合法；引用、更新和关联必须使用稳定 Task ID。
- 从 Issue 创建时复制的标题只作为 Task 初始标题，此后 Task 标题与上游 Issue 标题独立变化。
- Project 或 Issue 来自其他 Team、Project 已归档、Issue source 已切换、connection 已撤销或 provider 返回畸形数据时，所有关联写入 fail closed。
- New 页不加载或选择 Issue；Project 选择只影响手动 Task 的不可变 Project 上下文引用。
- Issue 一键创建正在进行时按钮必须禁用并有文本 loading 状态，不能只靠颜色表达。
- Task 工作说明和外部 Issue 文本是不受信任的用户/第三方输入；显示时按普通文本处理，未来作为 Context assembly 来源时也不能被提升为 system-level 指令。

## Requirements *(mandatory)*

### Functional Requirements — Task 对象

- **FR-001**: Task MUST 归属于一个 Mystra Team，并通过 authenticated active Team 推导；公共创建请求 MUST NOT 接受调用方自报的 Team identity。
- **FR-002**: Task MUST 拥有稳定 ID、非空标题、可为空的 `description`、零或一个 Project 上下文引用、零或一个 Issue 稳定引用、创建时间与更新时间。
- **FR-003**: Task MUST 可在没有 Project 且没有 Issue 时创建、读取、更新和列出；Project 不得成为 Task 身份或存在前提。
- **FR-004**: Task 由 Issue 创建时 MUST 同时写入该 Issue 所属 Project 的上下文引用；Task 的 Project 引用与 Issue source scope MUST 完全一致。
- **FR-005**: 一个 exact Issue 在本功能中 MUST 最多关联一个 Task；同一 Issue 的并发创建与安全重试 MUST 返回同一 Task，不得产生重复 Task。
- **FR-006**: Task 标题 MUST 在去除首尾空白后仍有内容并受显式长度上限约束；`description` MAY 为空，但若提供也 MUST 受显式长度上限约束。具体上限由 plan/research 统一确定。
- **FR-007**: 授权调用方 MUST 能通过 canonical programmable surface 创建、读取、列出和更新 Task 的标题与 `description`；MVP 不要求 Task 删除、归档或需求状态变更。
- **FR-008**: Task 的 Project 与 Issue 引用 MUST 在创建后不可变；任何更新入口 MUST 拒绝新增、替换、清空或迁移这些引用。
- **FR-009**: 手动创建 MAY 写入零或一个 Project 上下文引用但 MUST NOT 接受 Issue 引用；Issue-derived 创建 MUST 重新验证 Team、Project、provider、exact connection/source scope 与当前访问权，并原子写入 Project 与 Issue 引用。
- **FR-010**: Task MUST NOT 保存 Issue status、priority、assignee、labels、cycle、milestone、comments、description snapshot 或其他需求管理状态；这些信息继续由外部 Issue 拥有并按需读取。
- **FR-011**: Task MUST NOT 引入 backlog、triage、in progress、done、blocked、approval、priority、estimate、due date、assignee 或 workflow transition 等需求管理字段或状态机。
- **FR-012**: Task 创建或更新 MUST NOT 创建、启动、排队、取消或配置 Session，也 MUST NOT 要求 Runtime、Provider、Agent、Context 四要素。

### Functional Requirements — New 页面

- **FR-013**: 主导航 `New` 与 `/new` MUST 直接呈现手动 Task 创建页面；页面标题和主要动作 MUST 使用 `Task` / `Create Task` 术语，不得称为 Session 启动或 dispatch。
- **FR-014**: New 页面 MUST 只提供标题、`description` 与可选 Project 输入；MUST NOT 提供 Issue、Runtime、Provider、Agent、Context、模型、branch 或 Session 控件。
- **FR-015**: New 页面 MUST NOT 加载、搜索、选择或提交 Issue；所有 Issue-derived Task 的 Web 创建入口 MUST 位于 045 定义的 Project-scoped provider-specific Issue 行。
- **FR-016**: 手动创建提交时服务端 MUST 将可选 Project 验证为 active Team 内可访问对象，并把它保存为不可变上下文引用而非 Project ownership。
- **FR-017**: 手动 Task 创建成功后 MUST 导航到 canonical Task 对象页，清除当前草稿，并且 MUST NOT 自动启动 Session。
- **FR-018**: 未完成草稿 SHOULD 在当前操作者和 active Team 范围内跨 `/new` 页面往返恢复；成功提交、切换 Team 或明确清除 MUST 移除草稿，且成功后的 Project 不得成为下一次创建的隐式默认值。
- **FR-019**: New 页面 MUST 提供 submitting、validation error、authorization error、Project unavailable 与 recoverable server error 状态；失败时保留仍合法的草稿内容。

### Functional Requirements — Issue 一键创建

- **FR-020**: 045 定义的 GitHub 与 Linear Issue 行 MUST 在保留 provider 原始 Issue 入口的同时增加一个 Task-specific `Create Task` 按钮；该按钮 MUST 直接调用 canonical Task 创建能力，不得打开 modal、drawer、wizard、Mystra Issue 详情页或 New 页面。
- **FR-021**: 从 Issue 创建 Task MUST 原子写入当前 active Team、exact Project 与 provider-stable Issue 引用，并以当前 Issue 标题生成初始 Task 标题；不得保存 Issue 内容快照。
- **FR-022**: Issue 已有关联 Task 时，行级操作 MUST 呈现为 `Open Task` 并打开既有 Task；服务端唯一性仍是最终防重边界。
- **FR-023**: Issue 一键创建成功后 MUST 留在当前 Issue 列表，显示成功反馈，并把该行 Task 操作更新为 `Open Task`；只有显式点击 `Open Task` 才进入 canonical Task 对象页。失败时同样留在 Issue 列表并提供可恢复错误。
- **FR-024**: Issue 一键创建 MUST 是 Mystra 内部只写 Task、外部只读的操作；MUST NOT 修改、评论、标记或 write back 外部 Issue。
- **FR-025**: New 页面与 Issue 一键创建 MUST 使用同一 Task 创建业务规则、授权与验证边界；Web 不得拥有第二套 Task 关系逻辑。

### Functional Requirements — 列表、授权与界面质量

- **FR-026**: Task 列表与主导航 Task 分组 MUST 同时支持按 Project 分组和明确的 `No project` 分组；每个 Task 在任一时刻只能出现在一个分组。
- **FR-027**: Task 的创建、读取、列出和更新 MUST 按 Team fail closed；Project、Issue 或 Task 来自其他 Team 时不得泄露存在性或建立关系。
- **FR-028**: Task 与 Issue 标题、Task `description` 及外部展示字段 MUST 作为不受信任文本安全呈现，不得解释为 HTML、脚本或 system-level Agent 指令。
- **FR-029**: 新增 UI 文案 MUST 提供简体中文与英文值，并在 320、768、1024 和 1440px 视口保持 New 表单与 Issue 行操作可用。
- **FR-030**: New 表单与 Issue 行操作 MUST 支持键盘操作、可见 focus、语义化 label、文本状态和错误关联；不得只通过颜色表达可用性、loading 或失败。

### Key Entities

- **Task**: Team-owned 的持久 Agent 工作容器。包含稳定身份、标题、`description`、不可变的可选 Project 上下文引用、不可变的可选 Issue 引用和管理时间；不包含 Session 启动参数或需求状态机。
- **Task Project Reference**: Task 创建时保存的零或一个 Project 上下文引用。它不是 Project ownership，也不得被 Session 的 `taskId` 隐式投影为 Session `projectId`。
- **Task Issue Reference**: Issue-derived Task 创建时保存的零或一个外部 Issue 稳定引用。它依赖同次创建写入的 exact Project source，只用于解析实时 Issue 内容与防止重复创建，不是 Issue snapshot，创建后不可修改。
- **New Task Draft**: 当前操作者在 active Team 下尚未提交的本地创建输入；不是 Task，不可被 Session 或其他操作者读取。
- **Issue-to-Task Action**: Project-scoped Issue 行上的原子创建或打开既有 Task 操作；不是独立业务对象，也不修改外部 Issue。

## Dependencies and Supersession

- `045-project-issue-sources` 继续拥有 Project-scoped GitHub/Linear Issue 来源、列表、筛选、分页、provider 原始页面入口与外部只读数据。本功能明确覆盖其 User Story 3 Acceptance Scenario 6、FR-025 与 SC-009 中“不得提供 Task 创建/Task 控件”的部分，仅新增一个 Task-specific 按钮；045 对无 Mystra Issue 详情页、无 Issue write-back、无 Session mutation 和 provider 原始入口的要求继续有效。
- `046-agent-definition` 继续拥有 Agent、Session 四要素、Team ownership 以及 Session `taskId?` / `projectId?` 独立性的定义。本功能遵守 Task 直属 Team、不归属于 Project 的合同；Task 自身可选 Project 引用只附加上下文，不得推导 Session Project，也不定义四要素默认值或路由策略。
- 本功能取代当前 Task 必须属于 Project、Task 是 Session 父级意图或 `/new` 必须选择 Project 的临时合同；pre-0.1 不提供兼容别名或双写路径。
- 现有 Team RBAC、Project exact-connection 和 Issue provider authorization 继续适用；本功能不扩大凭据范围。

## Assumptions

- 一个 exact Issue 在 MVP 中对应零或一个 durable Task，是 Owner 已确认的产品决定；多次 Agent 执行由未来 Session 关系表达，而不是为同一 Issue 复制 Task。
- Task 标题与 `description` 是 Mystra-owned 内容；Issue 标题只在一键创建时作为初始值，不持续同步。
- Task 的 Project/Issue 引用创建后不可修改，是 Owner 已确认的产品决定；需要不同来源范围时创建新 Task。
- Task 详情页和 canonical Task object route 已是产品方向；其 Session 面板、运行按钮和状态聚合不在本规格中定义。
- Project/Task 对未来 Session 四要素的默认值、优先级、覆盖和 auto routing 策略必须由独立 Session 规格定义。

## Out of Scope

- 任何 Session 创建、启动、dispatch、调度、claim、取消、重试、执行状态、结果、Review evidence 或 activity timeline。
- Runtime、Provider、Agent、Context 的默认值、选择器、解析顺序、兼容性校验或 auto routing 策略。
- Task 需求管理状态机、priority、assignee、estimate、due date、labels、milestone、cycle、approval 或 workflow automation。
- 外部 Issue write-back、状态修改、评论、webhook、双向同步、缓存或内容 snapshot。
- Mystra Issue 详情页、Issue 创建表单、Issue → Task wizard 或批量 Issue dispatch。
- Task 模板、子 Task、依赖图、看板、搜索排序策略、自动拆解、standing orders 或多 Agent 编排。
- Task 删除、归档、恢复、保留策略和历史版本 UI。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 操作者可在 `/new` 仅填写标题并用一次提交创建无 Project、无 Issue Task；创建过程中 Session mutation 请求数为 0。
- **SC-002**: 无 Project、仅 Project、Project + GitHub Issue、Project + Linear Issue 四种 Task 创建结果验收成功率为 100%；有 Issue/无 Project、New 页面 Issue 写入、创建后 Project/Issue 引用修改与跨 Project Issue 写入成功数均为 0。
- **SC-003**: 从 GitHub 或 Linear Issue 行创建 Task 均只需一次显式按钮点击；中间 modal、drawer、wizard、New 页面和 Mystra Issue 详情页出现数为 0，成功后的自动页面跳转数为 0。
- **SC-004**: 同一 exact Issue 的 20 次并发或重试创建全部解析为一个 Task ID，持久 Task 数量为 1。
- **SC-005**: Task 可见字段抽样中，需求管理状态字段数量为 0；外部 Issue 状态变化不会静默改写 Task 标题或 `description`。
- **SC-006**: Task 创建和更新的验收请求中，Session 创建、启动、配置、取消和外部 Issue write-back 次数均为 0。
- **SC-007**: 有 Project 与无 Project Task 在列表中发现率均为 100%，每个 Task 同时出现的分组数量恒为 1。
- **SC-008**: Project 切换、Issue source 失效、跨 Team 引用、并发创建和上游错误测试均 100% fail closed，且不产生孤立 Issue 引用或重复 Task。
- **SC-009**: 320、768、1024 和 1440px 视口及纯键盘操作下，New Task 创建和 Issue 行 `Create Task` / `Open Task` 均可完成，无不可恢复水平滚动。
