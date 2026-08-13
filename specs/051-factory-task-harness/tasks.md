# Tasks: 薄 Task 生产状态机与 mystra-agent CLI

**Input**: `/specs/051-factory-task-harness/` 下的 spec、plan、research、data-model、contracts 与 quickstart
**Tests**: 本功能明确采用 TDD；每个行为切片先写失败测试，再实现并回归。
**Organization**: 按四个 user stories 分阶段；共享状态/RDB/capability foundation 先完成。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 可在不同文件中并行，且不依赖同阶段未完成任务
- **[Story]**: 对应 spec 中 US1–US4
- 所有任务包含目标文件路径

## Phase 1: Setup（共享工程结构）

**Purpose**: 建立 workload CLI package 与 feature verification 入口，不实现业务行为

- [x] T001 在 `packages/agent-cli/package.json`、`packages/agent-cli/tsconfig.json`、`packages/agent-cli/tsconfig.build.json` 创建 private `@mystra/agent-cli` workspace package 和 `mystra-agent` bin build contract
- [x] T002 在 `packages/agent-cli/bin/mystra-agent` 与 `packages/agent-cli/src/index.ts` 建立可执行 wrapper 和 Runner 可解析的 bin-directory export
- [x] T003 更新 `apps/runner-daemon/package.json` 的 production dependency 与 prebuild/predev/pretest wiring，确保 Runner 安装/构建时包含 `@mystra/agent-cli`
- [x] T004 更新 `package.json` 增加直接运行 workload CLI 的本地开发命令，并保持 `mystra` operator CLI 边界不变

---

## Phase 2: Foundational（状态合同、持久化与安全基础）

**Purpose**: 所有 user story 共同依赖的 Task/Harness/status/capability 领域合同

**⚠️ CRITICAL**: 本阶段完成前不进入任何 user story implementation

### Tests first

- [x] T005 [P] 在 `packages/shared/src/task.test.ts` 写 productionStatus、actor allowlist、note、terminal、statusNote clearing 与 allowedTransitions 的失败测试
- [x] T006 [P] 在 `packages/shared/src/harness.test.ts` 写 Harness、TaskExecutionContext、execution identity/capability schema 的边界与 secret-exclusion 失败测试
- [x] T007 在 `apps/control-plane/src/lib/db/rdb-provider.contract.ts` 写 Task projection/history、assign atomicity、idempotency、20-way revision race、Harness uniqueness、capability lifecycle 与 Workspace completion replay 的 provider contract 失败测试

### Shared contracts and persistence

- [x] T008 在 `packages/shared/src/task.ts` 实现 production projection、transition request/result/history schemas 与纯 transition policy，并在 `packages/shared/src/management.ts` 扩展 Task record projections
- [x] T009 在 `packages/shared/src/harness.ts` 实现 Harness、Assign/Start、TaskExecutionContext、workload identity/status 与 stable error schemas，并从 `packages/shared/src/index.ts` 导出
- [x] T010 在 `packages/shared/src/session.ts` 扩展 `SessionClaimAssignment.execution` 可选 capability envelope，保证普通 Session 合同兼容当前 049 行为
- [x] T011 [P] 在 `apps/control-plane/prisma/sqlite/schema.prisma` 与 `apps/control-plane/prisma/postgresql/schema.prisma` 增加 Task production projection、Harness、TaskStatusTransition 和 SessionDispatchLease execution hash/expiry
- [x] T012 在 `apps/control-plane/prisma/sqlite/migrations/20260811210000_factory_task_harness/migration.sql` 与 `apps/control-plane/prisma/postgresql/migrations/20260811210000_factory_task_harness/migration.sql` 根据 T011 schema 编写等价 migration 与必要 unique/index constraints
- [x] T013 在 `apps/control-plane/src/lib/db/prisma-client.ts` 与 `apps/control-plane/src/lib/db/prisma-mappers.ts` 增加新模型 client facade 与 domain mapper
- [x] T014 在 `apps/control-plane/src/lib/db/rdb-provider.ts` 定义 assign/status/history/Harness/capability/Workspace-completion-idempotency 的 dialect-neutral commands
- [x] T015 在 `apps/control-plane/src/lib/db/prisma-provider.ts` 实现短事务、fingerprint replay、optimistic revision、terminal revocation、indexed capability resolution 与同 attempt/report completion replay
- [x] T016 运行 `corepack pnpm --filter @mystra/control-plane db:generate`、shared tests 和 RdbProvider contract tests，修复 foundation 直至 SQLite 全绿并在有 `MYSTRA_TEST_POSTGRES_URL` 时验证 PostgreSQL

