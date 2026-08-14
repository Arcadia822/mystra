# 功能规格：薄 Task 生产状态机与 mystra-agent CLI

**Feature Branch**: 051-factory-task-harness
**Created**: 2026-08-11
**Status**: Complete

> **052 supersession (2026-08-12)**: “Assign Agent/Assign & Start” 已由 canonical
> `Start production` 直接替换。Agent Context 可 omitted/null；显式 ID 必须在 Start
> transaction 内解析并冻结，且无效选择 fail closed。Harness/Session Agent snapshot
> 必须全有或全无；不得创建 default/sentinel Agent 或保留 `/assign` alias。051 的
> Task productionStatus、Harness、Workspace continuation、execution code 和 scoped
> status transition 合同继续有效。

> **054 status supersession (2026-08-13)**: 054 直接删除
> `waiting_for_review`，并将其 handoff 语义并入 `blocked`。当前五态为
> `pending/in_progress/blocked/done/canceled`，其中 `blocked` 显示为待接手；Human
> 可将其恢复为 `in_progress` 或确认为 `done`。051 下文的六态枚举与
> `waiting_for_review` transition 仅保留为已实现旧合同的迁移证据，不再是目标产品合同。
**Input**: Mystra 以“工厂”为核心产品模型。第一版先为 Task 增加薄生产状态机，并提供 workload-local `mystra-agent` CLI，让被分配 Agent 用当前 attempt 的短期 execution code 获取完整执行上下文并报告生产进度。`mystra` 保留为面向 Human、外部 Agent 和操作者的 Control Plane 管理 CLI。Agent 通过宿主机已认证的 `linctl` 读取 Linear、通过 `gh` 提交 PR；Mystra 不代理或验证这些操作。一个 Harness attempt 仍只启动一个 goal/autopilot Session；完整 Harness 编排、平台验收和通用产出物延后。

## 决策摘要

Task 是基本生产任务，并拥有 Mystra-owned 的 productionStatus。Session 只表达一次执行会话的运行状态，两者不得互相镜像。Harness 第一版只是一次生产 attempt 的归因身份：冻结 Agent revision，关联一个 Session，不再拥有第二套生产状态机。

`mystra` 与 `mystra-agent` 是两个明确分离的客户端。前者管理 Control Plane 资源；后者只服务当前运行中的 workload，通过 Runtime 注入的 execution code 解析当前 Team、Task、Harness、Session、冻结 Agent revision、Project、Issue reference 和 Workspace。`mystra-agent` 不接受任意 Task ID，也不能使用通用 Task PATCH 修改 title、description、Project 或 Issue context。

Agent 通过宿主机本地、已认证的 `linctl` 读取 Linear Issue，通过本地 `gh` 推送分支并创建 PR。execution code 不授权这两个工具，Mystra 也不代理其请求、托管其凭据或验证其结果。Agent 对 PR、自测和阻塞原因的说明都是未验证声明；Mystra 本期不运行测试、不查询或验证 PR，也不根据 Session 输出推断 Task 是否完成。

本规格明确取代 047 中“Task 没有生产状态”的边界，但不改变其外部信息所有权：Linear/GitHub Issue status 仍由 Provider 拥有，Mystra 不复制、不回写，也不把它映射为 productionStatus。

## Task Production State Machine

### 状态

| productionStatus | 含义 | 进入者 |
| --- | --- | --- |
| pending | Task 已创建，尚未开始生产 | 系统创建 |
| in_progress | 已分配 Agent，生产正在进行或恢复进行 | Assign/Start；Agent 恢复；Human 退回修改 |
| blocked | Agent 明确声明当前无法继续，并提供原因 | Agent |
| waiting_for_review | Agent 明确声明已完成当前生产目标，等待人工审查 | Agent |
| done | 人工确认本次生产任务结束 | Human |
| canceled | 人工终止未完成的生产任务 | Human |

