# Research: GitHub Integration 多连接与 PAT

## Decision 1：GitHub App installation credential 继续按需生成

**Decision**：保留 039 的 App JWT → installation access token 流程；每条 App connection 保存 installation id，使用时 mint token。

**Rationale**：GitHub 官方要求先以 App JWT 调用 `POST /app/installations/{installation_id}/access_tokens`。installation token 默认继承安装范围，且不能获得超出 App/installation 的 repository 或 permission。官方也已提示 2026 年新 token 格式不应被假设为固定 40 字符，因此 Mystra 只把它当 opaque secret。

**Alternatives considered**：持久化 installation token；拒绝，因为它短期有效且扩大泄露面。用 OAuth user token 交付；拒绝，因为 039 已明确 OAuth 只做 installation ownership verification。

**Source**：https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-an-installation-access-token-for-a-github-app

## Decision 2：PAT 支持 fine-grained 与 classic，但推荐 fine-grained

**Decision**：PAT input 不按前缀排除合法 token；以 GitHub `/user` 和 authenticated repository API 的真实响应验证。UI 文案推荐 fine-grained PAT。

**Rationale**：GitHub 官方明确推荐 fine-grained PAT，因为可以限制 resource owner、repository 和细粒度权限；classic PAT 可能访问用户所有可访问仓库，组织还可禁止 classic PAT。

**Alternatives considered**：只接受 fine-grained；拒绝，因为用户明确要求 PAT，且部分场景仍受 fine-grained 限制。只靠 `X-OAuth-Scopes`；拒绝，因为 fine-grained token 不以 classic scope header 为统一能力合同。

**Source**：https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens

## Decision 3：使用 authenticated repository listing 做仓库发现

**Decision**：PAT credential source 复用现有 GitHub RepoProvider；provider 以 Bearer token 请求 authenticated user repositories，并保留分页。

**Rationale**：GitHub 官方 `List repositories for the authenticated user` 支持 fine-grained PAT，并返回该 credential 可访问的仓库集合。公共 user repo endpoint 不足以代表 private/organization access。

**Alternatives considered**：按用户名列公开仓库；拒绝，因为会把公开可见性伪装成 token 授权。启动时抓取并持久化全部 repo；拒绝，因为 repo scope 会变化，Project 创建仍必须远程 resolve。

**Source**：https://docs.github.com/en/rest/repos/repos#list-repositories-for-the-authenticated-user

## Decision 4：不以副作用验证 Pull requests(write)

**Decision**：连接创建验证身份、repo visibility 和可观测 repo permission；fine-grained PAT 的 Pull requests(write) 以配置前置条件呈现，不创建测试 PR。真实 review 403 映射为 permission recovery error。

**Rationale**：GitHub 的 Create a pull request endpoint 要求 fine-grained token 具有 Pull requests(write)，但调用本身会创建内容并触发通知。没有安全的 dry-run。配置验证不能为了证明权限而污染用户 repo。

**Alternatives considered**：创建后立即删除测试 PR；拒绝，因为仍有通知、审计和失败残留。完全不提示；拒绝，因为会造成 repository discovery 成功、delivery 才神秘失败。

**Source**：https://docs.github.com/en/rest/pulls/pulls#create-a-pull-request

## Decision 5：PAT 失效与轮换是显式状态

**Decision**：token replacement 先远程验证，再原子覆盖 secret；失败不触碰旧值。到期、撤销、SSO policy 和组织 approval 失败都映射到 connection-level 恢复状态。

**Rationale**：GitHub 官方说明 PAT 可到期或被撤销，失效 token 无法恢复，只能创建新 token；fine-grained token 还可能等待组织审批。

**Alternatives considered**：自动换用另一条 connection；拒绝，因为 Project provenance 不再可信。静默重试旧 token；拒绝，因为不能恢复 revoked/expired token。

**Sources**：

- https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/token-expiration-and-revocation
- https://docs.github.com/en/organizations/managing-programmatic-access-to-your-organization/setting-a-personal-access-token-policy-for-your-organization

## Decision 6：SecretProvider 使用 AES-256-GCM 文件实现

**Decision**：RDB 保存 opaque ref；本地 provider 用 env master key 加密小型 secret envelope，严格文件权限并原子 rename。

**Rationale**：这保持 RdbProvider dialect-neutral，避免 PAT 明文进入 SQLite/backups，也不引入 hosted Vault。Node 24 内置 `crypto` 和 `fs` 足够，属于 boring local primitive。

**Alternatives considered**：SQLite plaintext；拒绝。仅靠 `.env.local` 为每条 PAT 建变量；拒绝，因为多连接的动态 lifecycle 无法管理。引入 Vault/KMS；拒绝，因为超出私有单节点 MVP。

