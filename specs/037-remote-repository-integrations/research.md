# Research: 远程仓库 Integration 与 Project 强绑定

## Decision 1：Project 保存 Repository snapshot，而不是 URL

**Decision**: 公共 create/update 输入使用 `RepositorySelector`；Provider resolve 后保存结构化 `RepositorySnapshot`。

**Rationale**: URL 不能稳定表达 provider、external identity、default branch、visibility 与审计时间。Runner 也不应从 URL 猜 provider。

**Alternatives considered**:

- 继续保存 `repo: string` 并增加 URL regex：拒绝，仍无法证明仓库存在或授权可见。
- 只保存 GitHub numeric id：拒绝，对后续 provider 不友好，也不足以离线执行。
- Runner 每次 claim 重新查询 GitHub：拒绝，会让已提交 Job 依赖可变配置与 Control Plane 外部调用。

## Decision 2：Integration RepoProvider 与 Runner RepoDeliveryProvider 分离

**Decision**: `RepoProvider` 是 Integration capability，负责 list/get/normalize；Runner 原交付接口改名为 `RepoDeliveryProvider`，负责 push/review，并消费 snapshot。

**Rationale**: 发现与执行的凭据、生命周期和部署位置不同。把它们放在同一实例会要求 Runner 加载 Control Plane 插件，破坏 headless worker 边界。

**Alternatives considered**:

- 扩展 Runner RepoProvider 直接 list/get：拒绝，会把管理面与执行热路径耦合。
- 两边都继续叫 RepoProvider：拒绝，类型名相同但职责不同，未来 agent 会稳定地产生错误连接。

## Decision 3：GitHub Issue 必须带 repository scope

**Decision**: Issue list/get input 增加可选 `repository` scope；GitHub 要求它，Linear 不要求。dispatch 从 Project snapshot 自动提供 scope。

**Rationale**: GitHub issue number 只在 repository 内唯一。把 `owner/repo#123` 塞进通用 identifier 会污染其它 IssueProvider。

## Decision 4：Provider key 使用可验证字符串，不使用封闭 enum

**Decision**: provider/integration key 使用受限字符串 schema；默认 descriptor 仍明确为 GitHub 与 Linear。

**Rationale**: `z.enum(["github","gitlab"])` 让“可扩展”成为需要修改共享包的装饰性承诺。

## Decision 5：GitHub REST 与 Linear GraphQL 都由 Control Plane 调用

**Decision**: GitHub 使用 `MYSTRA_GITHUB_TOKEN`；Linear 使用 `LINEAR_API_KEY`。CLI/UI 只访问 Mystra API。

**Rationale**: 保持 canonical API、统一错误语义与 secret hygiene。E2E 可以临时把本机 `gh auth token` 注入 `MYSTRA_GITHUB_TOKEN`，但不新增代码级 credential fallback。

## Decision 6：不迁移旧数据

**Decision**: 修改 SQLite clean-rebuild schema；旧库检测到不兼容字段时给出明确重建错误。

**Rationale**: 用户已授权删除历史数据。兼容旧 `repo` 会永久保留 local 状态，这是本功能明确禁止的结果。
