# 功能规格：Host Runtime 注册、Provider 发现与心跳

**Feature Branch**: `044-host-runtime-daemon`（逻辑 feature id；本次未创建或切换分支）
**Created**: 2026-08-07
**Status**: Draft；待 constitution/5xP 边界修订与用户故事评审后进入 `/speckit.plan`
**Input**: Owner 需求：参考 `multica-ai/multica`，在机器上安装并启动一个 `mystra-runner`，即可在
control-plane 通过心跳把这台机器纳管为 Runtime；runner 自动扫描本机可用的 agent CLI（Provider）并
确认其可用；持续回报心跳与状态。**本 spec 只覆盖：注册 host Runtime + Provider 自动发现与可用性确认
+ 心跳/状态。发起任务与 Context（repo/worktree）管理不在本 spec 范围。** `mystra-runner` 用
TypeScript 开发，不采用 multica 的 Go。

**研究来源**: 见同目录 `research.md`（对 `multica-ai/multica` 的源码级研究）。

## 澄清决策记录（Owner 已确认）

1. **本 spec 收窄范围**：只交付 **host Runtime 注册 + Provider 发现/可用性确认 + 心跳/状态**。
   发起任务、Context/worktree 管理、Agent 配置、执行/Session 持久化、并发/恢复 **均不在本 spec**，
   由后续独立 feature 承接。
2. **MVP 不做接入校验**：`mystra-runner` 配好 control-plane endpoint 后**直接启动并注册**，无 pairing、
   无凭证交换。接入认证整体后置。
3. **runner 实现语言 = TypeScript**：复用/改造现有 `apps/runner-daemon`（TS），不引入 Go。
4. **执行模型方向 = 宿主机直跑（前瞻）**：长期方向是宿主机 worktree 直跑取代 Docker sandbox 成为
   默认执行模型，但**本 spec 不交付任何执行**，仅建立"可提供计算能力的 host Runtime"这一纳管地基。

## UX Intent

Runtime 管理是操作者日常可达的控制面路由。它在侧栏中与现有顶层导航行使用相同的路由、选中态与视觉层级，
避免把 Runtime 隐藏为一个脱离主导航节奏的孤立管理区；它仍不改变 Task、Session 或执行边界。

## 概念方向（前瞻，非本 spec 交付范围）

后续 Session 发起采用四要素模型 `Runtime × Provider × Agent × Context`；Project 与 Task 是 Session
上彼此独立的 `0..1` 可选引用，都不是父级，也不属于这四个执行选择。**本 spec 只落地其中的 Runtime 与 Provider 两块**，Agent 由
`046-agent-definition` 定义为 Team-scoped、仅以 system prompt 影响执行效果的配置，Context 与派发/执行由后续
feature 拥有。此处记录方向，仅为保证本 spec 的抽象向前兼容：

- **Runtime**：一个执行后端，对外声明它能提供哪些 **Provider（agent CLI）**；该能力表达**与来源
  无关**——当前 host-bound Runtime 由 PATH 发现，未来 image-bound Runtime 可由镜像声明，上层契约不变。
- **Provider**：agent CLI / 协议族（copilot/codex/claude…），能力维度。
- Agent / Context / 派发：后续 feature 拥有，本 spec **MUST NOT** 引入其持久化或契约。

## User Scenarios & Testing *(mandatory)*

面向**平台操作者（自托管 owner）**。下列用户故事按重要性排序、可独立交付与验证。

### User Story 1 - 用 mystra-runner 注册一台机器为 host Runtime (Priority: P1)

作为平台操作者，我想在一台已有 agent CLI 的机器上安装 `mystra-runner`、配好 control-plane endpoint
后直接启动，就让这台机器作为 host Runtime 出现在管理面并可做基本查看/重命名，从而拥有一个"可提供
计算能力的远程服务方"的纳管入口。

**Why this priority**: 整个能力的地基。无需校验流程，最短路径即可交付"纳管一台机器并观察其存在"。

**Independent Test**: 在一台机器上以 `--endpoint <url>` 启动 `mystra-runner`，管理面出现该 Runtime；
操作者可查看、重命名该 Runtime。

**Acceptance Scenarios**:

1. **Given** 一个可达的 control-plane endpoint，**When** 目标机器的 `mystra-runner` 配置该 endpoint
   并启动，**Then** control-plane 持久化一条 host Runtime 记录（MVP 无 pairing/凭证交换）。
2. **Given** 一个已注册 Runtime，**When** 操作者列出或查看它，**Then** 返回其稳定 id、显示名、
   host 类型、当前状态与可用 Provider 集合。
3. **Given** 同一台机器重复启动 `mystra-runner`，**When** 再次注册，**Then** 以 runner 本地持久化的
   稳定 runner id 去重、更新既有 Runtime 记录而非无限新建。
4. **Given** 一个 Runtime，**When** 操作者重命名它，**Then** 记录被更新。

---

### User Story 2 - 自动发现 Provider 并确认其可用 (Priority: P1)

作为平台操作者，我想让 `mystra-runner` 自动扫描本机 PATH 上已安装的受支持 agent CLI，并**确认它们
确实可用**（而不仅是存在），把可用 **Provider** 集合作为该 Runtime 的能力上报，这样我能看到每台
Runtime 上"真正能用"的 Provider。

**Why this priority**: "扫描可用 agent"是 Owner 点名的核心体验，也是 Runtime 成为有意义执行后端的
前提。不派发任何任务、仅凭发现与可用性结果即交付价值。

**Independent Test**: 在只装了部分受支持 CLI 的机器上启动 runner，该 Runtime 的可用 Provider 集合恰为
实际可解析且通过可用性确认的 Provider；运行期新装一个受支持 CLI，无需重启一段时间后出现。

**Acceptance Scenarios**:

1. **Given** 机器装有 `copilot`、`codex`、未装 `claude`，**When** runner 发现，**Then** 该 Runtime
   可用 Provider 集合为 `{copilot, codex}` 且不含 `claude`。
2. **Given** 某受支持 CLI 存在于 PATH 但**不可用**（如无法执行 / 版本不满足门槛），**When** runner
   做可用性确认，**Then** 该 Provider **不计入**可用集合，并记录不可用原因（发现≠可用两分开）。
3. **Given** runner 正运行，**When** 操作者新安装一个受支持 CLI，**Then** 下一轮周期发现与确认后该
   Provider 出现在可用集合，**无需重启 runner**。
4. **Given** 某 CLI 仅能通过登录 shell 的 PATH 解析（nvm/fnm/`~/.local/bin`），**When** 直接查找
   未命中，**Then** runner 通过登录 shell 兜底解析其绝对路径并纳入发现。
5. **Given** 用 `MYSTRA_<PROVIDER>_PATH` 覆盖某 Provider 路径，**When** runner 发现，**Then** 使用
   覆盖路径；覆盖为不存在的显式路径则该 Provider 硬性缺失，而非静默回退到别的二进制。
6. **Given** 抽象上 Provider 能力来源无关，**When** 未来 image-bound Runtime 由镜像声明可用 Provider，
   **Then** 上层看到的仍是同样的"Runtime 可用 Provider"能力，无需区分来源。

---

### User Story 3 - 心跳与在线状态 (Priority: P1)

作为平台操作者，我想让 `mystra-runner` 持续向 control-plane 回报**存活心跳**，并在注册时及可用 Provider
集合发生变化时上报该集合，让管理面能准确显示每台 Runtime 是 online 还是 offline，以及它当前的可用
Provider，这样我能判断哪台机器此刻可堪使用。

**Why this priority**: 纳管的价值在于"可观测且可信"。没有心跳/状态，Runtime 记录只是静态登记而非
"活的"计算资源。

**Independent Test**: 启动 runner 后该 Runtime 显示 online；停止 runner 后超过判定阈值变 offline；
运行期 Provider 集合变化能通过变更上报反映到管理面。

**Acceptance Scenarios**:

1. **Given** 一个已注册 Runtime，**When** 其 runner 按周期发送存活心跳，**Then** control-plane 依据
   **服务端接收时间**刷新**进程内存 last-seen**（不落库）并将其判为 online。
2. **Given** 一个 online Runtime，**When** runner 停止且超过判定阈值未再心跳，**Then** 显示 offline。
3. **Given** runner 运行期可用 Provider 集合发生变化，**When** runner 上报变更（不依赖每次心跳携带），
   **Then** 管理面反映最新可用 Provider 集合。
