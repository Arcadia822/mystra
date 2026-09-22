---
title: "060 实施计划：AgentOS 直连控制面架构与能力迁移"
feature_id: "060-agentos-direct-control-plane"
spec: "spec.md"
status: "规划中"
---

## 概要

本实施计划承接 Feature 060 设计决策：废除 059 遗留的不可用 AgentOS Host Binding，切为沙箱 Guest 直连控制面的标准工作负载能力架构。

实现核心包括：
1. 在 `apps/runner-daemon` 中引入 `build:agentos-cli` 构建脚本（依赖 `esbuild` 0.28.2），将 `packages/agent-cli/bin/mystra-agent` 打包为单文件 CJS bundle（`dist/agentos/mystra-agent.cjs`，target 为 node22，不添加重复 banner）。
2. 更新 `apps/runner-daemon/src/session/agentos-runner.mjs`：
   - 在 `AgentOs.create` 中传入 `loopbackExemptPorts: [<controlPlanePort>]`；
   - 在 `permissions.network.rules` 中放行 `tcp://127.0.0.1:<controlPlanePort>`；
   - 在 `mounts` 中以 `readOnly: true` 挂载 bundle 目录至 `/opt/mystra-agent-cli`；
   - 在 `vm.sessions.open` 的 `env` 字典中注入 `MYSTRA_AGENT_PATH=/opt/mystra-agent-cli/mystra-agent.cjs`、`MYSTRA_CONTROL_PLANE_URL=http://127.0.0.1:<port>`、`MYSTRA_EXECUTION_CODE`、`MYSTRA_WORKSPACE_ROOT=/home/agentos/workspace`。
3. 替换旧的预检逻辑，改为在 Guest 内部通过 `vm.process.exec('"$MYSTRA_AGENT_PATH" whoami', { env })` 进行真实的直连连通性探测（Fail Closed）。
4. 彻底删除 `mystra-binding.mjs`、`guest-bin/` 包装及相关测试，清理 `MYSTRA_AGENTOS_GUEST_BIN`，引入 `MYSTRA_AGENTOS_GUEST_CLI_DIR`。
5. 更新 `apps/runner-daemon/README.md` 与根目录 `PLATFORM.md` 文档。
6. 组织 host-c1 上的真实双轮执行验证与负向矩阵测试。

## 技术上下文

- **运行时版本**：Node.js 24.14.0，pnpm 10.25.0，TypeScript 5.9，Next.js 16，Vitest 4。
- **打包工具**：`esbuild` 0.28.2（作为 `apps/runner-daemon` 的 devDependency）。
- **AgentOS 依赖**：`@agentos-software/core` 0.2.19，`@agentos-software/pi` 0.2.7。
- **Guest 环境**：AgentOS 虚拟机预装 Node.js v22，用户为 `agentos`，家目录 `/home/agentos`，工作区固定挂载为 `/home/agentos/workspace`。
- **关键模块**：
  - `packages/agent-cli`：入口 `bin/mystra-agent`，被 esbuild 打包为自包含的 CommonJS 单文件 bundle（保留原生 `#!/usr/bin/env node`）。
  - `apps/runner-daemon`：承载 Runner 调度、Session 启动与 AgentOS 容器生命周期管理。

## 变更面逐文件分析

### 1. `apps/runner-daemon/package.json`
- 增加 devDependency：`"esbuild": "0.28.2"`。
- 增加 build 脚本：`"build:agentos-cli": "esbuild ../../packages/agent-cli/bin/mystra-agent --bundle --platform=node --format=cjs --target=node22 --outfile=dist/agentos/mystra-agent.cjs"`。

### 2. `apps/runner-daemon/src/session/agentos-runner.mjs`
- **移除**：
  - `import { mystraBinding } from './mystra-binding.mjs';`
  - `MYSTRA_BINDING_COLLECTION` 常量与 `BINDING_CHECK_TIMEOUT_MS`；
  - `GUEST_BIN_DIRECTORY`、`GUEST_BIN_MOUNT`、`MYSTRA_AGENTOS_GUEST_BIN`；
  - `assertGuestWorkloadBinding` 函数（旧的 `agentos list-bindings` 检查）；
  - `bindings: [...]` 参数配置。
