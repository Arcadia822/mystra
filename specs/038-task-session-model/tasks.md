# Tasks: Task / Session 业务模型迁移

**Input**: Design documents from `/specs/038-task-session-model/`
**Prerequisites**: `spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`, `checklists/engineering-review.md`

**Tests**: 本功能要求测试先行。每组 contract/provider/route/adapter 测试必须先写并确认针对旧实现失败，再完成对应实现。

**Organization**: 任务按四个 P1 User Story 分组。共享 schema 与持久化属于阻塞基础；其后 Task、Session、Runner 和完整表面迁移分别形成可验证切片。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 在前置任务完成后可与不同文件/模块任务并行
- **[Story]**: 对应 `spec.md` 的 User Story
- 当前 Goal 在一个共享 worktree 中顺序执行；`[P]` 仅记录逻辑并行性，不授权创建 sub-agent

---

## Phase 1: Setup and Audit Baseline

**Purpose**: 冻结迁移范围、风险与可重复审计入口，不修改产品行为。

- [x] T001 记录关键 symbol/API 的 GitNexus impact 与 CRITICAL blast radius 到 `specs/038-task-session-model/checklists/implementation-impact.md`
- [x] T002 在 `scripts/audit-task-session-terminology.mjs` 建立活动代码/路由/测试/脚本/耐久当前合同的术语审计及显式历史 spec 排除规则
- [x] T003 在 `package.json` 增加 Task/Session 术语审计脚本，不提前移除尚未被 T052 替换的现有入口

**Checkpoint**: 审计范围可重复执行；未触碰运行时逻辑。

---

## Phase 2: Foundational Contracts and Persistence

**Purpose**: 建立所有 User Story 共同依赖的 Task/Session/Runner shared contracts、SQLite schema 与 provider 事务不变量。

**⚠️ CRITICAL**: 此阶段完成并通过 focused tests 前，不得迁移 HTTP、runner、MCP、CLI 或 Web。

- [x] T004 [P] 先在 `packages/shared/src/schemas.test.ts` 添加 Task create、Session create、继承限制与旧 payload 拒绝的失败测试
- [x] T005 [P] 先在 `packages/shared/src/management.test.ts` 添加 Task/Session/Runner management projection、typed errors 与内部事实不公开的失败测试
- [x] T006 [P] 先在 `packages/shared/src/state.test.ts` 和 `packages/shared/src/result.test.ts` 添加 SessionState/SessionResult 生命周期与 terminal evidence 失败测试
- [x] T007 在 `packages/shared/src/schemas.ts`、`packages/shared/src/state.ts`、`packages/shared/src/result.ts` 和 `packages/shared/src/management.ts` 实现 Task/Session/Runner canonical Zod/TypeScript contracts
- [x] T008 在 `packages/shared/src/events.ts` 和 `packages/shared/src/index.ts` 将执行事实收缩为内部 Session 语义并删除公开旧类型导出
- [x] T009 运行 shared focused tests 并将通过证据记录到 `specs/038-task-session-model/checklists/verification.md`
- [x] T010 [P] 先在 `apps/control-plane/src/lib/db/sqlite-provider.test.ts` 添加 fresh/current/exact-legacy/unknown-mixed schema reset 与非目标数据保留失败测试
- [x] T011 在 `apps/control-plane/src/lib/db/migrations.ts` 实现 current schema marker、精确 legacy fingerprint、allowlisted destructive reset 和 `foreign_key_check`
- [x] T012 先在 `apps/control-plane/src/lib/db/sqlite-provider.test.ts` 添加空 Task、十个 sibling Sessions、immutable ownership、dispatch idempotency、claim race、fact rollback、stable Runner 与 stale 边界失败测试
- [x] T013 在 `apps/control-plane/src/lib/db/rdb-provider.ts` 定义独立 TaskRecord、SessionRecord、Runner 与 provider 方法，删除旧 snapshot/connection/event 业务接口
- [x] T014 在 `apps/control-plane/src/lib/db/sqlite-provider.ts` 实现 Task create/get/list/dispatch-key 与单查询 Session summary projection
- [x] T015 在 `apps/control-plane/src/lib/db/sqlite-provider.ts` 实现 Session create/list/get/cancel/summary、原子 claim、内部 fact 与 terminal completion 事务
- [x] T016 在 `apps/control-plane/src/lib/db/sqlite-provider.ts` 实现 stable Runner registration-secret upsert、credential rotation、heartbeat、capacity 和 stale handling
- [x] T017 在 `apps/control-plane/src/lib/db/index.ts` 和 `apps/control-plane/src/lib/db/README.md` 接入新 provider contract、精确 reset 行为与配置说明
- [x] T018 运行 SQLite focused tests、检查无 N+1 Task projection，并把证据追加到 `specs/038-task-session-model/checklists/verification.md`

