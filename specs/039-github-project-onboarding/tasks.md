# Tasks: GitHub Project Onboarding

**Input**: `spec.md`、`plan.md`、`research.md`、`data-model.md`、`contracts/`  
**Tests**: 本功能修改授权、共享合同、持久化、API、Runner 和用户主流程；每个切片必须先写失败测试。

## Phase 1: Setup and review gates

**Purpose**：冻结已批准边界，确保实现只触及预期 execution flows。

- [x] T001 记录现有 `/api/projects`、repository list、Runner Session route 的 `gitnexus_api_impact` 结果，并在 `specs/039-github-project-onboarding/checklists/engineering-review.md` 保持 MEDIUM `/api/projects` consumer mismatch 提醒。
- [x] T002 为 `apps/control-plane/src/lib/integrations/README.md` 和 `docs/RUNNER-DOCKER-MVP.md` 预留 GitHub App deployment variables、Setup URL、callback URL 与无 PAT invariant 的最小文档变更。

**Checkpoint**：规格、原型、计划、工程评审完整；没有未解决 clarification。

---

## Phase 2: Foundational contracts and persistence

**Purpose**：建立所有用户故事依赖的 connection identity 与 secret-free contract。

- [x] T003 [P] 在 `packages/shared/src/integrations.test.ts` 和 `packages/shared/src/management.test.ts` 添加 IntegrationConnection、connection list、OAuth status/error 与 private Runner repository credential 的成功/拒绝合同测试。
- [x] T004 [P] 在 `packages/shared/src/repository.test.ts` 和 `packages/shared/src/schemas.test.ts` 添加 `RepositorySelector.connectionId`、`Project.repositoryConnectionId`、provider mismatch 输入与无 clone URL 输入测试。
- [x] T005 在 `packages/shared/src/integrations.ts`、`packages/shared/src/repository.ts`、`packages/shared/src/schemas.ts` 和 `packages/shared/src/management.ts` 实现 T003-T004 的 Zod/TypeScript contracts，并导出到 `packages/shared/src/index.ts`。
- [x] T006 [P] 在 `apps/control-plane/src/lib/db/sqlite-provider.test.ts` 添加 connection create/reactivate/deactivate/list/get、一个 active invariant、Project FK、exact v3 rebuild 与 secret-column absence 测试。
- [x] T007 在 `apps/control-plane/src/lib/db/rdb-provider.ts`、`apps/control-plane/src/lib/db/migrations.ts` 和 `apps/control-plane/src/lib/db/sqlite-provider.ts` 实现 IntegrationConnection persistence、Project connection reference 与 schema version bump。
- [x] T008 更新 `apps/control-plane/src/lib/db/sqlite-provider.test.ts`、`apps/control-plane/app/api/routes.test.ts` 和现有 Project fixture helpers，使所有 Project 明确绑定测试 connection，不增加 compatibility default。

**Checkpoint**：`pnpm --filter @mystra/shared test` 与 control-plane DB focused tests 通过；SQLite/Project/claim 无 secret 字段。

---

## Phase 3: User Story 1 - Connect GitHub App

**Goal**：Settings 可以完成经 OAuth 用户验证的 GitHub App installation 连接，并展示非秘密状态。

**Independent Test**：从 disconnected 进入 Connect，模拟 install/setup/OAuth callback，验证 exact installation 被激活、token 未落库；spoofed installation 被拒绝。

### Tests

- [ ] T009 [P] [US1] 在 `apps/control-plane/src/lib/integrations/github-app.test.ts` 编写 config、PKCE、JWT、OAuth exchange、accessible installation、installation token expiry/cache/single-flight、timeout/rate-limit/redaction 失败测试。
- [ ] T010 [P] [US1] 在 `apps/control-plane/app/api/integration-connections.test.ts` 编写 list、connect redirect、setup transaction cookies、callback state/install validation、reconnect 与 sanitized redirect error route tests。
- [ ] T011 [P] [US1] 在 `apps/control-plane/app/_components/github-connection-model.test.ts` 编写 configured/disconnected/connected/connecting/error/reconnect view-model 测试。

