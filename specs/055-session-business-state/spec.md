---
title: "功能规格：Session 四态业务状态"
---

**Planning Branch**: `main`（按 owner 要求不创建独立 spec 分支）

**Created**: 2026-08-14

**Status**: Draft

**Input**: 将 Session 产品状态收敛为 `INIT | RUNNING | INTERRUPTED | DONE`。`queued`、`dispatched`、`message_pending` 仅是内部技术阶段，不再作为产品状态或独立业务字段；`ready` 改为 `DONE`；`interrupted` 与 `waiting_for_handoff` 合并为 `INTERRUPTED`；`INIT` 离开后不可返回，其他三态两两可转换。
**User Story Discussion**: Owner 已直接给出四态词汇、合并边界和迁移约束。本功能属于状态合同简化，用户故事用于描述操作者与客户端消费结果，不重新讨论是否保留九态。

## 决策摘要

Session 只公开四个产品状态：

```text
INIT -> RUNNING | INTERRUPTED | DONE

RUNNING <-> INTERRUPTED
RUNNING <-> DONE
INTERRUPTED <-> DONE

RUNNING | INTERRUPTED | DONE -X-> INIT
```

- `INIT`：Session 已创建但尚未离开首次初始化阶段。它可进入其余任一状态，离开后不可返回。
- `RUNNING`：Session 当前正在推进工作。首次执行和后续执行中的内部排队、派发与等待 Provider 阶段均不改变这项产品语义。
- `INTERRUPTED`：Session 当前不能自主继续，需要输入、审批、外部动作或 Human handoff。原 `waiting_for_handoff` 不再单独建模。
- `DONE`：Session 当前没有正在推进的工作，最近一次执行已经结束。它替代原 `ready`，但不是终态；后续消息或恢复动作可以使它重新进入 `RUNNING` 或 `INTERRUPTED`。

`queued`、`dispatched`、`message_pending` 可以继续作为内部执行事实、事件或诊断信息存在，但不得成为 Session 产品状态、公开枚举、筛选项、状态标签或另一个持久化业务字段。技术事实与产品状态由同一组已接受事件保持一致，不建立第二套可独立漂移的业务状态机。

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 只看到四个可解释的 Session 状态 (Priority: P1)

作为监督 Agent 执行的 Mystra 操作者，我希望所有 Session 表面只显示初始化、执行中、已中断和已完成四种业务状态，以便我判断 Session 是否正在工作、需要接手或暂时完成，而不必理解 Runtime claim、Provider 启动等内部机制。

**Why this priority**: 当前九态把技术流水线暴露为产品语言，迫使操作者理解实现细节，并让多个页面、API 客户端和自动化对同一 Session 得出不同的业务解释。

**Independent Test**: 准备覆盖首次启动、执行、等待输入、handoff、响应结束和再次执行的 Sessions，验证所有产品读取表面只返回并展示 `INIT | RUNNING | INTERRUPTED | DONE`，且不出现旧状态标签。

**Acceptance Scenarios**:

1. **Given** Session 已创建但首次初始化尚未产生外部可解释结果，**When** 操作者或客户端读取 Session，**Then** 状态为 `INIT`，不得暴露内部排队、派发或 Provider 等待阶段。
2. **Given** Session 当前正在推进工作，**When** 内部经历排队、派发或等待 Provider，**Then** 产品状态保持 `RUNNING`，内部阶段不得覆盖它。
3. **Given** Session 等待输入、审批、外部动作或 Human handoff，**When** 操作者查看任一 Session 表面，**Then** 统一显示 `INTERRUPTED`，原因由状态之外的事件或原因信息解释。
4. **Given** 当前执行已经结束且不需要立即接手，**When** 操作者读取 Session，**Then** 显示 `DONE`，不得显示 `ready` 或把 `DONE` 描述成不可恢复终态。

---

### User Story 2 - 使用单一且完整的四态迁移合同 (Priority: P1)

作为调用 Session 合同的客户端或平台能力，我希望所有合法迁移由同一个四态模型定义，以便新消息、恢复、handoff 和执行结束不会因不同表面各自维护迁移表而产生冲突。

**Why this priority**: 状态词汇变少没有价值，除非事件投影、命令校验、持久化、客户端和展示同时服从同一迁移合同。否则只是把九种混乱压缩成四种更难诊断的混乱。

**Independent Test**: 对四态迁移矩阵执行穷举验证：`INIT` 可离开到其余三态且任何状态不能回到 `INIT`；`RUNNING`、`INTERRUPTED`、`DONE` 两两可转换；未发生业务变化的幂等重放不新增状态迁移事实。

**Acceptance Scenarios**:

