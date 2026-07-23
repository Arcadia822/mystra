# Implementation Plan: Issue 驱动的 Agent 自主执行

**Branch**: `033-issue-agent-execution` | **Date**: 2026-07-23 | **Spec**: [spec.md](./spec.md)
**Input**: `/specs/033-issue-agent-execution/spec.md`

## Summary

把 Mystra 的产品入口改为只读 Linear Issue，把活动执行核心从
`WorkflowProvider → blueprint → node handlers` 改成明确、固定但非图式的
`Job/Run → SandboxProvider → AgentAdapter → RepoProvider` 生命周期。Web API 是
Issue list/get/dispatch 与 Run inspect/wait 的唯一业务实现，现有 operator CLI
扩展为薄 HTTP 客户端。成功路径在本机 Docker sandbox 内使用固定版本的
Copilot CLI、有界 autopilot、test、build、可达 preview、GitHub PR，并以
`waiting_for_review` 持久交接。旧 workflow 包、合同、事件和投影从活动代码中删除；
经 owner 明确授权，旧 Job/Run/event/artifact 开发数据可全部清空，不做兼容层。

## Technical Context

**Language/Version**: TypeScript 5.9，Node.js 24.14.0
**Primary Dependencies**: Next.js 16 Route Handlers、React 19、Zod 4、Vitest 4、`better-sqlite3`、Node `child_process`、Linear GraphQL HTTP API、Docker Engine CLI、GitHub REST API、Copilot CLI `1.0.69-0`
**Storage**: 现有 `SqliteRdbProvider`；Issue snapshot 进入既有 Job 持久记录，Run result 保存 review handoff，不新增第二套数据库；旧开发数据库允许精确清空并以新 schema 重建
**Testing**: Vitest contract/unit/integration tests；真实本机 Linear、Docker、Copilot、GitHub E2E evidence
**Target Platform**: macOS host 上的本机 control plane/runner；Linux Docker task container
**Project Type**: TypeScript pnpm monorepo，Web API + daemon + CLI + provider packages
**Performance Goals**: Linear list 默认 25 条、最多 100 条；Issue HTTP 请求 15 秒超时；runner claim 维持现有 25 秒 long poll；CLI wait 默认每 2 秒轮询
**Constraints**: 单机并发默认 1；Copilot autopilot continuation 默认 10；preview 必须从宿主机连续两次健康检查成功；secret 不进入持久化、prompt、日志、remote URL 或 evidence
**Scale/Scope**: 今晚仅 1 个 Linear Integration、1 个私有 GitHub demo web repo、1 个本机 Docker runner、CLI-only 操作面

## Constitution Check

*GATE: Phase 0 前通过；Phase 1 设计后复核仍通过。*

| Gate | Result | Evidence |
|------|--------|----------|
| 规格先修订产品边界 | PASS | spec、5xP 与 constitution 已先明确移除 core workflow model |
| 服务边界均为 TypeScript + Zod | PASS | Issue、Integration、dispatch、API、runner result 采用共享 schema；Linear 原始响应在边界校验 |
| Provider 可替换且不泄漏具体实现 | PASS | `IssueProvider` 仅负责 list/get；Job persistence、Docker、Copilot 和 GitHub 不进入 Issue contract |
| runner 隔离与 secret hygiene | PASS | Docker socket 仅 runner host 使用；三类 token 仅运行时进程环境注入；image 构建不接收 secret |
| 先计划、测试、运行证据再交付 | PASS | 本计划包含 contract tests、focused/full gates、真实 E2E 与脱敏 evidence |
| 明确非目标不被顺手实现 | PASS | 不做 UI、OAuth/webhook/write-back、plugin hooks、retry/logs API、云 sandbox 或生产 secret manager |

## Project Structure

### Documentation

```text
specs/033-issue-agent-execution/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── openapi.yaml
│   ├── issue-provider.md
│   ├── direct-execution.md
│   └── cli.md
├── checklists/
├── evidence/
└── tasks.md
```

### Source Code

