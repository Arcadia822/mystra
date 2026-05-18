# Implementation Plan: GitHub Repository Provider Parity

**Branch**: `012-github-repo-provider-parity` | **Date**: 2026-05-15 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/012-github-repo-provider-parity/spec.md`

## Summary

Realize the missing built-in GitHub repository provider on top of Mystra's
existing `RepoProvider` seam, while fixing the narrow GitLab-only runner
assumptions that still block end-to-end GitHub-backed delivery. The first
implementation slice should add a concrete GitHub provider, localize GitHub host
and auth handling inside provider-owned helpers, preserve reviewer-useful pull
request context in the PR body, and keep transitional `mr*`/`mr.created`
surfaces working until later cleanup removes the legacy GitLab names.

## Implementation Status

- Focused verification for the landed shared and runner slices passed during T021:
  `pnpm --filter @mystra/shared test && pnpm --filter @mystra/runner-daemon test`
- Broad verification passed on 2026-05-15:
  `pnpm typecheck`
- The current environment still emits the pre-existing Node engine warning
  (`>=24 <25`, running `v26.1.0`), but the typecheck itself completed cleanly
  across the workspace
- Final explicit review pass completed on 2026-05-15 against the cumulative spec
  012 diff; it found no blocking issues and the only minor documentation drift
  (`GitHubRepoContext` field shape) was reconciled in the closure artifacts

## Technical Context

**Language/Version**: TypeScript 5.9 with Node.js 24 runtime assumptions  
**Primary Dependencies**: Next.js 16 route handlers, Zod 4, Vitest 4,
`@mystra/shared`, Node `fetch`, Node `child_process`, existing
`apps/runner-daemon` provider registry and GitLab provider  
**Storage**: SQLite through `RdbProvider`; repository delivery facts currently
surface through `runs.result`, structured events, and runner-local workflow step
artifacts  
**Testing**: `pnpm --filter @mystra/shared test`,
`pnpm --filter @mystra/runner-daemon test`, and `pnpm typecheck`; add
`pnpm --filter @mystra/control-plane test` only if shared result/event
projections require control-plane changes  
**Target Platform**: Mystra control plane, private bare-metal runner host, and
Docker task containers that clone, modify, and deliver repositories to
`github.com`, GitHub Enterprise-style hosts, and existing GitLab targets  
**Project Type**: TypeScript monorepo with Next.js control plane, Node runner
daemon, shared Zod contracts, shell-driven task execution, and Spec-Kit feature
artifacts  
**Performance Goals**: Preserve the current clone -> agent -> quality gate ->
push/review loop shape; avoid new control-plane round trips or expensive host
resolution outside the provider boundary  
**Constraints**: Stay within MVP scope; do not add provider-specific workflow
branches; keep GitHub auth and API host details behind `RepositoryAuthBinding`
plus provider-owned metadata; preserve partial success when push succeeds but PR
creation fails; keep legacy `mrUrl`, `mrIid`, and `mr.created` only as
transitional compatibility surfaces; keep task sizing small enough that each
implementation slice can be verified with focused runner/shared checks before
broader `pnpm typecheck` coverage  
**Scale/Scope**: One built-in GitHub `RepoProvider`, one narrow runner/auth
normalization slice that lets GitHub-backed tasks reach clone and delivery
without widening product contracts, one GitHub reviewer-context mapping, and no
unrelated sandbox or workflow redesign

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Specification Owns Product Boundaries**: PASS. The plan delivers the
  already-in-scope GitHub MVP path without widening into caller auth, retry
  flows, logs storage, or per-repository secret management.
- **Typed Contracts at Service Boundaries**: PASS. The plan keeps shared
  request/result shapes provider-neutral and localizes GitHub host/API/auth
  semantics to provider-owned helpers and metadata.
- **Providers Are Replaceable Boundaries**: PASS. GitHub becomes a real
  `RepoProvider` implementation next to GitLab instead of a special-case runner
  branch.
- **Runner Isolation and Secret Hygiene**: PASS. Secrets remain runtime-injected
  env/file inputs; no secrets are baked into images or promoted into shared
  workflow contracts.
- **Verification And Documentation Before Delivery**: PASS. Delivery requires
  focused provider and shared-contract tests plus feature-local contracts,
  quickstart verification, and later review before merge.

## Project Structure

### Documentation (this feature)

```text
specs/012-github-repo-provider-parity/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── github-repo-provider.md
│   └── github-review-context.md
└── tasks.md
```

### Source Code (repository root)

```text
apps/runner-daemon/
├── src/repo-providers.ts
├── src/repo-providers/
│   ├── gitlab.ts
│   ├── gitlab.test.ts
│   ├── github.ts
│   └── github.test.ts
├── src/repo-providers.test.ts
├── src/review-projections.ts
├── src/index.ts
└── assets/container-task.sh

