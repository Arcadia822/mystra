# Tasks: Prisma 多数据库 RDB

**Input**: `spec.md`、`plan.md`、`research.md`、`data-model.md`、`contracts/`、`quickstart.md`
**Prerequisites**: Owner 已批准三表 ER；`main@10750ca` 已合并；engineering re-review 为 CLEAR
**Tests**: 本功能采用 TDD；每个场景的测试任务必须先执行并确认因缺失实现而失败

**Organization**: 任务按 5 个可独立验收的技术场景组织。核心 DB seam 顺序实施；文档与不共享实现文件的
审计任务可并行。所有业务 CRUD 最终只允许经过 Prisma Client。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 不依赖未完成任务且修改不同文件，可并行
- **[Story]**: 对应 `spec.md` 的场景 US1-US5
- 路径均相对仓库根目录

---

## Phase 1: Setup（共享工具链）

**Purpose**: 锁定 Prisma 7 工具链、provider-specific asset 目录和可重复命令

- [ ] T001 在 `apps/control-plane/package.json` 与 `pnpm-lock.yaml` 锁定 `prisma`、`@prisma/client`、`@prisma/adapter-better-sqlite3`、`@prisma/adapter-pg`、`pg` 7.9.1 兼容依赖
- [ ] T002 在 `package.json` 与 `apps/control-plane/package.json` 增加 `db:generate`、`db:validate`、`db:migrate:dev`、`db:migrate:deploy`、`db:migrate:status`、`db:test:reset`、`db:adopt:sqlite` 和 PostgreSQL integration test 命令
- [ ] T003 [P] 建立 `apps/control-plane/prisma/sqlite/`、`apps/control-plane/prisma/postgresql/` 与 `apps/control-plane/src/generated/prisma/` 目录约定并更新 `.gitignore`
- [ ] T004 [P] 在 `.env.example` 增加 SQLite、PostgreSQL、Supabase runtime/direct migration 配置占位，禁止填入真实凭据

**Checkpoint**: 干净 checkout 可以安装依赖并发现两套 Prisma 命令，不需要数据库凭据即可执行 generate

---

## Phase 2: Foundational（所有场景的阻塞前置）

**Purpose**: 先固定三表领域合同、双 schema parity、错误边界与异步 provider seam

**⚠️ CRITICAL**: 本阶段完成前不得实现任何业务 CRUD

- [ ] T005 [P] 为 IntegrationConnection capability envelope、Project stable repository binding、Task 六字段合同编写失败测试到 `packages/shared/src/integrations.test.ts`、`packages/shared/src/schemas.test.ts` 与 `packages/shared/src/management.test.ts`
- [ ] T006 [P] 为三表字段/nullability/unique/index/relation 完全一致编写 schema parity 失败测试到 `apps/control-plane/src/lib/db/prisma-schema-parity.test.ts`
- [ ] T007 在 `packages/shared/src/integrations.ts`、`packages/shared/src/schemas.ts`、`packages/shared/src/management.ts` 与 `packages/shared/src/index.ts` 实现获批三表 Zod/domain contracts，移除 Task source/objective/snapshots、Project snapshots/execution defaults、event-derived summary 与 `artifactId`，并将 `ExecutionSpecArtifact`/`/artifacts/` 改为 inline `ExecutionSpecSnapshot` contract
- [ ] T008 在 `apps/control-plane/src/lib/db/rdb-provider.ts` 将 `RdbProvider` 收缩为 IntegrationConnection、Project、Task 三表异步方法，并定义不泄漏 Prisma/driver 类型的 input/output/error contract
- [ ] T009 [P] 在 `apps/control-plane/prisma/sqlite/schema.prisma` 与 `apps/control-plane/prisma/postgresql/schema.prisma` 定义映射到三张物理表、30 个业务字段的 provider-specific schemas
- [ ] T010 [P] 在 `apps/control-plane/prisma/sqlite/prisma.config.ts` 与 `apps/control-plane/prisma/postgresql/prisma.config.ts` 定义可在 generate 时无数据库 URL、在 migration 时要求显式 URL 的 CLI 配置
- [ ] T011 运行双 schema validate/generate 并修正 `apps/control-plane/src/lib/db/prisma-schema-parity.test.ts`，证明 model section 与 delegate 类型 parity
- [ ] T012 在 `apps/control-plane/prisma/sqlite/migrations/` 与 `apps/control-plane/prisma/postgresql/migrations/` 生成并人工审查空库 baseline migration，确认 FK delete restrict、nullable unique 与索引一致
- [ ] T013 [P] 为唯一冲突、FK 冲突、not-found、连接失败与含 URL/密码 cause 的 redaction 编写失败测试到 `apps/control-plane/src/lib/db/prisma-errors.test.ts`
- [ ] T014 在 `apps/control-plane/src/lib/db/prisma-errors.ts` 实现稳定、脱敏的领域错误归一化，并禁止 Prisma error/cause 原文越过 DB boundary

