# Tasks: 标准执行提示词与可选 Agent 上下文

**Input**: `spec.md`、`plan.md`、`research.md`、`data-model.md`、`contracts/`、`quickstart.md`
**Tests**: 本规格明确要求 contract、race、历史冻结、adapter一致性与真实 journey，因此测试任务均先于实现任务。
**Organization**: 按 US1 无 Agent默认路径、US2 可选 Agent Context、US3 历史审查组织；当前未提交051基线和共享nullable合同使实现保持单工作树顺序推进。

## Format: `[ID] [P?] [Story] Description`

- `[P]` 只表示不同文件且不依赖未完成实现；本期不建议拆到并行worktree。
- `[US1]` 无需配置 Agent直接开始生产。
- `[US2]` 选择自定义 Agent作为补充上下文。
- `[US3]` 复核每次执行实际使用的提示词。

## Phase 1: Setup

**Purpose**: 冻结当前051未提交基线并建立052验证入口。

- [x] T001 运行并记录 051 focused baseline（shared、control-plane、agent-cli、runner）到 `specs/052-standard-agent-context/checklists/verification.md`
- [x] T002 [P] 为052新增术语与default/sentinel Agent禁用审计脚本测试到 `scripts/audit-task-session-terminology.test.ts`
- [x] T003 [P] 在 `apps/control-plane/src/lib/db/prisma-schema-parity.test.ts` 增加 Harness/Session nullable Agent字段和双schema一致性失败断言

**Checkpoint**: 051当前基线结果可追溯；052预期schema变化已有失败测试。

---

## Phase 2: Foundational — shared contracts 与 RDB nullable model

**Purpose**: 建立所有user story共同依赖的 Standard Prompt evidence、optional Agent snapshot和atomic Start持久化。

**CRITICAL**: 本阶段完成前不得修改API/CLI/MCP/Web adapter。

- [x] T004 [P] 在 `packages/shared/src/harness.test.ts` 写 omitted/null/UUID/empty Agent Start input、Harness全有或全无snapshot、workload `agentContext:null|identity`失败测试
- [x] T005 [P] 在 `packages/shared/src/session.test.ts` 写 nullable Session Agent、created event和4..5段prompt evidence顺序/refinement失败测试
- [x] T006 在 `packages/shared/src/harness.ts` 与 `packages/shared/src/session.ts` 实现 canonical Start、optional Agent snapshot、workload identity和Effective System Prompt Evidence schema，并更新 `packages/shared/src/index.ts`
- [x] T007 在 `apps/control-plane/src/lib/db/rdb-provider.contract.ts` 写100-case无 Agent matrix、atomic Start、null/omitted replay、null→UUID conflict、20-way race及optional snapshot scope失败测试
- [x] T008 在 `apps/control-plane/prisma/sqlite/schema.prisma` 与 `apps/control-plane/prisma/postgresql/schema.prisma` 将 Harness/Session Agent关系改为nullable并为Harness增加nullable frozen name字段
- [x] T009 在 `apps/control-plane/prisma/sqlite/migrations/20260812090000_standard_agent_context/migration.sql` 与 `apps/control-plane/prisma/postgresql/migrations/20260812090000_standard_agent_context/migration.sql` 直接替换pre-0.1关系，不增加default/sentinel数据
- [x] T010 在 `apps/control-plane/src/lib/db/rdb-provider.ts` 定义nullable Agent Start command与snapshot invariants
- [x] T011 在 `apps/control-plane/src/lib/db/prisma-mappers.ts`、`apps/control-plane/src/lib/db/prisma-provider.ts`、`apps/control-plane/src/lib/db/prisma-client.ts` 实现nullable mapping、transaction-time optional Agent snapshot冻结和一致性检查
- [x] T012 运行 `corepack pnpm --filter @mystra/control-plane db:generate` 并更新受影响的generated Prisma client artifacts
- [x] T013 运行shared、RDB provider、SQLite与schema parity focused tests并把结果写入 `specs/052-standard-agent-context/checklists/verification.md`

**Checkpoint**: 无 Agent attempt已能被shared/RDB原子表达；显式Agent仍必须在同一transaction内冻结。

---

## Phase 3: User Story 1 — 无需配置 Agent直接开始生产 (Priority: P1)

