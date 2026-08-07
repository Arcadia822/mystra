# Implementation Plan: GitHub Integration 部署能力与 Hosted App

**Branch**: `041-github-integration-connections` | **Date**: 2026-08-06 | **Spec**: [spec.md](spec.md)
**Input**: GitHub Integration Detail、多连接、Project 精确连接绑定，以及 GitHub App hosted-only / PAT self-hosted-supported 的部署边界。

## Summary

在现有 041 多连接实现上增加服务端 deployment capability。Self-hosted 只正式支持 PAT；Mystra GitHub App 只在 hosted profile 可用。开源仓库保留 App adapter、路由和测试，但 capability API、管理路由与 exact-connection credential resolver 必须一致地阻止 self-hosted App 流程。Hosted OAuth 增加 caller/Team authorization 与一次性 durable transaction，App installation token 继续按需签发且不持久化。

Settings 继续使用现有双栏 Modal。Stock self-hosted 的公开方式列表和 UI 只呈现 PAT；Hosted distribution 才可注入并优先显示 App。PAT 是否可用仍由 SecretProvider capability 决定。Self-hosted SecretProvider 改为 Prisma/RdbProvider-backed envelope encryption，移除 node-local file backend；Add Project、Project exact binding、Agent/image 全局默认和 Runner delivery 合同保持不变。

## Technical Context

**Language/Version**: TypeScript 5.9，Node.js 24.14.0
**Primary Dependencies**: Next.js 16 Route Handlers、React 19、Zod 4、Node `crypto`、Prisma 7、GitHub REST API、现有 SQLite/PostgreSQL adapters
**Storage**: SQLite、PostgreSQL 或 Supabase-backed PostgreSQL 经 `RdbProvider` 保存 connection metadata 与 envelope ciphertext；KEK 由部署 secret/KMS 提供
**Testing**: Vitest 4、Prisma SQLite/PostgreSQL contract tests、API/component model tests、真实浏览器验证
**Target Platform**: self-hosted Linux/macOS 单节点或多副本 PostgreSQL control-plane + Hosted Mystra 多实例控制面；Web 为 secondary client
**Project Type**: monorepo web service + Runner daemon + shared contracts
**Performance Goals**: 10 条连接的 GitHub Detail 首次加载不产生逐连接 GitHub 请求；capability 解析无网络调用；repo 列表保持分页；installation token 只按 exact connection mint
**Constraints**: deployment capability 只由可信服务端策略决定；self-hosted App 在外部 redirect/API 调用前 fail closed；OAuth transaction 一次性且绑定 actor/Team；PAT plaintext、KEK 与 OAuth user token 不进 RDB/URL/log/public response；RDB 只保存 envelope ciphertext；App/PAT 不 fallback
**Scale/Scope**: self-hosted 单节点与 Hosted 多 Team；一个 App installation 默认只归属一个 Team；不引入通用 Integration catalog

## Constitution Check

*GATE: Phase 0 前检查，并在 Phase 1 后复核。*

- **Product boundary**：PASS。Constitution 2.5.0 明确 self-hosted PAT / hosted App；开源保留 adapter 不等于 self-hosted 支持。通用 catalog、GitLab intake 和本阶段 webhook 仍排除。
- **Typed boundaries**：PASS。Connection list/create/replace/delete、PAT input、public view 和 Runner credential 继续使用 shared Zod contracts。
- **Provider replaceability**：PASS。`IntegrationRegistry` 保持稳定；deployment capability 位于管理与凭据解析边界。`RdbProvider` 只持久化 opaque encrypted envelope，永不接触 plaintext/KEK；`SecretProvider` 可将 KEK wrapping 替换为 hosted KMS。
- **Secret hygiene**：PASS。PAT 与 OAuth user token 仅在短期验证/使用路径存在；App identity secret 平台持有；所有公开 mapper fail closed。
- **Verification/documentation**：PASS。计划包含 capability matrix、OAuth transaction、Team authorization、遗留连接、API/Runner/UI 一致性与 leakage 检查。

## What already exists

