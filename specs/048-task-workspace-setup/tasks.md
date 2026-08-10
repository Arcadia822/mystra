# Tasks: Task Workspace Setup

**Input**: Design documents from `/specs/048-task-workspace-setup/`
**Prerequisites**: `spec.md`, `plan.md`, `engineering-review.md`, `research.md`, `data-model.md`, `contracts/`, `prototype.md`

**Tests**: 本功能明确要求 TDD、SQLite/PostgreSQL contract parity、真实 Git/文件系统集成与真实浏览器验证。每个测试任务先写并确认在实现前失败。

**Organization**: 任务按 user story 分组。048 实现 Task Workspace 与 task-only attachment handoff；049 只实现 Task-bound canonical Session launch，050 才完成完整 Session UI。Project-only 与 standalone Session 整体 deferred。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 可在不同文件上并行，不依赖未完成任务
- **[Story]**: 对应 `spec.md` 的 user story
- 所有路径均相对 repository root

## Phase 1: Setup（实现前门禁）

**Purpose**: 冻结当前图谱、原型和跨 feature 合同，避免在高影响持久化接口上盲改。

- [x] T001 运行并记录 `IssueProvider`、`RdbProvider`、`registerHostRuntime`、Project API 与 runner loop 的 GitNexus upstream impact，在 `specs/048-task-workspace-setup/engineering-review.md` 更新实际 blast radius
- [x] T002 [P] 核对 049 `SessionWorkspaceAttachment` 与 050 `TaskWorkspaceSummary` 消费形状，并在 `specs/048-task-workspace-setup/checklists/engineering-review.md` 记录 048-owned 与 deferred 边界
- [x] T003 [P] 将真实浏览器原型证据与实现 acceptance selector 对齐到 `specs/048-task-workspace-setup/prototype.md` 和 `specs/048-task-workspace-setup/mockups/index.html`

---

## Phase 2: Foundational（阻塞所有 User Stories）

**Purpose**: 建立 provider-neutral shared schemas、双数据库持久化和 Runtime capability 基础。

**⚠️ CRITICAL**: 本阶段完成前不得进入 setup service、runner materialization 或 UI。

- [x] T004 [P] 先写 TaskWorkspace、WorkspacePreparationAttempt、Git branch page/decision、runner claim/report、stable failure code 与 SessionWorkspaceAttachment 的严格 Zod 合同测试到 `packages/shared/src/task-workspace.test.ts`
- [x] T005 实现并导出共享 Workspace 合同到 `packages/shared/src/task-workspace.ts` 与 `packages/shared/src/index.ts`，使 T004 通过
- [x] T006 [P] 先写 host Runtime workspace materialization capability 的注册/响应 schema 测试到 `packages/shared/src/schemas.test.ts` 与 `apps/runner-daemon/src/registration.test.ts`
- [x] T007 扩展 `packages/shared/src/schemas.ts`、`apps/runner-daemon/src/registration.ts` 与 `apps/control-plane/src/lib/db/prisma-mappers.ts`，持久化并投影 `workspaceMaterialization` capability
- [x] T008 [P] 先在 `apps/control-plane/src/lib/db/rdb-provider.contract.ts` 增加 Task `1:0..1`、attempt sequence、幂等、状态转换、fencing、Runtime affinity 与 unavailable contract tests
- [x] T009 [P] 在 `apps/control-plane/src/lib/db/prisma-schema-parity.test.ts` 增加 SQLite/PostgreSQL TaskWorkspace/attempt 模型、枚举、索引与约束 parity 断言
- [x] T010 在 `apps/control-plane/prisma/sqlite/schema.prisma`、`apps/control-plane/prisma/postgresql/schema.prisma` 与两套 `migrations/20260810130000_task_workspace_setup/migration.sql` 增加 TaskWorkspace 和 WorkspacePreparationAttempt 持久化结构；不得改写 pre-0.1 legacy adoption fixture
- [x] T011 扩展领域持久化 DTO 与事务方法到 `apps/control-plane/src/lib/db/rdb-provider.ts`，保持 Prisma/dialect 类型不越界
- [x] T012 实现 TaskWorkspace/attempt mapper 与 Prisma provider 方法到 `apps/control-plane/src/lib/db/prisma-mappers.ts`、`apps/control-plane/src/lib/db/prisma-client.ts` 和 `apps/control-plane/src/lib/db/prisma-provider.ts`，使 T008-T010 通过