**Goal**: 零 Agent Team可通过API、operator CLI、MCP和Web Start production，创建唯一Harness/Session并应用Standard Execution Prompt。

**Independent Test**: 建立没有Agent的Team和eligible Project-bound Task，分别通过四个adapter Start；验证同一canonical request、`agentContext:null`、唯一Harness/Session、标准prompt evidence和idempotent replay。

### Tests for User Story 1

- [x] T014 [P] [US1] 在 `apps/control-plane/src/lib/sessions/system-prompt-assembler.test.ts` 写Standard Prompt内容寻址version、无Agent固定component顺序、缺失/超限fail-closed golden tests
- [x] T015 [P] [US1] 在 `apps/control-plane/src/lib/sessions/session-service.test.ts` 写无Agent普通Task launch与Harness launch、历史prompt冻结和continue不重复注入失败测试
- [x] T016 [P] [US1] 在 `apps/control-plane/src/lib/tasks/task-production-service.test.ts` 写无Agent eligibility、replay、Workspace ready continuation和Session唯一性失败测试
- [x] T017 [P] [US1] 在 `apps/control-plane/app/api/task-production-routes.test.ts` 写 `/production/start` omitted/null成功、empty失败并断言旧 `/assign`不存在
- [x] T018 [P] [US1] 在 `scripts/operator-cli.test.ts` 写 `mystra tasks start` 无 `--agent-context-id`的request/JSON/error contract测试
- [x] T019 [P] [US1] 在 `apps/control-plane/app/api/mcp/route.test.ts` 写 `mystra_start_task_production` tool schema、auth与无Agent调用测试
- [x] T020 [P] [US1] 在 `apps/control-plane/app/_components/task-detail-model.test.ts` 与 `apps/control-plane/app/_components/shell-model.test.ts` 写0 active Agent不显示selector且Start可用的UI model测试

### Implementation for User Story 1

- [x] T021 [US1] 在 `apps/control-plane/src/lib/sessions/standard-execution-prompt.ts` 实现程序拥有prompt与SHA-256版本，并在 `apps/control-plane/src/lib/sessions/system-prompt-assembler.ts` 建立唯一ordered assembly path
- [x] T022 [US1] 在 `apps/control-plane/src/lib/sessions/session-service.ts` 将Task/Harness Session launch改为optional Agent并原子冻结prompt evidence
- [x] T023 [US1] 在 `apps/control-plane/src/lib/tasks/task-production-service.ts` 与 `apps/control-plane/src/lib/tasks/task-production-service-factory.ts` 将canonical操作替换为 `start`并保持Workspace continuation
- [x] T024 [US1] 删除 `apps/control-plane/app/api/tasks/[id]/production/assign/route.ts`，新增 `apps/control-plane/app/api/tasks/[id]/production/start/route.ts` 调用canonical service
- [x] T025 [US1] 在 `scripts/operator-cli.mjs` 增加 `mystra tasks start`薄adapter，缺省不发送Agent字段
- [x] T026 [US1] 在 `apps/control-plane/app/api/mcp/route.ts` 增加 `mystra_start_task_production`薄tool并复用shared schema/service error
- [x] T027 [US1] 在 `apps/control-plane/app/_components/task-production-panel.tsx` 将动作改为Start；0 Agent时隐藏selector且不再以Agent阻断按钮
- [x] T028 [US1] 运行US1 service/API/CLI/MCP/UI focused tests并更新 `specs/052-standard-agent-context/checklists/verification.md`

**Checkpoint**: 没有任何Agent数据的Team可完成默认Start路径；所有入口无default/sentinel fallback。

---

## Phase 4: User Story 2 — 用自定义 Agent补充执行上下文 (Priority: P1)

**Goal**: 显式选择active Team Agent时冻结一致revision/name/prompt，并在Standard Prompt之后作为低优先级补充上下文；无效选择不降级。

**Independent Test**: 选择Agent revision 3 Start后立即更新/归档Agent；原Harness/Session保持revision 3，新的选择解析revision 4或因archived失败，且两者的Standard Prompt version相同。

### Tests for User Story 2

