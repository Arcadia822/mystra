---
description: "Task list for 046 Agent definition and management"
---

# Tasks: Agent 定义与管理面

**Input**: `specs/046-agent-definition/` 的 spec、plan、research、data-model、contracts、quickstart 与 engineering review
**Tests**: 本功能改变公共术语、RDB contract、双数据库 schema 和三个可编程入口，所有 story 都要求测试先行。
**Organization**: US1 交付独立 Agent 管理；US2 清晰固定四要素中的 Agent/Provider 边界；US3 交付 revision、归档与 immutable snapshot。

## Format

- `[P]` 表示不同文件且不依赖未完成任务，可并行。
- `[US1]`、`[US2]`、`[US3]` 对应 spec technical scenarios。
- 每个实现任务必须先完成同阶段 RED 测试并观察失败。

## Phase 1: Setup and impact baseline

- [x] T001 [SET] 运行并记录 GitNexus 对既有 `RdbProvider`、`PrismaRdbProvider`、Prisma client wrapper、MCP `POST`、operator CLI `parseArgs/run/usage`、shared Provider schema 与 adapter symbols 的 upstream impact；HIGH/CRITICAL 必须在编辑前报告。
- [x] T002 [SET] 在 `specs/046-agent-definition/quickstart.md` 对照现有 package scripts 校准精确测试、generate、migrate、typecheck 和 build 命令。

## Phase 2: Foundational shared contracts and terminology

**Purpose**: 建立唯一 Agent 语义来源，并让 Provider 键不再伪装成 Agent。

### RED

- [x] T003 [P] [FND] 在 `packages/shared/src/agent.test.ts` 新增 strict Agent create/update/archive/list/response/snapshot schema 测试：拒绝空白、超 32,768、Project/Provider/Runtime/Context/skills/tools/model/teamId 等额外字段。
- [x] T004 [P] [FND] 在 `packages/shared/src/schemas.test.ts` 与 `packages/shared/src/issue.test.ts` 将 `codex|copilot` 断言改为 `ProviderName`/`provider`，先观察旧 `agent` 公共字段测试失败。
- [x] T005 [P] [FND] 在 `packages/agent-adapters/src/index.test.ts` 将 adapter 公共符号断言改为 Provider 命名，先观察旧 AgentAdapter 命名失败。

### GREEN

- [x] T006 [FND] 新增 `packages/shared/src/agent.ts`，实现 Agent 常量、Zod request/record/page/snapshot schemas 与类型；从 `packages/shared/src/index.ts` 导出。
- [x] T007 [FND] 在 `packages/shared/src/schemas.ts` 和 `packages/shared/src/issue.ts` 直接替换 `agentNameSchema`/`AgentName` 与承载 Provider 键的 `agent` 字段为 `providerNameSchema`/`ProviderName`/`provider`，不保留 alias。
- [x] T008 [FND] 在 `packages/agent-adapters/src/index.ts`、相关 runner/shared 调用方与测试中将 Provider adapter 符号和属性直接改为 Provider 命名。
- [x] T009 [FND] 删除无生产调用方的 `apps/control-plane/src/lib/projects/project-defaults.ts`、对应测试和 Project execution-default 残留；将 operator CLI 的旧执行选择 flags 从 `--agent` 改为 `--provider`，移除已不符合 canonical Project contract 的 create 命令，不实现 Session persistence。

**Checkpoint**: Agent 与 Provider 在共享类型层不可混淆；Agent request 只接受名称和 system prompt。

## Phase 3: User Story 1 — Team-scoped Agent CRUD (P1) 🎯 MVP

**Goal**: 授权调用方可以不提供 Project 参数，在 active Team 内创建、列出、读取 Agent。

**Independent Test**: 创建 Agent 后通过 RDB/API/MCP/CLI 读取；返回只有 stable identity、Team、name、systemPrompt、revision 和 lifecycle metadata；另一 Team 看不到。

### RED — persistence

- [x] T010 [P] [US1] 在 `apps/control-plane/src/lib/db/rdb-provider.contract.ts` 增加 create/get/list、Team isolation、稳定分页和重复名称测试，并由 SQLite/PostgreSQL provider suites 共同执行。
- [x] T011 [P] [US1] 在 `apps/control-plane/src/lib/db/prisma-schema-parity.test.ts` 增加 Agent model/table/field/index/relation parity 断言。

### GREEN — persistence

