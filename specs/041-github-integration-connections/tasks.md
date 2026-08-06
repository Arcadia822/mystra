# Tasks: GitHub Integration 多连接与 PAT

**Input**: `/specs/041-github-integration-connections/` 下的 `spec.md`、`plan.md`、`research.md`、`data-model.md`、`contracts/` 与 `quickstart.md`

**Tests**: 本功能改变共享合同、秘密持久化、SQLite schema、授权路由与核心 UI，所有行为任务遵循 TDD：先写失败测试，再实现，再运行聚焦验证。

**Organization**: 任务按用户故事组织；共享合同、schema v5 与精确凭据解析是所有故事的阻塞基础。

## Phase 1: Setup

**Purpose**: 固化实现基线与全局配置合同。

- [ ] T001 在 `specs/041-github-integration-connections/quickstart.md` 核对 Node 24.14.0、pnpm 10.25.0、schema v5 与 PAT master key 的本地验证命令
- [ ] T002 [P] 在 `apps/control-plane/src/lib/integrations/README.md` 记录 App/PAT 不 fallback、精确 connection ID 与秘密边界
- [ ] T003 [P] 在 `apps/control-plane/src/lib/db/README.md` 记录 schema v5、opaque credential reference 与 v4 保序迁移约束

---

## Phase 2: Foundational

**Purpose**: 建立公共合同、内部记录、SecretProvider、schema v5 与精确 connection credential resolver；完成前不得开始 UI 故事。

- [ ] T004 [P] 在 `packages/shared/src/integrations.test.ts` 为 App/PAT public connection、管理输入与 public response 禁止 token/ref 编写失败合同测试
- [ ] T005 [P] 在 `packages/shared/src/schemas.test.ts` 为 Project create 的 optional Agent/runtime override 与 resolved Project required defaults 编写失败测试
- [ ] T006 在 `packages/shared/src/integrations.ts` 与 `packages/shared/src/management.ts` 实现多连接 public schemas、PAT 管理输入和稳定错误合同
- [ ] T007 在 `packages/shared/src/schemas.ts` 实现 Project create optional defaults，同时保持 resolved Project 的 Agent/runtime 必填
- [ ] T008 [P] 在 `apps/control-plane/src/lib/projects/project-defaults.test.ts` 为环境覆盖、内建默认值与无效空值编写失败测试
- [ ] T009 在 `apps/control-plane/src/lib/projects/project-defaults.ts` 实现 `readProjectDefaults()`，默认 `copilot` 与 `mystra-runner:local`
- [ ] T010 [P] 在 `apps/control-plane/src/lib/secrets/encrypted-file-secret-provider.test.ts` 为 AES-GCM round-trip、错误 key/auth tag、权限与 path traversal 编写失败测试
- [ ] T011 在 `apps/control-plane/src/lib/secrets/secret-provider.ts` 与 `apps/control-plane/src/lib/secrets/encrypted-file-secret-provider.ts` 实现 `SecretProvider` 和安全文件实现
- [ ] T012 在 `apps/control-plane/src/lib/db/sqlite-provider.test.ts` 为 exact v4→v5 migration、多 active connection、稳定 upsert、Project 引用删除阻塞和 unknown schema fail-closed 编写失败测试
- [ ] T013 在 `apps/control-plane/src/lib/db/rdb-provider.ts` 定义 public/internal record 分离和 connection-level persistence 方法
- [ ] T014 在 `apps/control-plane/src/lib/db/migrations.ts` 与 `apps/control-plane/src/lib/db/sqlite-provider.ts` 实现 schema v5 保序迁移并移除 integration-wide active unique index
- [ ] T015 [P] 在 `apps/control-plane/src/lib/integrations/github-credential.test.ts` 为 App/PAT dispatch、单连接便利解析、多连接缺 ID 和 inactive/no-fallback 编写失败测试
- [ ] T016 在 `apps/control-plane/src/lib/integrations/github-credential.ts` 与 `apps/control-plane/src/lib/db/index.ts` 实现 exact connection credential resolver 和 SecretProvider composition root
- [ ] T017 运行 `pnpm --filter @mystra/shared test` 与 `pnpm --filter @mystra/control-plane test -- src/lib/db src/lib/secrets src/lib/projects/project-defaults src/lib/integrations/github-credential`，修复基础阶段回归

