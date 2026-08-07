---
description: "Task list for 044 host runtime daemon"
---

# Tasks: Host Runtime 纳管（mystra-runner 注册 + Provider 发现 + 心跳）

**Input**: `specs/044-host-runtime-daemon/` 的 plan.md、spec.md、research.md、data-model.md、contracts/、quickstart.md
**Prerequisites**: plan.md（已完成）、spec.md（3 个 P1 user story）、data-model.md、contracts/runtime-contracts.md

**Tests**: 本 feature 引入 Runtime 持久化与 runner↔control-plane 契约，属高一致性风险面，因此**包含契约/单元测试任务**（与 spec 契约测试要点、SC 对齐）。

**Organization**: 任务按 user story 分组，各 story 可独立实现与验证。全部为 P1，但存在自然依赖顺序 US1 → US2 → US3（注册记录先于 Provider 集合，Provider 集合先于其变更上报）。

## Format: `[ID] [P?] [Story] 描述`

- **[P]**: 可并行（不同文件、无相互依赖）
- **[Story]**: US1 / US2 / US3；`FND`=Foundational；`SET`=Setup；`POL`=Polish
- 每条含确切文件路径

## Path Conventions

沿用现有 monorepo 三层：`packages/shared/src/`（契约）→ `apps/control-plane/`（持久化/路由/Web）→ `apps/runner-daemon/src/`（CLI daemon）。不新建包。

---

## Phase 1: Setup（共享基建）

**Purpose**: 确认工作面、锁定 Provider 键来源，不改动业务行为。

- [ ] T001 [SET] 确认 044 依赖前置：`apps/runner-daemon` 现有 `register()`/心跳骨架打的是被 040 删除的 `/api/runner/register`（现 404）；在 `specs/044-host-runtime-daemon/plan.md` 顶部或 quickstart 记录"需重建 `/api/runner/*` 摄取路由"这一事实基线，供实现者对齐。
- [ ] T002 [P] [SET] 从 `apps/runner-daemon/src/agent-adapters.ts` 抽出本 feature host 发现所需的**受支持 Provider 键名单**（如 `codex`/`copilot`/`claude`/`qwen`/`cursor-agent` 等），集中为一个可复用常量（如 `apps/runner-daemon/src/provider-keys.ts` 或复用现有导出），供 `provider-discovery.ts` 与契约枚举引用。仅整理来源，不改发现逻辑。

---

## Phase 2: Foundational（阻塞所有 story 的核心基建）

**⚠️ CRITICAL**: 本阶段完成前，任何 user story 实现都不能开始。核心是**共享契约 + Prisma 模型 + RdbProvider 方法签名**，三者被三个 story 共同依赖。

### 共享 Zod 契约（`packages/shared/src/schemas.ts`）

- [ ] T003 [FND] 新增 `providerCapabilitySchema`（字段：`provider` 键、`discovered`、`available`、`version?`、`resolvedPath?`、`source: 'path'|'login-shell'|'env-override'`、`unavailableReason?`），并实现四条不变量校验（`available⇒discovered`、`未发现⇒resolvedPath=null`、`不可用⇒有 unavailableReason`、override 缺失语义），见 contracts §1。
- [ ] T004 [FND] 新增 `hostRuntimeRegistrationSchema`（含 `runnerId`、`type:'host'`、显示名 `name`、`platform`、`providers: providerCapabilitySchema[]`）、`hostHeartbeatSchema`（**仅 `runnerId`·纯存活·不含 Provider 集合**）、`hostProviderReportSchema`（`{runnerId, providers}`·独立变更上报），见 contracts §2/§3/§3b。执行相关字段（`maxConcurrency`/`eligibleRuntimeProviders`）**不复用**。
- [ ] T005 [FND] 新增 `runtimeViewSchema`（control-plane→读取方：`id`、`name`、`type`、`metadata:{runnerId,platform?}`、派生 `status`、`lastSeenAt`（取自内存·可空·非持久）、`providers: providerCapabilitySchema[]`、`createdAt`、`updatedAt`），见 contracts §4。
- [ ] T006 [FND] 按 pre-0.1 政策**直接替换/移除**过时的 `runnerRegistrationSchema`（docker/执行语义，约 schemas.ts:571）在本 feature 范围的引用点，不留兼容别名（见 contracts "迁移"）。仅处理会因新契约产生冲突的调用点；执行语义的历史消费方若超出本 feature，标注 TODO 交由执行 spec。

