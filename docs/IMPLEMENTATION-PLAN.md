# Implementation Plan: mystra MVP

## Overview

Build the MVP as a TypeScript monorepo that uses the Open Agents project as a source-authoritative framework baseline and reference architecture, while defining Mystra-owned interfaces and SDK surfaces at provider and orchestration seams. The local-first implementations are SQLite for RDB state, a Mystra-owned local workflow implementation for lifecycle orchestration, a single-machine Docker sandbox provider, Codex/Copilot agent adapters, and runner-local prewarm caches. The first proof is a fake-runner lifecycle; the second is a real runner container on the provided high-capacity server producing GitLab branch/MR or GitHub branch/PR output from jobs submitted through API or remote MCP.

The MVP intentionally excludes control-plane auth, logs, retry, callback URLs, quality-gate fix loops, Claude CLI, and remote shared caches.

## Architecture Decisions

- Open Agents is the source-authoritative framework baseline, not an assumed packaged SDK for all Mystra seams.
- Local SQLite is the first shared state provider for control plane and workflow logic.
- `apps/control-plane` owns HTTP APIs and the Streamable HTTP MCP endpoint.
- `apps/workflows` owns workflow provider implementations. The first implementation is Mystra-owned and local-first, not a managed durable cloud workflow.
- `POST /jobs` persists the job/run, then asks the configured workflow provider to start. Failed workflow starts are retried by compensation.
- Runner daemon is pull-based over outbound long polling.
- `/api/runner/jobs` uses the Vercel Node runtime with `maxDuration >= 30s`.
- Docker is the MVP sandbox; Kubernetes remains future work behind the runner interface.
- GitLab and GitHub are the MVP repository providers.
- Branch naming, MR/PR title, and MR/PR body come from task/repository context. Mystra does not sanitize names or handle branch collisions.
- Runner-local cache handles repo prewarm plus pnpm/uv dependency stores. Cache is never the source of truth.

## Dependency Graph

```text
Monorepo scaffold
  -> Shared schemas and state machine
    -> RdbProvider interface, SQLite schema, persistence helpers
      -> Control-plane APIs
        -> WorkflowProvider start + compensation
        -> Streamable HTTP MCP endpoint
        -> Fake runner integration test
      -> Runner daemon client
        -> Prewarm/cache manager
        -> Docker runner launcher
          -> Runner image entrypoint
            -> Codex/Copilot adapters
              -> GitLab branch/MR or GitHub branch/PR delivery
```

## Phase 1: Foundation

### Task 1: Monorepo Scaffold

**Description:** Create the pnpm workspace, TypeScript baseline, lint/test/build commands, and package layout without implementing business behavior.

**Acceptance criteria:**
- [ ] `pnpm install` succeeds.
- [ ] Workspace contains `apps/control-plane`, `apps/workflows`, `apps/runner-daemon`, `packages/shared`, `packages/agent-adapters`, and `infra`.
- [ ] Root commands exist: `pnpm build`, `pnpm typecheck`, `pnpm lint`, `pnpm test`.
- [ ] Vitest is available for unit/integration tests.

**Verification:**
- [ ] Run `pnpm install`.
- [ ] Run `pnpm typecheck`.
- [ ] Run `pnpm test`.

**Dependencies:** None

**Files likely touched:**
- `package.json`
- `pnpm-workspace.yaml`
- `tsconfig.base.json`
- `vitest.config.ts`
- app/package manifests

**Estimated scope:** M

### Task 2: Shared Domain Schemas

**Description:** Implement Zod schemas and TypeScript types for `JobSpec`, `RunState`, `RunEvent`, `RunResult`, runner registration, runner polling, and runner cache config.

