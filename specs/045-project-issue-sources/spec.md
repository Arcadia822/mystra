# 功能规格：Project Issue 来源与分集成浏览

**Feature Branch**: `045-project-issue-sources`
**Created**: 2026-08-08
**Status**: Specification complete; approved for planning
**Input**: 规划 Issues：self-hosted Linear 使用 API key，Hosted OAuth 延后；GitHub Issue 由 Project repository 自动关联；Project 可配置零或一个 Linear Team；Project 内提供 Issues tab，一级 `/issues` 采用 Project-first；GitHub 与 Linear 使用独立表格、筛选和分页状态，禁止融合；本功能只读浏览，不包含 Issue 到 Task dispatch 或 Issue write-back。

**Owner Story Review**: Owner 已确认一个 Project 在 MVP 中最多关联一个 Linear Team，并确认保留 Project-first 的一级 `/issues`。Owner 明确拒绝在本功能中加入 Issue → Task dispatch，因为 Task 创建与执行链路尚未由后续规格定义。Owner 接受当前 GitHub/Linear 表格字段与列表原型，并决定本功能暂不设计 Mystra Issue 详情页；Issue 行只进入 provider 原始页面，专用详情页由后续规格定义。

**Supersession Notice**:

- 本功能取代 `025-webui` 中“`Issues` 继续使用当前 Task table”的临时要求；`Issues` 此后展示远端 Issue，而不是 Task 投影。
- 本功能结束 `036-project-object-pages` 对 Issue UI 的延期，但不改变其 Project 对象页其余边界。
- 本功能保留 `037-remote-repository-integrations` 的 GitHub repository-scoped IssueProvider、Linear read-only IssueProvider 与 Pull Request 过滤原则；其环境级 `LINEAR_API_KEY` 产品配置被 Team-owned Linear API-key connection 取代。
- 本功能复用 `041-github-integration-connections` 的 Team ownership、exact-connection、SecretProvider 与 fail-closed 原则，但不改变 GitHub App/PAT 连接合同。
- 本功能不定义 Task、Session、Runtime 或 Runner 的创建与执行行为，也不把 Issue 列表写入当前 Prisma 业务模型。

## User Scenarios & Testing

### User Story 1 - 使用 API key 管理 Linear 连接（Priority: P1）

作为 self-hosted Mystra Team 的 Owner 或 Admin，我希望在 Settings → Integrations 中添加、检查、替换和删除 Linear API-key connection，以便 Project 可以从我明确授权的 Linear workspace 和 Team 读取 Issue，而不是依赖整个部署共享的环境变量。

**Why this priority**: 如果 Linear 仍由一个进程级密钥决定，Project、Mystra Team 与外部 Linear Team 之间没有可审计的授权来源，多用户或多连接时只能靠运气区分数据边界。

**Independent Test**: 在同一 Mystra Team 中创建两条可访问不同 Linear workspace 的 API-key connection，分别查看其可访问 Linear Teams；替换其中一条的密钥后，另一条连接的身份与可用性保持不变，所有公共响应和页面均不出现密钥明文。

**Acceptance Scenarios**:

1. **Given** 当前用户是 active Mystra Team 的 Owner 或 Admin，**When** 在 Linear Integration Detail 中提交有效 API key，**Then** 系统验证 Linear 身份、workspace 和可访问 Teams 后创建一条归属当前 Mystra Team 的 connection。
2. **Given** API key 无效、过期、无权读取 Team 或上游暂时失败，**When** 验证结束，**Then** 不创建新 connection、不破坏旧凭据，并显示可恢复且不泄密的错误。
3. **Given** Linear connection 已存在，**When** Owner/Admin 使用有效新 API key 执行 Replace，**Then** connection 身份保持稳定，已绑定 Project 无需改绑。
4. **Given** 替换验证失败，**When** 操作结束，**Then** 旧凭据和旧 connection 状态保持有效。
5. **Given** connection 仍被任一 Project 的 Linear Issue 来源引用，**When** 操作者尝试删除，**Then** 系统拒绝删除并指出仍存在 Project 引用。
6. **Given** 当前用户是 Member，**When** 尝试创建、替换或删除 Linear connection，**Then** 操作 fail closed；Member 仍可按权限浏览 Project 已配置的 Issue。