Task 不提供 failed 状态。失败属于 Harness/Session attempt；Agent 无法继续时将 Task 置为 blocked。这样可以避免一次进程异常永久定义业务任务，也避免 Mystra 假装理解 Agent 的执行结果。

### 合法迁移

    create ───────────────→ pending
    pending ──Assign/Start→ in_progress
    in_progress ──Agent───→ blocked
    blocked ─────Agent────→ in_progress
    in_progress ──Agent───→ waiting_for_review
    waiting_for_review ─Human→ in_progress
    waiting_for_review ─Human→ done
    blocked ────────────Human→ in_progress
    any nonterminal ────Human→ canceled

done 和 canceled 在第一版为终态；reopen 延后。Agent 不得设置 pending、done 或 canceled，也不得从 waiting_for_review 自行恢复生产。

### 状态机规则

1. Assign/Start 的短 RDB 事务必须原子完成 pending → in_progress 并创建 Harness attempt。事务提交后自动请求 Workspace preparation；Workspace ready 后再幂等创建该 attempt 的唯一 Session。数据库事务不得跨越 Workspace 或 Runtime I/O。
2. productionStatus 与 Session.state 独立。Session failed、closed、interrupted 或 ready 均不得自动改变 Task；Task 状态迁移也不得隐式启动、停止或重试 Session。
3. 如果 Agent 退出前没有报告 blocked 或 waiting_for_review，Task 可以保持 in_progress。本期接受这一不完整信号，不由 Mystra猜测结果。
4. blocked 和 waiting_for_review 必须包含非空 note；其他迁移可选 note。每次迁移都替换当前 statusNote；未提供时投影为 null，不保留上一状态的旧说明。
5. 每次迁移使用 expectedRevision 乐观并发控制。旧 revision 返回稳定 task_status_conflict，不覆盖新状态。
6. 每次写入必须带 idempotency key。同 key 与同 payload 重放返回原结果；同 key 不同 payload 返回稳定冲突。
7. 当前投影保存在 Task；每次迁移同时追加 TaskStatusTransition，供审计和恢复当前投影。

## mystra-agent CLI Contract

Mystra 提供两个边界不同的 CLI：

- `mystra`：面向 Human、外部 Agent 和自动化，管理 Control Plane 资源；它不是任务 workload 的默认身份入口。
- `mystra-agent`：面向当前运行中的 Agent workload，只能访问 execution code 授权的 attempt。

第一版 `mystra-agent` 开放身份、执行上下文、Task 状态读取和受控迁移：

    mystra-agent whoami
    mystra-agent context get
    mystra-agent task status get
    mystra-agent task status set blocked --expected-revision 3 --idempotency-key cmd-101 --note "Waiting for API contract"
    mystra-agent task status set in_progress --expected-revision 4 --idempotency-key cmd-102 --note "Contract received"
    mystra-agent task status set waiting_for_review --expected-revision 5 --idempotency-key cmd-103 --note "PR: ...; tests: ..."

Runtime 至少注入 `MYSTRA_CONTROL_PLANE_URL` 与 `MYSTRA_EXECUTION_CODE`。execution code 是一次 Harness/Session attempt 的短期、可吊销 capability，绑定准确 Team、Task、Harness、Session 和冻结 Agent revision；它不是 Agent 的长期身份 code，也不得出现在 system prompt、普通日志、状态 note 或明文持久化中。`mystra-agent` 不接受任意 Task ID。

`context get` 返回 schema-versioned `TaskExecutionContext`，至少包含 execution identity、冻结的 Task title/description 与 exact Issue reference、Project repository identity 与 configured base branch、Workspace root/working branch，以及当前允许的 CLI capabilities。它不得复制 Linear Issue body，不得返回 GitHub/Linear credentials、Project Integration secret 或其他 secrets。

`task status` 只能调用专用 TaskStatusService.transition，不复用人类 Task PATCH。输出为稳定 JSON，至少包含 taskId、productionStatus、statusRevision、statusUpdatedAt 和 transitionId。错误至少区分 invalid_transition、task_status_conflict、missing_status_note、scope_mismatch 和 capability_expired。