```text
apps/
├── control-plane/
│   ├── app/api/integrations/[integration]/issues/
│   ├── app/api/integrations/[integration]/issues/[identifier]/
│   ├── app/api/integrations/[integration]/issues/[identifier]/dispatch/
│   ├── app/api/jobs/
│   └── src/lib/integrations/
└── runner-daemon/
    ├── assets/container-task.sh
    └── src/
        ├── index.ts
        ├── agent-adapters.ts
        ├── repo-providers/
        └── sandbox-providers/

packages/
├── shared/src/
│   ├── issue.ts
│   ├── schemas.ts
│   ├── events.ts
│   ├── result.ts
│   ├── state.ts
│   └── management.ts
└── agent-adapters/src/

runner-images/copilot/
├── Dockerfile
└── README.md

scripts/
├── build-runner-image.sh
└── operator-cli.mjs
```

`apps/workflows/`、`packages/shared/src/workflow.ts` 和 runner workflow registry
在迁移完成后不存在。

**Structure Decision**: 保留现有 monorepo 和 provider registries，只新增一个小型
control-plane integration registry。Linear adapter 与 route handlers 同进程运行；
不建立新的 integration service、SDK package 或 queue。runner 直接复用现有
container step、AgentAdapter、SandboxProvider 和 RepoProvider，只移除图执行外壳。

## Data Flow

```text
operator CLI
    │ HTTP only
    ▼
Next.js canonical API
    │
    ├── GET issue ──> IntegrationRegistry ──> LinearIssueProvider
    │                                      └─ validate HTTP + GraphQL + Zod
    │
    └── POST dispatch
           ├─ refetch exact Issue
           ├─ freeze IssueSnapshot
           └─ RdbProvider.createJob(...)
                        │
                        ▼
                queued Job / Run
                        │ long poll
                        ▼
runner ──> SandboxProvider.launch(Docker)
       ──> clone
       ──> AgentAdapter(Copilot autopilot, max=10)
       ──> test
       ──> build
       ──> preview + host health checks
       ──> RepoProvider.pushBranch + createReview
                        │
                        ▼
              waiting_for_review
              active capacity released
              sandbox retained
```

## Direct Execution State Machine

```text
queued
  └─> assigned ─> starting ─> running
                               ├─> failed
                               ├─> canceled
                               ├─> timed_out
                               └─> waiting_for_review

waiting_for_review is terminal for machine execution:
- runner active capacity: released
- sandbox/preview: retained
- branch/PR/evidence: durable result
- no automatic merge or hidden continuation
```

## Implementation Slices

### Slice 1: Contracts and read-only Issue intake

- Add shared Issue/Integration/dispatch/API schemas and stable error codes.
- Add control-plane `IssueProvider`, registry and Linear implementation using native
  `fetch`, a 15-second timeout, GraphQL error detection and Zod response validation.
- Add canonical list/get routes and contract tests.

### Slice 2: Atomic dispatch and thin CLI

- Dispatch route refetches the exact Issue, validates Project/Agent/runtime/repository,
  freezes `IssueSnapshot`, and calls existing `RdbProvider.createJob` once.
- Compute a stable `dispatchKey` from integration + external Issue ID + project +
  branch; persist it under a UNIQUE column and return `409 DISPATCH_CONFLICT` for an
  exact repeat instead of creating a second Job.
- Extend Job/execution-spec persistence with the snapshot.
- Add CLI `issues list|get|dispatch` and `runs wait`, implemented only through HTTP.

### Slice 3: Remove workflow core and preserve direct execution

- Remove workflow package dependency, package files, shared workflow schemas/events,
  management hints, SQLite projection and UI display.
- Rename workflow-step artifacts/helpers to execution-step terms.
- Extract one testable `direct-execution.ts` service that invokes the existing
  clone/agent/quality/preview/push/review phases in order. It is a fixed runner
  lifecycle, not a provider, graph, DSL or extension point.
- Keep cancel/timeout/cleanup behavior and structured phase events.
- Delete the exact feature E2E SQLite file before acceptance; no legacy readers,
  backfills, dual enums or workflow event parsers remain.

### Slice 4: Bounded Copilot, generic image and review handoff

- Update Copilot command to `--autopilot --allow-all
  --max-autopilot-continues 10`; remove deprecated config flag if runtime verification
  confirms the pinned CLI rejects it.