- **新增/调整**：
  - **网络出口规则与端口豁免**：
    - 解析 `controlPlaneUrl`（如 `http://127.0.0.1:3000`），提取端口（如 `3000`）。
    - 在 `AgentOs.create` 传入 `loopbackExemptPorts: [controlPlanePort]`。
    - 在 `permissions.network.rules` 中添加 `{ mode: 'allow', operations: ['*'], patterns: [`tcp://127.0.0.1:${controlPlanePort}`] }`。
  - **CLI 只读投影挂载**：
    - 常量 `GUEST_CLI_MOUNT = '/opt/mystra-agent-cli'`；
    - 宿主目录解析自 `process.env.MYSTRA_AGENTOS_GUEST_CLI_DIR ?? path.join(path.dirname(fileURLToPath(import.meta.url)), '../../dist/agentos')`；
    - 在 `mounts` 中添加 `{ path: GUEST_CLI_MOUNT, readOnly: true, plugin: { id: 'host_dir', config: { hostPath: hostCliDirectory, readOnly: true } } }`。
  - **Session 环境变量注入**：在 `vm.sessions.open` 的 `env` 字典中注入：
    - `MYSTRA_AGENT_PATH`: `/opt/mystra-agent-cli/mystra-agent.cjs`；
    - `MYSTRA_CONTROL_PLANE_URL`: `http://127.0.0.1:${controlPlanePort}`；
    - `MYSTRA_EXECUTION_CODE`: 入参 `executionCode`；
    - `MYSTRA_WORKSPACE_ROOT`: `/home/agentos/workspace`。
  - **新直连预检函数**：
    - 实现 `assertGuestWorkloadDirectCapability(vm, { agentPath, controlPlaneUrl, executionCode }, onLog, aborted)`；
    - 通过 `vm.process.exec('"$MYSTRA_AGENT_PATH" whoami', { env: { MYSTRA_AGENT_PATH, MYSTRA_CONTROL_PLANE_URL, MYSTRA_EXECUTION_CODE, MYSTRA_WORKSPACE_ROOT }, timeoutMs: 30000 })`；
    - 若 `exitCode !== 0` 或抛错，抛出明确异常失败关闭，阻止后续模型凭据写入。

### 3. `apps/runner-daemon/src/session/pi-agentos-shim.mjs`
- 审查参数透传与环境变量映射，确保从上层 session-worker 接收到的 `controlPlaneUrl`、`executionCode` 等属性完整透传至 `runPiInAgentOs`。

### 4. 移除的文件
- `apps/runner-daemon/src/session/mystra-binding.mjs`（彻底删除）。
- `apps/runner-daemon/src/session/mystra-binding.test.ts`（彻底删除）。
- `apps/runner-daemon/src/session/guest-bin/`（彻底删除整个目录，包含其中的 `mystra-agent` bash wrapper 等）。

### 5. 文档更新
- `apps/runner-daemon/README.md`：清理 `MYSTRA_AGENTOS_GUEST_BIN`，记录 `MYSTRA_AGENTOS_GUEST_CLI_DIR`、`build:agentos-cli` 构建步骤、`loopbackExemptPorts` 机制。
- `PLATFORM.md`：更新 AgentOS 架构段落，删除“binding 限制”描述，记录直连控制面与出口放行设计。

## 验证策略

### 1. 单元与构建测试（开发侧）
- 运行 `pnpm --filter @mystra/runner-daemon build:agentos-cli`，检查 `dist/agentos/mystra-agent.cjs` 正常生成，文件大小约 900 KB，头部只有一行 `#!/usr/bin/env node`。
- 单元测试：验证 `permissions` 与 `loopbackExemptPorts` 包含模型端口与 `127.0.0.1:<port>`。
- 单元测试：验证 `mounts` 与 `env` 包含直连所需的 4 个关键环境变量，且 `readOnly: true`。

