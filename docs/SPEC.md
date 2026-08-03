# Spec: mystra

## Objective

Build `mystra`, an internal multi-task AI development container platform that uses the Open Agents project as a source-authoritative framework baseline and reference architecture, while keeping Mystra-owned interfaces and SDK surfaces at issue, repository, sandbox, agent, and persistence seams.

The platform receives development tasks through an unauthenticated internal API,
remote MCP, thin HTTP CLI, or secondary Web client. GitHub provides remote
repository discovery and repository-scoped Issues; Linear provides read-only
Issues. Mystra persists state through a local-first RDB provider and executes a
fixed direct lifecycle through the runner daemon. The runner starts a Docker
sandbox, invokes Codex CLI or GitHub Copilot CLI, runs test and build phases,
starts a host-reachable preview, and produces a reviewable GitHub pull request
before entering `waiting_for_review`.

The first release optimizes for internal trusted infrastructure and fast validation. It is not a public multi-tenant service.

## North Star Operating Model

The long-term target is a hosted **Mystra platform** that can manage many
independent **Teams**. A Team may organize multiple projects, each with its own
runtime image, product route, user stories, acceptance criteria, and future
pluggable execution policy, while still consuming shared
platform-owned provider pools.

```text
Mystra platform
  -> Team
    -> project
      -> product route / user stories / acceptance criteria
      -> runtime image / execution contract
      -> jobs / runs / artifacts
```

`workspace` is reserved for the run-scoped working directory and execution
context delivery surface. It is not a tenancy concept.

This does not expand MVP scope by itself. It defines the architectural direction
that current interfaces should preserve.

## Assumptions

1. Mystra uses the Open Agents project as a source-authoritative framework baseline, not as a packaged SDK with complete reusable interfaces for every Mystra surface.
2. The first deployment target is a single local or private high-capacity server that can run Mystra control-plane, runner, and Docker sandbox workloads.
3. The enabled MVP Integrations are GitHub and Linear. GitHub is the active
   Project RepoProvider; GitLab remains only a runner-side RepoDeliveryProvider
   implementation and is not registered for Project repository discovery.
4. The MVP uses Docker runner containers on a configurable single host.
5. The first RDB provider is local SQLite.
6. MVP execution is a fixed direct runner lifecycle. Any future orchestration policy must return as a removable Codex plugin or Agent hook, not as a platform-owned package above the Agent.
7. Mystra implements its own MCP server surface inside the control-plane app.
8. The accepted MVP path uses a GitHub token for clone, branch push, and pull
   request creation. A GitLab token is needed only when explicitly validating
   the retained delivery-provider implementation.
9. MVP intentionally has no control-plane caller auth, no logs API, no retry API, and no callback URL. Direct execution includes deterministic `test -> build` quality phases before preview and PR creation.
10. Claude CLI, Kubernetes sandbox workloads, cross-runner shared caches, and per-repo secret management are future work.
11. Interfaces should avoid assuming a forever-single-project operating model; Team and shared platform resource concepts must remain representable even before they are fully implemented.

## Tech Stack

- Language: TypeScript.
- Package manager: pnpm.
- Repo style: monorepo.
- Framework baseline: Open Agents source-authoritative reference architecture.
- Public API/control plane: Next.js route handlers.
- RDB provider: local SQLite first; hosted/cloud RDB later.
- External integrations: capability-based `IntegrationPlugin` contracts.
  GitHub provides `RepoProvider` plus repository-scoped `IssueProvider`;
  Linear provides read-only `IssueProvider`.
- Execution: fixed direct runner lifecycle; no active orchestration provider, graph, blueprint, or node model.
- Runner daemon: Node.js TypeScript service running under systemd on bare metal.
- Runner runtime: Docker containers launched by the runner daemon.
- Validation: Zod schemas shared across control plane, CLI-facing HTTP contracts, and runner.
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
    runner-daemon/       # Bare-metal daemon that registers, pulls, and directly executes jobs
  packages/
    shared/              # JobSpec, RunEvent, RunnerEvent, RunResult, state machine schemas
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

