# 功能规格：Issue 驱动的 Agent 自主执行

**Feature Branch**: `033-issue-agent-execution`
**Created**: 2026-07-23
**Status**: Partially superseded; retained for historical execution evidence
**Supersession Notice (2026-08-06)**: The direct Issue -> Agent execution direction and removal of workflow orchestration remain valid. However, this Spec's `Job`/`Run` execution-object contract, runner-capacity projection, event model, and database artifact assumptions are obsolete and MUST NOT be used for current API, persistence, Prisma, MCP, CLI, or Web design. Task remains current intent terminology, but `040-prisma-rdb` excludes Session and Runner persistence entirely; `session_events` and `artifacts` are also excluded pending separate Session, Task Activity, Runtime/Runner and Artifact specifications.
**Input**: 用户希望 Mystra 从以 `WorkflowProvider`、blueprint 和 node 为核心的编排模型，转向由 Issue 驱动、Agent 自主完成工作的直接执行模型；第一条可验证路径使用只读 Linear Integration、本机 Docker sandbox、Copilot CLI autopilot、GitHub demo repository、测试、预览和人工 Review 交接。
**Owner Story Review**: 用户已在 2026-07-23 的正式 Goal 中确认主要操作员、端到端场景、成功证据与明确非目标，因此本规格直接采用该故事集，不再重复发起一次仪式化确认。

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 从 Linear Issue 发起本机开发任务 (Priority: P1)

作为 Mystra 本机操作员，我希望通过 CLI 查看 Linear Issue、选择其中一个 Issue 并分派给指定 Project 和 Agent，以便真实需求可以直接进入 Mystra 的本机执行路径，而不需要人工复制标题、描述和标识符。

**Why this priority**: Issue 是新执行模型的入口。若 Mystra 仍然只接受人工拼装的 prompt，所谓 Issue Integration 只是一块礼貌的装饰板。

**Independent Test**: 在只配置 Linear personal API key 和控制面地址的环境中，通过 CLI 列出 Issue、读取一个 Issue，并将其分派为可查询的 Job/Run；确认 Job 保存了不可变的 Issue 引用快照。

**Acceptance Scenarios**:

1. **Given** Linear Integration 已配置且凭据有效，**When** 操作员通过 CLI 列出可用 Issue，**Then** CLI 返回标识符、标题、状态和 URL，并且结果来自与 Web API 相同的服务路径。
2. **Given** 操作员选择一个有效 Linear Issue、Project 和 Copilot Agent，**When** 操作员执行 dispatch，**Then** Mystra 创建一个 Job/Run，并保存 provider、外部 ID、identifier、标题、描述和 URL 的不可变快照。
3. **Given** Linear 返回 GraphQL `errors`、无权限或不存在的 Issue，**When** 操作员执行 list/get/dispatch，**Then** 请求失败为结构化错误，不创建部分 Job，也不把凭据或原始 Authorization header 写入输出。

---

### User Story 2 - Agent 在 Sandbox 内自主完成任务 (Priority: P1)

作为 Mystra 本机操作员，我希望 runner 直接启动 Docker sandbox 并在其中运行指定的 Copilot CLI autopilot，以便 Agent 自己拥有实现循环，Mystra 只负责执行边界、资源、安全和可观察状态，而不是在 Agent 之上运行一套 workflow graph。

**Why this priority**: 这是产品边界变更的核心。仅删除 package 名称、同时保留 blueprint/node 编排语义，只会把旧模型藏得更深。

**Independent Test**: 从一个已分派的 Issue 启动真实本机 Run；确认运行时不存在 workflow provider、blueprint 或 node 选择，Copilot CLI 使用明确版本和有上限的 autopilot，在 sandbox 内产生代码修改。

**Acceptance Scenarios**:

1. **Given** runner、Docker、Project runtime 和 Copilot 凭据可用，**When** runner claim 一个 Issue 驱动的 Job，**Then** runner 按直接生命周期准备 workspace、启动 sandbox 并调用指定 Agent，不解析任何 workflow provider、blueprint 或 node。
2. **Given** Copilot Agent 开始执行，**When** autopilot 连续工作，**Then** continuation 次数受到显式上限约束，超出上限或执行超时会产生结构化失败状态并释放 runner 容量。
3. **Given** Agent 完成实现，**When**仓库存在修改，**Then** Mystra 执行 Project 约定的 test 和 build；任一质量检查失败时不伪造成功或 Review-ready 状态。
4. **Given** `LINEAR_API_KEY`、GitHub token 和 Copilot token 可用，**When** sandbox 启动和 Agent 执行，**Then**秘密仅在需要的进程运行时环境中可用，不写入数据库、prompt、事件 payload、日志、Git remote 或 repository 文件。