| Existing surface | Reuse decision |
|---|---|
| `IntegrationConnection` shared schema | 扩展 connection type/public credential state，不另建平行 Integration entity |
| `RdbProvider.activateIntegrationConnection` | 拆除“upsert + 全局停用”混合职责，改为 connection-level upsert/status/delete |
| `GitHubAppService` | 保留 OAuth verification、JWT 与 installation token cache；PAT 不塞进 App class |
| `readGitHubAppConfig()` | 仅负责解析 App identity 配置；不再被视为 capability 判断 |
| App connect/setup/callback routes | 保留 hosted adapter entry point；在 handler 最前执行同一 server capability guard |
| `createGitHubIntegration` credential source | 继续作为 Repo/Issue provider 注入点，改由 exact-connection resolver 提供 token |
| Project `repositoryConnectionId` | 原样保留，成为 discovery/delivery provenance 的唯一引用 |
| Settings Modal、`SettingGroup`、`SettingRow` | 直接复用，增加同模态 Detail 状态而非新 route/page shell |
| `ProjectCreateModal` | 保留 repo selection/config 收起逻辑，增加 connection step，删除 Agent/image 字段 |
| Runner repository-credential route | 保留 assignment/no-store 边界，替换 App-only credential lookup |

GitNexus 证据：`GitHubAppService` 为 MEDIUM 风险，9 个直接 import、22 个上游受影响项；`defaultIntegrationRegistry` 为 CRITICAL 风险，8 个直接 API caller、8 条执行流。因此不能在 Registry 内按部署删改 GitHub provider，也不能只守住 OAuth UI 而放过 Runner credential 路径。

## Design Decisions

### D0. Deployment capability 是服务端合同

新增可注入的 `DeploymentCapabilityProvider`，由运行时装配提供可信 profile：

```text
self-hosted                           hosted
    |                                  |
    v                                  v
DeploymentCapabilityProvider.resolve("github")
    |
    +-- PAT: available / not-configured / policy-disabled
    |
    +-- GitHub App: hosted-only / available / not-configured
```

- capability 不来自 request、cookie、Host header 或客户端参数。
- App secrets 配置齐全不自动把 self-hosted 提升成 hosted。
- 部署形态由 control-plane 的 **composition root** 注入，不提供面向操作者的
  `MYSTRA_DEPLOYMENT_PROFILE=hosted` 开关。开源发行入口固定装配
  `createSelfHostedDeploymentServices()`；官方 Cloud 的受管启动入口装配
  `createHostedDeploymentServices(...)`；测试可注入 fake hosted services。Hosted
  composition root、Cloud adapters 与最终 image build 位于独立 private
  distribution project；它通过 versioned deployment contract 消费固定 OSS
  revision，不维护 Mystra fork。
- `hosted` 不是一个足以授权功能的布尔值。Hosted 装配必须同时提供 caller
  authentication、Team authorization、durable OAuth transaction store、managed
  SecretProvider/KMS 和 GitHub App identity；缺少任一项时 capability 派生为
  `PREREQUISITE_UNAVAILABLE`，不得降级为 cookie-only 或本地文件实现。
- App 的普通环境变量只允许被 Hosted composition root 读取，用于构造
  `GitHubAppIdentityProvider`；Self-hosted composition root 根本不装配该 provider，
  因而变量存在也不会产生 App capability。
- capability contract 使用结构化 `availability` 与 `reasonCode`，不要求客户端解析 `disabledReason` 文案。
- Self-hosted 的公开 method projection 过滤 hosted-only App，因此 stock UI 只看到 PAT；`HOSTED_ONLY` 仍用于 direct route、遗留 connection 和内部 credential guard，不作为一个必须展示的卡片。
- UI 是 capability 的展示者，不是安全边界。connect/setup/callback、credential resolver 与 Runner route 都重复执行同一 guard。

```text
OSS entrypoint                         Mystra Cloud entrypoint
      |                                         |
      v                                         v
createSelfHostedDeploymentServices()  createHostedDeploymentServices(...)
      |                                         |
      +-- kind=self-hosted                      +-- kind=hosted
      +-- local SecretProvider                  +-- caller/Team authz
      +-- no GitHubAppIdentityProvider          +-- durable OAuth transaction store
                                                +-- managed SecretProvider/KMS
                                                +-- GitHubAppIdentityProvider
                         \                     /
                          v                   v
                         DeploymentCapabilityProvider
```