**Checkpoint**: 共享 schema 与 RDB 已能原子表达 Task production、Harness 和 execution capability；无 service/API/UI 行为

---

## Phase 3: User Story 1 — Assign Agent 开始生产（Priority: P1）

**Goal**: pending Task Assign/Start 后原子进入 in_progress、创建 frozen Harness、准备 Workspace，并在 ready/replay 后只创建一个 Session

**Independent Test**: 对 eligible Task 并发/重放 Assign，验证唯一 transition/Harness；模拟 Workspace queued→ready、ready 后 launch failure→report replay，最终恰有一个 frozen-input Autopilot Session

### Tests first

- [x] T017 [P] [US1] 在 `apps/control-plane/src/lib/tasks/task-production-service.test.ts` 写 eligibility、atomic replay、post-commit setup diagnostic、already-ready 与 continuation idempotency 失败测试
- [x] T018 [P] [US1] 在 `apps/control-plane/src/lib/sessions/session-service.test.ts` 写 Harness launch 使用 frozen Agent/Task/Issue input、标准 bootstrap prompt 且不嵌入 execution code/current mutable context 的失败测试
- [x] T019 [P] [US1] 在 `apps/control-plane/app/api/task-production-routes.test.ts` 写 Human auth、Assign response、stable error 与 Workspace-ready report retry route 失败测试

### Implementation

- [x] T020 [US1] 在 `apps/control-plane/src/lib/tasks/task-production-service.ts` 实现 Assign/Start preflight、短事务、Workspace setup、diagnostic persistence 与 idempotent ready continuation
- [x] T021 [US1] 在 `apps/control-plane/src/lib/tasks/task-production-service-factory.ts` 组装 Agent/Runtime/Workspace/Session dependencies，避免 API route 复制 orchestration
- [x] T022 [US1] 在 `apps/control-plane/src/lib/sessions/system-prompt-assembler.ts` 增加 Harness-only runtime/provider/frozen-agent/bootstrap prompt variant，保持普通 049 Session assembler 不变
- [x] T023 [US1] 在 `apps/control-plane/src/lib/sessions/session-service.ts` 增加 `launchHarness`，使用 planned Session/message IDs 和 frozen snapshots 复用现有 atomic Session create path，成功后绑定 actual Harness.sessionId
- [x] T024 [US1] 在 `apps/control-plane/src/lib/task-workspaces/workspace-preparation-service.ts` 与 `apps/control-plane/app/api/runner/workspaces/[workspaceId]/attempts/[attemptId]/route.ts` 接入同 payload completion replay和 ready continuation
- [x] T025 [US1] 在 `apps/control-plane/app/api/tasks/[id]/production/assign/route.ts` 与 `apps/control-plane/app/api/tasks/[id]/production/route.ts` 实现 Human Assign/production read endpoints
- [x] T026 [US1] 通过 `task-production-service.test.ts`、`session-service.test.ts`、`task-production-routes.test.ts` 与真实 HTTP smoke 覆盖 queued Workspace、failure/replay recovery、唯一 Session 和 frozen prompt 的 RDB/HTTP 边界

**Checkpoint**: US1 可独立证明 Human Assign 到唯一 Session 启动；Agent 尚不能通过 workload CLI 更新状态

---

## Phase 4: User Story 2 — Agent 获取上下文并报告生产状态（Priority: P1）

