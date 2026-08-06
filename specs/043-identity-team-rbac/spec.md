# 功能规格：身份、Team 与 RBAC

**Feature Number**: `043`
**Feature Directory**: `specs/043-identity-team-rbac`
**Working Branch**: `041-github-integration-connections`（Owner 明确要求在当前 branch 创建 043 规格；后续命令必须显式设置 `SPECIFY_FEATURE=043-identity-team-rbac`）
**Created**: 2026-08-06
**Status**: Draft — ready for owner review；implementation blocked by 040/041 persistence baseline
**Input**: 建立基本 User、登录、注册、Team、Role/RBAC；Hosted SaaS 使用 Google/GitHub SSO，开源 self-hosted 使用 username/password，email 是人类用户唯一外部业务 ID；支持 Control-plane Agent 与 Sandbox Dev Agent 两类非人类身份，并为未来 2FA、Passkey、TOTP、Email OTP、SMS OTP 与 One-Time Token 保留扩展能力；认证数据在 SQLite、PostgreSQL 与 Supabase-backed PostgreSQL 上保持一致。

## 用户场景与验收

### User Story 1 - 人类用户按部署模式注册与登录（Priority: P1）

作为 Mystra 人类用户，我希望使用当前部署明确支持的注册和登录方式进入平台，以便在不理解底层身份提供方的情况下获得一个稳定、可跨 Team 使用的账户。

**Why this priority**：没有可信 caller identity，Team、RBAC、Hosted GitHub App 绑定和任何多租户隔离都只是装饰性文本。

**Independent Test**：分别启动 Hosted 与 stock self-hosted profile；在 Hosted 使用 Google/GitHub SSO 注册登录，在 self-hosted 使用 email、username、password 完成首次初始化与后续受邀注册；验证两种 profile 不展示或接受对方未支持的登录方式。

**Acceptance Scenarios**：

1. **Given** 当前为 Hosted SaaS，**When** 用户打开登录页，**Then** 页面提供 Google 与 GitHub SSO，且不默认提供 username/password 注册。
2. **Given** Google 或 GitHub 返回稳定 provider subject 与已验证 email，**When** 新用户首次完成 SSO，**Then** Mystra 创建一个内部稳定 User，并以规范化 email 作为唯一外部业务 ID。
3. **Given** 当前为 stock self-hosted 且尚无 User，**When** 首位用户以 email、username、password 完成注册，**Then** 系统创建首个 Team，并将该用户设为唯一初始 Owner。
4. **Given** self-hosted 初始化已经完成，**When** 未受邀访客尝试匿名注册，**Then** 系统默认拒绝并显示邀请要求；管理员可通过显式部署策略另行开放注册。
5. **Given** 同一规范化 email 已属于一个 User，**When** 另一 SSO provider 或 password 注册尝试创建新 User，**Then** 系统不得静默合并或创建重复 User，而是要求用户先用现有方式登录后显式关联账户。
6. **Given** SSO 未返回已验证 email，**When** 登录回调完成，**Then** Mystra 不创建 User、Team 或 session，并提供可恢复说明。
7. **Given** 用户已登录，**When** 用户退出、撤销指定 session 或账户被停用，**Then** 对应 session 不再能访问受保护资源，其他未撤销 session 按策略保持或失效。

---

### User Story 2 - Team Owner 管理成员、角色与授权范围（Priority: P1）

作为 Team Owner，我希望邀请成员、管理成员状态，并按 Team 或 Project 范围分配角色，以便人类用户和 Control-plane Agent 只执行其职责允许的操作。

**Why this priority**：认证只回答“是谁”；如果没有服务端授权和明确作用域，多租户系统仍然允许正确的人访问错误的 Team。

**Independent Test**：建立两个 Team、两个 Project、一个多 Team User 和一个 Control-plane Agent；分配不同 Team/Project RoleBinding，逐项验证 API、MCP、CLI 与 Web 对同一权限决策给出一致结果，并拒绝跨 Team 或越权访问。

**Acceptance Scenarios**：