- [x] T029 [P] [US2] 在 `apps/control-plane/src/lib/db/rdb-provider.contract.ts` 增加100-case selected Agent snapshot matrix、Agent update/archive并发冻结、foreign/unknown/archived失败与snapshot成对invariant测试
- [x] T030 [P] [US2] 在 `apps/control-plane/src/lib/sessions/system-prompt-assembler.test.ts` 写冲突Agent文本仍位于standard/runtime/provider之后、明确标签且不能替换finalPrompt其他组件的golden test
- [x] T031 [P] [US2] 在 `apps/control-plane/src/lib/tasks/agent-execution-service.test.ts` 写optional Agent Context identity、scope mismatch和status actor nullable测试
- [x] T032 [P] [US2] 在 `packages/agent-cli/src/cli.test.ts` 与 `packages/agent-cli/src/journey.test.ts` 写 `agentContext:null|identity` parse/print journey测试
- [x] T033 [P] [US2] 在 `apps/runner-daemon/src/session/session-worker.test.ts` 与 `packages/agent-adapters/src/session.test.ts` 写Runner只传evidence.finalPrompt、无Agent-specific override/env的回归测试

### Implementation for User Story 2

- [x] T034 [US2] 在 `apps/control-plane/src/lib/db/prisma-provider.ts` 完成显式Agent transaction-time active/Team冻结与replay intent比较
- [x] T035 [US2] 在 `apps/control-plane/src/lib/sessions/system-prompt-assembler.ts` 组装nullable Agent Context snapshot并保持固定优先级
- [x] T036 [US2] 在 `apps/control-plane/src/lib/tasks/agent-execution-service.ts` 将execution identity/scope检查改为明确optional Agent Context
- [x] T037 [US2] 在 `packages/agent-cli/src/client.ts`、`packages/agent-cli/src/cli.ts` 与相关schema消费处支持nullable Agent Context
- [x] T038 [US2] 在 `apps/control-plane/src/lib/sessions/runtime-session-service.ts`、`apps/runner-daemon/src/session/session-worker.ts` 与 `packages/agent-adapters/src/session.ts` 校验并保持finalPrompt-only handoff
- [x] T039 [US2] 在 `apps/control-plane/app/_components/task-production-panel.tsx` 为存在active Agent的场景显示默认None的“Optional Agent Context”控件
- [x] T040 [US2] 运行US2 RDB/session/workload/Runner focused tests并更新 `specs/052-standard-agent-context/checklists/verification.md`

**Checkpoint**: 自定义Agent只补充Standard Prompt；Agent变更不会改写历史attempt；无效显式选择fail closed。

---

## Phase 5: User Story 3 — 复核实际提示词 (Priority: P2)

**Goal**: Reviewer从Task production与Session history看到Standard Prompt version、optional Agent name/ID/revision或明确的无Agent状态。

**Independent Test**: 创建无Agent和有Agent两个Session，修改program prompt fixture/Agent后读取旧Session；验证冻结evidence逐字不变，projection不查询当前Agent来重写历史。

### Tests for User Story 3

- [x] T041 [P] [US3] 在 `apps/control-plane/src/lib/tasks/task-production-service.test.ts` 写production review projection读取frozen evidence而非当前Agent的测试
- [x] T042 [P] [US3] 在 `apps/control-plane/app/_lib/task-view.test.ts` 与 `apps/control-plane/app/_components/task-detail-model.test.ts` 写standard version与optional Agent evidence presentation测试
- [x] T043 [P] [US3] 在 `apps/control-plane/src/lib/sessions/session-execution.e2e.test.ts` 写prompt/Agent更新前后旧新Session证据不变/变化测试

### Implementation for User Story 3

- [x] T044 [US3] 在 `apps/control-plane/src/lib/tasks/task-production-service.ts` 与 `apps/control-plane/app/api/tasks/[id]/production/route.ts` 增加bounded frozen prompt evidence projection
- [x] T045 [US3] 在 `apps/control-plane/app/_lib/task-view.ts` 与 `apps/control-plane/app/_components/task-production-panel.tsx` 展示Standard Prompt version和Optional Agent Context evidence
- [x] T046 [US3] 在 `apps/control-plane/app/_components/session-presentation.ts` 与 `apps/control-plane/app/_components/session-presentation.test.ts` 保持prompt evidence结构化展示且不暴露可编辑入口
- [x] T047 [US3] 运行US3 projection/presentation/Session E2E focused tests并更新 `specs/052-standard-agent-context/checklists/verification.md`

