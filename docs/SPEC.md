# Spec: mystra

## Objective

Build `mystra`, an internal multi-task AI development container platform that reuses the Open Agents project as its framework foundation.

The platform receives development tasks through an unauthenticated internal API/MCP surface, persists state through a local-first RDB provider, drives lifecycle through a local workflow provider, executes Codex CLI or GitHub Copilot CLI in Docker containers, records structured lifecycle events and final results, and produces reviewable GitLab branches and merge requests.

The first release optimizes for internal trusted infrastructure and fast validation. It is not a public multi-tenant service.

## Assumptions

1. Mystra reuses the Open Agents project as the framework foundation.
2. The first deployment target is a single local or private bare-metal host.
3. The MVP code-host target is GitLab only; GitHub repository integration is out of scope.
4. The MVP uses Docker runner containers on a configurable single host.
5. The first RDB provider is local SQLite.
6. The first workflow provider is a local dummy implementation; cloud workflow durability is future work.
7. Mystra implements its own MCP server surface inside the control-plane app.
8. Phase 1 uses a GitLab user PAT for clone, branch push, and merge request creation.
9. MVP intentionally has no control-plane caller auth, no logs API, no retry API, and no callback URL. Runner workflow includes a deterministic `test -> build` quality gate before push/MR creation.
10. Claude CLI, Kubernetes sandbox workloads, cross-runner shared caches, and per-repo secret management are future work.

## Tech Stack

- Language: TypeScript.
- Package manager: pnpm.
- Repo style: monorepo.
- Framework foundation: Open Agents project.
- Public API/control plane: Next.js route handlers.
- RDB provider: local SQLite first; hosted/cloud RDB later.
- Workflow provider: local dummy implementation first; Vercel Workflow/WDK later.
- Runner daemon: Node.js TypeScript service running under systemd on bare metal.
- Runner runtime: Docker containers launched by the runner daemon.
- Validation: Zod schemas shared across control plane, workflows, and runner.
- Events/results: append-only `RunEvent` rows plus structured `RunResult` in the control-plane database.
- Runner image baseline: Node 24, Python 3, uv, git, curl, ca-certificates, openssh-client, Codex CLI, and GitHub Copilot CLI.
- Runner cache: local repo mirror/worktree cache, pnpm store cache, and uv cache on the runner host.

## Commands

Target commands for the first scaffold:

```sh
pnpm install
pnpm dev
pnpm build
pnpm typecheck
pnpm lint
pnpm test
```

Service-specific commands:

```sh
pnpm --filter @mystra/control-plane dev
pnpm --filter @mystra/workflows dev
pnpm --filter @mystra/runner-daemon dev
pnpm --filter @mystra/shared test
```

Local database commands:

```sh
pnpm doctor
pnpm test
```

Supabase or hosted Postgres commands are future/cloud-provider work, not part of the first provider boundary.

## Project Structure

```text
mystra/
  apps/
    control-plane/       # Next.js public API, Streamable HTTP MCP endpoint, state source of truth
    workflows/           # Workflow provider implementations and orchestration adapters
    runner-daemon/       # Bare-metal daemon that registers and pulls jobs
  packages/
    shared/              # JobSpec, RunEvent, RunnerEvent, RunResult, state machine schemas
    runner-image/        # Container entrypoint, mounted skills, and agent execution scripts
    agent-adapters/      # Codex and Copilot CLI adapter contracts and implementations
  docs/
    SPEC.md
    ADR-*.md
  infra/
    docker/
    systemd/
```

## Core Model

`JobSpec` is the normalized task contract accepted by the control plane.

```ts
type AgentName = "codex" | "copilot";

type RunState =
  | "queued"
  | "dispatching"
  | "assigned"
  | "starting"
  | "running"
  | "succeeded"
  | "failed"
  | "canceled"
  | "timed_out"
  | "needs_human_review";

interface MergeRequestSpec {
  title?: string;
  body?: string;
}

interface JobSpec {
  taskId: string;
  source: "mcp" | "api";
  repo: string;
  baseBranch: string;
  branchName: string;
  agent: AgentName;
  prompt: string;
  mergeRequest?: MergeRequestSpec;
  metadata: Record<string, unknown>;
}

interface RunResult {
  status: "succeeded" | "failed" | "canceled" | "timed_out" | "needs_human_review";
  summary: string;
  branch?: string;
  mrUrl?: string;
  mrIid?: number;
  errorCode?: string;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}
```

