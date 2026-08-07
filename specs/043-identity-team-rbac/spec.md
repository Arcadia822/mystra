# 功能规格：开源本地用户、Team 与 RBAC

**Feature Number**: `043`
**Feature Directory**: `specs/043-identity-team-rbac`
**Working Branch**: `main`（Owner 明确要求在当前 branch 更新 043；后续 Spec-Kit 命令必须显式设置 `SPECIFY_FEATURE=043-identity-team-rbac`）
**Created**: 2026-08-06
**Status**: Draft — ready for owner review；implementation waits for 040 Prisma RDB integration and product-boundary amendment
**Goal**: 开源 Mystra 部署后直接进入本地登录页；Human User 使用 username/password 登录和注册，每个 User 注册时自动获得一个由自己拥有的初始 Team，并可切换、创建、重命名和删除 Team（始终至少保留一个可用 Team）；Account Settings 支持修改 password 与 display name，Team Settings 支持成员增删和角色管理。
**Input**: 外部安装流程未来负责提供默认 `admin/admin` 与该用户的一个初始 Team；043 不实现安装器或 seed 命令，只定义并消费部署完成后的 bootstrap contract。self-host 不引入 email。SaaS/SSO、Agent authentication、Agent key、Sandbox workload identity 与强认证因子本期不做。

## 用户场景与验收

### User Story 1 - 登录、注册与维护本地账户（Priority: P1）

作为开源 Mystra 的人类用户，我希望部署后进入登录页，以 username/password 登录或注册，并能修改 password 与 display name，以便无需 email 或外部身份服务即可维护自己的账户。

**Why this priority**：登录是所有 Team 与 RBAC 操作的入口。默认凭据如果不强制更换，则也是所有人的入口……这种对称性不值得保留。

**Independent Test**：使用安装流程预置的 `admin/admin` 登录，验证首次登录强制修改 password；注册第二个 User，验证其初始 Team 自动创建且创建者为 Owner；修改 display name 和 password，验证旧 password 与被撤销 session 不再可用。

**Acceptance Scenarios**：

1. **Given** 部署已按 bootstrap contract 预置 `admin/admin` 与其初始 Team，**When** 浏览器首次打开 Mystra，**Then** 默认进入登录页，不自动进入应用 shell。
2. **Given** `admin` 使用默认 password `admin` 登录，**When** credential 验证成功，**Then** 系统只允许进入强制修改 password 流程，完成后才允许访问 Team 资源。
3. **Given** 初始化已完成，**When** 新用户提交唯一 username 和有效 password 注册，**Then** 系统原子创建 User、其初始 Team、Owner membership 与 session。
4. **Given** User 已注册，**When** 使用正确 username/password 登录，**Then** 系统建立可撤销 session 并恢复或选择一个有效 Team context。
5. **Given** User 在 Account Settings 修改 display name，**When** 保存成功，**Then** 新 display name 出现在 shell、成员列表和账户页面；唯一登录 username 保持不变。
6. **Given** User 在 Account Settings 提交当前 password 和符合策略的新 password，**When** 修改成功，**Then** 旧 password 失效，除当前 session 外的其他 session 默认撤销。
7. **Given** 规范化 username 已被占用，**When** 串行或并发重复注册发生，**Then** 最多创建一个 User/初始 Team，其他请求返回稳定冲突，不产生孤儿 Team 或 membership。
8. **Given** password 错误、User 停用或 session 已撤销，**When** 请求受保护资源，**Then** 系统在业务副作用前 fail closed，并避免泄漏账户是否存在。

---

### User Story 2 - 使用和管理自己的 Team（Priority: P1）

作为已登录 User，我希望注册后立即拥有一个可用的初始 Team，并能创建、切换、重命名和删除 Team，以便将不同协作范围分开管理，同时始终至少保留一个可用 Team。

**Why this priority**：Team 是 Mystra 的租户边界；如果用户无法明确切换 Team，系统将非常高效地把正确数据写进错误租户。

**Independent Test**：注册 User 并验证初始 Team 自动创建且创建者为 Owner；创建两个 Team，在 shell 中切换并刷新页面；重命名 Team；删除一个非唯一 Team；验证仅剩的最后一个 active Team 不可删除、不可退出。