**Acceptance criteria:**
- [ ] Schemas match `docs/SPEC.md`.
- [ ] `AgentName` only allows `codex` and `copilot`.
- [ ] `PlatformCapabilities`, `PlatformDefaults`, and Project create/update schemas are explicit first-class schemas.
- [ ] `JobSpec` requires task-provided `branchName`.
- [ ] Runner registration uses typed platform capabilities instead of an unstructured capability bag.
- [ ] `RunResult` exposes structured status, summary, branch, MR/PR metadata, and error fields.
- [ ] Unknown agents and invalid run transitions are rejected.

**Verification:**
- [ ] Unit tests for schema validation.
- [ ] Unit tests for state transition validity.
- [ ] Run `pnpm --filter @mystra/shared test`.

**Dependencies:** Task 1

**Files likely touched:**
- `packages/shared/src/schemas.ts`
- `packages/shared/src/state.ts`
- `packages/shared/src/events.ts`
- `packages/shared/src/result.ts`
- `packages/shared/src/cache.ts`
- `packages/shared/src/*.test.ts`

**Estimated scope:** M

### Checkpoint: Foundation

- [ ] `pnpm build` succeeds.
- [ ] `pnpm typecheck` succeeds.
- [ ] `pnpm test` succeeds.
- [ ] Shared contracts are reviewed before API/database implementation.

## Phase 2: State and Control Plane

### Task 3: SQLite RDB Provider and Persistence Layer

**Description:** Add the local SQLite schema and typed persistence helpers for jobs, runs, runner sessions, run events, and artifacts behind an `RdbProvider` contract. Do not implement `run_logs` in MVP.

**Acceptance criteria:**
- [ ] Tables support idempotent job creation and append-only structured events.
- [ ] Jobs store branch name and optional MR/PR title/body.
- [ ] No MVP `callback_url` or `run_logs` dependency remains.
- [ ] SQLite transactions atomically claim queued runs for a runner.
- [ ] Persistence helpers guard valid run state transitions and terminal-state races.
- [ ] Runner sessions can expire by heartbeat.

**Verification:**
- [ ] SQLite schema initializes on a clean local database.
- [ ] SQLite integration tests cover idempotent create, concurrent claim, valid/invalid transitions, terminal race, and heartbeat expiry.

**Dependencies:** Task 2

**Files likely touched:**
- `apps/control-plane/src/lib/db/sqlite*.ts`
- `apps/control-plane/src/lib/db/provider*.ts`
- `apps/control-plane/src/lib/db/*.ts`
- `apps/control-plane/src/lib/db/*.test.ts`

**Estimated scope:** M

### Task 4: Control-Plane Job APIs

**Description:** Implement the public job APIs for create, read, cancel, and runner list. Do not add auth, logs, retry, or callbacks.

**Acceptance criteria:**
- [ ] `POST /jobs` creates a validated job and first run.
- [ ] `POST /jobs` commits DB state before requesting workflow start.
- [ ] Workflow provider start failure keeps the run `queued` for compensation.
- [ ] `GET /jobs/:id` returns job, run status, structured events, and final result when available.
- [ ] `POST /jobs/:id/cancel` performs strong cancellation state update.
- [ ] `GET /runners` returns runner session status.

**Verification:**
- [ ] Route tests with mocked persistence/workflow client.
- [ ] Integration test against local SQLite for create/read/cancel.

**Dependencies:** Task 3

**Files likely touched:**
- `apps/control-plane/app/api/jobs/route.ts`
- `apps/control-plane/app/api/jobs/[id]/route.ts`
- `apps/control-plane/app/api/jobs/[id]/cancel/route.ts`
- `apps/control-plane/app/api/runners/route.ts`
- `apps/control-plane/src/lib/workflows/*.ts`

**Estimated scope:** M

### Task 5: Runner Registration and Long-Poll APIs

**Description:** Implement runner registration with shared secret, session token issuance, heartbeat, long-poll job claim, event ingestion, and result submission.