Agent 拿到 exact Linear Issue reference 后，使用宿主机本地、已认证的 `linctl` 获取当前需求；完成代码与自测后，使用宿主机本地、已认证的 `gh` 推送分支并创建 PR。Mystra 不代理这些 CLI、不向它们兑换凭据、不查询 PR，也不验证自测。若任一工具缺失、未认证或不可执行，Agent 应通过 `mystra-agent task status set blocked` 报告原因；平台不回退到 Project Integration credential 或 RepoDeliveryProvider 代为完成。

Agent note 是不可信文本。即使包含 PR URL、commit SHA 或测试结果，Mystra 也只保存并展示为 “Agent reported”，不连接 GitHub、不运行命令、不做结果验真。

## User Scenarios & Testing

### User Story 1 - Assign Agent 开始生产 (Priority: P1)

作为 Team 操作者，我希望为 pending Task 分配 Agent 后自动开始一个生产 attempt，以便 Task 明确进入 in_progress 并启动唯一 Autopilot Session。

**Independent Test**: 对 eligible Task 执行 Assign/Start，验证短事务原子创建状态迁移与 Harness；随后 Workspace ready 事件只触发一个 Session，重复命令或事件不产生重复对象。

**Acceptance Scenarios**:

1. **Given** pending Project-bound Task 和同 Team active Agent，**When** 操作者 Assign/Start，**Then** Task 与冻结 Agent revision 的 Harness 在同一短事务中创建，Task 进入 in_progress，提交后开始 Workspace preparation。
2. **Given** Workspace 随后 ready，**When** launch continuation 被触发或重放，**Then** 该 Harness 幂等获得恰好一个 Session。
3. **Given** 同一 Assign/Start 命令被重放，**When** 服务处理，**Then** 返回同一 transition 和 Harness，不创建重复 Workspace 或 Session。
4. **Given** Task 非 pending、Project 不可交付或 Agent 无效，**When** Assign/Start，**Then** fail closed 且不留下部分 Task/Harness 状态。

### User Story 2 - Agent 报告生产状态 (Priority: P1)

作为被分配 Agent，我希望只凭当前 attempt 的 execution code，通过 `mystra-agent` 获取身份、Task、Project、Issue reference 和 Workspace 信息并更新当前 Task 状态，以便用标准 bootstrap prompt 开始工作，同时继续使用本地 `linctl` 与 `gh` 完成外部读取和 PR 交付。

**Independent Test**: 仅注入 Control Plane URL 与 execution code，验证 Agent 无需 Task ID 即可取得 `TaskExecutionContext`；随后用 fixture `linctl`/`gh` 完成读取与 PR 创建，并依次执行 in_progress → blocked → in_progress → waiting_for_review，验证 revision、note、actor 和 transition history。

**Acceptance Scenarios**:

1. **Given** Runtime 注入有效 execution code，**When** Agent 执行 `mystra-agent whoami` 和 `context get`，**Then** 返回当前 attempt 的身份与完整执行上下文，不要求或接受 Task ID。
2. **Given** context 含 exact Linear Issue reference，**When** Agent 读取需求，**Then** 使用本地 `linctl`；Mystra 不复制 Linear body 或代理调用。
3. **Given** Task 为 in_progress，**When** Agent 带 note 设置 blocked，**Then** 状态和审计记录原子更新。
4. **Given** Task 为 blocked，**When** 同一 Agent 设置 in_progress，**Then** 生产恢复，Session 是否继续由执行层独立决定。
5. **Given** Agent 完成代码与自测，**When** 它使用本地 `gh` 创建 PR 并带交付说明设置 waiting_for_review，**Then** Mystra 只保存未验证声明，不创建、不查询或验证 PR 和自测。
6. **Given** `linctl` 或 `gh` 缺失或未认证，**When** Agent 无法继续，**Then** Agent 报告 blocked，Mystra 不提供 Integration credential fallback。
7. **Given** Agent 尝试设置 done、canceled、pending、指定其他 Task ID 或修改其他 Task 字段，**When** CLI 处理，**Then** 拒绝请求。

