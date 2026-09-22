---
title: "060：AgentOS 直连控制面与工作负载能力"
feature_id: "060-agentos-direct-control-plane"
created: "2026-09-22"
status: "设计审查中"
input: |-
  User description: "AgentOS Pi 沙箱 Agent 直连控制面工作负载能力契约，取代不可用的宿主 binding。注入 Session 环境变量、只读挂载单文件 CJS bundle CLI、通过 loopbackExemptPorts 豁免并放行 127.0.0.1 控制面出口、预检直连能力失败关闭，并在销毁重建 VM 后保持续接可用。"
issue: "MYST-23"
github_issue: 44
supersedes:
  feature: "059-agentos-pi-runtime"
  decision: "059 isolation decision: execution code never enters the guest"
  unresolved_items: ["T027", "FR-006 guest workload binding gap"]
---

## 背景与当前缺口

在 Feature 059 中，AgentOS Runtime 作为独立的沙箱 Runtime 引入 Mystra，并落地了基于 Pi Provider 的文档与代码阅读工作负载。059 当初做出了安全隔离假设：“执行凭据（`MYSTRA_EXECUTION_CODE`）绝不进入沙箱 guest”，试图通过 AgentOS Core 的 Host Binding 机制（`vm.process.execFile`）在宿主注入并分派 CLI 命令，向 guest 提供只读 stub。

然而，在 host-c1 上的实测证据（见 `research.md` 及 059 PR #43 独立审查整改复验）表明：
1. **上游 SDK 能力限制**：`agentos-core 0.2.19` 的 binding 命令桩（如 `/bin/agentos-mystra`）在 guest 内部（无论是 guest shell 还是 guest Node 进程）无法完成内核命令分派：guest shell 直接返回 `exit 127`（`command not found: agentos`），guest Node 调用 `execFileSync` 会挂起至超时（`exit 137`）。该机制仅对宿主侧调用 `vm.process.execFile` 有效。
2. **059 遗留阻断**：由于 guest 无法分派 binding，059 部署的沙箱在写入任何模型凭据前的 `assertGuestWorkloadBinding` 预检中立即失败关闭（Fail Closed），导致 059 的 FR-006（沙箱必须实际获取短期 Session 作用域上下文能力）未达成，成为未关闭的阻断项 T027。
3. **网络拓扑实测事实**：在 host-c1 实测中，AgentOS guest **无法直连宿主的 Tailscale IP 或任何局域网 LAN IP**（即使配置了 `network` 放行规则，`fetch` 仍直接失败 `ERR fetch failed`）。Guest 访问宿主控制面的唯一有效途径是：利用 AgentOS SDK 原生提供的 `loopbackExemptPorts: [<port>]` 豁免配置，并配合网络规则放行 `tcp://127.0.0.1:<port>`，此时 guest 通过 `http://127.0.0.1:<port>` 能够直通宿主服务。`loopbackExemptPorts` 仅为 AgentOs.create 的单个配置参数，不需要任何额外的宿主代理进程服务。
4. **CLI 运行时打包约束**：Guest 内无法直接以 ESM 目录树分发 `@mystra/agent-cli`（运行时会出现 `Dynamic require of "..." is not supported` 错误）。必须通过 esbuild 28.2 将 `packages/agent-cli/bin/mystra-agent` 单独打包为一个自包含的 CJS 单文件 bundle（`mystra-agent.cjs`，约 900 KB，保留入口本身的 `#!/usr/bin/env node` Shebang），并只读挂载到 guest 内的 `/opt/mystra-agent-cli`。

经产品与技术负责人（Linear MYST-23, GitHub #44）明确裁定：**正式废除 059 中“执行凭据绝不进入 guest”的旧隔离决定，改为基于 loopback 端口豁免与单文件 CJS bundle 的直连控制面架构**。通过向 AgentOS Session 注入受限环境变量、只读挂载单文件 CJS CLI、配置 `loopbackExemptPorts` 及对应 loopback 放行规则，让沙箱内的真实 Node (v22) 进程直接执行 CLI 与控制面通信。

## 术语