4. **Given** control-plane 需支持未来无心跳的 Runtime 类型，**When** 定义状态语义，**Then**
   **MUST NOT** 把 host 的内存 last-seen 心跳作为所有 Runtime 类型判活的普遍前提（为 042 的 image/云
   Provider 预留）。
5. **Given** control-plane 进程重启，**When** 内存 last-seen 清空，**Then** host 短暂显示 offline，直至
   下一次心跳（≤心跳周期）自动恢复 online；期间**不**触发任何持久化写。

### Edge Cases

- 同一机器重复启动 runner：以 runner 本地持久化的稳定 runner id 去重，更新既有 Runtime 而非新建。
- Runtime 可用 Provider 集合为空（全部缺失或全部不可用）：允许注册但标记"无可用 Provider"。
- Provider 存在但不可用（无法执行 / 版本不达标 / 登录态缺失导致 --version 失败）：不计入可用集合并
  记录原因；本 spec 不负责修复其可用性（如登录），只如实反映。
- 机器时钟漂移：online/offline 与心跳新鲜度判定基于**服务端接收时间**，而非客户端声明时间。
- control-plane 进程重启：内存 last-seen 清空，host 短暂 offline，下次心跳自愈；存活为易失态、不持久，故无需恢复逻辑。
- endpoint 暂不可达：runner 应重试注册/心跳而非崩溃退出；恢复后重新纳管。
- image-bound 未来场景：Provider 由镜像声明，"Runtime 可用 Provider"语义不变；本 spec 不实现该来源，
  但抽象 **MUST NOT** 假定 Provider 必来自 PATH 发现。

## Requirements *(mandatory)*

### Functional Requirements — Runtime 注册与管理

- **FR-001**: `mystra-runner` MUST 支持配置 control-plane endpoint 后**直接启动并注册**为 host
  Runtime，MVP **MUST NOT** 引入 pairing token、凭证交换或接入校验。
- **FR-002**: 系统 MUST 持久化 **Runtime** 记录（表 `runtimes`）：稳定 id、显示名、类型（host）、动态扩展
  `metadata`（host 形态 `{runnerId, platform?}`·JSON）、创建/更新时间；以及其**可用 Provider 关联边**（表
  `runtime_providers`，每条含 provider 键与可用性状态）。online/offline **派生自内存 last-seen**（见 FR-021），
  **MUST NOT** 作为持久列；读操作不得触发任何状态写。
- **FR-003**: 重复启动同一机器的 runner MUST 以 runner 本地持久化的**稳定 runner id**（落入 `metadata.runnerId`）
  去重、幂等更新既有 Runtime 记录而非新建。稳定 runner id 由 runner 首次启动生成并持久化到本地（如
  `~/.mystra/runner-id`）。去重按 `metadata.runnerId` 幂等 upsert（**无 DB 唯一约束**·动态字段无法方言中立地建 JSON
  路径唯一索引）；同机多进程用同一 runner id 并发上报时服务端**无需区分**、last-write-wins；防止同机重复起进程的
  单实例约束由 **runner 客户端**负责，不进入服务端契约。
- **FR-004**: 操作者 MUST 能列出、查看、重命名 Runtime。**移除**不在本 feature（见非目标）。
- **FR-005**: runner 与 control-plane 的通信 MUST 由 runner **outbound** 发起（注册/心跳/上报），
  control-plane **MUST NOT** 要求主动 inbound 访问 runner 主机。
- **FR-006**: endpoint 暂不可达时 runner MUST 重试注册/心跳并保持进程存活，恢复后自动重新纳管。

### Functional Requirements — Provider 发现与可用性

- **FR-010**: Runtime MUST 以**可用 Provider 集合**表达其能运行的 agent CLI 能力，且该能力的表达
  **MUST 与来源无关**（host 发现 vs 未来 image 声明），使 image-bound Runtime 未来可声明同类能力而
  不改变上层契约。
- **FR-011**: host `mystra-runner` MUST 通过扫描本机 PATH 自动**发现**受支持的 Provider CLI。
- **FR-012**: host `mystra-runner` MUST 对发现到的每个 Provider 做**可用性确认**（如可执行性 /
  版本门槛检查），仅将确认可用者计入可用 Provider 集合；发现（存在）与可用（能用）**MUST 分开表达**，
  不可用者 MUST 记录原因。
