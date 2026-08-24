---
title: "功能规格：Control Plane Skill 库与不可变 Revision"
---

**Feature Branch**: `056-skill-library`

**Created**: 2026-08-17

**Status**: Draft

**Input**: 为 Control Plane 增加 Team-scoped Skill 库。第一阶段只接受 ZIP，使用平台管理的 S3-compatible 对象存储保存每个不可变 Revision 的原始 ZIP，提供 Skill 创建、读取、更新、archive、Revision 历史、文件树、安全文本预览和 ZIP 下载；不包含 Agent/Session 绑定、Runtime 交付、硬删除或 GC。

**User Story Discussion**: Owner 已确认第一阶段边界、仅 ZIP 输入、S3-compatible-only 部署方向，以及“更新产生不可变 Revision、删除等于 archive”的生命周期。本规格不为所谓单机用户引入 filesystem adapter——那会把一个已经明确的 SaaS 产品边界重新包装成部署选择，颇具创造性，但没有产品价值。

## 决策摘要

- `Skill` 是 Team-scoped 顶层库资源，不属于 Agent、Project、Task、Session 或 Runtime。
- 每次创建或更新均发布一个不可变 `SkillRevision`；Skill 只移动当前 Revision 指针，不覆盖历史内容。
- 每个 Revision 在 S3-compatible 对象存储中保存一个原始 ZIP 对象；RDB 保存可查询元数据、manifest、校验摘要和对象引用。
- 上传只接受 ZIP。服务端把有上限的原始 ZIP 保存在内存中，按 entry 惰性读取并逐条校验，不创建临时解包目录，也不同时保留全部解压文件。
- ZIP 处理分为 central-directory metadata scan 和按最终 logical path 排序的 content scan；最多保存 1,200 个有界 descriptor，任一时刻只打开一个 entry stream。
- 删除动作在产品和 API 中统一解释为 archive。archive 不删除任何 ZIP 或 Revision；硬删除、保留期与垃圾回收由后续规格定义。
- Skill name 只在 active 或首次发布中的 Skill 之间唯一。archive 会释放该名称；之后上传同名 ZIP 会创建新的 Skill ID，并从 Revision 1 开始。历史 archived Skills 可以同名。
- 发布恢复不引入 `SkillCommand` 或操作 ID。`SkillRevision` 自身记录发布状态，重复发布通过 `skillId + baseRevisionId + zipSha256` 识别；archive 通过目标状态保证重复调用安全。
- 可恢复的对象存储错误不会把 Revision 永久置为 `failed`：timeout、throttle、5xx、凭据/配置暂时不可用时保持 `uploading`，后续同 tuple 继续 Head/Put/finalize。只有该 Revision 已不可能成功 finalize 的终止性条件才进入 `failed`。
- 第一阶段只把 `SKILL.md` 的 `name` 与 `description` 投影到关系字段；未知 frontmatter 安全解析后忽略，不写入 manifest。其原始文本仍存在不可变 ZIP 中。
- 第一阶段只管理 Skill 内容，不让 Agent、Session 或 Runtime 引用、安装或执行 Skill。

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 上传 ZIP 创建可用 Skill (Priority: P1)

作为 Team Owner 或 Admin，我希望上传一个规范的 Skill ZIP 并创建 Skill，以便团队拥有一个可审阅、可下载且不会依赖控制平面本地文件系统的内容源。

**Why this priority**: 没有安全、可重复的发布入口，Skill 库只是一个名字不错的空列表。

**Independent Test**: 上传包含根级 `SKILL.md` 的有效 ZIP，验证系统创建 Team-scoped Skill 和 Revision 1，展示解析后的名称、描述、文件树、摘要与下载入口，并能下载与原上传字节一致的 ZIP。

**Acceptance Scenarios**:

1. **Given** 有管理权限的用户和一个有效 ZIP，**When** 用户创建 Skill，**Then** 系统发布 Revision 1、将其设为当前 Revision，并返回稳定 Skill ID 与 Revision ID。
2. **Given** ZIP 外层仅有一个公共目录且该目录包含 `SKILL.md`，**When** 用户上传，**Then** 系统逻辑去除这一个公共目录前缀，并以其中内容作为 Skill 根目录。
3. **Given** 上传是非 ZIP、缺少根级 `SKILL.md`、包含危险 entry 或超过限制，**When** 用户提交，**Then** 整个发布失败，不产生 ready Revision 或可读取的当前内容。
4. **Given** 创建请求在响应前中断，**When** 用户再次上传相同 name 与相同 ZIP bytes，**Then** 系统按 active name 与 ZIP SHA-256 恢复或返回既有发布，不创建第二个 Skill 或 ready Revision。

