# Implementation Plan: 远程仓库 Integration 与 Project 强绑定

**Branch**: `037-remote-repository-integrations` | **Date**: 2026-07-25 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/037-remote-repository-integrations/spec.md`

## Summary

把 repository 从 Project 上的任意字符串提升为由 Integration RepoProvider 解析的结构化远程事实。GitHub Integration 同时实现 Repository 与 Issue capability，Linear Integration 保持只读 Issue capability。Project create/update 在写入 SQLite 前完成远端 resolve；Job、ExecutionSpec、Runner claim 与 Review 使用冻结的 `RepositorySnapshot`。旧 `repo` 字段、本地路径与 job override 一次性删除。

## Technical Context

**Language/Version**: TypeScript 5.9，Node.js 24.14.0
**Primary Dependencies**: Next.js 16 Route Handlers、React 19、Zod 4、Vitest 4、`better-sqlite3`、GitHub REST API、Linear GraphQL API、Node `child_process`、Docker Engine CLI
**Storage**: `SqliteRdbProvider`；Project 与 Job 保存 JSON `repository_snapshot`，旧开发库 clean rebuild
**Testing**: Vitest contract/unit/integration tests，CLI parity tests，真实 API smoke，Docker/Copilot/GitHub E2E，浏览器验收
**Target Platform**: headless Mystra control plane 与单机 Docker runner；合同不依赖宿主机本地 repository
**Project Type**: TypeScript monorepo web service + CLI + runner daemon + Web UI
**Performance Goals**: Repository/Issue list 默认最多 25 条、最多 100 条；第三方请求 15 秒 timeout；单次 Project create 只做一次 provider resolve
**Constraints**: API canonical；第三方响应必须验证；secret 不持久化；不新增 OAuth/webhook/write-back；不使用现有 repository 做 E2E
**Scale/Scope**: 当前默认 2 个 Integration、1 个 RepoProvider implementation、2 个 IssueProvider implementations；契约支持后续 provider 注册

## Constitution Check

### Pre-design

- Specification owns boundaries：PASS。明确移除 local repository；不引入排除项。
- Typed contracts：PASS。Repository selector/snapshot、provider inputs/outputs、errors、HTTP payload 全部由 shared Zod schema 拥有。
- Replaceable providers：PASS。Integration registry 只解析 capability；GitHub/Linear 是实现，不进入 Project 核心分支。
- Isolation and secrets：PASS。`MYSTRA_GITHUB_TOKEN` 与 `LINEAR_API_KEY` 仅在 provider 请求阶段使用。
- Verification and docs：PASS。包含 provider contract、Project persistence、Runner E2E 与页面验收。

### Post-design

- Runner delivery 与 Integration discovery 分离，避免 Control Plane provider 实例进入 Runner 热路径：PASS。
- Project repository 在 dispatch 时冻结，Runner 不重新查询 Integration：PASS。
- Web API 为 canonical implementation，CLI/UI 均不直接访问 GitHub/Linear：PASS。
- GitLab 只作为未来 capability implementation，不作为当前默认插件：PASS。
- WorkflowProvider/blueprint/node 未恢复：PASS。

## Architecture

```text
GitHub Integration plugin
  ├── RepoProvider.list/get ──> RepositorySnapshot
  └── IssueProvider.list/get ─> IssueSnapshot (+ repository reference)

Linear Integration plugin
  └── IssueProvider.list/get ─> IssueSnapshot

API / CLI / Web UI
  └── Project create { repository: RepositorySelector }
        └── IntegrationRegistry.requireRepoProvider()
              └── resolve before transaction
                    └── Project.repository: RepositorySnapshot
                          └── Job.repository snapshot
                                └── ExecutionSpec / Runner claim
                                      └── RepoDeliveryProvider
                                            └── clone / push / PR