1. **Given** User 已加入多个 Team，**When** 其进入 Web、调用 API、CLI 或 MCP，**Then** 每次操作都具有明确 Team context；缺失、歧义或无权 Team context 时 fail closed。
2. **Given** Team Owner 邀请一个尚未注册的 email，**When** 该 email 对应用户完成注册或登录并接受邀请，**Then** 其获得指定 Team membership，而不会创建第二个 User。
3. **Given** Team Owner 分配 Team 级或 Project 级角色，**When** Principal 操作目标资源，**Then** 服务端根据目标作用域和 permission catalog 计算有效权限；客户端隐藏按钮不能替代服务端检查。
4. **Given** Principal 同时拥有多个 RoleBinding，**When** 计算有效权限，**Then** MVP 使用允许权限的并集，不提供隐式 deny 或策略 DSL。
5. **Given** Team 只剩一名有效 Owner，**When** 尝试移除、停用或降级该 Owner，**Then** 系统拒绝操作，直到先产生另一名有效 Owner。
6. **Given** membership、Role 或 RoleBinding 被撤销，**When** Principal 再次请求受影响资源，**Then** 新请求立即按更新后的权限拒绝；不得依赖客户端刷新才能生效。
7. **Given** Team Owner 查看成员和角色设置，**When** 数据加载、为空、失败或权限不足，**Then** Settings 显示真实状态和可恢复操作，不展示无持久化能力的假表单。

---

### User Story 3 - 人驱动工具与 Control-plane Agent 使用可审计身份（Priority: P1）

作为 Team 操作者，我希望人驱动的 Agent/工具可以沿用人的 OAuth/session/API key，而长期在 Control Plane 活动的 Agent 拥有独立身份和凭据，以便既不制造无意义的主体，又能区分真正自主的项目管理员或产品经理 Agent。

**Why this priority**：把所有自动化都建成 User 会制造虚构 email；把所有自动化都归到某个人又会失去撤销、归责和职责隔离。

**Independent Test**：分别使用人类 session、人类 scoped API key 与 Control-plane Agent credential 执行同一组允许/拒绝操作；验证前两者归属于人类 User，第三者归属于独立 AgentPrincipal，并且三者均受相同 Team/Project RBAC 决策约束。

**Acceptance Scenarios**：

1. **Given** 一个工具由已登录用户直接触发，**When** 工具使用该用户的 OAuth/session 或用户 API key 调用 Mystra，**Then** actor 记录为该 User，不额外创建 AgentPrincipal。
2. **Given** 用户创建 scoped API key，**When** key 被显示、使用、轮换或撤销，**Then** 明文只显示一次，持久状态只保留不可逆验证材料，且 key 权限不得超过创建者在绑定 Team 中的权限。
3. **Given** Team Owner 创建长期 Control-plane Agent，**When** Agent 获得 Project Admin、Product Manager 或其他允许角色，**Then** 系统创建不需要 email 的 AgentPrincipal，并为其分配显式 Team/Project RoleBinding。
4. **Given** Control-plane Agent 使用独立凭据登录，**When** 它调用 API、MCP 或 CLI 合同，**Then** 请求可识别 AgentPrincipal、Team、凭据和授权范围，不伪装成人类 User。
5. **Given** Agent credential 被轮换、过期、撤销或 AgentPrincipal 被停用，**When** 旧凭据再次使用，**Then** 请求在执行任何业务副作用前失败。
6. **Given** 人类 API key 或 Agent credential 不包含目标 Team/Project 权限，**When** 调用受保护操作，**Then** 返回稳定的 unauthenticated/forbidden 区分，不泄漏目标资源是否存在。

---

### User Story 4 - Sandbox Dev Agent 使用 Session 级工作负载身份（Priority: P1）

作为运行开发任务的 Dev Agent，我希望在 sandbox 中获得与当前 Session 绑定的短期能力，以便调用 Mystra 明确提供的外部通信或交付能力，而不继承人类或 Control-plane Agent 的长期凭据。

