# 功能规格：Task / Session 业务模型迁移

**Feature Branch**: `038-task-session-model`
**Created**: 2026-08-03
**Status**: Draft
**Input**: 用户要求将 `Job` 全部替换为 `Task`、将 `Run` 全部替换为
`Session`；一个 Task 与多个 Session 保持松散一对多关系，Session 可以承载
不同子任务；Runner 是一等业务对象；`RunnerSession` 与 `RunEvent` 不是业务对象；
允许破坏性迁移且不保留兼容性；activity timeline 暂缓决策。

## User Scenarios & Testing

### User Story 1 - 以 Task 组织长期工作目标 (Priority: P1)

作为 Mystra 操作员或调用 Agent，我希望创建一个独立的 Task 来保存工作目标、
Project、Issue 来源和冻结的仓库上下文，以便业务任务不再与某一次 Agent 执行绑定。

**Why this priority**: Task 是新的核心业务入口。若 Task 仍只是旧 Job 的别名，
后续多 Session 模型没有成立的基础。

**Independent Test**: 创建一个不带 Session 的 Task，随后通过 API、CLI、MCP 和
Web 读取同一 Task；所有入口均只使用 Task 语言，并返回一致的目标与来源信息。

**Acceptance Scenarios**:

1. **Given** 一个有效 Project，**When** 操作员创建 Task，**Then** Task 获得稳定 ID，
   保存 Project、目标、来源与冻结 Repository，且可以在没有 Session 时独立存在。
2. **Given** 一个 GitHub 或 Linear Issue，**When** 调用方执行 Issue dispatch，
   **Then** 系统创建一个 Task 和它的首个 Session，Issue 身份只归属于 Task，
   Session 不复制或覆盖目标仓库。
3. **Given** 已存在的 Task，**When** 操作员读取或列出 Task，**Then** 返回内容中不存在
   Job、Run、jobId、runId 或旧兼容字段。

---

### User Story 2 - 在 Task 下创建独立 Session (Priority: P1)

作为操作员或控制 Agent，我希望在同一个 Task 下按需创建多个 Session，分别处理
实现、调查、验证或其他子任务，以便 Session 是可独立执行的工作单元，而 Task
不需要充当 workflow orchestrator。

**Why this priority**: 用户明确要求 Task 与 Session 是松散一对多，而不是把旧 Run
简单改名或限制为一次执行。

**Independent Test**: 先创建一个 Task，再为其创建三个具有不同标题、目标、Agent
或 branch 的 Session；分别执行、查询和取消其中一个 Session，其他 Session 与 Task
保持可用且状态不被连带修改。

**Acceptance Scenarios**:

1. **Given** 一个 Task，**When** 人或 Agent 创建多个 Session，**Then** 每个 Session
   只归属于该 Task，但拥有独立目标、Agent、branch、runtime、状态和 Review 结果。
2. **Given** 多个 Session 属于同一 Task，**When** 它们并行或先后执行，**Then**
   Task 不自动排序、启动、重试或聚合这些 Session，也不形成隐含 workflow graph。
3. **Given** 一个 Session 失败、取消或等待 Review，**When** 读取同 Task 的其他
   Session，**Then** 其他 Session 的生命周期不被自动改变。
4. **Given** 一个 Session 被重新执行，**When** 调用方要求再次执行该子任务，
   **Then** 创建新的 Session；旧 Session 保持不可变的执行与 Review 记录。

---

### User Story 3 - 将 Runner 作为稳定业务对象 (Priority: P1)

作为平台操作员，我希望查看稳定的 Runner 身份、能力、容量、健康状态和当前分配，
而不是查看一次连接产生的 RunnerSession，以便 Runner 重启或重新注册后仍是同一资源。

**Why this priority**: 当前 Runner 实际由临时 RunnerSession 表示，与用户确认的业务
对象模型冲突，并导致心跳连接细节泄漏到管理 API 和 UI。

