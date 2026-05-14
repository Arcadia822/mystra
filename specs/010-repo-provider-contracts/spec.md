# Feature Specification: Repository Provider Contracts

**Feature Branch**: `010-repo-provider-contracts`
**Created**: 2026-05-14
**Status**: Draft
**Dependency Note**: Initialize from `specs/004-open-agents-framework/contracts/framework-alignment.md`, `contracts/module-inventory.md`, `contracts/provider-seams.md`, and `contracts/fork-rules.md` before defining host-specific repository delivery behavior.
**Input**: Mystra MVP promises reviewable branch delivery for both GitLab and GitHub projects, but the repository-provider boundary is still only implied across PRODUCT.md, docs/SPEC.md, README.md, runner behavior, and follow-on specs. The MVP needs an explicit `RepoProvider` contract that defines repository access, branch push, and merge-request/pull-request delivery without hardcoding GitLab-only assumptions into workflow, runner, or agent features.

## User Scenarios & Testing *(mandatory)*

This is provider-boundary work. The scenarios use named technical actors because
the primary consumers are maintainers, provider implementers, and future agents.

### Technical Scenario 1 - Workflow Uses A Provider-Agnostic Repository Contract (Priority: P1)

A workflow maintainer can hand repository delivery work to a typed `RepoProvider`
contract instead of embedding GitLab-specific or GitHub-specific behavior in
workflow, runner, or shell-script code.

**Why this priority**: Repository delivery is core MVP behavior. If the
contract is not explicit, every follow-on feature will quietly encode its own
host-specific assumptions.

**Independent Test**: Replace the real provider with a stub implementation that
records requested repository operations; submit a job and verify the workflow
uses the stub contract without changing its own control flow.

**Acceptance Scenarios**:

1. **Given** a workflow needs repository preparation and review delivery,
   **When** it invokes the `RepoProvider`, **Then** it uses provider-agnostic
   contract methods instead of directly branching on GitLab or GitHub behavior.
2. **Given** a different `RepoProvider` implementation is registered,
   **When** the workflow runs, **Then** repository operations flow through the
   new provider without requiring workflow or runner contract changes.
3. **Given** a project selects a repository host, **When** a job is resolved for
   execution, **Then** the provider choice is derived from project/runtime
   state rather than from hardcoded workflow defaults.

---

### Technical Scenario 2 - GitLab Delivery Produces A Reviewable Branch And Merge Request (Priority: P1)

A repository provider implementer can deliver the current MVP GitLab flow
through a typed provider contract: prepare repository access, push a task
branch, and create a merge request with structured metadata returned to Mystra.

**Why this priority**: GitLab delivery is already part of the current product
story and existing runner behavior. The contract must preserve that path
without leaving it trapped in ad hoc shell logic.

**Independent Test**: Run a job against a GitLab-backed project, complete the
quality gate, and verify the provider returns branch and merge-request metadata
through the normalized delivery result.

**Acceptance Scenarios**:

1. **Given** a GitLab-backed project with valid repository credentials,
   **When** the provider delivers a successful run, **Then** the task branch is
   pushed and a merge request is created with returned URL and identifier.
2. **Given** the quality gate fails, **When** the workflow reaches repository
   delivery, **Then** the provider does not push or create a merge request.
3. **Given** merge-request creation fails after a successful push, **When** the
   provider returns control to Mystra, **Then** the failure is explicit and the
   branch push outcome remains visible rather than disappearing into a generic
   error.

---

### Technical Scenario 3 - GitHub Delivery Produces A Reviewable Branch And Pull Request (Priority: P1)

A repository provider implementer can deliver the MVP GitHub flow through the
same typed contract used for GitLab, while preserving provider-specific details
such as pull-request metadata and host-specific API differences behind the
provider implementation.

**Why this priority**: PRODUCT.md and docs/SPEC.md both say GitHub delivery is
part of the MVP boundary. The contract has to make that real instead of leaving
GitHub as a hand-waved future parity item.

**Independent Test**: Run a job against a GitHub-backed project, complete the
quality gate, and verify the provider returns branch and pull-request metadata
through the normalized delivery result.

**Acceptance Scenarios**:

1. **Given** a GitHub-backed project with valid repository credentials,
   **When** the provider delivers a successful run, **Then** the task branch is
   pushed and a pull request is created with returned URL and identifier.
