# Contract: Repository and Issue Workspace Policies

## Integration repository boundary

`RepoProvider` remains the Integration discovery/identity capability. Feature 048 does not add provider-specific Git branch methods.

```ts
interface RepoProvider {
  readonly providerName: string;
  listRepositories(input: RepositoryListRequest): Promise<RepositoryListResponse>;
  getRepository(identifier: string): Promise<RepositorySnapshot | undefined>;
}
```

Guarantees:

- repository list/get may expose the Provider-observed `defaultBranch` as a creation hint。
- repository identity and exact Project connection remain authoritative for access resolution。
- Git branch enumeration and resolution do not call GitHub/GitLab branch REST APIs through this interface。

## Standard Git repository boundary

```ts
declare const gitRemoteAccessBrand: unique symbol;
type GitRemoteAccess = { readonly [gitRemoteAccessBrand]: true };

type GitRemoteRef = {
  name: string;
  ref: `refs/heads/${string}`;
  commit: string;
};

type GitRemoteReadInput = {
  access: GitRemoteAccess;
  timeoutMs: number;
  maxRefs: number;
  maxOutputBytes: number;
};

type GitRemoteBranchResolveInput = GitRemoteReadInput & {
  branch: string;
};

type GitRemoteRefAdvertisement = {
  head: GitRemoteRef | null;
  branches: GitRemoteRef[];
};

interface GitRemoteRepositoryReader {
  inspectBranches(input: GitRemoteReadInput): Promise<GitRemoteRefAdvertisement>;
  resolveBranch(input: GitRemoteBranchResolveInput): Promise<GitRemoteRef>;
}
```

Semantics:

- `inspectBranches` uses one standard Git ref advertisement equivalent to `git ls-remote --symref --quiet <remote> HEAD 'refs/heads/*'`；`resolveBranch` uses an exact `refs/heads/<branch>` pattern with `--refs --exit-code --quiet`。
- all operations use transient access material derived from the exact Project connection；no other credential or public URL fallback。
- `GitRemoteAccess` is created just in time by the existing exact-connection credential/access seam and is internal, opaque and non-serializable；it is not a public credential-bearing URL or token。
- results are validated into shared strict DTOs；third-party Git output is untrusted input。
- Project branch inspection defaults to a 30-second timeout、10,000 refs and 8 MiB stdout cap；exceeding any limit returns `repository_branches_unavailable` and the setting UI may use text mode。
- an empty/unborn repository returns `head=null` and an empty branch list；exact resolve exit status 2 means configured branch missing；auth、transport、timeout、malformed or other nonzero results map to stable redacted errors。

Canonical Project API:

```http
GET /api/projects/{slug}/repository/branches?first=100&after=<opaque>&query=<optional>
```

```ts
type ProjectRepositoryBranchPage = {
  branches: Array<{ name: string; ref: string; commit: string }>;
  head: { name: string; ref: string; commit: string } | null;
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
};
```

- route derives connection and repository identity from Project；callers cannot override them。
- `first` is 1..100 (default 50) and `query` is optional 1..200 characters；the API filters and paginates the bounded advertisement after the Git reader returns。
- branches sort by canonical full ref using stable UTF-8 byte order。The opaque cursor reuses the existing scoped-cursor pattern and binds version、Project、connection、repository external ID、query and last ref。
- remote refs may change between page requests；pagination is best-effort configuration assistance, not a repository snapshot or execution input。Refresh restarts from the first page。
- list failure returns `repository_branches_unavailable` and is never represented as an empty success page。
- Web/CLI may degrade to a plain branch-name setting when list/read is unavailable；they still validate Git ref syntax。
- Setup always calls `resolveBranch` authoritatively and fails closed if the configured branch does not resolve。

## Project default branch setting

- `Project.repositoryBaseBranch` is required, user-editable Project configuration。
- repository selection may prefill it from the Provider's current default branch or standard Git symbolic `HEAD`, but the submitted value is persisted as ordinary Mystra configuration。
- changing it affects only Task Workspaces created after the change；existing Workspace provenance and retry intent remain frozen。
- Repo Info refresh must never overwrite it。

## Issue branch policy

`IssueProvider` adds a required method for GitHub and Linear adapters.

```ts
interface IssueProvider {
  readonly providerName: string;
  readonly repositoryScope: "required" | "optional" | "unsupported";
  listIssues(input: IssueListRequest): Promise<IssueListResponse>;
  getIssue(input: IssueGetRequest): Promise<Issue | undefined>;

  resolveWorkspaceBranch(input: {
    issue: ExactTaskIssueReference;
    taskId: string;
  }): Promise<WorkspaceBranchDecision>;
}
```

Guarantees:

- deterministic for the same exact Issue identity and Task identity under one policy version。
- returns a branch candidate and explicit strategy version；does not run Git。
- provider unavailability or missing Issue maps to `issue_branch_unavailable`。
- result still passes control-plane safe-ref validation；provider output is not trusted shell input。

## Manual Task fallback

Only `TaskWorkspaceService` applies:

```text
mystra/task-<task-short-id>
```

- used only when Task has no Issue reference。
- never used when Issue policy exists but fails。
- `<task-short-id>` is a deterministic lowercase prefix long enough to avoid practical collision；the exact length is fixed in shared tests。

## Credential resolution

- GitHub App: resolve installation token just in time；token remains hosted-only until activation prerequisites exist。
- self-hosted GitHub PAT: resolve exact Project connection PAT just in time through `SecretProvider`；it remains a long-lived secret and must not be mislabeled as short-lived。
- App and PAT never silently fallback to one another。
- secret is separate from `RepositoryWorkspaceDecision`, delivered only to authenticated runner claim, held in memory, redacted from logs/errors, and never reported back。