Mystra does not sanitize `branchName`, generate fallback names, or resolve branch collisions in MVP. The task/repository context owns branch naming, MR/PR title, and MR/PR body.

The control plane owns persistent state:

- `projects`
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
- `Project` is the durable parent configuration for repository work: one
  provider-resolved remote `RepositorySnapshot`, base branch, default agent,
  runtime image, prewarm config, and opaque project metadata.
- `JobSpec` remains the task identity layer (`taskId`, `source`) plus
  `projectId`, task branch, prompt, optional merge-request metadata, and frozen
  Project repository/base-branch facts. Callers cannot override repository or
  base branch per Job.

North-star extension of this model:

- `Mystra platform` owns shared provider pools, policy, and global scheduling.
- `Team` groups projects and product inputs without forcing
  company/customer-specific terminology.
- `Project` remains the repository and execution customization unit inside a
  Team. `Workspace` is reserved for one run's prepared working directory.

Success criteria for this boundary:

- Core platform concepts are not modeled as an unstructured metadata bag.
- Runner registration uses a typed `PlatformCapabilities` contract.
- Project-scoped config rejects platform-only fields.
- The separation is documented in spec, architecture notes, implementation plan, and ADRs.

## API Surface

MVP public/control-plane APIs:

```text
POST /mcp
GET  /projects
POST /projects
GET  /projects/:slug
PATCH /projects/:slug
DELETE /projects/:slug
GET  /integrations
GET  /integrations/:integration/repositories
POST /integrations/:integration/repositories/resolve
GET  /integrations/:integration/issues
GET  /integrations/:integration/issues/:identifier
POST /integrations/:integration/issues/:identifier/dispatch
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
mystra_create_project
mystra_list_projects
mystra_get_project
mystra_get_job
mystra_cancel_job
mystra_list_runners
```

The MCP endpoint lives in `apps/control-plane` and uses official Streamable HTTP semantics. A separate stdio MCP server is out of scope for MVP.

`POST /jobs` or Issue dispatch persists the Job and initial Run atomically. A
pull-based runner claims the queued Run and owns the fixed direct lifecycle:
sandbox launch, repository clone, Agent, test, build, preview, repository delivery
and review handoff. The API remains the canonical implementation used by the CLI.

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

const jsonObjectSchema = z.record(z.string(), z.unknown());

export const projectSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string().min(1),
    slug: z.string().min(1),
    repo: z.string().min(1),
    baseBranch: z.string().min(1).default("main"),
    defaultAgent: agentNameSchema,
    image: z.string().min(1),
    prewarmConfig: jsonObjectSchema.default({}),
    metadata: jsonObjectSchema.default({}),
    archivedAt: z.string().datetime().nullable().default(null),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict();