### Prisma 持久化模型（无 status 列）

- [ ] T007 [FND] 在 `apps/control-plane/prisma/sqlite/schema.prisma` 新增 **`model Runtime`**（type-agnostic）：`id String @id`、`name`、`type`、`metadata String? @map("metadata")`（JSON 文本·host 形态 `{runnerId,platform?}`·**无 lastHeartbeatAt**）、`createdAt`/`updatedAt`；`@@index([updatedAt,id])`/`@@index([createdAt,id])`；`@@map("runtimes")`。**无 `status` 列、无 host 专属列、无 `@unique` runner 列**（去重靠 provider 内按 `metadata.runnerId` 幂等 upsert）。并新增 **`model RuntimeProvider`**（关联边）：`id`、`runtimeId @map("runtime_id")`、`provider`、`discovered`、`available`、`source`、`resolvedPath?`、`version?`、`unavailableReason?`、`@@unique([runtimeId, provider])`、`@@map("runtime_providers")`。见 data-model.md。
- [ ] T008 [FND] 在 `apps/control-plane/prisma/postgresql/schema.prisma` 并行新增等价 `model Runtime` + `model RuntimeProvider`（保持双 provider schema 同步）。
- [ ] T009 [FND] 生成/落地 SQLite migration（按仓库现有 Prisma 迁移方式），确保 `runtimes` 表可建；PostgreSQL 侧生成对应 migration。**pre-0.1 允许破坏式重建本地库**，不写兼容迁移。

### RdbProvider 契约与实现

- [ ] T010 [FND] 在 `apps/control-plane/src/lib/db/rdb-provider.contract.ts` 增加方法签名：`registerHostRuntime(input)`、`getRuntime(id)`、`listRuntimes()`（**纯读**）、`renameRuntime(id,name)`、`reportHostProviders(runnerId,providers)`。**无 `recordHostHeartbeat`（心跳不入 RdbProvider）、无 `deleteRuntime`**。契约保持 dialect-neutral（不泄漏 Prisma 类型/SQL；`metadata` 暴露为已解析强类型对象）。
- [ ] T011 [FND] 在 `apps/control-plane/src/lib/db/prisma-provider.ts` 实现上述方法：`registerHostRuntime` 按 `metadata.runnerId` **幂等 upsert** `type=host` Runtime（写 `metadata={runnerId,platform}`）并用 `input.providers` **覆盖** `runtime_providers` 边集合；`reportHostProviders` 按 `metadata.runnerId` 定位并覆盖边集合；`listRuntimes`/`getRuntime` **不回写任何状态**；`metadata` JSON string ⇆ 结构转换。**无心跳写路径**。
- [ ] T012 [FND] 新增 `apps/control-plane/src/lib/runtime/host-liveness.ts`：**内存** `HostLivenessRegistry`（`markSeen(runnerId, at)` / `getLastSeen(runnerId)`·进程级·非持久·可替换 seam）+ 服务层 `resolveRuntimeStatus(lastSeenAt, now, staleAfter)`（contracts §6）：`null⇒offline`；`now - lastSeenAt > staleAfter ⇒ offline` 否则 online。`lastSeenAt` 取自 registry；默认 `staleAfter` 采用 multica 参考值（~3min），常量集中可调。**不**将存活写入持久层。

**Checkpoint**: 契约、模型、持久化方法就绪——三个 user story 可开始。

---

## Phase 3: User Story 1 - 注册一台机器为 host Runtime (Priority: P1) 🎯 MVP

**Goal**: 配好 endpoint 直启 `mystra-runner`，机器作为 host Runtime 出现在管理面，可查看/重命名；重复启动按 runner id 去重。