### Implementation

- [x] T012 [US1] 在 `apps/control-plane/src/lib/integrations/github-app.ts` 实现 GitHub App config、PKCE/OAuth、App JWT、accessible installation verification 与内存 installation-token broker。
- [x] T013 [US1] 在 `apps/control-plane/app/api/integration-connections/route.ts`、`github/connect/route.ts`、`github/setup/route.ts` 和 `github/oauth/callback/route.ts` 实现 thin Route Handlers、短期安全 cookies、relative return target 与非秘密 response。
- [x] T014 [US1] 在 `apps/control-plane/app/_components/setting-row.tsx` 和 `apps/control-plane/app/globals.css` 实现 Mystra-owned `SettingGroup`/`SettingRow`，对齐 Castrel anatomy/density 并保持 Mystra token。
- [x] T015 [US1] 在 `apps/control-plane/app/_components/github-connection-model.ts`、`shell-settings.tsx` 和 `shell-copy.ts` 实现 Integrations tab、GitHub App status row、Connect/Reconnect 与英语/简体中文文案。
- [x] T016 [US1] 在 `apps/control-plane/app/_components/app-shell.tsx` 处理 OAuth return query，自动打开 Integrations、移除一次性 query，并保持其他 shell modal 状态互斥。

**Checkpoint**：mocked OAuth happy/negative routes 全通过；浏览器能完成模拟 connect/reconnect，Settings 不呈现 token 或 env 名。

---

## Phase 4: User Story 2 - Modal repository selection

**Goal**：Add Project 在当前 route 打开 Modal，GitHub 默认选中，并从 active App connection 分页浏览仓库。

**Independent Test**：在非 `/projects` route 点击 plus，地址不变；验证 disconnected、loading、empty、error/retry、filter、Load more 和 repository selection。

### Tests

- [ ] T017 [P] [US2] 在 `apps/control-plane/src/lib/integrations/github.test.ts` 添加 installation `/installation/repositories` response、cursor pagination、duplicate/archived item、invalid shape 和 static test credential seam 测试。
- [ ] T018 [P] [US2] 在 `apps/control-plane/app/api/routes.test.ts` 添加 connection-scoped repository list、omitted-active connection、wrong provider/connection、cursor 与 later-page error route tests。
- [ ] T019 [P] [US2] 扩展 `apps/control-plane/app/projects/_components/project-create-model.test.ts`，覆盖默认 GitHub、connection required、page append/de-dup、filter、selection/change、later-page failure 与 draft reset。

### Implementation

- [x] T020 [US2] 在 `apps/control-plane/src/lib/integrations/github.ts` 和 `registry.ts` 支持异步 installation credential source与 installation repository endpoint，并删除 production `MYSTRA_GITHUB_TOKEN` 读取。
- [x] T021 [US2] 在 `apps/control-plane/app/api/integrations/[integration]/repositories/route.ts` 与 `repositories/resolve/route.ts` 解析 connectionId，构造 exact/active connection registry，并保持现有 response schema。
- [ ] T022 [US2] 在 `apps/control-plane/app/projects/_components/project-create-model.ts` 实现显式 Modal state reducer、repository page append/de-dup/filter 和 selection/change 状态。
- [x] T023 [US2] 在 `apps/control-plane/app/_components/project-create-modal.tsx` 使用 `UiDialogSurface`、`SettingRow` 和现有 fields/actions 实现 source selector、connection prerequisite、picker states、Load more、focus/Escape/backdrop。
- [x] T024 [US2] 在 `apps/control-plane/app/_components/app-shell.tsx` 将 Projects plus 从 Link 改为 Modal action，协调 Settings 跳转，并刷新 Project resource；不改变触发 route。

**Checkpoint**：component model/provider/route tests 通过；浏览器在 320/768/1024/1440px 验证 Modal 与 repository states。

---

## Phase 5: User Story 3 - Configure and create Project