**Acceptance criteria:**
- [ ] Registration requires `RUNNER_REGISTRATION_TOKEN`.
- [ ] Runner APIs require issued runner session token.
- [ ] `GET /runner/jobs` uses Node runtime and `maxDuration >= 30s`.
- [ ] Long-poll returns assignable jobs or times out cleanly after 25 seconds.
- [ ] Structured events are appended.
- [ ] Result submission moves run to terminal state through the `RdbProvider`.

**Verification:**
- [ ] API tests for auth failures and success paths.
- [ ] Fake-runner integration test claims and completes a run.

**Dependencies:** Task 4

**Files likely touched:**
- `apps/control-plane/app/api/runner/register/route.ts`
- `apps/control-plane/app/api/runner/jobs/route.ts`
- `apps/control-plane/app/api/runner/jobs/[id]/events/route.ts`
- `apps/control-plane/app/api/runner/jobs/[id]/result/route.ts`
- `apps/control-plane/app/api/runner/heartbeat/route.ts`

**Estimated scope:** M

### Task 6: Streamable HTTP MCP Endpoint

**Description:** Expose the MVP MCP tools from `apps/control-plane` using official Streamable HTTP semantics and the same schemas as the HTTP APIs.

**Acceptance criteria:**
- [ ] Tools exist: `mystra_create_job`, `mystra_get_job`, `mystra_cancel_job`, `mystra_list_runners`.
- [ ] No `mystra_get_job_logs` or `mystra_retry_job` tool exists in MVP.
- [ ] Tool input/output uses shared schemas.
- [ ] MCP endpoint can create and inspect a job.

**Verification:**
- [ ] MCP route tests.
- [ ] Manual MCP client smoke test or scripted Streamable HTTP test.

**Dependencies:** Task 4

**Files likely touched:**
- `apps/control-plane/app/api/mcp/route.ts`
- `apps/control-plane/src/lib/mcp/tools.ts`
- `apps/control-plane/src/lib/mcp/*.test.ts`

**Estimated scope:** M

### Checkpoint: Control Plane

- [ ] Local SQLite-backed job lifecycle works through HTTP.
- [ ] Fake runner can register, poll, emit events, and complete a run.
- [ ] MCP tool can create a job and fetch status.
- [ ] No real Docker or GitLab writes yet.

## Phase 3: Workflow and Runner Daemon

### Task 7: Local Dummy Workflow Provider

**Description:** Implement a local dummy `WorkflowProvider` that receives `run_id`, marks dispatch progress through control-plane APIs or shared services, waits for terminal state, and performs timeout compensation without requiring Vercel Workflow.

**Acceptance criteria:**
- [ ] Workflow provider stores orchestration progress only, not business state.
- [ ] Timeout moves run to `timed_out` through control-plane API or persistence service.
- [ ] Cancel state is respected while waiting.
- [ ] Compensation scanner retries workflow start for queued runs whose start request failed.

**Verification:**
- [ ] Unit tests for success, failure, timeout, cancel, and workflow-provider start retry paths.
- [ ] Local dummy workflow smoke test against control-plane dev server.

**Dependencies:** Task 5

**Files likely touched:**
- `apps/workflows/src/run-workflow.ts`
- `apps/workflows/src/control-plane-client.ts`
- `apps/workflows/src/compensation.ts`
- `apps/workflows/src/*.test.ts`

**Estimated scope:** M

### Task 8: Runner Daemon Long-Poll Client

**Description:** Build the runner daemon process that registers, heartbeats, long-polls, launches jobs, handles cancel/timeout signals, submits structured events/results, and performs cleanup.

**Acceptance criteria:**
- [ ] Reads runner config from env/file with startup validation.
- [ ] Registers and maintains heartbeat.
- [ ] Polls for jobs and handles empty polls with jitter.
- [ ] Errors use exponential backoff while heartbeat continues where possible.
- [ ] Can run a fake executor and submit result.
- [ ] Includes a periodic reaper for stale containers, workspaces, and cache temp dirs.

