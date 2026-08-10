# Feature Specification: Task Workspace Setup

**Feature Branch**: `048-task-workspace-setup`
**Created**: 2026-08-10
**Status**: Approved for implementation
**Input**: 为 Task 提供显式的 Setup Workspace 动作，由 Project 的标准 repository 配置选择基线、通用 Git 能力读取和解析远端 branch、Issue 能力决定工作分支名、Runtime 准备本地仓库或 worktree；当前 048/049/050 只支持 Task-bound Session，并共享该 Task Workspace。

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 为 Task 准备可执行 Workspace (Priority: P1)

操作者先在 Project 中配置默认基线分支，再在带该 Project 的 Task 上发起 **Setup Workspace**。Mystra 使用 Project 已绑定的 repository connection、repository external ID 和 `repositoryBaseBranch`，通过标准 Git 协议读取远端 branches、验证配置分支并解析 exact commit；Issue 能力提供工作分支名策略，选定 Runtime 在本机准备唯一 Task Workspace。准备成功后，Task 显示可执行状态、固定 Runtime、配置基线分支和工作分支，不要求操作者输入 clone URL、本地路径或临时 Git ref。

**Why this priority**: 没有可验证的本地仓库与分支，Task 无法进入后续 Session 执行。这是 repository、Issue 与 Runtime 三类能力真正打通的最小闭环。

**Independent Test**: 创建一个绑定 Project 与 Issue 的 Task，使用标准 Git branch 读取选择 Project 基线，再执行 Setup Workspace，验证只生成一个 ready Task Workspace；其基线来自 Project 配置并由 Git remote ref 解析、分支名来自 Issue 策略、物理目录由 Runtime 返回为 opaque `workspaceRef`。

**Acceptance Scenarios**:

1. **Given** Task 绑定可访问的 Project repository、Project 已配置 `repositoryBaseBranch`、Task 有 exact Issue，且目标 Runtime online 并支持 workspace materialization，**When** 操作者执行 Setup Workspace，**Then** 通用 Git repository service 通过标准 Git 协议验证配置分支并解析 exact commit，系统异步准备唯一 Task Workspace，并保存配置分支、规范基线 ref、基线 commit、工作分支名、Runtime 与 opaque workspace reference。
2. **Given** Task 绑定 Project 但没有 Issue，**When** 操作者执行 Setup Workspace，**Then** 系统使用确定性 fallback `mystra/task-<task-short-id>` 作为分支名，并完成同样的准备流程。
3. **Given** 同一 Task 的 Setup Workspace 请求被重复提交，**When** 请求意图没有变化，**Then** 系统返回同一个 Task Workspace 或同一次准备结果，不创建第二个 Workspace。
4. **Given** Task 没有 Project，**When** 操作者尝试 Setup Workspace，**Then** 系统拒绝请求并明确说明缺少 repository context，不创建 Workspace。

---

### User Story 2 - 所有 Task Session 共享同一工作目录 (Priority: P1)

操作者从已准备 Workspace 的 Task 发起多个 Session。每个 Session 都在该 Task Workspace 的同一个可变目录中工作；前一个 Session 对文件系统和工作分支的修改会被后续 Session 直接看见。系统不为这些 Session 创建隔离 clone、worktree 或子目录。

**Why this priority**: 这是用户明确选择的执行模型。它保留跨 Session 的连续工作状态，同时把 Runtime 亲和性和共享写入风险变成可见合同，而不是隐藏实现偶然性。

**Independent Test**: 对同一个 ready Task 连续解析三次 Session attachment，验证三次都得到相同的 `taskWorkspaceId/runtimeId/workspaceRef/shared-mutable`，且不会触发第二次 repository/Issue policy 或 Runtime materialization。真实 Session 对共享文件修改的观察由 049/050 跨 feature E2E 验证。

**Acceptance Scenarios**:

1. **Given** Task Workspace 为 ready，**When** 从该 Task 发起 Session，**Then** Session 必须使用 Workspace 所属 Runtime 和同一个 `workspaceRef`。
2. **Given** 同一 Task 已有多个 Session，**When** 后续 Session 启动，**Then** 它看到 Workspace 当前文件状态，而不是 Setup 时或前一 Session 启动时的快照。
3. **Given** 调用方选择了与 Task Workspace 不同的 Runtime，**When** 发起 Task Session，**Then** 系统 fail closed，不迁移、不复制 Workspace，也不静默改选 Runtime。
4. **Given** Runtime 允许多个 Session 同时执行，**When** 它们进入同一 Task Workspace，**Then** 系统明确将其视为 shared-mutable 执行，不宣称目录隔离或写入冲突保护。

---

### User Story 3 - 可诊断地处理准备失败与丢失 (Priority: P2)

当外部 repository、Issue、Runtime 或本地 Git 准备失败时，操作者能看到稳定的失败阶段与错误码。未成功准备的目录不得被标记为 ready，也不得被 Task Session 使用。

**Why this priority**: repository 和 Runtime 都是外部或主机侧能力。失败不可避免；把半成品当作可执行 Workspace 才是可避免的部分。

**Independent Test**: 分别注入 repository 无权限、非法分支名、Runtime 离线和 materialization 失败，验证 Workspace 保持非 ready、Session 启动被拒绝，并可在同一 Runtime 上重试失败的准备。

**Acceptance Scenarios**:

1. **Given** exact repository access 或标准 Git branch 解析失败，**When** Setup Workspace 执行，**Then** Workspace 进入 failed 并记录稳定错误码，不调用 Runtime materialization。
2. **Given** Runtime 在准备过程中失败，**When** 上报结果，**Then** Workspace 进入 failed，任何不完整路径都不成为可消费的 `workspaceRef`。
3. **Given** failed Workspace 且请求仍指向同一 Runtime 与相同 repository intent，**When** 操作者重试 Setup Workspace，**Then** 系统重用同一个 Workspace 身份开始新一次准备，不创建第二条关系。
4. **Given** ready Workspace 在 Runtime 上已丢失，**When** Runtime 或 Session launch 检测到该事实，**Then** Workspace 变为 unavailable，Task Session fail closed；MVP 不自动迁移或重建它。

### Edge Cases

- Project repository connection 已禁用、secret 不可解析或 repository external ID 已不可访问时，基线解析失败，不允许从其他 connection 或公开 clone URL 回退。
- Provider 的默认分支观察值变化时，不得改写 Project 的配置分支。Project `repositoryBaseBranch` 在 Setup 时解析并冻结 exact commit；之后修改 Project 设置不重写已存在（包括 failed/unavailable）的 Task Workspace。
- 读取远端 branch 列表失败时，Project 设置仍可退化为经过 Git ref 语法校验的普通文本配置；该失败不伪造空 branch 列表，也不改变已保存配置。
- Project 配置分支已在远端删除、不可访问或不能解析为 commit 时，Setup fail closed；通用 Git repository service 不得静默改用 remote symbolic `HEAD` 或 Provider 默认分支。
- Issue 被删除、归档或 provider 暂时不可用时，带 Issue 的 Task 不降级到 manual Task fallback；fallback 仅适用于 Task 原本没有 Issue。
- Issue 策略返回非法 Git ref、过长名称或保留名称时，系统在 Runtime 调用前拒绝该结果并返回稳定错误。
- 目标分支已存在但不能证明属于同一 Task Workspace，或其基线与冻结 intent 冲突时，Runtime 必须 fail closed，不覆盖现有分支。
- Setup 请求超时但 Runtime 随后成功上报时，幂等结果仍归入同一个 Workspace；过期 attempt 的上报不得覆盖更新 attempt 的状态。
- Task 的 Project 与 Issue reference 在 Task 创建后不可变；Workspace 必须保存实际使用的 repository/Issue provenance，不能在读取时拼接当前外部状态冒充历史事实。
- Runtime online 状态在 setup 前后变化时，以 claim 与最终上报为准；离线 Runtime 不接受新准备任务。
- 多个 Session 同时写同一 Workspace 时可能发生文件或 Git 冲突；本功能不提供 Session 级隔离、锁文件或自动合并。

## Requirements *(mandatory)*

### Functional Requirements

#### Task Workspace 关系与生命周期