### User Story 3 - 人工收口或退回 (Priority: P1)

作为 Reviewer，我希望确认 Agent 声明后把 Task 标记 done，或退回 in_progress，以便业务完成权仍属于人。

**Independent Test**: 从 waiting_for_review 分别执行 done 与 in_progress，并验证 actor 权限和审计记录。

**Acceptance Scenarios**:

1. **Given** waiting_for_review Task，**When** Human 接受结果，**Then** Task 进入 done。
2. **Given** waiting_for_review Task，**When** Human 要求修改，**Then** Task 进入 in_progress；是否启动新 Session 不由该迁移隐式决定。
3. **Given** 任意非终态 Task，**When** Human 取消，**Then** Task 进入 canceled。
4. **Given** done 或 canceled Task，**When** 任意调用方请求迁移，**Then** 第一版返回 invalid_transition。

### User Story 4 - 状态与 Session 可分别观察 (Priority: P2)

作为操作者，我希望同时看见 Task productionStatus 和最新 Session.state，以便区分业务进度与进程运行情况。

**Independent Test**: 构造 Session failed 但 Task in_progress，以及 Session ready 但 Task blocked；验证系统不自动同步两者。

**Acceptance Scenarios**:

1. **Given** Session failed，**When** Agent 未更新 Task，**Then** Task 保持 in_progress。
2. **Given** Task blocked，**When** Session state 变化，**Then** Task 不被自动修改。
3. **Given** waiting_for_review note 包含 PR 和 tests，**When** 页面或 API 展示，**Then** 明确标识为 Agent reported / not verified by Mystra。

### Edge Cases

- 两个 Agent 命令使用同一 expectedRevision 时只有一个成功。
- 过期 Harness、Session 或 Agent revision 的 capability 不得更新新 attempt 的 Task。
- CLI 网络超时后可用同 idempotency key安全重试。
- Session 崩溃且 Agent 未能发出 blocked 时，Task 保持 in_progress。
- 外部 Issue 被关闭、重开或改状态时，productionStatus 不自动变化。
- waiting_for_review 的 URL 无效或测试说明虚假时，Mystra 仍只保存声明；人工 Reviewer 决定后续状态。
- execution code 过期、吊销、泄漏到错误 attempt 或 scope 不匹配时，`mystra-agent` fail closed，不返回任何 Task/Project/Workspace context。
- `linctl` 或 `gh` 不在 PATH、未认证或返回错误时，不改变 Mystra 的外部 Integration；Agent 可报告 blocked，平台不静默切换凭据或 delivery provider。
- Workspace preparation 失败时 Harness 保留可诊断事实，Task 可继续保持 in_progress；Mystra 不根据基础设施失败猜测业务状态。

## Requirements

### Functional Requirements