这条边界表达的是官方支持与默认装配，而不是 DRM。开源操作者始终可以修改源码
重新装配服务；Mystra 只保证未经修改的 self-hosted 发行入口不会宣称或启动 Hosted
GitHub App 能力。

完整 ownership、build compatibility 与 rejected alternatives 记录于
[`decision-cloud-distribution.md`](decision-cloud-distribution.md)。

建议合同采用 discriminated union，而不是继续让 `configured: boolean` 同时表示产品支持、配置健康和策略许可。三个概念塞进一个布尔值，通常只能得到一个极具创造性的故障排查过程。

### D1. 公共和内部 connection 分离

公共 `IntegrationConnection` 不包含 `credentialRef`。控制面内部 `IntegrationConnectionRecord` 扩展公共字段并携带 optional opaque reference；API 必须通过显式 mapper 输出公共 schema。

这避免将“虽然不是 token，但足以定位 token”的引用传播到 shared client contracts。

Hosted connection 增加 `teamId`、`createdByActorId` 和 `updatedByActorId` 作为授权与审计边界。Self-hosted 使用平台的 implicit local Team，不从请求接受任意 Team id。`status` 继续表示持久生命周期；`availability` 是 deployment + credential + policy 派生值，不回写 connection row。

### D2. SecretProvider 与 RDB envelope 分层

- `SecretProvider` 是唯一 plaintext boundary：`seal(ref, plaintext)`、`put/get/delete`；opaque ref 与 ciphertext 均不进入公共合同。
- 每个 immutable credential version 使用随机 DEK 做 AES-256-GCM content encryption；部署 KEK 再独立包装 DEK。两次加密使用不同 96-bit IV 和 reference-bound AAD。
- `RdbProvider`/Prisma 保存 envelope ciphertext、wrapped DEK、auth tags、算法版本和非秘密 `keyId`，但不接触 plaintext 或 KEK。
- `MYSTRA_SECRET_STORE_KEY` 为 base64 32-byte KEK；缺失时 PAT method 显示 disabled。`MYSTRA_SECRET_STORE_KEY_ID` 默认 `env-v1`，为后续 rotation/KMS rewrap 提供标签。
- secret ref：`github-pat/<connection-uuid>/<credential-version-uuid>`；create/replace 把 envelope write 与 connection ref switch 放入同一 serializable RDB transaction。
- 不保留 `EncryptedFileSecretProvider`、`MYSTRA_SECRET_STORE_PATH`、dual read 或 file migration。Hosted 未来只替换 KEK wrapping adapter，不改变 RDB/public contract。

GitHub App private key/client secret 是 hosted platform secret，不是 `IntegrationConnection` secret。Self-hosted distribution 不分发这些值。installation token 与 OAuth user token 都不进入任一 SecretProvider。

### D3. PAT validation 诚实边界

创建/替换 PAT 时调用 GitHub `GET /user` 验证身份，并通过 authenticated repository listing 验证至少一个 token-visible repo。Repository selection 时使用 GitHub 返回的 repo permissions 阻止明显不可 push 的目标。

GitHub 没有一个无副作用 endpoint 可以证明 fine-grained PAT 具备 Pull requests(write)。系统不创建试验 PR；它显示该能力未验证，并在真实 review 调用返回 403 时给出精确恢复信息。

### D4. 精确 connection resolver

```text
connection id
    |
    v
RdbProvider.getIntegrationConnectionRecord
    |
    +-- DeploymentCapabilityProvider.assertUsable(connection type)
    |       |
    |       +-- self-hosted + github-app -> HOSTED_ONLY (stop)
    |
    +-- github-app ----------> Team ownership check -> GitHubAppService.getInstallationCredential
    |
    +-- personal-access-token -> SecretProvider.get -> short Runner lease
    |
    v
createGitHubIntegration credentialSource / Runner credential response
```

不存在“App 失败后试 PAT”或“PAT 失效后试另一条 connection”的边。未提供 connection ID 时，仅当恰好一条 active GitHub connection 存在才允许便利解析；0 或多条都返回显式错误。

