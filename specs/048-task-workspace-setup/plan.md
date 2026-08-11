# Implementation Plan: Task Workspace Setup

**Branch**: `048-task-workspace-setup` | **Date**: 2026-08-10 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/048-task-workspace-setup/spec.md`

## Summary

在 control plane 中新增唯一的 `TaskWorkspace` 领域合同和显式 setup service。该 service 从 Task 的 immutable Project/Issue references 出发：读取 Project 的普通 `repositoryBaseBranch` 配置，通过 provider-neutral 标准 Git repository reader 在 exact repository 上读取 refs、验证配置并解析 canonical ref/exact commit，Issue provider 解析工作分支 decision（无 Issue 才使用 Task fallback），然后创建异步 preparation attempt。host `mystra-runner` 通过既有 outbound 模型 claim attempt，在 Runtime 自管根目录中原子化准备 Task 专属 clone/worktree，最后只回传 opaque `workspaceRef`。

048 为 Task-bound Session 提供 ready Workspace attachment resolver，强制 Runtime affinity，并让后续消费者复用同一个可变文件系统。当前 048/049/050 不支持 Project-only 或 standalone Session，也不预建平行 Workspace 类型。048 不创建 Session、initial turn 或 Provider execution；049 拥有原子 launch transaction，完整 Task 发起/历史 UI 由 feature 050 消费本功能状态。

## Technical Context

**Language/Version**: TypeScript 5.9，Node.js 24.14.0
**Primary Dependencies**: Next.js 16 Route Handlers、React 19、Zod 4、Prisma ORM/Client 7.9.1、Node `child_process`/`fs`/`path`、现有 GitHub/Linear Integration providers 与 `apps/runner-daemon`
**Storage**: SQLite 与 PostgreSQL/Supabase-backed PostgreSQL，通过 `RdbProvider` 暴露领域合同；Runtime 本地磁盘只保存工作目录
**Testing**: Vitest 4，RdbProvider 双数据库 contract tests，Route/service tests，runner filesystem/Git integration tests，跨 feature Session contract tests
**Target Platform**: self-hosted Mystra control plane 与 host-bound `mystra-runner`；Linux/macOS host Git
**Project Type**: pnpm monorepo；shared contracts + Next.js control plane + outbound runner daemon
**Performance Goals**: setup API 不等待 clone/fetch；runner claim 的 `waitSeconds` 上限为 25s；Workspace 状态读取使用单次 Team-scoped indexed lookup
**Constraints**: Task `1 : 0..1`；所有 Task Session 共用一个目录；不暴露宿主机路径或 secret；Runtime 必须 online 且支持 capability；准备结果必须 attempt-aware、幂等、fail closed
**Scale/Scope**: 单 Team 可有数百 Task Workspace；MVP 单 Workspace 固定一个 host Runtime；048 不定义 Session execution capacity，shared-mutable 并发风险由后续 execution contract 显式承担

## Constitution Check

*GATE: Phase 0 前检查，并在 Phase 1 后复查。*

| Gate | 结论 | 处置 |
|---|---|---|
| Task 创建/更新不得产生执行副作用 | PASS | setup 保持显式动作；Task CRUD 不触发 Workspace 或 Session。 |
| Session、Task、Project 保持 Team-scoped siblings | PASS | Workspace 归 Task，但 Task 仍不属于 Project；048 只返回 attachment，Session 的创建与持久化由 049 拥有。 |
| Runtime/Provider/Agent/Context 独立输入 | OWNER-APPROVED REFINEMENT | 当前仅 Task-bound Session；Task Workspace 对 Session 引入强制 Runtime compatibility，而不是把 Runtime 归属到 Task。Project-only/standalone launch 整体 deferred。 |
| `workspace` execution directory contract | OWNER-APPROVED REPLACEMENT | 当前只有 Task-owned durable Workspace 与同一 attachment 合同；未来对 deferred Session modes 的准备逻辑仍须复用该合同，不得增加平行类型。 |
| API-first，UI secondary | PASS | canonical service/route 与 runner protocol 先于 Task page 状态组件；feature 050 再完成 launch/history UX。 |
| Provider-neutral shared schemas | PASS | Zod schemas 放 `packages/shared`；Integration/Runtime adapters 不泄漏 GitHub、Prisma 或绝对路径类型。 |
| `RdbProvider` 不泄漏 Prisma/dialect | PASS | TaskWorkspace persistence 只使用领域 DTO；SQLite/PG 共用 contract tests。 |
| host Runtime outbound model | PASS | runner 通过 claim/report route 主动连接 control plane；不要求 control plane 反向访问主机。 |
| MVP exclusions | PASS | 无 orchestration、自动迁移、push/PR、Issue write-back、Session 隔离或跨 Runtime shared cache。 |

**Gate conclusion**: 技术方案可进入 Phase 0/1。两项 owner-approved replacement 必须在 048 实现 slice 中同步 5xP 与 constitution；否则实现不得宣布完成。

## Architecture and Data Flow

```text
Task Setup Workspace
  -> TaskWorkspaceService validates Team + Task + Project + Runtime
  -> reads Project.repositoryBaseBranch
  -> exact connection resolves transient Git remote access
  -> GitRemoteRepositoryReader.resolveBranch(configured branch -> exact ref/commit)
  -> IssueProvider.resolveWorkspaceBranch(exact Issue) OR manual fallback
  -> RdbProvider creates unique TaskWorkspace + preparation attempt
  -> host runner claims attempt over outbound protocol
  -> WorkspaceMaterializer prepares temp clone/checkout/branch
  -> atomic publish under Runtime-owned task workspace root
  -> runner reports opaque workspaceRef; RDB marks ready

