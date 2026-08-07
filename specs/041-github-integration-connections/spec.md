# 功能规格：GitHub Integration 多连接与凭据配置

**Feature Branch**: `041-github-integration-connections`
**Created**: 2026-08-06
**Status**: RDB envelope architecture approved for implementation
**Persistence Amendment (2026-08-06)**: The owner approved removing the node-local encrypted-file backend. RDB now stores envelope-encrypted ciphertext while the KEK remains outside RDB; `credentialRef` still identifies an immutable secret version and PAT plaintext remains confined to `SecretProvider`.
**Persistence Supersession Notice (2026-08-06)**: Multi-connection behavior, exact Project binding, deployment policy and SecretProvider rules remain authoritative. Repository-specific top-level Connection columns and Project execution defaults/full Repository snapshot are superseded by `040-prisma-rdb`: Connection capabilities use one validated JSON field and Project keeps provider-stable external ID. Task source, objective and Issue/Repository snapshots are removed, while `dispatchKey` becomes `issueDispatchKey`; current Issue/Repo Info cache is deferred to a later Integration specification. Session persistence and Session credential-delivery projections are not part of 040's three-table schema and require later redesign.
**Input**: 在 Settings → Integrations 增加 GitHub Integration Detail；支持多连接和显式 PAT；Project 固定绑定所选连接；Mystra GitHub App 仅作为 hosted capability，self-hosted 不支持但开源代码可以保留。

## 用户场景与验收

### User Story 1 - 在 GitHub Detail 管理全部连接（Priority: P1）

作为 Mystra 操作者，我希望从 Settings → Integrations 进入 GitHub Detail，集中查看所有个人账户和组织连接，以便知道每个 Project 实际可以使用哪些 GitHub 身份与仓库范围。

**Why this priority**：多连接如果仍被压缩成一个“已连接”状态，操作者无法理解、选择或维护真实授权关系。

**Independent Test**：准备两条不同账户或组织的连接，进入 GitHub Detail，确认两条连接分别显示身份、连接方式、仓库范围、状态和可用操作。

**Acceptance Scenarios**：

1. **Given** 操作者位于 Settings → Integrations，**When** 点击 GitHub 行，**Then** 在同一 Settings Modal 内进入 GitHub Detail，并保留返回 Integrations 列表的操作。
2. **Given** GitHub 没有任何连接，**When** 打开 Detail，**Then** 显示真实空状态以及“添加连接”，而不是显示伪造的已连接状态。
3. **Given** 存在多条连接，**When** 打开 Detail，**Then** 每条连接分别显示账户或组织、连接方式、仓库访问摘要、有效状态和最近更新时间。
4. **Given** 连接加载失败，**When** Detail 呈现，**Then** 显示错误与 Retry，现有导航和关闭操作仍可使用。
5. **Given** 操作者通过回调或 URL 重新打开 Settings，**When** URL 指向 GitHub Detail，**Then** Modal 恢复到该 Detail，而不是退回默认设置页。

---

### User Story 2 - 在 Hosted Mystra 添加多个 GitHub App 安装连接（Priority: P1）

作为 Hosted Mystra Team 的授权操作者，我希望可以重复安装或授权平台运营的 Mystra GitHub App，并将每个可访问安装保存为独立连接，以便从不同组织选择仓库而不覆盖已有连接。

**Why this priority**：这是新目标对现有“一个 Integration 只有一条 active connection”合同的直接替换。

**Independent Test**：依次连接个人账户安装和组织安装，确认两条连接同时可用；再次连接其中一个安装只更新该安装，不影响另一条。

**Acceptance Scenarios**：

