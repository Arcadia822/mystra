# Tasks: 远程仓库 Integration 与 Project 强绑定

**Input**: `spec.md`、`plan.md`、`research.md`、`data-model.md`、`contracts/`
**Tests**: 本功能改变共享合同、外部 Integration、持久化、Runner 与 UI；每个切片必须先有失败测试。

## Phase 1: Contract foundation

- [x] T001 [US1] 在 `packages/shared/src/repository.test.ts`、`issue.test.ts`、`management.test.ts` 添加 Repository selector/snapshot/list、Issue repository scope、Project request/view 的失败与成功合同测试。
- [x] T002 [US1] 在 `packages/shared/src/repository.ts`、`issue-core.ts`、`schemas.ts`、`management.ts` 实现 provider-neutral contracts，并删除 Project/Job legacy `repo`。
- [x] T003 [US4] 更新 branch/review delivery contracts 使用 `RepositorySnapshot` 与开放 provider key，验证现有 GitHub/GitLab delivery result 行为。

**Checkpoint**: `pnpm --filter @mystra/shared test` 与 typecheck 通过；精确搜索无 shared legacy Project/Job repo。

## Phase 2: Integration plugins

- [x] T004 [US2] 在 registry tests 中先覆盖 descriptors、duplicate names、capability mismatch、missing repositories capability 与第三方 fake plugin。
- [x] T005 [US2] 扩展 `integrations/types.ts`、`registry.ts`、`errors.ts`，实现 `IntegrationPlugin`、`RepoProvider`、扩展的 `IssueProvider` 和 list descriptors。
- [x] T006 [US2] 把 Linear 组装为显式 plugin factory，并保持现有 read-only list/get、pagination 与错误测试。
- [x] T007 [US1] 为 GitHub repository list/get 编写 mocked REST tests，覆盖 pagination、archived、not found、auth、rate limit、timeout、invalid JSON/shape。
- [x] T008 [US3] 为 GitHub issue list/get 编写 mocked REST tests，覆盖 required repository scope、PR filtering、empty、not found 与错误语义。
- [x] T009 [US1] 实现 `integrations/github.ts`，以 `MYSTRA_GITHUB_TOKEN` 提供 repositories + issues，并在 default registry 注册 GitHub 与 Linear。

**Checkpoint**: Integration tests 全部通过；registry 不含 provider-specific branch。

## Phase 3: Persistence and canonical API

- [x] T010 [US1] 更新 SQLite tests，覆盖 `repository_snapshot` persistence、atomic create/update、Job freeze、Project 后续更新不修改 Job 与 legacy schema rejection。
- [x] T011 [US1] 修改 migrations、RdbProvider 与 SqliteRdbProvider，Project/Job 只持久化 resolved Repository snapshot；删除 job override。
- [x] T012 [US1] 为 Project resolver service 添加 tests：selector resolve、default branch、archived repo、capability/provider failure 与 zero partial write。
- [x] T013 [US1] 实现 Project request resolver，并让 POST/PATCH routes 异步 resolve 后调用 RdbProvider。
- [x] T014 [US2] 添加 `GET /api/integrations` 与 repository list/resolve routes 的 route tests 和实现。
- [x] T015 [US3] 扩展 Issue routes 与 dispatch tests，支持 GitHub repository scope；dispatch 从 Project snapshot 提供 scope。
- [x] T016 [US3] 更新 MCP/Job routes 与 schemas，删除公共 repo override，并验证 API submission 始终从 Project snapshot 冻结 repository。

**Checkpoint**: Control Plane focused tests 通过；API negative tests 证明无部分写入。

## Phase 4: Thin CLI and Web UI

- [x] T017 [US1] 先更新 operator CLI tests，覆盖 integrations list、repositories list/get、projects create、GitHub scoped issues 与 stable exit codes。
- [x] T018 [US1] 实现 CLI flags/commands，仅调用 canonical API；更新 human-readable repository/project output。
- [x] T019 [US1] 添加 Projects 页面 component tests 或可测试 reducer，覆盖 repository picker loading/error/empty/selection、validation 与 double submit。
- [x] T020 [US1] 实现 `/projects` 的 GitHub remote repository picker 与 Project create；更新 detail 显示 Repository snapshot，不增加通用 Issues UI。
- [x] T021 [US2] 在 Project 页面呈现 GitHub/Linear capability descriptor 摘要，并保持 Integration-specific Issue 展示延期。

**Checkpoint**: CLI/API JSON parity；browser 页面可完成与 CLI 相同的 Project creation journey。

## Phase 5: Runner migration

- [x] T022 [US4] 先更新 Runner tests，覆盖 snapshot provider selection、clone URL、missing provider、missing snapshot 与无 hostname/local fallback。
- [x] T023 [US4] 将 Runner interface 改为 `RepoDeliveryProvider`，让 claim、direct execution、push/review 消费 Repository snapshot。
- [x] T024 [US4] 删除 active runner path 的 repository hostname inference 与 `job.spec.repo`，更新 environment/execution spec projections。

**Checkpoint**: Runner focused tests 通过；GitNexus 显示 execution flows 只消费结构化 snapshot。

## Phase 6: Real E2E

- [x] T025 [US1] 使用本机 GitHub 授权创建唯一 private 测试 repository，提交 deterministic Web fixture 并创建 GitHub Issue；记录无 secret evidence。
- [x] T026 [US2] 使用真实 API/CLI 验证 GitHub repository list/get、GitHub Issue list/get 与 Linear Issue list/get。
- [x] T027 [US1] 用 CLI 从新 repository 创建 Project，再用 Web UI 读取/创建等价 Project 并比较关键 JSON 字段。
- [x] T028 [US3] 从新 GitHub Issue dispatch，运行 Docker/Copilot autopilot，验证 test/build/preview/push/PR 与 `waiting_for_review`。
- [x] T029 [US4] 验证 retained sandbox、preview URL、branch、PR 与 structured result 全部指向新 repository。

## Phase 7: Closure

- [x] T030 更新 `PRODUCT.md`、`PLATFORM.md`、`PROCESS.md`、Integration/DB/Runner local docs，消除 current-MVP local repository 描述。
- [x] T031 运行 removal audit、lint、typecheck、全部 tests、build、Spec-Kit analyze/status/doctor 与 `git diff --check`。
- [x] T032 用真实浏览器验证 `/projects` 和详情页的 loading/error/empty/success、keyboard、responsive、console/network，并保留最终 Project 页。
- [x] T033 运行 `gitnexus_detect_changes`，检查共享合同、API、persistence 与 Runner execution flows 的实际影响。
- [x] T034 更新 evidence、Spec View、tasks completion，执行 code review gate 并提交 scoped feature changes。

## Dependencies

- T001 → T002 → T003。
- T004/T007/T008 可在 T002 后分别编写测试；T005 → T006/T009。
- T010/T012/T014/T015/T016 在合同冻结后可写失败测试；实现顺序 T011 → T013 → T14-T16。
- T017/T019 依赖 API contract；T018/T020/T021 依赖相应 tests。
- T022 → T023 → T024。
- T025-T029 依赖 Phase 1-5 与本机 external authorization。
- T030-T034 在 runtime evidence 完成后执行。

## Verification discipline

- 每项实现先运行最窄 test，再运行 package test。
- Phase checkpoint 失败时停止进入下一阶段。
- 不通过修改测试期望来掩盖缺失的 remote-only行为。
- E2E repository 保留供 owner review，不自动删除。