**Independent Test**: 注册一个 Runner、执行心跳、重启并以同一稳定身份重新注册；
Runner ID 不变，凭据或 lease 可以更新，管理面始终只返回 Runner。

**Acceptance Scenarios**:

1. **Given** 一个已注册 Runner，**When** Runner 重新注册或更新心跳，**Then**
   稳定 Runner 身份保持不变，连接凭据、heartbeat 或 lease 只作为内部状态处理。
2. **Given** Runner claim 一个 Session，**When** 操作员查看 Runner，**Then** 可以看到
   当前容量和分配的 Task/Session 引用，但看不到 RunnerSession 业务对象。
3. **Given** Runner 超过健康阈值未上报，**When** 系统处理 stale 状态，**Then**
   只更新 Runner 健康与受影响 Session，不产生可管理的 RunnerSession 资源。

---

### User Story 4 - 完成无兼容层的统一迁移 (Priority: P1)

作为 Mystra 维护者，我希望活动产品合同、持久化、API、MCP、CLI、runner 协议、
Web 和耐久文档只使用 Task、Session 与 Runner，以便后续 Agent 不需要理解两套模型。

**Why this priority**: 用户明确允许破坏性迁移。不保留 aliases 是消除概念债务的
验收条件，而不是可选清理。

**Independent Test**: 从全新本地数据库启动完整系统，完成 Issue → Task → Session →
Runner → sandbox → Review；对活动代码和耐久文档执行精确搜索，旧业务标识符为零。

**Acceptance Scenarios**:

1. **Given** 旧开发数据库包含 jobs、runs、runner_sessions 或 run_events，
   **When** 新版本启动，**Then** 系统只对精确识别的 Mystra 数据库执行一次性重建，
   不尝试读取或迁移旧记录。
2. **Given** 调用方访问旧 API、CLI 或 MCP 名称，**When** 请求到达，**Then**
   入口不存在；系统不提供重定向、alias、双写或兼容 payload。
3. **Given** 新系统完成一次真实执行，**When** 检查业务输出，**Then** 只出现 Task、
   Session、Runner 与 Review 语义，内部连接和事件记录不作为业务资源暴露。

### Edge Cases

- Task 可以没有 Session；空 Task 不是失败状态。
- 一个 Task 可以同时拥有多个 queued、active、failed 或 waiting-for-review Session；
  Task 本身不从这些状态推导出隐藏的执行状态机。
- 创建 Session 时 Task 不存在、已不可用或 Project/Repository 快照缺失，必须失败关闭。
- 同一 Issue 的重复 dispatch 必须保持幂等，返回已存在的 Task/首个 Session，
  或给出稳定冲突；不得创建重复 Task。
- Session 只能引用一个 Task，不能在创建后移动到另一个 Task。
- 同一 Runner 重复注册时不得产生多个可见 Runner；名称或稳定身份冲突必须有确定行为。
- Runner stale 时只影响分配给它且仍 active 的 Session；其他 Task/Session 不受影响。
- 内部 Session event 写入失败不能生成半完成的业务状态变更。
- activity timeline、事件聚合、事件 ID 和面向调用方的事件 collection 本次不定义；
  后续必须通过独立规格决定。

## Requirements

### Functional Requirements

- **FR-001**: 系统 MUST 将 `Task` 定义为一等业务对象，并完全移除 `Job` 业务对象。
- **FR-002**: 系统 MUST 将 `Session` 定义为一等业务对象，并完全移除 `Run` 业务对象。
- **FR-003**: Task MUST 与 Session 保持松散的一对多关系：Task 可有零到多个 Session，
  每个 Session 必须且只能属于一个 Task。
- **FR-004**: Task MUST 保存稳定 ID、Project、工作目标、来源、可选 Issue snapshot、
  冻结 Repository snapshot、创建/更新时间与业务 metadata。