Mystra does not sanitize `branchName`, generate fallback names, or resolve branch collisions in MVP. The task/repository context owns branch naming, MR title, and MR body.

The control plane owns persistent state:

- `jobs`
- `runs`
- `runner_sessions`
- `run_events`
- `artifacts`

There is no MVP `run_logs` persistence path. Runner output may affect structured events and final results, but stdout/stderr log storage and streaming are explicitly out of scope.

## Platform Capabilities vs Project State

Mystra explicitly separates platform-scoped capabilities from project-scoped state.

- `PlatformCapabilities` are declared by the runner platform and remain stable across jobs. This includes supported agents, executor type, and optional image identity.
- `PlatformDefaults` are platform-level runtime defaults such as concurrency, timeout, heartbeat expiry, long-poll timeout, and container resource limits.
- `ProjectConfig` is the per-job scoped state chosen for a repository task: repo, branch selection, agent choice, prompt, merge-request metadata, and opaque task metadata.
- `JobSpec` remains the identity layer (`taskId`, `source`) plus the `ProjectConfig` fields needed to execute one task.

Success criteria for this boundary:

- Core platform concepts are not modeled as an unstructured metadata bag.
- Runner registration uses a typed `PlatformCapabilities` contract.
- Project-scoped config rejects platform-only fields.
- The separation is documented in spec, architecture notes, implementation plan, and ADRs.

## API Surface

MVP public/control-plane APIs:

```text
POST /mcp
POST /jobs
GET  /jobs/:id
POST /jobs/:id/cancel
GET  /runners
```

Runner protocol:

```text
POST /runner/register
GET  /runner/jobs
POST /runner/jobs/:id/events
POST /runner/jobs/:id/result
POST /runner/heartbeat
```

`GET /runner/jobs` uses long polling. On Vercel it must use the Node runtime with `maxDuration >= 30s`; the runner long-poll timeout is 25 seconds.

MVP MCP tools:

```text
mystra_create_job
mystra_get_job
mystra_cancel_job
mystra_list_runners
```

The MCP endpoint lives in `apps/control-plane` and uses official Streamable HTTP semantics. A separate stdio MCP server is out of scope for MVP.

`POST /jobs` persists the job and initial run first. After the database commit succeeds, the control plane asks the configured `WorkflowProvider` to drive lifecycle. The MVP provider is a local dummy implementation. If workflow start fails, the run remains `queued` for compensation.

## Code Style

Prefer explicit contracts at service boundaries and boring data flow.

```ts
import { z } from "zod";

export const platformCapabilitiesSchema = z
  .object({
    agents: z.array(z.enum(["codex", "copilot"])).min(1),
    executor: z.enum(["docker", "fake"]),
    image: z.string().min(1).optional(),
  })
  .strict();

export const platformDefaultsSchema = z
  .object({
    maxConcurrency: z.number().int().positive().default(1),
    runTimeoutSeconds: z.number().int().positive().default(3600),
    heartbeatExpirySeconds: z.number().int().positive().default(90),
    longPollTimeoutSeconds: z.number().int().positive().default(25),
    containerCpuQuota: z.number().int().positive().default(4),
    containerMemoryGb: z.number().int().positive().default(8),
  })
  .strict();

export const projectConfigSchema = z
  .object({
    repo: z.string().min(1),
    baseBranch: z.string().min(1).default("main"),
    branchName: z.string().min(1),
    agent: z.enum(["codex", "copilot"]),
    prompt: z.string().min(1),
    mergeRequest: z
      .object({
        title: z.string().min(1).optional(),
        body: z.string().optional(),
      })
      .optional(),
    metadata: z.record(z.string(), z.unknown()).default({}),
  })
  .strict();

export const jobSpecSchema = z.object({
  taskId: z.string().min(1),
  source: z.enum(["mcp", "api"]),
  repo: projectConfigSchema.shape.repo,
  baseBranch: projectConfigSchema.shape.baseBranch,
  branchName: projectConfigSchema.shape.branchName,
  agent: projectConfigSchema.shape.agent,
  prompt: projectConfigSchema.shape.prompt,
  mergeRequest: projectConfigSchema.shape.mergeRequest,
  metadata: projectConfigSchema.shape.metadata,
});

export type JobSpec = z.infer<typeof jobSpecSchema>;
```

