# Feature Specification: 远程仓库 Integration 与 Project 强绑定

**Feature Branch**: `037-remote-repository-integrations`
**Created**: 2026-07-25
**Status**: Ready for planning
**Repository Persistence Supersession Notice (2026-08-06)**: The remote-only selector boundary remains valid. The requirement that Project persist a complete immutable `RepositorySnapshot` is superseded by `040-prisma-rdb`: Project persists the exact IntegrationConnection plus provider-stable Repository external ID. Task repository/issue snapshots, source and objective are also removed; current Issue/Repo Info cache belongs to a later Integration specification. Job, Session and Runner persistence references here are historical; `040` excludes Session and Runner tables and they must not be used as current schema authority.
**Input**: Project 不再接受本地仓库；每个 Project 必须绑定由可扩展 RepoProvider 解析的远程 Git 仓库。当前支持 GitHub 与 Linear 两个 Integration 插件，其中 GitHub 提供 Repository 与 Issue capability，Linear 提供 Issue capability。使用全新 GitHub 测试仓库完成 E2E，不使用现有仓库。

## User Scenarios & Testing

### User Story 1 - 从 GitHub 远程仓库创建 Project (Priority: P1)

平台操作员可以通过 API、CLI 或 Web 页面浏览当前 GitHub 授权可访问的仓库，选择一个远程仓库并创建 Project。Project 保存经 GitHub RepoProvider 验证的仓库快照，而不是本地路径或任意字符串。

**Why this priority**: Project 是所有任务执行的稳定归属。若仓库身份仍由 Runner 在执行时猜测，服务端部署、权限失败与错误仓库派发都会变成同一种模糊事故。

**Independent Test**: 使用全新创建的私有 GitHub 测试仓库，通过三种入口中的任意一种创建 Project；读取 Project 时可见相同的 provider、远程身份、clone URL、默认分支与可见性。

**Acceptance Scenarios**:

1. **Given** GitHub Integration 已配置且凭据有效，**When** 操作员列出仓库，**Then** 系统返回授权账户可访问的远程仓库并支持游标分页。
2. **Given** 操作员选择 `owner/repository`，**When** 创建 Project，**Then** 系统先通过 GitHub RepoProvider 重新解析该仓库，再持久化 Project。
3. **Given** 仓库不存在、凭据无权访问或 Integration 没有 RepoProvider capability，**When** 创建 Project，**Then** 创建失败且数据库中不存在部分 Project。
4. **Given** 输入包含 `local/*`、绝对路径、`file://` 或未经 Provider 解析的远程 URL，**When** 创建或更新 Project，**Then** 输入被拒绝。

---

### User Story 2 - GitHub 与 Linear 作为可组合 Integration 插件 (Priority: P1)

平台维护者可以注册实现不同 capability 的 Integration 插件。GitHub 插件同时提供 RepoProvider 与 IssueProvider；Linear 插件仅提供 IssueProvider。核心 registry 不包含 provider-specific 分支。

**Why this priority**: “GitHub 支持仓库、Linear 支持 Issue”不是两个布尔开关，而是插件能力组合。否则增加 GitLab、GitHub Enterprise 或新的 Issue 系统时仍需修改平台核心。

**Independent Test**: 注册 GitHub、Linear 及测试替身 Integration，验证 registry 能按 capability 解析 provider；缺失 capability 返回稳定错误；增加测试替身无需修改 registry。

**Acceptance Scenarios**:

1. **Given** 默认 Integration registry，**When** 查询 descriptor，**Then** 只出现 `github` 与 `linear`，且 capabilities 分别为 `repositories + issues` 与 `issues`。
2. **Given** 一个只提供 IssueProvider 的 Integration，**When** 请求 RepoProvider，**Then** 返回 `REPOSITORY_CAPABILITY_UNAVAILABLE`。
3. **Given** 新 Provider 实现相同契约，**When** 注册到 registry，**Then** 现有 Project、Issue、Job 与 Runner 合同无需 provider-specific 修改。

---

### User Story 3 - 从 GitHub 或 Linear Issue 分派到绑定仓库 (Priority: P2)

操作员可以继续从 Linear Issue 分派任务，也可以在指定 GitHub 仓库范围内浏览、读取和分派 GitHub Issue。分派必须使用所选 Project 已冻结的 Repository snapshot，Issue 文本不能覆盖目标仓库。