- **FR-005**: Session MUST 保存稳定 ID、Task 引用、子任务标题/目标、Agent、branch、
  resolved runtime、执行状态、可选 Runner 引用、结果、失败信息与生命周期时间。
- **FR-006**: Task MUST NOT 自动创建、排序、调度、重试、取消、完成或聚合它的
  Session；任何创建动作必须来自人、调用 Agent 或明确的 Issue dispatch 入口。
- **FR-007**: 重复执行 MUST 创建新 Session，不得覆盖旧 Session，也不得引入
  attempt 作为隐藏 Run 兼容模型。
- **FR-008**: Issue dispatch MUST 在一个一致性边界内创建或复用 Task，并创建或复用
  首个 Session；Issue identity 与 dispatch idempotency 归属于 Task。
- **FR-009**: Session MUST 继承 Task 的 Project 和冻结 Repository identity，
  MUST NOT 覆盖目标 Project 或 Repository。
- **FR-010**: Session MAY 独立选择子任务目标、Agent、branch 与允许范围内的 runtime
  override；一个 Session 的结果不得自动改变兄弟 Session。
- **FR-011**: `Runner` MUST 是稳定的一等业务对象，包含稳定 ID、唯一名称、能力、
  容量、eligibility、健康和当前分配投影。
- **FR-012**: Runner 重启或重新注册 MUST 更新同一 Runner；认证 credential、heartbeat
  与 lease MUST 是内部运行状态，不得形成 `RunnerSession` 业务对象。
- **FR-013**: 内部执行记录 MAY 持久化为 Session event，但 MUST NOT 使用
  `RunEvent` 名称，也 MUST NOT 作为独立业务资源、管理入口或产品导航出现。
- **FR-014**: activity timeline、面向调用方的事件 projection、事件 ID 与事件 collection
  MUST 保持 deferred；本功能不得顺便固化其产品合同。
- **FR-015**: canonical API MUST 提供 Task、Task 下 Session、单个 Session 与 Runner
  的创建/读取/列表及现有必要操作；不得保留 `/api/jobs` 或 Run 资源入口。
- **FR-016**: runner protocol MUST claim、观察、完成和取消 Session，并使用稳定
  `runnerId`；不得出现 jobId、runId 或 runnerSessionId。
- **FR-017**: MCP MUST 只暴露 Task、Session 与 Runner 工具；旧 Job/Run 工具名称和
  payload MUST 删除。
- **FR-018**: CLI MUST 只暴露 `tasks`、`sessions` 与 `runners`；旧 `runs` 命令、
  Job 脚本、输出 label 与兼容 alias MUST 删除。
- **FR-019**: Web MUST 将现有 Task 页面改为真实 Task 资源，并提供其 Session 列表；
  Session inspection MUST 使用 Session 语言，Runner 页面 MUST 使用稳定 Runner。
- **FR-020**: `025-webui` 的目标导航 MUST 使用 `New Task` 与
  `Recent Sessions`；不得在新 UI 文案中保留旧业务名词。
- **FR-021**: 持久化 MUST 使用 Task、Session、Runner 及内部 Session event 语义；
  旧 jobs、runs、runner_sessions、run_events schema 不得继续存在。
- **FR-022**: 本地开发数据迁移 MUST 采用精确目标识别后的破坏性重建；不得为了
  兼容旧数据保留双 schema、双读、双写或 adapter。
- **FR-023**: 活动 TypeScript/Zod 合同、API 路径、MCP、CLI、runner protocol、Web、
  测试、脚本和耐久项目文档中 MUST 不存在 Job/Run/RunnerSession/RunEvent 业务命名。
- **FR-024**: 关闭的历史 Spec-Kit artifacts 与历史 evidence MAY 保留原始术语，
  但 MUST 清楚标记为 superseded，且不得被活动代码、测试或耐久边界引用为当前合同。