---

### User Story 3 - 交付可接手的 Review 现场 (Priority: P1)

作为代码 Reviewer，我希望成功运行保留一个可访问的预览、GitHub Pull Request 和明确的 `waiting_for_review` 状态，以便我可以接手检查成果，而不必从容器日志中猜测任务是否真正结束。

**Why this priority**: Mystra 的产物不是“Agent 退出码为零”，而是人类可以审查的 repository artifact 和运行现场。

**Independent Test**: 使用私有 GitHub demo web repository 完成一次真实运行；确认测试和构建通过、preview 从宿主机可访问、branch 和 PR 已创建、sandbox 被保留，并且 Job/Run 明确进入等待人工 Review 的状态。

**Acceptance Scenarios**:

1. **Given** Agent 修改通过 test 和 build，**When** Mystra准备 Review 交接，**Then**系统启动预览、验证预览可达、推送 branch 并创建 GitHub PR。
2. **Given** PR 和 preview 均已创建，**When**机器执行完成，**Then** Run 进入 `waiting_for_review`，从 runner active capacity 中释放，但保留 sandbox、preview、PR URL 和 Review metadata。
3. **Given** preview 不可达、branch push 失败或 PR 创建失败，**When** Review 交接被评估，**Then** Run 不进入 `waiting_for_review`，并返回可定位到失败阶段的结构化结果。
4. **Given**操作员使用 CLI 等待 Run，**When** Run 到达 `waiting_for_review`，**Then** CLI 返回 Linear Issue identifier、Job/Run ID、test/build 摘要、preview URL、PR URL、container/image 和 Agent 版本信息。

---

### User Story 4 - API 与 CLI 共享同一产品真相 (Priority: P1)

作为 Mystra API/CLI 使用者，我希望 Web API 是唯一业务实现、CLI 只是同一 API 的薄客户端，以便两个入口不会在 Issue 过滤、dispatch、状态解释或错误处理上产生漂移。

**Why this priority**: “两个界面拥有相似功能”并不等于同源实现。重复逻辑通常只是在等待第一次分叉。

**Independent Test**: 对 Issue list/get/dispatch 和 Run inspect/wait 分别执行 API 与 CLI contract test；确认 CLI 请求 canonical API，且没有直接构造 Linear query、Job 或 Run 状态。

**Acceptance Scenarios**:

1. **Given** Web API 可用，**When** CLI 执行 Issue 或 Run 命令，**Then** CLI 通过 Web API 完成操作，不直接访问 Linear、SQLite 或 runner。
2. **Given** API 返回结构化成功或失败，**When** CLI 呈现结果，**Then** CLI 保留关键字段和错误码，不重新发明第二套状态语义。
3. **Given** API 不可达，**When** CLI 执行命令，**Then** CLI 明确报告控制面连接失败，不回退到隐藏的本地实现。

### Edge Cases