**Goal**: Harness Session claim 获得 attempt-scoped code；Agent 只凭 URL/code 使用 `mystra-agent` 读取 context 并迁移 blocked/in_progress/waiting_for_review

**Independent Test**: fixture Runner/Provider workload 在没有 Task ID/平台外部 credential 的情况下运行 whoami/context/status，使用 fixture `linctl`/`gh`，覆盖 blocked→resume→waiting_for_review 与 capability failure

### Tests first

- [x] T027 [P] [US2] 在 `apps/control-plane/src/lib/tasks/task-status-service.test.ts` 写 Agent transition matrix、note、revision/idempotency、scope 与 terminal revocation 失败测试
- [x] T028 [P] [US2] 在 `apps/control-plane/src/lib/tasks/agent-execution-service.test.ts` 写 hash/expiry/revocation/Team/Harness/Session/Agent revision resolution 和 context secret exclusion 失败测试
- [x] T029 [P] [US2] 在 `apps/control-plane/src/lib/sessions/runtime-session-service.test.ts` 写 Harness-only claim code issuance、hash persistence、reclaim rotation 与普通 Session无 capability 失败测试
- [x] T030 [P] [US2] 在 `apps/control-plane/app/api/task-production-routes.test.ts` 写 bearer-only workload routes、无 arbitrary IDs、stable errors 与 no-store 失败测试
- [x] T031 [P] [US2] 在 `packages/agent-cli/src/cli.test.ts` 与 `packages/agent-cli/src/client.test.ts` 写 argv/env/JSON/error/cwd composition/redaction 失败测试
- [x] T032 [P] [US2] 在 `apps/runner-daemon/src/session/session-worker.test.ts` 与 `apps/runner-daemon/src/session/session-loop.test.ts` 写 PATH/endpoint/code environment handoff 和 no-code manual Session 失败测试

### Implementation

- [x] T033 [US2] 在 `apps/control-plane/src/lib/tasks/task-status-service.ts` 实现 shared policy 驱动的 Human/Agent transition application service 与 history read
- [x] T034 [US2] 在 `apps/control-plane/src/lib/tasks/agent-execution-service.ts` 实现 execution code resolution、uniform fail-closed auth、whoami/context/status application methods
- [x] T035 [US2] 在 `apps/control-plane/src/lib/tasks/agent-execution-service-factory.ts` 与 `apps/control-plane/src/lib/tasks/task-status-service-factory.ts` 组装 dialect-neutral dependencies
- [x] T036 [US2] 在 `apps/control-plane/src/lib/sessions/runtime-session-service.ts` 扩展 claim-time code issuance/hash/expiry，并在 `packages/shared/src/session.ts` 合同下返回 capability envelope
- [x] T037 [US2] 在 `apps/control-plane/app/api/agent-execution/whoami/route.ts`、`context/route.ts` 与 `task-status/route.ts` 实现 execution-code-only HTTP surface 和 stable error mapping
- [x] T038 [US2] 在 `packages/agent-cli/src/client.ts`、`packages/agent-cli/src/cli.ts` 与 `packages/agent-cli/bin/mystra-agent` 实现 workload HTTP client、commands、machine-readable output 与 secret-safe failures
- [x] T039 [US2] 在 `apps/runner-daemon/src/index.ts`、`apps/runner-daemon/src/session/session-loop.ts` 与 `apps/runner-daemon/src/session/session-worker.ts` 注入 Runner endpoint、CLI bin PATH 和 claim execution code，不把 environment 写入 event/log
- [x] T040 [US2] 在 `packages/agent-cli/src/journey.test.ts` 使用临时 fixture `linctl`/`gh` 完成 issue-read/PR-report journey，并断言 `mystra-agent` 只访问 scoped Control Plane URLs、没有 Integration/RepoDelivery fallback

**Checkpoint**: US2 独立证明 Agent workload 能完成 accepted CLI journey；PR/tests 仍只是未验证 note

---

## Phase 5: User Story 3 — Human 收口或退回（Priority: P1）