- **FR-025**: Review、preview、test/build evidence 与 `waiting_for_review` MUST 归属于
  Session；Task 只通过 Session 引用访问这些结果。
- **FR-026**: Task 没有隐式执行 state machine；管理面 MAY 提供 sessionCount、
  activeSessionCount 或 latestSession 摘要，但这些只是 projection，不是 Task 状态。
- **FR-027**: 迁移 MUST 保持 GitHub/Linear Integration、remote Repository snapshot、
  Docker sandbox、Agent adapter、secret hygiene 与 Review delivery 的现有产品边界。

### Key Entities

- **Task**: 长期业务工作容器。拥有 Project、来源/Issue、高层目标、冻结 Repository
  与 metadata；可以独立存在，不拥有执行状态机。
- **Session**: Task 下的独立子任务与 Agent 执行单元。拥有自己的目标、Agent、branch、
  runtime、state、Runner assignment、result 与 Review evidence。
- **Runner**: 稳定的执行资源。拥有身份、能力、容量、eligibility 和健康投影；连接凭据
  与 heartbeat/lease 是内部属性。
- **SessionEvent**: Session 执行中的内部事实记录。它支持状态转换和诊断，但不是业务
  资源；本功能不定义 activity timeline 或公开事件合同。
- **TaskSessionSummary**: 可选管理投影，提供 Session 数量或最新 Session 摘要，
  不形成 Task 状态机。

## Assumptions

- Task 固定一个 Project 和 Repository context；不同 repository 的工作使用不同 Task。
- Session 的 branch 与 Review artifact 独立，因此同 Task 多 Session 可以形成不同 PR。
- 本次不增加 retry API；未来所谓 retry 仍表现为显式创建新 Session。
- Task 的 completion/cancel/archive 产品语义暂不新增；现有取消动作迁移为取消 Session。
- 现有本地数据库是开发数据，可在精确确认文件后重建；不承诺历史数据迁移。
- UI 不新增 activity timeline；038 的 prototype 只验证对象层级和命名，不确定视觉方向。

## Explicitly Out of Scope

- activity timeline、事件详情页面、事件查询 API、事件 ID 稳定性或事件 retention 产品合同。
- Task 自动拆解 Session、自动调度、父子 Session、依赖图、workflow graph 或 standing order。
- Task 自动汇总多个 Session 结果、自动选择最佳结果或自动 merge 多个 PR。
- 新 retry API、quality-gate fix loop、callback、logs API 或 hosted multi-tenancy。
- 兼容旧 Job/Run payload、数据库记录、API、CLI、MCP tool、route 或文档 alias。

## Success Criteria

### Measurable Outcomes

- **SC-001**: 一个 Task 可在无 Session 时创建和读取，并可追加至少 10 个相互独立的
  Session，任一 Session 状态变化不会改变兄弟 Session。
- **SC-002**: 同一 Runner 在重新注册和心跳后保持一个稳定业务 ID，管理列表中不会因
  进程重启出现重复 Runner。
- **SC-003**: 从全新数据库完成一次真实 Issue → Task → Session → Runner → Review
  路径，最终 Session 进入 `waiting_for_review` 并返回 preview 与 PR evidence。
- **SC-004**: 活动代码、API、MCP、CLI、runner protocol、Web、测试和耐久边界文档的
  精确审计中，Job、Run、RunnerSession、RunEvent 及其 ID/route/alias 结果为零。
- **SC-005**: 旧 API、CLI 和 MCP 入口均不可用；不存在兼容重定向、alias、双读或双写。
- **SC-006**: 旧开发数据库只在命中精确 Mystra legacy schema 时重建；验证不会删除
  repository、workspace 或非目标数据库文件。
- **SC-007**: API、CLI、MCP 与 Web 对同一 Task、Session 和 Runner 的关键字段一致，
  所有 focused/full tests、lint、typecheck、build 与 Spec-Kit 检查通过。
