# 功能规格：Runtime Sandbox 能力提供方

**Feature Branch**: `042-runtime-sandbox-capacity`（逻辑 feature id；本次未创建或切换分支）
**Created**: 2026-08-06
**Status**: Deferred；仅记录规格，不进入规划或实现
**Input**: Runtime 应代表能够为 Agent 提供 Sandbox 的执行后端，包括安装 Mystra Runner 的主机、Kubernetes，以及未来通过 API 接入的 Sandbox 云服务；Runner 只是部分 Runtime 使用的可选连接方式。Owner 后续决定 `040-prisma-rdb` 第一期不接管 `runners` 或 `sessions` 表；042 继续负责后续 Runtime/Runner redesign，但仍不在本 Spec 中实施 Session persistence。
**Amendment (2026-08-06)**: 本 Spec 原先关于“当前 `runners` 表必须保持在目标 schema 中”的约束已废弃。`040` 也已整体移除 Session persistence，因此本文中的 Session 只表示未来执行概念，不定义表、字段、关系或 CRUD。现有代码在 040 实施前仍是运行事实，但不能再作为未来 Prisma schema 的要求。ContextBundle 也不再被假定为既有 Sandbox Spec 组成实体；Context delivery 需要独立重做。

## User Scenarios & Testing *(mandatory)*

本功能是延期的架构边界记录，不对应当前可交付的用户流程。以下使用具名技术场景，目的是让后续 Runtime 设计不会把自托管 Runner 的连接细节错误地推广到 Kubernetes 和云 Sandbox。

### Technical Scenario 1 - 操作者以统一概念选择 Sandbox 能力提供方 (Priority: P1)

平台操作者能够把 Runtime 理解为“为 Agent Session 提供 Sandbox 能力的执行后端”，而不是某个必须安装 Mystra Runner 的进程或主机。

**Why this priority**: 这是后续主机、Kubernetes 和云 Sandbox 共存时的核心产品边界。若该边界不稳定，连接方式会继续冒充业务实体。

**Independent Test**: 使用一个安装 Runner 的自托管主机和一个无需 Runner 的托管 Sandbox 服务审阅规格；两者都能被描述为 Runtime，且不需要改变 Runtime 的业务含义。

**Acceptance Scenarios**:

1. **Given** 一个安装 Mystra Runner 的主机能够创建 Agent Sandbox，**When** 操作者查看其平台归类，**Then** 它被视为一种 Runtime，Runner 只负责建立连接和上报运行状态。
2. **Given** 一个通过服务端 API 创建 Sandbox 的云服务，**When** 操作者查看其平台归类，**Then** 它同样被视为 Runtime，且不要求安装或模拟 Mystra Runner。
3. **Given** 一个 Kubernetes 执行环境，**When** 后续实现选择直接连接集群或通过连接组件接入，**Then** 连接方式不改变它作为 Runtime 的业务身份。

---

### Technical Scenario 2 - Runner 保持为可选连接机制 (Priority: P1)

Runtime 接入者可以根据网络拓扑和服务能力选择 Runner 连接或直接连接，而不会让 Runner 成为所有 Runtime 的强制前提。

**Why this priority**: 自托管主机适合由本地组件反向连接；Kubernetes 和云服务通常可以由 Control Plane 直接访问。把一种拓扑写成所有实现的合同，只会让未来 Provider 伪装成本地主机。

**Independent Test**: 审阅至少一种 connector 模式和一种 direct 模式；两者都能建立可用 Runtime，同时只有 connector 模式需要 Runner 心跳。

**Acceptance Scenarios**:

1. **Given** Runtime 位于 Control Plane 无法主动访问的主机，**When** 操作者选择 Runner 连接，**Then** Runner 可以承担认证、心跳、容量上报和 Session 领取。
2. **Given** Runtime 提供可直接访问的受信 API，**When** Control Plane 建立直接连接，**Then** Runtime 不需要 Runner 注册、Runner 凭证或 Runner 心跳。
3. **Given** 两种连接方式都可提供相同 Sandbox 能力，**When** 上层 Task 和 Session 使用 Runtime，**Then** 它们不需要理解底层连接方式。

---

### Technical Scenario 3 - Runtime、Sandbox 规格与 Sandbox 实例保持分离 (Priority: P1)

平台设计者能够明确区分能力提供方、期望的执行环境以及某次 Session 实际创建的隔离环境。

**Why this priority**: 当前 `runtime` 一词还用于描述镜像、挂载和旧 ContextBundle reference。若不拆分语义，未来会同时表示“哪家服务”和“执行环境需要什么”，从而获得一种罕见的双重含义；旧 ContextBundle 本身不作为未来答案保留。