2. **Given** a workflow requests provider-agnostic review delivery,
   **When** the active provider is GitHub, **Then** Mystra receives normalized
   review metadata without needing GitHub-specific handling in workflow code.
3. **Given** the branch push succeeds but pull-request creation fails,
   **When** the provider returns the delivery result, **Then** the partial
   outcome is preserved and explainable to operators and callers.

---

### Technical Scenario 4 - Credentials And Repository Metadata Stay At The Right Boundary (Priority: P2)

A platform operator can configure repository access without forcing workflow or
agent contracts to understand provider-specific token names, while still
respecting the MVP exclusion of per-repository secret-management product
features.

**Why this priority**: Repository delivery is credential-sensitive and easy to
get wrong. If auth handling leaks into workflow or agent contracts now, the
provider seam is fiction.

**Independent Test**: Review project/runtime configuration and provider
contracts; verify repository auth is represented through provider-owned auth
bindings or execution-time references, and that provider-specific token handling
stays inside the provider implementation boundary.

**Acceptance Scenarios**:

1. **Given** a project targets GitLab or GitHub, **When** repository access is
   resolved for execution, **Then** the provider receives an opaque auth binding
   or execution-time reference instead of requiring workflow or agent contracts
   to read raw provider-specific environment-variable names.
2. **Given** a future repository provider is added, **When** its auth mechanism
   differs from GitLab or GitHub, **Then** workflow and runner contracts do not
   need redesign merely to support the new auth style.

### Edge Cases

- What happens when the target branch already exists remotely?
- How does the provider report "push succeeded but MR/PR creation failed" so
  operators can recover without losing the branch outcome?
- What if the project repository host and the configured provider do not match?
- What if repository credentials are missing or invalid at execution time?
- What if the run produces no diff after agent execution?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Mystra MUST define a typed `RepoProvider` contract for
  repository-host access semantics, branch delivery, and
  merge-request/pull-request creation.
- **FR-002**: The `RepoProvider` contract MUST let workflow and runner code
  request repository operations without embedding GitLab-specific or
  GitHub-specific host logic.
- **FR-003**: Mystra MUST provide a GitLab repository-provider implementation
  that supports successful branch push plus merge-request creation for MVP
  delivery.
- **FR-004**: Mystra MUST provide a GitHub repository-provider implementation
  that supports successful branch push plus pull-request creation for MVP
  delivery.
- **FR-005**: Repository-provider results MUST normalize branch URL, review URL,
  provider review identifier, and partial-success failure states into a
  Mystra-owned delivery result contract.
- **FR-006**: Repository-provider contracts MUST isolate repository auth behind
  provider-owned bindings or execution-time references. The MVP MAY continue to
  source concrete credentials from runner-managed environment injection, but it
  MUST NOT require workflow, MCP, or agent contracts to depend on raw
  provider-specific secret names, and it MUST NOT expand into per-repository
  secret-management product scope.
- **FR-007**: The provider contract MUST make "no diff", "invalid repository
  auth", "push failed", and "review creation failed after push" observable as
  distinct outcomes.
- **FR-008**: Follow-on specs for workflow, MCP, and agent adapters MUST depend
  on this repository-provider contract instead of inventing host-specific branch
  or review semantics.

### Key Entities

- **RepoProvider**: The typed contract for repository access, branch push, and
  merge-request/pull-request delivery.
- **RepositoryTarget**: Project-owned repository identity, host, default branch,
  and provider selection metadata.
- **RepositoryAuthBinding**: A provider-owned opaque auth reference that can be
  resolved from runner-managed execution inputs today and from richer managed
  secret references later, without leaking provider-specific token names into
  unrelated contracts.
- **ReviewRequest**: Provider-agnostic review-delivery intent including branch,
  title, body, and task context.
- **ReviewResult**: Normalized outcome containing branch metadata, MR/PR URL,
  provider identifier, and explicit partial-success or failure information.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A workflow maintainer can swap the active repository provider
  without changing workflow control flow or runner contracts.
- **SC-002**: A successful GitLab-backed run produces a reviewable branch and
  merge request through the typed provider contract.
- **SC-003**: A successful GitHub-backed run produces a reviewable branch and
  pull request through the typed provider contract.
- **SC-004**: Operators can distinguish branch-push success from review-creation
  success or failure in Mystra's structured result surface.
- **SC-005**: Repository auth and delivery semantics remain localized to the
  provider boundary rather than leaking into workflow, runner, or agent-adapter
  contracts.