**Checkpoint**: Shared contracts 和 SQLite provider 只暴露 Task、Session、Runner；fresh/reset/idempotency/concurrency/security tests 全部通过。

---

## Phase 3: User Story 1 - 以 Task 组织长期工作目标 (Priority: P1)

**Goal**: 人或 Agent 可以创建、列出和读取没有 Session 的 Task；Issue dispatch 原子创建或复用 Task 与 initial Session。

**Independent Test**: 创建空 Task 并通过 HTTP/Web 读取；重复 dispatch 同一 Issue 两次得到相同 Task/initial Session ID，Task 中没有执行 state/result/Runner 字段。

### Tests for User Story 1

- [x] T019 [P] [US1] 先在 `apps/control-plane/app/api/routes.test.ts` 添加 Task create/list/detail contract 与旧 Task payload 拒绝的失败测试
- [x] T020 [P] [US1] 先在 `apps/control-plane/src/lib/integrations/github.test.ts` 和 `apps/control-plane/src/lib/integrations/linear.test.ts` 添加 Issue dispatch 原子幂等 pair 与 conflict 失败测试
- [x] T021 [P] [US1] 先在 `apps/control-plane/app/api/object-pages.test.ts` 添加零 Session Task list/detail/empty/error state 失败测试

### Implementation for User Story 1

- [x] T022 [US1] 实现 `apps/control-plane/app/api/tasks/route.ts` 和 `apps/control-plane/app/api/tasks/[id]/route.ts` 的 canonical Task management endpoints
- [x] T023 [US1] 在 `apps/control-plane/src/lib/integrations/dispatch.ts` 与 `apps/control-plane/app/api/integrations/[integration]/issues/[identifier]/dispatch/route.ts` 返回原子 Task/initial Session pair
- [x] T024 [US1] 在 `apps/control-plane/src/lib/integrations/types.ts`、`apps/control-plane/src/lib/integrations/errors.ts` 和 `apps/control-plane/src/lib/integrations/README.md` 统一 Task source/dispatch contracts
- [x] T025 [US1] 将 `apps/control-plane/app/tasks/page.tsx` 和 `apps/control-plane/app/tasks/[id]/page.tsx` 绑定真实 Task resource、Session summary 与零子项状态
- [x] T026 [US1] 运行 Task route、integration 和 object-page focused tests，并把证据追加到 `specs/038-task-session-model/checklists/verification.md`

**Checkpoint**: User Story 1 可独立工作；Task 可为空，Issue dispatch 幂等且没有旧兼容字段。

---

## Phase 4: User Story 2 - 在 Task 下创建独立 Session (Priority: P1)

**Goal**: 一个 Task 可显式创建多个独立 Session，每个拥有子目标、Agent、branch、runtime、state 与 review evidence，兄弟生命周期不联动。

**Independent Test**: 为一个 Task 创建三个不同 Session，执行/取消其中一个，另外两个不变；显式再次执行会创建新 Session 而非覆盖或增加 attempt。

### Tests for User Story 2

- [x] T027 [P] [US2] 先在 `apps/control-plane/app/api/routes.test.ts` 添加 Session create/list/detail/cancel/summary、inheritance rejection 与 sibling independence 失败测试
- [x] T028 [P] [US2] 先在 `packages/shared/src/coordination-session-summary.test.ts` 添加 Session coordination summary、result unavailable 与无 event projection 的失败测试
- [x] T029 [P] [US2] 先在 `apps/control-plane/app/api/object-pages.test.ts` 添加 Session loading/error/terminal/review 页面和 Task child creation 失败测试

### Implementation for User Story 2