- Linear API key 未设置、失效、权限不足或被限流时，Issue 操作必须失败关闭，并保留 GraphQL 错误语义。
- Linear GraphQL HTTP 200 同时带 `errors` 时，响应不能被当作成功。
- Issue identifier 在当前 Integration 内不存在或解析到多个对象时，不允许 dispatch。
- Project 不存在、已归档、没有 Docker runtime、没有 GitHub repository target 或不允许 Copilot Agent 时，不允许 dispatch。
- Docker daemon、sandbox image 或指定 Copilot CLI 版本不可用时，Run 必须在启动 Agent 前失败。
- Copilot 未产生修改、返回非零、达到 autopilot continuation 上限、超时或被取消时，不允许创建成功 PR。
- test 或 build 失败时必须保留可审查 workspace 证据，但不能进入 `waiting_for_review`。
- preview 进程启动但从宿主机不可达时，不能把一个字符串 URL 当作成功证据。
- branch 已存在、PR 已存在或 GitHub API 短暂失败时，系统必须给出幂等或明确失败行为，不能静默创建重复 Review artifact。
- runner 进程在 sandbox 启动后崩溃时，持久状态必须允许操作员判断 Run 未完成；不得仅依赖容器 stdout。
- 旧数据库中存在 workflow 事件或字段时，允许清空历史开发数据并直接升级到新 schema；不得为了兼容旧数据保留 workflow abstraction、双事件合同或双状态语义。
- 任何错误、诊断或证据文件都必须对 Linear、GitHub 和 Copilot token 做完整脱敏。

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Mystra MUST 提供通用 Issue domain contract，至少包含 provider、外部 ID、identifier、title、description、URL、state 和获取时间。
- **FR-002**: Issue dispatch MUST 保存不可变的 Issue snapshot，使 Run 不依赖后续变化的远端 Issue 内容。
- **FR-003**: Mystra MUST 提供 Integration capability 模型；一个 Integration 可以暴露一个或多个明确 capability，第一项 capability 为 `IssueProvider`。
- **FR-004**: Linear Integration MUST 实现只读 `IssueProvider`，并支持 list 和 get。
- **FR-005**: Linear Integration MUST 使用运行环境中的 `LINEAR_API_KEY`；MVP MUST NOT 实现 OAuth、webhook、write-back、评论或状态修改。
- **FR-006**: Linear 请求 MUST 处理 HTTP 失败、GraphQL `errors`、partial data、限流和无效数据，并返回稳定的 Mystra error contract。
- **FR-007**: 系统 MUST 提供 canonical Web API，用于 Issue list、get、dispatch 以及 Run inspect、wait 所需的读取。
- **FR-008**: CLI MUST 仅作为 canonical Web API 的薄 HTTP 客户端；CLI MUST NOT 直接调用 Linear、SQLite、Integration implementation 或 runner。
- **FR-009**: API 和 CLI MUST 使用共享的 typed request/response schemas，并对额外字段和无效枚举值执行一致验证。
- **FR-010**: Issue dispatch MUST 显式选择 Project 和 Agent；MVP 不得从 Issue 文本隐式猜测目标 repository 或 Agent。
- **FR-011**: Issue dispatch MUST 复用 Job/Run 持久化、runner claim 和 resolved runtime contract，而不是创建平行执行系统。
- **FR-012**: 活动产品和运行时代码 MUST 移除 `apps/workflows` package、`WorkflowProvider`、`LocalWorkflowProvider`、workflow registry、blueprint、node 和 workflow-specific runtime selection。
- **FR-013**: 新执行路径 MUST NOT 产生 workflow-specific event、snapshot、management hint 或 UI projection。
- **FR-014**: Mystra core MUST 直接表达 `Job/Run → SandboxProvider → AgentAdapter → RepoProvider` 生命周期。
- **FR-015**: Mystra core MAY 在未来由 Agent plugin/hook 扩展行为，但 Codex plugin/hook MUST NOT 成为本功能实现或验收依赖。
- **FR-016**: runner MUST 在 Docker sandbox 内运行 Agent；MVP 验收不得以宿主机直接运行 Agent 替代。
- **FR-017**: Copilot Agent command MUST 使用 autopilot，并设置显式、可查询、非无限的 continuation 上限；默认验收上限为 10。
- **FR-018**: sandbox image MUST 固定 Copilot CLI 版本；最终证据 MUST 报告实际版本。
- **FR-019**: GitHub 与 Copilot secret MUST 仅以运行时环境变量或只读 secret file 注入；不得持久化明文 secret。
- **FR-020**: Agent 完成后 MUST 执行 repository/project 约定的 test 和 build；二者结果 MUST 进入结构化 Run result。
- **FR-021**: 只有存在真实 repository 修改且 test/build 通过时，系统才能继续 Review 交接。
- **FR-022**: Review 交接 MUST 启动 preview，并从宿主机验证至少一个 preview URL 可访问。
- **FR-023**: Review 交接 MUST 推送 GitHub branch 并创建或复用唯一 Pull Request。
- **FR-024**: 成功的机器执行 MUST 进入 `waiting_for_review` 状态；该状态 MUST 释放 runner active capacity，同时保留 sandbox 和 preview。
- **FR-025**: `waiting_for_review` 的持久结果 MUST 包含 Issue reference、branch、PR URL、preview URL、quality summary、sandbox reference 和 Agent execution metadata。
- **FR-026**: 失败、取消和超时 MUST 继续使用结构化状态；不得新增通用 Retry API 或日志持久化 API。
- **FR-027**: MVP 验收 MUST 使用一个私有 GitHub demo web repository，不得使用 GitLab 或 `castrel-ai`。
- **FR-028**: 系统 MUST 保存一份不含 secret 的端到端验收证据，足以复核 Issue、CLI 调用、Job/Run、sandbox、Agent、quality、preview 和 PR。
- **FR-029**: 现有 Job、Run、RdbProvider、SandboxProvider、AgentAdapter 和 RepoProvider MUST 保持为可替换合同；删除 workflow abstraction 不得把 Docker、Copilot 或 GitHub 细节泄漏进通用 Issue contract。
- **FR-030**: 本功能 MUST NOT 为旧 workflow Job/Run/event/artifact 保留读取兼容；允许删除全部历史开发数据并以新 schema 重新初始化，但删除前 MUST 精确识别本功能使用的数据库目标，不得递归或模糊删除目录。

