# Contract: Terminology Migration Boundaries

This contract defines how 021 performs a direct `Job* -> Task*` naming cut on current repository surfaces without changing Mystra's product boundary by accident.

## 1. Active Scope

The active implementation scope must rename all current repository surfaces that still expose job-centric naming today:

- durable docs (`PRODUCT.md`, `PLATFORM.md`, `PROCESS.md`, `README.md`)
- historical specs that still shape current wording
- exported shared schemas and types
- public API / MCP / CLI names
- core cross-module function names
- implementation-local names after outward/core naming is cut over

## 2. Deferred Scope

The following stay deferred even after the hard cut:

- future tenancy object replacements for tenancy-flavored `workspace` wording
- any rename that would implicitly define product hierarchy or page structure

## 3. Protected Meanings

The following meanings are protected during migration:

| Current term | Protected meaning | Policy |
|---|---|---|
| `workspace` | runtime working directory / mount / execution path | keep |
| `Job`, `JobSpec`, `/api/jobs`, `mystra_create_job`, `createJob` | current stable outward/core submission surface | direct-cut to `Task*` / `/api/tasks` naming in this feature |
| UI `workspace` shell classes and page layout terms | current page implementation | evidence-only for this feature |

## 4. Batch Policy

### Batch A — Stable docs/spec wording

- Rewrite legacy tenancy wording only to neutral or already-implemented terms.
- Do not introduce a new object name just because it appears cleaner in prose.

### Batch B — Outward/core contract names

- Requires explicit rename matrix, one-pass rename execution, and focused regression tests.
- Compatibility aliases and dual naming are explicitly out of scope.

### Batch C — Internal/mechanical naming

- Allowed only after Batch B names are settled.
- Must not leak across package boundaries, persisted records, route names, or operator-visible strings.

## 5. Rename Matrix (Current Repository Surfaces)

### Batch A — Durable docs and spec wording inventory

| Surface | Current wording | Planned action | Notes |
|---|---|---|---|
| `PRODUCT.md`, `PLATFORM.md`, `PROCESS.md`, `AGENTS.md`, `README.md` | tenancy-flavored `workspace` | rewrite to neutral existing platform wording | Keep runtime `workspace` meaning untouched |
| `specs/021-product-surface-positioning/**` | migration rationale, protected `workspace`, `Job* -> Task*` examples | keep aligned with landed rename set | 021 is the canonical migration spec |
| `specs/001-project-and-sqlite/spec.md` | future tenancy `workspace` framing | rewrite only if needed to remove aspirational tenancy conflict | Do not invent a new tenancy noun |

### Batch B — Outward/core naming inventory

| Current outward/core surface | Target naming | Primary files | Risk notes |
|---|---|---|---|
| `jobSpecSchema`, `JobSpec` | `taskSpecSchema`, `TaskSpec` | `packages/shared/src/schemas.ts`, `packages/shared/src/schemas.test.ts` | Shared contract, Zod schema export |
| `job.created` lifecycle handoff | `task.created` lifecycle handoff | `packages/shared/src/events.ts`, `packages/shared/src/events.test.ts` | Event type consumed across packages |
| `JobRecord`, `JobSnapshot`, `createJob`, `getJob`, `listJobs`, `cancelJob` | `TaskRecord`, `TaskSnapshot`, `createTask`, `getTask`, `listTasks`, `cancelTask` | `apps/control-plane/src/lib/db/rdb-provider.ts`, `apps/control-plane/src/lib/db/sqlite-provider.ts`, `apps/control-plane/src/lib/db/sqlite-provider.test.ts` | Persistence/provider core surface |
| `/api/jobs`, `/api/jobs/[id]`, `/api/jobs/[id]/cancel` | `/api/tasks`, `/api/tasks/[id]`, `/api/tasks/[id]/cancel` | `apps/control-plane/app/api/tasks/**`, `apps/control-plane/app/api/routes.test.ts`, `apps/control-plane/app/page.tsx` | Public HTTP surface plus current consumer UI |
| `mystra_create_job`, `mystra_get_job`, `mystra_cancel_job` | `mystra_create_task`, `mystra_get_task`, `mystra_cancel_task` | `apps/control-plane/app/api/mcp/route.ts`, `apps/control-plane/app/api/routes.test.ts`, `apps/control-plane/app/page.tsx` | Agent/operator-facing MCP surface |
| task claim/log labels still saying `job` | task-facing labels where they are public/operator-visible | `apps/runner-daemon/src/index.ts`, runner tests | Runner consumes shared/control-plane contracts directly |

### Batch C — Mechanical cleanup inventory

| Surface class | Planned action | Entry files |
|---|---|---|
| file-local helpers and variable names that still expose `Job*` after Batch B | mechanical rename after outward/core cut lands | touched files in `packages/shared/`, `apps/control-plane/`, `apps/runner-daemon/` |
| test descriptions and fixture names tied to renamed public surfaces | mechanical rename in the same slice as the supported public contract | `packages/shared/src/*.test.ts`, `apps/control-plane/**/*.test.ts`, `apps/runner-daemon/**/*.test.ts` |

## 6. Explicit Deferrals

The following files or file classes are intentionally **not** rename targets in this feature unless a later task explicitly broadens scope:

- `apps/control-plane/app/page.tsx` UI `workspace` shell/layout terminology, because page redesign is out of scope. Only current route/tool labels that mirror public contracts may change.
- `specs/011-control-plane-design-system/**`, because its `workspace` wording is design-language evidence, not the current terminology migration target.
- `specs/011-docker-sandbox-provider/**`, `specs/009-agent-adapters/**`, `specs/010-repo-provider-contracts/**`, and `specs/002-runtime-profile-context/**` runtime `workspace` references, because those describe actual execution paths, mounts, or runtime contract values.
- Future tenancy-object renames that would require inventing or freezing a new top-level noun before the product surface exists.

## 7. Verification Contract

Any future implementation under this plan must verify the narrowest relevant set for the touched surface, plus regression tests proving the repo does not retain mixed public naming:

- shared contracts: `pnpm --filter @mystra/shared build && pnpm --filter @mystra/shared test && pnpm --filter @mystra/shared typecheck`
- control-plane public surfaces: `pnpm --filter @mystra/control-plane test && pnpm --filter @mystra/control-plane typecheck && pnpm --filter @mystra/control-plane build`
- documentation-only batch: refresh `specs/spec-status.md` after artifact changes
