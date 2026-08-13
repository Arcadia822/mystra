# 实施计划：薄 Task 生产状态机与 mystra-agent CLI

**分支**: `051-factory-task-harness` | **日期**: 2026-08-11 | **规格**: [spec.md](./spec.md)

## 摘要

051 在现有 047–050 Task、Workspace、Session、Runtime 基础上增加一条最薄的生产路径：Human 对 pending Task 执行 Assign/Start，在一个短 RDB 事务中写入 `pending -> in_progress` 和唯一 Harness attempt；事务提交后复用 048 的 Task Workspace preparation；Workspace ready 时幂等创建该 Harness 唯一的 049 Session。Harness 冻结 Agent revision、system prompt 与 Task 输入，但不拥有第二套状态机。

Agent workload 通过独立的 `mystra-agent` CLI 使用 attempt-scoped execution code 读取当前 identity/context，并仅通过专用 `TaskStatusService` 报告 `blocked`、恢复 `in_progress` 或声明 `waiting_for_review`。execution code 在 Runtime claim 时一次性签发，数据库只保存 SHA-256 hash，并与 Session lease、Harness revocation 和过期时间共同校验。Agent 仍使用宿主机已认证的 `linctl` 读取 Linear、使用 `gh` push/create PR；Mystra 不代理、授权或验证这些命令与声明。

## 技术上下文

- **语言/运行时**: TypeScript 5.9、Node.js 24.14.0。
- **主要依赖**: Next.js 16 Route Handlers、React 19、Zod 4、Prisma 7.9.1、Vitest 4、Node `crypto`/`child_process`；既有 `@mystra/shared`、`@mystra/agent-adapters`、`mystra-runner`。
- **存储**: SQLite 与 PostgreSQL/Supabase-backed PostgreSQL，通过 `RdbProvider` 暴露相同领域合同。
- **测试**: Vitest unit/contract/integration/E2E；fixture `linctl`/`gh` 可执行文件；真实 HTTP 与 host Runner smoke test。
- **目标平台**: self-hosted single-node Control Plane + host-bound TypeScript Runner；Web 为次要 Human client，CLI/API 为主要合同。
- **性能目标**: Task list读取 current projection，history/capability lookup走有界分页与索引；Assign/Start RDB事务不执行网络或文件系统 I/O；每个 Task第一版最多一个 Harness、一个 Harness最多一个 Session。
- **约束**: capability 明文只存在于 claim response 与 workload environment；不得进入 prompt、普通日志、状态 note 或持久化；Task/Session 状态完全解耦；pre-0.1 直接替换旧合同，无兼容 shim。
- **范围**: Task schema/status/history、Harness persistence、Human production API/UI、workload API、`mystra-agent` package、Runner environment 注入、Workspace-ready continuation 和一个完整 happy/blocked/review journey。

## Constitution Check

### 规划前 gate

- **5xP 与 Spec-Kit**: PASS。051 已同步 PRODUCT/PLATFORM/PROCESS/AGENTS/constitution，feature artifacts 保持在 `specs/051-factory-task-harness/`。
- **边界复用**: PASS。复用 047 Task context、048 Task Workspace、049 Session launch/claim、050 Task surface；不引入 parallel Workspace、Turn、Workflow DSL 或 Harness 状态机。
- **Provider/RDB 隔离**: PASS。双 Prisma schema 通过 `RdbProvider` 统一；Prisma 类型不越过 DB 模块。
- **安全与授权**: PASS。Human 使用现有 Team auth/RBAC；workload 使用独立 capability；Agent CLI 无任意 Task ID；外部 CLI credential 不进入 Control Plane。
- **事务边界**: PASS。Assign/Start 只包含数据库状态与 Harness 创建；Workspace、Git、Runtime、Provider I/O 均在提交后。
- **验证纪律**: PASS。先写 schema/service contract tests，再实现；完成前执行聚焦测试、全量 typecheck/build、真实 HTTP/Runner smoke 和 graph-aware review。

### Phase 1 设计后复核

