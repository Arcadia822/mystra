# Implementation Plan: Runtime Config Resolution and Context Bundles

**Branch**: `002-runtime-profile-context` | **Date**: 2026-05-09 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-runtime-profile-context/spec.md`

## Summary

Refactor Mystra's runtime contract so Projects own a typed default runtime config object, including Docker image for the current provider, while the control plane resolves that config into a provider-ready runtime contract for runners. The work keeps user-specified Project image configuration valid, designs the missing runtime resolution path, moves context loading into explicit bundles, and prevents source-owned runner image/context contents from becoming per-project runtime truth. The contract should leave room for future Project-managed runtime profiles, but the MVP implements one default runtime first.

## Technical Context

**Language/Version**: TypeScript 5.9, Node.js 24 runtime assumptions  
**Primary Dependencies**: Next.js 16, React 19, Zod 4, Vitest 4, existing `better-sqlite3` provider  
**Storage**: SQLite via `SqliteRdbProvider`, with future PG/Supabase compatibility preserved behind `RdbProvider`  
**Testing**: Vitest package tests plus TypeScript typecheck; runner Docker behavior covered by focused runner-daemon tests  
**Target Platform**: Private high-capacity Linux server running control plane, runner daemon, and Docker sandbox workloads  
**Project Type**: TypeScript monorepo with Next.js control plane, Node runner daemon, shared contracts, and scripts. The current Castrel-oriented runner image context is local-only under `/tmp/mystra-castrel-runner-image` and is not part of the git repository.  
**Performance Goals**: Claim-time runtime resolution should be bounded and should not scan unrelated context bundles; accepted jobs must resolve runtime before runner assignment  
**Constraints**: Do not add caller auth, logs API, retry API, callback URLs, quality-gate fix loops, Claude CLI, Kubernetes workloads, cross-runner shared caches, or per-repository secret management; task containers must not mount host home or Docker socket; secrets remain runtime-injected  
**Scale/Scope**: Single-machine Docker MVP, multiple Projects with different default runtime images, constrained job runtime overrides, explicit context bundles, no top-level Project image compatibility for the first version. Named runtime profiles, full mount management, and full secret management are future management surfaces.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Specification Owns Product Boundaries**: PASS. This feature changes runtime configuration ownership inside the MVP boundary and does not introduce excluded platform features.
- **Typed Contracts at Service Boundaries**: PASS. Project runtime config, job runtime overrides, context bundles, runner capabilities, and claim payloads are explicit TypeScript/Zod contract changes.
- **Providers Are Replaceable Boundaries**: PASS. Docker image remains valid config for the Docker provider, but runner execution receives it through provider translation rather than ad hoc top-level field reads.
- **Runner Isolation and Secret Hygiene**: PASS. Mount and secret policy become explicit runtime constraints; host home and Docker socket remain forbidden for task containers.
- **Verification And Documentation Before Delivery**: PASS. The plan requires shared schema tests, control-plane provider tests, runner claim tests, runner-daemon translation tests, and feature-local documentation.

## Project Structure

### Documentation (this feature)

```text
specs/002-runtime-profile-context/
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
├── app/api/
│   ├── projects/**/route.ts
│   ├── context-bundles/**/route.ts
│   ├── jobs/route.ts
│   ├── mcp/route.ts
│   ├── runner/register/route.ts
│   └── runner/jobs/route.ts
└── src/lib/db/
    ├── migrations.ts
    ├── rdb-provider.ts
    ├── sqlite-provider.ts
    └── sqlite-provider.test.ts

apps/runner-daemon/
├── src/index.ts
└── src/container-task.test.ts

