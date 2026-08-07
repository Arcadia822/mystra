# Implementation Plan: Host Runtime 注册、Provider 发现与心跳

**Branch**: `044-host-runtime-daemon`（逻辑 feature id；本次未创建/切换分支，在 `main` in-place）
**Date**: 2026-08-07 | **Spec**: [`spec.md`](./spec.md)
**Input**: `specs/044-host-runtime-daemon/spec.md`

## Summary

把一台已装 agent CLI 的机器，通过启动 TypeScript 版 `mystra-runner`（配 endpoint 直启、无 pairing）
纳管为 **host Runtime**；runner 自动扫描 PATH 发现受支持的 **Provider（agent CLI）**、确认其可用性，
并周期性回报心跳与可用 Provider 集合；control-plane 依服务端接收时间判定 online/offline，并提供
Runtime 列表/详情/重命名/移除的管理面。**本 feature 只交付 Runtime + Provider 两块**，不含发起任务、
Context/worktree、Agent 配置、执行/Session。

技术路径：复用现有 `apps/runner-daemon`（TS，已有 register/heartbeat/poll 骨架，但其 `/api/runner/*`
路由已被 040 删除），把其注册契约从 "docker executor + container agent 主目录" 改造为 "host executor +
PATH 发现的可用 Provider 集合"；在 `packages/shared` 新增/改造 Runtime 与心跳的 Zod 契约；在
control-plane 新增 `Runtime` Prisma 模型（sqlite + postgresql 双 schema，经 `RdbProvider`）、`/api/runtimes`
管理路由与 `/api/runner/{register,heartbeat}` 摄取路由；重新激活 `app/runners`（更名/展示为 Runtimes）页。

## Technical Context

**Language/Version**: TypeScript 5.9，Node.js 24.14.0，pnpm 10.25.0
**Primary Dependencies**: Next.js 16 Route Handlers、React 19、Zod 4、Prisma 7.9.1（`@prisma/adapter-better-sqlite3` / `@prisma/adapter-pg`）、Node `child_process`（PATH 发现 + 登录 shell 兜底 + 版本 probe）、Vitest 4
**Storage**: SQLite via `RdbProvider`（PostgreSQL / Supabase-backed PostgreSQL 双 schema 并行维护，契约不泄漏方言）
**Testing**: Vitest 4（`packages/shared` 契约单测、`apps/runner-daemon` 发现/注册单测、`apps/control-plane` `RdbProvider` 契约测试 + 路由测试）
**Target Platform**: control-plane = Node 服务；`mystra-runner` = 运行在 operator 机器（darwin/linux 优先，Windows 后置）
**Project Type**: Web service（control-plane）+ CLI daemon（runner）+ 共享包
**Performance Goals**: 非高吞吐；心跳与发现为低频周期任务（秒级/十秒级）。目标是"启动后数秒内出现在管理面并显示 online"
**Constraints**: runner 纯 outbound；online/offline 依**服务端接收时间**；发现≠可用两态分离；Provider 能力表达**来源无关**；无 pairing/无秘密材料
**Scale/Scope**: 自用单节点，个位数~数十台 Runtime；每台受支持 Provider ~≤20 个

## Constitution Check

*GATE：Phase 0 前必须通过；Phase 1 设计后复核。基于已修订的 constitution v2.8.0。*

| 原则 | 判定 | 说明 |
| --- | --- | --- |
| I. MVP 边界先修订后扩张 | ✅ 已满足 | constitution v2.8.0 + AGENTS.md/PLATFORM.md 已把 host Runtime 纳管 + Runtime 持久化纳入 MVP；本 plan 不再越界。 |
| II. 契约用 TS+Zod，身份分离 | ✅ 遵守 | Runtime/注册/心跳/Provider 能力全部 Zod；Runtime 身份与 Task、未来 Session/Agent 保持分离。 |
| III. Provider 是可替换边界 | ✅ 遵守 | 新增 host RuntimeProvider 语义；Provider 能力来源无关，为 image/云预留；不引入 WorkflowProvider。 |
| IV. Runner 隔离与秘密卫生 | ✅ 遵守 | runner outbound；本 feature 不引入接入秘密；不烘焙凭证；Docker-socket 条款不涉及（host 发现不碰容器）。 |
| 持久化边界（2026-08-07 note） | ✅ 对齐 | 只加 Runtime + 可用 Provider 持久化；Session/Context/Agent 仍延期，不触碰其持久化。 |
| RdbProvider 不泄漏方言 | ✅ 遵守 | Runtime 经 `RdbProvider` 方法访问；sqlite/postgresql schema 并行；契约层无 Prisma 类型/连接串。 |