**Checkpoint**: 双 schema 可生成、三表模型 parity 通过、领域 contracts 只包含获批字段、错误不会泄漏连接秘密

---

## Phase 3: User Story 1 - Prisma 接管全部关系型持久化（Priority: P1）🎯 MVP

**Goal**: SQLite 与 PostgreSQL 对三张表提供相同 Prisma-backed CRUD/transaction 行为

**Independent Test**: 两个空库各自部署 migration 后运行同一 provider contract suite；三表 CRUD、排序、
关系约束、display name clear、capabilities 原子更新与 Issue dispatch 幂等行为全部相同

### Tests for User Story 1

- [ ] T015 [P] [US1] 将三表 CRUD、排序、not-found、display-name clear、capability replacement 与关系约束写成共享失败 contract suite `apps/control-plane/src/lib/db/rdb-provider.contract.ts`
- [ ] T016 [P] [US1] 建立 SQLite 空库 contract harness `apps/control-plane/src/lib/db/prisma-provider.sqlite.test.ts`
- [ ] T017 [P] [US1] 建立要求真实 `MYSTRA_TEST_POSTGRES_URL` 的 PostgreSQL contract harness `apps/control-plane/src/lib/db/prisma-provider.postgresql.test.ts`，缺失凭据时明确 skip 原因
- [ ] T018 [P] [US1] 为 nullable `issue_dispatch_key` 的并发同键/异键 dispatch 与 rollback 编写双库失败测试到 `apps/control-plane/src/lib/db/prisma-provider.dispatch.test.ts`

### Implementation for User Story 1

- [ ] T019 [US1] 在 `apps/control-plane/src/lib/db/prisma-client.ts` 建立 SQLite/PostgreSQL generated client delegate adapter 与明确的 connect/disconnect lifecycle
- [ ] T020 [US1] 在 `apps/control-plane/src/lib/db/prisma-provider.ts` 实现 IntegrationConnection create/upsert/replace/get/list/display-name/status/capabilities/delete/list-bound-projects，全程使用 Prisma CRUD/transaction
- [ ] T021 [US1] 在 `apps/control-plane/src/lib/db/prisma-provider.ts` 实现 Project create/get/list/update/archive、immutable repository binding 与 active/ready/repositories-enabled guard
- [ ] T022 [US1] 在 `apps/control-plane/src/lib/db/prisma-provider.ts` 实现 Task create/get/list 与原子 Issue dispatch 幂等语义，不提供 generic update/delete
- [ ] T023 [US1] 在 `apps/control-plane/src/lib/db/prisma-mappers.ts` 实现 serialized JSON、ISO timestamp 与 Prisma/domain type 双向映射，并在返回前执行 Zod parse
- [ ] T024 [US1] 更新 `apps/control-plane/src/lib/integrations/github-pat-service.ts` 与 `apps/control-plane/src/lib/integrations/github-credential.ts` 使用 provider-neutral connection record、capabilities JSON 和异步三表方法
- [ ] T025 [US1] 运行 SQLite 与真实 PostgreSQL provider contract suites，修正所有语义差异并记录外部 PostgreSQL 未执行条件到 `specs/040-prisma-rdb/quickstart.md`

**Checkpoint**: US1 可独立交付；新 SQLite/PostgreSQL 空库的三表行为一致且运行时无 raw SQL CRUD

---

## Phase 4: User Story 2 - 既有 SQLite 数据安全接管（Priority: P1）

**Goal**: 精确识别 schema v5，备份后无损转换三张保留表，并拒绝未知/混合/损坏数据库

**Independent Test**: schema v5 完整 fixture 接管前后逐字段核对三表；重复运行无变化；未知、混合、缺少
stable external ID、备份失败或迁移中断均 fail closed 且原库可恢复