- **Guest**：AgentOS 沙箱虚拟机/微虚拟机内部环境。
- **Host Runtime**：运行在宿主机器上的 Mystra Runner 运行时。
- **AgentOS Runtime**：通过 AgentOS SDK 在沙箱虚拟机内运行 Agent 的 Mystra Runner 运行时。
- **Session Env**：由 Runner 在调用 `vm.sessions.open({ env })` 时注入到 AgentOS 沙箱 Session 运行时的环境变量字典；由 AgentOS sidecar 持久化至 `session.sqlite` 的 `agentos_core_sessions.env_json`，并在跨 VM 重建续接时自动重放。
- **loopbackExemptPorts**：AgentOS SDK 在 `AgentOs.create` 时接受的配置参数（SDK 类型定义：`Loopback ports to exempt from SSRF checks`），用于显式豁免指定 loopback 端口的内核 SSRF 拦截。
- **Workload CLI Bundle**：通过 `esbuild` 打包的单文件 CommonJS 构建产物（`mystra-agent.cjs`），包含完整运行时依赖，并保留原生 Shebang。
- **Execution Code**：控制面在任务分派时下发给该 Session 的一次性、短期、作用域受限的执行凭据（`MYSTRA_EXECUTION_CODE`），用于向控制面证明自身身份与被授予的 capabilities。
- **Egress Policy**：AgentOS 虚拟机的网络出站防火墙规则；默认全拒绝（`default: deny`），按规范化资源串显式放行。

## 操作者/调用者可验证的技术场景

### 场景一：Guest 内 Agent 调用真实 CLI 取得任务上下文（P1）

操作者通过 API/MCP 创建并启动一个由 AgentOS Runtime 执行的 Task；沙箱内的 Pi Agent 启动后，使用注入的环境变量执行 `"$MYSTRA_AGENT_PATH" context get`，成功获得本任务的精确上下文（Workspace 根路径、Project 元数据与任务指示），且不暴露宿主机器路径。

**为什么是 P1**：这是直连控制面的基础生存能力。Agent 必须能获取自身任务上下文才能开展任何工作。

**独立验证**：在 host-c1 上启动一次真实任务，观察 guest 内 Agent 执行 `context get` 的返回结果，验证 `workspace.root` 规范化为 `/home/agentos/workspace`，且控制面审计日志记录了一次合法的 context 读取。

**验收场景**：
1. **Given** 处于 pending 状态、分配至 AgentOS Runtime 的 Task，
   **When** Runner 启动 AgentOS VM（配置 `loopbackExemptPorts: [3000]` 与 `tcp://127.0.0.1:3000` 放行规则）并打开 Session，
   **Then** Guest 内部能够通过 `"$MYSTRA_AGENT_PATH" context get` 执行，进程以 `0` 退出，标准输出输出合法的 JSON 任务上下文，且包含正确的 Task ID。
2. **Given** Guest 执行 `context get`，
   **When** 检查标准输出中的 `workspace.root`，
   **Then** 路径必须为 guest 内挂载点 `/home/agentos/workspace`，绝不包含宿主主机的真实工作区绝对路径。

---

### 场景二：Guest 内 Agent 上报任务状态与阻断原因（P1）

任务执行过程中，AgentOS 沙箱内部的 Agent 遇到外部条件缺失或完成阶段目标，执行 `"$MYSTRA_AGENT_PATH" task status set blocked --expected-revision <rev> --note "..."` 或更新为 `in_progress`；控制面原子校验状态版本号并完成状态转换。

**为什么是 P1**：Agent 必须能够自主回报状态（尤其在被阻断时通知人类操作者），这是任务生命周期闭环的核心。

**独立验证**：在 host-c1 上通过 Agent 真实触发状态变更，读取控制面 Task 状态及 `statusRevision`，验证其发生了严格单调递增并记录了备注。

**验收场景**：
1. **Given** 当前 Task 处于 `in_progress`、revision 为 `R`，
   **When** Guest 内执行 `"$MYSTRA_AGENT_PATH" task status set blocked --expected-revision R --idempotency-key <key> --note "外部依赖缺失"`，
   **Then** 命令退出码为 `0`，控制面 Task 状态变为 `blocked`，Task revision 变为 `R+1`，且持久化记录了该 note。
2. **Given** Guest 再次使用过期的 `--expected-revision R` 执行状态变更，
   **When** 请求到达控制面，
   **Then** 命令以非零退出，标准错误输出返回符合规范的 `conflict` 错误，控制面 Task 状态维持不变。

---

### 场景三：Guest 预检直连能力，失败时严格关闭且不落盘凭据（P1）

当配置错误（例如未配置 `loopbackExemptPorts`、控制面不可达、CLI bundle 挂载缺失、或 execution code 被篡改）时，Runner 在沙箱启动阶段于 Guest 内通过 `vm.process.exec` 直接执行 `"$MYSTRA_AGENT_PATH" whoami`（携带注入的会话环境变量）；一旦预检不通过，立即中断 Session 并清理 VM，绝不写入任何模型凭据（API Key），也绝不静默降级为“无能力的裸沙箱”。