- **FR-013**: host `mystra-runner` MUST 在运行期**周期性重扫与重确认**，使新安装或状态变化的受支持
  Provider CLI 无需重启 runner 即被反映。
- **FR-014**: 当直接路径查找未命中时，host `mystra-runner` MUST 提供**登录 shell 兜底解析**，以发现
  仅存在于登录 shell PATH 中的 Provider CLI。
- **FR-015**: 系统 MUST 支持用环境变量（`MYSTRA_<PROVIDER>_PATH`）**显式覆盖** Provider 可执行路径；
  覆盖为不存在的显式路径 MUST 硬性缺失，而非静默回退到其他二进制。
- **FR-016**: 本 feature **MUST NOT** 负责 Provider CLI 的安装与登录/授权；假定目标机器已装已登录。

### Functional Requirements — 心跳与状态

- **FR-020**: runner MUST 周期性发送**存活心跳**（liveness ping）。心跳 **MUST NOT** 要求携带完整
  可用 Provider 集合——集合上报与存活心跳解耦。
- **FR-021**: control-plane MUST 依据**服务端接收时间**与心跳新鲜度判定 Runtime 的 online/offline。存活为
  **易失态**：心跳只刷 control-plane 进程内存的 last-seen 注册表（`HostLivenessRegistry`）、**MUST NOT 持久化**
  （0 次 DB 写·不碰 `metadata`/`updatedAt`）；`status` 读取时现算、非持久列。且 **MUST NOT** 把 host 的心跳
  last-seen 作为未来所有 Runtime 类型判活的普遍前提（e2b 用可达/enabled，由 042 定义）。进程重启后 last-seen
  清空、host 短暂 offline 并于下次心跳自愈——该易失性不引入需复制的 master 状态，未来 HA 仅换 registry 实现
  （sticky routing / 共享 TTL 租约），不改持久化与契约。
- **FR-022**: runner MUST 在**注册时**上报可用 Provider 集合，并在运行期集合**发生变化时**上报变更；
  系统据此反映最新集合，而非依赖每次心跳携带。
- **FR-023**: 摄取路由（注册/心跳/Provider 变更上报）MVP **MUST NOT** 引入认证；此为**已知风险**，
  留待后续接入认证 feature（见非目标）。

### Functional Requirements — 契约、实现与边界

- **FR-030**: 本 feature 引入的 Runtime 记录、Provider 能力、注册/心跳/上报契约 MUST 用显式
  TypeScript + Zod 表达（Constitution II）；Runtime 身份与 Task 意图、未来 Session/执行、Agent 配置
  保持为分离概念。
- **FR-031**: `mystra-runner` MUST 用 **TypeScript** 实现（复用/改造现有 `apps/runner-daemon`），
  **MUST NOT** 引入 Go 或其他语言的并行 runner 实现。
- **FR-032**: 抽象 **MUST NOT** 假定"可用 Provider 必来自 PATH 发现"或"CLI 必绑持久机器"；须容纳
  未来 image-bound Runtime 由镜像声明 Provider 的情况。
- **FR-033**: 本 feature **MUST NOT** 引入发起任务、Context/worktree 管理、Agent 配置持久化、
  执行/Session 持久化、并发调度、接入校验/授权、Docker/Kubernetes/云 sandbox 执行；各为独立后续边界。
- **FR-034**: 未来接入认证的秘密材料（若引入）MUST 通过 `SecretProvider` 处理、RDB 只存非秘密元数据与
  opaque 引用；本 feature 本身不引入接入凭证，但 **MUST NOT** 设计出与该方向冲突的持久化。
- **FR-035**: 本 feature MUST **删除** `apps/runner-daemon` 中已随 feature 040 失效的历史执行代码——
  即全部打向已删除 `/api/runner/sessions*` 路由的 claim/执行/docker/sandbox/repo 交付/context-bundle
  机制及其模块与测试（`direct-execution`、`preview-probe`、`repo-providers`、`sandbox-providers`、
  `review-projections`、`runtime-paths`、`git-command-env`、`container-task.test` 及 `index.ts` 内对应
  执行函数与 claim/execute 主循环）。**MUST NOT** 以注释保留、feature-flag 或"以后可能用"为由留存
  （pre-0.1 政策：直接删除过时契约与调用方，不留兼容别名）。
