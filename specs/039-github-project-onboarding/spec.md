# 功能规格：GitHub Project Onboarding

**Feature Branch**: `039-github-project-onboarding`  
**Created**: 2026-08-05  
**Status**: Approved for planning  
**Input**: 在 Settings 连接 GitHub App；点击 Add Project 打开 Modal；默认从 GitHub 选择仓库；选定后收起列表并显示关联仓库及其他配置；设置项沿用 Castrel Settings Modal 的业务布局与密度。

## 用户场景与验收

### User Story 1 - 连接 GitHub App（Priority: P1）

作为 Mystra 操作者，我希望在 Settings 中连接 GitHub App，以便 Mystra 只访问我明确安装并授权的仓库。

**Why this priority**：仓库发现与后续交付都依赖有效连接；没有连接时，创建 Project 不能诚实地继续。

**Independent Test**：从未连接状态进入 Settings，完成 GitHub 授权和安装校验，返回后能看到连接账户、安装范围和连接状态。

**Acceptance Scenarios**：

1. **Given** 尚未连接 GitHub，**When** 操作者打开 Settings 的 Integrations，**Then** 页面显示 GitHub App、未连接状态和 Connect 操作。
2. **Given** 操作者开始连接，**When** GitHub 授权与安装校验成功，**Then** Mystra 显示已连接账户、安装标识和可用状态，且不展示任何访问令牌。
3. **Given** 操作者可访问多个安装，**When** 校验返回多个候选安装，**Then** 操作者必须明确选择一个作为当前有效连接。
4. **Given** 授权被取消、状态校验失败或安装不可访问，**When** 操作者返回 Mystra，**Then** 连接仍为未完成状态，并显示可恢复的错误和 Retry 操作。
5. **Given** 已存在有效连接，**When** 操作者选择 Reconnect，**Then** 可以重新完成授权，但旧连接在新连接成功前不得被错误标记为新连接。

---

### User Story 2 - 在 Modal 中选择仓库（Priority: P1）

作为 Mystra 操作者，我希望点击 Add Project 后在当前页面的 Modal 中选择 GitHub 仓库，以便不离开当前工作上下文就能开始配置 Project。

**Why this priority**：这是本功能的主要入口，也是对当前内联创建页面的直接修正。

**Independent Test**：从任意带 Add Project 入口的 shell 页面打开 Modal，确认地址不变、GitHub 默认选中，并能浏览和选择连接范围内的仓库。

**Acceptance Scenarios**：

1. **Given** shell 可见且没有创建 Modal，**When** 操作者点击 Add Project，**Then** 当前地址保持不变并打开创建 Modal。
2. **Given** Modal 首次打开，**When** 来源选择器呈现，**Then** GitHub 默认选中；其他未来来源可以占位，但不得伪装成可用。
3. **Given** GitHub 尚未连接，**When** Modal 尝试加载仓库，**Then** 显示连接前置条件和前往 Settings 的操作，不显示空白仓库列表。
4. **Given** GitHub 已连接，**When** 仓库加载完成，**Then** 只显示当前 App 安装允许访问的仓库，并支持按名称筛选。
5. **Given** 仓库加载中、无结果或请求失败，**When** 操作者查看选择区，**Then** 分别看到明确的 loading、empty 或 error 状态；错误状态提供 Retry。

---

### User Story 3 - 选定仓库后配置并创建 Project（Priority: P1）

作为 Mystra 操作者，我希望选定仓库后只看到一个清晰的 Repository 设置项及其余 Project 配置，以便确认绑定关系并完成创建。

**Why this priority**：仓库是 Project 的不可变来源；只有绑定明确后，其他配置才有业务意义。

**Independent Test**：选择任意可访问仓库，确认仓库列表消失、Repository 行出现、其余配置展开；填写并提交后得到使用该仓库的 Project。

**Acceptance Scenarios**：