**Why this priority**: Issue 是工作来源，Project repository 是执行目标。两者必须可组合，但不能互相冒充。

**Independent Test**: 在新建 GitHub 测试仓库创建一个 Issue；分别读取 GitHub Issue 与一条 Linear Issue；将 GitHub Issue 分派到对应 Project，并验证 Job、ExecutionSpec 与 Runner claim 使用同一 Repository snapshot。

**Acceptance Scenarios**:

1. **Given** GitHub IssueProvider，**When** 未提供 repository scope 就 list/get Issue，**Then** 请求被拒绝为无效请求。
2. **Given** GitHub repository scope，**When** list/get Issue，**Then** Pull Request 不会被伪装成 Issue，返回结果带有 Repository reference。
3. **Given** Linear IssueProvider，**When** list/get Issue，**Then** 现有只读行为与分页语义保持不变。
4. **Given** Issue 已选择且 Project 存在，**When** dispatch，**Then** Job 保存不可变 Issue snapshot 与 Repository snapshot；Runner 不再接受 job 级 repo override。

---

### User Story 4 - 服务端 Runner 只执行远程 Repository contract (Priority: P2)

Runner 使用已冻结的远程 Repository snapshot 克隆代码、推送分支并创建 Review。它不支持宿主机本地目录作为 Project repository，也不通过 URL hostname 临时推断 provider。

**Why this priority**: 服务端 Mystra 没有用户笔记本上的目录。保留 local 兼容字段只会把无效状态推迟到最昂贵的执行阶段。

**Independent Test**: 对新建 GitHub 测试仓库运行完整任务，验证 clone、Agent、test、build、preview、push 与 PR；静态搜索证明 Project/Job/claim 合同中没有 local repository fallback。

**Acceptance Scenarios**:

1. **Given** 一个已解析的 GitHub Repository snapshot，**When** Runner claim Job，**Then** provider 与 clone URL 直接来自冻结快照。
2. **Given** 缺失 Repository snapshot 的历史或伪造 Job，**When** Runner 处理，**Then** fail closed，不尝试本地目录或默认仓库。
3. **Given** 成功执行，**When** 创建 Review，**Then** Review provider 与 Project repository provider 一致。

### Edge Cases

- GitHub 返回空仓库、归档仓库、默认分支为空、组织仓库或分页游标时，必须维持稳定的规范化结果。
- GitHub Issues API 同时返回 Issue 与 Pull Request 时，必须过滤 Pull Request。
- Project 已绑定仓库随后被删除或权限撤销时，读取 Project 仍保留快照；需要远端操作时返回 provider 的稳定错误。
- 更新 Project repository 时必须完整重新解析并原子替换快照，不能混合旧 externalId 与新 clone URL。
- GitHub 与 Linear 的 rate limit、timeout、unauthorized 和无效响应必须映射到稳定 Integration error。
- 旧 SQLite schema 与历史数据不迁移；启动时必须检测不兼容 schema 并给出 clean-rebuild 指引，测试数据库直接重建。

## Requirements

### Functional Requirements