**Independent Test**: 以 `--endpoint <url>` 启动 runner → 管理面出现该 Runtime → 可查看/重命名 → 重复启动不新建（SC-001、FR-001~006）。

### Tests for US1 ⚠️（先写、先失败）

- [ ] T013 [P] [US1] 契约测试：`hostRuntimeRegistrationSchema` 解析/拒绝；注册 upsert 幂等——同 `runnerId` 两次返回同一 `runtimeId`（按 `metadata.runnerId` 去重·无 DB 唯一列；contracts 测试要点）。放于 control-plane 或 shared 的测试目录（依现有测试布局）。
- [ ] T014 [P] [US1] 读路径测试：`GET /api/runtimes` 与 `listRuntimes()` **不产生写**（无状态回写副作用）（SC 对齐、contracts §5/§6）。

### Implementation for US1

- [ ] T015 [US1] 重建摄取路由 `apps/control-plane/app/api/runner/register/route.ts`：校验 `hostRuntimeRegistrationSchema` → `registerHostRuntime` → `HostLivenessRegistry.markSeen(runnerId, serverNow)` → 返回 `runtimeId`。**MVP 无认证**（FR-023 已知风险，代码注释标注）。
- [ ] T016 [P] [US1] 管理读 API `apps/control-plane/app/api/runtimes/route.ts`：`listRuntimes()` → 每条用 `resolveRuntimeStatus` 现算 status → 返回 `runtimeViewSchema[]`（纯读）。
- [ ] T017 [P] [US1] 管理 API `apps/control-plane/app/api/runtimes/[id]/route.ts`：`GET` 详情、`PATCH` 重命名（`renameRuntime`）。**无 `DELETE`**（非目标）。
- [ ] T018 [US1] 改造 `apps/runner-daemon/src/index.ts` 的 `register()`：改打新的 `/api/runner/register`；**endpoint 直启**（无 pairing/校验，FR-001）；endpoint 不可达时**重试并保持存活**（FR-006）。
- [ ] T019 [US1] 新增 `apps/runner-daemon/src/registration.ts`（或从 index 抽出）：生成/读取本地稳定 **runner id**（首启生成 UUID 落 `~/.mystra/runner-id`，FR-003），构建 host Runtime 注册 payload。
- [ ] T020 [US1] 重新激活 `apps/control-plane/app/runners/page.tsx` 为 **Runtimes 列表 + 详情视图**：显示 id/`metadata.runnerId`/`name`/`type`/status/可用 Provider（`providers` 边）；提供重命名入口；对齐 `mockups/index.html`（无"移除"）。

**Checkpoint**: US1 独立可用——注册、去重、列表、查看、重命名闭环。

---

## Phase 4: User Story 2 - 自动发现 Provider 并确认可用 (Priority: P1)

**Goal**: runner 自动扫描 PATH 上受支持 CLI，做可用性确认（发现≠可用），把**可用 Provider 集合**作为能力上报；运行期周期重扫。

**Independent Test**: 只装部分 CLI 的机器上启动 → 可用集合恰为实际可解析且确认可用者；运行期新装 CLI，不重启一段时间后出现（SC-002、SC-003、FR-010~016）。

### Tests for US2 ⚠️

- [ ] T021 [P] [US2] `providerCapabilitySchema` 四不变量单测（available⇒discovered、未发现⇒path=null、不可用⇒有原因、override 缺失硬缺失）。
- [ ] T022 [P] [US2] `provider-discovery.ts` 单测：PATH 命中/未命中、`MYSTRA_<PROVIDER>_PATH` 覆盖命中、覆盖路径不存在=硬缺失不回退（FR-015、AC5）；发现与可用性确认结果分别落 `discovered`/`available`。

### Implementation for US2