**结论**：无违规，无需 Complexity Tracking 条目。

## Project Structure

### Documentation (this feature)

```text
specs/044-host-runtime-daemon/
├── spec.md              # 已完成（收窄版）
├── research.md          # 已完成（multica 源码级研究 + 范围提示）
├── plan.md              # 本文件
├── data-model.md        # Phase 1：Runtime + Provider 能力实体、Prisma、RdbProvider 方法、状态机
├── quickstart.md        # Phase 1：operator/dev 走查
├── prototype.md         # 已完成（UI 原型入口）
├── mockups/index.html   # 已完成（静态原型）
├── contracts/           # Phase 1：Zod 契约（注册/心跳/Provider 能力/管理 API）
└── tasks.md             # /speckit.tasks 产出（本 plan 不创建）
```

### Source Code（涉及的真实目录）

```text
packages/shared/src/
  schemas.ts                     # 新增/改造：runtimeRegistration / runtimeHeartbeat / providerCapability / runtime view 契约
                                 #   复用并调整既有 runnerRegistrationSchema / platformCapabilitiesSchema
apps/runner-daemon/src/
  index.ts                       # 改造 register()/心跳循环：host executor；存活心跳 + 变更上报解耦；endpoint 直启、重试；本地 runner id 持久化
  provider-discovery.ts          # 新增：PATH 扫描 + 登录 shell 兜底 + MYSTRA_<PROVIDER>_PATH 覆盖 + 可用性确认 + 周期重扫
  registration.ts                # 改造：构建 host Runtime 注册 payload（可用 Provider 集合）
  agent-adapters.ts              # 参考现有受支持 Provider 名单（codex/copilot…），抽出 host 发现所需的 provider 键
apps/control-plane/
  prisma/sqlite/schema.prisma        # 新增 model Runtime(metadata 动态列·无 status/无 host 专属列) + model RuntimeProvider(关联边)
  prisma/postgresql/schema.prisma    # 并行维护等价双 model
  src/lib/db/rdb-provider.contract.ts# 新增 registerHostRuntime/getRuntime/listRuntimes/renameRuntime/reportHostProviders 契约 + 测试（无心跳写方法）
  src/lib/db/prisma-provider.ts      # 实现新方法（metadata JSON ⇆ 结构·upsert runtime_providers 边）
  src/lib/runtime/host-liveness.ts   # 新增：HostLivenessRegistry(进程内存·markSeen/getLastSeen·非持久) + resolveRuntimeStatus
  app/api/runtimes/route.ts          # 新增：列表（纯读·派生 status）
  app/api/runtimes/[id]/route.ts     # 新增：详情/重命名（无 DELETE）
  app/api/runner/register/route.ts   # 新增（重建）：runner 注册摄取 → registerHostRuntime + markSeen
  app/api/runner/heartbeat/route.ts  # 新增：存活心跳摄取 → HostLivenessRegistry.markSeen(runnerId, serverNow)·不落库
  app/api/runner/providers/route.ts  # 新增：Provider 集合变更上报 → reportHostProviders(覆盖边集合)
  app/runners/page.tsx               # 重新激活为 Runtimes 列表；新增详情视图
```

**Structure Decision**：沿用现有 monorepo 三层（`packages/shared` 契约 → `apps/control-plane` 服务/持久化/Web → `apps/runner-daemon` CLI daemon）。不新建包。host 发现逻辑独立成 `provider-discovery.ts` 便于单测与未来 image 来源替换。

## 关键设计决策（供 plan-eng-review）