**为什么是 P1**：防止能力静默丢失导致 Agent 在沙箱内产生“幻觉完成”；防止无效会话浪费模型配额与算力；确保凭据安全生命周期。

**独立验证**：在网络规则存在但故意省略 `loopbackExemptPorts`，或故意注入非法的 `MYSTRA_EXECUTION_CODE`，验证 Runner 启动时预检失败、Session 被置为失败、日志记录明确原因，且模型凭据文件未被写入。

**验收场景**：
1. **Given** 注入了无效或被拒绝的 `MYSTRA_EXECUTION_CODE`，
   **When** Runner 尝试在 guest 内部执行预检命令 `"$MYSTRA_AGENT_PATH" whoami`，
   **Then** 预检返回退出码 `1` 且输出 `capability_expired`，Runner 抛出异常终止流程，模型配置绝不写入 guest 文件系统。
2. **Given** 网络白名单放行了 `tcp://127.0.0.1:3000` 但未设置 `loopbackExemptPorts: [3000]`，
   **When** 预检执行网络调用，
   **Then** 预检直接失败（SSRF 拦截导致连接失败，返回 `control_plane_unavailable`），Session 失败关闭，未泄露任何执行凭据。

---

### 场景四：沙箱 VM 销毁重建后续接同一会话，直连能力仍可正常使用（P1）

Runner 所在宿主重启或沙箱 VM 因资源回收被销毁后，维护者/调度器发起对该 Session 的继续执行（mode=`continue`）；在全新的 AgentOS VM 中打开已有 Session ID，持久化的 Session 环境变量自动恢复，Agent 依然可以直接调用 CLI 与控制面通信。

**为什么是 P1**：长时间运行任务（Long-running tasks）依赖跨 VM 续接能力，不能因为沙箱重建导致 Agent 失去控制面通信能力。

**独立验证**：第一轮完成一次状态查询后 `await vm.dispose()` 销毁 VM；第二轮在同一数据库新建 VM 恢复该 Session，再次执行 `"$MYSTRA_AGENT_PATH" context get` 并提交新的状态变更，检查执行成功。

**验收场景**：
1. **Given** 第一轮执行完毕并已销毁 VM，且持久化数据库存在该 Session 记录，
   **When** 以 `mode="continue"` 创建新 VM 并调用 `sessions.open({ sessionId })`，
   **Then** AgentOS sidecar 从 SQLite 中成功恢复 `MYSTRA_CONTROL_PLANE_URL`、`MYSTRA_EXECUTION_CODE`、`MYSTRA_AGENT_PATH` 等 Session 环境变量。
2. **Given** 恢复后的 VM，
   **When** Guest Agent 发起第二轮控制面 CLI 调用，
   **Then** 请求通过 loopback 豁免直连控制面成功，命令正常返回，证明续接后的会话能力完好。

---

### 边界情况

- **Execution Code 刚好过期**：当 Agent 在任务中期调用 CLI 时若 Code 已超时被控制面作废，CLI 必须返回结构化 `capability_expired` 错误，Agent 能够捕获并决定是结束还是报告 blocked。
- **控制面返回 5xx 错误**：Guest CLI 应返回 `internal_error` 并指出是否可重试（`retryable`），不能导致 Guest Node 进程未捕获异常崩溃。
- **并发状态竞争**：多进程或同一 Session 重复执行状态转换时，利用 `expectedRevision` 与 `idempotencyKey` 防重，不出现状态覆盖。
- **Guest 内 Node 执行机制与内核 Stub 约束**：在 host-c1 实测中发现，AgentOS 镜像内的 `/bin/node` 并不是常规可执行 ELF 文件，而是一个 32 字节的内核命令桩（kernel command stub）；guest 系统的 `/usr/bin/env` 软链接至 `/bin/busybox`。因此，通过 shebang 或 `execve` 链式调用（如 `execve("/opt/mystra-agent-cli/mystra-agent.cjs")`）会触发内核错误 `Exec format error`；通过 `sh` 脚本包装也无法解析 `node`（`exit 127`）。只有沙箱内部 Agent 所运行的交互式 shell 才能正确分派 `node` 命令。因此，AgentOS 沙箱内部对 CLI 的具体调用形式必须为 `node "$MYSTRA_AGENT_PATH" <args>`，而 Host Runtime 则是直接执行 `"$MYSTRA_AGENT_PATH" <args>`。
## 需求