**Independent Test**: 选择同一个 Runtime，使用两种不同的 Sandbox 规格启动两个 Session；再选择两个不同 Runtime，使用等价 Sandbox 规格启动 Session。所有对象仍能被无歧义地识别。

**Acceptance Scenarios**:

1. **Given** 一个 Runtime 支持多个镜像和挂载组合，**When** 不同 Session 请求不同执行环境，**Then** Runtime 身份保持不变，差异由 Sandbox 规格表达。
2. **Given** 一个 Session 已选择 Runtime，**When** Runtime 为其创建实际隔离环境，**Then** 该环境作为 Sandbox 实例被追踪，而不是覆盖 Runtime 的身份或配置。
3. **Given** 两个 Runtime 都支持同一 Sandbox 规格，**When** 调度选择其中一个，**Then** Session 能记录实际选择的 Runtime 和最终解析的 Sandbox 规格。

---

### Technical Scenario 4 - 延期设计与 040 删除面分工明确 (Priority: P1)

042 本身不实现 Runtime 或 Runner；040 可以按 Owner 批准的删除面移除旧 Runner persistence，但不得借此在没有后续设计的情况下发明新的 Runtime/Runner 表。

**Why this priority**: 本 Spec 的授权范围只是记录未来边界。延期设计不应通过命名热情偷偷修改正在工作的系统。

**Independent Test**: 比较创建本 Spec 前后的代码、数据库和运行接口；除 `specs/042-runtime-sandbox-capacity/` 外不存在行为或合同变化。

**Acceptance Scenarios**:

1. **Given** 当前数据库存在 `runners` 表，**When** 040 的获批 destructive migration 执行，**Then** 该表可被删除且不得被 Prisma 接管为目标模型。
2. **Given** 当前 Runner 使用注册、认证、心跳和 Session claim 接口，**When** 040 移除其持久化依赖，**Then** 对应旧接口必须显式移除或报告稳定的 deferred/unavailable，而不是继续走旧 SQL。
3. **Given** 后续团队准备实现 Runtime，**When** 尚未完成 `/speckit.clarify`、`/speckit.plan` 和工程评审，**Then** 不得把本 Spec 解释为已授权迁移或实现。

### Edge Cases

- 一个 Runtime 由多个主机节点共同提供容量时，Runtime 身份与节点心跳如何区分？
- 云 Sandbox 服务没有可持久观察的节点，也不提供心跳时，Runtime 健康如何表达？
- Kubernetes Runtime 是集群级、命名空间级还是 RuntimeClass 级资源？本 Spec 暂不选择。
- Runtime 暂时不可用但已经存在运行中的 Sandbox 时，新的 Session 与既有 Session 如何分别处理？
- Runtime 能力和容量是静态声明、动态查询还是连接组件上报？本 Spec 暂不选择。
- Team 自有 Runtime 与平台共享 Runtime 如何授权和隔离？本 Spec 暂不选择。
- 同一 Runtime 同时支持 direct 和 connector 两种连接方式时，如何选择并避免重复调度？

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Mystra MUST 将 Runtime 定义为能够为 Agent Session 提供 Sandbox 能力的执行后端。
- **FR-002**: Runtime 概念 MUST 能覆盖安装 Mystra Runner 的主机、Kubernetes，以及不安装 Runner 的 Sandbox 云服务。
- **FR-003**: Runner MUST 被定义为部分 Runtime 可选的连接和执行组件，而不是 Runtime 成立的必要条件。
- **FR-004**: Runtime 的业务身份 MUST 与其连接方式分离，使 connector、direct API 或未来其他连接方式不会泄漏到 Task 和 Session 的上层合同。
- **FR-005**: Runtime MUST 与 Sandbox 规格分离；镜像、挂载、Secret、端口、资源和未来重新设计的 Context delivery 要求描述 Sandbox 应当如何构造，而不是 Runtime 本身是谁。
- **FR-006**: Runtime MUST 与 Sandbox 实例分离；Sandbox 实例表示为某个 Session 实际创建的隔离执行环境。
- **FR-007**: 后续设计 MUST 允许 Session 记录实际选择的 Runtime，并保存足以解释本次执行环境的最终 Sandbox 规格。
- **FR-008**: 只有采用 Runner/connector 模式的 Runtime 才 MAY 依赖 Runner 注册、凭证、心跳、容量上报和反向 Session 领取。
- **FR-009**: 直接连接的 Runtime MUST NOT 被要求伪造 Runner、Runner 心跳或 Runner 凭证才能满足统一 Runtime 合同。
- **FR-010**: Runtime 的秘密连接材料 MUST 通过不透明引用交给秘密管理边界，而不是成为公开 Runtime 数据。
- **FR-011**: Runtime 的健康、能力和可用性语义 MUST 能同时表达有心跳连接和无心跳 API Provider，不得以 `lastHeartbeatAt` 作为所有 Runtime 的普遍前提。
- **FR-012**: 本 Spec 自身 MUST NOT 实现新的 Runtime/Runner schema、API 或协议；旧 `runners` 表、Runner persistence API 与 Session assignment 的删除由获批的 040 migration/contract deletion surface 负责。
- **FR-013**: 本 Spec MUST NOT 创建 Runtime 数据库迁移、Runtime 管理 API、Runtime UI、Kubernetes Adapter、云 Sandbox Adapter、安装流程、技术计划或实现任务。
- **FR-014**: 本 Spec MUST NOT 同时承担 PG/Supabase、Task Activity、Agent 消息历史或 Artifact 重设计；这些边界需要独立规格。
- **FR-015**: 任何 Runtime 实现 MUST 在后续独立授权下依次完成澄清、技术计划、工程评审、任务拆分和迁移验证。