**Acceptance Scenarios**：

1. **Given** 任意 Human User 创建成功，**When** 读取其 Team 列表，**Then** 系统至少存在一个由该 User 拥有的 active Team（注册事务原子创建的初始 Team）。
2. **Given** User 位于任意 Team，**When** 打开 Team switcher，**Then** 列表只显示其 active memberships，并清楚标识当前 Team。
3. **Given** User 选择另一个 Team，**When** 切换完成或刷新页面，**Then** 后续导航和请求使用新 Team context；无权或已删除 Team 不得恢复为 active context。
4. **Given** User 创建新 Team，**When** 提交有效名称，**Then** 系统创建 Team，并将创建者设为 Owner 后切换或提供明确进入动作。
5. **Given** Owner 修改自己某个 Team 的 display name，**When** 保存成功，**Then** switcher、Settings 和成员页面显示新名称；Team 的内部 ID 与 owner 关系不变。
6. **Given** Owner 管理一个 Team，且自己还属于至少一个其他 active Team，**When** 确认删除，**Then** Team 被归档并从所有成员的 switcher 中消失，历史业务归属保持可追溯。
7. **Given** 某 Team 是当前 User 唯一的 active Team，**When** User 查看或调用删除/退出动作，**Then** 该动作不可用并返回稳定原因，保证 User 不会变成零 Team。
8. **Given** 当前 Team 被其他 Owner 删除或当前 membership 被移除，**When** User 发起下一请求，**Then** 系统切换到另一个有效 Team 或要求选择，不继续使用失效 Team context。

---

### User Story 3 - 在 Settings 管理 Team 成员与角色（Priority: P1）

作为 Team Owner 或具备成员管理权限的 Admin，我希望在 Settings 的 Team Members 页面按 username 添加或移除已有 User，并设置 Owner、Admin、Member 角色，以便用一个清晰的页面维护 Team 访问权。

**Why this priority**：RBAC 只有在成员与角色可管理、服务端又真正执行时才存在。其余情况通常称为“下拉框”。

**Independent Test**：在多个 Team 中分别添加已有 User、修改角色、移除成员；验证 Owner/Admin/Member 权限矩阵、最后 Owner 保护，并确认 API、MCP、CLI 与 Web 的授权结果一致。

**Acceptance Scenarios**：

1. **Given** Owner 打开 Settings > Team > Members，**When** 页面加载，**Then** 列表显示 display name、username、role、membership status 和允许操作，并提供清晰的空、加载、失败与无权状态。
2. **Given** Owner 或有权限的 Admin 输入已存在的准确 username，**When** 添加成员，**Then** 系统创建唯一 TeamMembership，不要求或查询 email。
3. **Given** username 不存在或 User 已是成员，**When** 提交添加，**Then** 系统返回稳定 not-found 或 conflict，不创建重复 membership。
4. **Given** Owner 修改成员角色，**When** 保存成功，**Then** 新请求立即按更新后的 Team Role 计算权限；Web 隐藏按钮不能替代服务端 enforcement。
5. **Given** Admin 管理成员，**When** 尝试授予/移除 Owner、修改 Owner 或删除 Team，**Then** 系统拒绝；这些动作只允许 Owner。
6. **Given** Team 只剩一名有效 Owner，**When** 尝试移除、停用或降级该 Owner，**Then** 系统拒绝，直到先产生另一名有效 Owner。
7. **Given** membership 被移除或停用，**When** User 再次请求 Team 资源，**Then** 新请求立即失败，Team 从其 switcher 中移除。

### Edge Cases