- execution code 采用 claim-time opaque token + persisted hash，解决一次性交付、过期和显式吊销，不需要新增 secret store 或 JWT signing key。
- `TaskExecutionContext.workspace.root` 由 workload-local CLI 使用真实 `process.cwd()` 合成；Control Plane 只提供 Workspace logical identity/branch，保持 Runtime-private path 边界。
- Harness 冻结 Agent system prompt 与 Task title/description，避免 Agent 或 Task 在 Workspace 异步准备期间变化导致 Session 输入漂移。
- Workspace ready continuation 使用 Harness 预分配的 `sessionId` 和 `firstMessageId`，依赖现有 Session create idempotency，重复 ready report 不产生第二 Session。

所有 gate 继续 PASS；没有需要豁免的 constitution violation。

## 已有能力与改动边界

| 已有能力 | 051 的扩展 |
| --- | --- |
| `Task` CRUD 与 immutable Project/Issue references | 增加 production projection、history 与 dedicated transition service |
| `TaskWorkspaceService.setup` + Runner preparation/report | Assign 后调用 setup；ready report 后触发 Harness continuation |
| `SessionService.launch` 与 idempotent `createSessionWithEvents` | 增加使用 Harness-frozen Agent/Task 输入的 launch 路径 |
| `RuntimeSessionService.claim` + `SessionDispatchLease` | claim 时为 Harness Session 生成 execution code hash/expiry并返回明文一次 |
| Runner Provider command environment merge | 注入 Control Plane URL、execution code，并确保 `mystra-agent` 在 PATH |
| Task detail + Workspace/Sessions panels | 增加 Assign/Start、production status/history 和 Human review controls |
| root `scripts/operator-cli.mjs` | 保持为 Control Plane operator CLI；新增独立 `packages/agent-cli` |

## 关键数据流

```text
Human Assign/Start
  -> TaskProductionService.assignStart
     -> validate Team Task + active Agent snapshot + online Runtime/provider
     -> RDB tx: Task pending->in_progress + transition + Harness(frozen inputs + plannedSessionId)
  -> commit
  -> TaskWorkspaceService.setup
     -> queued: Runner materializes repository
     -> already ready: continue immediately
     -> failed: persist Harness setup diagnostic; Task stays in_progress

Runner workspace report ready (same attempt/payload replay is idempotent)
  -> WorkspacePreparationService.report
  -> TaskProductionService.continueReadyWorkspace
     -> attach Workspace to Harness
     -> SessionService.launchHarness(planned session/message IDs)
     -> attach created unique Session to Harness.sessionId

Runner claims Harness Session
  -> RDB tx: SessionDispatchLease + executionCodeHash/expiresAt
  -> claim response includes executionCode plaintext once
  -> runner process env: MYSTRA_CONTROL_PLANE_URL + MYSTRA_EXECUTION_CODE
  -> Agent executes standardized bootstrap prompt
     -> mystra-agent context get
     -> linctl read
     -> code + tests
     -> gh push/pr
     -> mystra-agent task status set waiting_for_review | blocked
```

## 状态与权限

```text
pending --Human Assign/Start--> in_progress
in_progress --Agent-----------> blocked
blocked --Agent/Human---------> in_progress
in_progress --Agent-----------> waiting_for_review
waiting_for_review --Human----> in_progress | done
nonterminal --Human-----------> canceled
```

`done`/`canceled` 终态。Session `failed|ready|closed` 不修改 Task；Task 状态修改也不启动、停止或重试 Session。Human `done|canceled` 同一状态事务吊销 Harness execution capability；其他状态迁移只更新 Task projection/history。

## 模块边界