1. **Given** 当前部署为 hosted、操作者已登录且具有目标 Team 的 Integration 管理权限，**When** 操作者选择“添加连接 → GitHub App”并完成另一个安装，**Then** 新旧连接同时保持可用。
2. **Given** 同一安装已存在，**When** 操作者再次完成该安装的授权校验，**Then** 系统更新原连接元数据，而不是产生重复连接。
3. **Given** OAuth 校验可访问多个安装，**When** 当前回调没有唯一指向一个安装，**Then** 操作者必须明确选择目标安装，系统不得任意激活其中一个。
4. **Given** 新授权失败或被取消，**When** 操作者返回 Mystra，**Then** 已有连接保持不变，并显示可恢复错误。
5. **Given** 某安装已不可访问，**When** 状态刷新或使用该连接，**Then** 只将该连接标记为不可用，不影响其他连接。
6. **Given** OAuth callback 到达任意 hosted 实例，**When** 服务端消费 transaction，**Then** transaction 必须仍绑定原 actor、Team、安装意图和安全 return path，且只能成功消费一次。

---

### User Story 3 - 使用 PAT 建立和维护连接（Priority: P1）

作为无法安装 GitHub App 或希望使用个人授权范围的操作者，我希望显式选择 Personal access token 模式，提交 PAT 并由 Mystra 验证后保存为独立连接，以便使用该 token 可访问的仓库。

**Why this priority**：PAT 是用户明确要求的第二种连接合同，不是 GitHub App 失败后的隐式后门。

**Independent Test**：使用有效 PAT 建立连接、浏览其仓库、轮换 token 并再次浏览；检查任何管理响应、持久元数据和日志都不包含明文 PAT。

**Acceptance Scenarios**：

1. **Given** 操作者选择“添加连接 → Personal access token”，**When** 输入 token 并提交，**Then** Mystra 先验证 GitHub 身份和仓库访问，再创建连接。
2. **Given** token 无效、过期或无法访问任何仓库，**When** 验证完成，**Then** 不创建连接，不覆盖旧凭据，并显示具体的恢复建议。
3. **Given** PAT 连接已创建，**When** Detail 再次呈现，**Then** 只显示账户、连接方式、访问摘要和安全的凭据提示，不回显 token。
4. **Given** PAT 即将或已经失效，**When** 操作者选择 Replace token 并提交有效新 token，**Then** 原连接标识保持稳定，绑定它的 Project 无需改绑。
5. **Given** 新 token 验证失败，**When** 替换操作结束，**Then** 旧 token 仍可继续使用，系统不得先删除旧凭据。
6. **Given** 某连接仍被 Project 引用，**When** 操作者尝试删除，**Then** 系统阻止删除并列出阻止原因；操作者仍可更新凭据或恢复访问。

---

### User Story 4 - 创建 Project 时选择连接与仓库（Priority: P1）

作为创建 Project 的操作者，我希望 Add Project Modal 先确定 GitHub 连接，再从该连接可访问的仓库中选择一个 repo，以便 Project 的发现与后续交付始终使用同一授权来源。

**Why this priority**：多连接下，“随便取第一条 active connection”会令 Project 来源不确定，并在 Runner 交付阶段产生难以诊断的权限错误。

**Independent Test**：准备一条 App 和一条 PAT 连接，分别用它们创建 Project；确认仓库列表按连接隔离，Project 保存精确 connection reference，clone/push/PR 使用对应连接。

**Acceptance Scenarios**：

1. **Given** 只有一条可用连接，**When** 打开 Add Project，**Then** 系统可以默认选中该连接，并清楚显示其身份和连接方式。
2. **Given** 有多条可用连接，**When** 打开 Add Project，**Then** 操作者必须选择或确认一条连接后才能浏览仓库。
3. **Given** 操作者切换连接，**When** 新连接生效，**Then** 已加载的仓库和选择状态被清除，只显示新连接范围内的仓库。
4. **Given** 选定 repo，**When** 仓库列表收起，**Then** 配置区只显示 Connection、Repository、Project Name 和 Slug；Agent 与开发镜像不作为初始创建选项。
5. **Given** Project 创建成功，**When** 后续执行 clone、push 或创建 PR，**Then** 系统只使用 Project 绑定连接的凭据，不回退到其他 App 或 PAT 连接。
6. **Given** 绑定连接失效，**When** Project 执行仓库操作，**Then** 操作明确失败并指出连接需要恢复，不自动切换到另一条连接。