**Checkpoint**: 公共响应不含 secret ref，v4 数据可保序升级，多条连接可同时 active，App/PAT 只能按精确连接解析。

---

## Phase 3: User Story 1 - GitHub Detail 管理全部连接 (Priority: P1)

**Goal**: Settings → Integrations 下钻到 GitHub Detail，并展示所有连接的真实状态与操作。

**Independent Test**: 准备两条不同类型连接，进入 Detail 后分别看到身份、方式、仓库摘要、状态、时间和操作；刷新 URL 仍恢复 Detail。

- [ ] T018 [P] [US1] 在 `apps/control-plane/app/api/integration-connections.test.ts` 为连接集合、公共 mapper、数量/状态摘要与 no-store 编写失败 API 测试
- [ ] T019 [P] [US1] 在 `apps/control-plane/app/_components/github-connection-model.test.ts` 为 loading/empty/full/error/disabled/permission-limited 状态编写失败 model 测试
- [ ] T020 [US1] 在 `apps/control-plane/app/api/integration-connections/route.ts` 实现多连接 public list 与安全状态摘要
- [ ] T021 [US1] 在 `apps/control-plane/app/_components/github-connection-model.ts` 与 `apps/control-plane/app/_components/github-integration-detail.tsx` 实现 Detail 状态模型和 Castrel-style connection rows
- [ ] T022 [US1] 在 `apps/control-plane/app/_components/shell-settings-panels.tsx` 与 `apps/control-plane/app/_components/shell-settings.tsx` 接入 Integrations → GitHub Detail、返回导航和 URL 状态恢复
- [ ] T023 [US1] 在 `apps/control-plane/app/_components/shell-copy.ts` 增加 GitHub Detail 的中英文 loading、empty、error、状态与操作文案

**Checkpoint**: GitHub Detail 可独立加载、重试、返回、关闭，并且公开 DOM/响应不出现凭据或 secret ref。

---

## Phase 4: User Story 2 - 多 GitHub App 安装连接 (Priority: P1)

**Goal**: 重复安装/授权不同 GitHub App installation 时同时保留连接；重连同一 installation 原地更新。

**Independent Test**: 依次授权两个 installation，确认二者 active；再次授权第一个只更新对应记录。

- [ ] T024 [US2] 在 `apps/control-plane/src/lib/integrations/github-app.test.ts` 与 `apps/control-plane/app/api/integration-connections.test.ts` 为第二 installation、不唯一 installation 选择和取消回调不破坏旧连接编写失败测试
- [ ] T025 [US2] 在 `apps/control-plane/src/lib/integrations/github-app.ts` 与 `apps/control-plane/app/api/integration-connections/github/oauth/callback/route.ts` 改用 connection-level App upsert 并返回 GitHub Detail URL
- [ ] T026 [US2] 在 `apps/control-plane/app/api/integration-connections/github/connect/route.ts` 与 `apps/control-plane/app/api/integration-connections/github/setup/route.ts` 保留 PKCE/setup 安全流并携带 Detail return target
- [ ] T027 [US2] 在 `apps/control-plane/app/_components/github-connection-form.tsx` 增加显式 GitHub App 添加方式及 OAuth 返回错误呈现

**Checkpoint**: 多 App installation 不互相停用，同一 installation 稳定去重，失败/取消不改变已有连接。

---

## Phase 5: User Story 3 - PAT 连接生命周期 (Priority: P1)

**Goal**: 显式创建、验证、替换和删除 PAT 连接，且明文不进入 RDB、公开 API、DOM 或日志。

**Independent Test**: 有效 PAT 可创建并浏览 repo；失败替换保留旧 token；被 Project 引用时删除返回 409；泄露扫描为 0。

