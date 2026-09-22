---
title: "060 快速上手与 host-c1 验收指南"
feature_id: "060-agentos-direct-control-plane"
spec: "spec.md"
---

## 概述

本指南详细说明 Feature 060（AgentOS 基于 `loopbackExemptPorts` 与单文件 CJS bundle 的直连控制面架构）的构建部署要点、host-c1 生产环境真实双轮验收步骤，以及关键故障诊断方法。

---

## 1. 构建与部署配置要点

### 1.1 构建单文件 CJS CLI Bundle
在 `apps/runner-daemon` 下引入并执行打包脚本（依赖 `esbuild` 0.28.2）：
```bash
pnpm --filter @mystra/runner-daemon build:agentos-cli
```
- **构建源**：`packages/agent-cli/bin/mystra-agent`
- **产物位置**：`apps/runner-daemon/dist/agentos/mystra-agent.cjs`
- **关键构建参数**：`--bundle --platform=node --format=cjs --target=node22`
- **禁忌**：严禁传 `--format=esm`（运行时会报 Dynamic require 不支持）；严禁传 `--banner:js`（入口自身已带有 `#!/usr/bin/env node`，重复 banner 会导致文件损坏）。
- **验证构建**：生成文件体积约 900 KB，头部单行 shebang，单文件完全自包含。

### 1.2 控制面地址与 loopback 端口豁免配置
- **控制面配置**：
  在 host-c1 部署环境中，由于 guest 无法路由宿主的 Tailscale IP 或 LAN IP，Guest 视角访问控制面的 URL 必须固定为：
  ```bash
  MYSTRA_CONTROL_PLANE_URL="http://127.0.0.1:3000"
  ```
- **Runner 行为**：
  Runner 在创建 AgentOS VM 时，会自动解析 URL 端口（`3000`），并配置：
  1. `loopbackExemptPorts: [3000]`
  2. `permissions.network.rules`: 放行 `tcp://127.0.0.1:3000`

### 1.3 挂载目录与环境变量
- **CLI 挂载目录**：
  通过 `MYSTRA_AGENTOS_GUEST_CLI_DIR` 指定宿主上的 bundle 目录（默认指向部署目录旁的 `dist/agentos`）。Runner 将其以 `readOnly: true` 挂载到 guest 内的 `/opt/mystra-agent-cli`。
- **清理旧配置**：彻底移除废弃的 `MYSTRA_AGENTOS_GUEST_BIN` 变量与 `guest-bin/` 目录。

---

## 2. host-c1 真实两轮端到端验收步骤

验收必须通过真实的正常授权 Task 入口发起，严禁使用本地 mock 脚本绕过控制面鉴权。

### 2.1 准备测试 Task
在控制面（或通过 Mystra CLI/MCP）创建一个绑定到 AgentOS Runtime 的一次性 Task：
- **Task ID**: 记录为 `task_test_060`
- **初始状态**: `pending` (revision: 1)
- **初始指令**: `"请先调用 $MYSTRA_AGENT_PATH context get 读取上下文，随后调用 $MYSTRA_AGENT_PATH task status set in_progress 将任务状态设置为 in_progress"`

---

### 2.2 第一轮执行（Round 1：真实读取与状态更新）
1. **触发启动**：
   通过正常流程启动该 Task 的 production/session 执行。
2. **观察 Runner 与沙箱日志**：
   - 验证 Runner 日志包含：
     ```text
     [agentos-pi] creating AgentOs VM; workspace=...
     [agentos-pi] guest workload direct capability reachable (whoami exit 0)
     [agentos-pi] opening start pi session ...
     ```
   - 验证真实预检（`"$MYSTRA_AGENT_PATH" whoami`）通过后才输出了 `guest model configured` 与凭据删除日志。
3. **核查 Agent 操作证据**：
   - Agent 在沙箱内成功执行了 `"$MYSTRA_AGENT_PATH" context get`；
   - 检查 Agent 获得的上下文中 `workspace.root` 为 `/home/agentos/workspace`（未泄漏宿主机路径）；
   - Agent 成功调用 `"$MYSTRA_AGENT_PATH" task status set in_progress --expected-revision 1`。
4. **核查控制面状态**：
   - 检查控制面 Task 状态变为 `in_progress`；
   - 检查控制面 Task `statusRevision` 变为 `2`；
   - 检查控制面审计记录中存在一次合法的状态变更记录。