---

### User Story 5 - Self-hosted 只暴露受支持的 GitHub 方法（Priority: P1）

作为 self-hosted Mystra 操作者，我希望设置页只呈现当前部署真正支持的 PAT 连接方式，不出现 GitHub App 选项，也不把一组无法在本部署完成的 OAuth 配置字段伪装成正式能力。

**Why this priority**：部署支持边界若只写在文档里，路由仍然可调用，就不叫边界，只叫愿望。

**Independent Test**：以 stock self-hosted profile 启动控制面，确认公开连接方式列表只包含 PAT，UI DOM 不出现 GitHub App 添加方式；App 的 connect/setup/callback/credential 路径全部稳定 fail closed，同时 PAT 流程按 SecretProvider 配置正常工作。

**Acceptance Scenarios**：

1. **Given** 当前部署为 stock self-hosted，**When** 打开 GitHub Detail 的添加方式，**Then** 只显示 PAT，GitHub App 名称、说明和 Continue 控件均不进入 UI DOM；PAT 仍按本地 secret store 状态显示可用或配置缺失。
2. **Given** self-hosted 调用方绕过 UI 直接访问 App connect、setup 或 callback route，**When** 请求到达服务端，**Then** 返回稳定的 hosted-only capability error，不发生 GitHub redirect、OAuth code exchange 或连接写入。
3. **Given** self-hosted 数据库遗留 GitHub App connection，**When** 查看连接或运行绑定 Project，**Then** 连接可检查但派生为当前部署不可用，系统不得 mint installation token 或退回 PAT。
4. **Given** 开源构建包含 GitHub App 源码和测试，**When** self-hosted 启动，**Then** 源码存在不改变运行时 capability；测试可通过注入 hosted profile 验证 cloud adapter。

### Edge Cases

- 同一个 GitHub App 安装被重复授权时，更新原连接而不是重复插入。
- 同一 GitHub 用户可以拥有多条 PAT 连接；它们由连接标识和凭据生命周期区分，而不是仅按用户名合并。
- PAT 验证成功但返回 0 个仓库时，不建立连接，因为它不能完成 Project onboarding 的核心用途。
- PAT 能读取仓库但目标 repo 缺少 push 权限时，该 repo 不得被伪装成可交付；fine-grained PAT 的 Pull requests(write) 无法无副作用探测时，界面明确标记为未验证并在真实交付失败时给出恢复提示。
- GitHub 限流、网络错误、权限撤销、组织 SSO 未授权分别保留可恢复错误，不暴露 token 或 App 私钥。
- 删除未被 Project 引用的连接时，秘密材料和非秘密元数据作为一次业务操作一起失效；部分失败必须保持可诊断状态。
- 历史单连接数据升级后仍是有效连接，现有 Project 的 `repositoryConnectionId` 不变。
- 多个浏览器窗口同时添加或替换同一连接时，最终状态保持唯一且不会短暂暴露或丢失有效凭据。
- self-hosted 即使意外配置全部 GitHub App secret，也不得因“配置齐全”而自动启用 hosted capability。
- hosted callback 缺少 caller session、Team membership 已撤销、transaction 过期或已消费时，不得创建或更新连接。
- 同一 GitHub App installation 默认只允许归属一个 Mystra Team；跨 Team 转移必须是显式管理操作，不能通过重复 callback 偷偷改写归属。

## Requirements

### Functional Requirements