1. **Runtime 记录形态**：稳定模型 = **Runtime ↔ Provider 关联边**。`runtimes` 表 type-agnostic（`id/name/type/
   metadata/createdAt/updatedAt`），host 提交 bookkeeping 收进动态 `metadata`（`{runnerId, platform?}`，runner 首启
   生成 UUID 落 `~/.mystra/runner-id`）；可用 Provider 落 `runtime_providers` 关联边表（每边含 provider 键 + 可用性
   状态 + 版本 + 解析路径 + 不可用原因·`@@unique(runtimeId, provider)`），**不用** Runtime 上的扁平
   `availableProviders` JSON。`status` 与存活 last-seen **均不落库**（读时派生 / 进程内存）。
2. **发现 vs 可用两态**：`provider-discovery.ts` 先 `which`/PATH 解析（发现），再对命中者跑轻量
   `--version`/probe（可用性确认）；两者分别落在能力项的 `discovered` 与 `available` 字段。
3. **登录 shell 兜底（照搬 multica 机制，TS 移植）**：仅在 bare 命令名直接查找**未命中时**才走兜底——
   `child_process.execFile(process.env.SHELL, ['-ilc', script], { timeout })`，`SHELL` basename 需在允许表
   `{bash,zsh,sh,dash,ksh}`。脚本逐名 `unalias`+`unset -f` → `command -v` → 要求绝对路径 →
   `cd "$dir" && pwd -P` 规范化 → 打印 `name\tpath`；返回后 TS 侧再做一次"绝对路径 + 可执行"复核。
   结果进程级缓存、key=`PATH+SHELL+HOME` 指纹、**TTL ~30min**（远大于发现间隔，空结果也缓存），
   因起登录 shell 有成本、不每次扫描都跑。超时有界（~3s + 强杀宽限）。**Node 无 `exec.LookPath`**：
   自实现 PATH 解析或用 `which` 等价逻辑。
4. **覆盖语义**：`MYSTRA_<PROVIDER>_PATH` 命中即用；显式路径不存在 = 硬缺失，不回退。
5. **周期重扫 + 变更上报**：与心跳解耦的独立 interval 做重扫；集合**变化时**上报（`/api/runner/providers`
   或复用注册 upsert，二选一待定），注册时也带一次；**存活心跳不携带 Provider 集合**。
6. **online/offline（存活不持久）**：存活是易失信号——心跳只刷 control-plane 进程内存 `HostLivenessRegistry`
   的 last-seen（服务端接收时刻·**0 次 DB 写**·不碰 `metadata`/`updatedAt`），读取时按 `now - lastSeen > staleAfter`
   **现算** offline，不回写状态列。**不**持久化心跳（对齐 HDFS/YARN：master 内存判活、只持久稳定身份；亦避免 K8s
   早期把心跳写进 etcd Node 对象的写放大/索引 churn）。**不**把该心跳 last-seen 泛化为所有 Runtime 类型判活前提，
   为 042 image/云 Provider 预留 status 语义位。
   - **HA/SPOF**：内存化不新增单点——存活自愈，即便持久/复制在故障切换后仍须靠新心跳重建，故"持久 vs 内存"对可用性
     无差别；真正的可用性边界是 control-plane 进程数量（MVP 单节点），与存活放哪正交。`HostLivenessRegistry` 是可替换
     seam，未来多实例 HA 换 sticky routing / 共享 TTL 租约实现（归 042/hosted），不动持久化/契约/schema。
7. **无服务端移除（MVP）**：仍在运行的 runner 会在下次注册重新纳管，故不提供单方面 delete；退役语义
   留待后续接入认证/生命周期 feature。
8. **传输**：MVP 纯 HTTP（`POST /api/runner/register`、`/api/runner/heartbeat`，Provider 变更上报），
   无 WS 唤醒。
9. **摄取路由无认证 = 已知风险**：MVP 决策不做校验，spec 非目标已显式标注，留待接入认证 feature。
10. **契约复用**：改造既有 `runnerRegistrationSchema` 而非全新命名；执行相关字段（executor=docker 路径）
   在本 feature 收敛为 host 语义或标注延期。