```

### Contract ownership

1. `packages/shared/src/repository.ts` owns provider-neutral repository schemas.
2. `apps/control-plane/src/lib/integrations/types.ts` owns runtime provider interfaces over those schemas.
3. Integration modules own third-party request/response validation and normalization.
4. Project route/service owns selector-to-snapshot resolution.
5. `RdbProvider` persists only resolved snapshots and never invokes external providers.
6. Runner `RepoDeliveryProvider` consumes frozen snapshots and never discovers repositories.

### Data flow

#### Project creation

1. Client submits Project config plus `{ integration, identifier }`.
2. Route validates `projectCreateRequestSchema`.
3. Registry resolves Integration and requires `repositories` capability.
4. RepoProvider refetches GitHub repository and returns validated snapshot.
5. Route creates a resolved persistence input; SQLite transaction inserts Project.
6. API returns Project with the same snapshot consumed by CLI and UI.

#### Issue dispatch

1. Route validates Project and reads its Repository snapshot.
2. Registry selects the requested IssueProvider.
3. GitHub provider receives Project repository scope; Linear ignores optional scope.
4. Dispatch freezes Issue and Repository snapshots into Job.
5. Claim and execution spec carry the same snapshots.
6. Runner selects delivery implementation by `repository.provider`.

## Project Structure

### Documentation

```text
specs/037-remote-repository-integrations/
├── spec.md
├── features.md
├── checklists.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── prototype.md
├── mockups/index.html
├── contracts/
│   ├── providers.md
│   └── http-cli.md
├── checklists/
│   ├── requirements.md
│   └── engineering-review.md
├── evidence/
└── tasks.md
```

### Source code

```text
packages/shared/src/
├── repository.ts
├── issue-core.ts
├── schemas.ts
└── management.ts

apps/control-plane/src/lib/
├── integrations/
│   ├── types.ts
│   ├── registry.ts
│   ├── github.ts
│   └── linear.ts
├── projects/resolve-project-input.ts
└── db/

apps/control-plane/app/api/
├── integrations/
└── projects/

apps/control-plane/app/projects/
├── page.tsx
└── [slug]/page.tsx

apps/runner-daemon/src/
├── repo-providers.ts
└── index.ts