---

### User Story 2 - 为 Project 配置明确的 Issue 来源（Priority: P1）

作为 active Mystra Team 的 Owner 或 Admin，我希望 GitHub Issue 来源自动跟随 Project 已绑定的 GitHub repository，并可选地为 Project 选择一条 Linear connection 及其中一个 Linear Team，以便每个 Issue 列表都有明确、可检查且不会自动漂移的外部范围。

**Why this priority**: GitHub Issue 与 repository 天然同域，Linear Issue 则必须通过外部 Team 建立范围。把两者都当成无范围的通用 Issue 会制造跨 Team 数据混用，虽然界面看起来可能非常整齐。

**Independent Test**: 创建一个 GitHub-backed Project，确认 GitHub source 无需额外配置即可确定；再从指定 Linear connection 选择一个 Linear Team，保存后只读取该 Team 的 Issue。切换或删除 Linear 配置不改变 Project 的 GitHub repository binding。

**Acceptance Scenarios**:

1. **Given** Project 绑定有效 GitHub connection 与 repository，**When** 打开 Issue source 配置，**Then** GitHub 显示为自动来源，并明确展示 exact connection 和 repository，不能单独改成其他 GitHub repository。
2. **Given** 当前 Mystra Team 有可用 Linear connections，**When** 配置 Linear source，**Then** 操作者必须先确认一条 exact connection，再从该连接可访问的 Linear Teams 中选择一个 Team。
3. **Given** Project 已绑定一个 Linear Team，**When** 操作者选择另一 Team 并保存，**Then** 旧关联被原子替换；同一 Project 不会同时拥有两个 Linear Team 范围。
4. **Given** 操作者切换 Linear connection，**When** 新连接生效，**Then** 旧连接加载的 Team 候选和选择状态被清空，不得跨 connection 保留外部 ID。
5. **Given** Linear source 被移除，**When** 返回 Project Issues，**Then** GitHub source 不受影响，Linear 呈现未配置状态且不请求全 workspace Issue。
6. **Given** connection、Linear Team 或 GitHub repository 已失效，**When** 查看配置或 Issue，**Then** 系统保留可检查的绑定信息、明确标记不可用，并且不回退到其他 connection、Team 或环境凭据。
7. **Given** 当前用户是 Member，**When** 尝试创建、替换或移除 Project 的 Linear source，**Then** 配置操作 fail closed，但该 Member 仍可按 Project 与 Team 权限只读浏览已配置来源。

---

### User Story 3 - 在 Project 内按 Integration 分别浏览 Issues（Priority: P1）

作为 Mystra 操作者，我希望在 Project 的 `Issues` tab 中切换 `GitHub` 与 `Linear`，并看到各自原生语义的表格、筛选与分页状态，以便快速判断工作内容，而不是阅读一张删除了关键信息的融合表。

**Why this priority**: GitHub 的 repository/number/milestone 与 Linear 的 priority/cycle/team 是不同产品模型。统一列不是抽象，只是信息损失被赋予了一个较体面的名字。

**Independent Test**: 为同一 Project 准备 GitHub Issues 和一个 Linear Team，分别打开两个 provider view，验证列、筛选、分页游标和空态独立；任何页面和网络响应都不存在合并后的 `All providers` 结果。

**Acceptance Scenarios**:

1. **Given** Project 可访问 GitHub repository Issues，**When** 选择 GitHub view，**Then** 表格显示 Number、Title、State、Assignees、Labels、Milestone 与 Updated，并排除 Pull Request。
2. **Given** Project 已配置 Linear Team，**When** 选择 Linear view，**Then** 表格显示 Identifier、Title、Status、Priority、Assignee、Cycle 与 Updated，且结果只属于该 Linear Team。
3. **Given** 操作者在 GitHub view 设置筛选并翻页，**When** 切换到 Linear 再返回 GitHub，**Then** GitHub 自己的筛选与分页位置可恢复，Linear 状态不被覆盖。
4. **Given** Project 未配置 Linear source，**When** 选择 Linear view，**Then** 页面显示明确的未配置状态和有权限用户可用的配置入口，不请求无范围的 Linear Issue。
5. **Given** 任一 provider loading、empty、error、rate-limited 或 unauthorized，**When** 页面呈现，**Then** 状态只影响该 provider view，另一个 provider 仍可独立浏览。
6. **Given** 操作者查看任一 Issue 行，**When** 使用行级操作，**Then** 只能打开 provider 原始 Issue 页面；当前功能不得提供 Mystra Issue 详情页、创建 Task、dispatch、更新状态、评论或同步操作。

---

### User Story 4 - 从一级 Issues 入口先选择 Project（Priority: P1）

作为从主导航进入 Issues 的操作者，我希望先选择一个 Project，再进入与该 Project 详情相同的 provider-specific Issue 浏览体验，以便保留快速入口，同时避免跨 Project 或跨 Integration 聚合。

**Why this priority**: `Issues` 已是 MVP 主导航合同。删除入口会破坏 shell；把所有 Project 混起来则会破坏这次刚定义的范围。Project-first 是唯一不自相矛盾的中间状态。

**Independent Test**: 直接打开 `/issues`，选择任一 Project 后验证其 GitHub/Linear view 与 Project 详情 `Issues` tab 使用相同来源、列和状态；切换 Project 后旧 Project 的 provider 游标和 Issue 不再显示。

**Acceptance Scenarios**:

1. **Given** 尚未选择 Project，**When** 打开 `/issues`，**Then** 页面先显示 Project 选择状态，不加载任何远端 Issue。
2. **Given** 已选择 Project，**When** 进入 Issue 浏览，**Then** 页面只显示该 Project 的 provider switch，并与 Project 详情 `Issues` tab 使用相同来源合同。
3. **Given** 操作者切换 Project，**When** 新 Project 生效，**Then** 旧 Project 的 Issue、筛选、选择和分页状态被清除，不得短暂混入新 Project。
4. **Given** 没有 active Project，**When** 打开 `/issues`，**Then** 页面显示诚实空态和进入 Project 创建流程的入口，不请求 GitHub 或 Linear。
5. **Given** Project 已归档或当前用户失去 Team 访问权，**When** 通过旧地址访问，**Then** 页面 fail closed，不显示缓存的外部 Issue。

### Edge Cases

- Mystra `Team` 是租户，Linear `Team` 是外部 Issue 范围；公共文案与合同必须同时带上产品语境，不得仅以裸 `teamId` 让调用方猜测。
- 同一个 Linear Team 通过两条不同 connection 可访问时，Project 绑定的是 exact connection + Linear Team，而不是仅按外部 Team ID 自动选凭据。
- 一个 Linear API key 可访问多个 Teams 时，Project 配置必须显式选择一个；不得默认整个 workspace。
- Linear Team 被删除、归档、重命名或撤销访问时，Project 关联保留 provider-stable external ID 供诊断；可变名称仅作为实时展示信息。
- Project 切换 Linear connection 后，新连接碰巧包含相同名称的 Team 时，仍须按 provider external ID 重新确认，不按名称复用。
- GitHub Issues API 返回 Pull Request 时必须过滤；GitHub repository 转移或重命名不能改变 Project 已绑定的 provider-stable repository identity。
- Provider 分页 cursor 只在其原 provider、connection、Project 和 scope 内有效；任一范围变化必须清空 cursor。
- Provider-specific 筛选项无对应能力时不得静默映射，例如不能把 Linear Priority 假装成 GitHub Label。
- Issue 标题、标签、用户名称和描述均来自不受信任的第三方响应；页面必须按普通文本安全呈现，不解释为 HTML 或 agent 指令。
- 浏览 Issue 不创建 Issue snapshot、Task、Session、事件或 activity timeline；刷新后的上游变化可以直接反映在列表中。

