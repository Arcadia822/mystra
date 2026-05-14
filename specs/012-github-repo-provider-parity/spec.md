# Feature Specification: GitHub Repository Provider Parity

**Feature Branch**: `012-github-repo-provider-parity`  
**Created**: 2026-05-15  
**Status**: Implemented; closure verified  
**Dependency Note**: Build on the realized `RepoProvider` seam in `specs/010-repo-provider-contracts/` and the runtime execution work committed in `b85fd0f`, which introduced shared repository contracts and a runner registry but only a concrete GitLab provider implementation.  
**Input**: User description: "Complete Mystra MVP GitHub repository delivery parity on top of the realized RepoProvider seam"

## User Scenarios & Testing *(mandatory)*

This is repository-provider delivery work. User-story theater would obscure the
real actors, so the spec uses named technical scenarios: platform operators,
repository provider implementers, reviewers, and future Mystra agents that need
GitHub delivery to be as real as the already-wired GitLab path.

### Technical Scenario 1 - GitHub-Backed Projects Deliver A Reviewable Branch And Pull Request (Priority: P1)

A repository provider implementer can run a GitHub-backed Mystra job through the
existing `RepoProvider` seam and produce a pushed branch plus a pull request
without changing workflow or runner control flow.

**Why this priority**: The current repository state still shows GitHub as the
largest unclosed MVP gap on the delivery path. Shared contracts and runner
selection already accept `github`, but only `gitlab.ts` exists as a real
provider implementation.

**Independent Test**: Execute the runner delivery path with a GitHub repository
target and valid GitHub credentials, then verify the normalized review result
contains a branch URL, pull-request URL, and provider-owned review identifier.

**Acceptance Scenarios**:

1. **Given** a job targets a GitHub-backed repository and the quality gate has
   passed, **When** the active `RepoProvider` is selected, **Then** Mystra pushes
   the task branch and creates a pull request through the GitHub implementation.
2. **Given** the workflow and runner only consume provider-neutral repository
   request/result contracts, **When** the active provider is GitHub, **Then**
   repository delivery succeeds without adding GitHub-specific branching to
   shared workflow control flow.
3. **Given** the target repository uses `github.com` or a configured GitHub host,
   **When** Mystra resolves provider ownership from repository metadata, **Then**
   the GitHub provider is selected without requiring a separate workflow path.

---

### Technical Scenario 2 - Reviewer Context Reaches GitHub Pull Requests With MVP Parity (Priority: P1)

A reviewer can open the GitHub pull request created by Mystra and see the same
core review context the MVP already provides on GitLab: branch delivery,
operator-facing task title/body, and available preview or quality-gate notes.

**Why this priority**: GitHub parity is not just "an API call happened." The
review artifact has to remain useful to humans inspecting the result.

**Independent Test**: Run a GitHub-backed delivery with preview and quality-gate
metadata present, then verify the pull request contains the expected review body
and any reviewer-facing follow-up note or comment defined by the provider.

**Acceptance Scenarios**:

1. **Given** a completed GitHub-backed run includes a task title and body,
   **When** the GitHub provider creates the pull request, **Then** the reviewer
   receives a review artifact with the expected task context rather than a
   generic placeholder.
2. **Given** preview URLs or quality-gate metadata are available,
   **When** the GitHub provider publishes reviewer context, **Then** that context
   is surfaced through GitHub-owned review surfaces without forcing other
   providers to copy GitHub-specific behavior.
3. **Given** a GitHub-backed run has no preview metadata, **When** the pull
   request is created, **Then** the provider omits preview context cleanly
   instead of publishing misleading empty placeholders.

---

### Technical Scenario 3 - Partial Success And Failure Modes Stay Explainable (Priority: P1)

A platform operator can distinguish "no diff", "auth invalid", "push failed",
and "pull request creation failed after push" for GitHub-backed jobs without
losing the successful branch outcome when only review creation fails.

**Why this priority**: The new seam is only credible if GitHub uses the same
normalized delivery outcomes already promised by the shared contracts.

**Independent Test**: Exercise GitHub provider tests for no-diff, missing auth,
push rejection, and PR-create-failed-after-push cases, then verify each one maps
to the shared `ReviewResult` status vocabulary.

**Acceptance Scenarios**:

1. **Given** a GitHub-backed run produces no repository changes, **When**
   delivery is attempted, **Then** Mystra records a distinct no-diff outcome and
   does not create a pull request.
2. **Given** the branch push succeeds but GitHub pull-request creation fails,
   **When** the provider returns control, **Then** the pushed-branch result
   remains visible together with an explicit review failure outcome.
3. **Given** GitHub credentials are missing or invalid, **When** the provider is
   invoked, **Then** Mystra reports an explicit auth failure instead of a generic
   runner error.