---

### 2.3 销毁 VM 与第二轮续接（Round 2：沙箱重建后直连能力验证）
1. **主动销毁沙箱**：
   模拟宿主或沙箱崩溃：通过 Runner 管理接口或调度指令销毁该 Session 所在的 AgentOS VM（执行 `await vm.dispose()`）。
2. **发起续接请求**：
   针对同一个 Session ID 发起续接请求（`mode="continue"`），输入新指令：
   `"继续执行，调用 $MYSTRA_AGENT_PATH task status set blocked --expected-revision 2 --note '等待第三方依赖审核'"`
3. **验证全新 VM 的恢复过程**：
   - 观察 Runner 日志确认在全新的微虚拟机中打开了已有 Session：
     ```text
     [agentos-pi] opening continue pi session <session-id> in /home/agentos/workspace
     ```
   - 验证环境变量从 SQLite `env_json` 中成功恢复。
4. **核验第二轮直连调用**：
   - Agent 再次成功执行状态变更；
   - 控制面 Task 状态变为 `blocked`；
   - 控制面 Task `statusRevision` 递增为 `3`，且备注持久化成功。

---

### 2.4 负向安全矩阵验证步骤

#### 负向 1：放行规则存在但缺少 `loopbackExemptPorts`（内核豁免验证）
- 在配置中保留 `tcp://127.0.0.1:3000` 网络规则，但临时移除 `loopbackExemptPorts: [3000]`。
- 启动 Task，观察 Runner：
  - 启动在预检阶段失败，CLI 返回 `control_plane_unavailable`；
  - Runner 抛出异常失败关闭，沙箱被自动清理释放；
  - **绝无 `models.json` 模型凭据被写入**（证明 `loopbackExemptPorts` 是直连生效的负向安全关键依赖）。

#### 负向 2：无效的 Execution Code（鉴权拦截）
- 注入篡改过的 `MYSTRA_EXECUTION_CODE="invalid-code"`。
- 观察预检或 CLI 调用输出：
  - 返回退出码 `1`，标准错误输出 JSON：`{"error":{"code":"capability_expired","message":"..."}}`；
  - 控制面拒绝操作，未发生状态变更。

#### 负向 3：非白名单公网或 LAN 访问拦截
- 在沙箱内执行 `node -e "fetch('https://example.com')"` 或 `node -e "fetch('http://100.89.186.36:3000')"`。
- 预期结果：被内核直接阻断或连接失败，证明网络策略严格生效。

---

## 3. 诊断与排错：“Guest 环境变量未传递至工具子进程”

在实测中，若发现 Agent 运行但报错找不到 `MYSTRA_CONTROL_PLANE_URL` 或 `MYSTRA_EXECUTION_CODE`，按以下步骤排查：

1. **排查 Session Env 注入与持久化**：
   - 检查 `agentos-runner.mjs` 中的 `vm.sessions.open` 调用。
   - 检查沙箱对应的 `session.sqlite` 数据库：
     ```bash
     sqlite3 /root/.mystra/agentos-sessions/<session-id>/session.sqlite "SELECT env_json FROM agentos_core_sessions;"
     ```
     验证返回的 JSON 字符串中是否包含正确的环境变量键值（`MYSTRA_AGENT_PATH` 应为 `/opt/mystra-agent-cli/mystra-agent.cjs`）。
2. **排查 CLI Bundle 构建与 Shebang**：
   - 检查 `dist/agentos/mystra-agent.cjs` 文件头部，确保第一行仅包含一个 `#!/usr/bin/env node`。
   - 确保文件具备 `0755` 权限。
3. **排查回环端口豁免**：
   - 确认控制面端口与 `loopbackExemptPorts` 以及 `tcp://127.0.0.1:<port>` 端口号完全一致。

## 4. 2026-09-22 本机与 host-c1 实测记录（实施期）

### 4.1 可行性实测（探测结论，实施前）

在 host-c1 上用 agentos-core 0.2.19 的原生 sidecar 逐项测量，作为本特性设计依据：