- **FR-001**：Settings → Integrations MUST 将 GitHub 显示为可进入的业务行，并展示连接数量和整体健康摘要。
- **FR-002**：系统 MUST 在同一 Settings Modal 内提供 GitHub Integration Detail，并支持返回 Integrations 列表。
- **FR-003**：GitHub Detail MUST 显示 loading、empty、full、error、disabled 与 permission-limited 状态。
- **FR-004**：每条连接 MUST 具有稳定 ID、GitHub 身份、连接方式、仓库范围摘要、状态和时间信息。
- **FR-005**：Hosted 部署 MUST 同时支持多条 active GitHub App 安装连接，不得因添加新安装而停用其他安装。
- **FR-006**：同一 GitHub App installation MUST 只对应一条连接；重连 MUST 原地更新该连接。
- **FR-007**：GitHub App OAuth user token MUST 仅用于验证安装访问权，不得持久化或用于仓库交付。
- **FR-008**：Hosted MUST 提供显式的 `GitHub App` 和 `Personal access token` 添加方式；stock self-hosted 的公开连接方式列表与 UI MUST 只提供 PAT，不呈现 GitHub App 方法；两者不得互为静默 fallback。
- **FR-009**：系统 MUST 在保存 PAT 前验证 token 身份和仓库可见性，并验证 GitHub 可无副作用观测的仓库操作能力；无法安全探测的写权限必须明确标记为未验证，不得伪造通过状态。
- **FR-010**：PAT 明文 MUST 只进入 `SecretProvider` 与短期运行时注入，不得进入关系数据库、客户端状态、公共 API 响应、URL、日志、事件或验收证据；RDB 只允许保存无法直接用于 GitHub API 的 authenticated encryption envelope。
- **FR-011**：关系数据库 MUST 区分连接业务元数据、opaque `credentialRef` 与 envelope 密文；每条 envelope 使用随机 DEK 加密，DEK 再由数据库外的 KEK 包装，KEK 不得进入 RDB。
- **FR-012**：PAT token replacement MUST 先验证新凭据，再以 immutable credential version 写入新 envelope，并在同一 RDB transaction 切换 connection reference；失败时旧 reference 与旧凭据保持有效。
- **FR-013**：系统 MUST 支持删除未被 Project 引用的连接，并拒绝删除仍被任何 Project 引用的连接。
- **FR-014**：连接状态变化 MUST 局限于目标连接，不得修改同一 Integration 的其他连接。
- **FR-015**：Add Project Modal MUST 使用连接选择器；只有一条可用连接时可默认选中，多条时必须显式确认。
- **FR-016**：仓库发现、仓库解析、Project 创建与 Runner 交付 MUST 使用请求或 Project 指定的精确连接 ID。
- **FR-017**：切换连接 MUST 清空前一连接的仓库列表、分页游标和已选仓库，防止跨授权范围混用。
- **FR-018**：Project MUST 保留不可变的 `repositoryConnectionId` 和 provider-resolved repository snapshot。
- **FR-019**：绑定连接失效时，Project 仓库操作 MUST 明确失败，不得自动改用其他连接或环境 token。
- **FR-020**：GitHub Detail 和 Add Project 的设置项 MUST 复用 Mystra 的 `SettingGroup` / `SettingRow` 业务布局、暗色语义 token、紧凑密度和操作层级。
- **FR-021**：新增 UI 文案 MUST 提供简体中文与英文值，并在 320 / 768 / 1024 / 1440px 宽度保持主要操作可用。
- **FR-022**：Dialog、连接行、方式选择、PAT 表单和仓库选择 MUST 支持键盘操作、稳定焦点顺序、可访问名称与错误播报。
- **FR-023**：现有单连接 GitHub App 数据与 Project connection reference MUST 可迁移到多连接模型，且不得把未知或混合 schema 误判为可升级状态。
- **FR-024**：API、MCP、CLI 与 Web MUST 共享同一连接合同；Web 不得成为唯一可管理连接的真相来源。
- **FR-025**：Add Project UI MUST 不要求配置 Agent 或 runtime image；服务端 MUST 从平台全局默认配置解析并把解析结果固化到 Project，以保证后续执行可复现。
- **FR-026**：服务端 MUST 从可信 deployment policy 解析 Integration method capability；客户端输入、request host 和 App 环境变量存在性都不得自行提升 capability。
- **FR-027**：内部 deployment capability contract MUST 以结构化 availability 和稳定 reason code 区分 `available`、`hosted-only`、`not-configured` 与 `policy-disabled`；stock self-hosted 的公开 method projection MUST 省略 hosted-only App，直接 App 路由 MUST 返回机器可读 `HOSTED_ONLY` reason code，不得要求客户端解析英文错误文本。
- **FR-028**：self-hosted 的 GitHub App connect、setup、callback、installation credential mint、repository discovery 与 delivery entry point MUST 全部 fail closed，且不得产生外部 redirect 或 GitHub API side effect。
- **FR-029**：Hosted OAuth transaction MUST 持久保存一次性 nonce 的 hash、actor、Team、安装意图、safe return path、过期时间和消费状态；callback MUST 原子消费并重新验证 actor session 与 Team authorization。
- **FR-030**：Hosted GitHub App registration 的 client secret、private key 与未来 webhook secret MUST 由平台 secret boundary 管理，不得成为 Team、Project、connection 或 self-hosted 配置状态。
- **FR-031**：Hosted `IntegrationConnection` MUST 归属一个 Team；同一 App registration 的 installation 默认不得同时绑定多个 Team，除非未来规格引入明确的跨 Team repository partition 合同。
- **FR-032**：部署不支持某已有 connection 时，系统 MUST 保留其非秘密元数据以供检查，但其派生 availability 必须阻止 discovery、Project 创建和 Runner credential 签发。
- **FR-033**：部署 capability 判断 MUST 位于 Integration 管理和 exact-connection credential resolution 边界，不得让 `IntegrationRegistry` 按部署返回不同的核心 provider graph。
- **FR-034**：Self-hosted `SecretProvider` MUST 通过共享 `RdbProvider` 持久化 envelope，不得依赖节点本地 secret 文件、`MYSTRA_SECRET_STORE_PATH` 或 sticky-session/node affinity。
- **FR-035**：SQLite、PostgreSQL 与 Supabase-backed PostgreSQL MUST 对 `secret_envelopes` 提供相同的 Prisma-backed CRUD 与 create/replace/delete transaction 行为；Prisma 生成类型不得越过 DB 模块。