## Requirements

### Functional Requirements

- **FR-001**: Settings → Integrations MUST 为 Linear 提供可进入的 Integration Detail，并展示当前 Mystra Team 的 connection 数量和健康摘要。
- **FR-002**: 当前 self-hosted 产品 MUST 只支持 Linear API key connection；Hosted Linear OAuth、OAuth callback、token refresh 与 hosted activation policy MUST 保持未定义且不在本功能中伪造。
- **FR-003**: Linear connection MUST 归属当前 authenticated Session 的 active Mystra Team；公共创建请求不得接受调用方自报的 Mystra Team identity。
- **FR-004**: 只有 Owner/Admin 可创建、替换或删除 Linear connection；Member 的只读 Issue 访问遵循 Project 与 Team 权限。
- **FR-005**: 一个 Mystra Team MUST 可保存多条 Linear connections；每条 connection MUST 保留稳定身份、auth method、Linear workspace/actor 摘要、状态、能力和凭据引用。
- **FR-006**: Linear API key MUST 在保存或替换前验证身份、workspace、可访问 Teams 与 Issue read capability；验证失败不得写入或切换 connection。
- **FR-007**: Linear API key 明文 MUST 只进入 SecretProvider 与短期上游请求，不得进入 RDB 业务字段、Project、公共 API 响应、URL、日志、事件、Issue 数据、页面 DOM 或验收证据。
- **FR-008**: Linear credential replacement MUST 先验证新凭据，再原子切换 connection 的 opaque credential reference；失败时旧凭据保持有效。
- **FR-009**: 仍被 Project 引用的 Linear connection MUST 无法删除；connection 不可用时不得自动回退到另一 connection 或环境级 `LINEAR_API_KEY`。
- **FR-010**: Project MUST 派生一个且仅一个 GitHub Issue source，其 exact connection 和 repository identity MUST 与 Project repository binding 相同，不提供第二个 GitHub Issue 配置字段。
- **FR-011**: Project MUST 可拥有零或一个 Linear Issue source；该来源 MUST 绑定 exact Linear connection 与一个 provider-stable Linear Team external ID。
- **FR-012**: Linear Issue source 的创建、替换或移除 MUST 只允许当前 Mystra Team 的 Owner/Admin；创建或替换还 MUST 重新验证 connection 归属当前 Mystra Team、connection 可用且目标 Linear Team 当前可访问。
- **FR-013**: Linear Team 的名称、key、icon 或归档状态属于实时外部信息，不得代替 provider-stable external ID 成为关联身份。
- **FR-014**: Project Issue source 的更新不得改变 Project repository binding、GitHub connection、Task 或任何执行配置。
- **FR-015**: Project 详情 MUST 提供 `Issues` tab；该 tab MUST 提供 `GitHub` 与 `Linear` provider switch，不得提供 `All`、`Combined` 或跨 Integration 聚合视图。
- **FR-016**: GitHub view MUST 使用 GitHub-specific table contract，至少提供 Number、Title、State、Assignees、Labels、Milestone 与 Updated；Pull Request MUST 被排除。
- **FR-017**: Linear view MUST 使用 Linear-specific table contract，至少提供 Identifier、Title、Status、Priority、Assignee、Cycle 与 Updated；结果 MUST 限定为 Project 绑定的 Linear Team。
- **FR-018**: Provider-specific columns、filters、sort、pagination cursor、loading、empty 和 error state MUST 独立保存和呈现，不得通过共享 UI state 相互覆盖。
- **FR-019**: 共享 Issue 基础身份只可用于稳定引用与打开 provider 原始页面；它 MUST NOT 强迫 provider-specific list response 丢弃 GitHub 或 Linear 独有字段。
- **FR-020**: 第三方 Issue、Team、用户、label、cycle 与 milestone 响应 MUST 在服务边界验证；错误 MUST 映射为稳定、机器可读且不泄密的 Integration failure。
- **FR-021**: Issue 列表 MUST 使用 opaque cursor 分页，并在 Project、connection、provider 或 scope 变化时清除旧 cursor。
- **FR-022**: 一级 `/issues` MUST 先要求选择一个 active Project，再呈现与该 Project `Issues` tab 相同的 provider-specific 视图；它 MUST NOT 跨 Project 聚合。
- **FR-023**: `/issues` 在 Project 未选择、无 active Project、Project 无权访问或 Project 已归档时 MUST fail closed，且不得提前请求远端 Issue。
- **FR-024**: Project Issues 与一级 `/issues` MUST 通过同一 canonical Web API 和共享契约读取数据；Web 不得直接调用第三方 API，CLI/MCP 的未来只读适配不得产生第二套业务规则。
- **FR-025**: 本功能所有 Issue 表面 MUST 是只读的；MUST NOT 提供 Issue → Task dispatch、Task 创建、Session 创建、Issue 状态修改、评论、webhook、同步或 write-back。
- **FR-026**: 浏览 Issue MUST NOT 持久化 Issue snapshot、Issue cache、Task source、Task objective 或 activity timeline；未来 Integration cache 需要独立规格。
- **FR-027**: GitHub 与 Linear view MUST 分别提供 loading、empty、error、unauthorized、rate-limited、connection unavailable 和 scope unavailable 状态；一个 provider 失败不得阻止另一个 provider 独立显示。
- **FR-028**: Issue 行 MUST 支持打开 provider 原始 URL，并明确标识即将离开 Mystra；本功能 MUST NOT 提供 Mystra Issue 详情页或详情 drawer，任何外部内容不得作为 agent 指令执行。
- **FR-029**: 新增 UI 文案 MUST 提供简体中文与英文值，并在 320、768、1024 和 1440px 视口保持 Project 选择、provider 切换、筛选、分页和外部 Issue 入口可用。
- **FR-030**: Provider switch、表头、筛选、行、分页与错误恢复 MUST 支持键盘操作、可见 focus、语义化名称和非纯颜色状态表达。

