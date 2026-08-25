---
title: "Tasks：固定 Task Workflow Runtime"
taco_scope: tasks
---

**Input**: `spec.md`、`plan.md`、`research.md`、`data-model.md`、`engineering-review.md`、`contracts/`
**Test policy**: TDD；每个 story 的 tests先失败，再实现。所有HIGH/CRITICAL symbol修改前必须重跑GitNexus impact并记录结果。

## Phase 1 — Shared contracts and safety rails

- [x] T001 Run GitNexus impact for every concrete shared/database/session symbol selected by implementation and record CRITICAL/HIGH gates in `specs/057-workflow-harness-runtime/engineering-review.md`
- [x] T002 [P] Add failing fixed-definition graph/schema tests in `packages/shared/src/workflow.test.ts`
- [x] T003 [P] Add failing prompt component order and capability allowlist tests in `packages/shared/src/session.test.ts` and `packages/shared/src/task-execution-context.test.ts`
- [x] T004 Define strict fixed Workflow state/action/context/error/projection schemas in `packages/shared/src/workflow.ts`
- [x] T005 Extend shared Session prompt evidence and execution capability schemas without changing inactive-Workflow output in `packages/shared/src/session.ts` and `packages/shared/src/task-execution-context.ts`
- [x] T006 Implement the program-owned definition and invariant validation in `apps/control-plane/src/lib/workflows/fixed-workflow-definition.ts`

**Checkpoint**: Fixed graph、bounded fields、component ordering和capability vocabulary由shared tests固定；不存在resource/plugin types。

## Phase 2 — Persistence foundation (blocking)

- [x] T007 [P] Add failing SQLite/PostgreSQL provider contract cases for active uniqueness、re-enable identity、CAS、replay、revocation、source aggregation and stale reports in `apps/control-plane/src/lib/db/rdb-provider.contract.ts`
- [x] T008 [P] Add failing Prisma schema parity assertions for all Feature 057 models/indexes in `apps/control-plane/src/lib/db/prisma-schema-parity.test.ts`
- [x] T009 Add `TaskWorkflowState`、`TaskWorkflowTransition`、`SessionWorkflowCapability`、`WorkspaceSkillSource` and `WorkspaceSkillProjection` to both Prisma schemas and pre-0.1 migrations under `apps/control-plane/prisma/{sqlite,postgresql}/`
- [x] T010 Add exact domain records/mappers and narrow RdbProvider methods in `apps/control-plane/src/lib/db/rdb-provider.ts` and `apps/control-plane/src/lib/db/prisma-mappers.ts`
- [x] T011 Implement enable/disable/CAS/replay/capability/source-generation transactions in `apps/control-plane/src/lib/db/prisma-provider.ts`
- [x] T012 Prove 20-way same-version transition has at most one success on both providers in `apps/control-plane/src/lib/db/rdb-provider.contract.ts`
- [x] T013 Run full RdbProvider contracts and schema parity; resolve every unrelated regression before leaving the foundational phase

**Checkpoint**: Authoritative state、audit、exact Session binding和desired Skill generation均可在SQLite/PostgreSQL验证。

## Phase 3 — User Story 1: enable/disable fixed Workflow (P1)

**Goal**: Owner/Admin显式管理唯一 fixed Workflow，不修改Task schema，不出现Resource/replace/routing。

**Independent test**: Enable initializes `understand`; replay/idempotent active enable does not reset; disable revokes old capabilities and sources; re-enable creates new state identity。