- [x] T030 [US2] 实现 `apps/control-plane/app/api/tasks/[id]/sessions/route.ts` 与 `apps/control-plane/app/api/sessions/[id]/route.ts` 的 Session create/list/detail endpoints
- [x] T031 [US2] 实现 `apps/control-plane/app/api/sessions/[id]/cancel/route.ts` 与 `apps/control-plane/app/api/sessions/[id]/summary/route.ts` 的 Session-only operations
- [x] T032 [US2] 将 `packages/shared/src/coordination-session-summary.ts` 和 `apps/control-plane/src/lib/coordination-session-summary.ts` 迁移为 compact Session summary，不暴露内部 facts
- [x] T033 [US2] 新增 `apps/control-plane/app/sessions/[id]/page.tsx` 并扩展 `apps/control-plane/app/tasks/[id]/page.tsx` 的 child Session create/list/inspect 交互
- [x] T034 [US2] 在 `apps/control-plane/app/_lib/types.ts`、`apps/control-plane/app/_lib/format.ts` 和 `apps/control-plane/app/_components/status-badge.tsx` 统一 Session 类型、时间和状态显示
- [x] T035 [US2] 运行 Session route、summary 和 object-page focused tests，并把证据追加到 `specs/038-task-session-model/checklists/verification.md`

**Checkpoint**: User Story 2 可独立工作；Task 下 0..N Session 与 sibling independence 得到测试证明。

---

## Phase 5: User Story 3 - 将 Runner 作为稳定业务对象 (Priority: P1)

**Goal**: Runner 注册、心跳、重启与 claim 使用稳定 Runner ID；credential/heartbeat/lease 不形成业务对象。

**Independent Test**: 用共享 registration secret 注册同名 Runner 两次，ID 不变、旧 credential 失效；管理 API/Web 只展示稳定 Runner 和 Session assignment。

### Tests for User Story 3

- [x] T036 [P] [US3] 先在 `apps/control-plane/app/api/routes.test.ts` 添加 registration-secret、same-name upsert、credential rotation、heartbeat、Runner list/detail 与 claim Session 失败测试
- [x] T037 [P] [US3] 先在 `apps/runner-daemon/src/registration.test.ts` 添加 enrollment credential、stable runnerId 和 Session capability payload 失败测试
- [x] T038 [P] [US3] 先在 `apps/control-plane/app/api/object-pages.test.ts` 添加稳定 Runner health/capacity/current Session projection 失败测试

### Implementation for User Story 3

- [x] T039 [US3] 将 `apps/control-plane/app/api/runner/register/route.ts` 与 `apps/control-plane/app/api/runner/heartbeat/route.ts` 迁移为 registration-secret 验证和 stable Runner protocol
- [x] T040 [US3] 实现 `apps/control-plane/app/api/runner/sessions/route.ts`、`apps/control-plane/app/api/runner/sessions/[id]/route.ts`、`events/route.ts` 与 `result/route.ts`
- [x] T041 [US3] 将 `apps/control-plane/app/api/runners/route.ts` 和 `apps/control-plane/app/api/runners/[id]/route.ts` 迁移为稳定 Runner management views
- [x] T042 [US3] 将 `apps/runner-daemon/src/registration.ts` 和 `apps/runner-daemon/src/index.ts` 迁移为 enrollment secret、runnerId、Task context 与 Session claim/completion
- [x] T043 [US3] 将 `apps/runner-daemon/src/direct-execution.ts` 与 `apps/runner-daemon/src/review-projections.ts` 的执行/result envelope 迁移为 Session
- [x] T044 [US3] 更新 `apps/control-plane/app/runners/page.tsx` 与 `apps/control-plane/app/runners/[id]/page.tsx` 的稳定身份、健康、容量和 Task/Session assignments
- [x] T045 [US3] 更新 `apps/runner-daemon/README.md` 与 `docs/RUNNER-ENVIRONMENT.md` 的 registration secret、stable Runner 和 Session protocol 文档
- [x] T046 [US3] 运行 runner route/daemon/provider/object-page focused tests，并把证据追加到 `specs/038-task-session-model/checklists/verification.md`

**Checkpoint**: User Story 3 可独立工作；Runner 重启不产生新业务对象，匿名接管与旧 credential 均被拒绝。

---

## Phase 6: User Story 4 - 完成无兼容层的统一迁移 (Priority: P1)

**Goal**: HTTP、MCP、CLI、runner protocol、Web、脚本、schema 和耐久当前合同只使用 Task、Session、Runner，并完成真实 Issue → Review 路径。

**Independent Test**: 对 fresh DB 执行 Issue → Task → Session → Runner → Review；旧路由/命令/MCP tool 不存在；活动术语审计结果为零。

### Tests for User Story 4