1. **Given** 仓库列表可见，**When** 操作者选择一个仓库，**Then** 列表隐藏，并显示 Repository 设置行，包含仓库标识、可见性和 Change 操作。
2. **Given** Repository 设置行可见，**When** 操作者选择 Change，**Then** 返回仓库选择列表，原有非仓库配置保留。
3. **Given** 仓库已选择，**When** 配置区展开，**Then** 显示 Project Name、Slug、Default Agent 和 Runtime 等现有业务配置，并使用紧凑的左说明/右控件设置行布局。
4. **Given** 必填配置有效，**When** 操作者提交，**Then** 系统再次确认仓库仍属于当前连接范围，创建 Project，关闭 Modal，并导航到新 Project 详情。
5. **Given** 仓库已失去访问权或提交失败，**When** 创建返回错误，**Then** Modal 保持打开、用户输入保留，并在相关位置显示可操作错误。

---

### User Story 4 - 以同一 App 连接完成交付（Priority: P1）

作为 Mystra 操作者，我希望 Project 后续的 clone、push 和 PR 创建使用与仓库发现相同的 GitHub App 安装连接，以免创建成功后因另一套凭据失效而无法交付。

**Why this priority**：仓库发现成功但 Runner 无法交付是假完成，会直接破坏 Project 的可执行性。

**Independent Test**：用已连接 App 范围内的私有仓库创建 Project，启动一次受控 Session，验证仓库获取与交付均成功；撤销安装访问后，新的操作明确失败且不会回退到个人令牌。

**Acceptance Scenarios**：

1. **Given** Project 绑定有效 GitHub 安装连接，**When** Runner 需要 clone、push 或创建 PR，**Then** 使用该连接按需取得的短期安装凭据。
2. **Given** 短期凭据已过期，**When** 新的仓库操作开始，**Then** 系统重新取得有效凭据，而不是复用过期值。
3. **Given** 安装被撤销或仓库不再授权，**When** 发现或交付发生，**Then** 操作明确失败，不回退到个人访问令牌或调用者提供的 clone URL。
4. **Given** 任意成功或失败路径，**When** 检查持久状态、日志、公共响应和交付证据，**Then** 不出现用户 OAuth token、App 私钥或安装访问 token。

### Edge Cases

- Modal 关闭后再次打开时，未提交草稿重置；已持久化的 GitHub 连接不受影响。
- 仓库搜索对大小写不敏感；零匹配与安装范围为空使用不同说明。
- 同名仓库以 `owner/name` 唯一显示和选择。
- 仓库在列表加载后、提交前被删除、转移或撤销访问时，创建失败且要求重新选择。
- GitHub 限流或暂时不可用时，保留 Modal 上下文并允许重试，不制造本地仓库快照。
- 重复提交由界面阻止；服务端仍保证不会因一次用户动作创建多个 Project。
- OAuth 回调中的未知、过期或不匹配状态被拒绝，不改变现有连接。
- App 安装权限不足以完成仓库读取或 PR 交付时，连接状态明确说明权限问题。
- 窄屏下设置行改为上下布局，但标签、说明、状态和操作顺序保持可理解。

## Requirements

### Functional Requirements