### Key Entities

- **Runtime**: 能够为 Agent Session 提供 Sandbox 能力的已配置执行后端。其身份不等同于某个 Runner 进程、节点或 Sandbox 实例。
- **Runtime Connection**: Mystra 与 Runtime 建立控制和状态通道的方式。可能由 Runner/connector 提供，也可能是 Control Plane 直接访问的 Provider API。
- **Runner**: connector 模式下可选的本地组件，负责认证、心跳、容量上报、Session 领取和本地执行协调；不是所有 Runtime 的共同实体前提。
- **Sandbox Spec**: 某次执行期望的镜像、挂载、Secret、端口、资源、策略和未来 Context delivery reference 集合；不复用已废弃 ContextBundle 实体作为既定答案。
- **Sandbox Instance**: Runtime 针对一个 Session 创建的实际隔离环境，具有 Provider 返回的实例引用和生命周期。
- **Session Runtime Selection**: Session 对实际 Runtime 和最终 Sandbox 规格的可解释绑定。

### Assumptions

- 当前 Runner MVP 是 040 实施前的运行事实，不是获批的未来持久化模型。
- Runtime 的所有权、Team 绑定、平台共享池、调度、计费、容量和健康聚合均延后澄清。
- Kubernetes 和云 Sandbox 仅作为必须容纳的未来技术场景，不代表当前支持承诺。
- 后续设计可能将当前代码中的 `runtime` 配置重新命名为 Sandbox Spec；本 Spec 不授权该重命名。
- 本 Spec 的技术场景用于锁定领域边界，因此不要求 UI Prototype。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 评审者能够在一次规格评审中准确区分 Runtime、Runner、Runtime Connection、Sandbox Spec 和 Sandbox Instance，且不存在同一术语承担两个角色的必要解释。
- **SC-002**: 至少一个需要 Runner 的自托管主机场景和一个不需要 Runner 的直接 API 场景能够满足同一 Runtime 业务定义。
- **SC-003**: 至少两个不同 Sandbox 规格可以由同一 Runtime 提供，而不需要复制或改变 Runtime 身份。
- **SC-004**: 042 本身产生的实现变更为零；040 对旧 Runner persistence 的删除必须可与 042 的未来设计边界明确区分。
- **SC-005**: 在 Owner 明确恢复该功能前，不生成 plan、tasks、migration 或实现代码。

## Deferred Decisions

以下问题被有意保留给未来 `/speckit.clarify`，当前没有默认答案：

- Runtime 是 Team 自有资源、平台共享资源，还是同时支持两者。
- Runtime 的具体分类、Provider/driver 命名和 capability schema。
- direct 与 connector 模式是否可以在同一 Runtime 上共存。
- Runtime 与 Runtime node/connection 是否需要分别持久化。
- Session 在何时选择 Runtime，以及失败时是否允许重新选择。
- Sandbox Instance 是否成为持久化实体，以及其保留周期。
- 当前 `runners` 数据如何迁移，或是否仅作为 connector 运行记录保留。

## Explicit Non-Authorization

本 Spec 只记录未来领域方向。它不是实现授权，也不代表当前 MVP 边界已经改变。除本目录中的 Spec-Kit 评审产物外，不得据此修改任何代码、数据库、API、MCP、CLI、Web、Runner、Sandbox 或安装文档。