---

### User Story 2 - 浏览、预览并下载 Revision (Priority: P1)

作为具有 Team 资源读取权限的成员，我希望查看 Skill 列表、当前 Revision、历史 Revision、文件树和安全文本预览，并下载原始 ZIP，以便在不执行上传内容的情况下理解和复核 Skill。

**Why this priority**: Skill 内容需要先可见、可审计，才配被后续执行系统消费。把 ZIP 存起来却无法解释里面是什么，只是对象存储领域的收藏癖。

**Independent Test**: 以普通 Team Member 身份读取一个多 Revision Skill，切换 Revision、展开文件树、预览允许的 UTF-8 文本、查看二进制文件元数据，并下载指定 Revision ZIP；同时验证无法读取其他 Team 的对象。

**Acceptance Scenarios**:

1. **Given** Team 内存在 active Skills，**When** 成员打开 Skill 库，**Then** 可分页查看名称、描述、状态、当前 Revision、更新时间和内容摘要。
2. **Given** 一个 ready Revision，**When** 成员查看详情，**Then** 可读取完整逻辑文件树以及每个文件的路径、大小、媒体类型和内容摘要。
3. **Given** 文件是允许预览且未超过预览上限的 UTF-8 文本，**When** 成员打开文件，**Then** 系统返回该 Revision 中的固定内容并明确显示 Revision 身份。
4. **Given** 文件是二进制、不允许内联或超过预览上限，**When** 成员尝试预览，**Then** 系统只返回元数据与不可预览原因，不把内容解释为文本。
5. **Given** 成员下载任一 ready Revision，**When** 下载完成，**Then** ZIP 原始字节校验值与发布时记录一致。

---

### User Story 3 - 以新 Revision 更新 Skill (Priority: P1)

作为 Team Owner 或 Admin，我希望通过上传新 ZIP 更新现有 Skill，同时保留全部历史 Revision，以便内容演进可追溯且并发编辑不会静默覆盖。

**Why this priority**: Revision 是本功能的核心一致性合同，不是稍后再加的版本号装饰。

**Independent Test**: 在已有 Revision 1 的 Skill 上用正确 expected revision 发布 Revision 2，验证当前指针切换且 Revision 1 的预览与下载保持不变；再用过期 expected revision 发布，验证冲突被拒绝。

**Acceptance Scenarios**:

1. **Given** active Skill 当前为 Revision 1，**When** 管理员使用最新资源 revision 上传有效 ZIP，**Then** 系统创建不可变 Revision 2 并原子切换当前指针。
2. **Given** Revision 2 已发布，**When** 用户读取 Revision 1，**Then** 其 manifest、预览和下载内容完全不变。
3. **Given** 两个管理员基于同一旧资源 revision 更新，**When** 一个发布已成功，**Then** 另一个收到 revision conflict，且不得创建额外 ready Revision 或移动当前指针。
4. **Given** 新 ZIP 中 `SKILL.md` 声明的稳定 Skill name 与已有 Skill 不同，**When** 管理员尝试更新，**Then** 系统拒绝该 Revision，并指引创建新的 Skill。

---

### User Story 4 - Archive Skill 而不销毁历史 (Priority: P2)

作为 Team Owner 或 Admin，我希望把不再使用的 Skill archive，以便它退出默认列表和后续可选集合，同时保留历史内容供审计与恢复决策使用。

**Why this priority**: 第一阶段需要完整生命周期，但没有理由把不可逆物理删除伪装成普通 CRUD。

**Independent Test**: Archive 一个 active Skill，验证默认列表不再显示、includeArchived 可读取、所有 Revision 仍可预览与下载、重复 archive 幂等、archive 后不能发布新 Revision。

**Acceptance Scenarios**:

1. **Given** active Skill 和正确 expected revision，**When** 管理员执行删除动作，**Then** Skill 状态变为 `archived`，对象内容与 Revision 记录均不删除。
2. **Given** archived Skill，**When** 成员使用明确的 archived 查询或直接 ID 读取，**Then** 历史 Revision 仍可预览和下载。
3. **Given** archived Skill，**When** 管理员尝试发布新 Revision，**Then** 系统拒绝请求；恢复能力不在本阶段中被暗中发明。
4. **Given** archive 请求在响应前中断，**When** 用户再次 archive 同一 Skill，**Then** 系统返回当前 archived 表示且不重复写生命周期事实。
5. **Given** 一个 Skill 已 archived，**When** 管理员上传具有相同 Skill name 的有效 ZIP，**Then** 系统创建新的 Skill ID 和 Revision 1；旧 archived Skill 仍可按 ID 读取。

### Edge Cases

- ZIP 可以使用根级 `SKILL.md`，或仅有一个公共顶层目录且该目录内含 `SKILL.md`；多个候选根目录、空包或嵌套根不确定时必须拒绝。
- `__MACOSX/**` 与任意目录下的 `.DS_Store` 可作为明确的打包噪声忽略；其他隐藏文件仍参与校验与 manifest。
- 所有 entry 都必须被扫描。服务端不得只验证选中的 Skill 根而忽略 ZIP 其他位置的危险路径或超限内容。
- 路径必须使用相对 POSIX 逻辑路径；拒绝绝对路径、`.`/`..` 段、反斜杠、NUL、空路径、重复规范化路径、Unicode 规范化冲突和大小写折叠冲突。
- 拒绝加密 entry、符号链接、硬链接、设备文件、未知文件类型和不支持的压缩方法。
- ZIP 声明大小与实际解压大小、CRC 或流读取结果不一致时，整个 Revision 失败。
- 上传中断、对象存储失败或 RDB finalize 失败必须留下可诊断但不可读取的发布状态；不得让半发布内容成为当前 Revision。
- timeout、throttle、5xx、凭据或部署配置错误后，同一 publication tuple 必须仍可在服务恢复后继续；不得把 `retryable` HTTP 错误固化成无法恢复的 `failed`。
- 相同逻辑文件树可以由不同 ZIP 元数据或压缩方式产生，因此必须分别记录原始 ZIP 摘要与规范内容摘要，不能把 ETag 当作内容身份。
- archive 与正在发布的 Revision 竞争时，expected revision 与 finalize 条件必须保证只有一个合法结果，不得在 archived Skill 上出现新的 current Revision。
- 同一 Team 中可以存在多个历史 archived Skill 使用相同 name，但任一时刻最多一个 active 或首次发布中的 Skill 占用该 name。

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST 将 Skill 定义为 Team-scoped 顶层资源；Skill MUST NOT 属于 Agent、Project、Task、TaskExecutionContext、Session 或 Runtime。
- **FR-002**: 第一阶段 MUST 只接受 ZIP 上传；TAR、目录 multipart、多文件表单、Git URL、OCI artifact 和本地路径 MUST 被拒绝或保持无入口。
- **FR-003**: System MUST 使用 S3-compatible 对象存储保存 Revision 内容，且第一阶段 MUST NOT 提供 filesystem content adapter 或把控制平面节点磁盘作为 source of truth。
- **FR-004**: System MUST 为每个 Revision 保存一个不可变的原始 ZIP 对象；对象 key MUST 包含 Team ID、Skill ID 与 Revision ID，且不得依赖用户提供的路径片段。
- **FR-005**: System MUST 在 RDB 中保存 Skill、Revision、当前 Revision 指针、逻辑 manifest、原始 ZIP SHA-256、规范内容 SHA-256、对象引用、压缩与解压总大小、创建者和时间。
- **FR-006**: 每次创建 MUST 产生 Revision 1；每次内容更新 MUST 产生下一个不可变 Revision，MUST NOT 覆盖任何历史 Revision 或对象 key。
- **FR-007**: Skill 的稳定 name MUST 从根级 `SKILL.md` frontmatter 解析，并在该 Skill 的后续 Revision 中保持不变；同一 Team 内 name 只在 active 或首次发布中的 Skill 之间唯一。archive MUST 释放 active name；随后上传同名 ZIP MUST 创建新的 Skill ID，历史 archived Skills MAY 同名。
- **FR-008**: `SKILL.md` MUST 位于逻辑根目录并包含有效的 `name` 与 `description`。第一阶段只持久化这两个解析字段；其他 frontmatter MUST 在安全解析后忽略，不得写入 `manifestJson` 或获得执行语义。原始 `SKILL.md` bytes 仍作为 ZIP 内容与 manifest file entry 保存。
- **FR-009**: System MUST 支持根级包和单一公共顶层目录包，并仅逻辑剥离公共目录前缀；不得在文件系统中解包。
- **FR-010**: System MUST 在有上限的内存中接收原始 ZIP，并执行两阶段扫描：先遍历 central-directory metadata、收集最多 1,200 个有界 entry descriptor、确定逻辑根与最终路径并排序；再按最终 logical path 顺序逐个打开 regular-file stream，验证实际大小/CRC、计算摘要和预览分类。每个 regular file 内容 MUST 只读取一次，任一时刻 MUST 最多打开一个 entry stream，MUST NOT 同时把全部解压文件驻留内存。
- **FR-011**: 默认上传限制 MUST 为：原始 ZIP 不超过 20 MiB、逻辑文件不超过 1,000 个、单文件解压后不超过 20 MiB、总解压大小不超过 100 MiB、`SKILL.md` 不超过 1 MiB；超过任一限制 MUST 整包拒绝。
- **FR-012**: System MUST 扫描并验证 ZIP 中全部 entry，执行路径规范化、重复/碰撞检测、文件类型检查、加密与压缩方法检查、声明/实际大小校验和 CRC 校验，并防御 zip slip 与 zip bomb。
- **FR-013**: System MUST 仅忽略 `__MACOSX/**` 和 `.DS_Store` 打包噪声；被忽略 entry 不进入逻辑 manifest 或规范内容摘要，但仍必须安全解析其元数据，且不得绕过全包限制。
- **FR-014**: 规范内容摘要 MUST 由排序后的逻辑路径、文件长度和文件内容共同计算，不得依赖 ZIP entry 顺序、时间戳、压缩级别、对象存储 ETag 或文件系统元数据。
- **FR-015**: 发布流程 MUST 保证只有 `ready` Revision 可成为 current Revision；`uploading` 或 `failed` Revision MUST NOT 出现在普通成员的文件树、预览或下载结果中。
- **FR-016**: 对象上传成功但 RDB finalize 失败时，System MUST 保留可关联的失败发布记录以供运维诊断；第一阶段 MUST NOT 自动物理删除对象，GC 由后续规格定义。
- **FR-017**: Revision 发布 MUST 以 `skillId + baseRevisionId + zipSha256` 识别同一发布的重复提交，并恢复或返回同一 Revision；初次创建 MUST 以 Team-scoped active name 与 ZIP SHA-256 获得等价行为。archive MUST 对已 archived 目标重复安全。更新和 archive MUST 使用瞬时 expected resource revision 拒绝过期并发写入，但不得把该请求参数保存为 Revision 字段。
- **FR-018**: Team Owner 与 Admin MUST 具备 `team.skill.manage`；Team Member MUST NOT 创建、发布或 archive Skill。具备 `team.resource.access` 的 Team 成员 MAY 读取 active 和明确请求的 archived Skill。
- **FR-019**: 所有 API、CLI 和 MCP 读取与写入 MUST 由当前 Team 上下文授权；跨 Team Skill ID、Revision ID 或 object key MUST 统一表现为不可访问，且不得泄漏存在性。
- **FR-020**: System MUST 提供 Skill 分页列表、Skill 详情、Revision 分页历史、Revision 文件树、按逻辑路径读取文件元数据、安全文本预览和指定 Revision ZIP 下载。
- **FR-021**: 文本预览 MUST 仅允许明确 allowlist 的 UTF-8 文本媒体类型/扩展名，单次预览最多返回 256 KiB；二进制、无效 UTF-8、超限或未允许类型 MUST 只返回元数据与稳定原因码。
- **FR-022**: 下载 MUST 通过 Control Plane 授权路径流式返回原始 ZIP；对象存储 bucket 和 object key MUST NOT 暴露给客户端，第一阶段不得返回可长期复用的公开对象 URL。
- **FR-023**: 删除操作 MUST 等价于把 Skill 标记为 `archived`；archive MUST NOT 删除 Revision、manifest 或 ZIP 对象，默认列表 MUST 排除 archived Skills。
- **FR-024**: 第一阶段 MUST NOT 实现 hard delete、保留期、对象 GC、archive restore、Skill fork/merge、跨 Team 复制、公共市场或共享目录。
- **FR-025**: 第一阶段 MUST NOT 让 Agent、Session、TaskExecutionContext、Workspace、Runtime 或 Provider 绑定、解析、安装、缓存或执行 Skill；这些能力必须由后续 spec 定义精确 Revision 引用与交付合同。
- **FR-026**: Control Plane MUST 把 ZIP 内容视为不可信数据，绝不在上传、预览、索引或下载流程中执行脚本、加载模块、渲染活动 HTML 或解析会产生外部网络请求的内容。
- **FR-027**: Web API MUST 是 canonical management implementation；`mystra` CLI 与 remote MCP MUST 作为同一共享 Zod 合同的薄适配器，Web UI MUST 消费相同 API。
- **FR-028**: Web UI MUST 提供 Team Skill 库列表、创建上传、详情/Revision 切换、文件树、预览、下载和 archive 确认；该入口不加入 MVP primary menu，可从 Team 管理上下文或直接路由到达。
- **FR-029**: System MUST NOT 为第一阶段创建 `SkillCommand`、通用操作表、operation ID 或持久化 `Idempotency-Key`；Revision 发布状态与 Skill 资源状态 MUST 是恢复依据。该合同提供资源级重复安全，不承诺任意不同请求 ID 的严格 exactly-once 语义。
- **FR-030**: timeout、throttle、provider 5xx、凭据解析或对象存储配置不可用 MUST 保持 Revision 为 `uploading` 并保持 current 不变。相同 publication tuple 的后续请求 MUST 先执行 Head 校验：对象存在且匹配则继续 finalize，不存在则重试 Put；仅对象完整性冲突、archive 已赢得竞争、base/current 已不可恢复地变化或其他使该 Revision 永远无法 finalize 的条件 MAY 转为 `failed`。
- **FR-031**: 隐藏的首次创建 Skill MUST 使用内部 `resourceRevision=0`；第一次成功 finalize MUST 原子设置 `resourceRevision=1`。`0` MUST NOT 出现在普通 API、CLI、MCP 或 Web 表示中；之后每次 current pointer 变化或 archive 成功均递增 1。
- **FR-032**: S3 credential MUST 支持二选一来源：显式 access-key pair，或 SDK 默认 provider chain。显式 pair 必须 both-or-neither；未提供时必须在启动阶段解析 provider chain。两种来源都无法获得凭据时启动 MUST fail closed，且不得把 credential 写入 RDB、日志或客户端。
- **FR-033**: 10,000 Skills/Team、1,000 ready Revisions/Skill 与 1,000 manifest entries/Revision MUST 作为分别验证的独立容量目标，不构成三者在同一 Team 同时达到的联合容量承诺。性能 p95 必须通过可重复基准场景验证，不得仅凭单元测试宣称达标。