- username 必须 trim、按稳定规则规范化并大小写不敏感唯一；仅改变大小写不得创建第二个 User。
- login username 与 display name 是不同字段：username 首期只读且唯一；display name 可修改、可重复、不可用于登录。
- 默认 `admin/admin` 只能来自部署 bootstrap contract；应用运行时不得在数据库为空时静默自建默认管理员。
- 默认 password 尚未修改时，除修改 password、退出与读取最小账户状态外的受保护操作全部拒绝。
- 注册事务必须原子创建 User 与其初始 Team 及 Owner membership；失败时不得只留下 User 或只留下 Team。
- Team 的显示名称可以重复；内部 Team ID 是租户边界，不得用名称解析授权。
- Team switcher 只列出 active memberships；被移除、停用或归档 Team 不能由缓存恢复。
- Team 删除是可审计归档而非数据库级联硬删除；历史 Project、Task 和 Session 仍保留 Team ID。
- 每个 active User 始终至少属于一个 active Team：唯一 active Team 不可删除、不可退出，因此不存在零 Team 的有效 User。
- Role 变更和 membership 删除必须使新请求立即失效；长时操作在外部副作用前重新确认权限。
- password、session token 和 bootstrap secret 不得进入 URL、日志、公共响应或验收证据。
- 数据库暂时不可用时，不得创建半完成 User、Team、membership、role binding 或 session。
- Team Members 的 Castrel AI 视觉参考尚未提供具体路径或截图；043 当前只锁定信息结构和行为，不声称完成视觉对齐。

## Requirements

### Functional Requirements

#### Bootstrap contract, local auth and account settings

- **FR-001**：043 MUST 从登录页开始；未认证用户访问受保护 route 时 MUST 被引导到登录页，并保留安全的 return destination。
- **FR-002**：部署完成后的外部 bootstrap contract MUST 提供 username `admin`、初始 password `admin`、对应 Human User 与该用户的一个初始 Team（默认 display name 由 bootstrap 指定，例如 `Default`）及其 Owner membership；043 MUST NOT 实现 installer 或 seed orchestration。
- **FR-003**：默认 `admin` User MUST 标记为 required-password-change；首次成功认证后，在 password 修改完成前只能访问最小账户安全流程。
- **FR-004**：应用运行时 MUST NOT 因数据库为空而静默创建或重建 `admin/admin`；bootstrap 缺失时 MUST fail closed 并报告 installation incomplete。
- **FR-005**：系统 MUST 为每个人类 User 生成稳定内部 ID；内部 ID 是所有关系和未来扩展的身份锚点。
- **FR-006**：每个 User MUST 拥有平台范围内大小写不敏感唯一的 username；username 是首期唯一外部登录标识，首期不可修改。
- **FR-007**：每个 User MUST 拥有可修改、可重复的 display name；display name 不得用于认证、唯一性判断或授权。
- **FR-008**：self-host User 模型、注册、登录、成员管理和恢复表面 MUST NOT 要求、保存、推导或查询 email。
- **FR-009**：本地注册 MUST 只收集 username 与 password，并在同一事务中创建 User、初始 Team、Owner membership 与 session。
- **FR-010**：系统 MUST 支持 username/password 登录、退出、当前 session 查询、指定 session 撤销与账户停用。
- **FR-011**：Account Settings MUST 支持修改 display name，并在保存后对 shell、Team Members 与账户表面使用一致 projection。
- **FR-012**：Account Settings MUST 支持使用当前 password 修改 password；成功后旧 password 立即失效，除当前 session 外的其他 session 默认撤销。
- **FR-013**：password MUST 使用经过审查的自适应 password hashing；系统不得保存、记录或返回明文 password。
- **FR-014**：username normalization、长度、字符集和保留字 MUST 在 shared contract 中稳定定义，并在所有数据库 profile 上一致执行。
- **FR-015**：注册与登录 MUST 防止 username 枚举，并对暴力尝试、session fixation、重放、CSRF 和不可信 origin 实施 fail-closed 保护。
- **FR-016**：首期 MUST NOT 提供 email verification、email invitation 或 email password reset；未实现本地 recovery 时，UI MUST 显示明确 unavailable。

#### Team lifecycle and active context