### Key Entities

- **IntegrationConnection**：一条稳定的 GitHub 授权关系；区分 GitHub App installation 与 PAT，保存非秘密身份、能力、状态和凭据引用。
- **ConnectionCredential**：与连接关联的秘密材料及其生命周期；只能通过受保护的秘密边界解析，不作为公共业务对象返回。
- **GitHub Account**：由 GitHub 验证的用户或组织身份，可被一条或多条连接引用。
- **Project**：绑定一条 IntegrationConnection 和一个不可变、provider-resolved Repository snapshot 的执行边界。
- **Repository Access Summary**：连接在验证时形成的非秘密能力摘要，用于界面说明和创建前置检查，不替代每次实际授权校验。
- **Deployment Capability**：服务端派生的 Integration method 可用性；不持久化为用户可编辑配置，不由客户端决定。
- **GitHub OAuth Transaction**：Hosted-only、短期、一次性的 actor/Team/installation 绑定；不是长期 session，也不保存 OAuth user token。

## Scope

### In scope

- GitHub Integration Detail 与多连接管理。
- Hosted 的多个 GitHub App installation 连接，以及 self-hosted 对 hosted-only capability 的服务端拦截与 PAT-only 公开展示。
- 显式 PAT 创建、替换、验证与删除。
- Project 创建时选择连接，并让 discovery 与 delivery 使用同一绑定连接。
- self-hosted 的受保护 PAT secret storage，以及 hosted secret provider 的接口边界。
- 开源代码保留 hosted GitHub App adapter，但运行时能力由 deployment policy 控制。
- 对现有 039 单连接数据和文档边界的迁移。