### Key Entities

- **Skill**: Team-scoped 稳定库身份；包含不可变历史 name、仅 active/首次发布时占用的 nullable active name、生命周期状态、当前 Revision 指针、资源 revision 与审计时间，不保存可变目录内容。
- **SkillRevision**: 属于一个 Skill 的不可变发布；包含 nullable-until-ready 的递增 sequence、父 Revision、发布状态、解析后的描述、内嵌 manifest JSON、对象引用、原始 ZIP/规范内容摘要、总大小和 actor/timestamp。
- **SkillManifestEntry**: Revision `manifestJson` 数组中的 Zod/TypeScript value，描述一个规范逻辑文件的路径、类型、大小、内容 SHA-256 与预览能力；它不是数据库表或独立资源。
- **SkillContentObject**: S3-compatible bucket 中由平台生成 key 标识的原始 ZIP；RDB object reference 是 source-of-truth 关联，bucket listing 不是业务查询接口。

## Assumptions and Dependencies

- Mystra 作为 SaaS 服务运行；即使最终执行 Runtime 位于单台主机，Skill 内容 source of truth 仍是平台对象存储，不引入本地磁盘部署分支。
- S3-compatible 表示实现只依赖经过兼容性验证的基础对象操作：PutObject、GetObject、HeadObject 及流式 body；不依赖供应商专属生命周期、对象锁、事件通知或 bucket versioning。
- 20 MiB 原始 ZIP 上限允许在 Node 进程内保留一个上传 Buffer；100 MiB 是逐 entry 解压计数上限，不意味着同时分配 100 MiB 常驻对象图。
- 原始 ZIP SHA-256 是下载字节完整性证据；规范内容 SHA-256 是逻辑文件树身份。对象存储 ETag/version 不持久化，也不作为身份摘要。
- `team.skill.manage` 是新的显式管理权限，映射 Owner/Admin；读取复用现有 `team.resource.access`。
- Revision 发布允许短暂 `uploading` 状态用于跨 RDB/对象存储一致性；用户可见 current 指针只在 finalize 事务中移动。
- 第一个可见 Skill 的 `resourceRevision` 固定为 1；隐藏 reservation 使用 0。
- S3 endpoint、region 与 bucket 是平台配置；credential 可来自显式 pair 或部署环境的 SDK provider chain。