### 2. host-c1 真实两轮端到端验证
- **Round 1（状态流转与上下文读取）**：
  - 启动真实 Task，由 AgentOS Pi Provider 运行；
  - Agent 在 guest 内触发 `"$MYSTRA_AGENT_PATH" context get`，检查返回的 Task 信息；
  - Agent 在 guest 内触发 `"$MYSTRA_AGENT_PATH" task status set in_progress` 或 `blocked`；
  - 验证控制面 Task 状态与 `statusRevision` 发生递增。
- **Round 2（沙箱销毁与续接验证）**：
  - 销毁当前 VM；
  - 发起续接请求（mode=`continue`），在全新 VM 中打开该 Session；
  - Agent 再次调用 `"$MYSTRA_AGENT_PATH" context get` 并更新状态，验证直连通信依然成功。

### 3. 负向与安全性矩阵验证
| 场景编号 | 测试条件 | 预期行为 |
|---|---|---|
| NEG-01 | 网络 allow 规则存在，但故意缺少 `loopbackExemptPorts` | 内核 SSRF 拦截，预检连接 127.0.0.1 失败（`control_plane_unavailable`），立即失败关闭，模型凭据未写入 |
| NEG-02 | 故意注入非法的 `MYSTRA_EXECUTION_CODE` | 预检返回退出码 1（`capability_expired`），Runner 失败关闭，未落盘任何凭据 |
| NEG-03 | 检查 Guest 文件系统 | 无任何持久化 `models.json`，宿主路径已脱敏 |
| NEG-04 | 尝试直连 Tailscale 或局域网 IP（`http://100.89.186.36:3000`） | 即使配置了 network allow 规则，由于 guest 虚拟网桥限制仍直接失败，证明回环豁免是唯一通道 |
| NEG-05 | 尝试访问非许可公网地址（如 `example.com`） | 被网络防火墙拦截（`blocked by network.http policy`） |

## 风险与失败模式表

| 风险点 | 影响 | 缓解与应对措施 |
|---|---|---|
| 缺少 `loopbackExemptPorts` | Guest 访问 `127.0.0.1:<port>` 被 AgentOS 内核拦截 | 在 `AgentOs.create` 中由 Runner 自动提取控制面端口并强制注入该配置；若缺少则预检直接拦截 |
| CLI bundle 构建使用 ESM 格式 | 运行时抛出 `Dynamic require of "..." is not supported` | esbuild 构建命令强制使用 `--format=cjs`，并在 CI/构建脚本中锁定 |
| 构建脚本添加了 `--banner:js` | 首行 shebang 重复导致脚本解析损坏 | 禁用 `--banner:js`，esbuild 原生保留入口文件的 shebang |
| Code 过期导致中期中断 | 任务未能完成状态上报 | CLI 返回结构化 `capability_expired`，Agent 捕获并记录日志 |
| 环境变量泄漏 | 凭据暴露给未授权代码 | 执行凭据仅在 Session 打开时注入给 AgentOS 运行时，不写入任何 guest 文件，宿主日志严格脱敏 |

## 部署与回滚

- **部署依赖**：执行 `pnpm --filter @mystra/runner-daemon build:agentos-cli` 生成 bundle。
- **回滚方案**：若发现重大阻断，由于 059 binding 原本就在预检中 fail closed，无旧的可用状态需要兼容；可直接切回 059 代码并保持暂停 AgentOS 任务指派。

## 并发与切片策略

本实施划分为清晰的独立阶段：
- **Phase 1: 契约与规范冻结**（当前工作）：完成 Spec-Kit 全套制品。
- **Phase 2: 核心代码重构与构建脚本**：Runner 改造、移除 binding、添加 esbuild bundle 脚本、更新挂载。
- **Phase 3: 自动化测试与文档同步**：单测更新、README 与 PLATFORM 文档同步。
- **Phase 4: host-c1 部署与真实验收**：真实 Task 验证与负向矩阵。