**Checkpoint**: shared contract、Runtime capability 与双数据库持久化可被所有 story 使用。

---

## Phase 3: User Story 1 - 为 Task 准备可执行 Workspace（Priority: P1）🎯 MVP

**Goal**: 从 Project ordinary repository config、standard Git、Issue branch policy 到 host Runtime materialization 完成唯一 Task Workspace 闭环。

**Independent Test**: 对有/无 Issue 的 Task 执行 20 次相同 Setup，得到一个 ready Workspace；configured branch 被解析为 exact commit，工作分支符合策略，runner 只发布一个 safe-root 目录且 API 不泄露路径/secret。

### Tests for User Story 1

- [x] T013 [P] [US1] 先写单次 `git ls-remote` advertisement、symbolic HEAD、exact resolve、missing status 2、30s/10k/8MiB limits、malformed output 与 redaction 测试到 `apps/control-plane/src/lib/git/remote-repository-reader.test.ts`
- [x] T014 [P] [US1] 先写 branch stable sort/filter/scoped cursor/pagination 与失败非空页测试到 `apps/control-plane/src/lib/git/project-repository-branches.test.ts`
- [x] T015 [P] [US1] 先写 GitHub/Linear deterministic issue branch、missing issue、provider failure 与 no-fallback 测试到 `apps/control-plane/src/lib/integrations/github.test.ts` 和 `apps/control-plane/src/lib/integrations/linear.test.ts`
- [x] T016 [P] [US1] 先写 Setup Team/RBAC、Task without Project、exact connection、branch resolve、fallback、invalid ref、Runtime eligibility、20x idempotency 与 retry 测试到 `apps/control-plane/src/lib/task-workspaces/task-workspace-service.test.ts`
- [x] T017 [P] [US1] 先写 Project branch API、Task workspace GET/POST、runner claim/report auth 与错误映射测试到 `apps/control-plane/app/api/task-workspace-routes.test.ts`
- [x] T018 [P] [US1] 先写 safe-root、argv spawn、exact commit、branch collision、partial clone cleanup、atomic publish、opaque ref 与 secret redaction测试到 `apps/runner-daemon/src/workspace-materializer.test.ts`
- [x] T019 [P] [US1] 先写 runner 空 claim、claim→materialize→report、lease conflict、backoff 与 graceful failure 测试到 `apps/runner-daemon/src/workspace-loop.test.ts`
- [x] T020 [P] [US1] 先写 Project default branch picker/text fallback 与 Task Workspace five-state view-model 测试到 `apps/control-plane/app/_components/project-repository-settings-model.test.ts` 和 `apps/control-plane/app/_components/task-workspace-model.test.ts`

### Implementation for User Story 1