**Why this priority**：sandbox Agent 能执行代码；让它同时持有长期 Team 凭据会把一次 Session 的风险扩大为整个 Team 的持续风险。

**Independent Test**：启动一个 Session，在 sandbox 中使用短期 workload credential 调用允许的 Mystra capability；验证 audience、Session、Project、Team、expiry 和 capability 约束，随后完成或取消 Session 并确认旧凭据失效。

**Acceptance Scenarios**：

1. **Given** Runner 已合法 claim 一个 Session，**When** sandbox 启动，**Then** Mystra 为该 Session 派生短期 WorkloadIdentity/CapabilityGrant，而不是创建 User、Team membership 或长期 AgentPrincipal。
2. **Given** Dev Agent 调用 Mystra 提供的对外能力，**When** capability 与当前 Session、Project、Team、audience 和时限匹配，**Then** Mystra 代表该 workload 执行允许动作，并保留可定位到 Session 的 actor evidence。
3. **Given** workload token 尝试调用未授予 capability、其他 Project/Team 或 control-plane 管理操作，**When** 请求到达，**Then** 系统 fail closed，且不自动借用发起 Task 的人类权限。
4. **Given** Session 结束、取消、重新分配或 token 到期，**When** sandbox 再次调用，**Then** 旧 token 失效；重新执行必须获得新的 Session-bound credential。
5. **Given** 当前产品规格没有授权某种 Issue 写回、消息发送或其他外部副作用，**When** Dev Agent 请求该能力，**Then** 043 不因存在 workload identity 而自动扩大产品能力，必须由拥有该 capability 的独立规格启用。
6. **Given** sandbox 被检查，**When** 查找长期 OAuth token、API key、Agent credential 或平台 secret，**Then** 它们不得因 043 被注入；只允许当前 Session 所需的短期材料。

---

### User Story 5 - 在不更换 User 的前提下扩展认证因子与数据库（Priority: P2）

作为平台运营者或安全管理员，我希望未来可以为同一 User 增加 TOTP、Passkey、Email OTP、SMS OTP 和 One-Time Token，并在 SQLite、PostgreSQL 与 Supabase-backed PostgreSQL 上获得一致行为，以便增强认证而不分裂身份或形成数据库专用分支。

**Why this priority**：首期不需要同时交付全部因子，但如果基础模型只容纳密码或单一数据库，未来增强会变成账户迁移项目。

**Independent Test**：对三种受支持数据库 profile 运行同一套 schema parity、注册、登录、session、Team/RBAC 与插件兼容测试；在测试配置中启用每种未来因子并确认仍绑定已有 User，且不产生 phone-only、passkey-only 或重复 email User。

**Acceptance Scenarios**：

1. **Given** User 已通过 password 或 SSO 建立 verified-email 身份，**When** 后续注册 TOTP authenticator 或 Passkey，**Then** 新因子绑定现有 User，不创建新 User 或改变 email 外部业务 ID。
2. **Given** Email OTP 被用于登录、email verification 或密码恢复，**When** code 被创建和验证，**Then** code 短期有效、限制尝试次数、不可重复使用，并以不可逆形式持久保存。
3. **Given** SMS OTP 被启用，**When** 用户验证 phone number，**Then** phone 只能作为已存在 verified-email User 的认证或恢复因子；不得使用 synthetic email 创建 phone-only User。
4. **Given** One-Time Token 用于跨表面 session handoff，**When** token 被验证一次或过期，**Then** 它不能再次使用，且默认只能由受信服务端流程签发。
5. **Given** SQLite、PostgreSQL 或 Supabase-backed PostgreSQL 被选择，**When** 执行相同身份与授权场景，**Then** 公共行为、约束、错误语义和数据关系一致，不向调用方暴露数据库差异。

### Edge Cases