Conventions:

- Use shared schemas for every cross-process payload.
- Keep runner protocol events append-only.
- Keep agent-specific behavior behind adapters.
- Keep deterministic operations outside agent prompts when practical.
- Mount `/mystra/skills/agent-skills/SKILL.md` and the full skill group directly under `/mystra/skills/<skill-name>`, then instruct the agent to use the relevant skill files for the entire development lifecycle.
- Prefer small packages over a single ambiguous utility package.
- Validate each app's environment variables with an app-local Zod schema at startup.

## Testing Strategy

MVP test layers:

- Unit tests for schema validation, MCP/API job normalization, state transitions, and agent adapter command generation.
- SQLite provider integration tests for claim/transition behavior, idempotent job creation, and runner heartbeat expiry.
- Integration tests with a fake runner that registers, claims a job, emits events, and completes a run.
- Integration tests for strong cancel and timeout behavior.
- Container smoke tests for Codex and Copilot adapter invocation.
- Runner cache tests for repo cache miss/corruption fallback and dependency cache mount safety.
- End-to-end GitLab MR flow on a disposable repository as a manual/scripted MVP gate, not default CI.

Coverage should prioritize state transitions, idempotency, credential handling, cache safety, and runner cleanup.

## MVP Limits

Default limits:

- Run timeout: 60 minutes.
- Max concurrent runs on the single runner host: 2.
- Default container CPU quota: 4 vCPU.
- Default container memory limit: 8 GB.
- Runner heartbeat expiry: 90 seconds.
- Runner long-poll timeout: 25 seconds.

These defaults should be represented by a typed `PlatformDefaults` contract even if some runtime paths still read them from prose or environment-specific config today.

There is no MVP fix loop after deterministic test failure. The runner executes a `test -> build` gate once; failure stops push/MR creation with `quality_gate_failed`.

## Credential Strategy

GitLab:

- Use a GitLab user PAT for MVP.
- Required scopes: `read_repository`, `write_repository`, and `api`.
- Store the PAT on the runner host and inject it into the task container as an env var or read-only secret file.
- The task container performs clone, push, and MR creation in MVP. This intentionally gives the task container broad GitLab authority.

Codex CLI:

- Support `CODEX_HOME` pointing at a runner-managed credential directory.
- For ChatGPT Pro subscription access, login is performed on the trusted runner host, then the resulting Codex auth cache is mounted into the container for Codex runs.
- Remote runner validation on `10.106.2.127` installed Codex CLI `0.125.0`.
- Copying local ChatGPT `~/.codex/auth.json` to a runner-managed `.codex` directory makes `codex login status` work on the runner and in Docker.
- Full `codex exec` from the runner passed after Mihomo proxy setup and sourcing `/root/.mystra/proxy.env`.

GitHub Copilot CLI:

- Remote runner validation passed on `10.106.2.127` with GitHub Copilot CLI `1.0.39`, a personal fine-grained PAT with Copilot Requests permission, and Docker `debian:12`.
- Use `COPILOT_GITHUB_TOKEN` for non-interactive container runs.
- Set `COPILOT_HOME` to an ephemeral per-run directory.
- Pass Copilot redaction flags where supported.

General:

- Prefer file-mounted credentials for tools that natively cache auth in files.
- Prefer environment variables only for tools that explicitly support non-interactive token auth.
- Never bake credentials into runner images.
- Never persist credentials inside task workspaces.
- Destroy per-run credential copies when the container exits.
- Claude CLI is not part of the MVP agent enum, runner image requirement, or adapter implementation.

## Runner Cache and Prewarm

Runner cache lives on the runner host, not in the control plane.

- Repo cache: keep local mirrors/worktree seeds keyed by repo and base branch.
- Dependency cache: keep pnpm store cache and uv cache in dedicated runner cache directories.
- Task containers may mount controlled cache directories, but never mount the host home directory or Docker socket.
- Repo cache stores Git data and worktree seeds only; it must not preserve task modifications as shared state.
- Dependency cache stores package-manager stores only; it must not share `node_modules` between runs.
- Cache is a performance optimization. Clone/install failures must fall back to cold paths.
- A runner-daemon reaper cleans stale workspaces, containers, and cache temp directories.

## Run Events

MVP `RunEvent` types:

```text
job.created
workflow.start_requested
workflow.start_failed
workflow.started
run.queued
runner.registered
runner.heartbeat
run.assigned
container.starting
container.started
agent.started
quality_gate.passed
quality_gate.failed
git.branch_created
git.commit_created
git.push_succeeded
mr.created
run.succeeded
run.failed
run.canceled
run.timed_out
run.needs_human_review
artifact.created
```

Each event includes `run_id`, `job_id`, `timestamp`, `type`, `severity`, and structured `data`. Events are not raw stdout/stderr logs.

## Runner Security

- Control-plane API and MCP caller auth is intentionally out of scope for MVP.
- Runner registration uses a shared secret presented as `Authorization: Bearer <RUNNER_REGISTRATION_TOKEN>`.
- Runner session APIs use a server-issued runner session token after registration.
- Runner daemon may access the host Docker socket; task containers must not mount the Docker socket.
- Task containers must not mount the host home directory.
- Each task gets an isolated workspace volume or directory that is destroyed after release unless retained as an artifact.
- GitLab and Copilot tokens enter containers only as environment variables or read-only secret files.
- Branch naming, MR title, and MR body are controlled by the task definition and repository-provided templates; Mystra does not impose a global branch/MR naming policy in MVP.

## Boundaries

Always:

- Treat the configured `RdbProvider` as the source of truth.
- Validate all external and runner payloads.
- Enforce per-run timeout and strong cancellation.
- Make runner-to-control-plane communication outbound from private hosts.
- Produce structured run results.
- Keep task containers isolated from host Docker and host home directories.

Ask first:

- Adding GitHub repository support.
- Replacing Docker MVP with Kubernetes, Firecracker, E2B, gVisor, or Kata.
- Adding OAuth, tokens, rate limits, IP allowlists, or multi-tenant product features.
- Making any workflow provider the primary state store.
- Adding hosted RDB or cloud workflow as an MVP requirement.
- Adding retry, callback URL, logs, quality-gate fix loops, Claude CLI, remote shared cache, or per-repo secret management.

Never:

- Mount the host Docker socket into task containers.
- Mount host home into task containers.
- Write secrets into prompts, commits, branches, or merge requests.
- Auto-merge agent-generated branches in the MVP.
- Let agent loops run without timeout limits.

## Success Criteria

MVP is complete when:

- A job can be created through the control-plane API or Mystra MCP server.
- The control plane starts or retries starting the configured `WorkflowProvider` after job creation.
- The local SQLite provider can persist and recover job/run state.
- The local dummy workflow provider can drive the first lifecycle path without cloud services.
- A private runner daemon can register and pull a job without inbound networking.
- The runner can start a Docker container with a normalized task file.
- The container can run Codex or Copilot against a fixture repository.
- Strong cancel and timeout paths stop the container and mark the run correctly.
- The result includes GitLab branch/MR metadata or a structured failure reason.
- Runner cache miss/corruption falls back to cold clone/install.
- Tests cover job idempotency, state transitions, SQL claim concurrency, runner heartbeat expiry, unknown agent rejection, credential injection shape, fake-runner completion, cancellation, and cache mount safety.

## Preflight Checks

Before enabling real runner jobs:

- Local SQLite database path is configured and writable.
- `RUNNER_REGISTRATION_TOKEN` is configured in the control plane and runner daemon.
- GitLab user PAT has `read_repository`, `write_repository`, and `api` scopes.
- Copilot PAT has been rotated after validation and stored in the runner secret file.
- Runner image includes Node 24, Python 3, uv, `ca-certificates`, `git`, `openssh-client`, `curl`, Codex CLI, and Copilot CLI.
- Runner host has configured repo cache, pnpm store cache, and uv cache directories.
- Copilot adapter passes a container smoke test using `COPILOT_GITHUB_TOKEN`.
- Codex adapter passes `codex login status` with mounted auth cache.
- Codex full execution uses `/root/.mystra/proxy.env` on the current runner host.

## Explicitly Not in Scope

- Control-plane API/MCP auth, rate limits, IP allowlists, and kill switches.
- Logs storage, log streaming, and log redaction path.
- Retry API.
- Callback URL.
- Quality-gate fix loops and repository-specific build/test command discovery beyond the current path-aware defaults.
- Claude CLI adapter.
- Kubernetes sandbox runtime.
- Remote shared cache or cross-runner cache.
- Object storage for logs/artifacts.
- Per-repo/per-org secret registry.
- GitHub repository support.