**Verification:**
- [ ] Unit tests with mocked control-plane client.
- [ ] Integration test against local control-plane using fake executor.
- [ ] Reaper tests for stale workspace/container metadata.

**Dependencies:** Task 5

**Files likely touched:**
- `apps/runner-daemon/src/index.ts`
- `apps/runner-daemon/src/config.ts`
- `apps/runner-daemon/src/control-plane-client.ts`
- `apps/runner-daemon/src/executor.ts`
- `apps/runner-daemon/src/reaper.ts`
- `apps/runner-daemon/src/*.test.ts`

**Estimated scope:** M

### Task 9: Runner Prewarm and Cache Manager

**Description:** Implement runner-local repo and dependency cache management.

**Acceptance criteria:**
- [ ] Maintains repo mirror/worktree seed cache keyed by repo and base branch.
- [ ] Maintains pnpm store cache and uv cache directories.
- [ ] Task containers receive only controlled cache mounts.
- [ ] Host home and Docker socket are never exposed through cache mounts.
- [ ] Repo cache miss or corruption falls back to cold clone.
- [ ] Dependency cache failure falls back to cold install path.
- [ ] Cache is never treated as persisted task output.

**Verification:**
- [ ] Unit tests for cache path validation and mount generation.
- [ ] Integration test for repo cache hit/miss/corrupt fallback.
- [ ] Tests assert `node_modules` is not shared as a cache directory.

**Dependencies:** Task 8

**Files likely touched:**
- `apps/runner-daemon/src/cache/repo-cache.ts`
- `apps/runner-daemon/src/cache/dependency-cache.ts`
- `apps/runner-daemon/src/cache/mounts.ts`
- `apps/runner-daemon/src/cache/*.test.ts`

**Estimated scope:** M

### Task 10: systemd and Runner Host Config

**Description:** Add systemd unit templates and environment file examples for deploying the runner daemon on the configured high-capacity server.

**Acceptance criteria:**
- [ ] Unit file starts runner daemon under a dedicated service.
- [ ] Example env file documents control-plane URL, registration token, concurrency, Docker settings, secret file paths, repo cache path, pnpm store path, and uv cache path.
- [ ] Deployment docs reference `docs/RUNNER-ENVIRONMENT.md`.

**Verification:**
- [ ] Unit file passes `systemd-analyze verify` on runner host.
- [ ] Dry-run deployment docs reviewed.

**Dependencies:** Task 8, Task 9

**Files likely touched:**
- `infra/systemd/mystra-runner.service`
- `infra/systemd/mystra-runner.env.example`
- `docs/RUNNER-ENVIRONMENT.md`

**Estimated scope:** S

### Checkpoint: Runner Control Loop

- [ ] Workflow can dispatch a run.
- [ ] Runner daemon can claim and complete fake jobs.
- [ ] Heartbeat expiry and strong cancellation are covered by tests.
- [ ] Repo/dependency cache fallback behavior is covered by tests.

## Phase 4: Docker Runner and Agent Adapters

### Task 11: Runner Image Entrypoint

**Description:** Implement the runner container entrypoint that reads a normalized task file, prepares workspace from repo cache or cold clone, invokes the selected agent adapter, performs GitLab/GitHub delivery, and emits `RunResult` JSON.

**Acceptance criteria:**
- [ ] Reads `/run/mystra/task.json`.
- [ ] Supports fixture repo execution without real GitLab writes.
- [ ] Emits structured `RunResult` JSON.
- [ ] Enforces timeout passed by daemon.
- [ ] Runs deterministic `test -> build` quality gate before push/MR/PR creation.
- [ ] Base image includes Node 24, Python 3, uv, git, curl, ca-certificates, openssh-client, Codex CLI, and Copilot CLI.

**Verification:**
- [ ] Container smoke test with fixture repo.
- [ ] Unit tests for task parsing and result generation.

