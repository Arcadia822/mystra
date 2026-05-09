# Mystra

A bare-metal coding-agent platform for running multiple AI development tasks in isolated Docker containers on your own infrastructure.

Mystra provides a control plane that receives work through HTTP or MCP, a local-first persistence layer, and pull-based runner daemons that execute Codex CLI or GitHub Copilot CLI in Docker sandboxes. Successful runs produce reviewable GitLab branches and merge requests.

## Architecture

```
apps/control-plane    Next.js route handlers, MCP endpoint, state-facing APIs
apps/workflows        Workflow provider implementations and orchestration adapters
apps/runner-daemon    Bare-metal runner service
packages/shared       Zod schemas, state machine, events, result contracts
packages/agent-adapters
```

## Provider Layer

Mystra defines provider seams where managed services would be used, and ships local-first implementations first:

| Provider | MVP Implementation | Future |
|---|---|---|
| RdbProvider | SQLite-backed local store | Cloud RDB |
| WorkflowProvider | Local dummy workflow | Vercel Workflow / WDK |
| SandboxProvider | Single-machine Docker | Kubernetes |
| RepoProvider | GitLab | GitHub |
| AgentProvider | Codex CLI, GitHub Copilot CLI | Claude CLI |

## Quick Start

```sh
pnpm install
pnpm build
pnpm typecheck
pnpm test
```

Start the control plane:

```sh
pnpm dev:control-plane
```

Start a fake runner for local protocol development:

```sh
MYSTRA_CONTROL_PLANE_URL=http://localhost:3000 pnpm dev:runner
```

Create a Project, then create a job by `projectId`:

```sh
PROJECT_ID="$(curl -sS -X POST http://localhost:3000/api/projects \
  -H 'content-type: application/json' \
  -d '{
    "repo": "local/fixture",
    "slug": "local-fixture",
    "name": "Local Fixture",
    "baseBranch": "main",
    "defaultAgent": "codex",
    "runtime": {
      "provider": "docker",
      "image": "mystra-castrel-runner:local"
    }
  }' | node -e 'let d=""; process.stdin.on("data", c => d += c); process.stdin.on("end", () => console.log(JSON.parse(d).project.id));')"

curl -sS -X POST http://localhost:3000/api/jobs \
  -H 'content-type: application/json' \
  -d "{
    \"taskId\": \"local-1\",
    \"source\": \"api\",
    \"projectId\": \"$PROJECT_ID\",
    \"branchName\": \"mystra/local-1\",
    \"prompt\": \"Smoke test the local Mystra loop\"
  }"
```

## MVP Scope

In scope:

- Next.js control plane with job CRUD, runner registration, and MCP endpoint
- Pull-based runner daemon over outbound long polling
- Docker task containers on the runner host
- Codex CLI and GitHub Copilot CLI agent execution
- GitLab branch and merge request delivery
- Structured lifecycle events and run results
- Deterministic test-then-build quality gate before branch/MR delivery

Explicitly out of scope for the MVP:

- Control-plane caller authentication
- Logs API or log persistence
- Retry API, callback URLs, quality-gate fix loops
- Claude CLI adapter
- GitHub repository support
- Kubernetes sandbox workloads
- Cross-runner shared caches

## Documentation

- [SPEC.md](docs/SPEC.md) - Product and engineering boundaries
- [ARCHITECTURE.md](docs/ARCHITECTURE.md) - System architecture
- [IMPLEMENTATION-PLAN.md](docs/IMPLEMENTATION-PLAN.md) - Phased implementation plan
- [LOCAL-USAGE.md](docs/LOCAL-USAGE.md) - Local development usage guide
- [RUNNER-DOCKER-MVP.md](docs/RUNNER-DOCKER-MVP.md) - Docker runner setup
- [ADR-0001](docs/ADR-0001-control-plane-runner.md) through [ADR-0004](docs/ADR-0004-open-agents-local-provider-boundary.md) - Architecture decision records

## Project Context

Mystra uses 5xP root documents for durable project context:

- [PRODUCT.md](PRODUCT.md) - What Mystra is, who it serves, scope boundaries
- [PLATFORM.md](PLATFORM.md) - Stack, architecture constraints, commands
- [PROCESS.md](PROCESS.md) - Workflow, quality gates, git discipline
- [PROFILE.md](PROFILE.md) - Collaboration style and owner preferences
- [AGENTS.md](AGENTS.md) - Agent persona, routing, principles

## License

[MIT](LICENSE)