## Decision 7：Project defaults 在服务端解析并固化

**Decision**：Add Project 不显示 Agent/image；API 缺省时用平台环境配置，resolved Project 继续持久化完整值。

**Rationale**：用户不应在关联 repo 时理解 Runner image；但执行合同需要稳定快照。创建时 resolve 一次同时满足简洁 UI 与可复现执行。

**Alternatives considered**：运行时每次读取全局默认；拒绝，因为修改全局默认会改变历史 Project 行为。删除 Project 字段；拒绝，因为现有 Task/Session/Runner 依赖 resolved 项目配置。

## Decision 8：Mystra GitHub App 是 hosted capability，self-hosted 使用 PAT

**Decision**：开源树保留 GitHub App adapter、路由和测试；默认 self-hosted runtime 通过 trusted deployment policy 将 App 标记为 `hosted-only`，不允许 App connect/setup/callback/token mint。Hosted Mystra 使用平台运营的 public App registration。

**Rationale**：GitHub App registration 固定 callback/setup URL、App identity 和 private key。GitHub 官方说明 public App 可由其他账户安装，第三方安装入口是 `https://github.com/apps/APP-NAME/installations/new`；这天然对应一个有公开入口和平台 secrets 的 hosted control plane，而不是让每个 self-hosted 实例假装共享同一个 App 身份。

**Alternatives considered**：删除 App 代码；拒绝，因为 hosted 与开源开发会形成 fork。Self-hosted 支持 bring-your-own App；拒绝，因为它把 App registration、公开 callback、权限升级和密钥轮换变成正式本地运维合同，违背 owner 指定边界。仅靠缺少环境变量隐藏；拒绝，因为配置存在性不是 deployment authorization。

**Sources**：

- https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app
- https://docs.github.com/en/apps/using-github-apps/installing-a-github-app-from-a-third-party
- https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/making-a-github-app-public-or-private

## Decision 9：Hosted OAuth 使用 durable、一次性、actor/Team-bound transaction

**Decision**：浏览器只携带 opaque transaction id；服务端保存 nonce hash、PKCE verifier、actor、Team、installation intent、safe return path、expiry 和 consumed state。Callback 原子消费 transaction，并重新验证 caller session 与 Team role。

**Rationale**：GitHub 官方强烈建议随机 `state` 与 PKCE，并要求 state 不匹配时中止流程；setup URL 的 `installation_id` 可能被攻击者伪造，必须用 user access token 验证 installation 确实属于该用户。Cookie-only state 没有表达 hosted Team authorization、一次消费和跨实例恢复的完整合同。

**Alternatives considered**：把 Team id/return URL 直接编码进 state；拒绝，因为签名不能替代一次消费、权限撤销检查和最小泄露。继续只用 browser cookies；拒绝，因为多实例 callback、Team ownership 和 replay audit 都不完整。

**Sources**：

- https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-user-access-token-for-a-github-app
- https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/about-the-setup-url

## Decision 10：App identity secret 平台持有，installation token 只做短期 lease

**Decision**：Hosted App private key/client secret 由 managed secret/KMS boundary 持有；优先使用不可导出的 sign-only key。RDB 只保存 installation metadata；installation token 按需生成、进程内短期缓存、永不持久化。

**Rationale**：GitHub 把 private key 定义为 App 最有价值的 secret，并建议使用 key vault 的 sign-only 存储。installation token 一小时过期，且不能超出 installation 已授权仓库和 App permission，适合短期 credential lease。

**Alternatives considered**：把 private key 放 Team 配置或 connection row；拒绝，因为 App identity 是平台级，而非租户级。共享 durable installation-token cache；拒绝，因为它扩大泄露面，且多实例独立 mint 是可接受的 disposable optimization。

**Sources**：

- https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/managing-private-keys-for-github-apps
- https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-an-installation-access-token-for-a-github-app

## Decision 11：一个 installation 默认只归属一个 Mystra Team

**Decision**：Hosted 对 `(appRegistrationId, installationId)` 建全局唯一 ownership；重复绑定同 Team 为幂等更新，绑定其他 Team 返回不泄露 owner 详情的 conflict。

**Rationale**：一个 GitHub account 对同一 App 形成一个 installation，而 installation token 默认覆盖该 installation 获准的 repository 集合。若多个 Mystra Team 共享该 installation，Team 成员会继承同一发现范围，当前模型没有 repository partition 可以证明租户隔离。

**Alternatives considered**：允许多 Team 引用同 installation；拒绝，除非未来增加 Team-scoped repo allowlist、管理员同意和完整授权审计。自动转移 ownership；拒绝，因为 callback 不能静默撤销另一 Team 的 Project credential provenance。

**Source**：https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-an-installation-access-token-for-a-github-app