### Out of scope

- 通用 Integration marketplace/catalog、GitLab intake、webhooks、Issue write-back、caller login、公开多租户管理。
- 自动选择“最好”的连接、连接间自动 failover、PAT 自动刷新、组织 PAT 生命周期管理。
- 在 Settings 中编辑 GitHub App 本身的 manifest、权限或品牌资料。
- 把 PAT 复制到 Project 记录、repo snapshot 或长期 Runner 配置。
- self-hosted GitHub App 的正式支持、任意用户自带 GitHub App registration、或通过环境变量绕过 deployment policy。
- 在 041 内实现 hosted caller authentication、Team administration、hosted RDB/KMS 或 installation lifecycle webhook；它们是 hosted App 上线前的明确依赖阶段。

## Assumptions

- 当前操作者拥有添加相应 GitHub App installation 或创建 PAT 的权限。
- GitHub App installation 只在 hosted profile 下启用；开发测试通过依赖注入模拟 hosted profile，不把 localhost 自动等同于 self-hosted 产品部署。
- PAT 可以是 fine-grained 或 classic；系统以实际 API 能力验证为准，不依赖某一种 scope header。
- 一条连接可服务多个 Project；删除连接前必须先解除所有 Project 引用。
- 只有一条可用连接时的默认选择是便利行为，不改变 Project 提交时必须携带精确 connection ID 的合同。
- 当前全局默认 Agent 沿用 `copilot`，默认开发镜像沿用 `mystra-runner:local`；部署可通过平台配置覆盖，Add Project UI 不暴露这些高级项。
- 039 是本功能的代码基线；041 明确取代其中“单 active connection、无 PAT fallback”的限制，其余 GitHub App 安全约束继续有效。
- self-hosted 默认 PAT，hosted 默认推荐 GitHub App；这是展示优先级，不是运行时 fallback 顺序。

## Success Criteria

### Measurable Outcomes

- **SC-001**：Hosted 操作者可在一个 GitHub Detail 中识别并管理至少 10 条同时可用的 App/PAT 连接；self-hosted 操作者只能看到和管理 PAT 添加方式，GitHub App 添加控件计数为 0。
- **SC-002**：从 Detail 开始，操作者可在 3 个主要操作以内进入 App OAuth 或 PAT 输入流程。
- **SC-003**：使用两条不同连接创建的 Project，其仓库发现和交付验证均 100% 使用各自绑定连接，0 次跨连接 fallback。
- **SC-004**：重复授权同一 App installation 产生 1 条稳定连接；添加另一个 installation 后原连接仍保持可用。
- **SC-005**：无效 PAT、失败的 PAT replacement、被取消的 OAuth 都不会破坏已有可用连接。
- **SC-006**：关系数据库、公共 API 响应、UI DOM、日志、事件和测试证据中的 PAT 明文泄露计数为 0；RDB envelope 在正确 KEK 缺失、错误或 auth tag 被篡改时均无法解密。
- **SC-007**：现有 039 Project 在 schema 升级后保持相同 `repositoryConnectionId`，无需重新选择仓库。
- **SC-008**：GitHub Detail 与 Add Project 在键盘操作和 320 / 768 / 1024 / 1440px 视口下完成主要流程，无不可达操作或页面级水平滚动。
- **SC-009**：self-hosted profile 下 100% 的 GitHub App 管理与凭据入口在任何 GitHub redirect/API 调用前返回结构化 `hosted-only`；仅配置 App secrets 不能改变结果。
- **SC-010**：Hosted OAuth transaction 的过期、重放、actor 不匹配、Team 权限撤销和 installation Team 冲突测试均 100% fail closed，且 OAuth user token 持久化计数为 0。
- **SC-011**：能力 API、Settings UI、Project repository discovery 与 Runner credential resolver 对同一 deployment profile 的 GitHub App availability 判断一致率为 100%。