- **FR-036**: 044 交付后的 `mystra-runner` 源码 MUST **不残留**对执行/派发语义符号的引用
  （`executor`、`docker`/`sandbox` 执行、`session` claim/result/events、repo 交付、context bundle），
  新模块（`provider-discovery.ts`、`registration.ts`、host `index.ts`）**MUST NOT** import 被删模块或
  携带 executor/session 类型；以 grep 门禁验证，确保新架构不受历史代码影响。

## Key Entities

- **Runtime（host）**: 一台由 `mystra-runner` 代表的执行后端（表 `runtimes`）。属性：id、name、类型（host）、
  动态扩展 `metadata`（host 形态 `{runnerId, platform?}`）、createdAt/updatedAt。status（online/offline）与存活
  last-seen 均**非持久**：status 读取时派生，last-seen 由 control-plane 进程内存 `HostLivenessRegistry` 维护。
- **RuntimeProvider（关联边）**: Runtime ↔ Provider 的持久化关联（表 `runtime_providers`，`@@unique(runtimeId,
  provider)`）。属性：provider 键、discovered、available、source、resolvedPath、version、unavailableReason。
  host 由 Runner 提交形式写入，未来 e2b 由镜像声明（`source=sandbox-image`）——核心表不变。
- **Provider**: agent CLI / 协议族（copilot/codex/claude…）。能力维度，由 Runtime 发现并确认可用；
  实现可为注册表/枚举（复用 `providerNameSchema`），不是重业务表。区分"发现（存在）"与"可用（能用）"两态。

> Agent（Team-scoped、system-prompt-only 效果配置，由 046 拥有）、Context（repo/worktree）、执行/Session **不在本 spec
> 的实体范围**，由后续 feature 拥有。**Runner** 不是实体/表，是 host 的**提交形式**（register/heartbeat/provider-report），
> 其协议 bookkeeping 仅以 Runtime 的 `metadata` 与内存 last-seen 留痕。

## 边界与依赖门禁 *(重要)*

- **Constitution 修订前置（Principle III / IV + 2026-08-06 持久化边界）**: 现 constitution 写死
  "The MVP sandbox provider is single-machine Docker"，并把 Runtime/Runner 持久化列为"需新规格延期"。
  本 feature 引入 **host Runtime 作为一类执行后端** + **Runtime 持久化** + **Provider 能力上报**，属
  产品与持久化边界变更。按 Principle I，**必须先显式修订 constitution 与 5xP（AGENTS.md /
  PLATFORM.md）**：把 Runtime 提升为对外声明 Provider 能力的执行后端，host-bound Runtime 的
  注册/发现/心跳纳入 MVP，single-machine Docker 重新定位为其中一种 sandbox provider，Runtime 持久化
  由本 044 拥有。之后本 feature 方可进入 `/speckit.plan` 与实现。本 spec 记录该修订为**实现前门禁**。
- **与 042 的关系**: 本 feature 是 042"Runtime 能力提供方"延期边界在 host-bound 模式下的**首个具体
  落地**，遵守其语义分离（Runtime ≠ 连接方式 ≠ Sandbox 规格 ≠ Sandbox 实例）。"来源无关的 Provider
  能力"正是为 042 的 image-bound/云/K8s 场景预留的兼容点；那些来源仍延期。
- **持久化范围**: 本 feature 只拥有 **Runtime（`runtimes`）+ 可用 Provider 关联边（`runtime_providers`）**的
  持久化；**存活心跳不持久**（进程内存 last-seen）；Agent 配置、Context、执行/Session 仍延期给后续 feature，
  本 spec **MUST NOT** 触碰其持久化。
- **复用现状**: 改造 TS 的 `apps/runner-daemon`（已有 register/heartbeat/poll 循环）与
  `packages/shared` 既有 runner 契约（`runnerRegistrationSchema` 等），而非新建并行实现。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 操作者能在一台已装某 Provider CLI 的机器上，仅配置 endpoint 并启动 `mystra-runner`，
  即在管理面看到该 host Runtime，全程无 pairing、无手工登记 Provider。