- **FR-001**: 系统 MUST 提供 Team-scoped 的 Task Workspace，并强制 Task 与 Task Workspace 为 `1 : 0..1` 关系。
- **FR-002**: Task Workspace MUST 只通过显式 Setup Workspace 动作创建；Task 创建或更新不得隐式准备 Workspace，也不得隐式启动 Session。
- **FR-003**: Setup Workspace MUST 要求 Task 已绑定 Project；没有 Project 的 Task MUST 得到稳定的前置条件失败。
- **FR-004**: Setup Workspace MUST 接受目标 Runtime 与幂等键，但 MUST NOT 接受调用方提供的 clone URL、本地路径、base ref 或 branch name。
- **FR-005**: Task Workspace MUST 具有至少 `queued`、`preparing`、`ready`、`failed`、`unavailable` 状态；只有 `ready` 可被 Task Session 消费。
- **FR-006**: 相同 Task、Runtime 与冻结准备意图的重复请求 MUST 收敛到同一个 Task Workspace；ready 请求直接返回现有结果，failed 请求可重试同一 Workspace 身份。
- **FR-007**: ready 或 unavailable Workspace 的自动迁移、自动重建、删除与换 Runtime MUST NOT 属于本 MVP。

#### Project repository 配置、标准 Git 与 Issue 策略

- **FR-008**: 系统 MUST 使用 Project 绑定的 exact IntegrationConnection、provider-stable repository external ID 与 Project 配置的 `repositoryBaseBranch` 解析 repository，不得跨 connection 猜测或回退。
- **FR-009**: Project MUST 持久化用户可配置的 `repositoryBaseBranch`，并在 Project 创建和设置编辑中展示它。仓库选择时可以用 Provider 当前 default branch 预填，但保存后该值属于 Mystra Project 配置，不随 Provider default branch 自动变化。
- **FR-009A**: Integration `RepoProvider` MUST 保持 repository discovery/identity 边界，不得为 GitHub、GitLab 或其他 provider 分别实现 branch list、symbolic `HEAD` 或 branch-to-commit 解析。
- **FR-009B**: 平台 MUST 提供 provider-neutral 的标准 Git repository 能力，使用 exact Project repository 的临时访问材料读取 symbolic `HEAD`、读取 remote branches，并把配置的 `repositoryBaseBranch` 解析为规范 `refs/heads/*` 与 exact commit。
- **FR-009C**: canonical Project API MUST 提供可分页、可筛选的 branch 读取结果，用于 Default branch 设置；读取失败时客户端 MUST 显示失败并允许退化为普通文本配置，不得把失败解释为空列表。
- **FR-009D**: Setup Workspace 对配置分支的解析 MUST 是权威校验；分支不存在或不可访问时 MUST fail closed，不得改用 remote symbolic `HEAD`、Provider default branch 或列表中的首个 branch。
- **FR-010**: 对带 exact Issue reference 的 Task，Issue capability MUST 提供工作分支名策略；系统 MUST 保存策略来源与最终 branch name。
- **FR-011**: 对没有 Issue 的 Task，系统 MUST 使用确定性 fallback `mystra/task-<task-short-id>`；带 Issue 的 Task 在 Issue 策略失败时 MUST NOT 使用该 fallback。
- **FR-012**: 系统 MUST 在 Runtime materialization 前验证 branch name 是安全、规范且可作为 Git branch ref 的值。
- **FR-013**: Git 基线解析与 Issue 分支策略 MUST 只返回 provider-neutral 决策结果，不得泄露 provider credential、clone credential 或本地 Runtime 路径。

#### Runtime materialization

- **FR-014**: Runtime MUST 显式广告 workspace materialization capability；offline、unavailable 或未广告该能力的 Runtime 不得被选择。
- **FR-015**: Runtime capability MUST 根据已解析 repository intent 准备本地 clone 或 worktree，并以 opaque `workspaceRef` 返回结果；clone、cache 与 worktree 的物理选择由 Runtime 实现拥有。
- **FR-016**: Runtime MUST 从受信 repository credential delivery seam 获取短期访问能力；Task Workspace、事件与日志不得保存明文 token、PAT 或带 credential 的 URL。
- **FR-017**: Runtime MUST 从冻结的 exact base commit 创建或验证 Task branch；遇到无法证明安全复用的现有路径或分支时 MUST fail closed。
- **FR-018**: Runtime MUST 以 attempt-aware 协议 claim 准备任务并上报结果；过期 attempt 不得覆盖当前状态。
- **FR-019**: 系统 MUST 仅在 Runtime 确认目录、repository 与 branch 都可用后写入 `ready` 和最终 `workspaceRef`。