- [x] T047 [P] [US4] 先在 `apps/control-plane/app/api/routes.test.ts` 添加 MCP Task/Session/Runner tool discovery/call parity 与旧 tool 缺失失败测试
- [x] T048 [P] [US4] 先在 `apps/control-plane/src/lib/operator-cli.test.ts` 和 `apps/control-plane/src/lib/operator-object-cli.test.ts` 添加 tasks/sessions/runners CLI 与旧 command 缺失失败测试
- [x] T049 [P] [US4] 先在 `apps/runner-daemon/src/direct-execution.test.ts` 添加 Task context → Session result/review end-to-end envelope 失败测试

### Implementation for User Story 4

- [x] T050 [US4] 将 `apps/control-plane/app/api/mcp/route.ts` 收敛为 shared Task/Session/Runner tools，并删除公开内部 fact/event tool contract
- [x] T051 [US4] 将 `scripts/operator-cli.mjs` 迁移为 tasks/sessions/runners 命令组、canonical JSON schemas 与 Session polling/result/failure
- [x] T052 [US4] 删除旧独立业务脚本及 `package.json` 入口，统一通过 `scripts/operator-cli.mjs` 的 Task/Session 命令且不保留 alias
- [x] T053 [US4] 删除 `apps/control-plane/app/api/jobs/` 与 `apps/control-plane/app/api/runner/jobs/`，并验证请求不会被 redirect 或 compatibility handler 接收
- [x] T054 [US4] 更新 `apps/control-plane/app/api/control-plane/route.ts`、`apps/control-plane/app/page.tsx` 与 `apps/control-plane/app/_components/app-shell.tsx` 的 Task/Session/Runner 导航与健康摘要
- [x] T055 [US4] 更新 `.specify/memory/constitution.md`、`PRODUCT.md`、`PLATFORM.md`、`PROCESS.md` 和 `README.md` 的当前 MVP boundary 与 amendment notes
- [x] T056 [US4] 更新 `specs/025-webui/spec.md`、`specs/025-webui/plan.md`、`specs/025-webui/contracts/shell-contract.md`、`specs/025-webui/features.md` 和 `specs/025-webui/tasks.md` 为 New Task/Recent Sessions
- [x] T057 [US4] 更新 `specs/025-webui/prototype.md`、`specs/025-webui/README.md`、`specs/025-webui/page-designs/new-work.md`、`specs/025-webui/page-designs/overview-analytics.md` 和 `specs/025-webui/mockups/index.html` 的活动 UI 文案与 Session detail 语义
- [x] T058 [US4] 在 `specs/spec-status.md` 记录 038 supersedes 当前业务模型、历史 spec 排除边界，并确保 5xP/活动代码不引用其旧合同
- [x] T059 [US4] 运行 MCP、CLI、runner direct-execution、route absence 与 025 render focused tests，并把证据追加到 `specs/038-task-session-model/checklists/verification.md`

**Checkpoint**: User Story 4 完整；所有活动入口只提供 Task、Session、Runner，不存在兼容层。

---

## Phase 7: Polish and Cross-Cutting Verification

**Purpose**: 清除残留、验证整个 monorepo、更新索引并形成可审计的本地提交。

- [x] T060 [P] 更新 `docs/SPEC.md`、`docs/IMPLEMENTATION-PLAN.md`、`docs/ADR-0002-hosted-supabase-control-plane-mcp.md` 和 `docs/ADR-0003-platform-capabilities-vs-project-state.md` 的 current/superseded 说明
- [x] T061 [P] 更新 `apps/control-plane/src/lib/db/README.md`、`apps/control-plane/src/lib/integrations/README.md` 和 `apps/runner-daemon/README.md` 的最终命令、配置与不变量
- [x] T062 运行 `pnpm audit:task-session-terminology` 并修复 `scripts/audit-task-session-terminology.mjs` 报告的全部活动残留
- [x] T063 运行 `pnpm typecheck`、`pnpm test`、`pnpm lint` 与 `pnpm build`，将命令和结果记录到 `specs/038-task-session-model/checklists/verification.md`
- [x] T064 运行 Spec-Kit doctor/analyze、render、`git diff --check` 与 quickstart 验证，并更新 `specs/038-task-session-model/checklists/verification.md`
- [x] T065 刷新 GitNexus index 并运行 `gitnexus_detect_changes()`，将受影响 symbols/processes 与预期范围对照写入 `specs/038-task-session-model/checklists/implementation-impact.md`
- [x] T066 检查并保留用户原有 `AGENTS.md`、`CLAUDE.md` 和 `apps/control-plane/next-env.d.ts` 未提交差异，只暂存 038 授权改动
- [x] T067 在本地创建 038 feature commit，确认未执行 push，并将 commit/evidence 记录到 `specs/038-task-session-model/checklists/verification.md`