- [ ] T028 [P] [US3] 在 `apps/control-plane/src/lib/integrations/github-pat.test.ts` 为 identity/repository validation、0 repo、401/403/rate-limit 与安全 fingerprint 编写失败测试
- [ ] T029 [P] [US3] 在 `apps/control-plane/app/api/integration-connections/github/pat/route.test.ts` 为 create/replace/delete、rollback、in-use 409 和 public shape 编写失败 API 测试
- [ ] T030 [US3] 在 `apps/control-plane/src/lib/integrations/github-pat.ts` 实现无副作用 PAT validation、能力摘要和非公开 fingerprint
- [ ] T031 [US3] 在 `apps/control-plane/src/lib/integrations/github-pat-service.ts` 实现 validation-before-write、replacement 与补偿删除事务编排
- [ ] T032 [US3] 在 `apps/control-plane/app/api/integration-connections/github/pat/route.ts` 与 `apps/control-plane/app/api/integration-connections/github/pat/[id]/route.ts` 实现 PAT create/replace 管理 API
- [ ] T033 [US3] 在 `apps/control-plane/app/api/integration-connections/[id]/route.ts` 实现 Project 引用检查、先标记 inactive 再删除 secret/metadata 的可诊断删除和稳定错误
- [ ] T034 [US3] 在 `apps/control-plane/app/_components/github-connection-form.tsx` 与 `apps/control-plane/app/_components/github-integration-detail.tsx` 接入 PAT 创建、替换、删除确认与 disabled 状态

**Checkpoint**: PAT 连接完整可管理；失败替换不破坏旧凭据；所有公开边界都无法回显 token 或 opaque ref。

---

## Phase 6: User Story 4 - 精确连接的 Project onboarding (Priority: P1)

**Goal**: Add Project 仅选择 Connection、Repository、Name、Slug；服务端解析全局 Agent/image 默认值并固化，发现与交付使用同一连接。

**Independent Test**: 使用一条 App 与一条 PAT 分别创建 Project，repo 列表互相隔离，Project 保存 exact connection 和 resolved defaults，Runner 只签发绑定凭据。

- [ ] T035 [P] [US4] 在 `apps/control-plane/app/projects/_components/project-create-model.test.ts` 为单连接预选、多连接确认、切换清空和 repo 收起编写失败测试
- [ ] T036 [P] [US4] 在 `apps/control-plane/src/lib/projects/resolve-project-input.test.ts` 为 exact connection、optional UI defaults 与 server-resolved defaults 编写失败测试
- [ ] T037 [P] [US4] 在 `apps/control-plane/src/lib/integrations/registry.test.ts` 为 exact App/PAT repo provider、缺 ID 多连接错误和 no-fallback 编写失败测试
- [ ] T038 [P] [US4] 在 `apps/control-plane/app/api/integration-connections.test.ts` 为 repo list/resolve connection isolation 与 Project create exact binding 编写失败 API 测试
- [ ] T039 [US4] 在 `apps/control-plane/src/lib/integrations/registry.ts`、`apps/control-plane/app/api/integrations/[integration]/repositories/route.ts` 与 `apps/control-plane/app/api/integrations/[integration]/repositories/resolve/route.ts` 接入 exact connection credential resolver
- [ ] T040 [US4] 在 `apps/control-plane/src/lib/projects/resolve-project-input.ts` 与 `apps/control-plane/app/api/projects/route.ts` 接入全局 defaults 并固化 resolved Project
- [ ] T041 [US4] 在 `apps/control-plane/app/projects/_components/project-create-model.ts` 与 `apps/control-plane/app/_components/project-create-modal.tsx` 实现 connection-first repo flow，并删除 Agent/image 控件与请求字段
- [ ] T042 [US4] 在 `apps/control-plane/app/api/runner/sessions/[id]/repository-credential/route.ts` 接入 exact App/PAT credential resolver，保持 assignment 检查与 no-store
- [ ] T043 [US4] 在 `apps/control-plane/app/api/integration-connections.test.ts` 增加 Runner App/PAT credential、inactive binding 和无 fallback 回归测试

**Checkpoint**: Project onboarding 与 Runner delivery 均由同一 `repositoryConnectionId` 决定；Modal 不显示 Agent 或镜像。

---