- [x] T012 [P] [US1] 在 `apps/control-plane/prisma/sqlite/schema.prisma` 与 SQLite migration 新增 Team-owned `Agent` model/table/index，无 Project/Task/Session/Runtime/Provider/Context 字段。
- [x] T013 [P] [US1] 在 `apps/control-plane/prisma/postgresql/schema.prisma` 与 PostgreSQL migration 新增等价 Agent model/table/index。
- [x] T014 [US1] 运行 `pnpm db:generate`，更新生成客户端，并在 `apps/control-plane/src/lib/db/prisma-client.ts` 添加受保护 Agent delegate typings/methods。
- [x] T015 [US1] 在 `apps/control-plane/src/lib/db/prisma-mappers.ts` 添加 dialect-neutral Agent row mapper；在 `apps/control-plane/src/lib/db/rdb-provider.ts` 添加 create/get/list 契约。
- [x] T016 [US1] 在 `apps/control-plane/src/lib/db/prisma-provider.ts` 实现 Team-filtered create/get/list 与稳定 limit/cursor 分页；更新 SQLite adoption/current-schema 检查中受 Agent 表影响的最小表清单。

### RED/GREEN — canonical HTTP API

- [x] T017 [P] [US1] 在 `apps/control-plane/app/api/routes.test.ts` 先写 create/list/get 的 auth、active Team、permission、strict payload、Team isolation、pagination 与 404 contract 测试。
- [x] T018 [US1] 新增 `apps/control-plane/app/api/agents/route.ts`，实现 GET list 和 POST create；Team ID 只从 active session 派生，读取/管理权限分别使用既有 RBAC。
- [x] T019 [US1] 新增 `apps/control-plane/app/api/agents/[id]/route.ts` 的 GET，并在 `apps/control-plane/src/lib/management-http.ts` / shared management error schema 中加入稳定 Agent 错误映射。

### RED/GREEN — MCP and CLI

- [x] T020 [P] [US1] 在 `apps/control-plane/app/api/mcp/route.test.ts` 先写 `mystra_create_agent`、`mystra_list_agents`、`mystra_get_agent` 的 discovery、validation、Team auth 与 permission 测试。
- [x] T021 [US1] 在 `apps/control-plane/app/api/mcp/route.ts` 接入三个 Agent tools，共用 shared schemas 与 RdbProvider，不复制字段语义。
- [x] T022 [P] [US1] 在 `apps/control-plane/src/lib/operator-cli.test.ts` 先写 `agents create/list/inspect` 的 argv、请求路径、JSON/human output 与 error exit code 测试。
- [x] T023 [US1] 在 `scripts/operator-cli.mjs` 实现 `agents create/list/inspect` thin client；新增 `--system-prompt`、`--include-archived` flags。

**Checkpoint**: 在没有 Session/Context 的环境中，US1 Agent 管理切片可独立工作。

## Phase 4: User Story 2 — Agent/Provider 四要素边界 (P1)

**Goal**: Agent resolver 只贡献 snapshot；Provider 仍是 Runtime 能力键，Agent 与 Project/Task 完全无关。

**Independent Test**: 同一 Agent 可与两个 Provider 组成选择，同一 Provider 可与两个 Agent 组成选择；schema 不复用字段、不推断默认值。

### RED/GREEN

- [x] T024 [P] [US2] 在 `packages/shared/src/agent.test.ts` 新增 `sessionExecutionSelectionSchema`/`resolvedAgentSnapshotSchema` 测试：四要素独立、`projectId?`/`taskId?` 为独立业务引用且不进入 Agent；不创建 Session record schema。
- [x] T025 [US2] 在 `packages/shared/src/agent.ts` 实现仅用于 contract composition 的 strict 四要素 selection 与 optional business references schemas，Provider 字段使用 `providerNameSchema`，Agent 字段使用 UUID `agentId`。
- [x] T026 [P] [US2] 在 `apps/control-plane/src/lib/db/rdb-provider.contract.ts` 增加 `resolveActiveAgent` 的 Team isolation、无 Project 参数、snapshot exact fields 测试。
- [x] T027 [US2] 在 `apps/control-plane/src/lib/db/rdb-provider.ts` 与 `apps/control-plane/src/lib/db/prisma-provider.ts` 实现 active-only `resolveActiveAgent(agentId,{teamId})`，不接受/推断 Runtime、Provider、Context、Project 或 Task。

**Checkpoint**: 046 已提供未来 Session 需要的 Agent-owned resolver seam，但没有伪造 Session lifecycle。

