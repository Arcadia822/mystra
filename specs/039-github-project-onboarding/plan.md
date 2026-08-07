# Implementation Plan: GitHub Project Onboarding

**Branch**: `039-github-project-onboarding` | **Date**: 2026-08-05 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/039-github-project-onboarding/spec.md`
**Supersession Notice (2026-08-06)**: `040-prisma-rdb` supersedes the persisted Project Repository snapshot below with a stable connection + external-ID binding. Task source, objective and Issue/Repository snapshots are removed, and `dispatchKey` becomes `issueDispatchKey`; current external-information cache is deferred. Session persistence and Session-specific delivery flows below are historical and not part of 040's three-table schema.

## Summary

把 GitHub App 安装连接变成 Project repository 的显式来源，并让控制面在需要时生成短期 installation token。Settings 完成安装、OAuth 用户校验和连接展示；Add Project 由全局 shell Modal 承担，先选仓库再渐进展示配置。Project 持久化非秘密 connection ID，Runner 在 clone、push、PR 前通过已有 Runner credential 调用专用 no-store endpoint 取得短期凭据；删除生产路径中的 `MYSTRA_GITHUB_TOKEN` 回退。

## Technical Context

**Language/Version**: TypeScript 5.9，Node.js 24.14.0  
**Primary Dependencies**: Next.js 16 Route Handlers、React 19、Zod 4、Node `crypto`、GitHub REST API、现有 Integration/Runner provider contracts  
**Storage**: SQLite via `RdbProvider`；只保存 IntegrationConnection 非秘密元数据和 Project connection reference  
**Testing**: Vitest 4；route/provider/model tests；真实浏览器验证；受控 GitHub App private-repository E2E  
**Target Platform**: 私有单节点 Mystra Control Plane + outbound Runner daemon  
**Project Type**: TypeScript monorepo，canonical Web API、secondary Next.js UI、独立 Runner daemon  
**Performance Goals**: Modal 本地状态切换在单帧内完成；仓库首屏受 GitHub 延迟支配且 15s fail closed；有效 installation token 在进程内复用至过期前 60s  
**Constraints**: OAuth user token 不持久化；installation token 不落库、不进日志/公共响应/证据；App 私钥不离开控制面；无 PAT fallback；Project 只接受 provider-resolved remote repository  
**Scale/Scope**: 一个当前 active GitHub connection、一个 Control Plane 进程、低并发操作员、100 个仓库/页并支持 cursor Load more；历史 connection 可供已绑定 Project 使用但不再作为新建默认值

## Constitution Check

### Pre-research gate

- Specification boundary：PASS。Constitution 2.3.0 已明确批准单一 GitHub App installation connection；caller login、webhooks、Issue write-back 和通用 Integration catalog 继续排除。
- Typed contracts：PASS。连接、Project selector/reference、Runner 私有 credential response 都使用共享 Zod contract。
- Replaceable providers：PASS。Connection 是 provider-neutral entity；GitHub OAuth/JWT/installation 逻辑只存在于 GitHub adapter/service。
- Runner isolation and secrets：PASS。App 私钥只在控制面；Runner 只通过已认证 session endpoint 得到短期 token，并仅在 clone/push/review 内存与子进程环境中使用。
- Verification and documentation：PASS。计划包含 contract、route、DB、Runner、UI model、browser 与真实 App E2E。

### Post-design gate

- `RepositorySelector.connectionId` 明确来源连接，服务端仍重新 resolve，不接受 clone URL。
- `IntegrationConnection` 只保存安装/账户/权限摘要；用户 token 和 installation token 均无持久字段。
- Runner claim 保持 secret-free；独立 POST credential route 使用 Runner bearer auth、session ownership check 和 `Cache-Control: no-store`。
- 现有 Linear provider 与 GitLab runner delivery 不被扩大或删除；GitHub 生产路径不再读取 `MYSTRA_GITHUB_TOKEN`。
- SQLite schema 升级遵循当前 exact-schema rebuild 纪律，不引入兼容 alias。

## Architecture

### Connection and onboarding flow

```text
Settings / Integrations
        |
        | GET /api/integration-connections
        v
 [Disconnected] --Connect--> GitHub App installation screen
                                  |
                                  | setup_url: installation_id (untrusted)
                                  v
                    OAuth start: state + PKCE cookies
                                  |
                                  v
                         GitHub user consent
                                  |
                                  | code + state
                                  v
                    exchange ephemeral user token
                                  |
                                  | GET /user/installations
                                  | exact installation_id + app_id must match
                                  v
             discard user token -> persist non-secret connection
                                  |
                                  v
                         Settings [Connected]