**Goal**：选仓库后列表折叠为 Repository 设置行，其他配置出现，服务端用 exact connection 重解析并创建。

**Independent Test**：选择 private repo，配置 Name/Slug/Agent/Runtime，Change 保留非仓库输入；成功导航详情，失败保留 Modal。

### Tests

- [ ] T025 [P] [US3] 在 `apps/control-plane/src/lib/projects/resolve-project-input.test.ts` 添加 create/update exact connection resolve、integration/provider mismatch、inactive historical connection、archived/revoked repository 与 zero partial write 测试。
- [ ] T026 [P] [US3] 在 `apps/control-plane/app/api/routes.test.ts` 和 `apps/control-plane/src/lib/operator-cli.test.ts` 添加 Project create/update connection reference、slug conflict、stale selection、CLI explicit connection flag 和 response secret absence tests。
- [ ] T027 [P] [US3] 扩展 `apps/control-plane/app/projects/_components/project-create-model.test.ts`，覆盖 selected-row projection、slug suggestion、field validation、double submit、failure retention 和 success reset。

### Implementation

- [ ] T028 [US3] 在 `apps/control-plane/src/lib/projects/resolve-project-input.ts`、`apps/control-plane/app/api/projects/route.ts`、`apps/control-plane/app/api/projects/[slug]/route.ts` 和 `scripts/operator-cli.mjs` 让 create/update/CLI 使用 explicit connectionId、exact GitHub provider、remote re-resolution 与原子 connection reference。
- [x] T029 [US3] 在 `apps/control-plane/app/_components/project-create-modal.tsx` 实现 Repository row、Change、Name/Slug/Default Agent/Runtime settings、submit pending/error/success 与详情导航。
- [x] T030 [US3] 在 `apps/control-plane/app/projects/page.tsx` 删除 inline `ProjectCreateForm`，把页面保留为 list/object surface，并更新 empty-state 指引使用 shell Add Project。
- [x] T031 [US3] 删除不再使用的 `apps/control-plane/app/projects/_components/project-create-form.tsx`，保留/重命名其 model tests 作为 Modal reducer contract，并通过精确 import audit。

**Checkpoint**：API re-resolution 与 UI model tests 通过；浏览器完整创建 flow，成功进入 Project detail，失败保留字段。

---

## Phase 6: User Story 4 - Same App connection for Runner delivery

**Goal**：Runner 以 Project connection 的短期 installation token 完成 clone、push 与 PR，不读取 repository PAT。

**Independent Test**：私有仓库 Session 从 secret-free claim 经 credential exchange 运行至 PR；删除/撤销 installation 后 fail closed。

### Tests

- [ ] T032 [P] [US4] 在 `apps/control-plane/app/api/routes.test.ts` 添加 Runner credential endpoint 的 bearer auth、assignment、connection/provider mismatch、no-store headers、sanitized error 和 success contract tests。
- [x] T033 [P] [US4] 在 `apps/runner-daemon/src/repo-providers/github.test.ts` 改写为 explicit ephemeral credential tests，覆盖 push/review/auth-invalid/redaction/askpass cleanup 且 process env 无 GitHub repository token。
- [ ] T034 [P] [US4] 在 `apps/runner-daemon/src/direct-execution.test.ts` 和 `container-task.test.ts` 添加 clone phase-only `MYSTRA_REPOSITORY_TOKEN`、no global env、no event/result propagation regression tests。

### Implementation

- [x] T035 [US4] 在 `apps/control-plane/app/api/runner/sessions/[id]/repository-credential/route.ts` 实现 Runner-authenticated、assignment-checked、provider-matched、no-store installation credential exchange。
- [x] T036 [US4] 在 `apps/runner-daemon/src/repo-providers.ts` 和 `repo-providers/github.ts` 把 ephemeral credential 作为独立 in-memory 参数传入 push/review，并保持 GitLab env behavior 不变。
- [ ] T037 [US4] 在 `apps/runner-daemon/src/repository-credential.ts` 和 `index.ts` 添加 per-phase credential fetch，将 clone 使用限制为 phase environment，并删除 `repositoryAuthBinding`/`repositoryPhaseEnvironment` 的 GitHub PAT 分支。
- [ ] T038 [US4] 在 `apps/runner-daemon/src/repository-credential.test.ts` 添加 claim secret-free、credential endpoint called before repository phases、wrong response、expiry/revocation fails closed 测试。