| 检查 | 命令/方式 | 结果 |
|---|---|---|
| guest 能否访问宿主 Tailscale/内网地址 | guest 内 `fetch('http://100.89.186.36:3000/api/auth/session')`，放行 `tcp://100.89.186.36:3000` | `fetch failed`（不可达） |
| guest 能否访问宿主 loopback | 仅放行规则时同上测 `http://127.0.0.1:3000` | `fetch failed` |
| loopback 豁免后 | `AgentOs.create({ loopbackExemptPorts: [3000] })` + 放行 `tcp://127.0.0.1:3000` | `HTTP 401`（控制面已应答，可达） |
| guest 是否执行 `#!/usr/bin/env node` 脚本 | 挂载 `shebang.mjs` 后直接按路径执行 | `SHEBANG_ENV_OK` |
| guest 运行 node 文件 | `node plain.mjs` | `PLAIN_NODE_OK`（guest node v22） |
| `vm.process.exec` 是否传递 `env` | `sh -c 'echo EXEC_ENV=$SENTINEL'` 带 `env:{SENTINEL:...}` | `EXEC_ENV=from-exec-option` |
| CLI 打包格式 | esbuild `--format=esm` / `--format=cjs` | ESM 运行时报 `Dynamic require of "..." is not supported`；CJS 正常，无 env 时输出 `{"error":{"code":"invalid_request","message":"MYSTRA_CONTROL_PLANE_URL is required"}}`，不可达时输出 `{"error":{"code":"control_plane_unavailable"}}` |
| bundle 体积 | `apps/runner-daemon/dist/agentos/mystra-agent.cjs` | 约 900 KB，首行 `#!/usr/bin/env node` |

结论：guest 可达控制面的唯一路径是**宿主 loopback + `loopbackExemptPorts`**，且 CLI 必须以**单文件 CJS bundle** 投影。

### 4.2 本机验证

- `pnpm --filter @mystra/runner-daemon run build:agentos-cli` 产出 `dist/agentos/mystra-agent.cjs`（`dist/` 已被 gitignore）。
- runner 包：`vitest` 12 文件 / 49 用例通过，`tsc --noEmit` 无错误。
- 全仓：`pnpm typecheck` 0 错误；`pnpm test` 全绿（control-plane 540 通过 / 24 跳过，runner 49，agent-cli 23，agent-adapters 10，spec-prototype 41）。
- `pnpm install --frozen-lockfile` 通过；锁文件仅新增 runner-daemon 的 `esbuild 0.28.2` 条目。

### 4.3 host-c1 部署

- `/opt/agentos/guest-cli/mystra-agent.cjs`（md5 `5ca9bcf3b0038c43376d5591b961d8b4`，0755）。
- `/opt/mystra/apps/runner-daemon/src/session/agentos-runner.mjs`（md5 `f5f9ea0e2d55b9d0b6a830e533be36b0`）。
- `/root/.mystra/runner-agentos.env` 新增 `MYSTRA_AGENTOS_GUEST_CLI_DIR=/opt/agentos/guest-cli`；`MYSTRA_CONTROL_PLANE_URL=http://127.0.0.1:3000` 作为 guest 可达地址默认值。
- 已删除部署副本中的 `mystra-binding.mjs` 与 `guest-bin/`；`mystra-agentos-runner.service` 重启后 `active`，Runtime `b5797837-160d-4340-8371-8820af16d830` 以 `type=agentos` 注册，`pi` provider `available`。

### 4.4 2026-09-22 host-c1 实测：guest 内 CLI 入口执行方式（未收敛）

一轮真实 Task 验收暴露了 guest 侧入口的执行差异，实测矩阵（同一 read-only `host_dir` 投影、同一 bundle md5 `5ca9bcf3…`）：

| 调用方式 | 结果 |
|---|---|
| `vm.process.exec('/opt/mystra-agent-cli/mystra-agent.cjs whoami')`，首次探测 | 成功（`capability_expired`，即脚本已执行、argv 已解析、控制面已到达） |
| 同上，后续多次（含复制到 `/tmp` 后 `chmod 0755` 再执行） | `exit 126`：`failed to execute command '…': Exec format error (os error 45)` |
| `vm.process.exec('node /opt/mystra-agent-cli/mystra-agent.cjs whoami')` | **稳定成功**（多次复现 `capability_expired`） |
| `sh` 包装脚本内 `exec node …` | `exit 127`（`node` 是 AgentOS 内核命令，不是文件，嵌套 shell 无法解析） |
| `vm.process.exec(path, { args: ['whoami'] })` | `args` 不会被转发，CLI 收到空 argv，回答 `Invalid mystra-agent command` |

