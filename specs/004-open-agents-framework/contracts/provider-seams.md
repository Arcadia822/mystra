# Contract: Provider Seam Classification

This contract defines how Mystra records a local replacement for an upstream
Open Agents managed capability.

## Required Seams

The first version of this feature must classify at least:

- Persistence
- Workflow orchestration
- Sandbox execution
- Repository integration
- Agent execution

Repository and sandbox specifics are later realized in:

- `specs/010-repo-provider-contracts/`
- `specs/011-docker-sandbox-provider/`

## Seam Record Table

Populate one row per replacement seam:

| seamName | upstreamCapability | mystraContractOwner | firstImplementation | leakageGuard | verification |
|---|---|---|---|---|---|
| persistence | Managed durable state behind the upstream Open Agents app surface | `apps/control-plane/src/lib/db/rdb-provider.ts` | `apps/control-plane/src/lib/db/sqlite-provider.ts` | Do not leak SQLite-specific schema or query semantics into shared provider contracts. | `apps/control-plane/src/lib/db/sqlite-provider.test.ts`, `specs/004-open-agents-framework/quickstart.md` |
| workflow orchestration | Upstream workflow-local lifecycle orchestration in `apps/web/app/workflows/*.ts` | `specs/005-workflow-blueprint/` | `apps/runner-daemon/assets/container-task.sh` plus runner coordination in `apps/runner-daemon/src/index.ts` | Do not leak Vercel workflow assumptions or flat shell-step ordering into future workflow contracts. | `specs/005-workflow-blueprint/spec.md`, `specs/004-open-agents-framework/research.md` |
| sandbox execution | Managed sandbox/VM lifecycle from `apps/web/app/workflows/sandbox-lifecycle.ts` | `specs/011-docker-sandbox-provider/`, `packages/shared/src/sandbox.ts` | Shared sandbox contract vocabulary in `packages/shared/src/sandbox.ts`, with Docker task-container execution from `apps/runner-daemon/src/index.ts` and `apps/runner-daemon/assets/container-task.sh` as the first implementation path | Do not leak Docker-only flags, mount semantics, or host coupling into sandbox-neutral contracts. | `specs/011-docker-sandbox-provider/spec.md`, `packages/shared/src/sandbox.test.ts`, `specs/004-open-agents-framework/quickstart.md` |
| repository integration | Host-specific review delivery after workflow completion | `specs/010-repo-provider-contracts/`, `packages/shared/src/repository.ts` | Shared repository contract vocabulary in `packages/shared/src/repository.ts`, with the existing Git push / MR flow in `apps/runner-daemon/assets/container-task.sh` as the first implementation path | Do not leak GitLab-only branch, MR, or API semantics into repository-neutral contracts. | `specs/010-repo-provider-contracts/spec.md`, `packages/shared/src/repository.test.ts`, reconciled repository-provider wording in `PRODUCT.md`, `PLATFORM.md`, `README.md`, and `docs/ADR-0004-open-agents-local-provider-boundary.md` |
| agent execution | Agent-driven coding loop coordinated outside the sandbox in upstream architecture | `specs/009-agent-adapters/` | Task-container CLI invocation in `apps/runner-daemon/assets/container-task.sh` with future adapter package ownership in `packages/agent-adapters/src/index.ts` | Do not leak Codex/Copilot-specific flags, auth directories, or task-container assumptions into agent-neutral contracts. | `specs/009-agent-adapters/spec.md`, `specs/004-open-agents-framework/research.md`, `docs/ADR-0004-open-agents-local-provider-boundary.md` |

## Seam Record Fields

Each seam record MUST contain:

- `seamName`
- `upstreamCapability`
- `mystraContractOwner`
- `firstImplementation`
- `leakageGuard`
- `verification`

## Leakage Guard Rules

The seam record must name what the first local implementation must not leak into
shared Mystra contracts. Examples:

- SQLite-specific semantics in persistence contracts
- Vercel workflow assumptions in workflow contracts
- Docker-specific assumptions in future sandbox-neutral contracts
- GitLab-only semantics in repository-neutral contracts
- CLI-specific argument construction in agent-neutral contracts

## Downstream Planning Rule

Before a later feature introduces or revises a provider abstraction, it MUST:

1. Reference the relevant seam record.
2. Confirm whether the current first implementation still matches the seam.
3. Update the leakage guard if the shared contract changed.
4. Record any new divergence or extension created by the change.
5. Check whether any `fork-rules.md` trigger was met while making the change.

## First-Slice Note

004 does not need to fully realize every seam in code. Its first job is to make
the seam ownership, leakage guards, and follow-on feature boundaries explicit so
later specs stop inventing provider behavior ad hoc.