**Goal**: Human 可从 waiting_for_review 标记 done/退回 in_progress，blocked 可恢复，任意非终态可 canceled；terminal 吊销 execution capability

**Independent Test**: 从 waiting_for_review/blocked/nonterminal 执行所有 Human 合法迁移，验证 actor audit、terminal revocation 与 Agent 无完成权限

### Tests first

- [x] T041 [P] [US3] 在 `apps/control-plane/app/api/task-production-routes.test.ts` 写 Human RBAC、done/return/cancel、terminal、actor audit 和 stable error 失败测试
- [x] T042 [P] [US3] 在 `apps/control-plane/src/lib/tasks/task-status-service.test.ts` 增加 Human/Agent并发 terminal revocation 与 stale workload command 失败测试

### Implementation

- [x] T043 [US3] 在 `apps/control-plane/app/api/tasks/[id]/production/status/route.ts` 实现 Human status endpoint，并传递现有 auth subject userId/team role
- [x] T044 [US3] 在 `apps/control-plane/src/lib/tasks/task-status-service.ts` 完成 Human transition、terminal capability revocation 与 append-only actor projection
- [x] T045 [US3] 通过 `task-status-service.test.ts`、`agent-execution-service.test.ts`、route tests 与真实 HTTP smoke 验证 waiting_for_review→done/return、cancel 和旧 execution code fail closed

**Checkpoint**: US3 独立证明业务完成权属于 Human，terminal 状态不可 reopen

---

## Phase 6: User Story 4 — Task 状态与 Session 分别观察（Priority: P2）

**Goal**: Task detail/API 同时展示 productionStatus/history/Harness/latest Session，并明确 Agent report 未经 Mystra 验证

**Independent Test**: 构造 Session failed + Task in_progress、Session ready + Task blocked、waiting_for_review虚假 URL/tests，验证互不驱动且 UI 标注 unverified

### Tests first

- [x] T046 [P] [US4] 在邻近 Task presentation/model tests、production route tests 与浏览器 smoke 验证 production projection、Assign controls、Human review controls、history 和 Agent-reported label
- [x] T047 [P] [US4] 在 `apps/control-plane/app/api/task-production-routes.test.ts` 增加 latest Session/Task 独立 projection 与 limit-bounded history 失败测试

### Implementation

- [x] T048 [US4] 在 `apps/control-plane/app/tasks/[id]/page.tsx` 与 `apps/control-plane/app/_components/task-production-panel.tsx` 增加 status badge、Assign/Start、history、Harness/latest Session 和 Human review controls
- [x] T049 [US4] 在 `apps/control-plane/app/api/tasks/[id]/production/route.ts` 与 Task presentation mapper 返回独立 Task/Session projections，并把 Agent note 标为 `verified:false`
- [x] T050 [US4] 通过 production route tests、shell/task presentation tests 与真实浏览器 smoke 验证 failed/ready Session 不驱动 Task、Task icon 使用 productionStatus 和 review 声明标注

**Checkpoint**: US4 独立证明操作者能区分业务状态与执行状态

---

## Phase 7: Polish & Cross-Cutting Verification

**Purpose**: 安全、文档、全量验证与 feature closeout