scripts/
├── build-runner-image.sh
├── doctor-local.sh
└── sync-runner-skills.sh
```

**Structure Decision**: Keep the existing monorepo layout. Shared runtime contracts live in `packages/shared/src/schemas.ts`. Project runtime config and context bundle persistence are added to the control-plane DB provider because the control plane resolves claims. Docker-specific translation remains in `apps/runner-daemon/src/index.ts` for the MVP, but it consumes a resolved runtime contract instead of independently reading `Project.image`. The Castrel-oriented runner image context is local-only and must not be treated as Mystra platform baseline or committed runtime truth.

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

1. Shared schema contracts for Project runtime config, job runtime overrides, context bundles, runner capabilities, and resolved runtime contracts.
2. SQLite/RdbProvider persistence for Project runtime config and context bundles; Docker image is stored under `projects.runtime`.
3. Project CRUD and job submission changes to validate runtime config and permitted overrides.
4. API/MCP route validation for Project default runtime and constrained job overrides, so the boundary rejects malformed runtime payloads before persistence.
5. Runtime resolver and runner claim matching against provider/capability requirements.
6. Effective mount resolution that distinguishes system-managed mounts, Project-managed mounts, and runtime/image-declared mounts before runner translation.
7. Runner daemon translation from resolved Docker runtime contract to container args, mounts, env, ports, and context bundle placement.
8. Castrel-oriented runner image removal from git, with local image context support through scripts and docs.
9. Cleanup once tests prove no normal runner path independently interprets top-level `project.image`.

## Verification Checkpoints

| After | Check | Command / Evidence |
|---|---|---|
| Shared schemas | Runtime config/context bundle schemas reject top-level Project image and accept `runtime.image` | `pnpm --filter @mystra/shared test` |
| DB provider | Project runtime config, job override, runtime resolution, and claim snapshots pass | `pnpm --filter @mystra/control-plane test` |
| API/MCP contracts | Route tests cover Project runtime create/update and job runtime override rejection | `pnpm --filter @mystra/control-plane test` |
| Mount ownership | Effective runner mounts are resolved from system, Project, and runtime/image inputs without promoting Castrel-specific mounts to system truth | `pnpm --filter @mystra/runner-daemon test` plus resolver tests |
| Runner claim | Incompatible runners do not receive jobs; compatible runners receive resolved runtime | `pnpm --filter @mystra/control-plane test` |
| Runner daemon | Docker args use resolved runtime contract, not an ad hoc `project.image` read | `pnpm --filter @mystra/runner-daemon test` |
| Broad contract | TypeScript contracts compile across packages | `pnpm typecheck` when practical |

## Risk Mitigations

| Risk | Mitigation |
|---|---|
| Callers send top-level `image` | Reject the payload; first-version Project runtime image must be `Project.runtime.image` |
| Runtime config becomes an untyped metadata blob | Define shared schemas for provider, image, context bundles, mounts, ports, caches, secrets, and override policy |
| Docker semantics leak into future providers | Use provider-specific translation; Docker provider interprets `runtime.image`, future providers define their own environment fields inside the same runtime envelope |
| Context bundles become source-owned again | Store bundle references and access policy in runtime config; treat repo-bundled skills only as local development examples |
| Secret references become secret storage | Store only secret reference names and injection mode; values stay in runner environment or external secret source |
| Project-specific secrets are mistaken for Mystra system secrets | Treat repository tokens, including GitLab tokens, as Project/runtime-managed references; defer full secret management while preserving the contract |
| Castrel-specific mounts become Mystra system defaults | Define mount ownership levels and only classify truly runner-required mounts as system-managed |
| Claim matching assigns incompatible work | Extend runner capabilities and claim selection to check provider and required runtime features before assignment |
| Castrel image language drifts into platform baseline | Keep image context outside git, require Projects to reference concrete `Project.runtime.image`, and ensure claim tests assert resolved runtime usage |

## Post-Design Constitution Re-Check

PASS. The design keeps feature artifacts under `specs/002-runtime-profile-context/`, introduces typed contracts at service boundaries, preserves Docker as the first sandbox provider while allowing Project-owned image config, keeps secrets runtime-injected, and defines concrete verification checkpoints before implementation.

## Engineering Review Report

Reviewed with `plan-eng-review` on 2026-05-09.

### Verdict

Proceed after tightening the implementation plan. The product and contract direction is sound: `Project.runtime.image` is valid runtime configuration, and the control plane should resolve it into a runner-ready contract. The main implementation risk is overloading persistence classes with runtime policy and building a larger context-bundle management surface than the MVP needs.

### Required Plan Adjustments

1. Extract runtime resolution into a small control-plane runtime module instead of implementing it directly inside `sqlite-provider.ts`.
   - Recommended path: `apps/control-plane/src/lib/runtime/resolve-runtime.ts`.
   - The DB provider should persist and load Projects, jobs, runs, bundles, and snapshots; it should not become the owner of override policy, provider compatibility, or mount/secret validation.

2. Persist the resolved runtime snapshot on the run before runner assignment.
   - The resolved contract must explain historical execution even if Project runtime config or context bundle definitions change later.
   - Claim responses should return the stored snapshot, not recompute a mutable view after assignment.

3. Do not add legacy image migration.
   - Store Project runtime as `projects.runtime`.
   - Reject new Project payloads that use top-level `image`.
   - Keep normal claim/runtime paths free of `project.image`.

4. Treat context-bundle CRUD as optional for the first implementation slice.
   - The core need is explicit bundle resolution, not necessarily full operator-facing CRUD.
   - A local registry or seed-backed bundle table is sufficient if it proves `Project.runtime.contextBundleRefs -> resolved contextBundles`.

5. Replace opaque policy objects with discriminated, bounded schemas.
   - `mountPolicy`, `exposedPortPolicy`, `cachePolicy`, `secretRefs`, and `overridePolicy` should use narrow MVP shapes.
   - Avoid `Record<string, unknown>` for policy fields that are part of safety decisions.

6. Add explicit indexes and lookup constraints for claim-time runtime resolution.
   - Context bundle lookup should be by slug/id and bounded to requested bundles.
   - Claim selection must not scan or resolve unrelated bundle rows for every queued run.

### Test Additions

- Top-level Project image rejection: create Project with top-level `image`, assert validation fails.
- Runtime snapshot stability: mutate Project runtime after job creation or assignment, assert the run claim/history still uses the stored resolved runtime.
- Override rejection: image override denied by Project policy creates no executable run.
- Secret hygiene: reject secret values in Project runtime, job override, and context bundle source metadata.
- Forbidden mounts: reject host home and Docker socket across Project runtime, job override, and bundle mount paths.
- Incompatible runner: queued run remains unassigned when runner lacks provider or required runtime features.
- Docker runner: image comes from `claim.runtime.environment.image`; tests should fail if runner reads `claim.project.image`.
- API/MCP boundary: Project and job routes reject top-level `image`, malformed runtime payloads, and MVP-forbidden override fields before creating executable runs.
- Mount ownership: a Project/runtime mount does not replace system-managed execution mounts, and Castrel-specific image/context mounts are not classified as universal system mounts.

### Scope Guidance

Implement in three verifiable slices:

1. `Project.runtime` plus API/MCP boundary validation plus resolver plus stored runtime snapshot plus runner claim contract.
2. Effective mount ownership and merge semantics for system, Project, and runtime/image mounts.
3. Context bundle resolution plus runner context rendering plus baseline image/template documentation cleanup.

Named runtime profile management, full mount management, and full secret
management are explicit follow-up surfaces. The MVP should preserve these
contracts while first proving the default Project runtime business path.

Do not make a full context bundle administration product unless a first slice proves the runtime contract.