scripts/operator-cli.mjs
```

**Structure Decision**: 保持现有 monorepo 包边界；共享数据合同进入 `@mystra/shared`，第三方客户端只存在于 Control Plane Integration 模块，Runner 只保留交付实现。

## Migration

1. 删除 Project/Job 的 `repo` 字段并新增 `repository_snapshot TEXT NOT NULL`。
2. `ProjectCreate` 拆为公共 selector request 与已解析 persistence input。
3. 删除 API/MCP job submission 中的 repo override。
4. 删除 Runner hostname detection 作为 provider 选择依据。
5. 开发/测试数据库重建；不读取或自动迁移旧 schema。
6. 更新所有 fixture，任何 `local/*` repository fixture 都必须消失。

## Verification checkpoints

| Checkpoint | Evidence |
|---|---|
| Shared contracts | repository、issue、management schema tests |
| Provider extensibility | registry fake capability tests |
| GitHub normalization | mocked REST tests，PR filtering，pagination/errors |
| Project atomicity | route + SQLite tests，provider failure zero rows |
| API/CLI/UI parity | same repository/project JSON key comparison |
| Runner contract | direct-execution and repo delivery tests |
| Real integrations | new GitHub repo + issue，Linear read-only smoke |
| Full E2E | Docker/Copilot/test/build/preview/push/PR/waiting_for_review |
| Removal audit | exact searches for local Project repo and job repo override |

## Risks

| Risk | Level | Mitigation |
|---|---|---|
| `repo` removal breaks many fixtures but misses one runtime path | High | Shared schema first，typecheck drives migration，GitNexus detect changes before commit |
| GitHub Issues endpoint returns PRs | Medium | Validate `pull_request` marker and filter before normalization |
| Provider resolve occurs before DB transaction and repository changes immediately afterward | Medium | Persist fetched timestamp and immutable snapshot；execution failures remain explicit |
| Encoded `owner/name` route ambiguity | Medium | Public Project selector accepts identifier in JSON；repository get uses query parameter contract |
| Existing dirty 5xP/spec work overlaps durable rule changes | Medium | Patch only scoped lines and stage feature-owned hunks separately |
| Real E2E consumes external resources and Copilot time | Medium | Create isolated private repository with deterministic tiny fixture and preserve it for review |

## GitNexus evidence

- `IntegrationRegistry`：MEDIUM，5 个直接 importers，主要为 Issue routes 与 dispatch。
- `Integration`：LOW，直接影响 registry、tests 与 Linear implementation。
- `projectSchema`：图索引报告 LOW，但文本与类型搜索显示 persistence、management、CLI、UI、Runner 有广泛结构依赖；按高风险 contract migration 处理。
- `dispatchIssue`：LOW，直接影响 dispatch route，并参与 POST execution flow。
- `SqliteRdbProvider.createProject`：LOW，直接测试依赖。
- `/api/projects*`：LOW direct-consumer signal，但存在未被 route graph 识别的 CLI/UI fetch；通过显式 parity tests 补足。

## Complexity Tracking

无 Constitution violation。新增 Provider capability 是项目既定边界，不是额外架构层。

## Engineering Review

**Status**: CLEAR
**Mode**: FULL_REVIEW
**Reviewed**: 2026-07-25

### Step 0: Scope Challenge

范围保持不变。将 local repository compatibility 留在 Project 或 Job 中会直接违背服务端部署目标；只给 Project 增加 URL regex 则无法证明 repository 存在。完整 selector → resolve → snapshot 迁移是最小的正确边界。

### What already exists

- `packages/shared/src/repository.ts` 已有 branch/review delivery schemas，复用并扩展 provider-neutral repository identity，不另建平行包。
- Runner 已有 GitHub/GitLab push/review implementations，保留具体实现并把接口明确改名为 `RepoDeliveryProvider`。
- Linear `IssueProvider`、Integration errors 与 registry 已存在，扩展 capabilities 而不是重写。
- Project API、CLI list/inspect 与 Web list/detail 已存在，在相同 route 上迁移 payload。
- 033 已证明 Docker/Copilot/GitHub 完整执行，可复用 runner fixture 与 E2E 操作顺序，但必须创建新的 repository。

### Architecture review

发现并在计划中解决 3 项：

1. `[P1] (confidence: 10/10)` Project 的任意 `repo` 字符串无法证明远端 identity。采用 Provider resolve 后的 snapshot。
2. `[P1] (confidence: 9/10)` Control Plane discovery 与 Runner delivery 都叫 RepoProvider 会混淆职责。Runner 接口改名为 `RepoDeliveryProvider`。
3. `[P1] (confidence: 9/10)` GitHub issue number 不是全局唯一。Issue input 增加 repository scope，dispatch 从 Project 自动注入。

### Code quality review

- registry 继续使用 capability lookup，不增加 provider switch。
- GitHub REST envelope 与每个 item 均由 Zod 校验，normalizer 不接受 passthrough secrets。
- Project request schema 与 persistence schema 分离，避免 DB 层意外持久化 selector。
- 删除 hostname guessing 与 job repo override，避免两套 source of truth。
- 多阶段数据流图保留在本 plan；实现代码只在不直观的 snapshot freeze 路径添加最小注释。

### Test coverage diagram

```text
CODE PATH COVERAGE PLAN
=======================
[+] IntegrationRegistry
    ├── [TEST] descriptor/capability alignment
    ├── [TEST] duplicate name
    ├── [TEST] missing Integration
    ├── [TEST] missing repositories capability
    └── [TEST] third-party fake plugin registration

[+] GitHubIntegration
    ├── [TEST] repository list/get + pagination
    ├── [TEST] issue list/get + required repository scope
    ├── [TEST] PR filtering
    ├── [TEST] empty/not-found
    └── [TEST] auth/rate-limit/timeout/invalid JSON/invalid shape

[+] Project create/update
    ├── [TEST] selector -> resolve -> snapshot -> insert
    ├── [TEST] missing/unauthorized repository -> zero rows
    ├── [TEST] local/path/file URL/legacy repo -> reject
    └── [TEST] repository replacement is atomic

[+] Job freeze and Runner claim
    ├── [TEST] Project snapshot -> Job snapshot
    ├── [TEST] Project later changes, Job remains immutable
    ├── [TEST] missing snapshot fails closed
    └── [TEST] delivery provider selected by snapshot.provider

USER FLOW COVERAGE PLAN
=======================
[+] [→E2E] GitHub repository -> Project via CLI
[+] [→E2E] Same Project visible in Web UI
[+] [→E2E] GitHub Issue -> dispatch -> Docker/Copilot -> test/build
    -> preview -> push -> PR -> waiting_for_review
[+] [→E2E] Linear Issue read-only smoke remains operational
[+] [BROWSER] repository picker loading/error/empty/success/retry
[+] [BROWSER] invalid submit, double submit prevention, narrow viewport, keyboard focus
```

所有新增分支在 tasks 中要求对应测试；没有已知未覆盖的回归路径。

### Failure modes

| Codepath | Production failure | Test | Handling | User-visible |
|---|---|---|---|---|
| GitHub repository list/get | 401/403/429/timeout/invalid body | required | stable Integration error | API/CLI/UI 明确错误与 retry |
| GitHub issue list/get | PR 混入或 scope 缺失 | required | filter / fail closed | 明确 scope 错误 |
| Project create | resolve 成功后 DB conflict | required | DB insert 原子失败 | 409 slug conflict |
| Project update | 新 repo resolve 失败 | required | 不写入旧 Project | 保留原 snapshot |
| Runner claim | snapshot provider 未注册 | required | fail closed before clone | Run failure reason |
| E2E | Copilot、Docker 或 preview 失败 | required evidence | structured Run result | Task detail 显示阶段 |

Critical silent gaps：0。

### Performance review

- Repository list 和 Issue list 有 1..100 bounds 与 opaque cursor，无无界 fetch。
- Project create/update 单次 resolve，不做 N+1。
- Project list 读取持久 snapshot，不逐项调用 GitHub。
- 不引入缓存；首次实现的授权可见性与 freshness 优先于缓存复杂度。

### NOT in scope

- GitLab 默认 Integration：当前产品明确只启用 GitHub 与 Linear；只保留可实现契约。
- GitHub Enterprise：需要 host configuration 与独立 credential policy。
- OAuth、webhook、Issue write-back：超出只读 MVP。
- Integration 安装/启停/secret management UI：需要独立安全与 tenancy 设计。
- 历史 SQLite 数据迁移：用户已允许删除历史数据，兼容会保留被禁止的 local 状态。
- 通用 Issues 页面：GitHub 与 Linear 展示逻辑不同，继续按 Integration 单独设计。

### Parallelization

顺序实现为主。共享 schemas 是所有切片的依赖；同一 worktree 内依次完成可减少 fixture 与 contract 冲突。

| Lane | Work | Depends on |
|---|---|---|
| A | shared repository/issue/project contracts | — |
| B | Integration registry + GitHub/Linear providers | A |
| C | persistence + Project/Issue API | A, B |
| D | CLI + Web UI | C |
| E | Runner migration + real E2E | A, C |

在 contract freeze 后 D 与 Runner 的非重叠实现可并行，但本任务未请求 sub-agent，保持单线以保护 dirty worktree。

### Review completion

- Step 0: scope accepted as-is
- Architecture Review: 3 issues found, all resolved in plan
- Code Quality Review: 4 guardrails added
- Test Review: diagram produced, 0 unresolved gaps
- Performance Review: 0 blocking issues
- NOT in scope: written
- What already exists: written
- TODOS.md updates: 0; deferred items already belong to explicit feature boundaries
- Failure modes: 0 critical gaps
- Outside voice: skipped；当前 plan 已由用户的明确模型约束与现有代码证据决定
- Parallelization: 5 dependency lanes, sequential execution selected
- Lake Score: 10/10 complete option selected

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | — |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | — | — |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | CLEAR | 3 issues, 0 critical gaps |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | prototype prepared |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | — |

**UNRESOLVED:** 0
**VERDICT:** ENG CLEARED — ready for task decomposition and implementation.