```

The GitHub setup callback is treated as a hint. It never writes a connection before the OAuth user token proves the same installation is accessible to that user.

### Repository discovery and Project creation

```text
Add Project (+)
    |
    v
ProjectCreateModal (route unchanged)
    |
    +-- no active connection --> Open Settings
    |
    +-- active connection
          |
          | GET /api/integrations/github/repositories?connectionId=...
          v
    GitHub RepoProvider --installation token--> /installation/repositories
          |
          v
    choose owner/name -> collapse picker -> setting rows
          |
          | POST /api/projects { repository: {integration, connectionId, identifier} }
          v
    resolve exact connection -> mint/reuse token -> GET /repos/owner/name
          |
          v
    atomically persist Project(repository snapshot + connectionId)
```

### Runner credential flow

```text
Runner claim (secret-free)
    |
    | before clone / push / review
    v
POST /api/runner/sessions/:id/repository-credential
    |
    +-- authenticate Runner bearer credential
    +-- verify Session assignment ownership
    +-- load Project.repositoryConnectionId
    +-- verify connection provider == repository provider
    +-- mint/reuse installation token in control-plane memory
    v
{ provider, username, secret, expiresAt }  [private, no-store]
    |
    +-- clone: process-scoped env only
    +-- push: in-memory credential argument, askpass temp file
    +-- PR: in-memory Authorization header
    v
discard Runner copy after phase / Session
```

No token is placed in Runner claim, Project, Task, Session, runtime contract, events, result, metadata or error text.

## Key Decisions

1. **Setup URL then OAuth validation**：GitHub’s installation screen chooses the account/repository scope; the untrusted `installation_id` is accepted only after a user access token lists that exact installation.
2. **Direct REST + Node crypto**：reuse the repository’s existing validated-fetch style; avoid adding an SDK only for JWT signing/token exchange. JWT, PKCE and response parsing remain isolated and exhaustively tested.
3. **Explicit connection reference**：`RepositorySelector` and `Project` carry `connectionId`; no active-connection inference during Project execution.
4. **Secret-free claim plus private exchange**：do not add installation token to the durable DB claim. Runner retrieves it with existing Runner authentication immediately before repository phases.
5. **In-memory token cache with expiry margin and single-flight**：reduce token mint calls without creating durable secret state or concurrent refresh bursts.
6. **Shared setting-row business component**：one Mystra-owned `SettingGroup`/`SettingRow` anatomy is reused by Settings Integrations and Project Modal. Castrel supplies layout evidence, not runtime dependency or palette.
7. **One active, historical immutable references**：reconnecting the same installation refreshes its metadata; connecting another installation marks the old record inactive for discovery while existing Projects retain their original connection.

## Project Structure

### Documentation

```text
specs/039-github-project-onboarding/
├── spec.md
├── features.md
├── checklists.md
├── checklists/requirements.md
├── prototype.md
├── mockups/index.html
├── plan.md
├── research.md
├── data-model.md
├── contracts/
│   ├── integration-connections.md
│   ├── project-onboarding.md
│   └── runner-repository-credential.md
├── quickstart.md
└── tasks.md
```

### Source code

```text
packages/shared/src/
├── integrations.ts             # connection contracts
├── repository.ts               # selector carries connectionId
├── schemas.ts                  # Project carries repositoryConnectionId
└── management.ts               # API and private Runner responses