packages/shared/src/
├── repository.ts
├── repository.test.ts
├── result.ts
├── result.test.ts
└── events.ts

specs/010-repo-provider-contracts/
└── contracts/
    ├── repo-provider.md
    └── review-result.md
```

**Structure Decision**: Keep GitHub parity contract ownership in
`specs/012-*`, reuse `specs/010-*` as the provider-neutral baseline, and treat
`apps/runner-daemon` plus `packages/shared` as the implementation surfaces that
must stop assuming GitLab is the only real built-in path.

## Complexity Tracking

No constitution violations require justification.

## Phase 0 Research Summary

Detailed decisions live in [research.md](./research.md).

Key conclusions:

1. The shared repository contract already supports `github`, partial-success
   review states, and provider selection; the main gap is the missing built-in
   GitHub implementation plus GitLab-only runner plumbing.
2. End-to-end GitHub parity requires a narrow auth/bootstrap normalization slice
   because `container-task.sh` still clones only with `MYSTRA_GITLAB_TOKEN` and
   optional `MYSTRA_GITLAB_HTTP_BASE_URL`.
3. The GitHub provider should publish reviewer-useful task, preview, and
   quality-gate context in the PR body first; optional follow-up comment failure
   must not erase a successful PR outcome.
4. GitHub host resolution must handle `github.com`, enterprise hosts, HTTPS
   URLs, and SSH-style remotes without leaking GitHub API layout into shared
   contracts.
5. Transitional GitLab-shaped result/event projections (`mrUrl`, `mrIid`,
   `mr.created`) remain compatibility surfaces and should be adapted rather than
   treated as the stable GitHub-era contract.

## Phase 1 Design Summary

Generated artifacts:

- [data-model.md](./data-model.md)
- [quickstart.md](./quickstart.md)
- [contracts/github-repo-provider.md](./contracts/github-repo-provider.md)
- [contracts/github-review-context.md](./contracts/github-review-context.md)

The first implementation slice for 012 should be:

1. Add provider-owned GitHub host/auth helpers and a built-in `github`
   `RepoProvider` next to the existing GitLab provider.
2. Normalize runner clone/delivery auth inputs just enough that GitHub-backed
   tasks can clone, push, and create PRs without adding a new workflow path.
3. Map GitHub push, no-diff, auth-invalid, push-failed, and
   review-failed-after-push outcomes onto the existing shared `ReviewResult`
   vocabulary.
4. Keep core reviewer context in the PR body and treat any supplemental
   comment-publishing failure as metadata or warning, not as a reason to hide a
   successfully created PR.
5. Preserve transitional MR-named result/event compatibility while routing new
   provider behavior through `review.created` and normalized review handles.

### Boundary Diagram

```text
task.spec.repo + RepositoryTarget + RepositoryAuthBinding
  -> runner provider selection
    -> GitHubRepoContext resolver
      -> pushBranch()
        -> BranchDeliveryReceipt
          -> createReview()
            -> ReviewResult
              -> review.created + transitional mr.* projections

Supporting runner slice:
  clone/bootstrap auth selection
    stays in runner/container workflow
    but must stop hardcoding GitLab-only env names

Non-goals for this seam:
  hosted secret management
  GitHub-only workflow branches
  sandbox/runtime redesign