```text
packages/shared/src/
├── task.ts                       # productionStatus/projection/transition contracts
├── harness.ts                    # Harness, assignment, execution context/capability schemas
├── session.ts                    # optional Harness execution claim envelope
└── index.ts

packages/agent-cli/
├── src/cli.ts                    # mystra-agent argv/env/stdout/stderr boundary
├── src/client.ts                 # workload HTTP adapter
└── src/*.test.ts

apps/control-plane/
├── prisma/{sqlite,postgresql}/   # Task projection, Harness, transition, lease capability
├── src/lib/db/                   # RdbProvider + Prisma transaction implementation
├── src/lib/tasks/                # TaskStatusService + TaskProductionService
├── src/lib/sessions/             # frozen Harness launch + claim capability
├── src/lib/task-workspaces/      # ready continuation hook
├── app/api/tasks/[id]/production/*
├── app/api/agent-execution/*     # execution-code-only workload surface
└── app/tasks/[id]/*              # production status/assignment/review UI

apps/runner-daemon/src/
├── index.ts                      # Control Plane URL and CLI path wiring
└── session/*                     # execution code handoff and child env merge
```

**结构决策**: `mystra-agent` 是独立 workspace package 和 binary，不污染 Control Plane management CLI。Runner 声明该 package 为运行时依赖，并把其 bin directory prepend 到 Provider child `PATH`；部署 runner 即同时部署 workload helper。API、CLI 和 UI 都调用同一 application services，不复制状态迁移逻辑。

## 持久化与事务顺序

1. Assign/Start 前读取并验证 Task、Project、active Agent snapshot、Runtime/provider capability。
2. 一个 RDB 事务验证 Task `pending`、expected revision 和 idempotency，写 Task projection、TaskStatusTransition、Harness；Harness 保存非外键 `plannedSessionId`/`firstMessageId` 并冻结 Agent/Task/Issue输入，实际 `sessionId` 保持 null。
3. 提交后调用现有 Workspace setup。失败把 bounded setup failure code/message 写入 Harness，Task 保持 `in_progress`，不伪造 blocked。
4. 同一个 Workspace preparation attempt 的同 payload completion 是幂等命令；ready continuation 原子绑定 Harness.workspaceId，再用 `plannedSessionId` 作为 Session create ID执行 frozen launch；成功后把 actual `sessionId` 绑定 Harness。相同 ID/payload replay 返回原 Session，不同 attempt/payload 仍 fail closed。
5. Runtime claim 事务在 Session lease 上保存 execution code hash/expiry；明文只在 claim response 中返回。
6. workload API 对 code hash、expiry、revocation、Harness/Session/Task/Agent revision scope 做全量校验后读取 context 或调用 TaskStatusService。
7. 状态迁移事务以 `(taskId, idempotencyKey)` 判重，以 expectedRevision 防并发，写 projection + append-only transition；终态同时写 Harness capability revocation。

## API 与 CLI

- Human API: `POST /api/tasks/{taskId}/production/assign`、`GET /api/tasks/{taskId}/production`、`POST /api/tasks/{taskId}/production/status`。
- Workload API: `GET /api/agent-execution/whoami`、`GET /api/agent-execution/context`、`GET|POST /api/agent-execution/task-status`；只接受 Bearer execution code。
- CLI: `mystra-agent whoami|context get|task status get|task status set ...`；JSON stdout、稳定错误 JSON stderr、成功 0/输入或服务错误非 0。
- Runner protocol: `SessionClaimAssignment.execution` 为可选；只有关联 Harness 的 Session 才返回 `{ code, expiresAt, capabilities }`。

详细 schema 与错误映射见 [contracts](./contracts/) 和 [data-model.md](./data-model.md)。

## 失败模式

| 失败 | 系统行为 |
| --- | --- |
| 并发 Assign 或 stale revision | 只有一个事务成功；其他返回 `task_status_conflict`/idempotent replay |
| Workspace preparation 失败 | Harness 持久化 bounded setup diagnostic，Task 保持 `in_progress`；不自动改状态 |
| ready report 后 launch 失败 | Runner 重放相同 attempt/report；completion 返回既有 ready Workspace，再重试幂等 continuation |
| ready report 重放 | 相同 preparation payload 与预分配 Session ID 返回既有结果，不创建重复对象 |
| claim response 丢失 | 既有 Session lease 到期/回收后重新 claim 并轮换 execution code；旧 hash 失效 |
| capability 过期/吊销/foreign scope | workload API fail closed，不返回上下文 |
| status 命令超时 | 相同 idempotency key 安全重放 |
| Session/Provider 失败 | Session 记录 execution failure；Task 仍 `in_progress`，除非 Agent 成功报告 blocked |
| `linctl`/`gh` 不可用 | Agent 报告 blocked；Mystra 无 credential/delivery fallback |
| Agent note 伪造 PR/tests | 原样作为有界不可信声明展示；Human 决定 done/退回 |

