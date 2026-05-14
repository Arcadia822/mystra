# Tasks: GitHub Repository Provider Parity

**Input**: Design documents from `/specs/012-github-repo-provider-parity/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Add focused shared-schema and runner/provider tests because this
feature changes repository-delivery behavior across provider, runner, and
transitional result/event compatibility surfaces.

**Organization**: Tasks are grouped by technical scenario so each scenario can
be implemented and validated independently without widening beyond the bounded
GitHub parity slice.

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup (Shared Planning Surface)

**Purpose**: Freeze the exact code and compatibility touchpoints before behavior changes land.

- [ ] T001 Audit GitHub parity touchpoints in `apps/runner-daemon/src/repo-providers/gitlab.ts`, `apps/runner-daemon/src/index.ts`, `apps/runner-daemon/assets/container-task.sh`, `apps/runner-daemon/src/container-task.test.ts`, `packages/shared/src/repository.ts`, `packages/shared/src/result.ts`, and `packages/shared/src/events.ts`
- [ ] T002 [P] Reconcile the 012 spec artifacts (`plan.md`, `quickstart.md`, `contracts/*.md`) with any implementation-time contract adjustments before code review

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Remove the remaining GitLab-only bootstrap assumptions that block any honest GitHub-backed run.

**⚠️ CRITICAL**: No GitHub provider work should begin until this phase is complete

- [ ] T003 [P] Add shared-schema tests in `packages/shared/src/repository.test.ts` and `packages/shared/src/result.test.ts` for GitHub review handles, `review_failed_after_push`, and transitional `mrUrl` / `mrIid` serialization
- [x] T004 [P] Extend static runner coverage in `apps/runner-daemon/src/container-task.test.ts` to assert provider-aware clone env selection, runtime secret fallback, and review-created compatibility expectations
- [x] T005 Refactor `apps/runner-daemon/assets/container-task.sh` so clone/bootstrap auth selection supports GitHub and GitLab from provider-neutral repo metadata instead of hardcoding `MYSTRA_GITLAB_TOKEN` and `MYSTRA_GITLAB_HTTP_BASE_URL`
- [x] T006 Refactor `apps/runner-daemon/src/index.ts` so `defaultDockerSecrets()`, workflow-step env injection, and repository auth binding selection derive provider-specific secret references without adding a GitHub-only workflow branch

**Checkpoint**: A GitHub-backed run can reach clone, push, and review preparation without GitLab-only secret assumptions.

---

## Phase 3: Technical Scenario 1 - GitHub-Backed Projects Deliver A Reviewable Branch And Pull Request (Priority: P1) 🎯 MVP

**Goal**: Add a concrete built-in GitHub provider that uses the existing `RepoProvider` seam and runner flow.

**Independent Test**: A GitHub-backed repository target produces a pushed branch and normalized pull-request review handle through the same runner/provider path already used for GitLab.

### Tests for Technical Scenario 1

- [x] T007 [P] [TS1] Add GitHub provider tests in `apps/runner-daemon/src/repo-providers/github.test.ts` for `github.com`, enterprise hosts, SSH-style remotes, branch URL generation, and normalized review handle projection
- [x] T008 [P] [TS1] Extend `apps/runner-daemon/src/repo-providers.test.ts` so the built-in registry selects GitHub by `hostKind` and `supports()` fallback without breaking GitLab registration

### Implementation for Technical Scenario 1

- [x] T009 [TS1] Implement `apps/runner-daemon/src/repo-providers/github.ts` with provider-owned host parsing, authenticated branch push, and pull-request creation behind the shared `RepoProvider` contract
- [x] T010 [TS1] Update `apps/runner-daemon/src/repo-providers.ts` to register the built-in GitHub provider beside GitLab and preserve startup-module extension behavior

**Checkpoint**: GitHub is a first-party provider implementation under the same boundary as GitLab.

---

## Phase 4: Technical Scenario 2 - Reviewer Context Reaches GitHub Pull Requests With MVP Parity (Priority: P1)

**Goal**: Keep the first GitHub review artifact useful to humans, not just structurally valid.

**Independent Test**: A GitHub pull request contains task context, preview URLs, and quality-gate notes in the provider-owned PR body, with optional follow-up comment failure recorded as metadata only.

### Tests for Technical Scenario 2

- [x] T011 [P] [TS2] Add PR-body composition tests in `apps/runner-daemon/src/repo-providers/github.test.ts` for task body, preview metadata, quality-gate summary, and preview-section omission when metadata is absent
- [x] T012 [P] [TS2] Add best-effort follow-up comment tests in `apps/runner-daemon/src/repo-providers/github.test.ts` proving comment failure does not change `ReviewResult.status` away from `review_created`

### Implementation for Technical Scenario 2

- [x] T013 [TS2] Implement GitHub review-context projection in `apps/runner-daemon/src/repo-providers/github.ts` so required reviewer context lives in the PR body and optional comment status is captured in provider metadata

**Checkpoint**: Reviewers can open the GitHub PR and understand the task and preview state without relying on GitLab-only notes.

---

## Phase 5: Technical Scenario 3 - Partial Success And Failure Modes Stay Explainable (Priority: P1)

**Goal**: Preserve explicit outcome mapping when GitHub delivery succeeds only partially or fails early.

**Independent Test**: GitHub provider tests and runner/shared projections distinguish no diff, auth invalid, push failed, and review failed after push while retaining the successful branch outcome when only PR creation fails.

### Tests for Technical Scenario 3

- [x] T014 [P] [TS3] Add failure-mapping tests in `apps/runner-daemon/src/repo-providers/github.test.ts` for `no_diff`, `auth_invalid`, push rejection, and PR-create-failed-after-push
- [x] T015 [P] [TS3] Extend `packages/shared/src/repository.test.ts` and `apps/runner-daemon/src/container-task.test.ts` to cover normalized `review.created` data plus transitional `mr.created` compatibility when the provider is GitHub

### Implementation for Technical Scenario 3

- [ ] T016 [TS3] Update `apps/runner-daemon/src/index.ts` so `dockerResultFromReviewResult()`, workflow-node completion data, and emitted review events preserve GitHub `ReviewResult` details without re-hardcoding GitLab semantics
- [ ] T017 [TS3] Update the compatibility projections in `apps/runner-daemon/src/repo-providers/gitlab.ts` and adjacent event/result mapping so `review.created` stays normalized while `mrUrl`, `mrIid`, and `mr.created` remain coherent during the transition

**Checkpoint**: Operators can diagnose GitHub delivery failures from structured outputs instead of shell logs.

---

## Phase 6: Technical Scenario 4 - GitHub Auth And Host Semantics Stay Behind The Provider Boundary (Priority: P2)

**Goal**: Keep GitHub-specific host and auth details localized enough that future provider work remains boring.

**Independent Test**: Shared contracts and runner workflow continue to pass provider-neutral repository targets and auth bindings, while GitHub enterprise/API host behavior remains provider-owned.

### Tests for Technical Scenario 4

- [ ] T018 [P] [TS4] Add regression coverage in `apps/runner-daemon/src/repo-providers/github.test.ts` and `apps/runner-daemon/src/container-task.test.ts` for enterprise-host API-base overrides and SSH clone normalization

### Implementation for Technical Scenario 4

- [ ] T019 [TS4] Keep GitHub-only API host and auth interpretation inside `apps/runner-daemon/src/repo-providers/github.ts` and the bounded runner glue in `apps/runner-daemon/src/index.ts` / `apps/runner-daemon/assets/container-task.sh`, without adding new shared contract fields

**Checkpoint**: GitHub host/auth behavior is localized and future provider maintenance does not require new workflow contracts.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Close the loop across docs, verification, and review.

- [ ] T020 [P] Update `specs/012-github-repo-provider-parity/quickstart.md`, `specs/012-github-repo-provider-parity/contracts/github-repo-provider.md`, and `specs/012-github-repo-provider-parity/contracts/github-review-context.md` to match the landed implementation details
- [ ] T021 Run focused verification: `pnpm --filter @mystra/shared test && pnpm --filter @mystra/runner-daemon test`
- [ ] T022 Run broad verification: `pnpm typecheck`
- [ ] T023 Run the project-local `code-review-and-quality` gate or an equivalent explicit review pass against the finished 012 diff before committing the completed spec

---

## Dependencies & Execution Order

### Phase Dependencies

- Phase 1 → Phase 2 → all technical scenarios
- TS1 depends on Phase 2 because GitHub parity is not honest until clone/bootstrap auth stops assuming GitLab
- TS2 depends on TS1 because reviewer-context projection needs a concrete GitHub PR implementation
- TS3 depends on TS1 and shares `apps/runner-daemon/src/index.ts` with Phase 2, so expect sequential work there
- TS4 depends on TS1 because host/auth localization only exists after the GitHub provider is real

### Parallel Opportunities

- T003 and T004 can run in parallel
- T007 and T008 can run in parallel after Phase 2 stabilizes
- T011 and T012 can run in parallel once basic GitHub PR creation exists
- T014, T015, and T018 can run in parallel after the first GitHub provider slice is green

### Implementation Strategy

1. Remove GitLab-only bootstrap/auth assumptions first.
2. Land the smallest working GitHub provider slice.
3. Add reviewer context and failure mapping without widening shared contracts.
4. Finish with boundary hardening, docs reconciliation, verification, and explicit review.