- [ ] T023 [US2] 新增 `apps/runner-daemon/src/provider-discovery.ts` — **PATH 发现**：对受支持 Provider 键（T002）做 `which`/PATH 解析（Node 无 `exec.LookPath`，自实现），命中记 `source:'path'`（FR-011）。
- [ ] T024 [US2] `provider-discovery.ts` — **可用性确认**：对命中者跑轻量 `--version`/probe，仅确认可用者计入可用集合，不可用记 `unavailableReason`；`discovered` 与 `available` 分开（FR-012、AC2）。
- [ ] T025 [US2] `provider-discovery.ts` — **登录 shell 兜底**（照搬 multica，TS 移植，research §4/plan 决策 #3）：仅在 bare 名未命中时 `execFile(process.env.SHELL,['-ilc',script],{timeout})`；shell 允许表 `{bash,zsh,sh,dash,ksh}`；脚本 `unalias`+`unset -f`→`command -v`→绝对路径→`cd "$d" && pwd -P`；返回后二次"绝对+可执行"复核；记 `source:'login-shell'`（FR-014、AC4）。超时 ~3s + 强杀宽限。
- [ ] T026 [US2] `provider-discovery.ts` — **解析缓存**：进程级、key=`PATH+SHELL+HOME` 指纹、TTL ~30min（空结果也缓存），env 指纹变即失效；避免每轮发现都 fork 登录 shell（research §4 理由）。
- [ ] T027 [US2] `provider-discovery.ts` — **环境覆盖**：`MYSTRA_<PROVIDER>_PATH` 命中即用、含路径分隔符则**绕过** shell 兜底；显式路径不存在=硬缺失记 `source:'env-override'` + `unavailableReason:'override-path-missing'`（FR-015、AC5）。
- [ ] T028 [US2] `provider-discovery.ts` — **周期重扫**：与心跳解耦的独立 interval 重扫+重确认，使运行期新装/状态变化的 Provider 无需重启即反映（FR-013、AC3、SC-003）。
- [ ] T029 [US2] 接线：`registration.ts`/`index.ts` 注册 payload 使用 `provider-discovery` 产出的**可用 Provider 集合**（FR-010，来源无关表达）；空集合允许注册并标记"无可用 Provider"（Edge Case）。

**Checkpoint**: US2 独立可用——发现、确认、覆盖、兜底、重扫闭环，能力随注册上报。

---

## Phase 5: User Story 3 - 心跳与在线状态 (Priority: P1)

**Goal**: runner 周期发**存活心跳**；注册时与集合变化时上报 Provider 集合；管理面据服务端接收时间显示 online/offline 与最新 Provider。

**Independent Test**: 启动→online；停止超阈值→offline；运行期集合变化经变更上报反映到管理面（SC-004、FR-020~023）。

### Tests for US3 ⚠️

- [ ] T030 [P] [US3] `resolveRuntimeStatus` 边界单测：`null`（含进程重启后 last-seen 清空）、恰好等于阈值、超过阈值（contracts 测试要点、SC-004、AC5）。
- [ ] T031 [P] [US3] 心跳/上报契约测试：存活心跳**不带 Provider**、**心跳产生 0 次 DB 写**（仅内存 `markSeen`）、判活用服务端时间、客户端伪造时间被忽略；Provider 变更上报**覆盖**既有 `runtime_providers` 边集合（contracts 测试要点、AC1/AC3）。

### Implementation for US3