- **FR-001**: Task MUST 增加 Mystra-owned productionStatus，取值仅为 pending、in_progress、blocked、waiting_for_review、done、canceled。
- **FR-002**: 新 Task MUST 初始化为 pending。
- **FR-003**: Task productionStatus MUST 与外部 Issue status、Session.state 和 Harness attempt outcome 分离，不进行自动映射。
- **FR-004**: 第一版 MUST NOT 提供 Task failed 状态。
- **FR-005**: Assign/Start 的短 RDB 事务 MUST 原子执行 pending → in_progress 并创建一个 Harness attempt；事务提交后 MUST 请求 Workspace preparation，Workspace ready 后 MUST 幂等创建该 attempt 的唯一 Autopilot Session，且事务不得跨越 Workspace 或 Runtime I/O。
- **FR-006**: Harness MUST 冻结 Agent revision 并关联 Task、Workspace 和一个 Session，但 MUST NOT 拥有平行生产状态机。
- **FR-007**: Agent 只可请求 in_progress → blocked、blocked → in_progress、in_progress → waiting_for_review。
- **FR-008**: Human 只可按本规格执行 waiting_for_review → done、waiting_for_review/blocked → in_progress，以及任意非终态 → canceled。
- **FR-009**: done 和 canceled MUST 为第一版终态。
- **FR-010**: blocked 与 waiting_for_review 迁移 MUST 要求非空 note。
- **FR-011**: 所有 productionStatus 迁移 MUST 使用专用 TaskStatusService；Agent 尤其不得复用允许编辑 title/description 的通用 Task PATCH。
- **FR-012**: `mystra-agent` execution capability MUST 绑定准确 Team、Task、Harness、Session、Agent ID/revision，且 CLI 不得接受任意 Task ID 越权寻址。
- **FR-013**: 每次状态迁移 MUST 使用 expectedRevision 并返回稳定冲突错误。
- **FR-014**: 每次状态迁移 MUST 支持 idempotency key；相同 key/payload 重放返回同一结果。
- **FR-015**: Task MUST 保存当前状态投影、statusRevision、当前 transition 的 statusNote、statusUpdatedAt 和最后 actor summary；新迁移无 note 时 statusNote MUST 清为 null。
- **FR-016**: 每次成功迁移 MUST 原子追加不可变 TaskStatusTransition，记录 transitionId、taskId、from、to、revision、actor、可选 Agent/Harness/Session identity、note、idempotency identity 和 occurredAt。
- **FR-017**: `mystra-agent` MUST 提供 `whoami`、`context get`、`task status get` 和 `task status set`，输出稳定 machine-readable JSON；`mystra` MUST 保留为独立的 Control Plane 管理 CLI。
- **FR-018**: CLI 错误 MUST 至少区分 invalid_transition、task_status_conflict、missing_status_note、scope_mismatch 和 capability_expired。
- **FR-019**: Session state 变化 MUST NOT 自动改变 productionStatus；普通 productionStatus 迁移 MUST NOT 隐式控制 Session。
- **FR-020**: Agent 未报告最终状态时，Mystra MUST 允许 Task 保持 in_progress，不根据 Session 文本、exit code 或事件推断结果。
- **FR-021**: Agent note 中的 PR、commit 和自测信息 MUST 标识为未验证 Agent 声明；Mystra 本期 MUST NOT 查询 PR、运行测试或验证证据。
- **FR-022**: Issue Provider MUST 保持 read-only；productionStatus 更新不得回写外部 Issue。
- **FR-023**: 状态读取、迁移和历史 MUST 受 Team authorization、字段级 allowlist、有界文本和敏感信息清理约束。
- **FR-024**: Runtime MUST 通过 `MYSTRA_CONTROL_PLANE_URL` 和 `MYSTRA_EXECUTION_CODE` 向 workload 注入连接信息；execution code MUST 短期、可吊销、attempt-scoped，且 MUST NOT 出现在 prompt、普通日志、状态 note 或明文持久化中。
- **FR-025**: `context get` MUST 返回 schema-versioned `TaskExecutionContext`，包含 execution identity、冻结 Task 输入、exact Issue reference、Project repository identity/configured base branch、Workspace root/working branch 与允许的 capabilities；MUST NOT 返回 Linear body、Integration credentials 或 secrets。
- **FR-026**: 第一版 Agent MUST 使用宿主机本地、已认证的 `linctl` 读取 Linear，并使用本地、已认证的 `gh` 推送和创建 PR；Mystra MUST NOT 代理、授权、查询或验证这些操作。
- **FR-027**: `linctl` 或 `gh` 缺失、未认证或失败时，平台 MUST NOT 回退到 Project Integration credential 或 RepoDeliveryProvider；Agent MAY 将 Task 报告为 blocked。

### Key Entities