1. **Given** Session 为 `INIT`，**When** 首次产生正在执行、需要接手或已经结束的业务结果，**Then** 可分别进入 `RUNNING`、`INTERRUPTED` 或 `DONE`。
2. **Given** Session 已离开 `INIT`，**When** 任意命令或事件试图把它重新设为 `INIT`，**Then** 系统拒绝该迁移且原状态保持不变。
3. **Given** Session 为 `RUNNING`、`INTERRUPTED` 或 `DONE` 中任一状态，**When** 发生另两种状态对应的合法业务事实，**Then** Session 可以进入目标状态。
4. **Given** 相同命令或事件被幂等重放，**When** 它没有产生新的业务事实，**Then** Session 保持当前状态且不生成虚假迁移。

---

### User Story 3 - 保留诊断能力而不泄漏内部阶段 (Priority: P2)

作为排查执行问题的工程操作者，我希望仍能从受限的执行历史辨认排队、派发和 Provider 启动进度，但这些事实不污染 Session 的产品状态，以便诊断能力和产品语义各自保持单一职责。

**Why this priority**: 删除可观察证据会让简化变成失明；把证据继续塞进业务状态又会原样复活当前问题。

**Independent Test**: 让一条 Session 经历完整内部启动阶段，验证授权的 Session-scoped 历史仍可解释执行进度，而 Session 产品记录、筛选、状态标签和公开状态枚举始终只有四态，且不存在独立的内部阶段业务字段。

**Acceptance Scenarios**:

1. **Given** Runtime 正在处理内部排队、派发或 Provider 启动，**When** 授权工程操作者查看 Session 执行历史，**Then** 可以定位相应技术事实，但 Session 状态仍只使用四态。
2. **Given** 任一产品客户端读取、筛选或展示 Session，**When** 内部阶段发生变化，**Then** 客户端不需要识别 `queued`、`dispatched` 或 `message_pending`。
3. **Given** 内部技术阶段与产品状态都可由事件事实解释，**When** 系统更新投影，**Then** 不创建一个可被单独写入、查询或展示的内部阶段业务字段。

### Edge Cases

- Session 在首次开始执行前遇到不可继续的情况时，可以从 `INIT` 直接进入 `INTERRUPTED`；若首次尝试已经结束且无需立即接手，可以直接进入 `DONE`。
- Session 在 `DONE` 后收到新消息时直接进入 `RUNNING`，不得为了重跑内部初始化阶段而返回 `INIT`。
- Session 在 `DONE` 后发现需要 Human 处理的遗留事项时可以进入 `INTERRUPTED`，无需先经过 `RUNNING`。
- Session 在 `INTERRUPTED` 状态下完成 Human handoff 或补充信息后，可以进入 `RUNNING` 继续执行，也可以进入 `DONE` 表示当前工作结束。
- 失败、取消、关闭、Provider limit、approval、input request 和 handoff 不得扩展顶层状态词汇；具体原因保留在类型化事实中，并依据“正在执行 / 需要外部介入 / 当前工作已结束”映射到四态。
- 旧状态值出现在 pre-0.1 本地开发数据时不提供 alias、双读或迁移兼容；实现阶段直接重建受影响数据与 fixtures。

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Session 产品状态 MUST 严格且仅为 `INIT | RUNNING | INTERRUPTED | DONE`。
- **FR-002**: `INIT` MUST 是新 Session 的唯一初始状态。
- **FR-003**: `INIT` MUST 可转换为 `RUNNING`、`INTERRUPTED` 或 `DONE`，但任何已离开 `INIT` 的 Session MUST NOT 返回 `INIT`。
- **FR-004**: `RUNNING`、`INTERRUPTED`、`DONE` MUST 两两允许转换；`DONE` MUST NOT 被定义为不可恢复终态。
- **FR-005**: 原 `queued`、`dispatched`、`message_pending` MUST 从产品状态枚举、Session 产品字段取值、公共筛选和用户可见标签中移除。
- **FR-006**: 内部排队、派发、Provider 启动和消息等待 MAY 继续作为受限的执行事实存在，但 MUST NOT 新增一个独立的 Session 业务阶段字段。
- **FR-007**: 首次执行尚未离开初始化语义时，内部阶段 MUST 保持在 `INIT` 之下；Session 离开 `INIT` 后，后续消息的内部启动阶段 MUST NOT 使其返回 `INIT`。
- **FR-008**: 原 `ready` MUST 由 `DONE` 替代；原 `interrupted` 与 `waiting_for_handoff` MUST 合并为 `INTERRUPTED`。
- **FR-009**: 原 `closed` 与 `failed` MUST 不再作为 Session 顶层状态；关闭、失败、取消和结束原因 MUST 通过类型化事实保存，并映射到 `INTERRUPTED` 或 `DONE`，不得形成第五个状态。
- **FR-010**: 等待输入、审批、外部动作、Provider refusal/limit 与 Human handoff 需要外部介入时 MUST 统一投影为 `INTERRUPTED`，具体原因 MUST 保持可区分。
- **FR-011**: 新消息、恢复或重新执行使 Session 再次推进工作时 MUST 投影为 `RUNNING`，包括从 `DONE` 和 `INTERRUPTED` 恢复。
- **FR-012**: 当前执行结束且不需要立即外部介入时 MUST 投影为 `DONE`；若结束后仍需外部介入，则 MUST 投影为 `INTERRUPTED`。
- **FR-013**: API、CLI、MCP、持久化投影、事件 reducer、Web UI、筛选、测试 fixtures 与当前有效文档 MUST 使用同一个四态词汇和迁移矩阵。
- **FR-014**: Session 状态变化 MUST 继续与 Task `productionStatus`、Harness、Workspace 和 Runtime 状态相互独立；任何 Session 迁移 MUST NOT 自动修改这些对象的状态。
- **FR-015**: 状态更新 MUST 保持 Team 授权、幂等、事件可追溯和并发冲突拒绝能力；状态简化 MUST NOT 弱化这些既有边界。
- **FR-016**: 在版本达到 `0.1.0` 前，旧九态合同 MUST 被直接替换，不得保留兼容别名、双读、双写或旧值展示映射。
- **FR-017**: Feature 055 MUST 明确取代 feature 049、050、053、054 及 5xP 当前文档中的九态 Session 状态词汇；历史规格可保留原始决策记录，但所有当前有效合同必须指向本功能。

