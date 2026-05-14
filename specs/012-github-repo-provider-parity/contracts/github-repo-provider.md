# Contract: GitHub `RepoProvider`

## Purpose

Define the GitHub-specific realization of Mystra's provider-neutral
`RepoProvider` seam without leaking GitHub host, auth, or API details into
workflow, MCP, or control-plane contracts.

## Provider-Owned Responsibilities

- Resolve GitHub repository identity from `RepositoryTarget.repoUrl`
- Interpret `RepositoryAuthBinding` for GitHub runtime credentials
- Push the task branch to GitHub
- Create a pull request from the pushed branch
- Return Mystra's normalized `BranchDeliveryReceipt` and `ReviewResult`

## Required Inputs

```ts
interface GitHubProviderInput {
  target: RepositoryTarget;
  auth: RepositoryAuthBinding; // provider === "github"
  metadata?: {
    localRepoPath?: string;
    githubHttpBaseUrl?: string;
    frontendPreviewUrl?: string | null;
    backendPreviewUrl?: string | null;
    previewContainer?: string | null;
    qualityGate?: {
      status?: unknown;
      sequence?: unknown;
      logPath?: unknown;
    };
  };
}
```

## Host Resolution Rules

- `github.com` uses:
  - web base: `https://github.com`
  - API base: `https://api.github.com`
- Enterprise-style hosts derive:
  - web base from the repository host
  - API base from the same host using the provider-owned default path
    (`/api/v3`) unless provider metadata overrides it
- SSH-like remotes (`git@host:owner/repo.git`) must normalize to the same owner,
  repo, and host context as HTTPS URLs
- Non-GitHub hosts must return a provider-owned failure instead of silently
  misrouting to GitHub APIs

## Auth Rules

- MVP implementation accepts `RepositoryAuthBinding.kind === "runner-env"`
- Missing referenced credentials return:

```ts
{
  status: "auth_invalid",
  errorCode: "auth_invalid"
}
```

- Shared contracts must not depend on raw env names such as
  `MYSTRA_GITHUB_TOKEN`; only the provider/runner glue may interpret them

## Output Mapping

### Branch push

```ts
{
  status: "pushed" | "no_diff" | "failed",
  branchName,
  branchUrl?,
  commitSha?,
  errorCode?,
  errorMessage?
}
```

### Pull request creation

```ts
{
  status:
    | "review_created"
    | "review_failed_after_push"
    | "auth_invalid"
    | "no_diff",
  branch,
  review?: {
    provider: "github",
    url,
    number,
    displayId: `#${number}`
  },
  metadata?: Record<string, unknown>,
  errorCode?,
  errorMessage?
}
```

## Failure Semantics

| Situation | Expected status | Notes |
|---|---|---|
| No repository diff | `no_diff` | No PR created |
| Missing/invalid token | `auth_invalid` | Explicit auth failure, not a generic runner error |
| Push rejected | `push_failed` via branch receipt | Review creation must not run |
| Push succeeds, PR create fails | `review_failed_after_push` | Preserve pushed branch metadata |
| PR succeeds, optional follow-up comment fails | `review_created` | Record comment failure in metadata/warnings only |

## Leakage Guards

Shared Mystra contracts must not add:

- GitHub REST endpoint paths
- Provider-specific request payload shapes
- Raw GitHub token environment variable names
- GitHub-only workflow branching outside provider/runner glue