export const jobSpecSchema = z.object({
  taskId: z.string().min(1),
  source: z.enum(["mcp", "api"]),
  projectId: z.string().uuid(),
  repo: z.string().min(1).optional(),
  baseBranch: z.string().min(1).optional(),
  branchName: z.string().min(1),
  agent: agentNameSchema.optional(),
  prompt: z.string().min(1),
  mergeRequest: mergeRequestSpecSchema.optional(),
  metadata: jsonObjectSchema.default({}),
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
- End-to-end GitHub PR flow on a disposable repository as the MVP gate. GitLab
  delivery validation is optional and does not register GitLab as an Integration.

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

There is no MVP fix loop after deterministic test failure. The runner executes a `test -> build` gate once; failure stops push/MR/PR creation with `quality_gate_failed`.

## Credential Strategy

GitLab (optional delivery-provider validation only):

- Use a GitLab user PAT only when explicitly validating this delivery provider.
- Required scopes: `read_repository`, `write_repository`, and `api`.
- Store the PAT on the runner host and inject it into the task container as an env var or read-only secret file.
- The task container performs clone, push, and MR creation in MVP. This intentionally gives the task container broad GitLab authority.

GitHub:

- Use a GitHub user token or fine-grained PAT for MVP.
- Required permissions must cover repository clone/push and pull request creation for the target repository.
- Store the token on the runner host and inject it into the task container as an env var or read-only secret file.
- The task container performs clone, push, and PR creation in MVP. This intentionally gives the task container broad GitHub authority.

Codex CLI:

- Support `CODEX_HOME` pointing at a runner-managed credential directory.
- For ChatGPT Pro subscription access, login is performed on the trusted runner host, then the resulting Codex auth cache is mounted into the container for Codex runs.
- Prior remote runner validation on the development host installed Codex CLI `0.125.0`.
- Copying local ChatGPT `~/.codex/auth.json` to a runner-managed `.codex` directory makes `codex login status` work on the runner and in Docker.
- Full `codex exec` from the runner passed after Mihomo proxy setup and sourcing `/root/.mystra/proxy.env`.

GitHub Copilot CLI:

- Prior remote runner validation passed on the development host with GitHub Copilot CLI `1.0.39`, a personal fine-grained PAT with Copilot Requests permission, and Docker `debian:12`.
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
run.queued
runner.registered
runner.heartbeat
run.assigned
container.starting
container.started
repository.clone.started
repository.clone.succeeded
agent.started
agent.succeeded
agent.failed
quality.test.started
quality.test.passed
quality.test.failed
quality.build.started
quality.build.passed
quality.build.failed
preview.ready
git.branch_created
git.commit_created
git.push_succeeded
review.created
run.waiting_for_review
run.succeeded
run.failed
run.canceled
run.timed_out
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
- GitLab, GitHub, and Copilot tokens enter containers only as environment variables or read-only secret files.
- Branch naming, MR/PR title, and MR/PR body are controlled by the task definition and repository-provided templates; Mystra does not impose a global branch/MR/PR naming policy in MVP.

## Boundaries

Always:

- Treat the configured `RdbProvider` as the source of truth.
- Validate all external and runner payloads.
- Enforce per-run timeout and strong cancellation.
- Make runner-to-control-plane communication outbound from private hosts.
- Produce structured run results.
- Keep task containers isolated from host Docker and host home directories.

Ask first:

- Replacing Docker MVP with Kubernetes, Firecracker, E2B, gVisor, or Kata.
- Adding OAuth, tokens, rate limits, IP allowlists, or multi-tenant product features.
- Making an execution plugin the primary state store.
- Adding hosted RDB or cloud orchestration as an MVP requirement.
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
- A registered runner can atomically claim a queued Run after Job creation.
- The local SQLite provider can persist and recover job/run state.
- The direct runner can drive the first lifecycle path without cloud services.
- A private runner daemon can register and pull a job without inbound networking.
- The runner can start a Docker container with a normalized task file.
- The container can run Codex or Copilot against a fixture repository.
- Strong cancel and timeout paths stop the container and mark the run correctly.
- The accepted path returns GitHub branch/PR metadata or a structured failure
  reason; explicit GitLab delivery tests may return branch/MR metadata.
- Runner cache miss/corruption falls back to cold clone/install.
- Tests cover job idempotency, state transitions, SQL claim concurrency, runner heartbeat expiry, unknown agent rejection, credential injection shape, fake-runner completion, cancellation, and cache mount safety.

## Preflight Checks

Before enabling real runner jobs:

- Local SQLite database path is configured and writable.
- `RUNNER_REGISTRATION_TOKEN` is configured in the control plane and runner daemon.
- GitLab user PAT has `read_repository`, `write_repository`, and `api` scopes
  only when explicitly validating the optional GitLab delivery implementation.
- GitHub token has repository read/write and pull request permissions when validating GitHub flows.
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