11. **遗留执行代码清理（架构去污）**：`apps/runner-daemon` 现有全部 claim/执行/docker/sandbox/repo 交付/
   context-bundle 机制均打向 feature 040 已删除的 `/api/runner/sessions*` 路由——即**当前整套 daemon 主流程
   已是死代码**。044 借重建 host 语义之机**直接删除**这些历史模块与测试（见下方清理清单），host 发现/注册/
   心跳新模块从**干净基座**长出，不 import 被删模块、不携带 executor/session 类型。按 pre-0.1 政策不留兼容
   别名、不注释保留；以 grep 门禁与 `build/typecheck/test` 三绿收口（FR-035/036、SC-007）。

### 遗留代码清理清单（teardown manifest）

**删除（模块 + 同名 `.test.ts`）**：`direct-execution`、`preview-probe`、`repo-providers`（含 `repo-providers/` 目录）、
`sandbox-providers`（含 `sandbox-providers/` 目录）、`review-projections`、`runtime-paths`、`git-command-env`、
`container-task.test`。

**删除（`index.ts` 内执行符号）**：`claimAvailableSession`、`emitEvent`、`runCommand`、`dockerTaskScript`、
`repositoryAuthBinding`、`repositoryMetadata`、`repositoryPhaseEnvironment`、`fetchRepositoryCredential`、
`phaseOutputHostPath`/`phaseOutputContainerPath`/`readPhaseOutput`、`executeContainerPhase`、`runtimePorts`、
`materializeContextBundle`、`appendRuntimeMounts`/`appendRuntimePorts`、`pollCancellationRequest`、
`repositoryTarget`、`buildAgentPrompt`、`executeFakeSession`、`executeDockerSession`、`executeSession`
及 `main()` 的 claim/execute 主循环。

**改造（保留概念、重写为 host 语义）**：`registration.ts`（去 `executor`/`docker`/`concurrency`/
`eligibleRuntimeProviders`/`fakeExecutorAgents`）、`index.ts` 的 `readConfig`/`register`/心跳（收敛为 endpoint 直启
+ host 注册 + 发现循环 + 存活心跳 + 变更上报）、`agent-adapters.ts`（从执行 adapter 注册表**收敛为受支持
Provider 键来源**，或直接改由 `@mystra/shared` 的 `agentNameSchema` 供给后删除本文件）。

**保留**：`sentry.ts`（横切可观测性）。

**依赖收尾**：若 `agent-adapters.ts` 被删，评估从 `apps/runner-daemon/package.json` 移除 `@mystra/agent-adapters`
workspace 依赖（执行 adapter 包，发现无需）。

## Phase 0 — Research（已完成）

见 `research.md`：multica 注册/心跳/发现/登录 shell 兜底/覆盖/周期重扫源码级结论 + 与 Mystra 现状差异。
无遗留 NEEDS CLARIFICATION 阻断项；具体数值类问题集中在 spec 的 Deferred Decisions，交由 `/speckit.clarify`。

## Phase 1 — Design（本次产出）

- `data-model.md`：Runtime 实体（type-agnostic + 动态 `metadata`）、RuntimeProvider 关联边、Prisma 双 schema、
  `RdbProvider` 新方法（无心跳写）、内存 `HostLivenessRegistry` 与 status 派生、状态机（unregistered→online→offline）、
  去重键（`metadata.runnerId` 幂等·无 DB 唯一列）、e2b 映射。
- `contracts/`：`runtime-registration.contract.md`、`runtime-heartbeat.contract.md`、
  `provider-capability.contract.md`、`runtime-management-api.contract.md`（Zod 形状 + 路由约定）。
- `quickstart.md`：operator 启动 runner → 管理面出现 → 装/卸 CLI 观察可用 Provider → 停 runner 看 offline。

## Phase 2 — Tasks（由 `/speckit.tasks` 产出，非本 plan）

按用户故事切片：US1 注册+管理、US2 发现+可用性、US3 心跳+状态；每片含 shared 契约 → 持久化 →
路由 → runner → Web → 测试。

## 复核门禁

- 进入 `/speckit.tasks` 前运行 `plan-eng-review`（架构/数据流/边界/测试/性能）。
- 触及执行流/持久化/provider 边界，plan 阶段已用直接代码阅读对齐（runner-daemon、shared、prisma、
  rdb-provider 契约）；如需血缘/影响面再用 GitNexus 补充。

## Complexity Tracking

无违规，无需填写。