- **FR-017**：每个 active User MUST 始终至少属于一个 active Team；系统 MUST 阻止任何会使该 User 变为零 Team 的删除、退出或移除动作。
- **FR-018**：新 User 注册事务 MUST 原子创建一个初始 Team 并将该 User 设为其 Owner；该初始 Team 与其他 Team 同构，可改名、可删除、可转移 Owner，没有特殊不可删类别。
- **FR-019**：Team MUST 是 Mystra 顶层租户；`workspace` 不得被用作 tenancy 同义词。
- **FR-020**：系统 MUST 提供 Team switcher，列出当前 User 的 active TeamMembership，标识当前 Team，并允许切换 active Team context。
- **FR-021**：active Team context MUST 持久保存并由服务端验证；无权、已停用或已归档 Team MUST fail closed，并回退到另一个有效 Team 或明确选择流程。
- **FR-022**：任意 User MUST 能创建普通 Team；创建者 MUST 原子成为该 Team Owner。
- **FR-023**：Owner MUST 能修改自己 Team 的 display name；Team display name MAY 重复且不得参与授权解析。
- **FR-024**：Owner MUST 能删除 Team；用户可见“删除” MUST 实现为可审计归档并从 active switcher 移除，不得级联硬删除历史业务记录。
- **FR-025**：任何 Team 若是某 User 唯一的 active Team，其删除与退出动作 MUST 对该 User 不可用，以保证该 User 不会变为零 Team。
- **FR-026**：Team 删除 MUST 要求 Owner permission、显式确认与稳定冲突处理；Admin 和 Member 不得删除 Team。
- **FR-027**：Team 删除或 membership 失效后，所有表面 MUST 在下一请求停止使用该 Team context；客户端缓存不得继续授权。

#### Team Members and RBAC

- **FR-028**：TeamMembership MUST 将一个 Human User 关联到 Team，并保存 active/disabled 状态与生命周期；首期 Principal 类型仅为 User。
- **FR-029**：Settings MUST 提供 Team Members 页面，至少显示 display name、username、role、membership status 与当前操作者允许的 actions。
- **FR-030**：Owner 与具备成员管理 permission 的 Admin MUST 能通过准确 username 查找已有 User 并添加唯一 TeamMembership；该流程不得依赖 email 或外部目录。
- **FR-031**：Owner MUST 能移除或停用普通成员；Admin MAY 管理 Member，但 MUST NOT 修改 Owner、授予 Owner 或移除 Owner。
- **FR-032**：系统 MUST 提供不可删除的内置 Team roles：Owner、Admin、Member；首期不要求自定义 Role 或 Project-scoped Role。
- **FR-033**：Permission catalog MUST 稳定定义至少 Team settings、member management、role management、Team deletion 与普通 Team resource access；API、MCP、CLI 与 Web MUST 使用相同语义。
- **FR-034**：RoleBinding MUST 将 User、Role 与 Team 明确关联；一个 membership 首期只有一个 active Team Role。
- **FR-035**：Owner MUST 能将普通成员角色设置为 Owner、Admin 或 Member；变更对新请求立即生效。
- **FR-036**：系统 MUST 保护每个 Team 至少一名有效 Owner；最后 Owner 不得被移除、停用、降级或退出。
- **FR-037**：Owner MAY 将 Team ownership 转移给其他成员或退出 Team，但该操作 MUST NOT 违反每 Team 至少一名有效 Owner（FR-036）与每 User 至少一个 active Team（FR-017）的保护。
- **FR-038**：所有受保护的 API、MCP、CLI 与 Web 操作 MUST 在服务端解析 User、Team context、目标资源和 effective permissions；客户端隐藏按钮不能替代 enforcement。
- **FR-039**：未认证请求 MUST 使用稳定 unauthenticated 语义；已认证但未授权请求 MUST 使用稳定 forbidden 语义，并避免泄漏跨 Team 资源存在性。
- **FR-040**：Team Members 页面 MUST 提供 loading、empty、error、read-only/forbidden、add conflict 与 last-owner conflict 状态。

#### Framework, persistence and extension boundaries