- **FR-001**: Project MUST 包含一个且仅一个 `RepositorySnapshot`，并且该快照 MUST 来自已注册 Integration 的 RepoProvider。
- **FR-002**: Project create/update 公共输入 MUST 使用 `RepositorySelector`，不得接受本地路径、`file://`、裸 clone URL 或旧 `repo` 字符串字段。
- **FR-003**: Project、Project view、Lane snapshot、Job、ExecutionSpec 与 Runner claim MUST 使用同一结构化 Repository snapshot；Job MUST NOT 覆盖 Project repository。
- **FR-004**: Repository snapshot MUST 至少包含 Integration 名称、provider、external ID、`owner/name`、Web URL、clone URL、默认分支、可见性与 fetched timestamp。
- **FR-005**: Integration contract MUST 支持可选 `RepoProvider` 与 `IssueProvider` capabilities；registry MUST 仅依赖 capability contract。
- **FR-006**: GitHub Integration MUST 实现 RepoProvider 的 list/get，并实现 repository-scoped IssueProvider 的 list/get。
- **FR-007**: Linear Integration MUST 保持只读 IssueProvider 的 list/get，不获得 repository capability。
- **FR-008**: 默认 registry MUST 注册且只注册 `github` 与 `linear` 两个产品 Integration。
- **FR-009**: RepoProvider 与 IssueProvider MUST 验证所有第三方响应，并将凭据、超时、限流、无权限、not found 与无效响应映射为稳定错误。
- **FR-010**: GitHub IssueProvider MUST 排除 Pull Request，并在 Issue reference 中保存 Repository reference。
- **FR-011**: Web API MUST 是 canonical implementation；CLI 与 Web UI MUST 通过相同 API 完成 Integration 浏览、Repository 浏览、Project 创建与读取。
- **FR-012**: GitHub 凭据 MUST 只从运行环境中的 `MYSTRA_GITHUB_TOKEN` 读取；Linear 凭据 MUST 只从 `LINEAR_API_KEY` 读取；响应、日志、数据库、Issue snapshot 与 evidence 不得包含 secret value。
- **FR-013**: Runner repository delivery provider MUST 与 Integration RepoProvider 分工明确：前者执行 clone/push/review，后者发现并解析远程身份；两者通过共享 Repository snapshot 对齐。
- **FR-014**: Runner MUST 根据 Repository snapshot 的 provider 选择交付实现，不得从任意 URL 或本地路径猜测 provider。
- **FR-015**: 旧 local repository 与 job-level repo override MUST 从活动 schema、API、CLI、UI、测试 fixture 与运行路径中移除。
- **FR-016**: E2E MUST 创建一个新的私有 GitHub 测试仓库和至少一个测试 Issue，不得使用 Mystra、castrel-ai 或其他现有仓库。
- **FR-017**: E2E MUST 验证 GitHub Repository list/get、GitHub Issue list/get、Linear Issue list/get、Project create/read，以及从 GitHub Issue 到等待 Review 的标准执行路径。
- **FR-018**: GitLab 不作为本次默认 Integration；契约 MUST 允许未来 GitLab 同时实现 RepoProvider 与 IssueProvider，而无需修改 Project、Job 或 Runner 的共享 schema。

### Key Entities

- **IntegrationPlugin**: 外部系统插件，拥有稳定 descriptor，并可组合一个或多个 Provider capability。
- **RepoProvider**: Integration capability，负责分页列出并按 provider-native identifier 解析远程 Git repository。
- **IssueProvider**: Integration capability，负责分页列出并读取规范化 Issue，可声明是否要求 Repository scope。
- **RepositorySelector**: Project create/update 的外部输入，只包含 Integration 与 provider-native identifier。
- **RepositorySnapshot**: Provider 解析后的不可变远程仓库事实，随 Project 与 Job execution contract 冻结。
- **Project**: 必须绑定一个 Repository snapshot，并拥有 runtime 与 Agent 默认值。
- **RepoDeliveryProvider**: Runner 侧 clone/push/review 执行边界，消费 Repository snapshot，不负责仓库发现。

## Assumptions

- 当前产品只启用 `github` 与 `linear`；GitLab 是由契约证明可扩展的后续 Integration，不在默认 registry。
- GitHub repository identifier 使用大小写保真的 `owner/name`；Issue identifier 在 GitHub Integration 中使用十进制 issue number，并配合 repository scope。
- GitHub 测试仓库默认 private，E2E 结束后保留以便用户复核，不自动删除。
- 用户已授权读取本机现有 GitHub/Linear 凭据并创建全新 GitHub 测试资源。
- 历史数据库允许清空重建，因此不提供旧 `repo` 字段的数据迁移或兼容读取。

## Success Criteria

### Measurable Outcomes

- **SC-001**: 100% 新建或更新的 Project 都能追溯到一次成功的 RepoProvider resolve，且不存在无 repository 的 Project。
- **SC-002**: 对 local path、`file://`、裸 URL、缺失 capability、无权限仓库与不存在仓库的负向测试全部 fail closed，数据库零部分写入。
- **SC-003**: GitHub 与 Linear 的 Issue list/get 契约测试及真实授权 smoke test 全部通过，GitHub Issue 结果中 Pull Request 数量为零。
- **SC-004**: API、CLI 与 Web UI 对同一 GitHub repository 和 Project 的关键字段完全一致。
- **SC-005**: 新建 GitHub 测试仓库完成一次 clone、Agent、test、build、preview、push、PR，并进入 `waiting_for_review`。
- **SC-006**: 对活动源代码、schema、API、CLI 与 UI 的精确检查找不到 Project local repository fallback 或 job-level repo override。
- **SC-007**: 新增第三个测试 Integration 时只需实现 capability 并注册，不需修改 registry、Project schema、Job schema或 Runner claim schema。