- [x] T014 [P] [US1] Add failing RBAC/Team/Skill-preflight/idempotency service tests in `apps/control-plane/src/lib/workflows/workflow-management-service.test.ts`
- [x] T015 [P] [US1] Add failing management route tests in `apps/control-plane/app/api/task-workflow-routes.test.ts`
- [x] T016 [P] [US1] Add failing thin operator CLI and MCP mapping tests in `apps/control-plane/src/lib/operator-cli.test.ts` and `apps/control-plane/src/lib/mcp/server.test.ts`
- [x] T017 [US1] Implement `WorkflowManagementService` and factory with Owner/Admin enforcement and fixed Skill preflight in `apps/control-plane/src/lib/workflows/`
- [x] T018 [US1] Implement canonical enable/disable routes in `apps/control-plane/app/api/tasks/[id]/workflow/{enable,disable}/route.ts`
- [x] T019 [US1] Add thin `mystra` CLI and remote MCP adapters; expose no list/resource/replace/switch surface
- [x] T020 [US1] Verify 20-way concurrent enable creates at most one active state, and disable cleanup failure remains partial success while logical revocation/state remain committed

**Checkpoint**: US1可独立从management API/CLI/MCP验证，Member/workload/Runner全部fail closed。

## Phase 4 — User Story 2: current and transition (P1)

**Goal**: Exact Session workload无需任何对象ID即可读取/推进固定Stage。

**Independent test**: current返回full context；合法edges生效；invalid/concurrent/replay/expired/re-enabled-old-session均正确拒绝。

- [x] T021 [P] [US2] Add failing workload resolution/current/transition tests in `apps/control-plane/src/lib/workflows/workflow-workload-service.test.ts`
- [x] T022 [P] [US2] Add failing workload route tests for auth、no-ID input、errors and redaction in `apps/control-plane/app/api/agent-workflow-routes.test.ts`
- [x] T023 [P] [US2] Add failing parser/client/exit-code/retry-identity tests in `packages/agent-cli/src/cli.test.ts` and `packages/agent-cli/src/client.test.ts`
- [x] T024 [US2] Extend exact execution resolve to require bound active `SessionWorkflowCapability` in `apps/control-plane/src/lib/tasks/agent-execution-service.ts`
- [x] T025 [US2] Implement `FixedWorkflowRuntime` internal seam and `WorkflowWorkloadService` current/transition paths in `apps/control-plane/src/lib/workflows/`
- [x] T026 [US2] Implement canonical current/transition routes in `apps/control-plane/app/api/agent-execution/workflow/{current,transition}/route.ts`
- [x] T027 [US2] Add static `mystra-agent workflow current/transition/help` parser/client output and stable exit classifications in `packages/agent-cli/src/`
- [x] T028 [US2] Verify same-command replay, different-payload conflict, invalid Action, terminal Stage, 20-way CAS, disable race, scope mismatch and expired capability; prove a test fixed-runtime substitute can replace prompt/command/Skill contributions without changing transport callers

**Checkpoint**: US2可独立用execution code验证；server从不按Task fallback或在new Stage自动重放Action。

## Phase 5 — User Story 3: prompt and Skill projection (P1)

**Goal**: New Session获得static Workflow guidance；Runner/CLI把exact desired Skills安全物化并可收敛恢复。

**Independent test**: active/inactive prompt evidence正确；initial projection precedes Provider；transition diff/source retention/failure recovery/disable cleanup均可验证。