`defaultIntegrationRegistry` 不参与 capability 分支。它继续暴露稳定的 GitHub provider graph；每次 repository/Issue/Runner 操作都在 exact connection credential resolution 时执行 capability 与 Team authorization。这样不会把部署差异扩散到 8 个 Registry caller。

### D5. Hosted OAuth transaction 与 Team ownership

当前 cookie-only transaction 适合私有单操作者假设，不适合 hosted 多实例、多 Team。Hosted 流程改为：

```text
authenticated actor in Team
    -> create OAuthTransaction(hash(nonce), actorId, teamId, returnTo, expiresAt)
    -> httpOnly cookie carries only opaque transaction id
    -> GitHub install/setup + user authorization
    -> callback atomically consumes transaction
    -> re-check actor session + Team role
    -> exchange code, verify installation belongs to Mystra App and actor
    -> enforce installation -> one Team ownership
    -> upsert Team-scoped connection
    -> discard OAuth user token
```

- transaction store 必须跨实例可见，TTL 10 分钟，消费操作原子且不可重放。
- callback base URL 只取 trusted hosted config；绝不从 request origin/forwarded host 推导。
- safe return path 只允许站内相对路径，并在 transaction 创建时固化。
- 同一 App registration 的 installation 默认只能属于一个 Team。GitHub 对一个 account 的同一 App 只有一个 installation；如果同时绑定多个 Mystra Team，各 Team 会看到同一授权仓库集合，无法形成可信租户隔离。未来若要共享，必须另立 repository partition 合同。
- Hosted App GA 依赖 caller authentication 与 Team RBAC。041 只定义接口和 gate，不声称这些前置能力已经存在。

### D6. Project 全局默认值

`ProjectCreateRequest.defaultAgent` 与 `runtime` 对兼容客户端保持 optional。控制面用中央 `readProjectDefaults()` 解析：

- `MYSTRA_DEFAULT_AGENT`，默认 `copilot`
- `MYSTRA_DEFAULT_DEV_IMAGE`，默认 `mystra-runner:local`

resolved `Project` 仍持久化 `defaultAgent` 和 `runtime`，因此后续修改全局默认不会偷偷改变已有 Project。

### D7. 连接数据与部署迁移

现有 v4 → v5 数据迁移保持不变：

1. 为 `integration_connections` 增加 `connection_type`（已有行默认 `github-app`）、`credential_ref`、`display_name` 和 `access_summary`。
2. 删除 `idx_integration_connections_active` partial unique index。
3. 保留 `UNIQUE(integration, external_id)`；App 使用 installation id，PAT 使用 server-side token fingerprint 作为不公开 external identity。
4. 把 schema version 更新为 5，执行 foreign-key check。

未知、混合或部分升级 schema 继续 fail closed。现有 Project row 和 `repository_connection_id` 不重写。

部署 capability 不写入 schema v5。切换到 self-hosted profile 后，遗留 App connection 保留非秘密元数据并派生 `availability=unsupported`；不得 mint token、发现仓库或供 Runner 使用。041 不自动删除连接，也不偷偷改绑 Project。若将来已有生产数据需要从 App 改为 PAT，另行设计“同 provider + 同 immutable repository identity”的显式 credential rebind migration，而不是松动 Project provenance。

## End-to-end Data Flows

### Add GitHub App connection

```text
Hosted Detail: Add connection -> GitHub App
  -> authenticated Team authorization check
  -> create durable one-time OAuthTransaction
  -> public App install URL
  -> GitHub Setup URL records installation intent
  -> OAuth callback + PKCE + atomic transaction consume
  -> re-check actor/Team role
  -> verify installation belongs to user and exact Mystra App registration
  -> enforce installation ownership by one Team
  -> upsert by (team, github, app registration, installation id)
  -> discard OAuth user token
  -> redirect to safe stored return path
```

新 upsert 只更新目标安装，不停用其他 connection。

```text
Self-hosted Detail: Add connection
  -> public method list = PAT only
  -> direct GitHub App routes = hosted-only error
  -> no actionable connect URL

direct request to connect/setup/callback
  -> DeploymentCapabilityProvider guard
  -> 409 INTEGRATION_CONNECTION_METHOD_UNAVAILABLE
  -> no redirect, no GitHub API, no state write
```

### Create or replace PAT