apps/control-plane/src/lib/
├── db/
│   ├── rdb-provider.ts
│   ├── sqlite-provider.ts
│   └── migrations.ts
├── integrations/
│   ├── github-app.ts            # OAuth, JWT, install-token broker
│   ├── github.ts                # installation-scoped Repo/Issue provider
│   ├── registry.ts
│   └── README.md
└── projects/resolve-project-input.ts

apps/control-plane/app/
├── api/integration-connections/...
├── api/integrations/[integration]/repositories/route.ts
├── api/projects/route.ts
├── api/runner/sessions/[id]/repository-credential/route.ts
├── _components/
│   ├── app-shell.tsx
│   ├── shell-settings.tsx
│   ├── setting-row.tsx
│   ├── project-create-modal.tsx
│   └── shell-copy.ts
├── projects/_components/project-create-model.ts
└── projects/page.tsx

apps/runner-daemon/src/
├── index.ts
├── repo-providers.ts
└── repo-providers/github.ts
```

**Structure Decision**：沿用现有 shared → control-plane provider/API → secondary UI 与 runner-daemon 分层。新增一个 GitHub App service 和两个纯 UI business components；不引入新 package、独立 auth server 或 general Integration framework。

## Delivery Slices

1. Contract + SQLite：连接实体、Project connection reference、private Runner credential response、exact schema rebuild。
2. GitHub App adapter：OAuth state/PKCE、installation ownership verification、JWT/token broker、installation-scoped repository listing。
3. Canonical API：connection status/connect/setup/callback、repository connection query、Project re-resolution、Runner credential exchange。
4. Runner：just-in-time credential fetch、clone/push/review explicit credential flow、PAT path removal。
5. UI：shared setting rows、Settings integration state、global Add Project Modal、`/projects` list-only。
6. Verification：focused tests → package tests/typecheck/build → browser states → real GitHub App private repo E2E → secret audit → GitNexus detect changes。

## Test Coverage Map

```text
CONNECTION
  connect -> install redirect -> setup hint -> OAuth/PKCE
    ├── success + exact accessible installation        [route + service]
    ├── spoofed/unknown installation                   [security regression]
    ├── state/code/verifier missing or mismatched      [route]
    ├── canceled/timeout/rate-limit/invalid response   [service]
    └── reconnect same/new installation                [DB + route]

PROJECT
  modal -> active connection -> repository list -> choose -> create
    ├── disconnected/loading/empty/error/retry         [model + browser]
    ├── first page/load more/cursor failure            [model + route]
    ├── filter/select/change/double-submit              [model + browser]
    ├── stale/revoked repository at submit             [resolver + route]
    └── route unchanged + focus/Escape/narrow layout   [browser]

RUNNER
  claim -> credential exchange -> clone -> push -> PR
    ├── wrong Runner/session/provider                  [route]
    ├── revoked/missing connection                     [route]
    ├── token omitted from claims/events/results       [contract + audit]
    ├── installation credential passed explicitly      [runner/provider]
    └── no MYSTRA_GITHUB_TOKEN fallback                [regression + audit]