**Final Checkpoint**: 所有规格验收、测试、构建、术语审计、GitNexus scope 与本地提交完成；远端未推送。

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1**: 无依赖，先冻结审计范围。
- **Phase 2**: 依赖 Phase 1，阻塞全部 User Story。
- **US1 / Phase 3**: 依赖 Phase 2，建立 Task 与 Issue intake。
- **US2 / Phase 4**: 依赖 Phase 2 与 US1 Task HTTP/detail，建立 child Session surface。
- **US3 / Phase 5**: 依赖 Phase 2 与 US2 Session provider/protocol contract，建立 stable Runner execution。
- **US4 / Phase 6**: 依赖 US1-US3，迁移所有薄适配器并删除旧表面。
- **Phase 7**: 依赖所有 User Story，执行全量清理、验证和本地提交。

### User Story Dependency Graph

```text
Setup/Audit
    │
Shared contracts + SQLite provider
    │
    ├── US1 Task + Issue dispatch
    │       │
    │       └── US2 child Session management
    │               │
    │               └── US3 stable Runner execution
    │                       │
    │                       └── US4 MCP/CLI/Web/docs cutover
    │
    └──────────────────────────────> Final audit/verification/commit
```

### Within Each User Story

1. 先运行 GitNexus impact（若涉及新 symbol 则对被替换的旧 symbol/route 执行）。
2. 写测试并确认针对旧实现失败。
3. 实现最小完整切片。
4. 运行 focused tests 并记录证据。
5. 通过 checkpoint 后再进入下一 Story。

### Parallel Opportunities

- T004-T006 可并行编写 shared tests。
- T019-T021、T027-T029、T036-T038、T047-T049 各 Story 内的测试可在合同冻结后并行。
- US3 完成后，MCP、CLI、025/docs 可逻辑并行，但它们共享命名审计和部分 route types；合并前必须运行全量 parity tests。
- 本 Goal 未获 sub-agent 授权，实际执行顺序保持单 worktree 串行。

---

## Parallel Examples

### User Story 1

```text
T019 Task route contract tests
T020 Integration dispatch tests
T021 Task object-page tests
```

### User Story 2

```text
T027 Session route tests
T028 Session summary tests
T029 Session object-page tests
```

### User Story 3

```text
T036 Runner route/security tests
T037 Runner daemon registration tests
T038 Runner object-page tests
```

### User Story 4

```text
T047 MCP parity tests
T048 CLI parity tests
T049 Runner end-to-end envelope tests
```

---

## Implementation Strategy

### Foundation First

1. T001-T003 建立审计边界。
2. T004-T009 冻结 shared contracts。
3. T010-T018 完成 destructive reset 与 provider 事务不变量。
4. **STOP AND VALIDATE**: shared/SQLite focused tests 必须全绿；否则不迁移 adapter。

### Complete Vertical Cutover

1. US1 交付独立 Task 与 Issue dispatch。
2. US2 交付 0..N child Sessions。
3. US3 交付 stable Runner 与 Session execution。
4. US4 同步迁移 MCP/CLI/Web/docs 并删除旧表面。
5. Final Phase 证明不存在旧兼容面，而不是仅证明新路径可用。

### Recovery Rule

- 任一 checkpoint 失败时停留在当前 Phase 修复，不通过 alias、双写或临时 adapter 绕过。
- destructive reset 测试若不能证明 unknown schema 保留，则不得对真实本地开发 DB 启动新版本。
- 如 GitNexus 报告新的 HIGH/CRITICAL 未纳入 `implementation-impact.md`，先更新影响与测试计划，再继续编辑。

---

## Notes

- `[P]` 表示逻辑并行，不代表已授权多 Agent。
- 每个任务包含明确文件路径与可由 checkpoint 验证的结果。
- 旧业务词可在迁移规格、负向测试和 superseded 历史说明中作为被删除对象出现；不得出现在活动产品合同或兼容入口。
- activity timeline/public event projection 没有实现任务；它仍需未来独立规格。