- Add repository-owned generic Copilot runner image pinned to `1.0.69-0`; do not use
  external Castrel image context.
- Start the base container with no repository/Copilot token in its persistent
  environment. Pass GitHub auth only to the clone `docker exec`, Copilot auth only to
  the agent `docker exec`, and keep push/PR auth in the host RepoProvider process.
- Treat the host git mirror as an optional cache. Refresh it with explicit ephemeral
  GitHub auth or continue with a cold authenticated clone; never require a credential
  helper or persist a credential-bearing origin.
- Verify test then build, start preview, require two host health checks, push branch,
  create-or-reuse one GitHub PR, and complete as `waiting_for_review`.
- Store structured quality, preview, sandbox, PR, Agent version and autopilot metadata.

### Slice 5: Real evidence and reconciliation

- Start local Docker, create/reuse a private `Arcadia822` demo repository, and use one
  existing Linear Issue available to the read-only key.
- Execute through CLI, retain preview, verify PR and active capacity, then write a
  redacted evidence artifact.
- Run focused/full gates, exact workflow-abstraction search, GitNexus change detection
  and code review; reconcile README/module docs/Spec-Kit status.

## Test Strategy

```text
Issue provider contract
  ├─ success list/get + pagination
  ├─ missing key / HTTP failure / timeout / rate limit
  ├─ HTTP 200 + GraphQL errors / partial data
  └─ malformed external payload

Dispatch contract
  ├─ exact Issue refetch + immutable snapshot
  ├─ invalid integration/issue/project/agent/runtime/repo
  ├─ no partial Job on provider failure
  └─ duplicate operator retry has explicit behavior

Direct runner lifecycle
  ├─ ordered clone → agent → test → build → preview → push → PR
  ├─ no changes / agent failure / continuation cap / timeout / cancel
  ├─ test or build failure
  ├─ preview unreachable
  ├─ push/PR failure and existing PR reuse
  └─ waiting_for_review releases capacity but retains sandbox

CLI contract
  ├─ every command maps to one canonical API route
  ├─ success JSON/text output
  ├─ structured server errors
  ├─ transport failure
  └─ wait polling reaches terminal state or local timeout

Real E2E
  Linear → API → CLI → SQLite → runner → Docker → Copilot
         → test/build → preview → GitHub branch/PR → waiting_for_review
```

## Failure Handling

| Stage | Realistic failure | Required response |
|-------|-------------------|-------------------|
| Linear list/get | timeout, 429, HTTP 200 with `errors`, malformed/null field | Stable integration error; no partial success or secret echo |
| Dispatch | Issue changes between list and dispatch | Refetch and freeze dispatch-time snapshot |
| Dispatch retry | same Issue/project/branch submitted twice | UNIQUE dispatch key; second request returns 409 and existing Job ID |
| Job create | invalid Project/runtime/Agent/repo | Reject before runner claim; no Job row |
| Docker launch | daemon/image/Copilot binary unavailable | Structured startup failure before Agent event |
| Copilot | nonzero, no changes, continuation cap, run timeout | Failed/timed_out; no quality-ready or PR |
| Quality | test or build nonzero | Failed with stage and command summary; retained workspace evidence |
| Preview | process starts but host cannot reach it | Failed after two bounded probes; no waiting state |
| GitHub | branch collision, existing PR, API 403/422/5xx | Idempotent push/PR reuse when same head/base; otherwise explicit failure |
| Runner crash | container retained but heartbeat stops | Existing stale-run handling marks durable failure; operator can locate sandbox |

## Security and Secret Flow

- `LINEAR_API_KEY` is read only by the control-plane Linear adapter.
- `MYSTRA_GITHUB_TOKEN` is read only by runner RepoProvider and transient clone/push
  process environments.
- `COPILOT_GITHUB_TOKEN` is injected only into the Copilot process/container runtime.
- The long-lived container baseline contains neither GitHub token. `docker inspect`
  must not reveal either secret after launch.
- Secrets are never copied to `JobSpec`, Issue snapshot, execution spec, event payload,
  Dockerfile layer, git config persisted in evidence, PR body or evidence artifact.
- Command/error formatting redacts credential-bearing URLs and known secret values.