- **FR-041**：Human Auth engine MUST 使用 Better Auth 稳定发布版，并仅启用 username/password 与 session 所需能力；Better Auth 类型不得泄漏到公共合同。
- **FR-042**：Team、Membership、Role、Permission 与 RoleBinding MUST 是 Mystra-owned 领域模型；Better Auth Organization/Team 不得成为产品真相来源。
- **FR-043**：SQLite、PostgreSQL 与 Supabase-backed PostgreSQL MUST 提供相同行为和数据关系；Supabase MUST 复用 PostgreSQL profile，不形成 Supabase Auth 或 Data API 旁路。
- **FR-044**：Prisma MUST 是身份与授权关系数据的 schema、migration 与 runtime access owner；Better Auth MUST NOT 绕过 Prisma migration history。
- **FR-045**：SQLite 与 PostgreSQL Prisma schema MUST 覆盖相同 Auth、Team 与 RBAC 逻辑模型，并通过自动 parity 检查阻止无意漂移。
- **FR-046**：开源仓库 MUST NOT 提供 SaaS deployment profile、Google/GitHub SSO、social login、caller-login OAuth adapter、route、配置项或 UI 入口。
- **FR-047**：未来认证因子 MUST 通过稳定内部 User ID 关联；043 MUST NOT 预建 TOTP、Passkey、Email/SMS OTP 或 One-Time Token 的流程、可执行 UI 或首期验收。
- **FR-048**：未来平台内部 Agent 如需参与 RBAC，MUST 通过可扩展 Principal contract 增加；043 MUST NOT 实现 AgentPrincipal、Agent key、Agent login 或 Sandbox workload identity。
- **FR-049**：Account、Team、Team Members 与 Roles Settings MUST 显示真实可用、只读或 prerequisite-unavailable 状态，并支持英语、简体中文、键盘、焦点、错误播报与窄屏重排。
- **FR-050**：043 implementation MUST 等待 040 Prisma RDB ownership 合入 `main`，并以已经落地的 041 数据模型为当前基线。
- **FR-051**：043 implementation 前 MUST 修订 5xP/constitution 中 caller auth 与 Team administration 的旧排除项；SaaS/hosted multi-tenancy 保持在本仓库范围外。
- **FR-052**：在版本达到 `0.1.0` 前，身份 schema MUST 直接替换过时开发合同并同步更新调用方、fixtures、tests 与文档；MUST NOT 为旧开发快照添加 migration、alias、fallback 或 dual-read/dual-write compatibility path。

### Key Entities

- **User**：Human 本地账户；拥有稳定内部 ID、唯一 login username、可重复 display name、password-change-required 状态、账户状态和时间信息，不包含 email。
- **LocalCredentialAccount**：User 的 username/password 登录绑定；只保存 password hash 和必要安全元数据。
- **AuthSession**：有过期时间、可撤销的 User 认证会话；保存 active Team context 或其安全引用。
- **Team**：Mystra 顶层租户；包含稳定 ID、可重复 display name、状态和时间信息；所有 Team 同构，无特殊类别。
- **TeamMembership**：Human User 在 Team 中的成员关系、状态和 Team Role。
- **Permission**：平台定义的稳定、机器可读操作能力。
- **Role**：首期固定为 Owner、Admin、Member 的命名 permission 集合。
- **RoleBinding**：TeamMembership 与一个 active Team Role 的授权事实。

### Extension concepts — not entities in the first slice

- **AuthenticationFactor**：未来可能绑定内部 User ID 的强认证因子；043 不创建其表、流程或 UI。
- **Agent Principal / Workload Identity**：未来可能进入平台 RBAC 的内部 Agent 或 Session actor；043 不创建 credential、membership、token 或 capability grant。

## Scope

### In scope — first implementation slice

- 部署完成后进入登录页，并消费外部 installer 提供的 `admin/admin` + 初始 Team bootstrap contract。
- 默认 admin 首次登录强制修改 password。
- username/password 注册、登录、session、退出、撤销和停用。
- Account Settings 修改 password 与 display name；login username 首期只读。
- 每 User 注册即获得一个由自己拥有的初始 Team（可改名、可加人、可删除、可转移）。
- Team switcher、创建 Team、重命名 Team、归档删除 Team；User 的唯一 active Team 不可删除或退出。
- Settings > Team Members：按 username 添加、移除/停用成员并设置 Owner/Admin/Member。
- Team-level permission enforcement、最后 Owner 保护、每 User 至少一个 active Team 保护。
- SQLite、PostgreSQL、Supabase-backed PostgreSQL parity。

### Extension-ready only — no implementation in 043