- email 比较必须 trim 并大小写不敏感，但不得实施 Gmail 点号、`+tag` 或其他 provider-specific 折叠。
- 用户更换 primary email 时，必须先验证新 email 并通过全局唯一检查；内部 User ID 和已绑定 provider subject 保持稳定。
- Google/GitHub provider subject 已绑定 User，但 provider 返回的 email 后续变化时，系统不得据此创建第二个 User或偷偷迁移 primary email。
- 同一 email 的未完成 invitation、重复 SSO callback 和并发注册必须收敛为一个 User/一个 membership 或明确冲突。
- GitHub primary email 为 private 时，只有 provider 返回的已验证 email 才能用于注册；无法取得时不猜测 noreply address。
- 被停用 User 仍可保留历史业务归属，但不能建立新 session、使用 API key 或接受新 RoleBinding。
- Team 删除、归档或 ownership 转移必须处理 Projects、memberships、AgentPrincipals 和 active Sessions；043 首期只允许归档，不实施级联硬删除。
- Role 被修改或归档时，既有 RoleBinding 的处理必须原子且可解释；不得使最后 Owner 保护失效。
- 多个 RoleBinding 的允许权限并集不得越过 Team 边界；Team role 不自动授予其他 Team 的同名 Project。
- authentication provider、短信/邮件发送服务或数据库暂时不可用时，不得创建半完成 User、factor、membership 或凭据。
- OTP、password、session token、API key、Agent credential、TOTP secret、backup code 和 OAuth client secret 不得进入 URL、日志、公共响应或验收证据。
- 时钟漂移、OTP 重放、WebAuthn challenge 重放、OAuth state 重放、session fixation 和 CSRF/origin mismatch 必须 fail closed。
- 旧 sandbox workload token 在 Session retry、reassignment 或 cancellation 后不得恢复有效。

## Requirements

### Functional Requirements

#### Human identity and account lifecycle

- **FR-001**：系统 MUST 为每个人类 User 生成稳定内部 ID，并将规范化、已验证的 email 作为平台范围内唯一外部业务 ID；email 不得作为数据库主键或 OAuth provider identity key。
- **FR-002**：系统 MUST 保存每个登录方式的稳定 provider subject；Google 使用其稳定 subject，GitHub 使用稳定 numeric identity，password/username 作为本地 credential account。
- **FR-003**：同一 `provider + providerSubject` MUST 只绑定一个 User；一个 User MAY 显式关联多个登录方式。
- **FR-004**：相同 email 的不同 provider account MUST NOT 静默关联；用户必须先通过已有方式认证，再显式添加新登录方式。
- **FR-005**：Hosted SaaS MUST 支持 Google 与 GitHub SSO 注册/登录，并要求 provider 提供已验证 email；stock self-hosted MUST 支持 email + username + password 注册/登录。
- **FR-006**：Hosted 与 self-hosted MUST 由可信 deployment profile 选择公开登录方式；客户端输入、Host header 或环境变量是否齐全不得提升 capability。
- **FR-007**：stock self-hosted 首位注册用户 MUST 初始化首个 Team 并成为 Owner；完成初始化后匿名注册 MUST 默认关闭，后续用户通过 invitation 注册，除非部署策略显式开放。
- **FR-008**：Hosted 新用户首次登录后 MUST 能创建 Team 或接受已发送至同一 email 的 invitation；一个 User MUST 能加入多个 Team。
- **FR-009**：系统 MUST 支持登录、退出、当前 session 查询、session 撤销与账户停用；停用后所有登录方式、session 和用户 API key MUST fail closed。
- **FR-010**：primary email 变更 MUST 验证新 email、保证全局唯一并保留内部 User ID；不得通过 provider profile update 隐式改变 primary email。
- **FR-011**：username MUST 是 self-hosted 登录别名而不是外部身份主键；username 冲突不得改变 email 唯一规则。
- **FR-012**：注册、登录、找回与 invitation 流程 MUST 防止 email/username 枚举，并对暴力尝试、重放、CSRF 与不可信 origin 实施 fail-closed 保护。

#### Team, Role and authorization