## Distribution

Tonight's CLI remains a repository script and the runner image remains a local image.
Publishing an npm binary, GitHub Release or container registry artifact is explicitly
deferred. `pnpm operator:cli -- ...` and `pnpm runner:image:build` are the supported
local distribution surfaces for this feature.

## What Already Exists

- `SqliteRdbProvider.createJob`, runner claim/heartbeat/cancel/timeout and resolved
  runtime are reused unchanged in responsibility.
- `SandboxProvider`, Docker implementation and retained-container outcome are reused.
- `AgentAdapter` and dynamic adapter registry are reused; only Copilot invocation
  contract changes.
- `container-task.sh` already implements clone, agent, quality gate, preview preparation
  and push preparation; these commands become direct phases rather than node handlers.
- GitHub `RepoProvider` already pushes a branch and creates PR + preview comment.
- `scripts/operator-cli.mjs` already proves the CLI-over-HTTP pattern.
- Existing workflow graph execution and projections are removed, not wrapped.

## NOT in Scope

- Web UI, because CLI satisfies tonight's operator interaction.
- Linear OAuth, webhooks and write-back, because the first provider is read-only.
- Additional IssueProvider implementations or an Integration management UI.
- Codex plugin/hook implementation; only the future removable extension direction is recorded.
- Generic workflow DSL, marketplace, graph runtime or quality rework loop.
- GitLab, Castrel repositories/images and remote enterprise networking.
- Caller auth, logs API, retry API, callbacks, cloud sandbox or hosted RDB.
- Legacy workflow data migration, dual-read compatibility or data preservation.
- npm/container registry distribution; tonight's artifacts are repository-local.
- Automatic PR approval or merge.

## Sequential Delivery Decision

This change crosses shared contracts, control plane and runner, but all slices mutate
the same Job/Run contract and package graph. Implement sequentially in this worktree.
Parallel worktrees would create more reconciliation work than useful concurrency.

## Engineering Review

### Scope challenge

The change touches more than eight files, but the count is dominated by removing a
cross-package abstraction and updating its consumers. The owner explicitly required
complete removal and later authorized dropping all historical-data compatibility.
Reducing scope by keeping workflow schemas or dual states would fail the goal; accepted
scope remains unchanged.

### Architecture findings

1. **[P1] (confidence 10/10)** `apps/runner-daemon/src/index.ts:1204-1279` currently
   injects repository and Copilot tokens into the long-lived container. Resolved by
   phase-scoped `docker exec -e` environments and a secret-free base container.
2. **[P1] (confidence 9/10)** `refreshGitMirror` currently relies on ambient host git
   auth before the authenticated container clone. Resolved by optional authenticated
   cache refresh with cold-clone fallback.
3. **[P1] (confidence 9/10)** `container-task.sh:620-651` proves only one container-local
   probe. Resolved by two bounded host probes before Review creation.
4. **[P2] (confidence 8/10)** dispatch retry semantics were unspecified. Resolved with
   a unique dispatch key and `409 DISPATCH_CONFLICT`.

GitNexus reports LOW for the direct caller graph of `executeDockerJob` (one direct
caller, two affected processes), but the independent risk is **HIGH** because the
function owns the full machine-execution path and the shared state/event contracts
cross packages. Implementation requires focused regression tests before broad gates.

### Code-quality findings

1. **[P1] (confidence 9/10)** adding another inline pipeline to the 1,930-line runner
   entrypoint would make phase testing and secret auditing fragile. Extract one
   `direct-execution.ts`, with no registry/provider/graph abstraction.
2. **[P1] (confidence 9/10)** existing `container-task.sh` mixes generic execution with
   Castrel-specific preview mutation. Replace active preview behavior with generic
   repository package scripts suitable for the demo repository; no Castrel patching
   remains on this path.
3. **[P2] (confidence 8/10)** current quality output collapses test and build into one
   flag. Emit distinct structured commands, durations and statuses.

The direct-execution service and state module should contain maintained ASCII comments
for the phase pipeline and state/capacity transition respectively.

### Test coverage review