- [x] T021 [US1] 实现 opaque transient Git access 与 exact Project connection resolution 到 `apps/control-plane/src/lib/git/remote-access.ts` 和 `apps/control-plane/src/lib/git/remote-access-factory.ts`
- [x] T022 [US1] 实现 bounded argv-only standard Git reader 到 `apps/control-plane/src/lib/git/remote-repository-reader.ts`，使 T013 通过且不修改 `RepoProvider`
- [x] T023 [US1] 实现 Project-scoped branch query、UTF-8 ref sort 与 opaque cursor 到 `apps/control-plane/src/lib/git/project-repository-branches.ts` 和 `apps/control-plane/src/lib/git/project-repository-branch-cursor.ts`
- [x] T024 [US1] 实现 `GET /api/projects/[slug]/repository/branches` 到 `apps/control-plane/app/api/projects/[slug]/repository/branches/route.ts`，使 T014/T017 的 branch API cases 通过
- [x] T025 [US1] 将 required `resolveWorkspaceBranch` 加入 `apps/control-plane/src/lib/integrations/types.ts` 并同步 registry fixtures 到 `apps/control-plane/src/lib/integrations/registry.test.ts`
- [x] T026 [P] [US1] 实现 GitHub Issue branch policy 到 `apps/control-plane/src/lib/integrations/github.ts`，使 GitHub portions of T015 通过
- [x] T027 [P] [US1] 实现 Linear Issue branch policy 到 `apps/control-plane/src/lib/integrations/linear.ts`，使 Linear portions of T015 通过
- [x] T028 [US1] 实现 safe Git branch validation、no-Issue fallback 与稳定错误映射到 `apps/control-plane/src/lib/task-workspaces/task-workspace-errors.ts` 和 `apps/control-plane/src/lib/task-workspaces/task-workspace-factory.ts`
- [x] T029 [US1] 实现 Team-scoped setup/get 编排、冻结 intent、唯一 Workspace 与 preparation attempt 到 `apps/control-plane/src/lib/task-workspaces/task-workspace-service.ts`
- [x] T030 [US1] 实现 production dependency wiring 到 `apps/control-plane/src/lib/task-workspaces/task-workspace-service-factory.ts`，只解析 Project exact connection 和 Task exact Issue
- [x] T031 [US1] 实现 authenticated `GET/POST /api/tasks/[id]/workspace` 到 `apps/control-plane/app/api/tasks/[id]/workspace/route.ts`，使 operator route cases of T017 通过
- [x] T032 [US1] 实现 Runtime-bound attempt claim 与 fenced report routes 到 `apps/control-plane/app/api/runner/workspaces/claim/route.ts` 和 `apps/control-plane/app/api/runner/workspaces/[workspaceId]/attempts/[attemptId]/route.ts`
- [x] T033 [US1] 实现 configured safe-root、opaque ref mapping、clone/fetch/checkout/branch 与 atomic publish 到 `apps/runner-daemon/src/workspace-materializer.ts`，使 T018 通过
- [x] T034 [US1] 实现 outbound workspace claim/materialize/report loop 到 `apps/runner-daemon/src/workspace-loop.ts` 并接入 `apps/runner-daemon/src/index.ts`，使 T019 通过
- [x] T035 [P] [US1] 实现 Project repository Default branch picker、refresh、failure-to-text 与 save view model 到 `apps/control-plane/app/_components/project-repository-settings-model.ts` 和 `apps/control-plane/app/_components/project-repository-settings.tsx`
- [x] T036 [US1] 将 repository settings 接入 `apps/control-plane/app/_components/project-detail.tsx`，保留 `repositoryBaseBranch` 为 ordinary Project update 而非 provider observation
- [x] T037 [P] [US1] 实现 Workspace absent/queued/preparing/ready/failed/unavailable view model 与 panel 到 `apps/control-plane/app/_components/task-workspace-model.ts` 和 `apps/control-plane/app/_components/task-workspace-panel.tsx`
- [x] T038 [US1] 将 Setup/Retry/refresh 与 locked Runtime、branch、shared-mutable 提示接入 `apps/control-plane/app/tasks/[id]/page.tsx`

**Checkpoint**: Setup Workspace 的 repository→Issue→Runtime 闭环可独立演示；不需要 049/050 Session 实现。

---

## Phase 4: User Story 2 - 所有 Task Session 共享同一工作目录（Priority: P1）

**Goal**: 为 049 提供唯一、只读、fail-closed 的 Task Workspace attachment resolver；048 不创建 Session。

**Independent Test**: 连续解析同一 ready Task 三次返回完全相同的 `taskWorkspaceId/runtimeId/workspaceRef/shared-mutable`；不同 Runtime、非 ready 或 missing 均失败且不创建目录。

### Tests for User Story 2

- [x] T039 [P] [US2] 先写 same-ref、non-ready、missing/unavailable、cross-Team 与 Runtime mismatch attachment tests 到 `apps/control-plane/src/lib/task-workspaces/task-workspace-service.test.ts`
- [x] T040 [P] [US2] 先写 trusted/public projection 分离测试到 `packages/shared/src/task-workspace.test.ts`，确保普通 Task response 不含 `workspaceRef` 而 internal attachment 必须包含它

### Implementation for User Story 2

- [x] T041 [US2] 实现 `resolveSessionAttachment` trusted service path 到 `apps/control-plane/src/lib/task-workspaces/task-workspace-service.ts`，只读 ready Workspace 且不重跑 repository/Issue policy
- [x] T042 [US2] 固化 049 handoff fixture 与 Runtime affinity contract 到 `packages/shared/src/task-workspace.ts` 和 `specs/048-task-workspace-setup/contracts/task-workspace-api.md`

**Checkpoint**: 049 可直接消费同一 opaque ref；048 未制造 Session 级 clone/worktree。

---

## Phase 5: Owner scope correction - Task-only attachment convergence

**Goal**: 将 049 handoff 收敛为唯一的 ready Task Workspace attachment；不设计 Project-only、standalone 或平行 Workspace 类型。