#### Session workspace 选择

- **FR-020**: 从 Task 发起 Session 时，Session launch framework MUST 要求该 Task 已有 ready Workspace。
- **FR-021**: Task Session MUST 绑定 Task Workspace 的 Runtime 与完全相同的 opaque `workspaceRef`；不得创建 Session 专属 clone、worktree、目录或 filesystem snapshot。
- **FR-022**: Task Workspace MUST 标记固定的 `shared-mutable` sharing mode；每个 Task Session MUST 看见 Workspace 当时的实际可变内容。
- **FR-023**: Task Session 请求指定其他 Runtime 时 MUST fail closed，不得复制 Workspace、静默切换 Runtime 或把 Project context 当作 Workspace 替代品。
- **FR-024**: Workspace sharing 不得改变 Session、Task、Project 的业务归属：Session 仍是 Team-scoped 独立对象，当前 launch 必须引用 Task；Task 仍不属于 Project。
- **FR-025**: Runtime 并发容量决定同一 Workspace 是否可能同时运行多个 Session；本功能 MUST NOT 宣称 Session 级目录隔离、写入锁或自动冲突处理。

#### 状态、权限与可观测性

- **FR-026**: Setup、读取状态与 Task Session 消费 MUST 强制 Team scope 与现有 Owner/Admin/Member 权限边界；跨 Team 的 Task、Project、Runtime、Workspace 组合 MUST fail closed。
- **FR-027**: 系统 MUST 返回稳定错误码，至少覆盖 `task_project_required`、`repository_unavailable`、`repository_branches_unavailable`、`issue_branch_unavailable`、`branch_invalid`、`runtime_unavailable`、`workspace_capability_unavailable`、`materialization_failed`、`workspace_not_ready`、`workspace_missing` 与 `workspace_runtime_mismatch`。
- **FR-028**: Workspace MUST 保留足以审计 setup 决策的 provenance：Task、Project、connection、repository external ID、Setup 时的 configured base branch、规范 base ref、base commit、可选 Issue reference、branch strategy/name、Runtime、attempt 与时间戳。
- **FR-029**: Task surface 与 canonical API MUST 展示 Workspace 状态、Runtime、branch、最近失败和可执行动作，但 MUST NOT 暴露宿主机绝对路径或 repository secret。
- **FR-030**: Task Session 的 durable launch evidence MUST 记录它附着的 Task Workspace 身份、Runtime 与 `shared-mutable` 模式；它不得声称冻结了 Workspace 文件内容。

### Key Entities

- **TaskWorkspace**: Team-scoped、由一个 Task 唯一拥有的可执行目录合同。关键属性包括 Task、Project、Runtime、状态、sharing mode、repository/Issue provenance、冻结 base ref/commit、branch name、opaque workspace reference、当前 attempt 与失败信息。
- **WorkspacePreparationAttempt**: 一次异步准备尝试，用于 claim、租约、去重和防止过期上报覆盖当前结果。它是 Task Workspace 的操作记录，不是新的顶级业务对象。
- **ProjectRepositoryConfiguration**: Project 持久化的 exact connection、repository external ID 与普通 `repositoryBaseBranch` 配置；配置不依赖某个 Integration adapter 的 branch 能力。
- **GitRemoteRepositoryReader**: 平台拥有的标准 Git protocol boundary；使用临时 access context 读取 symbolic `HEAD`、枚举 `refs/heads/*` 并把配置 branch 解析为 exact commit，不拥有 Project 配置，也不创建本地 Workspace。
- **RepositoryWorkspaceIntent**: 通用 Git repository service 根据 Project 配置解析出的 provider-neutral 输入，包含 exact connection、repository external ID、configured base branch、规范 base ref 与 exact base commit，不含本地路径或 secret。
- **WorkspaceBranchDecision**: Issue capability 或 manual Task fallback 产生的分支决策，包含 branch name、策略来源与可审计版本。
- **SessionWorkspaceAttachment**: 当前 Task-bound Session launch evidence 中对 ready Task Workspace 的引用，只包含 `taskWorkspaceId`、`runtimeId`、同一 opaque `workspaceRef` 与 `shared-mutable`。不预定义 deferred Session modes 的字段或第二种 attachment 类型。