- [x] T051 [P] 在 shared、RDB、prompt、runtime claim、route 与 Runner worker tests 中覆盖 execution code 不进入 DB 明文、prompt、SessionEvent、Task note、route/Runner logs 的泄漏回归
- [x] T052 [P] 更新 `apps/runner-daemon/README.md`、`packages/agent-cli/README.md` 与 `PLATFORM.md` 的 Runner-bundled CLI、host `linctl`/`gh` 前置条件、配置和故障语义
- [x] T053 执行 `corepack pnpm --filter @mystra/control-plane db:generate`、四 package focused tests、`corepack pnpm typecheck`、`corepack pnpm test`、`corepack pnpm build` 与 scoped `git diff --check`
- [x] T054 按 `specs/051-factory-task-harness/quickstart.md` 完成真实 HTTP + host boundary smoke；记录不能执行的 PostgreSQL/真实外部 CLI 条件且不夸大证据
- [x] T055 针对 `packages/shared/`、`apps/control-plane/`、`apps/runner-daemon/`、`packages/agent-cli/` 运行 GitNexus change detection、project-local code review、Spec-Kit analyze/status/doctor，修正所有 P1/P2、contract drift 与 artifact health 问题
- [x] T056 更新 `specs/051-factory-task-harness/spec.md` 状态、`specs/051-factory-task-harness/checklists.md`、`specs/spec-status.md` 与生成的 `index.html`，执行 `aaa-spec-close` 完成 051 收口

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 Setup**: 无依赖。
- **Phase 2 Foundation**: 依赖 Phase 1；阻塞所有 user stories。
- **US1**: 依赖 Foundation；建立 Harness/Session production path。
- **US2**: 依赖 US1 的 Harness Session 与 Foundation capability fields。
- **US3**: 依赖 Foundation TaskStatusService；最终 E2E 依赖 US2 capability。
- **US4**: 依赖 US1–US3 API/projection。
- **Polish**: 依赖所有目标 stories 完成。

### User Story Dependency Graph

```text
Setup -> Foundation -> US1 Assign/Harness/Session -> US2 Agent CLI/status
                         |                          |
                         +--------------------------+-> US3 Human closeout
                                                     -> US4 Observation UI
US1 + US2 + US3 + US4 -> Polish/Review/Closeout
```

### Within Each Story

1. 先写测试并确认因缺失行为失败。
2. shared/RDB contracts 先于 service。
3. service 先于 route/CLI/UI adapter。
4. focused tests 通过后才执行 story E2E。
5. 每个 checkpoint 必须独立可演示，不能用后续 story 掩盖失败。

### Parallel Opportunities

- T005/T006 可并行编写 shared tests；T011/T012 可在 schema shape稳定后并行写双 dialect artifacts。
- 每个 story 内标记 `[P]` 的测试文件可并行起草，但实现仍按 foundation→service→adapter 顺序。
- US3 route tests可在 US2 CLI实现后段起草；US4 UI tests可在 production read contract稳定后起草。
- 实际单 agent执行采用顺序模式，避免共享 `packages/shared` 和 DB provider 冲突。

## Parallel Example: User Story 2

```text
Lane A: task-status-service.test.ts -> TaskStatusService
Lane B: agent-execution-service.test.ts -> AgentExecutionService
Lane C: agent-cli tests -> CLI client/bin
Lane D: runner session tests -> environment handoff

Merge A+B foundation, then workload routes; merge C+D after shared claim schema stabilizes。
```

## Implementation Strategy

### Accepted MVP Journey

本 feature 的 MVP 不是只完成 US1。用户明确的最大产品边界是：

```text
Task Assign -> one Harness/Session -> Agent context via mystra-agent
-> local linctl/gh work -> Agent waiting_for_review -> Human done/return
```

因此最小可交付范围是 Foundation + US1 + US2 + US3；US4 是 P2 可观察性，但 051 完成条件仍要求其 spec acceptance 通过。

### Incremental Validation

1. Foundation：纯状态/RDB安全性。
2. US1：生产链路能自动启动唯一 Session。
3. US2：Agent能自助取上下文和报告状态。
4. US3：Human拥有业务收口权。
5. US4：操作者能区分 Task/Session truth。
6. 全量安全、运行、审查和 Spec closeout。

## Notes

- 不创建 Task failed、Harness state、Turn、event bus、generic Artifact 或 PR verification。
- `mystra-agent` 不执行 `linctl`/`gh`；Agent prompt执行，fixture仅验证 journey。
- 任何代码 symbol/API edit 前按 AGENTS.md 运行 GitNexus impact；完成前运行 change detection。
- 当前 worktree 有 owner 的无关 dirty changes；只修改/验证 051 目标路径，禁止覆盖或全量 stage。
