# Research: GitHub Project Onboarding

## 1. 安装与用户授权是两个不同事实

**Decision**：连接流程先得到一个安装候选，再用 GitHub App user OAuth token 验证该用户确实能访问该安装；只有验证成功才持久化连接。

**Rationale**：GitHub 明确警告 setup URL 的 `installation_id` 可被伪造，不能直接信任。OAuth user token 只在 callback 调用 `/user/installations` 时存在，随后立即丢弃。

**Alternatives considered**：

- 直接保存 setup URL 参数：拒绝，违反 GitHub 官方警告。
- 长期保存 user token：拒绝，仓库自动化应以 installation 身份执行，并扩大秘密生命周期。
- 只用 App JWT 查询安装：拒绝，它证明“该安装属于 App”，不能证明当前用户有权绑定。

**Sources**：

- https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/about-the-setup-url
- https://docs.github.com/en/apps/using-github-apps/authorizing-github-apps
- https://docs.github.com/en/rest/apps/installations

## 2. OAuth 使用 state 与 PKCE，瞬时 cookie 不保存 user token

**Decision**：使用高熵 `state`、PKCE S256 verifier/challenge 和 HttpOnly + SameSite=Lax + 短 TTL cookie。cookie 只保存 state、verifier、returnTo 和待验证 installation ID；OAuth access token 只存在于 callback 函数局部内存。

**Rationale**：GitHub 强烈建议 PKCE，并明确 verifier 可以保存在 cookie/session。单节点 MVP 不需要新增 session store。

**Alternatives considered**：

- 只依赖 client secret：拒绝，缺少 CSRF transaction binding。
- 把 user token 放入 cookie 供安装选择：拒绝，不必要且违反不持久化边界。
- 新增 Redis OAuth session：拒绝，当前单节点规模没有此依赖需求。

**Source**：https://docs.github.com/en/enterprise-cloud@latest/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-user-access-token-for-a-github-app

## 3. 仓库自动化使用短期 installation token

**Decision**：控制面用 App JWT 调用 `POST /app/installations/{installation_id}/access_tokens`；token 默认获得安装已授权仓库/权限，最多有效一小时。缓存只在内存中，过期前 60 秒刷新。

**Rationale**：installation token 是 GitHub 为 App 自动化提供的身份；它同时支持 REST 和 Git over HTTPS，且无法越过安装授权范围。

**Alternatives considered**：

- `MYSTRA_GITHUB_TOKEN` PAT：拒绝，用户已明确要求同一 App 连接且无回退。
- 把 App private key 分发给 Runner：拒绝，扩大所有安装的签发权限和泄漏半径。
- 每个 API 请求都 mint 新 token：可工作但产生无意义流量；进程内缓存更合理。

**Sources**：

- https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-an-installation-access-token-for-a-github-app
- https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/authenticating-as-a-github-app-installation
- https://docs.github.com/en/rest/apps/apps

## 4. 安装 token 的仓库列表端点不同于用户 token

**Decision**：GitHub provider 的生产 connection 模式使用 `/installation/repositories`；按仓库解析继续使用 `/repos/{owner}/{repo}`。现有静态 token test seam 只保留为测试注入，不由生产 registry 或环境变量触发。

**Rationale**：当前 `/user/repos` 是 user-token 语义，不能作为 installation credential 的权威列表。

**Alternatives considered**：

- 继续请求 `/user/repos`：拒绝，installation 身份不是用户。
- 使用 App JWT 列出所有安装仓库：拒绝，App JWT 管理 App，不代表单一安装的资源权限。

**Source**：https://docs.github.com/en/rest/apps/installations

## 5. Runner 通过私有 no-store endpoint 按需取凭据

**Decision**：Runner claim 保持无 secret。已认证 Runner 在每个 repository phase 前，以 Session ID 调用专用 POST endpoint；服务端再次验证 assignment 与 Project connection 后返回 installation token。

**Rationale**：App 私钥只在控制面；token 不落库；按需获取减小过期窗口，并复用现有 Runner bearer auth 与 Session ownership 检查。

**Alternatives considered**：

- token 放入 claim：拒绝，取消轮询会重复取 claim，且长 Session 中 token 易过期。
- token 存到 Session/runtime secret ref：拒绝，会把 GitHub connection secret 混入持久执行合同。
- Runner 启动时环境变量：拒绝，正是要移除的第二套身份来源。

## 6. 不引入 Octokit SDK

**Decision**：沿用当前 `fetch` + Zod response validation，使用 Node `crypto` 完成 RS256 JWT 与 PKCE。

**Rationale**：仓库已有成熟的 request timeout/error mapping/response schema 模式。新增 SDK 仍不能替代连接持久化、OAuth route 和 Runner exchange；反而引入第二套 HTTP/error 语义。

**Alternatives considered**：

- `@octokit/auth-app`：能自动处理 JWT/token refresh，但本切片仍需自定义 OAuth/DB/Runner glue；当前最小 diff 不值得新增依赖。

## 7. Castrel 参考只平移 anatomy 与 density

**Decision**：Mystra 新增共享 `SettingGroup` 与 `SettingRow`，采用 `minmax(0,1fr) auto`、约 32px column gap、紧凑 28/30px controls、920×760 Settings shell；颜色、字体、radius 和 elevation 使用 Mystra token。

**Rationale**：`castrel-ai/frontend/components/castrel/v2/index.tsx` 与 `SettingsModal.tsx` 已证明该业务布局；运行时复制 Castrel 依赖或 palette 会破坏 Mystra design-system ownership。

**Alternatives considered**：

- 继续每个表单 label 上下堆叠：拒绝，无法满足用户指定的设置项业务样式。
- 直接导入 Castrel 组件：拒绝，跨 repo runtime coupling。