## Assumptions & Dependencies

- feature 047 已提供 Task 的 immutable optional Project context 与 exact optional Issue reference；本功能不改变 Task 的业务归属。
- feature 044 已提供 Runtime enrollment、online 状态与 capability advertisement；本功能扩展新的 workspace materialization capability，但不重新定义 Runtime 注册。
- 顺延后的 feature 049 负责仅限 Task-bound 的 canonical Session launch；本功能定义其必须消费的 ready Task Workspace attachment contract。
- 顺延后的 feature 050 负责 Task 详情中的完整 Session 发起与历史体验；本功能提供 Setup Workspace 动作、状态与最低可用展示合同。
- Project repository identity/credential 与 Issue provider 必须可从 Project/Task 的稳定引用解析；remote branch 读取和解析使用通用 Git protocol boundary，不进入 Integration-specific provider API。
- MVP 默认在一个 Runtime 主机上维持 Task Workspace；跨 Runtime 复制、共享文件系统与灾备不在此合同中。

## Out of Scope

- Session 级 Task Workspace 隔离、每 Session worktree、自动 merge、文件锁与并发冲突修复。
- ready/unavailable Workspace 的自动迁移、自动重建、删除、归档、磁盘配额和垃圾回收。
- repository push、PR 创建、review delivery 和 Issue write-back。
- Setup Workspace 调用方提供 clone URL、本地目录、base branch、commit 或工作 branch name；Project Default branch 的普通配置入口不属于该禁止项。
- repository metadata cache、webhook 同步、Provider default-branch 观察值持久化和外部 repository 状态镜像；Project 的普通 `repositoryBaseBranch` 配置与即时 Git branch 读取明确属于范围内。
- Project-only Session，以及既无 Task 也无 Project 的 standalone Session；未来支持时必须复用同一 Workspace/attachment contract，不得预建平行 Workspace 类型。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 对同一 Task 连续或并发提交 20 次相同 Setup Workspace 请求，最终恰好存在 1 个 Task Workspace 和 1 个可消费的 ready 结果。
- **SC-002**: 对一个 ready Task 连续解析至少 3 次 Session attachment，所有结果使用相同 `taskWorkspaceId`、Runtime、`workspaceRef` 与 `shared-mutable`，且 048 不产生第二次 materialization；049/050 的跨 feature E2E 再验证 Session 对共享文件修改的观察。
- **SC-003**: repository、Issue、Runtime 与 materialization 四类注入失败均在 1 次请求内返回可区分的稳定状态或错误码，且 0 个失败结果被标记为 ready。
- **SC-004**: 100% 的 ready Workspace 都能追溯到 exact Project connection、repository external ID、Setup 时的 configured base branch、规范 base ref、base commit、branch strategy/name 与 Runtime，且持久化和用户可见输出中不含 repository secret 或宿主机绝对路径。
- **SC-005**: 对同一私有 repository，Project branch API 通过标准 Git 协议返回 remote branches 与 symbolic `HEAD`；禁用 branch 读取时设置界面可保存合法文本配置，而 Setup 对不存在的配置 branch 仍 100% fail closed。
- **SC-006**: 对 SQLite 与 PostgreSQL/Supabase-backed PostgreSQL 执行同一 contract test suite，Task `1 : 0..1` 唯一性、状态转换、幂等与 Runtime 亲和性结果一致。
- **SC-007**: 所有 Task-bound Session 在 Workspace 非 ready、missing、Runtime offline 或 Runtime mismatch 时均 fail closed；测试中不存在静默 Runtime fallback、目录复制或替代 Workspace。