### 功能需求

- **FR-060-001**：System MUST 在创建与打开 AgentOS Session 时（`vm.sessions.open`），通过 `env` 参数注入当前 Session 的执行环境变量，包含且仅包含：
  - `MYSTRA_AGENT_PATH`：CLI 在 guest 内部的绝对路径（固定为 `/opt/mystra-agent-cli/mystra-agent.cjs`）；
  - `MYSTRA_CONTROL_PLANE_URL`：Guest 可达的控制面基准 URL，固定格式为 `http://127.0.0.1:<control-plane-port>`；
  - `MYSTRA_EXECUTION_CODE`：控制面为该 Session 签发的短期执行凭据；
  - `MYSTRA_WORKSPACE_ROOT`：固定为 Guest 内部工作区挂载根目录 `/home/agentos/workspace`。
- **FR-060-002**：System MUST 在构建阶段通过 esbuild 0.28.2 将 `packages/agent-cli/bin/mystra-agent` 打包为单文件 CJS bundle（`dist/agentos/mystra-agent.cjs`），保持 target 为 `node22`，格式为 `cjs`（严禁为 esm，且严禁传入 `--banner:js` 重复 shebang），并将其只读（`readOnly: true`）挂载到 guest 内部路径 `/opt/mystra-agent-cli`。
- **FR-060-003**：System MUST 在创建 AgentOS 虚拟机时（`AgentOs.create`）：
  - 显式配置 `loopbackExemptPorts: [<control-plane-port>]`，豁免内核对控制面本地回环端口的 SSRF 拦截；
  - 在维持 `default: deny` 的网络策略下，除已有的模型端点（`tcp://<model-host>:<model-port>`）外，必须增加控制面回环端点的放行规则（`tcp://127.0.0.1:<control-plane-port>`）。
- **FR-060-004**：System MUST 彻底移除废弃的 AgentOS Host Binding 相关实现及配置：
  - 删除 `apps/runner-daemon/src/session/mystra-binding.mjs`；
  - 删除 `apps/runner-daemon/src/session/mystra-binding.test.ts`；
  - 删除 `apps/runner-daemon/src/session/guest-bin/` 目录；
  - 清理 `MYSTRA_AGENTOS_GUEST_BIN` 环境变量及对应的只读挂载点；
  - 引入 `MYSTRA_AGENTOS_GUEST_CLI_DIR` 配置宿主上的 bundle 目录（默认解析至 runner adapter 部署目录旁的 bundle 路径）。
- **FR-060-005**：System MUST 在沙箱 VM 创建及 Session 打开后、写入任何模型凭据（`models.json`）之前，在 Guest 内部通过 `vm.process.exec` 执行直连能力预检命令：
  - 执行命令为 `"$MYSTRA_AGENT_PATH" whoami`，并传入包含 `MYSTRA_CONTROL_PLANE_URL` 与 `MYSTRA_EXECUTION_CODE` 的环境变量选项；
  - 预检成功（返回 `exit 0`）时，方可继续写入模型配置；
  - 预检失败（非零退出码）或超时时，System MUST 立即失败关闭（Fail Closed），抛出包含退出码和输出的明确异常，终止该 Session，清理 VM，绝不写入模型凭据。
- **FR-060-006**：System MUST 保障安全边界，凭据与敏感信息仅通过受控通道传递：
  - `MYSTRA_EXECUTION_CODE` 只能通过 Session 环境变量注入，绝不得作为命令行参数（argv）、事件明文（SessionEvent）、日志输出或独立凭据文件写入 guest 文件系统；
  - Guest 侧 CLI 调用的任何审计或控制面返回结果，必须将宿主真实路径脱敏替换为 `MYSTRA_WORKSPACE_ROOT`（`/home/agentos/workspace`）。