## Phase 7: Polish & Cross-Cutting Verification

**Purpose**: 收拢文档、可访问性、安全性和真实运行证据。

- [ ] T044 [P] 更新 `specs/041-github-integration-connections/prototype.md` 与 `specs/041-github-integration-connections/mockups/index.html` 的最终实现差异和状态说明
- [ ] T045 [P] 更新 `.env.example` 与 `specs/041-github-integration-connections/quickstart.md`，只记录 secret store key/path 和 Project defaults 配置名，不写真实秘密
- [ ] T046 运行 focused tests、`pnpm typecheck`、`pnpm test`、`pnpm build`，并记录所有真实退出码
- [ ] T047 在真实应用中按 320/768/1024/1440px 验证 Settings Detail、PAT 表单、Add Project 键盘/焦点/错误状态和无页面级水平滚动
- [ ] T048 执行 RDB、HTTP response、浏览器 DOM/console 与日志的 PAT 明文泄露审计，并确认公开 connection JSON 不含 `credentialRef`
- [ ] T049 运行 `gitnexus_detect_changes()`，核对只影响 GitHub connection、Project onboarding、Runner credential 与预期文档执行流
- [ ] T050 重新运行 `node scripts/render-spec-view.mjs --feature 041-github-integration-connections` 并在 Spec View 中核对规格、计划、任务与验证证据

---

## Phase 8: OSS Self-hosted PAT-only enforcement

**Goal**: Stock OSS control-plane 只公开和渲染 PAT 添加方式；保留 GitHub App domain code，但所有 App runtime 入口在外部副作用前 fail closed。

**Independent Test**: 即使配置完整 `MYSTRA_GITHUB_APP_*`，连接方式 API 仍只返回 PAT；Settings DOM 不出现 GitHub App 添加方式；connect/setup/callback 返回稳定 `HOSTED_ONLY`；默认 repo/Runner credential resolver 不 mint App token。

- [x] T051 [P] 为 self-hosted PAT-only method list、UI projection、三个 App route 和 exact credential resolver 编写失败测试
- [x] T052 在 shared error contract 与 `apps/control-plane/src/lib/integrations/deployment-capabilities.ts` 定义稳定 Hosted-only guard
- [x] T053 在 connection list、connect/setup/callback 与默认 GitHub credential resolver 接入 stock self-hosted policy
- [x] T054 在 GitHub Detail 与 Settings 摘要中仅渲染 API 返回的方法，self-hosted 只出现 PAT
- [x] T055 更新模块文档、Spec View，并运行 focused tests、typecheck、build、真实浏览器与泄露检查

---

## Dependencies & Execution Order

- **Phase 1 → Phase 2**：先固定配置与文档边界，再落 shared/storage foundation。
- **Phase 2 → US1/US2/US3/US4**：所有用户故事依赖同一个多连接 schema 与 exact credential resolver。
- **US1 → US2/US3**：Detail shell 先存在，App/PAT 管理行为再进入该 Detail。
- **US2 + US3 → US4**：Project selector 需要至少两种可列出的 connection type；实现按 App、PAT、Project 顺序验证。
- **Phase 7**：依赖所有选择交付的用户故事完成。
- **Phase 8**：覆盖旧任务中的 App 本地可用假设；必须在 stock OSS 验收前完成。

## Parallel Opportunities

- T004/T005、T008/T010、T018/T019、T028/T029、T035/T036/T037 可在合同冻结后按不同文件并行编写测试。
- 实际实现应保持顺序：shared → DB/secret → credential resolver → API → UI；这些文件共享类型与持久化合同，盲目并行只会制造冲突。

## Implementation Strategy

1. 先完成 Phase 2，并证明 v4 migration、秘密存储和 no-fallback 约束。
2. 完成 US1，使真实连接集合可见。
3. 完成 US2 与 US3，使 App/PAT 都能进入同一管理面。
4. 完成 US4，删除 Add Project 的 Agent/image 深层配置，并验证 end-to-end provenance。
5. 每个红灯测试先观察失败，再做最小实现；每个 checkpoint 运行聚焦套件，最后运行全套与真实浏览器验证。