- **FR-013**：Team MUST 是 Mystra 顶层租户；`workspace` 不得被用作 tenancy 同义词。
- **FR-014**：TeamMembership MUST 将一个 User 或长期 AgentPrincipal 关联到一个 Team，并保存状态与生命周期；Sandbox WorkloadIdentity MUST NOT 成为 TeamMembership。
- **FR-015**：系统 MUST 提供稳定 permission catalog；公共 API、MCP、CLI 与 Web 必须使用同一 permission 语义。
- **FR-016**：系统 MUST 提供不可删除的内置 Team roles（Owner、Admin、Member）以及满足 Control-plane Agent 工作的 Project-scoped roles（至少 Project Admin、Product Manager、Developer）。
- **FR-017**：RoleBinding MUST 将 Principal、Role 和作用域明确关联；作用域 MUST 至少支持 Team 与 Project，不得依赖当前 UI route 推断。
- **FR-018**：一个 Principal MAY 在同一 Team 拥有多个 RoleBinding；MVP 有效权限为所有适用 allow permissions 的并集，不支持 deny rule、ABAC 或通用 policy DSL。
- **FR-019**：系统 MUST 保护每个 Team 至少一名有效 Owner；最后 Owner 不得被移除、停用、降级或退出。
- **FR-020**：所有受保护的 API、MCP、CLI 与 Web 操作 MUST 在服务端解析 Principal、Team context、目标资源作用域和 effective permissions；缺失或歧义时 fail closed。
- **FR-021**：未认证请求 MUST 使用稳定 unauthenticated 语义；已认证但未授权请求 MUST 使用稳定 forbidden 语义，并避免通过错误差异泄漏跨 Team 资源存在性。
- **FR-022**：membership、Role 与 RoleBinding 变更 MUST 对新请求立即生效；长时 operation 必须在发生外部副作用前重新确认必要权限。
- **FR-023**：Team Owner MUST 能邀请、查看、停用和移除成员，查看并分配内置 Role；自定义 Role 的创建、修改和归档 MAY 作为后续 slice，但数据与合同不得阻止该扩展。
- **FR-024**：Team 及其 membership、Role、RoleBinding 和 AgentPrincipal 首期 MUST 支持归档/停用而非无条件硬删除，以保留既有 Task、Session 与 Project 的历史归属。

#### Human API keys and Control-plane Agents

- **FR-025**：人驱动 Agent 或工具 MAY 使用人的 OAuth/session 或 user-owned API key；这种调用的 Principal MUST 是 User，不创建额外 AgentPrincipal。
- **FR-026**：用户 API key MUST 绑定 User、Team、显式权限、创建时间、可选过期时间与状态；权限不得超过创建者在该 Team 的有效权限。
- **FR-027**：API key 明文 MUST 只在创建时显示一次；持久状态只能保存不可逆验证材料、安全前缀和非秘密元数据，并支持轮换、撤销、过期和最后使用时间。
- **FR-028**：长期在 Control Plane 活动的非人类主体 MUST 使用独立 AgentPrincipal；AgentPrincipal MUST 不要求或伪造 email。
- **FR-029**：AgentPrincipal MUST 归属于明确 Team，并通过 RoleBinding 获得 Team/Project 权限；其 credential 生命周期 MUST 独立于创建者的人类 session。
- **FR-030**：Agent credential 或 OAuth client credential MUST 支持一次性展示、不可逆持久验证、明确 audience/scope、短期 access token、轮换、撤销和过期；自主 Agent 不得依赖无限期 human refresh token。
- **FR-031**：当前不稳定的 Agent-specific authentication extension MUST NOT 成为首期生产前置；首期必须使用稳定、可替换的 OAuth/API credential 合同并保持 Mystra-owned AgentPrincipal 领域边界。

#### Sandbox workload identity and capabilities