### Tests for User Story 2

- [ ] T026 [P] [US2] 建立 schema v5、空库、未知、混合、损坏和缺失 repository external ID fixtures 到 `apps/control-plane/src/lib/db/fixtures/`
- [ ] T027 [US2] 为只读 fingerprint、备份原子性、三表转换、重复接管和失败恢复编写失败测试到 `apps/control-plane/src/lib/db/sqlite-adoption.test.ts`
- [ ] T028 [P] [US2] 为 connection repository fields 合并到 `capabilities.repositories`、Project external ID 提升、Task key rename 与删除字段不进入 metadata 编写失败断言到 `apps/control-plane/src/lib/db/sqlite-adoption.test.ts`

### Implementation for User Story 2

- [ ] T029 [US2] 在 `apps/control-plane/src/lib/db/sqlite-adoption.ts` 实现只读 schema fingerprint 与明确 recognized-state 决策，未知状态禁止写入
- [ ] T030 [US2] 在 `apps/control-plane/src/lib/db/sqlite-adoption.ts` 实现接管前备份、临时库转换、完整校验和原子替换；失败时保留原库与备份
- [ ] T031 [US2] 在 `apps/control-plane/src/lib/db/sqlite-adoption.ts` 实现 schema v5 到三表的字段转换，删除 Session/Runner/ContextBundle/event/artifact/mystra_schema 且不保留兼容表
- [ ] T032 [US2] 在 `scripts/adopt-sqlite-prisma.mjs` 实现显式 CLI、dry-run、sanitized diagnostics 与 exit codes，并从 `package.json` 暴露命令
- [ ] T033 [US2] 运行全部 adoption fixtures 两次并在 `specs/040-prisma-rdb/quickstart.md` 记录备份、恢复和幂等证据

**Checkpoint**: US2 可独立验收；schema v5 可恢复接管，未知数据库从未被修改

---

## Phase 5: User Story 3 - 启动时选择 SQLite、PostgreSQL 或 Supabase（Priority: P1）

**Goal**: 一个受 Zod 校验的启动配置选择 provider；Supabase 复用 PostgreSQL 实现并区分 pooled runtime URL 与 direct migration URL

**Independent Test**: 三个 profile 的合法/非法环境矩阵返回确定配置或 sanitized startup error；并发首次访问只
创建一个 client/pool，失败初始化可重试，reset/shutdown 会等待 disconnect

### Tests for User Story 3

- [ ] T034 [P] [US3] 为 provider discriminated union、SQLite path、PG pool limits、Supabase pooled/direct URL 与 secret redaction 编写失败矩阵到 `apps/control-plane/src/lib/db/rdb-config.test.ts`
- [ ] T035 [P] [US3] 为并发初始化、失败重试、singleton promise cache、reset 与 graceful disconnect 编写失败测试到 `apps/control-plane/src/lib/db/index.test.ts`
- [ ] T036 [P] [US3] 为 migration wrapper 缺失 direct URL、误用 pooled URL、provider/config mismatch 与 exit code 编写失败测试到 `scripts/migrate-rdb.test.ts`

### Implementation for User Story 3

- [ ] T037 [US3] 在 `apps/control-plane/src/lib/db/rdb-config.ts` 实现 `sqlite|postgresql|supabase` Zod 配置、pool bounds、timeout defaults 与全量 secret-safe diagnostics
- [ ] T038 [US3] 在 `apps/control-plane/src/lib/db/prisma-client.ts` 使用 `PrismaBetterSqlite3` 或 `PrismaPg` 创建 adapter，显式设置 PostgreSQL connection/idle timeout 和有界 pool
- [ ] T039 [US3] 重写 `apps/control-plane/src/lib/db/index.ts` 为异步 provider factory，缓存 initialization promise、失败清除、测试 reset 与 shutdown disconnect
- [ ] T040 [US3] 在 `scripts/migrate-rdb.mjs` 实现 provider-aware `prisma migrate deploy` wrapper，SQLite 使用文件 URL，PG/Supabase 只接受显式 direct migration URL
- [ ] T041 [US3] 运行三 profile config/factory/migration unit matrix，并用本地 PostgreSQL 验证 runtime pool 与 direct migration 连接职责分离