- **Task**: Team-scoped 基本生产任务，保存 requirement context 和当前 production status projection。
- **TaskStatusTransition**: append-only 状态迁移事实，用于审计、幂等、冲突诊断和投影恢复。
- **Harness Attempt**: 一次生产归因 identity，冻结 Agent revision，关联一个 Session；第一版不拥有独立状态机。
- **Session**: Agent 的执行会话，拥有自己的 execution state；不代表 Task 业务状态。
- **TaskExecutionContext**: `mystra-agent context get` 返回的版本化、最小充分执行上下文；包含当前 attempt 的身份、冻结需求引用、Project/Workspace 信息和允许能力，不包含外部系统正文或凭据。
- **Execution Capability**: Runtime 注入的短期、可吊销、最小权限 execution code，只允许当前 attempt 读取上下文和申请合法 Task 状态迁移。

## Assumptions & Dependencies

- 第一版仍为一个 Harness attempt 启动一个 goal/autopilot Session。
- Assign Agent 后立即 Start；自动分诊和独立 Start UI 不在本期。
- 现有 Task Context、Workspace、Session launch、Runtime/Provider 和 Agent revision 合同可复用。
- 第一版目标环境为 host Runtime；Provider 进程继承同一操作系统用户可用的 PATH 与本地 CLI 登录态。
- `linctl` 与 `gh` 已安装、可执行且预先认证，是该自用 MVP deployment 的运行前提，不由 Mystra 配置或托管。
- 内置 Agent 的标准 bootstrap prompt 只需要求：先调用 `mystra-agent context get`，再按 Issue reference 使用 `linctl`，在提供的 Workspace/branch 内改码和自测，使用 `gh` 创建 PR，最后通过 `mystra-agent` 报告 waiting_for_review 或 blocked。
- 项目处于 pre-0.1；本功能直接替换旧的“Task 无生产状态”开发合同，不增加兼容别名或迁移 shim。

## Deferred / Out of Scope

- Mystra 验证 PR、commit、自测证据或执行质量门禁。
- 通用 Artifact/Delivery 提交、非 PR 产出物和多类型流水线。
- 多 Session Harness、心跳、事件订阅、自动恢复、自动 Retry 和等待条件。
- Production Recipe、Skill/Workflow 自动选择、任务分诊、需求审查和多 Agent 协作。
- Agent 创建/编辑 Task 需求字段、选择任意 Task 或人工完成/取消 Task。
- 由 Mystra 代理 `linctl`/`gh`、托管其用户凭据、用 Project Integration credential 代替本地 CLI，或让 workload CLI 管理任意 Control Plane 资源。
- done/canceled reopen、外部 Issue write-back、PR merge、部署与发布。

## Success Criteria

- **SC-001**: 100% 新 Task 初始化为 pending；Assign/Start 原子产生 in_progress 与唯一 Harness，Workspace ready 后幂等产生该 Harness 的唯一 Session。
- **SC-002**: Agent 的所有允许和禁止迁移均由一张确定性 transition table 判定；非法迁移无状态副作用。
- **SC-003**: 对同一 revision 的 20 个并发迁移请求，最多一个成功，其余返回 task_status_conflict。
- **SC-004**: 同一 idempotency key/payload 重放 20 次只产生一个 TaskStatusTransition。
- **SC-005**: Agent capability 无法设置 done/canceled/pending，也无法更新 title、description、Project 或 Issue context。
- **SC-006**: Session 的任意状态变化都不会自动改变 productionStatus。
- **SC-007**: waiting_for_review 展示中的 PR 和测试信息 100% 标识为 Agent reported / not verified by Mystra。
- **SC-008**: Owner 可从 Task 详情和 CLI/API 一致看到当前 productionStatus、revision、note、actor、最新 Session.state 和迁移历史。
- **SC-009**: 仅凭一个有效 execution code，Agent 可在不提交 Task ID 的情况下取得唯一 `TaskExecutionContext`；跨 Task、过期或吊销 code 100% fail closed。
- **SC-010**: fixture host 环境中，Agent 可通过本地 `linctl` 读取 exact Issue、通过本地 `gh` 创建 PR 并报告 waiting_for_review；Mystra 的记录中不存在外部 CLI 凭据、代理调用或 PR/self-test 验真结果。
