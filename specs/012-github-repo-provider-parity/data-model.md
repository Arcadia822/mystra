# Data Model: GitHub Repository Provider Parity

## Entities

### GitHubRepoProvider

- **Purpose**: Concrete `RepoProvider` implementation for GitHub-hosted targets.
- **Fields / responsibilities**:
  - `providerName = "github"`
  - `supports(target)` based on `hostKind` or parsed repo host
  - `pushBranch(input)` for authenticated push and branch receipt projection
  - `createReview(input)` for pull-request creation and reviewer-context
    publication
- **Relationships**:
  - Consumes `RepositoryTarget`, `RepositoryAuthBinding`,
    `BranchDeliveryRequest`, and `ReviewRequest`
  - Produces `BranchDeliveryReceipt` and `ReviewResult`

### GitHubRepoContext

- **Purpose**: Provider-owned resolution of repository identity plus the derived
  authenticated clone and HTTP/API endpoints from a repository target.
- **Fields**:
  - `repoPath: string`
  - `apiBaseUrl: string`
  - `authenticatedRepoUrl: string`
  - `branchUrlBase: string`
- **Validation rules**:
  - Must accept `github.com` and enterprise-style hosts
  - Must reject non-GitHub hosts when `providerName === "github"`
  - Must normalize `.git` suffixes and SSH-style remote forms
  - Must trim trailing slashes from any provider-owned API-base override before
    constructing REST endpoints

### GitHubAuthContext

- **Purpose**: Runtime resolution of a provider-neutral auth binding into a
  provider-usable token and host metadata.
- **Fields**:
  - `bindingKind: "runner-env" | "runtime-ref" | "future-managed-ref"`
  - `reference: string`
  - `tokenPresent: boolean`
  - `hostOverride?: string`
- **Validation rules**:
  - MVP implementation accepts `runner-env`
  - Provider must return `auth_invalid` when the referenced token is absent
  - Shared contracts must not require raw GitHub token env names outside the
    provider/runner glue

### GitHubBranchProjection

- **Purpose**: GitHub-specific mapping from a successful push into Mystra's
  normalized branch receipt.
- **Fields**:
  - `branchName: string`
  - `branchUrl: string`
  - `commitSha?: string`
  - `status: "pushed" | "no_diff" | "failed"`
  - `errorCode?: string`
  - `errorMessage?: string`
- **Validation rules**:
  - `branchUrl` exists only when `status === "pushed"`
  - `errorCode`/`errorMessage` exist for failure states

### GitHubPullRequestProjection

- **Purpose**: Provider-owned mapping from GitHub PR creation into Mystra's
  normalized review result.
- **Fields**:
  - `status: "review_created" | "review_failed_after_push" | "auth_invalid" | "no_diff"`
  - `review.url?: string`
  - `review.number?: number`
  - `review.displayId?: string`
  - `metadata.repo?: string`
  - `metadata.targetBranch?: string`
  - `metadata.frontendPreviewUrl?: string | null`
  - `metadata.backendPreviewUrl?: string | null`
  - `metadata.qualityGate?: { status?: unknown; sequence?: unknown; logPath?: unknown }`
  - `metadata.contextCommentStatus?: "published" | "failed"`
- **Validation rules**:
  - `review` must be present when `status === "review_created"`
  - `branch.status` must stay `"pushed"` when PR creation fails after push
  - Optional comment failure must not erase a successfully created review handle
  - When no follow-up comment is attempted, `contextCommentStatus` is omitted

## Relationships

```text
RepositoryTarget + RepositoryAuthBinding
  -> GitHubRepoContext + GitHubAuthContext
    -> GitHubRepoProvider.pushBranch()
      -> GitHubBranchProjection / BranchDeliveryReceipt
        -> GitHubRepoProvider.createReview()
          -> GitHubPullRequestProjection / ReviewResult
            -> RunResult.reviewResult + transitional mr* projections
```

## State Transitions

### Branch delivery

```text
pending
  -> pushed
  -> no_diff
  -> failed(push_failed | auth_invalid)
```

### Review delivery

```text
branch pushed
  -> review_created
  -> review_failed_after_push
  -> auth_invalid

branch no_diff
  -> no_diff
```

## Notes

- `RepositoryTarget` and `RepositoryAuthBinding` remain the stable shared
  contracts from 010; this spec adds GitHub-owned realization details rather
  than new shared entities.
- Transitional `mrUrl`/`mrIid` outputs are projections from the normalized
  review handle, not first-class GitHub data-model owners.