```

## Code Evidence

- `apps/runner-daemon/src/repo-providers.ts` now registers both built-in GitLab
  and GitHub providers, preserving explicit `hostKind` selection and
  `supports()` fallback under the same registry seam.
- `packages/shared/src/repository.ts` and `packages/shared/src/result.ts`
  continue to define provider-neutral repository/result contracts while allowing
  GitHub review handles and transitional `mrUrl` / `mrIid` compatibility
  projections.
- `apps/runner-daemon/src/index.ts` now derives runtime auth bindings, default
  Docker secrets, clone usernames, and provider-scoped metadata from the active
  repository provider instead of hardcoding GitLab-only token assumptions.
- `apps/runner-daemon/assets/container-task.sh` now clones through
  `MYSTRA_REPOSITORY_AUTH_REFERENCE` and `MYSTRA_REPOSITORY_AUTH_USERNAME`, so
  clone/bootstrap auth stays provider-neutral inside the shared runner path.
- `apps/runner-daemon/src/review-projections.ts` now owns normalized
  `review.created` and transitional `mr.created` / `mr*` compatibility mapping,
  keeping GitHub PR details coherent without re-hardcoding GitLab semantics in
  the runner path.
- `apps/runner-daemon/src/repo-providers/github.ts` owns GitHub host parsing,
  enterprise API-base overrides, PR body/context projection, optional
  retained-preview follow-up comments, and GitHub-specific failure mapping.
- GitNexus was refreshed during plan review (`npx gitnexus analyze` at commit
  `1606a0d`), and the closure reconciliation here is grounded in the landed
  source and verification results rather than stale graph assumptions.

## Implementation Order

1. Add feature-local documentation and tests that freeze GitHub host/auth,
   reviewer-context, and partial-success expectations before refactoring runner
   code.
2. Introduce provider-aware clone/delivery auth selection in the runner and
   container task harness so GitHub-backed tasks can authenticate without new
   workflow branching.
3. Implement and register the built-in GitHub repo provider with focused tests
   for host resolution, branch push, PR creation, preview metadata formatting,
   and failure mapping.
4. Update transitional run-result and event projection code so GitHub review
   handles flow through normalized `reviewResult` while legacy MR-shaped fields
   remain populated as compatibility output where required.
5. Reconcile docs, nearby module comments, and verification commands before
   task decomposition and implementation review.

## Verification Plan

| Surface | Evidence |
|---|---|
| GitHub host/auth resolution | `apps/runner-daemon/src/repo-providers/github.test.ts` covers `github.com`, enterprise hosts, HTTPS, SSH-like remotes, and invalid auth cases |
| Shared contract integrity | `pnpm --filter @mystra/shared test` keeps provider-neutral review and result schemas valid for GitHub outcomes |
| Runner auth/bootstrap plumbing | `apps/runner-daemon` tests prove clone/push/review steps receive the correct provider token/base-url inputs without GitHub-only workflow branching |
| Reviewer context parity | Provider tests assert PR-body composition for task body, preview URLs, and quality-gate notes, plus best-effort supplemental comment handling |
| Transitional compatibility | Runner/shared tests prove `review.created` remains normalized while legacy `mrUrl`, `mrIid`, and `mr.created` stay coherent during the transition |
| Broad type safety | `pnpm typecheck` after cross-package or runner-contract changes |

## Risks And Mitigations

| Risk | Mitigation |
|---|---|
| GitHub parity is blocked outside the provider seam by GitLab-only clone/bootstrap env handling | Treat auth/bootstrap normalization as a narrow prerequisite inside this spec and keep it bounded to provider-aware secret/reference selection |
| GitHub Enterprise host support leaks API layout into shared contracts | Resolve web/API host context inside the provider from repo metadata and provider-owned defaults, not from new shared fields |
| Supplemental reviewer-context publishing turns successful PRs into failures | Put required review context in the PR body and record optional comment failures as metadata/warnings unless PR creation itself failed |
| Legacy `mr*` surfaces confuse the implementation boundary | Document them as compatibility-only output and route new logic through normalized `ReviewResult`/`review.created` first |
| Graph-derived facts can drift during implementation | Re-run focused GitNexus status/impact checks before editing runner/provider code and keep the plan evidence anchored in direct source inspection |

## Post-Design Constitution Re-Check

PASS. The plan keeps GitHub delivery inside the documented MVP boundary,
preserves typed and replaceable provider contracts, limits runner auth work to a
bounded compatibility slice, and records concrete verification surfaces before
implementation claims parity.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | — |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | — | — |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | CLEAR | 3 planning refinements applied, 0 critical gaps |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | — |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | — |

**UNRESOLVED:** 0
**VERDICT:** ENG CLEARED — ready for task decomposition and small verified implementation slices.