- 自定义 Role 与 Project-scoped Role。
- TOTP/2FA、Passkey、Email/SMS OTP、One-Time Token 与 password recovery。
- Control-plane Agent identity、Agent authorization、Agent credential 与 Sandbox workload identity。

### Out of scope

- 安装器、seed command、deployment packaging 或首次部署 orchestration；它们由后续安装规格实现。
- self-host User email、email verification、email invitation、email login 或 email password reset。
- SaaS deployment mode 及其任何代码；Google/GitHub SSO、social login、caller-login OAuth 和 hosted account linking 均由另一仓库管理。
- AgentPrincipal、Agent key、Agent 登录、Sandbox workload token 或 Agent 对外发声能力。
- 首期启用 TOTP、Passkey、Email/SMS OTP、One-Time Token 或账户恢复。
- 通用 ABAC/ReBAC engine、deny rules、任意条件表达式或客户自定义 policy DSL。
- 本 Specify 阶段实施、迁移或部署代码；043 implementation 仍等待 040 合入和 5xP boundary amendment。

## Assumptions & Dependencies

- 外部 installer 的具体实现延期；043 只锁定其 post-install bootstrap state，不在应用启动时自建默认管理员。
- `admin/admin` 是方便本地首次进入的已知默认凭据，因此强制首次修改 password 是不可省略的安全合同。
- 每个 active User 始终至少属于一个 active Team；注册即原子获得一个由自己拥有的初始 Team。
- 初始化后允许公开本地注册；新 User 注册时原子创建其初始 Team 与 Owner membership。
- Team Members 的 Castrel AI 参考尚未提供可读取的路径或截图；详细视觉对齐等待 Owner 提供材料，不阻塞行为规格。
- 041 已随 `main` 的 `10750ca` 落地；040 worktree 已完成多数核心实现但尚未合入 `main`。

## Success Criteria

### Measurable Outcomes

- **SC-001**：已正确 bootstrap 的部署首次访问受保护页面时，100% 进入登录页；`admin/admin` 可完成一次登录，并在访问 Team 数据前 100% 被强制修改 password。
- **SC-002**：新 User 注册后，User、初始 Team、Owner membership 与 session 要么全部成功，要么全部不存在；每个 active User 始终至少属于一个 active Team。
- **SC-003**：用户可在 60 秒内修改 display name 或 password；password 修改后旧 password 登录成功数为 0，其他旧 session 成功请求数为 0。
- **SC-004**：用户可在 30 秒内切换 Team，刷新后 active Team 保持一致；无权、已停用或归档 Team 被恢复为 active context 的次数为 0。
- **SC-005**：初始 Team 与其他 Team 同构：重命名、添加成员、转移 Owner 与删除均可成功；而使某 User 变为零 Team 的删除或退出成功次数为 0。
- **SC-006**：Team 在其成员仍拥有其他 active Team 时可归档删除；某 User 当前唯一 active Team 的删除成功次数为 0。
- **SC-007**：Owner 可在一个 Team Members 页面完成添加成员、移除成员和设置 Owner/Admin/Member；重复添加、未知 username 与 last-owner 冲突均返回稳定结果。
- **SC-008**：API、MCP、CLI 与 Web 对相同 User、Team 和 Role 的授权矩阵结果一致率为 100%；跨 Team 与已撤销 membership 测试 100% fail closed。
- **SC-009**：self-host User schema、注册/登录 payload、成员管理 UI 与恢复表面中的 email 字段和必需依赖计数为 0。
- **SC-010**：开源仓库可执行登录入口、route、配置和依赖中的 Google/GitHub SSO、Agent key、WorkloadIdentity 与强认证因子实现计数为 0。
- **SC-011**：SQLite、PostgreSQL 与 Supabase-backed PostgreSQL 运行相同 identity/Team/RBAC contract suite，核心场景通过率均为 100%，schema parity 无未记录差异。
- **SC-012**：登录、注册、Account、Team switcher、Team Settings 与 Members 页面在 320 / 768 / 1024 / 1440px 和键盘操作下没有不可达主要操作或页面级水平滚动。
- **SC-013**：043 implementation 开始前，040 已合入 `main` 且 5xP/constitution 的 caller auth 与 Team administration 边界已更新；缺少任一前置时启动检查必须失败。