**Checkpoint**: US3 可独立验收；切库只发生在进程启动，Supabase 不引入第二套 RDB API

---

## Phase 6: User Story 4 - 领域合同不暴露 Prisma 或数据库方言（Priority: P1）

**Goal**: 所有保留调用者只依赖异步 `RdbProvider`；删除面不再通过旧 SQLite/raw SQL 暗中存活

**Independent Test**: boundary audit 找不到 Prisma/adapter/pg/better-sqlite3 越界 import 或运行时业务 raw
SQL；保留三表调用正确 await；删除 surface 的失败清单与 Owner 批准面一致

### Tests for User Story 4

- [ ] T042 [P] [US4] 为 `dispatchIssue` Promise rejection 仍映射为稳定 conflict error 编写回归失败测试到 `apps/control-plane/src/lib/integrations/dispatch.test.ts`
- [ ] T043 [P] [US4] 为禁止 Prisma/adapter/driver 越过 DB module、禁止 runtime raw CRUD、禁止旧表/schema 名编写静态失败审计到 `apps/control-plane/src/lib/db/persistence-boundary.test.ts`
- [ ] T044 [P] [US4] 为 `RdbProvider` 不再暴露 Session/Runner/ContextBundle/event/artifact/summary 方法编写类型与源码失败断言到 `apps/control-plane/src/lib/db/removed-persistence.test.ts`

### Implementation for User Story 4

- [ ] T045 [US4] 更新 `apps/control-plane/src/lib/integrations/dispatch.ts` 与保留的 Integration/Project/Task route/MCP callers 显式 await 三表方法，确保 try/catch 捕获 Promise rejection
- [ ] T046 [US4] 删除 `apps/control-plane/src/lib/db/sqlite-provider.ts` 与 `apps/control-plane/src/lib/db/migrations.ts` 的运行时 ownership，移除 `better-sqlite3` 业务 CRUD 和 constructor migration
- [ ] T047 [US4] 从 `apps/control-plane/src/lib/db/`、`apps/control-plane/app/api/sessions/[id]/summary/route.ts`、`apps/control-plane/app/api/mcp/route.ts` 与测试 fixtures 移除旧 Session/Runner/ContextBundle/event/artifact persistence adapters、summary route/tool 和 Task child-Session projections，不增加 stub 表或 raw SQL fallback
- [ ] T048 [US4] 在 `specs/040-prisma-rdb/implementation-impact.md` 记录因删除字段/方法失败的 UI、API、MCP、Runner 调用者、错误类别与后续独立规格归属
- [ ] T049 [US4] 运行 persistence boundary tests、核心 scoped typecheck/test 与全仓 typecheck/test；只修复三表核心回归，将批准删除面失败精确登记到 `specs/040-prisma-rdb/implementation-impact.md`

**Checkpoint**: US4 可独立验收；Prisma 是唯一三表 CRUD owner，旧 persistence surfaces 没有隐藏路径

---

## Phase 7: User Story 5 - 三种部署形态的 Installation 文档（Priority: P2）

**Goal**: 新操作者可以从干净 checkout 安装 SQLite、local PostgreSQL 或 Supabase-backed PostgreSQL，并理解迁移、验证和恢复

**Independent Test**: 逐章复制命令可完成依赖安装、generate、migration、启动和三表 smoke test；错误 URL、
pool sizing、backup/rollback 和 secrets 边界均有可执行说明

### Tests for User Story 5

- [ ] T050 [P] [US5] 在 `scripts/verify-installation-docs.test.ts` 校验 `INSTALLATION.md` 引用的 scripts、env keys、provider values 和文件路径真实存在
- [ ] T051 [P] [US5] 为 `README.md`、module DB README 与 root Installation 互链编写静态失败断言到 `scripts/verify-installation-docs.test.ts`

### Implementation for User Story 5

- [ ] T052 [US5] 创建根目录 `INSTALLATION.md`，分别记录 SQLite、local PostgreSQL、Supabase pooled runtime/direct migration 配置、迁移、启动、验证、升级与恢复
- [ ] T053 [US5] 更新 `README.md` 链接 Installation，并更新 `apps/control-plane/src/lib/db/README.md` 记录 provider factory、migration owner、adoption、pool lifecycle 与 secret invariants
- [ ] T054 [US5] 在干净临时目录执行 SQLite 安装命令 walkthrough，并将成功证据或精确阻塞写入 `specs/040-prisma-rdb/quickstart.md`
- [ ] T055 [US5] 对 local PostgreSQL 执行 migration + contract smoke walkthrough；Supabase 无凭据时明确记录未执行，不得以 local PostgreSQL 冒充 cloud connectivity