**Dependencies:** Task 2, Task 9

**Files likely touched:**
- `apps/runner-daemon/assets/container-task.sh`
- local-only Castrel image context under `/tmp/mystra-castrel-runner-image` when image changes are required

**Estimated scope:** M

### Task 12: Agent Adapter Contract and Copilot Adapter

**Description:** Implement the agent adapter contract and first real adapter for GitHub Copilot CLI using `COPILOT_GITHUB_TOKEN`.

**Acceptance criteria:**
- [ ] Adapter emits structured start/success/failure events.
- [ ] Adapter passes secret env vars to Copilot redaction flags where supported.
- [ ] Adapter works in container smoke test using the validated runner secret path.

**Verification:**
- [ ] Unit tests for command construction.
- [ ] Container smoke test returns expected marker output through Copilot.

**Dependencies:** Task 11

**Files likely touched:**
- `packages/agent-adapters/src/types.ts`
- `packages/agent-adapters/src/copilot.ts`
- `packages/agent-adapters/src/copilot.test.ts`
- `apps/runner-daemon/assets/container-task.sh`

**Estimated scope:** M

### Task 13: Codex Adapter With Proxy/Auth Cache

**Description:** Implement Codex CLI adapter using mounted ChatGPT auth cache and proxy environment support.

**Acceptance criteria:**
- [ ] Adapter supports mounted `.codex` auth cache.
- [ ] Adapter passes proxy env vars.
- [ ] Adapter works on the prepared runner host with current Mihomo setup.

**Verification:**
- [ ] Unit tests for command construction.
- [ ] Runner-host smoke test returns expected marker output through Codex.

**Dependencies:** Task 11

**Files likely touched:**
- `packages/agent-adapters/src/codex.ts`
- `packages/agent-adapters/src/codex.test.ts`
- `apps/runner-daemon/assets/container-task.sh`

**Estimated scope:** M

### Task 14: Docker Executor in Runner Daemon

**Description:** Replace fake executor with Docker execution: create per-run workspace, prepare cache mounts, write task file, mount secrets, pass limits, handle strong cancel, submit events/results, and clean up.

**Acceptance criteria:**
- [ ] Does not mount Docker socket into task containers.
- [ ] Does not mount host home into task containers.
- [ ] Mounts only workspace, selected secrets, and controlled cache paths.
- [ ] Cleans up container and workspace on success, failure, cancel, or timeout.
- [ ] Strong cancel sends Docker stop, then kill after grace period.

**Verification:**
- [ ] Integration test with local Docker and fixture image.
- [ ] Manual runner-host smoke test with Copilot adapter.
- [ ] Cancel test verifies stop/kill path and final `canceled` state.

**Dependencies:** Task 8, Task 9, Task 11, Task 12

**Files likely touched:**
- `apps/runner-daemon/src/docker-executor.ts`
- `apps/runner-daemon/src/workspace.ts`
- `apps/runner-daemon/src/secrets.ts`
- `apps/runner-daemon/src/docker-executor.test.ts`

**Estimated scope:** M

### Checkpoint: Real Runner Smoke

- [ ] Runner daemon launches Docker container on the configured high-capacity server.
- [ ] Copilot adapter succeeds in container.
- [ ] Codex adapter succeeds with proxy/auth cache when selected.
- [ ] Cache mounts do not expose host home or Docker socket.

## Phase 5: Repository Delivery

### Task 15: Repository Provider Client Inside Runner Image

**Description:** Implement GitLab and GitHub API/Git operations helpers for clone, task-provided branch push, and MR/PR creation using runtime-injected user tokens inside the task container.

**Acceptance criteria:**
- [ ] Supports configured GitLab host.
- [ ] Supports configured GitHub host or `github.com`.
- [ ] Uses the task-provided branch name without global Mystra naming policy.
- [ ] Uses tokens without writing them into Git config where practical.
- [ ] Creates merge request or pull request from pushed branch using task/repository title/body.
- [ ] Handles no-change, dirty-worktree, push-rejected, and MR/PR-create-failed outcomes as structured `RunResult` failures.