### Key Entities

- **IssueReference**: 外部 Issue 的规范化、可展示引用，包含 provider 与远端身份。
- **IssueSnapshot**: dispatch 时冻结的 Issue 内容，用于保证 Run 的输入可追溯。
- **Integration**: 一个外部系统连接及其 capability 集合；MVP 通过进程配置注册，不提供管理 UI。
- **IssueProvider**: Integration 可选 capability，负责 list/get 外部 Issue，不负责 Job persistence。
- **LinearIntegration**: 第一项 Integration，实现只读 IssueProvider。
- **IssueDispatchRequest**: 将 Issue、Project、Agent 与 branch/Review context 绑定为新 Job/Run 的请求。
- **Job**: 用户意图和不可变执行输入的持久记录，包含 Issue snapshot。
- **Run**: 一次具体机器执行及其状态、事件、结果和 Review handoff。
- **SandboxSession**: 本机 Docker provider 启动并可保留用于预览的隔离执行现场。
- **ReviewHandoff**: test/build、preview、branch、PR 和人工接手状态的结构化结果。

## Assumptions

- 第一位操作员是当前仓库 owner，使用本机 CLI 和本机控制面。
- CLI-only 满足今晚的交互要求；不创建或修改 Web UI。
- Linear personal API key 已存在，第一版只读取当前 key 可访问的 workspace。
- GitHub demo repository 使用当前已认证的 `Arcadia822` 账户，并保持 private。
- `MYSTRA_GITHUB_TOKEN` 与 `COPILOT_GITHUB_TOKEN` 可以在进程启动时从当前 GitHub CLI credential 派生，但不能写入 repository 或 evidence。
- Docker daemon 可在本机启动；若无法启动，真实端到端验收视为未完成。
- demo repository 使用可独立 test/build/preview 的小型 web project，避免依赖 GitLab、Castrel 服务或企业网络。
- 旧 Spec-Kit workflow feature 目录作为历史记录保留；“完整移除”针对活动 product contract、package graph、runtime、event 和 projection。
- 用户已明确授权移除全部历史运行数据，因此 schema 和状态迁移不需要双读、回填或 legacy event 兼容。

## Explicitly Out of Scope

- Web UI 或页面级交互。
- Linear OAuth、webhook、write-back、comment、status transition 或 assignee mutation。
- 第二个 IssueProvider 或 Integration 管理后台。
- Codex plugin/hook 的实现、安装或运行。
- 通用 workflow DSL、workflow marketplace、quality-gate rework loop 或外部 workflow SDK。
- GitLab、`castrel-ai`、远程部署或企业网络验证。
- caller authentication、logs API、Retry API、callback URL。
- 云 sandbox、Kubernetes、生产级 secret manager 和 hosted RDB。
- 自动批准或合并 Pull Request。
- 旧 workflow Job/Run/event/artifact 的向后兼容或数据迁移。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 操作员可在 5 条以内 CLI 命令中完成 Issue list、选择、dispatch 和等待 Review 结果，不需要复制 Issue 正文。
- **SC-002**: 同一个 Linear Issue 通过 API 与 CLI 读取时，identifier、title、state 和 URL 一致；CLI 代码中不存在第二套 Linear 查询。
- **SC-003**: repository 的活动 package graph、runtime source、shared contracts 和 UI projection 中，对 `WorkflowProvider`、`LocalWorkflowProvider`、workflow blueprint 和 workflow node 的精确搜索结果为零。
- **SC-004**: 一次真实本机运行在 Docker sandbox 内使用报告版本的 Copilot CLI，并以不超过 10 次 autopilot continuation 完成代码修改。
- **SC-005**: demo repository 的 test 和 build 均通过，并在 Run result 中留下结构化通过证据。
- **SC-006**: 至少一个 preview URL 从宿主机连续两次健康检查可访问。
- **SC-007**: GitHub 上存在由该 Run 创建的 branch 和 open Pull Request，PR 可以追溯到 Linear Issue identifier 和 Job/Run。
- **SC-008**: 成功 Run 最终处于 `waiting_for_review`，runner active capacity 已释放，sandbox 仍保留且 preview 仍可访问。
- **SC-009**: evidence 中包含 Issue、CLI、Job/Run、Docker、Copilot、quality、preview 和 PR 证据，且 secret-pattern 扫描未发现 Linear、GitHub 或 Copilot token。
- **SC-010**: focused tests、`pnpm lint`、`pnpm typecheck`、`pnpm test` 和 `pnpm build` 全部通过，GitNexus change detection 与代码审查没有未解决的高优先级发现。