```text
POST/PUT JSON body { token, label? }
  -> Zod parse, no logging
  -> GET /user + authenticated repo validation
  -> derive non-public fingerprint + public metadata
  -> SecretProvider.seal(new immutable ref, plaintext)
  -> RdbProvider transaction: insert envelope + insert/update metadata + switch opaque ref
  -> replace transaction deletes previous envelope after reference switch
  -> explicit public mapper
  -> no-store response without token/ref
```

Replace 在 GitHub validation 成功前不写 envelope；transaction 失败时旧 reference 与旧 envelope 继续有效。

### Delete connection

```text
DELETE connection
  -> count Project references
  -> if count > 0: 409 CONNECTION_IN_USE
  -> RdbProvider transaction deletes metadata row + referenced envelope
```

transaction 失败时 connection 与 envelope 都保持原状，避免“界面说已删、RDB 仍留 credential material”。

### Add Project

```text
open modal
  -> list active public connections
  -> 1 connection: preselect; >1: require confirmation
  -> list repos with exact connection id
  -> select repo; hide list
  -> show Connection + Repository + Name + Slug
  -> POST without Agent/image
  -> server resolves global defaults + remote snapshot
  -> persist Project with exact repositoryConnectionId and resolved defaults
```

Capability filtering occurs before repository listing. Existing unsupported App connections may be shown read-only in Settings, but Add Project only accepts connections whose derived availability is `available` in the current deployment.

## Project Structure

### Documentation (this feature)

```text
specs/041-github-integration-connections/
├── spec.md
├── features.md
├── checklists.md
├── prototype.md
├── mockups/index.html
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
└── tasks.md
```

### Source Code

```text
packages/shared/src/
├── integrations.ts        # public connection/method/input schemas
├── management.ts          # responses and stable error codes
└── schemas.ts             # optional create overrides; resolved Project unchanged

apps/control-plane/src/lib/
├── db/
│   ├── rdb-provider.ts    # internal records, connection-level persistence methods
│   ├── migrations.ts      # exact v4 -> v5 preservation migration
│   └── sqlite-provider.ts
├── deployment/
│   └── capabilities.ts    # trusted profile + Integration method availability
├── secrets/
│   ├── secret-provider.ts
│   ├── rdb-secret-provider.ts
│   └── managed-secret-provider.ts # hosted adapter, provider chosen later
├── integrations/
│   ├── github-app.ts      # existing App path
│   ├── github-oauth-transaction.ts # hosted one-time actor/Team binding
│   ├── github-pat.ts      # PAT validation and safe fingerprint
│   ├── github-credential.ts # exact connection dispatcher
│   ├── registry.ts
│   └── README.md
└── projects/
    ├── project-defaults.ts
    └── resolve-project-input.ts

apps/control-plane/app/
├── api/integration-connections/...
├── api/integrations/[integration]/repositories/...
├── api/runner/sessions/[id]/repository-credential/route.ts
└── _components/
    ├── shell-settings.tsx
    ├── shell-settings-panels.tsx
    ├── github-integration-detail.tsx
    ├── github-connection-form.tsx
    └── project-create-modal.tsx
```

**Structure Decision**：在现有 `SecretProvider` 与 exact credential resolver 上增加一个小型 deployment capability port；不创建 self-hosted/hosted 两套 Registry、connection entity 或 UI。Hosted OAuth transaction 是独立安全边界，不塞进 `GitHubAppService` 的 API client 职责。具体 hosted KMS/RDB adapter 在对应平台 feature 中实现。

## Failure Modes

