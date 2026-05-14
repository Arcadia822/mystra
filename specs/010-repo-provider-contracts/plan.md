# Implementation Plan: Repository Provider Contracts

**Branch**: `010-repo-provider-contracts` | **Date**: 2026-05-14 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/010-repo-provider-contracts/spec.md`

## Summary

Turn Mystra's repository delivery behavior into an explicit provider boundary so
workflow, runner, MCP, and result contracts stop depending on GitLab-specific
implementation facts. The first verified slice should capture the existing
GitLab branch-push and merge-request path as a `RepoProvider` implementation
fact, define the normalized contract GitHub must also satisfy, and document the
current auth and result-surface leakage that later implementation slices must
remove without broadening MVP scope.

## Technical Context

**Language/Version**: TypeScript 5.9 with Node.js 24 runtime assumptions  
**Primary Dependencies**: Next.js 16 route handlers, Zod 4, Vitest 4,
`@mystra/shared`, Docker task execution via `apps/runner-daemon`,
GitLab REST API usage in `container-task.sh`  
**Storage**: SQLite through `RdbProvider`; repository delivery facts currently
surface through `runs.result`, structured events, and runner environment inputs  
**Testing**: `pnpm --filter @mystra/shared test`,
`pnpm --filter @mystra/control-plane test`,
`pnpm --filter @mystra/runner-daemon test`, plus `pnpm typecheck`  
**Target Platform**: Mystra control plane, local/private bare-metal runner host,
and Docker task containers that push repository branches and create review links  
**Project Type**: TypeScript monorepo with Next.js control plane, Node runner
daemon, shared Zod contracts, shell-driven container execution, and Spec-Kit
feature artifacts  
**Performance Goals**: Keep repository delivery contract resolution lightweight
relative to the current clone -> agent -> quality gate -> push/review loop; do
not add avoidable control-plane round trips in the first slice  
**Constraints**: Preserve MVP exclusions, especially no caller auth, no retry
API, no callback URLs, no logs API, and no per-repository secret-management
product surface; keep GitLab and GitHub inside the contract boundary; do not
pretend current GitLab-only implementation already satisfies GitHub parity  
**Scale/Scope**: One typed `RepoProvider` contract, normalized branch/review
result semantics, one documented GitLab first implementation, one explicit
GitHub implementation target, and no unrelated sandbox or workflow redesign

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Specification Owns Product Boundaries**: PASS after reconciling auth wording.
  The plan keeps GitHub inside the MVP contract, but does not expand into
  per-repository secret-management product scope.
- **Typed Contracts at Service Boundaries**: PASS. The feature formalizes
  provider-neutral repository request/result contracts and documents the current
  GitLab-shaped `RunResult` leakage explicitly.
- **Providers Are Replaceable Boundaries**: PASS. `RepoProvider` becomes a real
  Mystra-owned seam rather than a shell-script side effect.
- **Runner Isolation and Secret Hygiene**: PASS. The plan records auth as an
  opaque provider binding or execution-time reference rather than baking secrets
  into images or widening workflow/agent contracts.
- **Verification And Documentation Before Delivery**: PASS. Delivery includes
  feature-local contracts, data model, quickstart verification, and a task list
  that can later drive implementation in bounded slices.

## Project Structure

### Documentation (this feature)

```text
specs/010-repo-provider-contracts/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── repo-provider.md
│   └── review-result.md
└── tasks.md
```

### Source Code (repository root)

```text
apps/runner-daemon/
├── src/index.ts
└── assets/container-task.sh

apps/control-plane/
├── app/api/jobs/route.ts
├── app/api/mcp/route.ts
└── src/lib/db/sqlite-provider.ts

packages/shared/src/
├── events.ts
├── result.ts
└── schemas.ts