## 测试与验证

```text
shared schema/reducer tests
  -> RdbProvider contract tests (SQLite + optional PostgreSQL)
     -> TaskStatusService/TaskProductionService unit + race/idempotency tests
        -> Human/workload API route tests
           -> mystra-agent CLI contract tests
              -> Runner env/capability claim tests
                 -> HTTP + fake provider + fixture linctl/gh E2E
                    -> task detail browser/runtime smoke
```

- 迁移矩阵覆盖全部合法/非法 actor transition、note、terminal 状态。
- 20 路并发 expectedRevision/idempotency race 只产生一条 transition/Harness/Session；Workspace ready report 的 completion/continuation 分段故障可恢复。
- Team、Task、Harness、Session、Agent revision 任一 scope mismatch 均 fail closed。
- 测试断言 execution code 不出现在 prompt、SessionEvent、普通日志、Task note 或数据库明文字段。
- E2E fixture 证明 Agent 能只凭两个环境变量运行 `mystra-agent`，再调用本地 `linctl`/`gh`；fixture 不是 Mystra provider fallback。
- 完成前运行 `db:generate`、focused tests、`pnpm typecheck`、`pnpm test`、`pnpm build`、真实 HTTP/Runner smoke 和 `gitnexus_detect_changes`。

## 实施顺序

1. 共享 Task/Harness/execution schemas 与纯状态迁移规则测试。
2. 双 Prisma schema、migration、mapper、RdbProvider 原子命令与 contract tests，包括 Workspace completion idempotency。
3. TaskStatusService 和 TaskProductionService，包括 Harness-frozen inputs 与 Workspace continuation。
4. Human production API；随后 Task detail projection/controls。
5. claim-time execution capability、workload API 和泄漏/越权测试。
6. `packages/agent-cli` binary、Runner PATH/env 注入和 provider child tests。
7. Harness-specific standardized prompt/Session launch，移除该路径对 mutable Task/Agent 的二次解析。
8. 完整 journey E2E、运行验证、代码审查与 Spec-Kit closeout。

## NOT in scope

- Harness heartbeat、事件订阅、多 Session、retry/recovery policy 或独立 Harness 状态机。
- 自动分诊、需求审查、Recipe/Skill/Workflow 选择、standing orders、arbitrary triggers。
- Mystra 执行/验证测试，查询/验证 PR，解析 Agent 输出推断 Task 状态。
- Linear/GitHub credential 托管、CLI 代理、Issue write-back 或 RepoDeliveryProvider fallback。
- 通用 Artifact/Delivery API、非 PR 产出物、质量门禁与修复循环。
- task reopen、第二次 Harness attempt、并行 Agent、跨 Runtime 迁移。
- 通用 Control Plane `mystra` CLI 的重构或发布；本期只新增 workload-local `mystra-agent`。

## Complexity Tracking

无 constitution violation。新增 Harness 与 TaskStatusTransition 是规格要求的最小 durable facts；execution capability 复用 SessionDispatchLease，不新增独立认证平台。

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
| --- | --- | --- | --- | --- | --- |
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | 产品边界已由 owner 明确冻结 |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | — | 工程评审后决定是否需要 |
| Eng Review | `/plan-eng-review` | Architecture/data/tests (required) | 1 | CLEAR | 9 findings resolved, 0 critical gaps |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | 只扩展既有 Task detail surface |
| DX Review | `/plan-devex-review` | CLI developer experience | 0 | — | CLI contract 在本计划内直接评审 |

**UNRESOLVED:** 0

**VERDICT:** ENG CLEARED — ready for task decomposition and implementation