**Independent Test**: shared contract 只接受 `taskWorkspaceId/runtimeId/workspaceRef/shared-mutable`；`resolveSessionAttachment` 只接受 taskId，只读 ready Workspace，并对 missing、non-ready、Runtime offline/mismatch fail closed。

### Tests for Task-only handoff

- [x] T043 [P] [US2] 写 strict ready Task Workspace attachment 与禁止 absolute path/额外字段测试到 `packages/shared/src/task-workspace.test.ts`
- [x] T044 [P] [US2] 写 attachment same-ref、missing、non-ready、offline 与 Runtime mismatch service regression tests 到 `apps/control-plane/src/lib/task-workspaces/task-workspace-service.test.ts`

### Implementation for Task-only handoff

- [x] T045 [US2] 完成唯一 task/shared-mutable attachment schema 与说明到 `packages/shared/src/task-workspace.ts` 和 `specs/048-task-workspace-setup/data-model.md`，不猜测 deferred modes 字段

**Checkpoint**: 049 可 rebase/stack 到只支持 Task-bound Session 的统一 Workspace dependency；不存在第二种 attachment 或 Workspace 合同。

---

## Phase 6: User Story 3 - 可诊断地处理准备失败与丢失（Priority: P2）

**Goal**: 所有 repository/Issue/Runtime/materialization/lease/missing failures 都稳定、脱敏且不会产生 ready 半成品。

**Independent Test**: 注入 failure matrix 中每一类失败；Workspace 只进入 failed/unavailable，stale report 返回 409，同 Runtime retry 复用 Workspace ID，missing 阻止 attachment。

### Tests for User Story 3

- [x] T046 [P] [US3] 先写 repository/Issue/Runtime/materialization 四类 failure matrix 与 redacted public view tests 到 `apps/control-plane/src/lib/task-workspaces/task-workspace-service.test.ts`
- [x] T047 [P] [US3] 先写 attempt lease expiry、retry sequence、stale/foreign report、late success 与 unavailable transition contract tests 到 `apps/control-plane/src/lib/db/rdb-provider.contract.ts`
- [x] T048 [P] [US3] 先写 runner resolve missing directory/repository/branch 与 `workspace_missing` report tests 到 `apps/runner-daemon/src/workspace-materializer.test.ts` 和 `apps/runner-daemon/src/workspace-loop.test.ts`

### Implementation for User Story 3

- [x] T049 [US3] 完成 retry/fencing/unavailable transaction paths 到 `apps/control-plane/src/lib/db/prisma-provider.ts` 与 `apps/control-plane/src/lib/task-workspaces/task-workspace-service.ts`
- [x] T050 [US3] 实现 runner missing verification/report 与 control-plane unavailable route handling到 `apps/runner-daemon/src/workspace-materializer.ts`、`apps/runner-daemon/src/workspace-loop.ts` 和 `apps/control-plane/app/api/runner/workspaces/[workspaceId]/attempts/[attemptId]/route.ts`
- [x] T051 [US3] 将稳定 failure code、retry eligibility 与无 fallback 文案接入 `apps/control-plane/app/_components/task-workspace-panel.tsx` 和 `apps/control-plane/app/_components/project-repository-settings.tsx`

**Checkpoint**: 半成品永不 ready，过期结果永不覆盖，丢失 Workspace 永不被 Session 消费。

---

## Phase 7: Polish & Cross-Cutting Verification

**Purpose**: 验证真实 Git、双数据库、Runtime 文件系统、UI 和文档的一致性。