Task Session (049)
  -> requires ready TaskWorkspace
  -> validates requested Runtime == workspace.runtimeId
  -> atomically creates Session, resolves all inputs and composes prompts
  -> records attachment and starts selected Provider in shared-mutable workspaceRef

```

### Ownership seams

- Project repository configuration: 用户选择普通 `repositoryBaseBranch`；repository selection 或 standard Git symbolic `HEAD` 可以预填，branch read 失败可退化为文本配置，Repo Info refresh 不覆盖配置。
- `RepoProvider`: 保持 Integration repository list/get/identity；不新增 branch list/resolve 方法。
- `GitRemoteRepositoryReader`: 使用 exact connection 的临时 access context，以一次有界标准 Git ref advertisement 读取 `HEAD`/branches，并可单独解析 canonical base ref/exact commit；不保存配置或 secret。
- Project branch service: 对有界 advertisement 做 scoped cursor、stable sort、filter/pagination；它是设置辅助面，不产生执行 snapshot。
- `IssueProvider`: provider-specific branch naming decision for exact Issue；不创建 Git branch。
- `TaskWorkspaceService`: Team scope、fallback、ref validation、幂等、状态机、Runtime eligibility 与三方编排。
- `WorkspaceMaterializer`: host filesystem/Git 实现、safe root、临时目录、原子发布、opaque ref resolution。
- `RdbProvider`: durable TaskWorkspace/attempt transaction，不持有路径或 provider clients。
- feature 049 Session service: 在一个原子 launch transaction 中创建 Session、解析全部输入、拼接 system prompt 与第一条 user message，再通过选定 Provider 发起执行；消费 048 attachment 且不重新解析 repository/Issue。048 不引入 initial `turnId` 或兼容层。

## Project Structure

### Documentation (this feature)

```text
specs/048-task-workspace-setup/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── engineering-review.md
├── features.md
├── checklists.md
├── checklists/
│   └── requirements.md
└── contracts/
    ├── task-workspace-api.md
    ├── provider-policies.md
    └── runtime-workspace-protocol.md
```

### Source Code (repository root)

```text
packages/shared/src/
├── task-workspace.ts
├── task-workspace.test.ts
└── index.ts

apps/control-plane/src/lib/
├── task-workspaces/
│   ├── task-workspace-service.ts
│   ├── task-workspace-service.test.ts
│   ├── task-workspace-errors.ts
│   └── task-workspace-factory.ts
├── git/
│   ├── remote-repository-reader.ts
│   ├── remote-repository-reader.test.ts
│   ├── project-repository-branches.ts
│   └── project-repository-branches.test.ts
├── integrations/
│   ├── types.ts
│   ├── linear.ts
│   └── linear.test.ts
└── db/
    ├── rdb-provider.ts
    ├── rdb-provider.contract.ts
    ├── prisma-provider.ts
    └── prisma-mappers.ts