- [x] T029 [P] [US3] Add failing prompt assembler/session launch tests for component order、frozen evidence、inactive identity and exact state binding in `apps/control-plane/src/lib/sessions/{system-prompt-assembler,session-service}.test.ts`
- [x] T030 [P] [US3] Add failing projection service tests for fixed-name resolution、exact Revision、source merge/conflict、generation and partial failure in `apps/control-plane/src/lib/workflows/workflow-skill-projection-service.test.ts`
- [x] T031 [P] [US3] Add failing Runner/CLI adversarial materializer fixtures for traversal、symlink、hash/size、atomic swap、stale staging、cwd marker and shared-source retention in `apps/runner-daemon/src/session/skill-materializer.test.ts` and `packages/agent-cli/src/workflow-materializer.test.ts`
- [x] T032 [P] [US3] Add failing lease/execution-scoped Skill download/report route tests in `apps/control-plane/app/api/workflow-skill-projection-routes.test.ts`
- [x] T033 [US3] Add optional `workflow` prompt component and atomic Session capability creation in `apps/control-plane/src/lib/sessions/system-prompt-assembler.ts` and `apps/control-plane/src/lib/sessions/session-service.ts`
- [x] T034 [US3] Implement exact source resolution/generation/report service by reusing Feature 056 Skill query/content contracts in `apps/control-plane/src/lib/workflows/workflow-skill-projection-service.ts`
- [x] T035 [US3] Extend Session claim assignment and scoped binary endpoints without exposing object keys in `packages/shared/src/session.ts` and `apps/control-plane/app/api/runner/sessions/[id]/skills/`
- [x] T036 [US3] Implement bounded shared materialization rules in Runner and agent-cli modules without introducing a filesystem Skill provider fallback
- [x] T037 [US3] Gate Provider start on initial projection and reconcile continuation assignments in `apps/runner-daemon/src/session/session-worker.ts`
- [x] T038 [US3] Make current/transition CLI reconcile/report returned generation while preserving the same transition command ID across retries
- [x] T039 [US3] Verify post-transition failure keeps committed Stage，next current repairs same generation，and disable removes only Workflow sources

**Checkpoint**: Prompt、CLI authority、logical desired sources和physical Workspace evidence converge to one Stage，without cross-system transaction。

## Phase 6 — Cross-story integration and hardening

- [x] T040 Add full enable -> launch -> current -> transitions -> failure recovery -> disable -> re-enable e2e in `apps/control-plane/src/lib/sessions/workflow-execution.e2e.test.ts`
- [x] T041 [P] Add bounded latency/no-Workflow-zero-object-I/O benchmarks in `apps/control-plane/src/lib/workflows/workflow-performance.test.ts`
- [x] T042 [P] Add security regression tests proving no execution code、object key、absolute path、Skill content or cross-Team existence leaks into prompt/events/errors/log payloads
- [x] T043 Run SQLite and PostgreSQL/Supabase-backed PostgreSQL relevant suites and record evidence in `specs/057-workflow-harness-runtime/quickstart.md`
- [x] T044 Run `pnpm typecheck`、`pnpm test`、`pnpm lint` and all targeted runner/CLI/e2e suites; fix every scoped failure
- [x] T045 Run GitNexus `detect_changes` against `main`; inspect all affected processes and reconcile any unexpected scope
- [x] T046 Run Spec-Kit analyze/status and targeted consistency searches for forbidden Harness/Resource/plugin/UI scope
- [x] T047 Refresh the canonical Taco, process all open comments, and rerun affected static checks before merge-ready handoff

## Dependencies

```text
Phase 1 shared contracts
        |
        v
Phase 2 persistence foundation
        |
        +--------> US1 management
        |
        +--------> US2 workload
        |              |
        +--------> US3 prompt/projection
                       |
                       v
              cross-story e2e/hardening
```

- Phase 2 blocks all stories。
- US2 requires active state/capability from US1 contracts, but its service tests may use fixtures。
- US3 depends on state/source generation and exact workload binding；projection unit/materializer tests can run in parallel。
- No story may add generic Harness abstractions to “unblock” another story。

## Parallel Opportunities

- T002/T003；T007/T008；each story's failing test groups；T029-T032；T041/T042。
- SQLite/PostgreSQL contract executions may run in parallel after schemas are generated。
- Files touching `rdb-provider.ts`、`prisma-provider.ts`、`session-service.ts` or shared schemas must be serialized due to HIGH/CRITICAL blast radius。

## Delivery Strategy

Minimum usable increment requires US1+US2+US3 because enable without workload authority, or CLI without prompt/Skills, would create multiple disagreeing facts。Deliver in small verified slices but do not label the feature complete until the entire fixed Workflow journey passes。