- [x] T052 [P] 补充 `apps/control-plane/src/lib/integrations/README.md` 与 `apps/runner-daemon/README.md`，说明 standard Git boundary、workspace root/config、secret redaction 与 048/049 ownership
- [x] T053 运行 `pnpm --filter @mystra/shared test`、control-plane/runner 定向 test 与 typecheck，并将结果写入 `specs/048-task-workspace-setup/quickstart.md`
- [x] T054 使用本地 bare/private-style Git fixture 执行 branch read→Setup→claim→materialize→report 的真实闭环，记录 exact commit、branch、opaque ref 与无 secret/path 泄漏证据到 `specs/048-task-workspace-setup/quickstart.md`
- [x] T055 在可用的 SQLite 与 PostgreSQL/Supabase-backed PostgreSQL 上运行同一 RdbProvider contract suite；若 PostgreSQL URL 不存在，明确保留阻塞项到 `specs/048-task-workspace-setup/checklists/engineering-review.md`
- [x] T056 运行真实 control-plane 页面并以浏览器验证 Project branch success/failure-text、Workspace five states、Setup/Retry、locked Runtime、shared-mutable、320px 与 console clean，更新 `specs/048-task-workspace-setup/prototype.md`
- [x] T057 运行 `.specify` status/analyze、`git diff --check`、targeted consistency search、GitNexus fresh analyze 与 detect changes，并更新 `specs/spec-status.md` 和 `specs/048-task-workspace-setup/checklists.md`
- [x] T058 对照 `spec.md` FR/SC、049 attachment 与 050 consumer contract 做最终 completion audit，在 `specs/048-task-workspace-setup/checklists/engineering-review.md` 关闭可在 048 内关闭的门禁并列出严格 deferred 项

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1**: 立即执行；T001 若出现 HIGH/CRITICAL 必须先向 owner 报告。
- **Phase 2**: 依赖 Phase 1；阻塞所有 story。
- **US1 / Phase 3**: 依赖 Phase 2；交付 048 的核心 setup MVP。
- **US2 / Phase 4**: 依赖 US1 ready Workspace；只交付 049 attachment resolver。
- **Task-only checkpoint / Phase 5**: 依赖 US2 ready Workspace resolver；冻结 049 可直接消费的唯一 attachment 合同。
- **US3 / Phase 6**: 依赖 US1 persistence/service/runner paths。
- **Phase 7**: 依赖所有 048-owned tasks；049/050 implementation 不是 048 completion 的伪前置条件。

### User Story Dependencies

```text
Foundational
    |
    +--> US1 Setup Workspace MVP
            |
            +--> US2 Task shared attachment handoff
            |       |
            |       +--> Task-only 049 dependency checkpoint
            +--> US3 failure/retry/missing semantics
```

### Within Each User Story

- 测试任务先执行并确认失败，再做对应实现。
- shared contracts → persistence → services → routes → runner/UI。
- GitHub 与 Linear policy 可并行；Project UI 与 Task UI 可在 service/route 形状冻结后并行。
- 不通过添加 compatibility alias、optional provider method 或 fake persistence 规避失败。

### Parallel Opportunities

- T004/T006/T008/T009 在不同 shared/db test 文件上可并行。
- T013-T020 是不同边界的 failing tests，可并行建立。
- T026/T027 可并行实现 GitHub/Linear policy。
- T035/T037 可在 API contract 冻结后并行。
- T039/T040、T043/T044、T046-T048 分别可并行建立 story-specific failing tests。

---

## Parallel Example: User Story 1

```text
Task: T013 standard Git reader tests
Task: T015 GitHub/Linear issue policy tests
Task: T018 runner materializer tests
Task: T020 Project/Task UI view-model tests
```

## Parallel Example: User Story 3

```text
Task: T046 service failure matrix tests
Task: T047 RDB fencing/lease tests
Task: T048 runner missing verification tests
```

---

## Implementation Strategy

### MVP First

1. 完成 Phase 1 与 Phase 2。
2. 完成 US1 的 standard Git→Issue policy→TaskWorkspace→runner materialization→minimal UI。
3. 用真实 local Git fixture 独立验证 US1；此时已有可用 Setup Workspace MVP。
4. 再交付 US2 的 task-only 049 handoff，以及 US3 failure closure。

### 048 Completion Boundary

- **必须完成**: Task Workspace shared contracts、Project branch API、standard Git reader、Issue policies、双数据库 persistence、setup/read/attachment service、runner materialization、minimal Project/Task UI、failure/retry/missing、真实验证。
- **明确 deferred 到 049**: canonical Task-bound Session launch/event ledger、Task Session attachment persistence。
- **明确 deferred 到未来规格**: Project-only 与 standalone Session；未来准备逻辑必须复用同一 Workspace/attachment contract，不得增加平行类型。
- **明确 deferred 到 050**: 完整 New Session form、Session history/event UX；050 只消费 048 setup/read view。

## Notes

- `[P]` 表示文件与前置依赖允许并行，不表示可跳过测试先后关系。
- 每个完成的任务将 checkbox 改为 `[x]`；不得以“代码已写但未验证”关闭测试或 verification task。
- 不自动提交、push、merge 或删除 worktree；这些 Git 变更需要独立明确授权。
