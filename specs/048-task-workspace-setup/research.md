# Research: Task Workspace Setup

## Existing-system findings

- `RepoProvider` 当前只有 repository list/get；GitHub 是 repository provider，Linear 只有 Issue provider。
- `IssueProvider` 当前只有 issue list/get；GitHub 与 Linear 都实现它。
- `RdbProvider` 已持有 Project、Task、Runtime persistence contract，但没有 TaskWorkspace 或 preparation attempt。
- `apps/runner-daemon` 当前只负责注册、Provider discovery/report 与 heartbeat；README 明确说明它不 claim 或执行 Session。
- 当前代码没有 Task Workspace materialization flow。唯一可见 clone 脚本不构成 Runtime capability。
- Project schema、Prisma 和 update contract 已有 `repositoryBaseBranch`。040 data model 明确它是普通用户配置，而不是 Provider default branch 镜像；标准 Git remote inspection 可读取 symbolic `HEAD`、`refs/heads/*` 与 exact commit，无需扩展 provider-specific branch API。
- Git 官方 `git-ls-remote` 合同确认：`--symref` 可读取 remote `HEAD` 指向，`--heads`/ref patterns 可读取 branch refs，`--exit-code` 在 exact ref 无匹配时返回状态 2。Git protocol 不提供 Project picker 的 cursor pagination，因此 pagination 必须是 Mystra 对有界 ref advertisement 的本地投影。来源：[git-ls-remote documentation](https://git-scm.com/docs/git-ls-remote)。

## GitNexus evidence

- 索引基于当前 `main` commit，未发现现成 Workspace execution flow。
- `RepoProvider`: MEDIUM，19 个受影响符号、6 个 direct dependents；因此 048 保持其 list/get 合同不变，不为标准 Git branch 操作制造无意义的 adapter blast radius。
- `IssueProvider`: MEDIUM，25 个受影响符号、7 个 direct dependents。
- `TaskService`: MEDIUM，13 个受影响符号、5 个 direct dependents，并触及 Issue-to-Task 与 MCP flows。
- `RdbProvider`: HIGH，20 个 direct importers；任何实现必须先扩展 contract tests 和所有 mocks。
- 最新 context 复核确认 Repo/Issue 接口无 workspace policy methods，runner 无 claim flow，RDB 只有单一 `PrismaRdbProvider` implementation，但有大量 direct consumers。

## Decisions

### D1. Task owns the durable Workspace identity

**Decision**: 新增 `TaskWorkspace`，以 `taskId` unique 强制 `1 : 0..1`。048 只向后续消费者解析 attachment，不创建 Session，也不拥有 049 的 attachment persistence。

**Why**: 用户要求 setup 在 Session 之前发生，并让多个 Session 共享同一目录。把它建模为 SessionWorkspace 无法表达 setup-before-session。

**Rejected**: 在 Task 上直接加 `workspacePath`。这会泄漏 host path、混合领域与 Runtime 状态，并无法表达准备状态/provenance。

### D2. Standard Git reads repository refs; Integration RepoProvider remains unchanged

**Decision**: `RepoProvider` 继续只负责 repository list/get/identity。平台新增 provider-neutral `GitRemoteRepositoryReader`，通过标准 Git 协议读取 symbolic `HEAD`、branch refs，并把配置 branch 解析为 exact commit；`IssueProvider.resolveWorkspaceBranch` 只返回工作分支 decision。只有 Runtime materializer 创建本地 clone/worktree。

**Why**: Git ref 读取不是 GitHub 或 GitLab 的专属能力。保持 Integration identity/credential、标准 Git remote 操作、Issue naming 和 Runtime filesystem 四个 ownership seams，避免每个 adapter 重写相同 Git 语义。

**Rejected**: 给 `RepoProvider` 添加 `listBranches`/`resolveWorkspaceBase`，或让 GitHub adapter 直接 clone。前者复制标准 Git 协议并扩大现有 Integration blast radius；后者绕过 Runtime capability 与 host isolation boundary。

### D3. Manual fallback belongs to TaskWorkspaceService

**Decision**: 无 Issue 时使用 `mystra/task-<task-short-id>`；有 Issue 但 provider 失败时 fail closed。

**Why**: Issue provider 不应为不存在的 Issue 伪造策略；fallback 是 Mystra Task policy。

### D4. Project config selects branch; standard Git freezes exact commit

**Decision**: Project 持久化普通 `repositoryBaseBranch` 配置。Project branch API 通过一次有界的标准 Git ref advertisement 读取 remote branches 和 symbolic `HEAD`，再在 control plane 中 filter/paginate；读取失败时设置可退化为 branch 文本输入。Setup 使用同一通用边界权威解析 canonical ref/exact commit；TaskWorkspace 持久化配置值与解析结果，Runtime 从 exact commit 创建工作分支。

**Why**: 用户需要稳定控制工作从哪个分支开始，而 Provider default branch 仍是可变观察值。配置值表达意图，exact commit 提供可复现历史。

**Rejected**: 每次 Setup 都跟随 Provider default branch；这会让 Project 设置失效并让相同 Task 在不同时间悄悄选择不同基线。也拒绝把 branch list 读取失败当成 setup fallback：普通文本配置可以保存，但不存在的 branch 仍必须在 Setup 时失败。

### D5. Outbound claim/report protocol with fencing

**Decision**: runner 轮询 Workspace preparation claim；RDB transaction 产生 attempt/lease；报告必须携带 workspaceId、attemptId 与 attempt sequence。旧 attempt 返回 conflict，不覆盖状态。该 lease 只用于 materialization fencing 与 retry，不是 Session claim、Runtime slot、capacity 或执行占用。

**Why**: 延续 044 host Runtime outbound 模型，并处理超时重试后的晚到结果。

**Rejected**: control plane 直接 SSH/HTTP 调 host。它改变 enrollment/network boundary，并引入未授权 inbound surface。

### D6. Opaque Workspace reference

**Decision**: runner 返回如 `host-task-workspace:<workspace-id>` 的 provider-neutral reference；绝对路径只由该 Runtime 本地 resolver 持有。

**Why**: 防止路径泄漏并保持未来其他 Runtime implementation 可替换。

### D7. Dedicated Task directory; optional cache remains private

**Decision**: host MVP 为每个 TaskWorkspace 发布一个专属 working clone/worktree directory。是否使用 bare mirror/cache 是 Runtime 私有优化，不进入 RDB 或 API。

**Why**: Task 之间仍应隔离；用户只取消同一 Task 的 Session 隔离。

### D8. Shared mutable Session semantics

**Decision**: 所有 Task Session 使用同一 ref，不 snapshot、不 reset。048 不定义、持久化或限制 Runtime capacity/slot，也不加目录锁；是否重叠执行由后续 execution contract 决定。

**Why**: 这是 owner 明确选择。自动序列化会额外改变调度合同，自动隔离则直接违背选择。

### D9. Credential handling is transient, not magically short-lived

**Decision**: hosted App 可提供短期 token；self-hosted PAT 是长期 secret，但只在 runner-authenticated claim response 中 just-in-time resolve、仅内存使用并 redacted。两者不互相 fallback。

**Why**: 声称 PAT 被“变成短期 credential”属于令人愉快但错误的安全叙事。真实约束是最短暴露窗口和不持久化。

### D10. Direct pre-0.1 contract replacement

**Decision**: 不保留旧 Session-only workspace alias、dual-read 或迁移 shim。更新 schema、callers、fixtures、5xP 与 constitution；本地开发数据可按当前 policy 重建。

**Why**: 项目版本仍低于 0.1，durable policy 明确禁止兼容层。

### D11. Feature order

**Decision**: `048-task-workspace-setup` → `049-session-launch-framework` → `050-task-session-experience`。

**Why**: 049 需要消费 Workspace attachment，050 需要消费 048 状态和 049 launch；反序会迫使草案各自发明临时合同。

049 的 launch ownership 是明确边界：在一个原子 transaction 中创建 Session、解析全部输入、拼接 system prompt 与第一条 user message，再通过选定 Provider 发起执行。048 不创建 initial `turnId`，也不为它提供兼容层。

## Open implementation checks (not product clarifications)

- Git availability/version probe 与 cross-platform atomic rename behavior。
- Runtime 与 control-plane Git 可执行文件的最低受支持版本及 version probe。
- Workspace preparation 与未来 Session execution 可以复用通用 outbound HTTP client/polling utility，但不得复用 claim state、lease 或 capacity 语义。
- branch slug 的 provider-specific normalization fixtures 和最大长度。
- UI prototype 由 048 提供最小 panel，还是与 050 共用一个独立 artifact；进入 tasks 前必须锁定。