apps/control-plane/app/api/
├── tasks/[id]/workspace/route.ts
├── projects/[slug]/repository/branches/route.ts
├── runner/workspaces/claim/route.ts
├── runner/workspaces/[workspaceId]/attempts/[attemptId]/route.ts
└── task-workspace-routes.test.ts

apps/control-plane/app/tasks/[id]/
└── page.tsx

apps/control-plane/app/_components/
├── project-repository-settings.tsx
└── task-workspace-panel.tsx

apps/control-plane/prisma/{sqlite,postgresql}/
├── schema.prisma
└── migrations/<feature-schema>/migration.sql

apps/runner-daemon/src/
├── index.ts
├── workspace-loop.ts
├── workspace-loop.test.ts
├── workspace-materializer.ts
└── workspace-materializer.test.ts
```

**Structure Decision**: 保持现有 monorepo 边界。共享 Zod/DTO 在 `packages/shared`；control plane 的通用 Git reader 只读取远端 refs，不进入 Integration adapter；host Git/filesystem materialization 只在 runner daemon。Task page 的最小 panel 属 048，完整 Session form/history 属 050。

## Phase Plan

### Phase 0 - Contracts and durable terminology

1. 先新增 shared TaskWorkspace、attempt、Git remote branch page/decision、Issue decision、runner claim/report schemas 与稳定错误码。
2. 将 5xP/constitution 的 workspace 术语更新为统一 Workspace/attachment 合同，记录当前仅 Task-bound Session 与 Runtime affinity。
3. 对 `RepoProvider` 做 impact 复核并确认保持不变；对 `IssueProvider`、`RdbProvider`、Task service 和 runner protocol 做 implementation impact；HIGH/CRITICAL 先停下报告。

### Phase 1 - Persistence, standard Git and Issue policy

1. 在 SQLite/PG Prisma schemas 增加 TaskWorkspace 与 preparation attempts；Task `taskId` unique，attempt sequence unique。
2. 扩展 `RdbProvider` transaction methods 和双数据库 contract tests，不暴露 Prisma types。
3. 明确 Project create/edit 的 Default branch setting；repository selection 或 standard Git symbolic `HEAD` 可预填，branch list 失败时 UI/CLI 可退化为普通文本配置。
4. 实现通用 `GitRemoteRepositoryReader` 与 Project-scoped paginated branch API；单次 ref advertisement 限制为 30 秒、10,000 refs、8 MiB stdout，API `first` 1..100/default 50，复用现有 scoped opaque cursor pattern，保持 `RepoProvider` 不变。
5. 扩展 GitHub/Linear Issue branch decision；无 Issue fallback 留在 service。
6. 实现 Team/RBAC、idempotency、safe branch validation 和 setup/read canonical API。

### Phase 2 - Runtime materialization

1. 在 Runtime registration 中加入 versioned `workspaceMaterialization` capability，当前 `version: 1`、kind `task-repository`、sharing mode `shared-mutable`。
2. 实现 runner claim/lease/report loop；claim payload 携带冻结 intent 与 just-in-time secret delivery，不写日志/磁盘。
3. 实现 host materializer：只在配置 root 下创建 UUID 派生目录，使用 argv spawn，不拼 shell；先临时目录后 atomic rename。
4. 对 branch collision、attempt expiry、partial clone、process crash、path traversal 与 secret redaction 建立 integration tests。

### Phase 3 - Task action and consumer dependency contract

1. 在 Task detail 增加最小 Workspace panel：Setup、状态、Runtime、branch、失败与 retry。
2. 发布给 049 的依赖合同：仅接受 Task-bound input，只附着 ready TaskWorkspace；048 不实现 Session 创建、initial turn、Provider 发起或 Session event 状态机。
3. 发布给 050 的 read projection：Runtime 显示为 Workspace 锁定值；未 ready 时 launch disabled 并引导 Setup；完整 summary/detail UI 仍由 050 实现。
4. 加入 repeated attachment resolution 与 missing/non-ready/offline/Runtime mismatch fail-closed tests；真实 Session launch 与 shared-mutation consumer tests 由 049/050 拥有。

### Phase 4 - Verification and closeout gate

1. 运行 shared、control-plane、runner 定向 test/typecheck 与 SQLite/PG contract suite。
2. 运行 Spec-Kit consistency/analyze、requirements checklist、engineering review 和 GitNexus detect changes。
3. UI acceptance 进入 tasks 前必须补独立 prototype artifact，或由 owner 明确豁免；本计划不伪造已完成视觉验证。

## Testing Strategy

- **Schema/contract**: Zod 严格输入、error enum、state transitions、opaque ref，SQLite/PG parity。
- **Standard Git unit/integration**: exact connection/repo access、single advertisement、symbolic `HEAD`、empty/unborn repository、stable pagination/filter/scoped cursor、10,000-ref/8-MiB/30s limits、configured branch exact resolution/status-2 missing、credential/error redaction。
- **Provider unit**: `RepoProvider` existing list/get regression；GitHub/Linear Issue branch normalization、Issue unavailable no fallback。
- **Service unit**: Team scope、Task without Project、20x idempotency、attempt fencing、ready/failed retry、Runtime capability/affinity。
- **Runner unit/integration**: safe root、argv injection resistance、temp cleanup、atomic publish、branch collision、secret redaction、crash recovery。
- **API**: auth/RBAC、setup 202/read 200/conflict/error mapping、runner auth、claim lease、stale report 409。
- **048 consumer contract**: repeated resolution returns the same ref；missing/non-ready/unavailable/offline/mismatch all fail closed；无 Project-only/standalone input contract。真实 Session 创建、Provider 发起与 visible mutation acceptance 由 049/050 测试。
- **UI runtime**: Task panel 状态与 action 需要真实浏览器验证，但仅在 implementation/tasks 阶段，不用于验证本次 Markdown。

## Risk Register

| Risk | Level | Mitigation |
|---|---|---|
| `RdbProvider` 是共享高影响合同 | HIGH | additive domain methods、双 provider contract tests、所有 mocks/fixtures 同步；实现前再次 impact。 |
| 误把标准 Git branch 操作塞进 RepoProvider | MEDIUM | GitNexus 显示 19 个受影响符号/6 个 direct；保持 RepoProvider 不变，新增 provider-neutral Git reader 与 focused tests。 |
| Issue provider interface 破坏现有 adapters | MEDIUM | pre-0.1 直接替换并更新 GitHub/Linear/registry tests，不加 optional compatibility shim。 |
| Task Sessions 共享目录产生 Git/filesystem 竞争 | HIGH (product choice) | 明示 `shared-mutable`，不承诺锁或隔离；048 不定义或持久化 Runtime capacity/slot，重叠执行可观测性由后续 execution contract 测试。 |
| runner 需要 repository credential | HIGH | authenticated outbound channel、just-in-time resolution、内存使用、日志 redaction；不在 RDB/event/workspace metadata 持久化。 |
| base branch 在 setup 中变化 | MEDIUM | standard Git reader 返回 exact commit，Workspace 冻结 commit；后续观察不改历史。 |
| 049/050 consumer 与 048 Workspace 合同漂移 | MEDIUM | 049/050 仅消费 task/shared-mutable attachment；Project-only/standalone 整体 deferred，禁止预建第二种 Workspace 或 clone path。 |
| host 磁盘丢失或 Runtime offline | MEDIUM | unavailable + fail closed；自动迁移/重建明确排除，避免隐式数据损失。 |

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| Workspace 从仅 Session-scoped 扩展为 Task-owned durable execution directory | 用户要求多个 Task Session 复用同一工作状态 | 继续每 Session 建目录无法满足共享状态；把路径放 Task 上会泄漏 Runtime 实现并破坏 opaque seam。 |
| Task Session 的 Runtime 受 Workspace affinity 限制 | 本地目录只存在于准备它的 host Runtime | 自动复制或 shared filesystem 会引入明确排除的跨 Runtime 基础设施和隐式状态迁移。 |

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|---|---|---:|---:|---|---|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | — |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | — | — |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | CLEAR | 3 issues resolved，0 critical gaps |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | Project/Task prototype remains a pre-task gate |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | — |

**UNRESOLVED:** 0 engineering decisions；prototype and owner lifecycle confirmation remain explicit pre-task gates。

**VERDICT:** ENG CLEARED — architecture is ready；do not generate `tasks.md` until the recorded pre-task gates close。
