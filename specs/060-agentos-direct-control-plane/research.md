---
title: "060：技术调研、实测证据与架构决策"
feature_id: "060-agentos-direct-control-plane"
spec: "spec.md"
---

## 核心架构决策：直连控制面取代宿主 Binding

### 1. 废除 059 隔离决定（Supersedes 059 Isolation Decision）

在 Feature 059 中，为了防止任何外部凭据进入沙箱，曾设计了基于 AgentOS Core 宿主 Binding 的隔离方案，提出“`MYSTRA_EXECUTION_CODE` 绝不进入沙箱 guest，guest 仅持有一个伪命令桩，由宿主代理分派”。

**本特性明确正式废除该决定**。
- **废除原因**：
  1. **底层平台不可行**：`agentos-core 0.2.19` 的 binding 机制在 guest 内根本不可分派（见下方实测证据）。
  2. **契约一致性**：Mystra 的原生 Host Runtime 一直采用“向 Agent 子进程注入短期 `MYSTRA_EXECUTION_CODE`，Agent 调用 `mystra-agent` CLI 与控制面通信”的成熟契约。直连方案使得 AgentOS Runtime 与 Host Runtime 在工作负载能力模型上达到 100% 概念对齐，不再维护两套分裂的协议。
  3. **受控的攻击面**：`MYSTRA_EXECUTION_CODE` 本身是**短期（短 TTL）、单次任务作用域（Session-scoped）、不可提升（Capability-bound）**的受限凭据。在沙箱网络已通过白名单严格限制仅能访问控制面与模型端点的前提下，该凭据在 guest 内存中由 AgentOS session env 管理，其安全边界完全符合平台威胁模型。

### 2. 059 遗留阻断项 T027 与 FR-006 闭环说明

在 059 的实施收尾中，独立审查发现了 FR-006 缺口，并记录为阻断项 T027（`agentos-core 0.2.19 的 binding CLI 只支持宿主侧 vm.process.execFile，guest 内不可分派`）。
059 提出了三种处置方案：
- (a) 等待上游修复；
- (b) 改为 host-side 本地会话代理（loopback 穿透）；
- (c) 放弃沙箱能力汇报。

在产品与架构决策中，负责人（MYST-23, GitHub #44）明确否定了 (a)（上游发布不可控且耗时）、否定了 (b)（引入极其复杂的宿主端口监听代理服务与端口分发进程）、否定了 (c)（失去任务闭环能力），正式选择了**利用 SDK 原生 `loopbackExemptPorts` 的直连控制面架构**。
**因此，本特性作为独立的 Feature 060，承接并彻底解决 059 T027 阻断，全面闭环 FR-006 需求**。

---

## host-c1 权威实测证据归档 (agentos-core 0.2.19)

### 1. 网络连通性实测：Tailscale/LAN 阻断 vs Loopback 豁免直通

在 host-c1 上对 AgentOS 虚拟机的网络出口进行了深度测量：

| 目标端点 | 配置规则 | 实际请求结果 | 结论 |
|---|---|---|---|
| 宿主 Tailscale IP: `http://100.89.186.36:3000/api/auth/session` | `network.rules: [{ mode: 'allow', patterns: ['tcp://100.89.186.36:3000'] }]` | `ERR fetch failed` | **不可用**。沙箱微虚拟机内部无法路由或直连宿主的 Tailscale IP 或任何局域网 LAN IP。 |
| 宿主 Loopback (无豁免): `http://127.0.0.1:3000/api/auth/session` | `network.rules: [{ mode: 'allow', patterns: ['tcp://127.0.0.1:3000'] }]`，**未设置 `loopbackExemptPorts`** | 请求被内核拦截，报错连接失败 / SSRF blocked | **不可用**。网络规则本身不足以穿透内核的回环 SSRF 检查。 |
| 宿主 Loopback (有豁免): `http://127.0.0.1:3000/api/auth/session` | `AgentOs.create({ loopbackExemptPorts: [3000] })` 并且放行 `tcp://127.0.0.1:3000` | `HTTP 401`（成功触达控制面并返回正常的未授权响应） | **完全可用**。`loopbackExemptPorts` 是直通控制面的唯一且完备的通道，无需任何宿主额外代理服务。 |

**关键结论**：
1. Guest 面向控制面的 URL 必须固定为 `http://127.0.0.1:<control-plane-port>`。
2. `AgentOs.create` 必须显式设置 `loopbackExemptPorts: [<control-plane-port>]`。
3. `permissions.network.rules` 必须显式放行 `tcp://127.0.0.1:<control-plane-port>`。

---

### 2. CLI 打包与运行实测：CJS Bundle vs ESM 目录树

对 `@mystra/agent-cli` 在 guest 内的运行方式进行了测试：

1. **ESM 格式失败**：直接运行包含 ESM 目录树的产物或使用 esbuild `--format=esm` 打包时，在 guest Node 22 环境下执行报错：
   ```text
   Dynamic require of "..." is not supported
   ```
2. **CJS Bundle 成功**：
   使用 esbuild 0.28.2 执行以下打包命令：
   ```bash
   esbuild packages/agent-cli/bin/mystra-agent \
     --bundle \
     --platform=node \
     --format=cjs \
     --target=node22 \
     --outfile=dist/agentos/mystra-agent.cjs
   ```
   产物大小约 900 KB，单文件自包含。
   **注意**：严禁传 `--banner:js`。因为 `bin/mystra-agent` 原生已包含 `#!/usr/bin/env node`，传入 banner 会导致首行重复生成两条 shebang，从而破坏脚本解析。
3. **Guest 运行验证**：
   - 验证 Shebang 脚本与直接 node 调用（`SHEBANG_ENV_OK`、`PLAIN_NODE_OK` 全部通过）。
   - 无环境变量启动时输出：
     ```json
     {"error":{"code":"invalid_request","message":"MYSTRA_CONTROL_PLANE_URL is required"}}
     ```
   - 环境变量存在但无法连通控制面时输出：
     ```json
     {"error":{"code":"control_plane_unavailable"}}
     ```

---

### 3. Guest 进程执行与环境变量验证

- **`vm.process.exec(command, { env })` 单次环境支持**：
  实测确认 SDK 的 `vm.process.exec` 原生支持 `{ env: Record<string, string> }` 选项，命令执行时能够准确读取到传入的环境变量（验证获得 `EXEC_ENV=from-exec-option`）。
- **Session 环境变量的持久化**：
  059 验收记录中的 SQLite 数据库（`session.sqlite`）显示，`vm.sessions.open({ env })` 传入的字典被精确持久化：
  ```sql
  SELECT env_json FROM agentos_core_sessions;
  -- {"MYSTRA_AGENT_PATH":"/opt/mystra-agent-cli/mystra-agent.cjs", ...}
  ```
  证明虚拟机销毁重建（`mode="continue"`）时，Session 环境变量会被 sidecar 自动完整重放。

---

### 4. AgentOS Core 0.2.19 Guest Binding 失效回顾（059 复测对照）

| 通道 | 命令 | 结果 |
|---|---|---|
| guest shell | `agentos list-bindings` / `/bin/agentos-mystra run ...` | `exit 127`，stderr 归一化为 `error: command not found: agentos` |
| guest Node | `child_process.execFileSync('/bin/agentos-probe', ...)` | 挂起至超时（`exit 137`） |
| host API `vm.process.execFile` | `/bin/agentos-probe sum --a 1 --b 2` | `exit 0`，`{"ok":true,"result":{...}}` |

再次确认了 059 遗留的 binding 在 guest 内部完全失效，必须彻底移除。