## Out of Scope

- Agent Context、Session Context、TaskExecutionContext、Workspace 或 Runtime 的 Skill 选择、固定 Revision 引用、交付、解包、安装和执行。
- Runtime 侧 cache、跨 Runtime 同步、依赖解析、Skill 组合、依赖锁文件或供应链签名。
- filesystem adapter、RDB BLOB 内容存储、Git repository、OCI registry 或 per-file object 作为第一阶段内容后端。
- TAR/TGZ/7z、目录拖拽多文件上传、远程 URL 导入或服务器端 Git clone。
- hard delete、restore、retention policy、legal hold、对象生命周期规则、orphan GC 和跨 bucket 迁移。
- 公共 Skill marketplace、跨 Team 分享、评分、搜索索引、语义检索、自动审核或恶意软件扫描服务。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% 的成功创建和更新都产生新的不可变 Revision；历史 Revision 的 manifest、预览和下载摘要在后续更新后保持不变。
- **SC-002**: 有效 ZIP 在 20 MiB 上传上限内可完成发布，且服务端峰值 ZIP 内容持有模型为一个原始 Buffer 加一个正在读取的 entry，不创建临时解包目录。
- **SC-003**: 覆盖路径穿越、绝对路径、重复路径、Unicode/大小写碰撞、加密、链接、zip bomb、CRC/大小不一致和不支持压缩方法的安全测试 100% 被拒绝，且不产生 ready/current Revision。
- **SC-004**: 相同 active name + ZIP SHA-256 的重复创建、相同 `skillId + baseRevisionId + zipSha256` 的重复更新，以及对已 archived Skill 的重复 archive，100% 返回或恢复同一资源结果；过期 expected revision 的不同更新 100% 以稳定冲突响应失败。
- **SC-005**: Team 授权矩阵中 Owner/Admin 的管理样例 100% 通过，Member 写入样例与所有跨 Team 读取/下载样例 100% 被拒绝且不泄漏资源存在性。
- **SC-006**: ready Revision 的文件树、允许的文本预览和原始 ZIP 下载均能从记录摘要复核；二进制与超限文件不会以内联文本返回。
- **SC-007**: Archive 后默认 active 列表中的命中数为 0，而明确读取该 Skill 时历史 Revision 可预览、可下载，RDB Revision 和对象存储 ZIP 删除数均为 0。
- **SC-008**: 第一阶段的数据库关系、API、CLI、MCP 与 Web UI 中 Agent/Session/Runtime Skill 绑定字段和交付动作数量为 0。
- **SC-009**: S3-compatible 合同测试至少在 AWS S3 语义基线和一个非 AWS 兼容实现上通过 Put/Get/Head、checksum、错误映射与流式下载验证。
- **SC-010**: timeout/throttle/5xx failure injection 后 Revision 保持 `uploading`，相同 tuple 在 provider 恢复后 100% 复用同一 Revision 并完成或返回既有 ready 结果；终止性完整性/并发冲突才产生 `failed`。
- **SC-011**: 对同一逻辑文件树生成至少两种不同 entry order/ZIP metadata 的包，`contentSha256` 必须 100% 相同；基准期间峰值内容模型必须保持为一个原始 ZIP Buffer、最多 1,200 个 bounded descriptors 与一个 entry stream。
- **SC-012**: 性能基准分别使用 10,000-Skill 元数据 fixture、1,000-Revision history fixture、20 MiB publish fixture 和 256 KiB preview fixture，报告至少 100 次 warmed samples 的 p50/p95、环境与 provider；各 p95 目标只在对应独立 fixture 上判定。