### Key Entities

- **Mystra Team**: self-hosted 顶级租户和 IntegrationConnection 所有者；与 Linear Team 是两个不同概念。
- **IntegrationConnection**: Team-owned 的外部授权关系。GitHub connection 继续绑定 repository；Linear connection 使用 API key 并记录非秘密的 workspace/actor/能力摘要与 opaque credential reference。
- **Project**: repository-scoped 执行归属；自动获得由其现有 GitHub connection + repository identity 派生的 GitHub Issue source。
- **ProjectIssueSource**: Project 与非 repository Issue 范围之间的稳定关联；本功能仅允许一个可选 Linear variant，包含 exact Linear connection 与 Linear Team external identity，不包含 Issue 内容。
- **Linear Team**: Linear workspace 内的 provider-native Issue 范围。其 external ID 稳定用于关联，名称等可变信息实时读取。
- **Provider-specific Issue List**: 针对 GitHub 或 Linear 的只读列表投影，保留各自列、筛选、排序与 opaque pagination state，不是持久业务对象。
- **Issue Reference**: 打开 provider 原始 Issue 所需的最小稳定身份；本功能不把它转换为详情页对象或 Task dispatch key。

## Scope

### In scope

- Self-hosted Linear API-key connection 的创建、验证、替换、删除保护与 Settings Detail。
- GitHub repository-derived Issue source，以及 Project 的零或一个 Linear Team Issue source 配置。
- Project 详情 `Issues` tab。
- Project-first 的一级 `/issues` 入口。
- GitHub 与 Linear 独立列表字段、筛选、分页、状态与 provider 原始页面入口。
- exact-connection、Team authorization、SecretProvider 和第三方响应验证边界。

