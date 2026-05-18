# Research: GitHub Repository Provider Parity

## Decision 1: Ship GitHub as a built-in `RepoProvider`, not as an external startup module

- **Decision**: Add `apps/runner-daemon/src/repo-providers/github.ts` beside the
  existing GitLab provider and register it in the built-in provider record.
- **Rationale**: The shared contract and registry already support `github`, and
  the MVP gap is specifically that Mystra lacks a concrete built-in GitHub path.
  An external module would prove extensibility, but not MVP parity.
- **Alternatives considered**:
  - Keep GitHub as a startup-loaded external module. Rejected because the repo
    still needs one first-party GitHub implementation to close the current MVP
    gap.
  - Fork workflow control flow for GitHub. Rejected because 010 already created
    the provider seam specifically to avoid provider-specific workflow branches.

## Decision 2: Treat clone/bootstrap auth normalization as part of this spec's bounded implementation

- **Decision**: Update runner/container auth plumbing so clone, push, and review
  steps can select provider-appropriate runtime credentials, while keeping that
  logic outside the shared workflow contract.
- **Rationale**: Source inspection shows the provider seam alone is not enough:
  `container-task.sh` still clones only with `MYSTRA_GITLAB_TOKEN`, and
  `apps/runner-daemon/src/index.ts` only injects GitLab token/base-url values
  into Docker steps. Without a narrow normalization slice, a GitHub-backed task
  cannot honestly reach the provider-owned delivery path.
- **Alternatives considered**:
  - Ignore clone/bootstrap and implement only push/review. Rejected because that
    would not produce end-to-end GitHub delivery.
  - Expand the shared contract with provider-specific secret names or API hosts.
    Rejected because it would violate the provider-boundary requirement.

## Decision 3: Keep required reviewer context in the pull request body

- **Decision**: Put task context, preview URLs, and quality-gate summary in the
  GitHub pull-request body. If the provider later publishes a follow-up comment
  for retained-preview operational notes, that comment is best-effort only.
- **Rationale**: This keeps the first GitHub slice independently testable and
  ensures reviewers still get useful context even if a secondary comment request
  fails after PR creation.
- **Alternatives considered**:
  - Put preview/quality context only in a follow-up comment. Rejected because
    comment failure would hide core reviewer context and inflate partial-success
    risk.
  - Put all context only in the title. Rejected because it is too small a
    surface for the required task, preview, and quality-gate information.

## Decision 4: Resolve GitHub host context inside the provider from repository metadata

- **Decision**: Implement a provider-owned `GitHubRepoContext` helper that can
  parse `github.com`, enterprise hosts, HTTPS URLs, and SSH-style remotes, then
  derive the normalized repo path, authenticated clone URL, branch URL base, and
  appropriate REST API base URL.
- **Rationale**: `RepositoryTarget.repoUrl` is intentionally loose, and the spec
  requires GitHub-compatible hosts without exposing GitHub API layout through
  shared contracts.
- **Alternatives considered**:
  - Add `githubApiBaseUrl` to shared contracts. Rejected because it would leak a
    provider implementation detail into general workflow/control-plane surfaces.
  - Support only `https://github.com/...` URLs. Rejected because the spec
    explicitly includes configured GitHub-compatible hosts and SSH-style edge
    cases.

## Decision 5: Preserve compatibility by treating MR-shaped outputs as transitional projections

- **Decision**: Keep writing normalized `reviewResult` first, then adapt any
  required legacy `mrUrl`, `mrIid`, and `mr.created` outputs from that review
  handle until follow-on cleanup removes the GitLab-biased compatibility layer.
- **Rationale**: The runner and shared result surfaces still carry GitLab names,
  but the cross-provider contract is already normalized. A projection strategy
  lets GitHub land without pretending the compatibility debt has disappeared.
- **Alternatives considered**:
  - Remove legacy MR outputs immediately. Rejected because the blast radius is
    larger than this bounded parity slice and may affect existing consumers.
  - Keep writing GitLab-only outputs directly from provider-specific code.
    Rejected because it would re-harden GitLab names at the wrong boundary.

## GitNexus Note

- **Observation**: `npx gitnexus analyze` was re-run on 2026-05-15, and
  `npx gitnexus status` now reports the local graph as up to date at commit
  `1606a0d`.
- **Planning impact**: Task decomposition and subsequent implementation review
  can rely on current graph state again, but code-level findings in this
  planning slice still cite direct source inspection so the evidence remains
  durable even if the graph drifts later.