**Checkpoint**: 历史执行可解释，明确区分未选择Agent与数据损坏。

---

## Phase 6: Polish & Cross-Cutting Verification

**Purpose**: 同步durable contract，完成全量/真实证据与graph-aware review。

- [x] T048 [P] 将Agent可选与Standard Prompt durable规则同步到 `.specify/memory/constitution.md`、`PRODUCT.md`、`PLATFORM.md`、`PROCESS.md`、`AGENTS.md` 与相关051/049 supersession说明
- [x] T049 [P] 更新 `apps/runner-daemon/README.md`、`packages/agent-cli/README.md` 或最小相邻文档，说明execution code标识attempt且Agent Context可缺席
- [x] T050 运行 `scripts/audit-task-session-terminology.mjs` 与052 default/sentinel Agent审计并修复所有旧“Assign Agent/default Agent”默认路径措辞
- [x] T051 运行 `corepack pnpm --filter @mystra/shared test`、control-plane focused suites、agent-cli、runner-daemon与agent-adapters测试
- [x] T052 在真实 `MYSTRA_TEST_POSTGRES_URL`存在时运行PostgreSQL provider contract；未提供则在 `specs/052-standard-agent-context/checklists/verification.md` 明确标记未验证
- [x] T053 运行 `corepack pnpm typecheck`、`corepack pnpm test`、`corepack pnpm build` 与 `git diff --check`
- [x] T054 按 `specs/052-standard-agent-context/quickstart.md` 启动本地Control Plane与host Runner，运行无Agent与有Agent真实HTTP journey，并在 `specs/052-standard-agent-context/checklists/verification.md` 记录命令、时间、Task/Harness/Session ID、prompt version与结果
- [x] T055 运行 `gitnexus_detect_changes`、project-local `code-review-and-quality`，修复scope外影响或评审发现
- [x] T056 更新 `specs/052-standard-agent-context/checklists/verification.md`、重新渲染 `specs/052-standard-agent-context/index.html` 并运行052 status/Spec-Kit health检查

---

## Dependencies & Execution Order

### Phase Dependencies

- Phase 1建立baseline，可立即执行。
- Phase 2依赖Phase 1，阻塞全部user story。
- US1依赖Phase 2，建立无Agent canonical Start与Standard Prompt。
- US2依赖US1的assembly和adapter shape，再增加显式Agent snapshot。
- US3依赖US1/US2已有两种evidence。
- Polish依赖全部user story。

### User Story Dependencies

```text
Setup -> Foundation -> US1 no-Agent Start -> US2 optional Agent Context
                                          -> US3 frozen review evidence
US2 + US3 -> Full verification/closeout
```

### Parallel Opportunities

- T002/T003可并行起草，但实现仍顺序合并。
- 每个story内部标记 `[P]` 的测试可在对应前置contract稳定后并行编写。
- 不并行修改 `packages/shared`、Prisma schema、`PrismaRdbProvider`、`SessionService`或`TaskProductionService`。

---

## Implementation Strategy

### MVP First

1. 完成Phase 1/2。
2. 完成US1，证明零Agent Team可Start并运行Standard Prompt。
3. 运行US1 checkpoint；若失败，不进入Agent叠加和presentation。

### Incremental Delivery

1. Foundation：nullable model与atomic Start。
2. US1：default no-Agent production journey。
3. US2：explicit Optional Agent Context。
4. US3：frozen evidence review。
5. 全量、真实journey、code review与Spec-Kit closeout。

### Sequential Worktree Strategy

当前051实现尚未提交且052会修改同一批shared/RDB/session文件。保持一个工作树、逐task验证，避免多个分支各自解释nullable contract后再制造合并实验。

---

## Notes

- 每个实现任务前对将修改的symbol运行GitNexus upstream impact；HIGH/CRITICAL先告知owner。
- 测试必须先失败，再实现；不因现有051测试通过而跳过052 negative cases。
- 不创建default/sentinel Agent，不保留 `/assign` alias，不做pre-0.1 migration shim。
- 未实际运行PostgreSQL、HTTP或Runner时不得把相应证据标为已验证。