---

### Technical Scenario 4 - GitHub Auth And Host Semantics Stay Behind The Provider Boundary (Priority: P2)

A future Mystra agent can add or maintain GitHub delivery behavior without
forcing workflow, MCP, or control-plane contracts to understand raw GitHub token
environment-variable names or GitHub-specific API endpoint layouts.

**Why this priority**: The seam introduced in 010 becomes fiction again if
GitHub parity reintroduces host-specific leakage into shared contracts.

**Independent Test**: Review the GitHub provider inputs and surrounding shared
contracts; verify GitHub host resolution and auth handling stay localized to the
provider implementation and normalized `RepositoryAuthBinding`.

**Acceptance Scenarios**:

1. **Given** a GitHub provider implementation requires host-specific auth and API
   behavior, **When** workflow and runner contracts invoke it, **Then** they pass
   only provider-neutral repository targets, review requests, and auth bindings.
2. **Given** GitHub Enterprise and `github.com` differ in host layout,
   **When** the provider constructs branch and review URLs, **Then** those host
   details remain internal to the provider rather than becoming shared contract
   fields.

### Edge Cases

- What happens when the GitHub target branch already has an open pull request for
  the task branch?
- How should the provider behave when the repository URL uses SSH syntax but the
  branch push and API calls need an HTTPS host context?
- What happens when the branch push is accepted but pull-request creation is
  rejected because the source and target branches no longer differ?
- How does Mystra report a GitHub host mismatch when a project claims `github`
  but the repository URL resolves to another provider?
- What reviewer context is preserved when preview URLs exist but GitHub comment
  creation fails after the pull request itself succeeds?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Mystra MUST provide a concrete GitHub `RepoProvider`
  implementation that satisfies the existing provider-neutral branch-delivery
  and review-creation contract introduced by spec 010.
- **FR-002**: A successful GitHub-backed delivery MUST push the task branch and
  create a pull request without requiring workflow or runner control-flow
  changes that are unique to GitHub.
- **FR-003**: The GitHub provider MUST support repository targets hosted on
  `github.com` and configured GitHub-compatible hosts derived from repository
  metadata.
- **FR-004**: GitHub delivery MUST return Mystra's normalized review result
  surface, including branch URL, review URL, provider review identifier, and
  distinct outcome statuses for `no_diff`, `auth_invalid`, `push_failed`, and
  `review_failed_after_push`.
- **FR-005**: When reviewer-facing metadata such as task context, preview URLs,
  or quality-gate notes is available, the GitHub provider MUST publish that
  context through GitHub review surfaces while keeping the shared result
  contract provider-neutral.
- **FR-006**: GitHub auth handling MUST remain behind `RepositoryAuthBinding` and
  provider-owned metadata; workflow, MCP, and control-plane contracts MUST NOT
  depend on raw GitHub token environment-variable names or GitHub API endpoint
  shapes.
- **FR-007**: The GitHub provider MUST preserve partial success when branch push
  succeeds but pull-request creation or follow-up reviewer context publication
  fails.
- **FR-008**: Shared runner, control-plane, and result-reporting paths MUST
  consume GitHub delivery through the same normalized repository-provider
  contract already used for GitLab.

### Key Entities *(include if feature involves data)*

- **GitHubRepoProvider**: The concrete provider implementation that realizes
  GitHub branch push and pull-request creation behind the Mystra-owned
  `RepoProvider` interface.
- **GitHubRepoContext**: Provider-owned repository-resolution helper derived from
  a GitHub repository target so repo path normalization, authenticated clone
  URLs, branch URLs, and API-base behavior remain localized.
- **GitHubReviewProjection**: Provider-owned mapping from GitHub pull-request and
  optional comment results into Mystra's normalized review result and structured
  events.
- **RepositoryAuthBinding**: The existing provider-neutral auth reference that
  points the GitHub provider at runtime-injected credentials without leaking raw
  secret names into shared contracts.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A GitHub-backed Mystra run can complete branch delivery and pull
  request creation through the existing repository-provider seam with no new
  provider-specific workflow branch.
- **SC-002**: GitHub-backed successful runs surface the same normalized branch
  and review metadata categories already consumed by Mystra for GitLab-backed
  runs.
- **SC-003**: Operators can distinguish at least four GitHub delivery outcomes —
  no diff, auth invalid, push failed, and review failed after push — from
  structured run data without reading transient shell output.
- **SC-004**: Reviewers receive a GitHub pull request containing the intended
  task context and any available MVP preview or quality-gate notes.
- **SC-005**: GitHub-specific host and auth behavior remains localized enough
  that future provider work does not require new shared workflow, MCP, or result
  contracts.