**Checkpoint**: US5 可独立验收；文档命令和实现一致，且不泄漏/提交任何凭据

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: 完成一致性、代码审查、规格状态与可交付证据

- [ ] T056 [P] 更新 `specs/040-prisma-rdb/research.md`、`data-model.md`、`contracts/` 与 `quickstart.md` 使其与最终代码、官方 Prisma 7 配置语义一致
- [ ] T057 [P] 运行双 schema format/validate/generate、migration replay、`git diff --check` 和 credential/string audit
- [ ] T058 运行 project-local `code-review-and-quality`，修复 P0/P1 与范围内 P2，并执行 GitNexus `detect_changes` 核对受影响执行流
- [ ] T059 更新 `specs/040-prisma-rdb/tasks.md`、`checklists.md`、`specs/spec-status.md` 和 `specs/040-prisma-rdb/index.html` 的最终状态，不使用浏览器做 routine spec verification
- [ ] T060 将实现按工具链/合同、Prisma provider、adoption/config、删除面、Installation/verification 切成可回滚提交，并在 `specs/040-prisma-rdb/quickstart.md` 记录提交与工作区隔离证据

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 Setup**: 无依赖
- **Phase 2 Foundational**: 依赖 Phase 1，阻塞所有场景
- **US1**: 依赖 Foundational，是 US2、US3、US4 的核心 provider 前置
- **US2**: 依赖 US1 schema/mappers；可在 US3 config 文件稳定后与 US3 后半段交错，但默认顺序执行
- **US3**: 依赖 US1 client/provider；完成后才能验证进程级切换
- **US4**: 依赖 US1-US3；最后移除旧 provider，避免过早失去行为 oracle
- **US5**: 文档骨架可与 US2-US4 并行，但命令 walkthrough 依赖 US1-US4 完成
- **Polish**: 依赖所有目标场景

### Story Completion Order

```text
Setup → Foundation → US1 Prisma CRUD ─┬→ US2 SQLite adoption ─┐
                                      └→ US3 config/factory ──┼→ US4 boundary cleanup → Polish
                                               US5 docs draft ┘                 └→ US5 walkthrough
```

### Parallel Opportunities

- T003 与 T004 可并行；T005/T006/T013 可在不同测试文件并行编写。
- US1 的 SQLite/PostgreSQL/dispatch harness 可并行编写，但 provider implementation 顺序合并。
- US2 fixtures 与 US3 config/migration tests 修改不同文件，可并行准备。
- US5 文档静态测试和草稿可与 US2-US4 实现并行，实际 walkthrough 不可提前。
- 核心 `rdb-provider.ts`、`prisma-provider.ts`、`index.ts` 与 shared schemas 属同一 blast radius，禁止多
  worktree 同时修改。

## Implementation Strategy

### First Complete Slice

1. 完成 Setup + Foundational。
2. 完成 US1，先让两个新空库在同一 contract suite 下工作。
3. 提交并验证该 slice，保留旧 SQLite 只作为接管行为 oracle。

### Incremental Delivery

1. US1 提供新库三表 Prisma CRUD。
2. US2 接管既有 SQLite，失败可恢复。
3. US3 接入启动配置和 PostgreSQL/Supabase lifecycle。
4. US4 删除旧 persistence owner，并登记批准删除面的上层失败。
5. US5 完成安装 walkthrough，随后执行全量 review/verification。

## Notes

- 所有 test tasks 先运行并确认失败，再实现对应行为。
- `[P]` 只表示文件与依赖允许并行，不授权创建 sub-agent；当前实施由单一 agent 顺序完成。
- 不修复批准删除面导致的上层功能，除非修复仅是保留三表调用的必要 await/字段适配。
- 禁止把 source、objective、snapshots、Session/Runner/ContextBundle 或 Repo Info cache 偷放入 metadata。
- 禁止 runtime `$queryRaw`、`$executeRaw`、`pg.query` 或 direct `better-sqlite3` 业务 CRUD。