| Codepath | Production failure | Handling | Test | User-visible result |
|---|---|---|---|---|
| Capability list | App secrets 存在导致 self-hosted 误报可用 | trusted profile 优先，self-hosted public projection 省略 App | contract/API | UI 只显示 PAT |
| Direct App route | 调用方绕过 self-hosted UI | handler 首行 capability guard | route integration | 结构化 hosted-only，无 redirect |
| OAuth callback | state forged、过期、重放或 actor/Team 不匹配 | durable atomic consume + session/RBAC re-check | API integration | 返回 Detail 的明确失败原因 |
| OAuth callback | 请求落到另一个 hosted instance | shared transaction store | multi-instance integration | 流程继续或明确过期，不丢状态 |
| App ownership | 同一 installation 被另一个 Team 重连 | global installation ownership conflict | RDB/API | 显式冲突，不泄露原 Team 详情 |
| App upsert | 添加第二安装触发旧 unique-active 逻辑 | v5 drop index + connection-level upsert | SQLite + OAuth API | 两条连接同时 active |
| PAT create | token 401/403/SSO blocked | stable integration error；不写 secret | provider/API | form 保留并显示恢复建议 |
| PAT create | envelope/DB insert 失败 | 同一 transaction rollback；返回非泄露错误 | service integration | 未创建连接、无 orphan envelope |
| PAT replace | 新 token invalid | validation-before-write | provider/API | 旧 token 保持有效 |
| PAT replace | envelope insert 或 metadata switch 失败 | transaction rollback | integration | 旧 token/reference 保持有效 |
| Delete | Project still references connection | DB reference count 409 | SQLite/API | 显示阻止原因 |
| Delete | envelope/connection delete transaction fails | 保留原 connection + envelope | SecretProvider/API | 显示 Retry，不宣称完成 |
| Repo list | multiple connections but no id | `CONNECTION_SELECTION_REQUIRED` | API | UI 要求选择连接 |
| Runner credential | PAT decrypt/auth failure | no-store 409/502；不 fallback | route integration | Session 失败指向绑定连接 |
| Runner credential | self-hosted 遗留 App connection | exact resolver capability guard before mint | route integration | Session 失败指向 Hosted-only |
| Add Project | rapid connection switch | request identity guard + clear cursor/repo | component/model | 不显示前一连接 repo |
| Defaults | invalid env agent/image | startup/request validation | unit/API | 配置错误明确，Project 不创建 |

Hosted caller authentication、Team RBAC、shared transaction store 或 managed SecretProvider 尚未落地时，hosted App capability 必须整体 unavailable；不得只因为 App env 配齐就开放半条流程。计划覆盖后没有允许 silent failure 且同时缺少 test/error handling 的路径。

## Test Coverage Plan

### Engineering review: RDB envelope amendment

- **Architecture**: approved. Connection metadata/reference and encrypted material remain distinct logical models; only their transaction boundary is shared. `SecretProvider` alone sees plaintext/KEK, while `RdbProvider` sees portable envelope fields.
- **Consistency**: create/replace/delete require serializable Prisma transactions. Immutable credential refs avoid in-place ciphertext overwrite; failed replace leaves the old reference readable and commits no orphan envelope.
- **Security**: random DEK per credential, distinct GCM IVs for content/wrap, reference/key/version-bound AAD, no plaintext/error echo, and fail-closed wrong-key/tamper behavior. Key rotation stores `keyId`; bulk rewrap and hosted KMS are later operational work.
- **Operations**: SQLite backup includes metadata and ciphertext but still requires separately backed-up KEK. PostgreSQL/Supabase backups become replica-portable without copying node-local files. Loss of KEK is intentionally unrecoverable.
- **Performance**: indexed primary-key lookup is O(1); PAT envelopes are small and add one row lookup plus two local AES-GCM operations per credential resolution. No list path loads ciphertext.
- **Testing gate**: provider contract on SQLite and optional PostgreSQL, schema parity, cryptographic integrity/leak tests, lifecycle rollback tests, public response tests, typecheck/build, and real API/UI evidence. GitNexus impact remains `UNKNOWN` if the LadybugDB native storage version mismatch persists; direct reference inventory then becomes recorded fallback evidence.

### Verification evidence (2026-08-06)

- Node `24.14.0` and pnpm `10.25.0`; both Prisma schemas validate and the SQLite preview applied both committed migrations.
- 9 focused files / 27 tests pass for SQLite RdbProvider contract, schema parity, adoption, config parsing, envelope encryption, PAT lifecycle, credential resolution, and connection API; migration-wrapper tests add 3 passes.
- Scoped strict TypeScript checking for the changed DB/secret/PAT modules passes. Next production compilation succeeds, then the full TypeScript gate stops on pre-existing 040/041 field drift in `github-connection-model.ts` (`connectionType` versus `authMethod`); the branch-wide gate is therefore not claimed as green.
- Port 3000 detached `mystra-preview` returns PAT `configured: true`; real browser navigation opens the password-type PAT form. Empty input remains unsent in the UI and direct empty JSON returns 400 `INVALID_REQUEST` with zero connections.
- Preview DB, preview log, git diff, API response, and UI DOM contain zero PAT/key matches. No real PAT was submitted.
- GitNexus impact and change detection remain unavailable because LadybugDB reports database storage version 42 versus runtime version 40; risk is conservatively treated as high and source/tests/runtime are the evidence of record.