**Verification:**
- [ ] Unit tests for API request construction and result mapping.
- [ ] Integration test against a disposable GitLab test project, or mocked GitLab API if test project is unavailable.

**Dependencies:** Task 11

**Files likely touched:**
- `apps/runner-daemon/assets/container-task.sh`
- `apps/runner-daemon/src/index.ts`

**Estimated scope:** M

### Task 16: End-to-End Repository Fixture Flow

**Description:** Run a complete MVP flow from API/MCP job creation to runner container execution and GitLab MR or GitHub PR result on a disposable repository.

**Acceptance criteria:**
- [ ] Job created through API or MCP.
- [ ] Workflow starts and runner claims job.
- [ ] Agent modifies fixture repo.
- [ ] Task-provided branch is pushed.
- [ ] MR or PR is created.
- [ ] Control plane shows terminal success and MR/PR metadata.
- [ ] Cancel/timeout path is separately tested.

**Verification:**
- [ ] E2E script completes successfully.
- [ ] Run detail shows structured events and `RunResult`.
- [ ] No logs API is required for success.

**Dependencies:** Task 14, Task 15

**Files likely touched:**
- `tests/e2e/mvp-repository-flow.test.ts`
- `tests/fixtures/gitlab-repo/*`
- `tests/fixtures/github-repo/*`
- `docs/RUNBOOK.md`

**Estimated scope:** M

### Checkpoint: MVP Complete

- [ ] All tests pass.
- [ ] E2E GitLab or GitHub fixture flow works.
- [ ] Runner host preflight checks pass.
- [ ] Documentation reflects actual deploy/run commands.
- [ ] Tokens used during validation have been rotated.

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---:|---|
| Public unauthenticated control-plane URL leaks | High | Accepted MVP risk; keep deployment private-by-convention and revisit auth after MVP. |
| No logs slows debugging | Medium | Accepted MVP risk; rely on structured events/results until logs become a follow-up. |
| Dummy workflow provider is mistaken for durable cloud workflow | Medium | Document it as local-only and keep durability claims out of product copy. |
| SQLite assumptions leak into cloud provider contracts | Medium | Keep persistence behind `RdbProvider` and test through provider behavior, not SQLite internals. |
| Runner long polling races assign the same run twice | High | Use database-level claim transaction and run state transition guard. |
| Docker cleanup fails after cancel/timeout | Medium | Track container IDs and workspace paths; cleanup in finally blocks and periodic reaper. |
| Cache corruption breaks runs | Medium | Treat caches as disposable; fall back to cold clone/install. |
| Codex depends on proxy/auth cache behavior | Medium | Keep Codex adapter optional per job; Copilot is already container-validated. |
| GitLab/GitHub token leaks from container | High | Accepted MVP risk; inject only at runtime and do not bake into images. |

## Parallelization Opportunities

- After Task 2, Task 3 can proceed while adapter command-shape tests start.
- After Task 4, Task 6 can proceed independently of runner daemon work.
- After Task 8, Task 9 cache work can proceed while Task 10 systemd docs start.
- After Task 11, Copilot and Codex adapters can be built in parallel.
- GitLab/GitHub client work can begin after runner runtime contracts are stable.

## Explicitly Not in Scope

- Control-plane API/MCP auth, rate limits, IP allowlists, kill switch.
- Logs storage, log streaming, log redaction path.
- Retry API.
- Callback URL.
- Quality-gate fix loops and build/test command discovery beyond the path-aware defaults.
- Claude CLI adapter.
- Kubernetes sandbox runtime.
- Remote shared cache or cross-runner cache.
- Object storage for logs/artifacts.
- Per-repo/per-org secret registry.

## Open Questions

No open questions currently block Task 1.
