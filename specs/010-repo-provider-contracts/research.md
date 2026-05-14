# Research: Repository Provider Contracts

## Decision 1: `RepoProvider` owns delivery semantics, not the runner shell

- **Decision**: Treat repository-provider behavior as a Mystra-owned contract for
  provider selection, auth binding, branch delivery, and review creation. The
  current shell implementation is evidence, not the contract owner.
- **Rationale**: `container-task.sh` currently knows too much: raw GitLab token
  names, branch push rules, MR API semantics, and GitLab-only result fields.
  That makes GitHub parity and future providers artificially expensive.
- **Alternatives considered**:
  - Leave repository behavior inside shell scripts. Rejected because the
    behavior is already a de facto contract across runner, result, and product
    docs.
  - Move all git operations into the control plane. Rejected because sandbox and
    workspace execution still happen on the runner host.

## Decision 2: The contract must separate branch delivery from review creation

- **Decision**: Normalize branch-push success separately from review-creation
  success so Mystra can explain partial outcomes such as "push succeeded but
  review creation failed."
- **Rationale**: The current GitLab implementation can fail after push. The
  product boundary explicitly needs reviewable branch delivery, and operators
  need to recover from partial success without losing the branch state.
- **Alternatives considered**:
  - Return one generic success/failure flag. Rejected because it hides recovery
    paths and makes provider differences leak into error interpretation.

## Decision 3: GitHub parity is part of the contract, not an optional note

- **Decision**: Keep GitHub inside the contract requirements even though current
  code evidence is GitLab-first.
- **Rationale**: `PRODUCT.md` and `docs/SPEC.md` both promise GitHub review
  delivery in the MVP. Contract work that quietly narrows back to GitLab-only
  would falsify the product boundary.
- **Alternatives considered**:
  - Make the contract GitLab-only until code catches up. Rejected because that
    would encode implementation lag as product truth.

## Decision 4: Repository auth remains opaque and execution-time scoped

- **Decision**: Model repository auth as a provider-owned binding/reference that
  can resolve from runner-managed environment injection today and from richer
  managed references later.
- **Rationale**: Mystra explicitly excludes per-repository secret management in
  the MVP. At the same time, workflow and agent contracts should not depend on
  raw provider-specific environment-variable names such as
  `MYSTRA_GITLAB_TOKEN`.
- **Alternatives considered**:
  - Put provider-specific token names directly into workflow/agent contracts.
    Rejected because it hardcodes the first implementation into unrelated
    boundaries.
  - Require full project-scoped secret management now. Rejected because it
    violates the current MVP boundary.

## Decision 5: Clone/bootstrap stays outside the `RepoProvider` boundary

- **Decision**: Keep repository cloning, workspace preparation, and sandbox-local
  git state under workflow/sandbox ownership, while `RepoProvider` owns remote
  host semantics such as auth, push, and review creation.
- **Rationale**: The sandbox provider already owns workspace and container
  execution behavior. Overloading `RepoProvider` with all repository-local file
  operations would blur seams instead of clarifying them.
- **Alternatives considered**:
  - Make `RepoProvider` responsible for the full local git lifecycle. Rejected
    because it duplicates sandbox/workflow responsibilities and hides execution
    ownership.

## Code Facts Captured

- `apps/runner-daemon/assets/container-task.sh` pushes branches and creates
  GitLab merge requests directly.
- `apps/runner-daemon/src/index.ts` injects GitLab-specific env names into task
  containers.
- `packages/shared/src/result.ts` exposes `mrUrl` and `mrIid`, which are not a
  neutral review contract.
- `packages/shared/src/events.ts` uses `mr.created` as the review creation event
  name.