- **FR-032**：Runner 只有在合法 claim Session 后才能请求 Session-bound WorkloadIdentity/CapabilityGrant；credential MUST 绑定 Session、Task、Project、Team、Runner、audience、capabilities、签发与过期时间。
- **FR-033**：Sandbox workload credential MUST 短期、最小权限、不可用于普通 Team membership 或 Control-plane 管理，并在 Session 完成、取消、重新分配或到期时失效。
- **FR-034**：Sandbox Agent 对外产生副作用 MUST 通过 Mystra 明确提供的 capability boundary；每次调用 MUST 能归属到 WorkloadIdentity 和 Session，而不是借用人类或 AgentPrincipal 长期凭据。
- **FR-035**：043 MUST NOT 因引入 workload identity 自动启用当前产品边界排除的 Issue write-back、任意消息发送、callback 或通用外部网络能力；每项 capability 仍由其拥有规格显式授权。
- **FR-036**：长期人类、Integration、Agent 或平台 secrets MUST NOT 注入 sandbox；允许的短期 workload material 必须通过现有 runtime secret hygiene 边界交付。

#### Framework, persistence and future factors

- **FR-037**：认证引擎 MUST 使用 Better Auth 的稳定发布版；Mystra MUST 在其外部提供自有 Auth/Identity boundary，Better Auth 类型不得泄漏到 shared、API、MCP、CLI、Web 或 Runner 公共合同。
- **FR-038**：Team、Role、Permission、RoleBinding、AgentPrincipal 与 WorkloadIdentity MUST 是 Mystra-owned 领域模型；不得让 Better Auth Organization/Team 模型成为产品真相来源。
- **FR-039**：SQLite、PostgreSQL 与 Supabase-backed PostgreSQL MUST 提供相同行为和数据关系；Supabase MUST 复用 PostgreSQL profile，不形成第二条 Auth 或 Data API 持久化路径。
- **FR-040**：Prisma MUST 是认证及授权关系数据的 schema、migration 与 runtime access owner；Better Auth 的 schema generator MAY 作为模型输入或 drift check，但 Better Auth MUST NOT 绕过 040 的 Prisma migration history 自行迁移生产数据库。
- **FR-041**：两套 provider-specific Prisma schema/migration history MUST 覆盖相同 Auth、Team 与 RBAC 逻辑模型，并通过自动 parity 检查阻止无意漂移。
- **FR-042**：实现 MUST 保留未来启用 TOTP/2FA、Passkey、Email OTP、SMS OTP 与 One-Time Token 所需的稳定 User/factor 关联和 schema extension path，但这些因子不要求在首个 implementation slice 全部上线。
- **FR-043**：TOTP 与 backup material MUST 加密或不可逆保护；OTP、One-Time Token 与 recovery material MUST 默认不可逆保存、短期有效、限制尝试并防止重放。
- **FR-044**：Passkey MUST 绑定已有 verified-email User；SMS OTP MUST 绑定已有 verified-email User 的已验证 phone number；首期及后续默认模式不得创建 passkey-only 或 phone-only User。
- **FR-045**：未来对敏感操作启用 step-up authentication 时，Role 修改、Owner 转移、API key/Agent credential 创建和账户恢复 MUST 能要求近期认证或更强因子，而不更换 User identity。

#### Product surfaces, dependencies and migration

- **FR-046**：Settings MUST 将 Account、Team、Members/Roles 与 Agent credentials 显示为真实可用、只读或 prerequisite-unavailable 状态；不得呈现无持久化/API 支持的假写入。
- **FR-047**：登录、注册、邀请、账户关联、Team/member/role 管理与 credential 管理的用户可见文案 MUST 支持英语和简体中文，并满足键盘、焦点、错误播报与窄屏重排要求。
- **FR-048**：043 的 implementation MUST 等待 040 Prisma RDB ownership 落地，并在 041 GitHub Integration schema 冻结后吸收其最终数据模型；不得从当前临时 schema 生成永久 baseline。
- **FR-049**：043 开始 implementation 前 MUST 显式修订 5xP/constitution 中 caller auth、Team administration 和 hosted multi-tenancy 的旧排除项，并说明 self-host 与 Hosted 的差异。
- **FR-050**：迁移 MUST 保留现有 Project、Task、Session、Runner 和 IntegrationConnection ID/关系；未知或混合 schema MUST fail closed，不得通过身份迁移顺便重建业务数据。