### Out of scope

- Issue → Task dispatch、Task/Session/Runtime/Runner 创建或执行、dispatch key。
- Mystra Issue 详情页、详情 drawer 或可持久导航的 Issue object route。
- GitHub 或 Linear Issue write-back、状态更新、评论、webhook、双向同步。
- Hosted Linear OAuth、OAuth callback、refresh token 或 cloud activation policy。
- 跨 Project、跨 Linear Team 或跨 Integration 的聚合列表、搜索或统一排序。
- 多 Linear Team 绑定、Linear workspace 全量 Issue、自动 Team 猜测或自动 connection fallback。
- Issue snapshot/cache 持久化、离线列表、全文索引和 public activity timeline。
- Linear Project 作为 Mystra Project 的关联主对象；MVP 关联对象是 Linear Team。

## Assumptions

- 当前 Project repository 来源仍是 GitHub；GitHub Issue source 因此可以从现有 repository binding 派生。
- 一个 Linear API key 可能访问多个 Linear Teams；配置 Project 时由操作者明确选择一个。
- 一个 Mystra Team 可以管理多条 Linear connections，一条 connection 可以被多个 Project 复用。
- Linear Issue access 在本功能中保持只读；后续 dispatch 必须等待 Task 创建与执行规格完成后另行定义。
- 一级 `/issues` 不维持跨 Project 的全局当前选择；Project 改变时远端列表状态重新建立。
- Issue 与可变外部元数据实时读取；本功能不承担 Integration cache 的 freshness、失效或离线合同。

## Success Criteria

### Measurable Outcomes

- **SC-001**: Self-hosted Owner/Admin 可在 3 个主要操作以内从 Linear Detail 进入 API key 提交流程，并在成功后看到已验证 workspace 与可访问 Team 摘要。
- **SC-002**: 两条 Linear connections 和两个 Project 的验收中，Issue 请求 100% 使用 Project 绑定的 exact connection + Linear Team，跨 connection、跨 Team 与环境变量 fallback 次数为 0。
- **SC-003**: 每个 Project 的 Linear Issue source 数量始终为 0 或 1；重复保存相同来源不产生重复关联，替换来源后旧范围 Issue 显示数量为 0。
- **SC-004**: GitHub 与 Linear view 的可见列分别满足 FR-016 与 FR-017；产品中 `All providers`、融合行和统一 provider cursor 的数量均为 0。
- **SC-005**: 在两个 provider 各自筛选和翻页后往返切换，10 次验证中各自状态恢复正确率为 100%，且不存在跨 provider Issue 闪现。
- **SC-006**: `/issues` 在未选 Project 时产生的远端 Issue 请求数为 0；切换 Project 后旧 Project Issue、cursor 与筛选残留数为 0。
- **SC-007**: 公共响应、RDB 业务字段、Project、日志、事件、页面 DOM 和验收证据中的 Linear API key 明文泄露计数为 0。
- **SC-008**: 无效/过期 API key、失败 replacement、已引用 connection 删除、撤销 Team access、rate limit 和第三方无效响应测试均 100% fail closed，且不破坏另一 provider view。
- **SC-009**: Project Issues 与一级 `/issues` 的可执行 Task/dispatch/write-back 控件计数为 0，加载期间 Task/Session mutation 请求数为 0。
- **SC-010**: 320、768、1024 和 1440px 视口及纯键盘操作下，Project 选择、provider 切换、筛选、分页、错误恢复和 provider 原始 Issue 入口均可完成，无页面级不可恢复水平滚动。