```

## Failure Modes

| Path | Production failure | Test | Handling | User visibility |
|---|---|---|---|---|
| OAuth start/setup | missing App configuration | route test | stable configuration error | Settings shows admin action |
| OAuth callback | forged state/install ID | security test | reject, clear transient cookies | reconnect error |
| token mint | private key invalid / GitHub timeout | service test | stable sanitized failure | repo list or Session fails clearly |
| repository list | installation has zero repos | provider/UI test | valid empty result | explicit empty state |
| Project submit | access revoked after selection | resolver test | no DB write | Modal preserves fields |
| credential exchange | wrong Runner or Session | route test | 401/404, no token mint | Runner records sanitized failure |
| clone/push/review | token expires/revoked | provider/E2E | fetch just-in-time; fail closed | Session failure without secret |
| token cache | concurrent refresh | broker test | single-flight + 60s margin | no visible duplication |

No silent critical path remains by design; implementation tests must prove each row.

## Performance

- GitHub repository list stays paginated at max 100 items per request. Modal exposes cursor-based Load more, appends de-duplicated items, and applies client-side filtering to all loaded pages.
- Installation token cache is process-local and bounded by historical GitHub connection count; entries expire and are replaced, never serialized.
- A single-flight promise per installation prevents duplicate token creation under concurrent API/Runner requests.
- OAuth and GitHub requests retain the existing 15s timeout and stable rate-limit errors.
- No polling is added. Settings and Modal refresh only on open, retry or successful connection.

## What Already Exists

- `GitHubIntegrationProvider` already validates repository/Issue responses and stable errors; 039 changes its credential source and installation list endpoint instead of replacing it.
- `IntegrationRegistry` already separates repository and Issue capabilities; 039 supplies a connection-bound GitHub provider without provider branches in consumers.
- `resolveProjectCreateInput` already performs server-side repository re-resolution; 039 adds exact connection selection.
- `RdbProvider`/`SqliteRdbProvider` already own all durable business state and exact schema verification.
- Runner already authenticates outbound calls and verifies Session assignment; the credential endpoint reuses this boundary.
- `githubRepoProvider` already uses askpass and redacts GitHub error bodies; 039 changes token acquisition from process env to an explicit ephemeral argument.
- `ShellSettings`, `UiDialogSurface`, `UiButton`, `UiInput`, `UiSelect` and Project draft model already provide the shell primitives to reuse.

## NOT in Scope

- Caller sign-in/session management：GitHub OAuth verifies installation ownership only.
- GitHub webhooks and uninstall synchronization：revocation is detected on the next remote operation.
- Multiple concurrently active connections or Team administration：historical records exist only to preserve Project binding.
- Generic Integration marketplace/catalog：only a provider-neutral connection contract plus GitHub implementation is added.
- GitLab/GitHub Enterprise connection UI：existing delivery support remains untouched.
- Issue write-back, callbacks, retry orchestration or logs API：unchanged MVP exclusions.
- Per-repository token storage or UI secret upload：App private key remains deployment configuration.
- GitHub server-side full-text repository search：installation endpoint has no equivalent requirement；039 provides deterministic cursor Load more plus filtering across loaded pages.

## Complexity Tracking

The change crosses more than eight files because it deliberately closes one end-to-end authorization chain across contracts, persistence, API, UI and Runner. Reducing it to a UI-only Modal would preserve the current split-credential failure and violate the approved no-PAT boundary. New behavior is confined to one GitHub App service and two reusable UI business components; all other edits extend existing seams.

| Necessary complexity | Why needed | Shortcut rejected because |
|---|---|---|
| IntegrationConnection entity | stable, non-secret source for discovery and delivery | active env token cannot prove Project provenance |
| Runner private credential route | App private key must stay in control plane | token in claim can become stale and broadens secret exposure |
| OAuth + PKCE validation | setup `installation_id` is explicitly untrusted | direct persistence enables installation spoofing |
| Cross-layer tests | regression removes an existing credential path | UI-only evidence cannot prove delivery works |

## Engineering Review Placeholder

`plan-eng-review` completed on 2026-08-05. Detailed evidence is in [checklists/engineering-review.md](checklists/engineering-review.md). Scope remains end-to-end; cursor pagination was added as the only missing main-flow behavior. Four architecture findings are resolved, zero critical gaps remain, and task decomposition may proceed.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|---|---|---|---|---|---|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | — |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | — | — |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | CLEAR | 4 issues resolved, 0 critical gaps |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | Claude Design prototype completed |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | — |

**UNRESOLVED:** 0  
**VERDICT:** ENG CLEARED — ready for task decomposition and implementation.