### Key Entities

- **User**：一个人类账户；拥有稳定内部 ID、唯一 verified primary email、显示资料、状态和时间信息。一个 User 可加入多个 Team。
- **ExternalIdentity**：User 与 password、Google 或 GitHub 登录身份的绑定；以 provider 与稳定 provider subject 唯一识别，不以 email 替代 provider subject。
- **AuthSession**：一次有过期时间、可撤销的 User 认证会话；保存必要的安全状态，不成为业务活动对象。
- **UserApiKey**：代表一个 User 在指定 Team 范围调用 Mystra 的可轮换凭据；只保存不可逆验证材料和非秘密元数据。
- **Team**：Mystra 顶层租户，拥有 Projects、memberships、roles 和 Team-scoped AgentPrincipals。
- **TeamInvitation**：发送至唯一 email 的短期、一次性 Team 加入意图；接受后收敛到既有或新建 User。
- **TeamMembership**：User 或 AgentPrincipal 在 Team 中的成员关系与状态；不直接等同于 Role。
- **Permission**：平台定义的稳定、机器可读操作能力；公共管理表面共享同一 catalog。
- **Role**：命名 permission 集合；包含内置 Team/Project roles，并为未来 Team 自定义 role 留出扩展面。
- **RoleBinding**：将 Principal、Role 与 Team 或 Project 作用域关联的授权事实。
- **AgentPrincipal**：长期在 Control Plane 活动的非人类主体；没有 email，通过独立 credential 和 RoleBinding 行动。
- **AgentCredential**：AgentPrincipal 的可轮换、可撤销认证材料或 OAuth client binding；不作为 User password/account。
- **WorkloadIdentity**：一次 Session 执行期间的短期 sandbox actor；不是 Team member，不在 Session 之外复用。
- **CapabilityGrant**：WorkloadIdentity 对特定 audience 和能力的最小授权，绑定 Session/Task/Project/Team/Runner 与有效期。
- **AuthenticationFactor**：未来绑定 User 的 TOTP、Passkey、Email OTP、SMS OTP 或 recovery/handoff factor；不改变 User identity。

## Scope

### In scope — first implementation slice

- Better Auth 认证边界与 Prisma-owned Auth schema 集成。
- Hosted Google/GitHub SSO；stock self-hosted email/username/password。
- User、ExternalIdentity、session、显式账户关联和 email 唯一规则。
- self-host 首位 Owner bootstrap、后续 invitation 默认模式。
- Team、TeamMembership、内置 Team/Project roles、RoleBinding、permission enforcement。
- 人类 scoped API keys 与长期 Control-plane AgentPrincipal/credential。
- Session-bound sandbox WorkloadIdentity/CapabilityGrant 基础合同和现有允许 capability 的鉴权接入。
- Account 与 Team Settings 的真实状态和最小管理流程；API/MCP/CLI 仍优先于 Web。
- SQLite、PostgreSQL、Supabase-backed PostgreSQL parity 与迁移安全。

### In scope — extension-ready, later slices

- Team 自定义 Role 管理。
- TOTP/2FA、Passkey、Email OTP、SMS OTP 与 One-Time Token。
- 敏感操作的 step-up authentication、recovery 和 trusted-device policy。

### Out of scope

- SAML、SCIM、LDAP/Active Directory、企业目录同步和 Google/GitHub 以外的 Hosted social providers。
- phone-only、passkey-only、anonymous 或 synthetic-email User。
- 通用 ABAC/ReBAC policy engine、deny rules、任意条件表达式或客户自定义 policy DSL。
- 把 Better Auth Organization/Team、Supabase Auth 或第三方 IAM 的租户模型作为 Mystra 领域真相。
- 使用当前不稳定 Agent Auth 插件作为生产身份根。
- Runner 作为 Team Principal；Runner 继续是稳定执行容量业务对象。
- 因 workload identity 自动扩大 Issue write-back、webhook、callback、日志 API、公共 activity timeline 或任意外部通信范围。
- 本规格阶段实施、迁移或部署代码；043 implementation 仍受 040/041 前置阻塞。

