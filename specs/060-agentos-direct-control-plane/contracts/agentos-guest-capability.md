# 契约：AgentOS Guest 工作负载能力契约

## 规范状态
- **版本**：1.0.0
- **特性**：060-agentos-direct-control-plane
- **适用环境**：AgentOS 沙箱虚拟机内部（Guest 侧）及 Runner 适配层

---

## 1. 契约概述

本契约规范了 Mystra 控制面、Runner 守护进程与 AgentOS 沙箱内部 Agent 之间的通信界面与交互协议。
废除基于宿主 `vm.process.execFile` 的 Host Binding，采用 Guest 原生 Node (v22) 进程执行只读挂载的单文件 CJS bundle（`mystra-agent.cjs`），通过 AgentOS 原生 `loopbackExemptPorts` 豁免机制直连控制面 127.0.0.1 端口。

---

## 2. Guest 环境变量契约

Runner 在调用 `vm.sessions.open` 时，必须向沙箱会话上下文注入以下环境变量：

| 变量名 | 必填 | 格式与示例 | 语义说明 |
|---|---|---|---|
| `MYSTRA_AGENT_PATH` | 是 | 绝对路径，固定为 `/opt/mystra-agent-cli/mystra-agent.cjs` | Workload CLI 单文件 bundle 的入口执行文件路径。 |
| `MYSTRA_CONTROL_PLANE_URL` | 是 | 绝对 URL，格式为 `http://127.0.0.1:<port>`（如 `http://127.0.0.1:3000`） | Guest 直连控制面的基准 URL。末尾不包含斜杠。 |
| `MYSTRA_EXECUTION_CODE` | 是 | 不透明字符串（长度通常 >= 32） | 当前 Session 的一次性短期执行授权凭据。 |
| `MYSTRA_WORKSPACE_ROOT` | 是 | 绝对路径，固定为 `/home/agentos/workspace` | Guest 视角下的任务工作区根目录，用于路径归一化与脱敏。 |

### 环境变量使用约束
1. **进程隔离**：环境变量属于当前 Session，由 AgentOS sidecar 存储并持久化（`env_json`）。
2. **禁止落盘**：`MYSTRA_EXECUTION_CODE` 绝不得被写入磁盘上的任何明文文件（如 `.env` 或临时 json）。
3. **禁止泄漏**：任何 CLI 输出或日志组件在记录环境变量或异常堆栈时，必须对 `MYSTRA_EXECUTION_CODE` 进行脱敏遮蔽（如显示为 `***`）。

---

## 3. Workload CLI Bundle 投影契约

### 3.1 打包与构建规范
- **打包工具**：`esbuild` 0.28.2（`apps/runner-daemon` 的 devDependency）。
- **源入口**：`packages/agent-cli/bin/mystra-agent`。
- **打包命令与参数**：
  ```bash
  esbuild packages/agent-cli/bin/mystra-agent \
    --bundle \
    --platform=node \
    --format=cjs \
    --target=node22 \
    --outfile=dist/agentos/mystra-agent.cjs
  ```
- **格式约束**：
  - 必须为 `cjs` 格式（`--format=cjs`）。严禁为 `esm`，否则在 guest 运行时会抛出 `Dynamic require of "..." is not supported` 致命错误。
  - 严禁传入 `--banner:js`。`bin/mystra-agent` 头部自带 `#!/usr/bin/env node`，传入 banner 会导致脚本首行 shebang 重复损坏。
  - 生成的单文件大小约为 900 KB，完全自包含。

### 3.2 挂载与运行时规范
- **宿主源路径**：宿主配置的 bundle 目录（由 `MYSTRA_AGENTOS_GUEST_CLI_DIR` 指定，默认解析至部署目录对应的 `dist/agentos`）。
- **Guest 目标路径**：以 `readOnly: true` 挂载至 guest 的 `/opt/mystra-agent-cli`。
- **可执行性**：文件必须具备可执行权限（`0755`），guest Node 22 原生解析 shebang 与执行。

---

## 4. 网络出口与端口豁免契约

AgentOS VM 必须在 `AgentOs.create` 时显式声明 `loopbackExemptPorts` 与权限策略（`permissions`）：

```javascript
const controlPlanePort = new URL(controlPlaneUrl).port || '80';

const vm = await AgentOs.create({
  software: [pi],
  database: { type: 'sqlite_file', path: databasePath },
  mounts,
  // 必须显式豁免控制面使用的 loopback 端口以规避内核 SSRF 拦截
  loopbackExemptPorts: [Number(controlPlanePort)],
  permissions: {
    fs: 'allow',
    childProcess: 'allow',
    process: 'allow',
    env: 'allow',
    network: {
      default: 'deny',
      rules: [
        // 1. 模型提供商端点
        { mode: 'allow', operations: ['*'], patterns: [`tcp://${modelEndpoint.hostname}:${modelEndpoint.port || '443'}`] },
        // 2. 控制面本地回环端点
        { mode: 'allow', operations: ['*'], patterns: [`tcp://127.0.0.1:${controlPlanePort}`] },
      ],
    },
  },
});
```

### 规则判定规则
- 模式串必须采用规范化资源字符串 `tcp://127.0.0.1:<port>`。
- 若只配置了 network allow 规则但缺少 `loopbackExemptPorts`，内核会拦截对回环地址的访问，连接将被直接拒绝（返回 `control_plane_unavailable`）。
- 除模型端点与 `127.0.0.1:<controlPlanePort>` 外，其余一切出站流量（外部 LAN IP、Tailscale IP、公网等）均被强行拦截。