```text
CODE PATH COVERAGE
==================
[+] shared contracts
    ├── App/PAT discriminated public connection              [planned ★★★]
    ├── method availability discriminates supported reasons   [planned ★★★]
    ├── PAT input accepts token but public response rejects it [planned ★★★]
    └── optional create defaults -> resolved Project required [planned ★★★]

[+] schema v5 / RdbProvider
    ├── exact v4 migration preserves ids and Projects         [planned ★★★]
    ├── two App + two PAT connections active simultaneously  [planned ★★★]
    ├── repeated installation upserts one row                 [planned ★★★]
    ├── deletion blocked by Project FK/reference count        [planned ★★★]
    └── unknown/mixed schema fails closed                     [planned ★★★]

[+] SecretProvider / PAT
    ├── AES-GCM round trip + wrong key/auth tag failure       [planned ★★★]
    ├── path traversal rejected, permissions 0700/0600        [planned ★★★]
    ├── valid/invalid/rate-limited/SSO-shaped responses       [planned ★★★]
    ├── invalid replacement preserves old secret              [planned ★★★]
    └── plaintext absent from disk/RDB/error/public JSON      [planned ★★★]

[+] exact credential resolver
    ├── self-hosted App -> HOSTED_ONLY before token mint       [planned ★★★]
    ├── App -> installation credential                        [planned ★★★]
    ├── PAT -> decrypted short lease                          [planned ★★★]
    └── missing/inactive/wrong type -> no fallback            [planned ★★★]

[+] API and Runner
    ├── list/create/replace/delete public shapes              [planned ★★★]
    ├── all App routes fail closed in self-hosted profile     [planned ★★★]
    ├── App env cannot elevate self-hosted capability         [planned ★★★]
    ├── hosted transaction expiry/replay/actor/Team conflict  [planned ★★★]
    ├── OAuth second installation regression                  [planned ★★★]
    ├── repo list/resolve exact connection                    [planned ★★★]
    └── Runner App/PAT/no-store/assignment checks             [planned ★★★]

USER FLOW COVERAGE
==================
[+] Settings -> GitHub Detail                                 [planned model + browser]
    ├── loading / empty / full / error
    ├── self-hosted Hosted-only / PAT configured states
    ├── App add callback returns to Detail
    └── PAT add / replace / in-use delete

[+] Add Project                                               [planned model + browser]
    ├── one connection preselect / multiple require confirm
    ├── switch clears prior repositories and selection
    ├── repo selection collapses list
    └── only Name + Slug, no Agent/image

[→E2E] Real GitHub smoke, when credentials are available
    ├── hosted App connection lists private repo
    ├── self-hosted App route makes zero external requests
    └── PAT connection lists repo and delivers clone/push/PR
```

## Performance Review

- Deployment capability is resolved from immutable server bootstrap state and may be cached for process lifetime；it performs no per-request network call。
- Connection list is one SQLite query plus project-reference aggregation, not N GitHub calls。
- PAT validation is explicit write-path work；repo discovery remains paginated。
- App installation token cache remains process-local and keyed by App registration + installation id；multi-instance hosted nodes may mint independently because cache is disposable, never durable truth。
- Hosted OAuth transaction consume is one indexed lookup/update by opaque id or nonce hash；TTL cleanup is bounded background maintenance。
- Secret files are small；atomic rename is O(1) for the expected local filesystem。
- UI switching uses request identity/AbortController to discard stale connection responses；does not merge lists across identities。

No material N+1 or memory-growth concern at the MVP scale。

## Implementation Sequence