### Key Entities

- **Session**: Team-scoped 多消息执行会话；只保存四态产品状态以及与当前业务状态直接相关的投影信息。
- **Session business state**: `INIT | RUNNING | INTERRUPTED | DONE` 中的一个值；表达产品可解释的执行位置，不表达 Runtime 或 Provider 管线阶段。
- **Session execution fact**: 有序、受限且可审计的技术或业务事实；可以解释内部阶段、interrupt reason、handoff、失败、取消和完成原因，但不构成第二套业务状态。

## Assumptions and Dependencies

- Owner 所说“`RUNNING INTERRUPTED DONE` 可以互相转换”按两两双向迁移解释，因此 `DONE -> INTERRUPTED` 和 `DONE -> RUNNING` 都是正式合同。
- `INIT` 可直接离开到其余任一状态；这使首次启动前的失败或 handoff 不必伪装成 `RUNNING`。
- `DONE` 表达“当前工作已结束”，而不是 Session 永久关闭；永久归档、删除或保留策略不属于本功能。
- 内部阶段继续通过既有 Session-scoped 执行事实提供诊断，不新增公共或持久化业务阶段字段。
- feature 049 继续拥有 Session launch、多消息、事件历史和 Runtime 协作的基础能力；055 只替换其产品状态词汇与迁移语义。

## Out of Scope

- 新增第五个状态或结构化 interruption reason 枚举。
- 改变 Task 五态 `productionStatus` 或其 actor ownership。
- 引入自动重试、跨 Runtime 迁移、并行消息、多 Session 编排或通用日志产品。
- 定义 Session 永久归档、保留和删除策略。
- 在本规格阶段实现 API、数据库、Runner、CLI、MCP 或生产 UI 修改。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% 的当前 Session 产品读取、筛选和展示表面只接受并输出 `INIT | RUNNING | INTERRUPTED | DONE`。
- **SC-002**: 四态迁移矩阵的全部 9 条跨状态合法迁移均有正向验证，3 条返回 `INIT` 的非法迁移均被拒绝，且不存在未声明的第五状态。
- **SC-003**: 100% 的内部 `queued`、`dispatched`、`message_pending` 阶段变化不新增或改变任何 Session 产品阶段字段，同时仍能从授权的 Session-scoped 历史解释。
- **SC-004**: 等待输入、审批、外部动作和 Human handoff 的验收样例 100% 投影为 `INTERRUPTED`，原因仍可区分。
- **SC-005**: 当前工作结束后再次发送消息或恢复的验收样例 100% 能从 `DONE` 进入 `RUNNING` 或 `INTERRUPTED`，不经过 `INIT`。
- **SC-006**: Session 四态的任何转换都不会自动改变 Task、Harness、Workspace 或 Runtime 的状态。
- **SC-007**: 当前有效合同、用户可见文案和测试 fixtures 中旧九态作为产品状态的残留数量为 0；历史规格仅作为被 055 supersede 的决策记录存在。