---

## 5. Workload CLI 命令与交互界面

Guest Agent 在沙箱内通过命令行与控制面通信。在 AgentOS 沙箱中，由于内核命令桩与 busybox env 交互限制，调用命令的具体形式必须由 Agent 的交互式 shell 显式分派为：
```bash
node "$MYSTRA_AGENT_PATH" <args>
```
该调用形式由 AgentOS Runtime 独立声明（`apps/runner-daemon/src/runtime-instructions.ts`）并通过控制面提示词组件 `runtime_workload` 注入，**不是通用 Standard Prompt 的一部分**。所有命令均以非零退出码表示失败，并向 `stdout` 输出结构化 JSON（成功时）或向 `stderr` 输出结构化错误（失败时）。

### 5.1 获取上下文 (`context get`)
- **命令**：`node "$MYSTRA_AGENT_PATH" context get`
- **输入依赖**：`MYSTRA_CONTROL_PLANE_URL`, `MYSTRA_EXECUTION_CODE`, `MYSTRA_WORKSPACE_ROOT`。
- **成功输出 (stdout, exit 0)**：
  ```json
  {
    "taskId": "task-uuid-123",
    "sessionId": "session-uuid-456",
    "workspace": {
      "root": "/home/agentos/workspace",
      "branch": "main"
    },
    "project": {
      "id": "proj-uuid-789",
      "name": "my-project"
    },
    "capabilities": ["context:read", "task-status:read", "task-status:transition"]
  }
  ```
- **核心契约**：`workspace.root` 必须显示为 guest 内路径 `/home/agentos/workspace`，绝不泄漏宿主主机实际路径。

### 5.2 上报任务状态 (`task status set`)
- **命令**：
  ```bash
  node "$MYSTRA_AGENT_PATH" task status set <status> \
    --expected-revision <number> \
    [--idempotency-key <string>] \
    [--note <string>]
  ```
- **参数说明**：
  - `<status>`：当前支持 `in_progress` 或 `blocked`。当状态为 `blocked` 时，`--note` 为必填项。
  - `--expected-revision`：必填，客户端已知当前的 revision，用于防止并发写覆盖。
- **成功输出 (stdout, exit 0)**：
  ```json
  {
    "taskId": "task-uuid-123",
    "status": "blocked",
    "statusRevision": 3,
    "statusUpdatedAt": "2026-09-22T12:00:00.000Z",
    "transitionId": "00000000-0000-4000-8000-000000000009"
  }
  ```

---

## 6. 错误与失败语义（Failure Semantics）

当调用出现异常时，CLI 必须向 `stderr` 输出符合统一错误规范的 JSON 结构，并返回指定的退出码：

```json
{
  "error": {
    "code": "<error_code>",
    "message": "<human_readable_message>",
    "retryable": false
  }
}
```

### 错误码映射表
| HTTP 状态 | 错误码 (`code`) | 退出码 | 场景说明 |
|---|---|---|---|
| - | `invalid_request` | 1 | 缺少环境变量（如 `MYSTRA_CONTROL_PLANE_URL`）或参数格式错误 |
| - | `control_plane_unavailable` | 1 | 网络连通性失败（如缺少 `loopbackExemptPorts` 或控制面未就绪） |
| 401 | `capability_expired` | 1 | `MYSTRA_EXECUTION_CODE` 已过期、失效或被拒绝 |
| 403 | `forbidden` | 1 | 当前 Session 未被授予执行该命令所需的 capability |
| 409 | `conflict` | 1 | `expectedRevision` 与当前控制面版本不匹配（并发冲突） |
| 500 / 502 | `internal_error` | 2 | 控制面内部异常（`retryable: true`） |

---

## 7. 预检与 Fail-Closed 契约

在 Runner 部署与运行生命周期中，必须实施启动预检门禁：
1. **时机**：VM 创建后、Session 打开后、且**在写入模型凭据文件（`models.json`）之前**。
2. **执行探测**：通过 `vm.process.exec` 在 guest 内部执行真实的谁我是命令：
   ```javascript
   await vm.process.exec('"$MYSTRA_AGENT_PATH" whoami', {
     env: {
       MYSTRA_AGENT_PATH: '/opt/mystra-agent-cli/mystra-agent.cjs',
       MYSTRA_CONTROL_PLANE_URL: controlPlaneUrl,
       MYSTRA_EXECUTION_CODE: executionCode,
       MYSTRA_WORKSPACE_ROOT: '/home/agentos/workspace',
     },
     timeoutMs: 30_000,
     output: { capture: 'all' },
   });
   ```
3. **断言与阻断**：
   - 探测必须在 30 秒内返回退出码 `0`。
   - 若退出码非 0（如返回 127 找不到文件、返回 `control_plane_unavailable`、返回 401 `capability_expired`，或挂起超时），Runner 必须立刻终止启动流程，抛出明确的异常阻断，清理 VM，严禁写入任何模型 API Key。
