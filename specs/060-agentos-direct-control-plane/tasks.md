---
title: "060 实施任务与验收状态"
feature_id: "060-agentos-direct-control-plane"
spec: "spec.md"
status: "待实施"
---

## Phase 1: 规范、契约与审查 (Spec & Design Review)

- [x] T001 [Spec] 确立 Feature 060 正式规范 `spec.md` 与契约 `contracts/agentos-guest-capability.md`，明确取代 059 隔离决定，关闭 059 T027 阻断与 FR-006 缺口。
- [ ] T002 [Review] 组织独立设计审查，锁定基于 `loopbackExemptPorts`、单文件 CJS bundle 与直连预检的完整架构。

## Phase 2: CLI 打包脚本与核心运行时改造 (Build & Runner Implementation)

- [x] T003 [Build] 在 `apps/runner-daemon` 中引入 devDependency `esbuild@0.28.2` 并添加脚本 `build:agentos-cli`，将 `packages/agent-cli/bin/mystra-agent` 打包为 `dist/agentos/mystra-agent.cjs`（`--bundle --platform=node --format=cjs --target=node22`，禁止 `--banner:js`）。
  - *验收与证据*：产物大小约 900 KB，单文件 CJS，头部单行 shebang，运行无 dynamic require 报错。
- [x] T004 [Runner] 改造 `apps/runner-daemon/src/session/agentos-runner.mjs` 中的 `AgentOs.create`：解析 `controlPlaneUrl` 端口，传入 `loopbackExemptPorts: [<port>]`，并在 network rules 中放行 `tcp://127.0.0.1:<port>`。
  - *验收与证据*：单测断言 create 配置中包含该端口豁免与 network allow 规则。
- [x] T005 [Runner] 改造 `agentos-runner.mjs` 中的 `mounts` 配置，增加 `MYSTRA_AGENTOS_GUEST_CLI_DIR`（默认 `dist/agentos`）的只读挂载至 `/opt/mystra-agent-cli`，移除旧的 `GUEST_BIN_DIRECTORY` 挂载。
  - *验收与证据*：挂载 `readOnly: true`，guest 路径为 `/opt/mystra-agent-cli`。
- [x] T006 [Runner] 改造 `agentos-runner.mjs` 中的 `vm.sessions.open`，注入 Session 环境变量：
  - `MYSTRA_AGENT_PATH: '/opt/mystra-agent-cli/mystra-agent.cjs'`
  - `MYSTRA_CONTROL_PLANE_URL: 'http://127.0.0.1:<port>'`
  - `MYSTRA_EXECUTION_CODE`
  - `MYSTRA_WORKSPACE_ROOT: '/home/agentos/workspace'`
  - *验收与证据*：代码中注入字段完整，无多余未授权环境变量。
- [ ] T007 [Runner] 新增真实直连能力预检函数 `assertGuestWorkloadDirectCapability`，通过 `vm.process.exec('"$MYSTRA_AGENT_PATH" whoami', { env: {...}, timeoutMs: 30000 })` 探测。
  - *验收与证据*：探测失败（非零退出码或超时）立即抛错失败关闭，阻止模型凭据写入。
- [x] T008 [Runner] 审查并更新 `apps/runner-daemon/src/session/pi-agentos-shim.mjs`，确保参数完整透传至 `runPiInAgentOs`。
  - *验收与证据*：shim 提取并传递字段无误。

## Phase 3: 废弃代码清理与测试 (Cleanup & Unit Testing)

- [x] T009 [Cleanup] 彻底删除 `apps/runner-daemon/src/session/mystra-binding.mjs`。
  - *验收与证据*：文件不存在，无遗留引用。
- [x] T010 [Cleanup] 彻底删除 `apps/runner-daemon/src/session/mystra-binding.test.ts`。
  - *验收与证据*：文件不存在。
- [x] T011 [Cleanup] 彻底删除 `apps/runner-daemon/src/session/guest-bin/` 目录。
  - *验收与证据*：目录不存在。
- [x] T012 [Cleanup] 清理 `MYSTRA_AGENTOS_GUEST_BIN` 环境变量配置及相关废弃逻辑，引入 `MYSTRA_AGENTOS_GUEST_CLI_DIR`。
  - *验收与证据*：代码全局 grep 无旧变量引用。
- [x] T013 [Test] 编写或更新 Runner 单元测试，覆盖 loopback 豁免、网络规则生成、挂载参数及环境变量构建逻辑。
  - *验收与证据*：测试套件运行通过。

## Phase 4: 文档同步 (Documentation)

- [x] T014 [Doc] 更新 `apps/runner-daemon/README.md`，记录 `build:agentos-cli` 构建步骤、`MYSTRA_AGENTOS_GUEST_CLI_DIR` 配置、`127.0.0.1` 直连与 `loopbackExemptPorts` 原理。
  - *验收与证据*：README 文档清晰准确。