```text
CODE PATH COVERAGE REQUIRED
===========================
[+] LinearIssueProvider
    ├── [GAP→UNIT] list/get success, cursor pagination
    ├── [GAP→UNIT] missing key, 401/403, 429, timeout, 5xx
    ├── [GAP→UNIT] HTTP 200 + GraphQL errors/partial data
    └── [GAP→UNIT] malformed response and missing Issue

[+] dispatch route + persistence
    ├── [GAP→CONTRACT] exact refetch and immutable snapshot
    ├── [GAP→CONTRACT] invalid project/agent/runtime/repository
    ├── [GAP→INTEGRATION] atomic Job + execution spec v2
    └── [GAP→INTEGRATION] duplicate dispatch returns 409

[+] direct runner execution
    ├── [GAP→UNIT] ordered phases and structured events
    ├── [GAP→REGRESSION] cancel/timeout/cleanup preserved
    ├── [GAP→UNIT] secret exists only in its intended exec
    ├── [GAP→UNIT] no changes / agent fail / test fail / build fail
    ├── [GAP→UNIT] preview host probe failure
    ├── [GAP→UNIT] push/PR failure and PR reuse
    └── [GAP→INTEGRATION] waiting state releases capacity, retains sandbox

[+] operator CLI
    ├── [GAP→UNIT] issue list/get/dispatch route mapping
    ├── [GAP→UNIT] wait terminal/local-timeout/transport errors
    └── [GAP→REGRESSION] waiting_for_review is success, not failure

USER FLOW COVERAGE REQUIRED
===========================
[+] [GAP→E2E] real Linear → CLI → Docker → Copilot → preview → GitHub PR
[+] [GAP→E2E] two host preview probes + retained container + zero runner capacity

Coverage before implementation: 0/24 planned paths.
Target after implementation: 24/24, plus full repository gates.
```

All gaps are added to `tasks.md`; runner state/CLI changes are mandatory regression
tests. LLM output quality is judged by repository acceptance tests and the real E2E;
no separate prompt-eval framework is added tonight.

### Performance review

1. **[P2] (confidence 8/10)** Issue listing must remain cursor-paginated and capped at
   100; no all-Issue fetch or N+1 detail fetch.
2. **[P2] (confidence 8/10)** dispatch conflict lookup uses an indexed UNIQUE key,
   not `listJobs()` which materializes every event stream.
3. No server-side wait endpoint is added. CLI polling reuses `GET /api/jobs/{id}` at a
   bounded interval, avoiding another long-lived server resource.

### Failure-mode verdict

Every new failure path has a planned test, explicit error handling and visible CLI/API
error. Critical silent gaps after plan revision: **0**.

### Parallelization

Sequential implementation, no parallelization opportunity. Shared contracts and
package removal gate all later slices.

### Review completion summary

- Step 0 Scope Challenge: scope accepted as-is from explicit owner goal.
- Architecture Review: 4 issues found, 4 resolved in plan.
- Code Quality Review: 3 issues found, 3 resolved in plan.
- Test Review: diagram produced, 24 planned gaps made mandatory.
- Performance Review: 3 issues found, 3 resolved in plan.
- NOT in scope: written.
- What already exists: written.
- TODOS.md updates: 0; deferred items already live in explicit NOT in scope.
- Failure modes: 0 critical silent gaps after revision.
- Outside voice: skipped; this agent is already Codex and no subagent was authorized.
- Parallelization: sequential.
- Lake Score: 10/10 recommendations use complete options.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | Formal owner goal and Spec-Kit spec used |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | — | Current agent is Codex; no subagent authorized |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | CLEAR | 10 issues resolved, 0 critical gaps |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | N/A | UI explicitly out of scope |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | — |

**UNRESOLVED:** 0
**VERDICT:** ENG CLEARED, ready for task decomposition and implementation.

## Complexity Tracking

No constitution violations. The broad file count is caused by deleting an existing
cross-package abstraction, not by adding a new platform layer. Partial deletion was
rejected because it would leave active workflow contracts and violate FR-012/FR-013.

## Post-design Constitution Re-check

PASS. The design keeps one durable Job/Run truth, provider boundaries, outbound runner
operation and runtime-only secrets. It removes rather than renames workflow
orchestration, does not preserve old data contracts, and requires no excluded product
capability.