1. **Capability contract**：shared discriminated availability schema、trusted deployment profile、provider-method list；覆盖 self-hosted/hosted matrix。
2. **Self-hosted enforcement**：给 connect/setup/callback、exact resolver、repo discovery 与 Runner credential 增加同一 guard；保留 PAT。
3. **UI projection**：GitHub Detail 在 stock self-hosted 只显示 PAT；Add Project 排除 unavailable connection；更新 prototype/browser contract。
4. **Hosted prerequisites**：caller session/Team RBAC port、durable OAuthTransaction store、managed SecretProvider/RdbProvider adapter；缺一项则 App capability 不可用。
5. **Hosted activation**：actor/Team-bound install + OAuth callback、installation single-Team ownership、user token discard、exact connection upsert。
6. **Hosted runtime**：installation token mint/cache、repo discovery、Runner delivery、跨实例与权限恢复测试。
7. **Hosted GA follow-up**：经过独立 spec 批准后加入 verified installation lifecycle webhook、审计/告警与运营 runbook。

前 1–3 步是当前 041 的最小部署边界修订。4–7 是 hosted rollout roadmap，不应在缺少 caller auth/Team/RDB 前被半实现。实现上保持顺序执行：shared schema、route guards、UI 都集中在同一 Integration module，平行 worktree 的冲突成本高于收益。

## NOT in scope

- Generic Integration catalog/marketplace：GitHub-only requirement does not justify it。
- GitLab intake or GitLab PAT：current provider boundary excludes it。
- Automatic connection failover/default ranking：would destroy Project credential provenance。
- Hosted Vault/KMS provider：`SecretProvider` seam is included，hosted implementation is not。
- Hosted caller auth、Team administration、RDB/KMS concrete provider：041 定义 prerequisite contract，不假装当前已有实现。
- Webhooks and automatic connection health polling：当前 041 仍在 management/use path 验证；installation lifecycle webhook 是 Hosted GA 前的独立 follow-up。
- PAT lifecycle automation or refresh：GitHub PATs are replaced explicitly。
- Agent/runtime controls in Add Project：removed by owner direction，resolved from platform defaults。
- Editing GitHub App manifest/permissions/avatar：deployment administration remains external to this UI。
- Self-hosted GitHub App support 或 bring-your-own GitHub App registration：与 owner 指定的产品边界冲突。
- 通过许可证、代码删除或混淆阻止 fork 启用 App：这是 capability/support architecture，不是 DRM 项目。

## Complexity Tracking

| Concern | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| Deployment capability port | UI、API、repo discovery 与 Runner 必须得到同一部署结论 | 各 route 直接读 env 会漂移且无法测试 |
| Hosted OAuth transaction store | cookie-only transaction 不能绑定多实例 caller/Team 授权 | 把 Team id 放 state/cookie 会泄漏并允许重放 |
| Cross-package change >8 files | 一个 hosted-only 边界必须覆盖 shared contract、API、provider、Runner 和 UI | 只隐藏 UI 仍允许直接 route/Runner 调用 |

## Engineering Review Result

- **Step 0 Scope Challenge**：保留现有 041 connection/credential 架构，不分叉 self-hosted/hosted 产品代码；当前实现只新增 capability seam 与完整 guard，Hosted foundation 分阶段交付。
- **Architecture**：GitNexus 显示 `defaultIntegrationRegistry` 为 CRITICAL，因此明确禁止 Registry 按部署变形；`GitHubAppService` MEDIUM，所有 9 个直接 import 入口由统一 policy 覆盖。
- **Code quality**：一个 deployment capability port、一个 hosted OAuth transaction boundary；不新增 Integration catalog 或平行 connection entity。
- **Tests**：coverage diagram已补 capability matrix、route bypass、OAuth replay/Team ownership、Runner legacy connection；0 silent critical gap。
- **Performance**：capability 无网络调用；OAuth transaction O(1)；installation token cache 继续是 disposable process-local hint。
- **Lake score**：5/5 选择完整边界，包括 UI、API、provider、Runner 与 hosted callback，而不是只隐藏按钮。

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|---|---|---|---|---|---|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | — |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | — | — |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 2 | CLEAR | deployment capability + hosted OAuth/Team boundary；0 unresolved；0 critical gaps |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | Prototype + Mystra UX rules applied |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | — |

**VERDICT:** ENG CLEARED — ready for task decomposition。