## Phase 5: User Story 3 — Revision, archive, immutable snapshot (P2)

**Goal**: prompt 更新只影响未来解析；rename 不增 revision；并发写冲突可观察；archived Agent 可审查但不可新选。

**Independent Test**: 解析 revision 1 snapshot，更新为 revision 2 后旧值逐字不变；同 revision 两次并发 prompt 更新恰有一次成功；归档后 GET 成功、resolve 失败。

### RED — provider and API

- [x] T028 [P] [US3] 在 `apps/control-plane/src/lib/db/rdb-provider.contract.ts` 增加 rename/prompt revision、same-prompt、stale conflict、并发 update、archive/idempotent read、archived resolve 与 snapshot stability 测试。
- [x] T029 [P] [US3] 在 `apps/control-plane/app/api/routes.test.ts` 增加 PATCH/archive 的 expectedRevision、409 error、rename-only revision、archived GET/list 测试。

### GREEN — provider and API

- [x] T030 [US3] 扩展 `apps/control-plane/src/lib/db/rdb-provider.ts`、`prisma-client.ts` 与 `prisma-errors.ts` 的 update/archive/error contracts。
- [x] T031 [US3] 在 `apps/control-plane/src/lib/db/prisma-provider.ts` 用 transaction + conditional update 实现 update/archive；区分 not found、archived、revision conflict，禁止 lost update。
- [x] T032 [US3] 扩展 `apps/control-plane/app/api/agents/[id]/route.ts` 实现 PATCH；新增 `apps/control-plane/app/api/agents/[id]/archive/route.ts`，返回稳定 404/409/400。

### RED/GREEN — MCP and CLI

- [x] T033 [P] [US3] 在 `apps/control-plane/app/api/mcp/route.test.ts` 增加 update/archive、settings permission、revision conflict 与 archived error tests。
- [x] T034 [US3] 在 `apps/control-plane/app/api/mcp/route.ts` 实现 `mystra_update_agent` / `mystra_archive_agent`。
- [x] T035 [P] [US3] 在 `apps/control-plane/src/lib/operator-cli.test.ts` 增加 `agents update/archive` 的 expected revision、payload、输出与 exit code tests。
- [x] T036 [US3] 在 `scripts/operator-cli.mjs` 实现 `agents update/archive`。

**Checkpoint**: US1–US3 均可独立验证；Agent 管理和 snapshot seam 完整。

## Phase 6: Polish, analysis and closeout

- [x] T037 [P] [POL] 运行 `rg` 术语审计：公共/shared/API/MCP/CLI 中不再用 `agent` 字段承载 `codex|copilot`；Agent schema 不含 Project/Task/Session/Runtime/Provider/Context/skills/tools/model。
- [x] T038 [P] [POL] 运行 targeted tests、双 provider contract、schema parity、`pnpm typecheck`、`pnpm build` 与 `git diff --check`；PostgreSQL 无凭据时明确记录 skip。
- [x] T039 [POL] 运行 GitNexus `detect_changes(scope=compare,base_ref=main)`，审查 unexpected symbols/flows；按 `code-review-and-quality` 完成多轴 review 并修复发现。
- [x] T040 [POL] 按 `specs/046-agent-definition/quickstart.md` 执行可用的真实 SQLite/API/CLI smoke path；不将端口监听冒充 HTTP/内容验证。
- [x] T041 [POL] 刷新 `specs/046-agent-definition/index.html`、`specs/spec-status.md` 与 Spec-Kit/GitNexus 状态，将 046 标为完成并记录实际验证证据。

## Dependencies and execution order

- Setup → Foundational → US1 persistence/API → US2 resolver boundary → US3 mutations/lifecycle → Polish。
- T003–T005 是 RED；T006–T009 前不得把对应测试改回绿色预期。
- T010/T011 必须先失败；T012–T016 才可实现持久化。
- T017/T020/T022 必须分别先失败；随后才实现 HTTP/MCP/CLI。
- US2 依赖 Agent schema 与 persistence，但不依赖 Session。
- US3 依赖 US1 create/get 与 US2 resolver。

## Traceability

- US1 / FR-001~009, FR-020~023 / SC-001, SC-007 → T003, T006, T010~T023。
- US2 / FR-010~019, FR-024 / SC-002, SC-003, SC-006 → T004~T009, T024~T027, T037。
- US3 / FR-007~009, FR-014 / SC-004, SC-005 → T028~T036。
- Security/performance/verification → T010, T016~T023, T037~T041。