- [ ] T032 [US3] 摄取路由 `apps/control-plane/app/api/runner/heartbeat/route.ts`：校验 `hostHeartbeatSchema`（仅 `runnerId`）→ `HostLivenessRegistry.markSeen(runnerId, serverNow)`；**0 次 DB 写**；未知 `runnerId` 返回 404 触发 runner 重注册；忽略客户端声明时间（FR-020/021、AC1、Edge：时钟漂移）。
- [ ] T033 [US3] 摄取路由 `apps/control-plane/app/api/runner/providers/route.ts`：校验 `hostProviderReportSchema` → `reportHostProviders(runnerId, providers)` 覆盖 `runtime_providers` 边集合（变更上报，与心跳解耦；FR-022、AC3）。*（若最终选择复用注册 upsert 承载变更上报，则改为在此记录决策并让 runner 走 register upsert；二选一，见 plan 决策 #5。）*
- [ ] T034 [US3] 改造 `apps/runner-daemon/src/index.ts` 心跳循环：周期发**存活心跳**（仅带 `runnerId`，不带 Provider）；集合变化时才调 providers 上报；注册时带一次（FR-020/022）。心跳间隔采用 multica 参考值（~15s），常量可调。
- [ ] T035 [US3] 读取视图接入派生 status：`GET /api/runtimes` 与详情用 `HostLivenessRegistry.getLastSeen(metadata.runnerId)` + `resolveRuntimeStatus` 现算 online/offline（不回写列，FR-002/021）；`runners/page.tsx` 展示 online/offline 徽标与最新可用 Provider（AC2、SC-004）。
- [ ] T036 [US3] 状态语义防呆：确保 `resolveRuntimeStatus` 与视图**不**把内存 last-seen 硬编码为所有 Runtime 类型判活的唯一前提（为 042 image/云 Provider 预留），以注释/结构表达；`HostLivenessRegistry` 作为可替换 seam（未来 sticky routing / 共享 TTL lease，见 data-model HA 说明）（FR-021、AC4）。

**Checkpoint**: 三个 story 均独立可用。

---

## Phase 6: Polish & Cross-Cutting

- [ ] T037 [P] [POL] 按 `specs/044-host-runtime-daemon/quickstart.md` 走查 operator + dev 验证表，逐条对齐 FR/SC；发现偏差回填 tasks 或修实现。
- [ ] T038 [P] [POL] 复核 `research.md`/`plan.md` 的 multica 参考默认值（心跳 15s、offline ~3min、TTL 30min、超时 3s+2s、shell 允许表）已作为**集中常量**落在代码中且可调；无散落魔法数。
- [ ] T039 [POL] 一致性收尾：`git diff --check`；确认无 `deleteRuntime`/无认证摄取的已知风险注释齐备（FR-023）；确认 runner 仅 TypeScript、无 Go 并行实现（FR-031、SC-006）。

---

## Dependencies & Execution Order

### Phase 依赖

- **Setup (P1)**：可立即开始。
- **Foundational (P2)**：依赖 Setup；**阻塞所有 user story**。契约(T003-T006)→模型(T007-T009)→RdbProvider(T010-T012)内部大体顺序，但契约与模型可并行推进。
- **User Stories (P3-P5)**：均依赖 Foundational。虽同为 P1，推荐按 US1→US2→US3 顺序（US2 的能力集合喂给 US1 注册 payload 更完整；US3 的变更上报建立在 US2 集合之上）。若人力充足，US2 的 `provider-discovery.ts` 可与 US1 的路由/Web 并行。
- **Polish (P6)**：依赖目标 story 完成。

### Story 内顺序

- 测试（本 feature 要求）先写、先失败。
- 契约/模型 → 服务/持久化 → 路由 → runner → Web。

### 并行机会

- T002 与 T001 可并行；T003/T004/T005 之间大体可并行（同文件注意合并）；T007 与 T008 并行；US1 的 T016/T017 与 US2 的 `provider-discovery` 子任务跨文件可并行；各 story 的 `[P]` 测试可并行。

---

## Implementation Strategy

### MVP First（US1）

1. Setup → 2. Foundational（关键，阻塞）→ 3. US1 → **停下独立验证**：注册/去重/列表/重命名 → demo。

### 增量交付

Foundational 就绪后：US1（纳管闭环，MVP）→ US2（真实可用 Provider 能力）→ US3（online/offline + 变更上报）。每个 story 独立加值、不破坏前者。

---

## 映射校验（Traceability）

- US1 ⇄ FR-001~006, SC-001；US2 ⇄ FR-010~016, SC-002/003/005；US3 ⇄ FR-020~023, SC-004。
- 契约/实现边界 FR-030~034（TS-only、来源无关、分离概念、无执行/授权、SecretProvider 兼容）贯穿 Foundational 与 Polish（T003-T006、T039）。
- 契约测试要点 ⇄ T013/T014/T021/T022/T030/T031。