- **SC-002**: 某 Runtime 的可用 Provider 集合与机器上实际可解析且通过可用性确认的受支持 Provider 集合
  一致；PATH 上存在但不可用的 CLI 不计入，并记录不可用原因。
- **SC-003**: 运行期新装一个受支持 CLI 后，无需重启 `mystra-runner`，该 Provider 在下一轮发现/确认后
  出现在可用集合。
- **SC-004**: 启动 runner 后 Runtime 显示 online；停止后超阈值显示 offline；判定基于服务端接收时间。
- **SC-005**: 评审者能在规格中无歧义区分 Runtime 与 Provider，并能说明同一"Runtime 可用 Provider"
  抽象如何同时容纳 host 发现与未来 image 声明两种来源。
- **SC-006**: `mystra-runner` 以 TypeScript 实现，无 Go 或其他语言的并行 runner。
- **SC-007**: 044 交付后，`apps/runner-daemon` 不再含指向已删除 `/api/runner/sessions*` 的执行/claim/
  docker/sandbox/repo 交付/context-bundle 遗留代码；对上述执行语义符号的 grep 门禁为空；`build`/
  `typecheck`/`test` 全绿，且新模块不 import 任何被删模块。

## 非目标 / 排除项 *(本 spec)*

- 发起任务 / 派发 / 执行（含 headless `-p` 驱动 agent）——后续 feature。
- Context / repo / worktree 管理——后续 feature。
- Agent 配置（Team-scoped，唯一效果配置为 system prompt）由 `046-agent-definition` 拥有；Provider 与 Context/skills
  保持独立，Agent UI 仍非 044 范围。
- 执行 / Session 持久化、并发调度、断连时执行恢复——后续 feature。
- 接入校验 / pairing / 凭证交换 / 授权——整体后置；摄取路由 MVP 无认证为**已知风险**（FR-023）。
- **服务端移除 Runtime**——本 feature 不做。理由：仍在运行的 runner 会在下次注册时重新纳管自己，
  服务端单方面移除会与之冲突；移除/退役语义留待后续接入认证与生命周期 feature。
- Docker sandbox / Kubernetes / 云 sandbox 执行路径；image-bound Runtime 仅作抽象兼容点，不实现。
- Provider CLI 的安装、登录与授权（假定已具备）。
- 成本/token 计量、webhooks、Issue 写回、channels、托管多租户、平台级 workflow 编排。
- WebSocket 唤醒/流式 RPC——MVP 先 HTTP 注册/心跳，WS 后置。

## Deferred Decisions（留待 `/speckit.clarify` 或 plan）

- 心跳间隔、offline 判定阈值、周期重扫间隔、登录 shell 解析缓存 TTL 的具体数值。multica 参考值：
  心跳 15s、offline ~3min、登录 shell 解析 TTL 30min、登录 shell 超时 3s(+2s 硬杀)、shell 允许表
  `{bash,zsh,sh,dash,ksh}`。
- 可用性确认的具体手段（`--version` / 轻量 probe / 版本门槛表）与各 Provider 的最低版本。
- Provider 能力键形态：枚举 vs 注册表 vs 版本化 capability schema。
- Provider 变更上报机制：独立"变更上报"路由 vs 复用注册 upsert（二选一，plan/tasks 定）。
- 传输是否在后续引入 WS 唤醒，还是纯 HTTP + 轮询。
- 跨平台（Windows service / launchd / systemd）runner 托管细节。
- Runtime 与 Team/所有权、公有/私有可见性绑定（依赖 043 落地情况）。

## 后续必需产物（进入 tasks/实现前）

- 本 spec 为 **UI-facing**（Runtimes 管理页 + Runtime 详情：在线状态与可用 Provider）。按
  `aaa-spec-kit` 门禁，进入 tasks/实现前 **MUST** 有可打开的原型；本目录 `prototype.md` 指向
  `mockups/index.html`，覆盖：Runtimes 列表、Runtime 详情（online/offline + 可用/不可用 Provider）。
  runner 的安装与启动**不在产品 UI 范围**（无 "Add a computer" 引导面），由 operator 按
  `quickstart.md` 自行完成。