## Assumptions & Dependencies

- Owner 已确认三类执行归属：人驱动 Agent 沿用人的 OAuth/API key；长期 Control-plane Agent 使用独立主体；Sandbox Dev Agent 使用 Session-scoped 工作负载身份。
- Owner 已确认认证框架必须同时支持 SQLite、PostgreSQL 与 Supabase-backed PostgreSQL，并能扩展 TOTP/2FA、Passkey、Email OTP、SMS OTP 和 One-Time Token。
- `email` 的唯一性只适用于人类 User；AgentPrincipal、Runner 和 WorkloadIdentity 不使用或伪造 email。
- self-hosted 初始化后的邀请制是安全默认；是否允许匿名注册由显式部署策略决定。
- User 可加入多个 Team；每次请求只有一个明确 Team context。
- MVP 允许多个适用 RoleBinding 并取 allow permission 并集；不引入 deny 语义。
- Better Auth 使用 planning 时验证的稳定版本；当前调研基线为 1.6.26，具体 pin 留给 `/speckit.plan`。
- Better Auth Prisma adapter 只生成 schema，不拥有迁移；040 的 Prisma schema/migration history 是唯一持久化事实来源。
- 040 当前已有 spec/plan/engineering review 但尚未实施；041 当前 schema 仍处于未提交实现状态，因此 043 可评审但不可开始 implementation。
- Email/SMS delivery provider、Hosted OAuth application credentials 与生产 KMS/SecretProvider 由部署 composition root 注入，不成为 Team 可编辑秘密。

## Success Criteria

### Measurable Outcomes

- **SC-001**：Hosted 新用户可在 2 分钟内使用 Google 或 GitHub 完成注册/登录并进入 Team 创建或 invitation 接受流程；self-host 首位用户可在 3 分钟内完成初始 Team bootstrap。
- **SC-002**：同一规范化 email 通过 password、Google、GitHub 和并发 callback 测试后，持久 User 数始终为 1；未经显式账户关联的 provider 不会被静默绑定。
- **SC-003**：API、MCP、CLI 与 Web 对同一 Principal、Team、resource 和 RoleBinding 测试矩阵的 allow/deny 结果一致率为 100%。
- **SC-004**：跨 Team、跨 Project、最后 Owner、停用 membership、撤销 RoleBinding 和资源存在性泄漏测试均 100% fail closed。
- **SC-005**：人类 session/API key、Control-plane Agent credential 与 Sandbox workload token 的 actor 分类准确率为 100%；不存在 synthetic-email Agent User。
- **SC-006**：Session 结束、取消、重新分配或 workload token 到期后，旧 sandbox credential 成功调用数为 0。
- **SC-007**：password、OTP、session token、API key、Agent credential、TOTP secret、backup code、OAuth secret 和 One-Time Token 在日志、URL、公共响应、UI DOM 和验收证据中的明文泄漏计数为 0。
- **SC-008**：SQLite、PostgreSQL 与 Supabase-backed PostgreSQL 运行同一身份/RBAC contract suite，核心场景通过率均为 100%，schema parity gate 无未记录差异。
- **SC-009**：stock self-hosted 公开登录表面中的 Google/GitHub SSO 可执行入口计数为 0；Hosted 默认公开 username/password 注册入口计数为 0。
- **SC-010**：Account、Team、Members/Roles 与 Agent credential 流程在 320 / 768 / 1024 / 1440px 视口和键盘操作下没有不可达主要操作或页面级水平滚动。
- **SC-011**：在不创建第二个 User 的前提下，测试配置可分别注册并验证 TOTP 与 Passkey，且 Email OTP、SMS OTP 和 One-Time Token 均满足一次性、过期和尝试限制合同。
- **SC-012**：043 implementation 开始前，040 已落地、041 schema 已冻结且 5xP/constitution 的 caller auth 与 Team administration 边界已显式更新；缺少任一前置时启动检查必须失败。