- **FR-060-007**：System MUST 在 Execution Code 过期、被撤销或能力不匹配时，由 Guest CLI 返回稳定的结构化 JSON 错误响应（`capability_expired` 或 `forbidden`），并在退出码为非 0 时退出，禁止静默忽略或降级为无能力运行。
- **FR-060-008**：System MUST 保证沙箱 VM 销毁重建后（mode=`continue`），在全新 VM 中重新打开该 Session 时，利用 AgentOS SDK 原生对 `env_json` 的持久化与回放能力，使 Guest 内的直连控制面能力依然立即可用。
- **FR-060-009**：System MUST 在规范中明确声明取代 Feature 059 中关于“Execution Code 绝不进入沙箱”的隔离决策，并将 059 遗留的未闭环任务 T027 及 FR-006 缺口在此特性完全闭环。
- **FR-060-010**：System MUST 将上下文系统提示词（System Prompt）进行“职责与调用形式”解耦：平台拥有的通用上下文提示词（Standard Execution Prompt）只声明“做什么（WHAT to do）”，绝不包含具体的命令行语法或调用形式；每个 Runtime 独立声明其专属的工作负载调用指令（Workload Instructions）。
- **FR-060-011**：System MUST 在 Runner 侧独立模块（`apps/runner-daemon/src/runtime-instructions.ts`）中定义各 Runtime 的具体指令片段：
  - AgentOS Runtime 片段声明使用 `node "$MYSTRA_AGENT_PATH" <args>`；
  - Host Runtime 片段声明使用 `"$MYSTRA_AGENT_PATH" <args>`；
  - 该指令在 Runtime 注册及心跳上报时传递给控制面并完成持久化存储。
- **FR-060-012**：System MUST 在控制面组装 Session 系统提示词时（`system-prompt-assembler.ts`），将 Runtime 声明的指令作为独立组件 `runtime_workload` 注入，其装配顺序位于 `runtime` 之后、`provider` 之前。
- **FR-060-013**：System MUST 将 Feature 057 中固定工作流（Workflow）的提示词指令从 `fixed-workflow-definition.ts` 中移出，重构为与具体命令语法解耦的“纯义务约束声明（Command-free obligations）”，具体的 workflow 命令形式统一纳入上述 `runtime_workload` 片段。
- **FR-060-014**：System MUST 在验收产物中提供两套清晰可读、作为正式验收比对基准的 Runtime 提示词片段（Host 片段与 AgentOS 片段），并证明控制面组装出的完整提示词无语法冲突或重复命令说明。
### 关键实体与不变量

- **AgentOS Session Env**：绑定于特定 Session 的环境配置字典。
  - 不变量：在 Session 生命周期内，`MYSTRA_CONTROL_PLANE_URL`（`http://127.0.0.1:<port>`）与 `MYSTRA_WORKSPACE_ROOT` 不可变；`MYSTRA_EXECUTION_CODE` 仅对当前 Session 有效。
- **Workload CLI Bundle Projection**：宿主向 Guest 投影的单文件 CJS bundle 实体。
  - 不变量：挂载必须为只读；Bundle 文件独立完整，无外部 node_modules 符号链接依赖。
- **Network Egress Whitelist & loopbackExemptPorts**：沙箱网络放行规则集合。
  - 不变量：最小权限原则，仅放行模型端口与 `127.0.0.1:<control-plane-port>`；回环端口必须在 `loopbackExemptPorts` 中显式登记。

## 成功标准

- **SC-060-001**：在 host-c1 生产运行环境中，通过正常鉴权启动一次真实的 AgentOS Runtime Task，沙箱内的 Agent 独立成功调用 `mystra-agent context get` 并成功调用 `mystra-agent task status set` 变更任务状态。
- **SC-060-002**：控制面收到来自沙箱 Agent 的状态流转请求，Task 状态与 revision 真实发生单调递增，且在控制面可审计。
- **SC-060-003**：第一轮执行后销毁 VM，第二轮以 `continue` 模式新建 VM 续接该 Session，Agent 仍能成功执行 CLI 命令与控制面通信。
- **SC-060-004**：当网络放行规则存在但缺少 `loopbackExemptPorts`，或故意注入无效 code 时，Runner 在预检阶段（< 30s）严格失败关闭，且验证 guest 文件系统内无任何残留模型凭据。
- **SC-060-005**：旧的 Host Binding 及其测试代码和配置被全部干净删除，代码库中不存在废弃的 binding 逻辑与 `guest-bin` 包装。

## 不在范围内

- **宿主进程代理服务（Host Proxy Service）**：不引入额外的宿主侧代理进程或中继转发服务；直连能力通过 AgentOS SDK 原生的 `loopbackExemptPorts` 单项配置与网络规则达成。
- **多租户网络隔离（Multi-tenancy Network Hardening）**：维持同机部署网络模型，不引入专门的虚拟专用网络（VPC）或双向 mTLS 网格。
- **外部 Issue 写回与 PR 自动化**：维持既有范围，本特性仅解决 Guest 内部 Agent 对 Mystra 控制面自身工作负载能力的访问，不增加外部系统（GitHub/Linear）自动化集成。
- **UI 新增交互控件**：无需为本特性的直连能力开发新的前端界面。