docs/
├── SPEC.md
├── RUNNER-DOCKER-MVP.md
└── ADR-0004-open-agents-local-provider-boundary.md
```

**Structure Decision**: Keep the contract artifacts in `specs/010-*` and treat
the current runner shell plus shared result vocabulary as implementation
evidence, not as the contract owner. Later code changes may add TypeScript/Zod
surfaces in `packages/shared` and runner modules, but the planning slice must
first define the contract and its leakage guards.

## Complexity Tracking

No constitution violations require justification.

## Phase 0 Research Summary

Detailed decisions live in [research.md](./research.md).

Key conclusions:

1. `RepoProvider` should own provider selection, auth-binding interpretation,
   branch delivery, and review creation semantics, while workflow and sandbox
   steps consume only the provider-neutral request/result contract.
2. The existing GitLab push/MR path in `container-task.sh` is a valid first
   implementation fact, but the current shared `RunResult` and event names are
   still GitLab-biased and must be treated as transitional runtime surfaces.
3. GitHub parity is a real MVP requirement in the contract, even though the
   current implementation evidence is GitLab-first.
4. Repository auth must remain an opaque provider binding in the contract. The
   MVP may keep runner-managed environment injection as an implementation fact,
   but workflow, MCP, and agent surfaces must not hardcode provider token names.
5. Repository clone/bootstrap belongs to the sandbox workflow boundary; the
   repository-provider boundary should own branch/review delivery and auth
   semantics rather than swallowing all git operations indiscriminately.

## Phase 1 Design Summary

Generated artifacts:

- [data-model.md](./data-model.md)
- [quickstart.md](./quickstart.md)
- [contracts/repo-provider.md](./contracts/repo-provider.md)
- [contracts/review-result.md](./contracts/review-result.md)

The first implementation slice for 010 should be:

1. Add a Mystra-owned `RepoProvider` request/result contract with explicit
   leakage guards against GitLab-only semantics.
2. Record the GitLab-first implementation mapping without claiming GitHub parity
   is already done.
3. Normalize branch-push success, no-diff, auth failure, push failure, and
   review-creation failure-after-push as distinct contract outcomes.
4. Keep repository auth as an opaque provider binding/reference so future secret
   management can evolve without changing workflow, MCP, or agent contracts.
5. Update adjacent docs and follow-on feature plans so repository delivery no
   longer depends on undocumented shell behavior.

### Boundary Diagram

```text
Job / workflow intent
  -> RepositoryTarget + RepositoryAuthBinding
    -> RepoProvider selector
      -> pushBranch()
        -> BranchDeliveryReceipt
          -> createReview()
            -> ReviewResult
              -> run result + structured events

Non-goals for this seam:
  clone/worktree prep -> sandbox/workflow
  branch naming policy -> task/repository context
  secret value storage -> runner/runtime implementation detail
```

## Code Evidence

- `apps/runner-daemon/assets/container-task.sh` owns the only real review
  delivery path today: push branch, call the GitLab MR API, then write GitLab
  result fields.
- `apps/runner-daemon/src/index.ts` injects `MYSTRA_GITLAB_TOKEN`,
  `MYSTRA_GITLAB_HTTP_BASE_URL`, MR title/body, and branch metadata directly
  into the task container, proving the current leakage boundary.
- `packages/shared/src/result.ts` exposes `mrUrl` and `mrIid`, which are
  GitLab-leaning result fields that cannot honestly be treated as the stable
  cross-provider contract.
- `packages/shared/src/events.ts` includes `mr.created` and `git.push_succeeded`
  but no provider-neutral review-created vocabulary yet.
- `PRODUCT.md` and `docs/SPEC.md` name GitLab and GitHub as MVP repository
  targets, while current execution docs remain GitLab-first.

## Implementation Order

1. Define the provider-neutral repository data model and result vocabulary in
   feature-local contracts.
2. Add minimal shared contract surfaces only where multiple packages need them,
   starting with normalized result vocabulary rather than provider-specific
   helpers.
3. Refactor the runner/container integration so GitLab-specific API calls are
   treated as a `RepoProvider` implementation slice rather than the default
   lifecycle truth.
4. Add GitHub implementation slices against the same contract.
5. Reconcile runtime/result docs and tests so GitLab-only terminology is no
   longer masquerading as the stable contract.

## Verification Plan

| Surface | Evidence |
|---|---|
| Provider-neutral contract | `contracts/repo-provider.md` and `contracts/review-result.md` define provider-neutral request/result ownership and failure modes |
| Shared result vocabulary | `packages/shared` tests prove normalized result shapes once introduced |
| GitLab first implementation | `apps/runner-daemon` tests keep GitLab branch push / review creation mapped to the new contract |
| GitHub parity path | Task slices define the implementation and verification work without changing the contract |
| Control-plane/runtime alignment | `apps/control-plane` tests prove job snapshots and MCP surfaces can expose normalized repository delivery outcomes |
| Broad type safety | `pnpm typecheck` after cross-package contract changes |

## Risks And Mitigations

| Risk | Mitigation |
|---|---|
| Contract still leaks GitLab naming through shared result fields | Treat `mrUrl`/`mrIid` as transitional evidence and introduce normalized repository delivery semantics before claiming the seam is formalized |
| Repository auth design accidentally widens MVP into per-repository secret management | Keep auth as an opaque binding/reference and document current runner-managed env injection as an implementation fact |
| RepoProvider swallows sandbox responsibilities | Limit the provider boundary to auth, branch push, and review delivery; keep clone/worktree/container setup in sandbox/workflow seams |
| GitHub remains hand-waved after contract work | Make GitHub a first-class scenario and task phase, even if GitLab is the first verified implementation slice |
| Follow-on features keep reading raw env names | Add explicit leakage guards and update workflow/MCP docs to consume provider-neutral request/result surfaces only |

## Post-Design Constitution Re-Check

PASS. The plan keeps repository delivery inside the documented MVP boundary,
formalizes a Mystra-owned provider contract, avoids expanding into excluded
secret-management scope, and records concrete verification surfaces before code
changes claim the seam is complete.