- [x] T015 [Doc] 更新根目录 `PLATFORM.md`，刷新 AgentOS Runtime 架构说明与安全边界。
  - *验收与证据*：PLATFORM.md 内容同步。

## Phase 5: host-c1 生产端到端验收 (Deployment & Verification)

- [x] T016 [Deploy] 在 host-c1 构建 CLI bundle 并部署更新后的 Runner 守护进程。
  - *验收与证据*：Runner 正常启动并成功注册 `type: 'agentos'` Runtime。
- [ ] T017 [E2E-Round1] 发起真实 Task，验证沙箱内 Agent 真实调用 `"$MYSTRA_AGENT_PATH" context get` 读取上下文，并调用 `"$MYSTRA_AGENT_PATH" task status set in_progress`。
  - *验收与证据*：控制面 Task 状态成功变为 `in_progress`，`statusRevision` 发生递增，上下文根目录脱敏为 `/home/agentos/workspace`。
- [ ] T018 [E2E-Round2] 主动销毁沙箱 VM，发起 Session 续接（mode=`continue`），验证 Agent 在全新 VM 中再次调用 `"$MYSTRA_AGENT_PATH" task status set blocked --note "..."` 成功。
  - *验收与证据*：控制面 Task 状态变为 `blocked`，`statusRevision` 再次单调递增，备注成功持久化。
- [ ] T019 [E2E-Negative] 执行负向安全矩阵测试：
  - (a) 网络规则存在但缺少 `loopbackExemptPorts`，验证预检拦截（返回 `control_plane_unavailable`）并失败关闭；
  - (b) 非法 `MYSTRA_EXECUTION_CODE`，验证返回 `capability_expired`；
  - (c) 访问外部 LAN/公网，验证连接被拒。
  - *验收与证据*：全部符合预期，无任何 `models.json` 残留。

## Phase 6: Runtime 指令解耦与提示词重构 (Prompt Decoupling & Re-acceptance)

- [ ] T020 [Runner] 在 `apps/runner-daemon/src/runtime-instructions.ts` 中实现 Runtime 工作负载指令声明模块，针对 Host 声明 `"$MYSTRA_AGENT_PATH" <args>`，针对 AgentOS 声明 `node "$MYSTRA_AGENT_PATH" <args>`。
  - *验收与证据*：单元测试覆盖两个 Runtime 类型的指令导出，无语法错误。
- [ ] T021 [Contract] 更新 Runner 注册契约与控制面模型映射，使 Runtime 注册与心跳载荷支持携带 `workloadInstructions` 并持久化到数据库。
  - *验收与证据*：Prisma/Rdb 映射测试通过，心跳不丢弃指令字段。
- [ ] T022 [ControlPlane] 在 `apps/control-plane/src/session/system-prompt-assembler.ts` 中新增 `runtime_workload` 组件，插入在 `runtime` 之后、`provider` 之前。
  - *验收与证据*：快照测试证明组装后的系统提示词严格包含对应 Runtime 的指令片段。
- [ ] T023 [Prompt] 重构 `packages/shared/src/prompts/standard-execution-prompt.ts`，彻底剥离所有具体 CLI 命令语法（如 `mystra-agent task status ...`），改为仅声明“做什么（WHAT to do）”的职责要求。
  - *验收与证据*：Standard Prompt 中不存在任何 `$MYSTRA_` 或具体命令字符串，测试通过。
- [ ] T024 [Workflow] 重构 `packages/shared/src/workflow/fixed-workflow-definition.ts`，将工作流提示词中的硬编码 CLI 命令迁移为命令无关的纯义务声明（Command-free obligations）。
  - *验收与证据*：Workflow 提示词不再指导具体的 CLI flag，义务约束依然完整。
- [ ] T025 [Test] 更新受影响的提示词组装单测、快照测试与 CLI 调用校验测试。
  - *验收与证据*：`pnpm test` 相关受影响测试套件全部 pass。
- [ ] T026 [E2E-Reacceptance] 在 host-c1 上重新运行真实双轮 Task 验收，验证 AgentOS 沙箱 Agent 按照新的 `runtime_workload` 指导调用 `node "$MYSTRA_AGENT_PATH" <args>` 完成上下文读取与状态变更。
  - *验收与证据*：Agent 成功使用 node 前缀分派 CLI，Task 状态与 revision 真实变更，两套 Runtime 的提示词片段作为正式验收比对基准归档。

---

## 依赖与并发边界

- **并发边界**：
  - Phase 1（Spec/Plan）冻结后方可开始 Phase 2 与 Phase 3。
  - Phase 2（核心实现与打包）与 Phase 3（清理）由 Runner 维护者同一分支串行实施，避免文件冲突。
  - Phase 4（文档）可在 Phase 2 完成后并行进行。
  - Phase 5（host-c1 初始验收）依赖 Phase 2、3、4 合并与部署。
  - Phase 6（提示词解耦与二次验收）依赖 Phase 2、3 运行时就绪，解耦完成后在 host-c1 上执行 T026 最终验收。
