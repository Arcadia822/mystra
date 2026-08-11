# Tasks: Session 发起、多消息执行与状态回报

**Input**: Design documents from `/specs/049-session-launch-framework/`
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`
**Tests**: 本功能按 TDD 实施；每个行为任务先写失败测试，再实现。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 可与同阶段其他不同文件任务并行。
- **[US1]**: 原子 launch、冻结 prompt 与首条消息。
- **[US2]**: 串行后续消息与 Provider Session 复用。
- **[US3]**: Runtime claim、执行、typed event ingest 与状态回报。
- **[US4]**: 关闭、失败、历史读取与恢复边界。

## Phase 1: Setup & Contract Reconciliation

- [x] T001 运行并记录 `RdbProvider`、`PrismaRdbProvider`、`sessionStateSchema`、`SessionEvent`、`ProviderAdapter`、`runDaemon`、`resolveSessionAttachment` 的 GitNexus upstream impact 到 `specs/049-session-launch-framework/checklists/engineering-review.md`
- [x] T002 核对并删除 pre-0.1 旧 Session/Runner/summary 合同的并行导出计划，在 `specs/049-session-launch-framework/checklists/engineering-review.md` 固化直接替换清单
- [x] T003 [P] 核对 Codex/Copilot 官方 continuation/session 命令能力与当前本地 adapter，并更新 `specs/049-session-launch-framework/research.md`
- [x] T004 [P] 运行 `git diff --check`、Spec-Kit prerequisites 与 048 attachment consistency search，更新 `specs/049-session-launch-framework/checklists.md`

---

## Phase 2: Foundational Domain, Persistence & Adapter Contracts

**Purpose**: 所有 user story 共用的唯一 Session/SessionEvent 合同、双数据库结构与 Provider session boundary。

- [x] T005 [P] 先写 Session state、launch/message input、strict typed event、payload size/redaction、无 Turn/capacity 字段测试到 `packages/shared/src/session.test.ts`
- [x] T006 实现 canonical Session/SessionEvent/runner protocol schemas 与 reducer 到 `packages/shared/src/session.ts`、`packages/shared/src/state.ts`、`packages/shared/src/events.ts` 和 `packages/shared/src/index.ts`
- [x] T007 [P] 先写 legacy single-run Session/Runner/summary export removal 回归测试到 `packages/shared/src/management.test.ts`、`packages/shared/src/schemas.test.ts` 与 `apps/control-plane/src/lib/db/removed-persistence.test.ts`
- [x] T008 直接替换旧 `SessionRecord`/terminal state/runner capacity/coordination summary 合同及死调用者到 `packages/shared/src/management.ts`、`packages/shared/src/schemas.ts`、`packages/shared/src/coordination-session-summary.ts`、`apps/control-plane/src/lib/coordination-session-summary.ts` 与对应 exports/tests
- [x] T009 [P] 先写 ProviderSessionAdapter、Codex/Copilot start/continue、providerSessionId 与进程结果映射测试到 `packages/agent-adapters/src/session.test.ts`
- [x] T010 扩展既有 adapter 而不复制 command policy，实现 ProviderSessionAdapter 到 `packages/agent-adapters/src/session.ts` 与 `packages/agent-adapters/src/index.ts`
- [x] T011 [P] 在 SQLite/PostgreSQL Prisma schema 与 parity tests 中先定义 Session、SessionEvent、SessionEventHead、SessionEventStream、SessionDispatchLease 的预期到 `apps/control-plane/src/lib/db/prisma-schema-parity.test.ts`
- [x] T012 增加双 Prisma models 与 `20260810160000_session_launch_framework` migrations 到 `apps/control-plane/prisma/sqlite/schema.prisma`、`apps/control-plane/prisma/postgresql/schema.prisma` 及各自 migrations，明确无 Turn/capacity/parallel Workspace 表
- [x] T013 生成 Prisma clients 并增加 Session/SessionEvent/Lease mappers 到 `apps/control-plane/src/lib/db/prisma-mappers.ts`
- [x] T014 [P] 先写双 provider contract：launch 四事件原子性、20 路 replay/conflict、sendMessage、claim、event batch、10k events、keyset read 到 `apps/control-plane/src/lib/db/rdb-provider.contract.ts`
- [x] T015 扩展 `RdbProvider` 领域类型与原子方法到 `apps/control-plane/src/lib/db/rdb-provider.ts`，不泄漏 Prisma 类型
- [x] T016 实现 Session create/message/read/list/claim/lease/event append/close operations 到 `apps/control-plane/src/lib/db/prisma-provider.ts`，使 SQLite contract 通过

**Checkpoint**: shared、adapter 与 RDB foundation 唯一且可独立验证。

---

## Phase 3: User Story 1 - 原子 launch 与首条消息 (Priority: P1)

**Goal**: 调用一次 canonical launch 即原子冻结全部输入并让首条消息进入 queued execution。

**Independent Test**: ready TaskWorkspace + online Runtime + available Provider + active Agent 产生一条 Session 与四条事件；失败产生零条部分记录。

- [x] T017 [P] [US1] 先写固定顺序、untrusted Context delimiter、size limit、冻结 Agent/Runtime/Provider/Task/Project snapshot 测试到 `apps/control-plane/src/lib/sessions/system-prompt-assembler.test.ts`
- [x] T018 [US1] 实现纯 system prompt assembler 到 `apps/control-plane/src/lib/sessions/system-prompt-assembler.ts`
- [x] T019 [P] [US1] 先写 launch Team/Task/Project/Agent/Runtime/Provider/Workspace 校验、transaction-before-dispatch、replay/conflict 与稳定错误测试到 `apps/control-plane/src/lib/sessions/session-service.test.ts`
- [x] T020 [US1] 实现稳定 SessionFailure code mapping 到 `apps/control-plane/src/lib/sessions/session-errors.ts`
- [x] T021 [US1] 实现 `SessionService.launch/get/listEvents` 到 `apps/control-plane/src/lib/sessions/session-service.ts`，复用 048 `resolveSessionAttachment`
- [x] T022 [US1] 接入真实 db、derived Runtime liveness、Agent resolver 与 TaskWorkspaceService 到 `apps/control-plane/src/lib/sessions/session-service-factory.ts`
- [x] T023 [US1] 增加 real migrated-SQLite launch transaction coverage 到 `apps/control-plane/src/lib/sessions/session-execution.e2e.test.ts`

**Checkpoint**: 首条 user message 不需要第二次 send 调用，且 Runtime/provider I/O 不在 launch 事务内。

---

## Phase 4: User Story 2 - 串行后续消息 (Priority: P1)

**Goal**: ready/interrupted Session 接收幂等后续消息，busy/terminal Session fail closed。

**Independent Test**: 同 Session 依次提交 3 个 messageId；20 路同 messageId 只产生一个事件，不同 payload 冲突。

- [x] T024 [P] [US2] 先写 ready、interrupted new_message、busy、terminal、cross-Team、20 路 replay/conflict 测试到 `apps/control-plane/src/lib/sessions/session-service.test.ts` 与 RDB contract
- [x] T025 [US2] 实现 `SessionService.sendMessage` 与 activeMessage projection 到 `apps/control-plane/src/lib/sessions/session-service.ts`
- [x] T026 [P] [US2] 先写同 providerSessionId 串行 continuation、abort、unsupported Provider 与 Workspace failure 测试到 `apps/runner-daemon/src/session/session-worker.test.ts`
- [x] T027 [US2] 实现单 Session worker 和 active execution release 到 `apps/runner-daemon/src/session/session-worker.ts`

**Checkpoint**: ready 是可继续稳定态；response 后 execute promise 完成但 Session 身份不终结。

---

## Phase 5: User Story 3 - Runtime claim、Provider 执行与 typed events (Priority: P1)

**Goal**: 指定 host Runtime 原子 claim，安全解析 Workspace，运行 Provider，并以至少一次方式回报 typed events。

**Independent Test**: fake Provider 从 claim 执行首条消息并回报 response events；foreign Runtime/lease、source gap、oversize/secret payload 均拒绝且不漂移 projection。

- [x] T028 [P] [US3] 先写 Runtime claim、existing lease renewal、foreign Runtime、race、expiry、provider unavailable 测试到 `apps/control-plane/src/lib/sessions/runtime-session-service.test.ts`
- [x] T029 [P] [US3] 先写 event batch lease auth、source sequence、eventId replay、state reducer、redaction/size 与 rollback 测试到 `apps/control-plane/src/lib/sessions/runtime-session-service.test.ts`
- [x] T030 [US3] 实现 `RuntimeSessionService.claim/appendEvents` 到 `apps/control-plane/src/lib/sessions/runtime-session-service.ts`
- [x] T031 [US3] 接入 runner identity、derived Runtime liveness 与 db 到 `apps/control-plane/src/lib/sessions/runtime-session-service-factory.ts`
- [x] T032 [P] [US3] 先写 authenticated claim/event HTTP route contract 测试到 `apps/control-plane/app/api/runtime-session-routes.test.ts`
- [x] T033 [US3] 实现 `POST /api/runner/sessions/claim` 到 `apps/control-plane/app/api/runner/sessions/claim/route.ts`
- [x] T034 [US3] 实现 `POST /api/runner/sessions/[sessionId]/events` 到 `apps/control-plane/app/api/runner/sessions/[sessionId]/events/route.ts`
- [x] T035 [P] [US3] 先写 HTTP client、retry/idempotent batch、lease token header 与 secret-safe errors 到 `apps/runner-daemon/src/session/session-client.test.ts`
- [x] T036 [US3] 实现 Runtime session HTTP client 到 `apps/runner-daemon/src/session/session-client.ts`
- [x] T037 [P] [US3] 先写 argv/cwd spawn、bounded output、abort、Codex/Copilot event mapping 与 missing Workspace failure 测试到 `apps/runner-daemon/src/session/provider-process.test.ts` 和 `session-worker.test.ts`
- [x] T038 [US3] 实现 safe provider child process 与 typed event mapping 到 `apps/runner-daemon/src/session/provider-process.ts`
- [x] T039 [P] [US3] 先写 daemon claim fan-out、同 Session 去重、response release、graceful shutdown 与 retry 测试到 `apps/runner-daemon/src/session/session-loop.test.ts`
- [x] T040 [US3] 实现 unbounded-by-contract session claim loop 到 `apps/runner-daemon/src/session/session-loop.ts` 并接入 `apps/runner-daemon/src/index.ts`

**Checkpoint**: host Runtime 可真实执行首消息；lease 无 slot/capacity 字段；全部 accepted event 是 typed SessionEvent。

---

## Phase 6: User Story 4 - 中断、handoff、关闭、失败与历史 (Priority: P1)

**Goal**: 中断/恢复/handoff/close/Runtime loss 都通过 event ledger 收敛，并可按 Team 分页读取。

**Independent Test**: 每种状态转换有 positive/negative test；10k events keyset 分页完整且全批 replay 新增 0 行。

- [x] T041 [P] [US4] 先写 interruption continuation、handoff、close、Runtime loss 与非法状态测试到 `packages/shared/src/session.test.ts` 和 `apps/control-plane/src/lib/sessions/session-service.test.ts`
- [x] T042 [US4] 完成 reducer 与 `SessionService.close` 到 `packages/shared/src/session.ts` 和 `apps/control-plane/src/lib/sessions/session-service.ts`
- [x] T043 [P] [US4] 先写 Team-scoped keyset pagination、messageId filter、limit clamp 与无 global feed 测试到 Session service/RDB contract
- [x] T044 [US4] 完成 SessionEvent history read 和 10k-event replay performance path 到 `apps/control-plane/src/lib/db/prisma-provider.ts` 与 `apps/control-plane/src/lib/sessions/session-service.ts`
- [x] T045 [P] [US4] 先写 expired offline lease reaper 与 no-migration failure 测试到 `apps/control-plane/src/lib/sessions/runtime-session-service.test.ts`
- [x] T046 [US4] 实现 lease expiry/runtime loss reconciliation 到 `apps/control-plane/src/lib/sessions/runtime-session-service.ts`

---

## Phase 7: Cross-Feature Integration & Verification

- [x] T047 [P] 写 048 attachment -> 049 launch -> fake Provider first response -> ready -> 两次 continuation（总计 3 messages）的真实 SQLite/HTTP E2E 到 `apps/control-plane/src/lib/sessions/session-execution.e2e.test.ts`
- [x] T048 [P] 写 interruption/resume/handoff/close/failure 与 duplicate report E2E 到 `apps/control-plane/src/lib/sessions/session-lifecycle.e2e.test.ts`
- [x] T049 运行 `package.json` 中 shared、agent-adapters、control-plane、runner 定向 tests 与 typecheck，并修复全部回归
- [x] T050 运行双 Prisma validate/generate、schema parity 与 SQLite provider contract；若缺 PostgreSQL URL，明确记录未验证项到 `specs/049-session-launch-framework/quickstart.md`
- [x] T051 使用可用的真实 Codex/Copilot CLI 至少验证一个 concrete adapter；不可用时记录 exact blocker，fake Provider E2E 不冒充真实 Provider 证据到 `specs/049-session-launch-framework/quickstart.md`
- [x] T052 更新 `apps/control-plane/src/lib/db/README.md`、`apps/runner-daemon/README.md` 与 `packages/agent-adapters/README.md`，说明 Session transaction、lease、event、Workspace 与 continuation invariants
- [x] T053 运行 `/speckit.analyze` 等价只读一致性审查，修复所有 CRITICAL/HIGH findings
- [x] T054 运行 GitNexus fresh analyze/detect changes、`git diff --check`、禁止 Turn/capacity/temporary schema search 与 feature status refresh
- [x] T055 对照 FR/SC、四个 user stories 与 050 consumer contract 完成最终 audit，在 `specs/049-session-launch-framework/checklists/engineering-review.md` 和 `specs/049-session-launch-framework/quickstart.md` 记录证据

---

## Phase 8: Owner Context Delivery Reconciliation

- [x] T056 在 `system-prompt-assembler.test.ts` 先复现 Task exact Issue reference 被 Context projection 丢弃，再由 `system-prompt-assembler.ts` 显式交付 provider、connection、scope、external ID 与 identifier；不复制或实时解析外部 Issue 正文

---

## Dependencies & Execution Order

```text
Phase 1
  -> Phase 2 shared contract
      -> RDB + adapter foundation
          -> US1 launch
              -> US2 messages
                  -> US3 Runtime execution
                      -> US4 lifecycle/history
                          -> cross-feature verification
```

- US1 依赖 Phase 2。
- US2 依赖 US1 的 SessionService 与 RDB message operation。
- US3 依赖 US1/US2 的 queued/message_pending contract 与 adapter foundation。
- US4 依赖 event ingest/reducer；history read 可在 US3 后独立验证。
- 由于 shared exports、Prisma provider 和 runner entrypoint 是高冲突文件，本 worktree 使用单 lane 顺序实现。

## Implementation Strategy

1. 先使 shared/adapter/RDB contract tests 失败，再完成 foundation。
2. 每个 user story 只在前一 checkpoint 通过后继续。
3. 先用 fake Provider 证明完整 deterministic E2E，再尝试真实 Codex/Copilot CLI。
4. 不以监听端口、静态 typecheck 或 fake adapter 代替真实 provider/runtime 证据。
