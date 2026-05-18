# Implementation Plan: Project Abstraction + SQLite Persistence

**Branch**: `001-project-and-sqlite` | **Date**: 2026-05-09 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-project-and-sqlite/spec.md`

## Summary

Introduce Project as the stable parent configuration for jobs and replace the in-memory `local-store.ts` with a SQLite-backed `RdbProvider`. Job creation moves to `projectId` as the primary contract, runner claims receive Project runtime image data, and scripts/API/MCP/UI surfaces are updated so remote agents can submit work without repeating repo/baseBranch/agent/image configuration.

## Technical Context

**Language/Version**: TypeScript 5.9, Node.js 24 runtime assumptions  
**Primary Dependencies**: Next.js 16, React 19, Zod 4, Vitest 4, new `better-sqlite3` and `@types/better-sqlite3`  
**Storage**: SQLite via `SqliteRdbProvider`, configured by `MYSTRA_DB_PATH`, WAL mode  
**Testing**: Vitest package tests plus TypeScript typecheck  
**Target Platform**: Private high-capacity Linux server running control plane, runner daemon, and Docker sandbox workloads  
**Project Type**: TypeScript monorepo with Next.js control plane, Node runner daemon, shared packages, scripts  
**Performance Goals**: Single job creation under 10ms for project lookup + snapshot insert on local SQLite; no N+1 listJobs pattern  
**Constraints**: `RdbProvider` must not leak SQLite dialect; no caller auth/logs/retry/callback/quality-gate fix loops; prewarm remains provider capability  
**Scale/Scope**: Single-machine MVP, multiple Projects, multiple queued jobs, runner long polling, local SQLite durability

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Specification Owns Product Boundaries**: PASS. The feature is in MVP scope after the current product goal update. It does not add caller auth, logs API, retry API, callback URLs, quality-gate fix loops, Claude CLI, Kubernetes, shared caches, or per-repository secret management.
- **Typed Contracts at Service Boundaries**: PASS. Project, JobSpec, claim response, MCP tools, and persistence records are Zod/TypeScript contract changes.
- **Providers Are Replaceable Boundaries**: PASS. SQLite is behind `RdbProvider`; future Supabase/Postgres is a new implementation.
- **Runner Isolation and Secret Hygiene**: PASS. Project.image changes container selection only; no new secret storage is introduced.
- **Verification And Documentation Before Delivery**: PASS. The plan requires shared/control-plane/runner tests, smoke tests, and local module docs where behavior changes.

## Project Structure

### Documentation (this feature)

```text
specs/001-project-and-sqlite/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── api.md
│   ├── mcp.md
│   └── runner-claim.md
├── tasks.md
└── checklists/
    └── requirements.md
```

### Source Code (repository root)

```text
packages/shared/src/
├── schemas.ts
└── schemas.test.ts

apps/control-plane/
├── app/
│   ├── page.tsx
│   └── api/
│       ├── projects/route.ts
│       ├── projects/[slug]/route.ts
│       ├── jobs/route.ts
│       ├── jobs/[id]/route.ts
│       ├── jobs/[id]/cancel/route.ts
│       ├── mcp/route.ts
│       ├── runners/route.ts
│       └── runner/**/route.ts
└── src/lib/
    ├── db/
    │   ├── index.ts
    │   ├── migrations.ts
    │   ├── rdb-provider.ts
    │   ├── sqlite-provider.ts
    │   └── sqlite-provider.test.ts
    └── local-store.ts        # deleted after migration

apps/runner-daemon/
├── src/index.ts
└── assets/container-task.sh

scripts/
├── castrel-job.mjs           # renamed to submit-job.mjs
├── prewarm-castrel-ai.sh     # renamed to prewarm-project.sh
├── build-runner-image.sh
├── deploy-dev-machine.sh
└── doctor-local.sh

```

**Structure Decision**: Keep the existing monorepo layout. Add the DB provider under `apps/control-plane/src/lib/db/` because the current control plane owns API/MCP state access. Keep shared Zod contracts in `packages/shared/src/schemas.ts`. Runner image selection changes in `apps/runner-daemon/src/index.ts`; per-project runtime image truth lives in Project runtime config, not a global runner env var. Castrel-oriented image context is local-only and not part of git.

## Complexity Tracking

No constitution violations require justification.

## Phase 0: Research

Research decisions are captured in [research.md](./research.md).

## Phase 1: Design & Contracts

Design artifacts:

- [data-model.md](./data-model.md)
- [quickstart.md](./quickstart.md)
- [contracts/api.md](./contracts/api.md)
- [contracts/mcp.md](./contracts/mcp.md)
- [contracts/runner-claim.md](./contracts/runner-claim.md)

## Implementation Order

1. Shared schema contracts.
2. SQLite/RdbProvider foundation.
3. Project CRUD routes and tests.
4. Existing API/MCP route migration from local-store to `getDb()`.
5. Runner claim and Docker image resolution.
6. Script and package command generalization.
7. Documentation and baseline-template cleanup.

## Verification Checkpoints

| After | Check | Command / Evidence |
|---|---|---|
| Shared schema | Schema tests pass | `pnpm --filter @mystra/shared test` |
| DB provider | Provider unit tests pass | `pnpm --filter @mystra/control-plane test` |
| API migration | Control-plane compiles | `pnpm --filter @mystra/control-plane typecheck` |
| Runner image | Runner daemon compiles | `pnpm --filter @mystra/runner-daemon typecheck` |
| Scripts | Project submit works | `pnpm job:submit --project <slug> ...` |
| Full scope | Broad checks pass | `pnpm typecheck && pnpm test` when practical |

## Risk Mitigations

| Risk | Mitigation |
|---|---|
| `projectId` breaks existing callers | Immediate switch; update API, MCP, UI, scripts, and tests in same feature |
| SQLite assumptions leak into future PG | `RdbProvider` returns domain types only; no raw SQL/rowid APIs |
| JSON corruption hides bad data | Provider throws with field name and record id |
| `listJobs` becomes slow | Use JOIN-based snapshot query instead of per-job lookups |
| Runner starts wrong image | Claim response carries Project image; runner uses only `claimedJob.project.image` |
| Prewarm gets coupled to generic runner | Store config only; automatic prewarm waits for a sandbox provider that supports it |
| Existing Castrel scripts/docs drift | Rename scripts and update docs/package command in this feature |

## Post-Design Constitution Re-Check

PASS. Contracts are explicit, provider boundary remains replaceable, docs are in `specs/001-project-and-sqlite/`, and MVP exclusions remain respected.