根因（2026-09-22 追加实测）：guest 内 `/usr/bin/env` 是指向 busybox 的符号链接，`/bin/node` 是 32 字节的 **内核命令 stub**（不是可执行文件）。因此任何经 `execve` 链的 shebang 执行都会以 `Exec format error` 失败——包括把 bundle 复制到 guest 本地可写目录后 `chmod 0755` 再执行、以及指向该副本的符号链接；`sh` 包装内 `exec node …` 同样不可用（嵌套 shell 解析不到内核命令，exit 127）。只有 **Agent 的 shell 自身能把 `node` 当作内核命令解析**，所以 `node "$MYSTRA_AGENT_PATH" …` 是唯一稳定形式（实测多次成功，CLI 正常解析 argv 并到达控制面）。

结论（当前状态）：guest 内**通过 `node <bundle> …` 调用是唯一可用形式**；依赖 shebang 的直接执行在读投影上不稳定。因为程序所有的标准提示词要求 Agent 运行 `"$MYSTRA_AGENT_PATH" context get`（直接执行），FR-006 的"沙箱内可用"尚未收敛：

- 适配器已实现并在 host-c1 验证的部分：guest 可达控制面（`loopbackExemptPorts` + `tcp://127.0.0.1:3000`）、durable session env 注入四个 `MYSTRA_*` 键、投影失败/能力不可达时**在写模型凭据前失败关闭**（实测该闸门按设计生效，未泄漏任何 code）。
- 已批准的方向（owner 2026-09-22）：**上下文级提示词只描述"做什么"，不再写具体命令；具体命令由 Runtime 注入**。AgentOS Runtime 的片段使用 `node "$MYSTRA_AGENT_PATH" …` 形式，host Runtime 使用直接执行形式；057 的 workflow 指令一并移入该片段。在此之前 AgentOS Session 会按设计失败关闭。

### 4.5 2026-09-22 host-c1 最终验收（通过）

部署一致性：adapter `95882e24b0f54e3ffbef778ba2681ac8`，guest bundle `5ca9bcf3b0038c43376d5591b961d8b4`；`mystra-control-plane`、`mystra-agentos-runner` 均 active；Runtime `b5797837-160d-4340-8371-8820af16d830`（type `agentos`）注册，`pi 0.2.7 / agentos-core 0.2.19` available。

**Round 1（Task `4a013712-20d0-49ca-8287-c3bd6e4ff5bd`，Session `b20376e0-0f6e-4d87-9b90-fc15c2c1e40b`）**
- pre-flight 在 guest 内通过：日志 `[agentos-pi] guest workload CLI resolved its Session capability`。
- Agent 在 guest 内实际执行（均 exit 0）：`whoami`（返回本次 execution 身份与 capabilities）、`context get`（返回 team/task/project/workspace root 与 branch）、`task status get`（`in_progress` rev 2）、`task status set blocked --expected-revision 2`（→ `blocked` rev 3）、`task status set in_progress --expected-revision 3`（→ `in_progress` rev 4）；原始输出同时写入工作区 `docs/060-CAPABILITY.md`。
- 数据库真值：`tasks.status=in_progress`、`status_revision=4`；`task_status_transitions` 三条：`pending→in_progress` rev2、`→blocked` rev3、`→in_progress` rev4（即写通道确实改动了 Task 状态）。

**Round 2（续接）**：新 VM 重建后 pre-flight 再次通过（`session ready` 同一 sessionId，durable 会话恢复），Agent 仍可调用 CLI。

**负向**：篡改 execution code 后 `whoami` 返回 `{"error":{"code":"capability_expired",...}}`，exit 1，失败关闭。

**泄漏审计**：execution code 在 `session_events`、工作区文件、runner journal 中出现 0 次；在 AgentOS `agentos_core_sessions.env_json` 中出现 1 次（设计如此），`agentos_core_events/prompts/fs chunks` 均 0 次。

**清理**：临时验收用户与 membership 已删除；Task、Session、事件与工作区证据保留。

**结论**：FR-006 达成——沙箱内 Agent 可获取并使用本 Session 能力（读上下文、按 expected-revision 报状态），且不把 execution code 泄漏到事件/产物/日志。
