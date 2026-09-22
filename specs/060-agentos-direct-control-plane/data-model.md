---
title: "060 数据模型与状态契约"
feature_id: "060-agentos-direct-control-plane"
spec: "spec.md"
---

## 概述

Feature 060 属于沙箱运行时能力交付与网络拓扑重构，**不新增任何数据库持久化业务实体、Prisma 模型或数据库迁移脚本**。

本特性完全复用 Mystra 现有的领域模型与执行契约，聚焦于现有对象在 AgentOS 沙箱内的投影、环境变量映射及状态流转约束。

---

## 涉及的现有核心对象与映射

### 1. Runtime
- **定义**：平台注册的执行环境实例，定义了其类型（`type: 'host' | 'agentos'`）、工作区根目录及 Provider 支持能力。
- **与本特性的关系**：
  - 本特性针对 `type: 'agentos'` 的 Runtime。
  - 该 Runtime 由 `mystra-runner` 托管，通过 `agentos-runner.mjs` 拉起微虚拟机沙箱。
  - **不变量**：一个 Runner 实例同时仅绑定一个具体的 Runtime，其沙箱类型不可在任务执行中途切换。

### 2. Session Environment（运行时会话环境）
- **定义**：注入到沙箱内部特定执行 Session 的环境变量字典。
- **字段定义与生命周期**：
  | 变量名 | 类型 | 说明 | 时效与不变量 |
  |---|---|---|---|
  | `MYSTRA_AGENT_PATH` | string | Guest 内部指向真实单文件 CJS bundle CLI 的绝对路径（固定为 `/opt/mystra-agent-cli/mystra-agent.cjs`） | 固定值，会话生命周期内不可变 |
  | `MYSTRA_CONTROL_PLANE_URL` | string | Guest 内部可达的控制面基准 URL，固定格式为 `http://127.0.0.1:<port>` | 固定值，会话生命周期内不可变 |
  | `MYSTRA_EXECUTION_CODE` | string | 控制面分派给该 Session 的短期执行凭据 | 作用域限定于当前 Session，具备有效 TTL |
  | `MYSTRA_WORKSPACE_ROOT` | string | Guest 内部工作区绝对路径（固定为 `/home/agentos/workspace`） | 固定值，用于路径脱敏 |
- **持久化约束**：
  - 由 AgentOS sidecar 存储在虚拟机 SQLite 数据库 `agentos_core_sessions.env_json` 中。
  - 在 VM 销毁重建（`mode="continue"`）时，由 AgentOS 自动反序列化并注入到恢复后的会话环境中。

### 3. Task Dispatch Claim 与 Capabilities
- **定义**：控制面在 Runner Claim 任务或启动 Session 时签发的能力描述结构：
  ```typescript
  interface ExecutionClaim {
    code: string;               // 对应的 MYSTRA_EXECUTION_CODE
    taskId: string;             // 绑定的 Task ID
    sessionId: string;          // 绑定的 Session ID
    capabilities: string[];     // 授予的能力清单
    expiresAt: string;          // 过期时间戳 (ISO8601)
  }
  ```
- **核心 capabilities**：
  - `context:read`：允许执行 `"$MYSTRA_AGENT_PATH" context get` 读取当前任务元数据与指导。
  - `task-status:read`：允许执行 `"$MYSTRA_AGENT_PATH" task status get`。
  - `task-status:transition`：允许执行 `"$MYSTRA_AGENT_PATH" task status set` 触发状态转换。
  - `workflow:read` / `workflow:transition`：针对具有明确 workflow 阶段的任务。
- **不变量**：
  - 凭据签名绑定了 `taskId` 与 `sessionId`，无法跨任务使用。
  - Guest 侧 CLI 调用的命令若未在 `capabilities` 授权清单内，控制面直接拒绝（HTTP 403 / `forbidden`）。

### 4. Task 状态流转与预期版本号（State Transition & Expected Revision）
- **定义**：Task 的生命周期状态变更模型。
- **状态流转字段**：
  - `status`: `'pending' | 'in_progress' | 'blocked' | 'completed' | 'failed'` 等。
  - `statusRevision`: 单调递增整数（从 `1` 开始）。
  - `note`: 状态变更时的说明（当变更至 `blocked` 时必填）。
  - `idempotencyKey`: 客户端提交的幂等键。
- **不变量**：
  - 乐观并发锁（Optimistic Locking）：Guest CLI 提交状态变更时，必须提供 `--expected-revision <currentRev>`。
  - 若控制面当前实际版本号与 `expectedRevision` 不匹配，转换被原子拒绝，返回冲突错误；Task 状态保持不变。

---

## 数据流与边界图

```text
[Control Plane (Listening on 127.0.0.1:3000 on host)]
      │
      │ 1. Dispatch Task with ExecutionClaim (code, url, capabilities)
      ▼
[Host: Runner Daemon]
      │
      │ 2. AgentOs.create:
      │    - loopbackExemptPorts: [3000]
      │    - Egress Policy: allow tcp://<model-host> & tcp://127.0.0.1:3000
      │    - Mounts: readOnly host_dir -> /opt/mystra-agent-cli (mystra-agent.cjs)
      │    - Workspace: readWrite host_dir -> /home/agentos/workspace
      │
      │ 3. vm.sessions.open({
      │      env: {
      │        MYSTRA_AGENT_PATH: "/opt/mystra-agent-cli/mystra-agent.cjs",
      │        MYSTRA_CONTROL_PLANE_URL: "http://127.0.0.1:3000",
      │        MYSTRA_EXECUTION_CODE,
      │        MYSTRA_WORKSPACE_ROOT: "/home/agentos/workspace"
      │      }
      │    }):
      │    - Persisted into session.sqlite (env_json)
      ▼
[Guest: AgentOS VM]
      │
      │ 4. Pre-flight check via vm.process.exec:
      │    "$MYSTRA_AGENT_PATH" whoami (with injected env)
      │    (Pass -> write ephemeral models.json; Fail -> Fail Closed immediately)
      │
      │ 5. Pi Agent executes workload:
      │    exec: "$MYSTRA_AGENT_PATH" context get
      │    exec: "$MYSTRA_AGENT_PATH" task status set blocked --expected-revision 2 --note "..."
      │
      │ 6. HTTP requests direct egress via loopbackExemptPorts to 127.0.0.1:3000
      ▼
[Control Plane: /api/tasks/:id/execution/...]
      - Validate MYSTRA_EXECUTION_CODE
      - Check granted capability
      - Atomic verify & increment statusRevision
```