**Checkpoint**：Runner focused tests 通过；精确搜索无 production `MYSTRA_GITHUB_TOKEN`；GitLab provider tests 无回归。

---

## Phase 7: Polish, documentation and full verification

- [x] T039 [P] 更新 `apps/control-plane/src/lib/integrations/README.md`、`docs/RUNNER-DOCKER-MVP.md`、`docs/RUNNER-ENVIRONMENT.md` 和 `scripts/doctor-local.sh`，记录 App variables、setup/callback、Agent token 区分与 removal audit。
- [ ] T040 [P] 更新 `specs/039-github-project-onboarding/prototype.md`、`checklists.md`、`quickstart.md` 和生成的 `index.html`，使 review artifact 与 landed behavior 一致。
- [ ] T041 运行 focused tests、`pnpm test`、`pnpm typecheck`、`pnpm build`、`git diff --check` 和 secret/terminology audits，修复任何 regression 而不修改已批准 contract。
- [ ] T042 使用真实浏览器验证 Settings connect/reconnect 与 Add Project 的 loading/empty/error/pagination/select/change/submit、route stability、keyboard、console/network 和响应式布局。
- [ ] T043 使用真实 GitHub App 和全新 private test repository 验证 install/OAuth、repository list/resolve、Project create、Runner clone/push/PR，并记录不含秘密的 evidence。
- [ ] T044 运行 `gitnexus_detect_changes(scope: all)`，核对 connection、Project、API、shell 与 Runner execution flows；HIGH/CRITICAL 意外影响必须在交付前解决。

**Final Checkpoint**：四条用户故事独立可验收，所有 success criteria 有证据，0 secret leakage，0 PAT fallback。

## Dependencies

```text
T001-T002
   |
T003-T008  shared + persistence foundation
   |
   +--> T009-T016  US1 connection
   |         |
   +---------+--> T017-T024  US2 repository modal
                        |
                        +--> T025-T031  US3 Project create
                                      |
                                      +--> T032-T038  US4 Runner delivery
                                                     |
                                                     +--> T039-T044 verification
```

- US1 depends on foundational connection persistence.
- US2 depends on an active connection and installation-scoped RepoProvider.
- US3 depends on the selected connection/repository contract.
- US4 depends on Project connection persistence and private Runner credential contract.
- T017/T018/T019、T025/T026/T027、T032/T033/T034 are safe test-writing parallel opportunities after their input contract freezes.
- Current task uses one dirty worktree and no subagents, so implementation remains sequential despite module-level lanes.

## Independent Test Criteria

- **US1**：spoofed install rejected; verified installation shown in Settings; no OAuth/installation token durable.
- **US2**：route-stable Modal loads every cursor page state and selects a repository from the App scope.
- **US3**：selection collapses into Repository row, remaining settings appear, server re-resolves exact connection, error retains fields.
- **US4**：private repository clone/push/PR succeeds with App token only; removal/revocation fails closed.

## Implementation Strategy

1. Freeze shared/DB contracts before touching UI or Runner.
2. Complete US1 and verify security negatives before exposing repository selection.
3. Complete US2 and US3 as route-stable vertical UI/API slices.
4. Complete US4 before declaring Project onboarding usable; discovery-only success is not completion.
5. Finish with real App E2E and secret audit, then reconcile Spec-Kit artifacts.

## Format Validation

- 44 tasks, sequential IDs T001-T044.
- User-story tasks include `[US1]` through `[US4]`.
- `[P]` appears only where files and incomplete dependencies do not overlap.
- Every task includes exact file paths or an exact verification command/surface.