- **FR-001**：Settings MUST 提供独立的 Integrations 分类，并展示 GitHub App 连接状态。
- **FR-002**：系统 MUST 通过 GitHub 授权确认当前操作者有权绑定所选 App 安装；回调参数本身不得作为所有权证明。
- **FR-003**：系统 MUST 在多个候选安装之间要求明确选择，MVP 同一时刻只保留一个当前有效 GitHub 连接。
- **FR-004**：系统 MUST 只持久化连接所需的非秘密元数据，不持久化用户授权 token 或安装访问 token。
- **FR-005**：Add Project MUST 打开 Modal，并保持触发时的页面地址和背景上下文。
- **FR-006**：创建来源 MUST 默认选择 GitHub，并允许未来新增来源而不改变当前创建流程的结构。
- **FR-007**：未连接 GitHub 时，Modal MUST 提供明确前置条件和打开 Settings 的操作。
- **FR-008**：仓库列表 MUST 来自当前有效 App 安装连接，并且只包含安装可访问的远程仓库。
- **FR-009**：仓库选择 MUST 支持 loading、filter、cursor 分页、empty、error 和 retry 状态；安装范围超过一页时操作者可以继续加载，直至目标仓库可选。
- **FR-010**：仓库选定后，选择列表 MUST 隐藏并替换为 Repository 设置行；Change MUST 可恢复列表。
- **FR-011**：只有仓库选定后，系统 MUST 展示 Project Name、Slug、Default Agent、Runtime 及其他现有 Project 配置。
- **FR-012**：配置项 MUST 使用左侧标题/说明、右侧状态或控件的紧凑设置行；视觉语言使用 Mystra token，不复制 Castrel 品牌色。
- **FR-013**：提交时系统 MUST 重新解析并校验远程仓库，不信任浏览器提交的 clone URL、默认分支或其他仓库快照字段。
- **FR-014**：创建成功 MUST 关闭 Modal 并导航至新 Project；失败 MUST 保留已输入配置并显示就地错误。
- **FR-015**：Project MUST 保留对其来源连接的稳定引用，以便后续仓库交付使用同一连接。
- **FR-016**：仓库发现、clone、push 和 PR 创建 MUST 使用按需生成的短期 GitHub App 安装凭据。
- **FR-017**：系统 MUST NOT 提供 `MYSTRA_GITHUB_TOKEN`、个人访问令牌或调用者 clone URL 的回退路径。
- **FR-018**：秘密值 MUST NOT 出现在持久状态、日志、公共 API 响应、UI 或交付证据中。
- **FR-019**：连接、仓库和 Project 创建失败 MUST 使用可恢复、可定位且不泄漏秘密的错误状态。
- **FR-020**：Modal MUST 支持键盘焦点管理、Escape 关闭、可辨识标签和窄屏重排。
- **FR-021**：`/projects` MUST 保留为 Project 列表/对象入口，不再承载内联创建表单。
- **FR-022**：所有新增可见文案 MUST 提供英语和简体中文。

### Key Entities

- **Integration Connection**：一次由操作者确认的远程集成绑定；包含 provider、外部安装标识、账户信息、状态、权限摘要和时间信息，不包含秘密。
- **Repository Candidate**：当前连接可访问且可供选择的远程仓库摘要；在创建前不是 Project 的持久来源事实。
- **Repository Selection**：操作者在创建草稿中选定的 provider、connection 和远程仓库标识。
- **Project**：Mystra 的持久配置对象；绑定一个由 provider 再次解析的不可变远程仓库快照，并引用其来源连接。
- **Ephemeral Installation Credential**：为一次有限时间内的仓库操作生成的秘密，不构成业务实体，不进入持久层或公共表面。

## Assumptions & Dependencies

- 当前是私有、单节点 MVP，因此只管理一个当前有效 GitHub App 安装连接；公开多租户和 Team 管理不在本功能内。
- GitHub App 的身份配置与私钥由服务端运行环境或既有秘密设施提供，不由 UI 上传或编辑。
- 用户授权凭据只用于安装所有权验证，验证结束即丢弃。
- Project 创建成功后继续沿用现有“导航到 Project 详情”行为。
- Default Agent、Runtime 等配置继续使用现有 Project 业务语义，本功能不重新定义它们。
- GitHub webhooks、安装卸载同步、Issue 写回、通用 Integration catalog 和每仓库秘密管理不在本功能内。

## Success Criteria

### Measurable Outcomes

- **SC-001**：已配置 GitHub App 的操作者可在 90 秒内从 Add Project 入口完成仓库选择和 Project 创建。
- **SC-002**：100% 的 Add Project 入口在 Modal 中完成创建，触发时不发生页面跳转。
- **SC-003**：100% 的仓库候选来自当前 App 安装授权范围；服务端在创建时再次验证选择。
- **SC-004**：仓库选择后，仓库列表在一个交互反馈周期内被 Repository 设置行替换，并显示所有后续配置。
- **SC-005**：连接、列表和提交三类失败均保留当前工作上下文，并提供明确的恢复操作。
- **SC-006**：私有仓库端到端验证中，发现、clone、push 和 PR 创建全部使用同一安装连接且无需个人令牌。
- **SC-007**：自动化秘密扫描与人工证据审计均未发现 OAuth token、App 私钥或安装访问 token 泄漏。
- **SC-008**：键盘完成连接后的 Project 创建流程时，不出现焦点丢失或不可达操作。
- **SC-009**：安装可访问仓库超过 100 个时，操作者可以在同一 Modal 中加载后续页面并选择任意已加载仓库。
