# Contract: `RepoProvider`

## Purpose

`RepoProvider` is the Mystra-owned boundary for repository-host semantics:
provider selection, auth binding interpretation, branch delivery, and review
creation. It does **not** own sandbox workspace preparation or generic workflow
ordering.

## Responsibilities

- Select the provider implementation from repository-host metadata.
- Interpret provider-owned auth bindings/references.
- Push the task branch to the remote host.
- Create a merge request or pull request from a previously delivered branch.
- Return provider-neutral branch and review outcomes.

## Non-Responsibilities

- Cloning the repository into a workspace.
- Preparing container mounts, caches, or secret injection mechanisms.
- Choosing workflow order or retry policy.
- Generating branch names, titles, or review bodies.

## Proposed Type Surface

```ts
type RepoProviderKind = "gitlab" | "github";

interface RepositoryTarget {
  projectId: string;
  repoUrl: string;
  hostKind: RepoProviderKind | "unknown";
  defaultBaseBranch: string;
}

interface RepositoryAuthBinding {
  kind: "runner-env" | "runtime-ref" | "future-managed-ref";
  provider: RepoProviderKind;
  reference: string;
  metadata?: Record<string, unknown>;
}

interface BranchDeliveryRequest {
  target: RepositoryTarget;
  branchName: string;
  baseBranch: string;
  commitMessage: string;
  auth: RepositoryAuthBinding;
}

interface ReviewRequest {
  branch: BranchDeliveryReceipt;
  title: string;
  body: string;
}

interface RepoProvider {
  readonly providerName: RepoProviderKind;
  supports(target: RepositoryTarget): boolean;
  pushBranch(input: BranchDeliveryRequest): Promise<BranchDeliveryReceipt>;
  createReview(input: ReviewRequest): Promise<ReviewResult>;
}
```

## Leakage Guards

Shared Mystra contracts must **not** leak:

- GitLab-specific names such as `mrUrl` or `mrIid` as the stable cross-provider
  contract.
- Raw environment-variable names like `MYSTRA_GITLAB_TOKEN` into workflow, MCP,
  or agent surfaces.
- GitLab API endpoint layout as a requirement for GitHub or future providers.

## First Implementation Mapping

| Concern | Current implementation fact | Planned contract owner |
|---|---|---|
| Auth input | `MYSTRA_GITLAB_TOKEN` env injection from `apps/runner-daemon/src/index.ts` | `RepositoryAuthBinding` |
| Branch push | git push inside `apps/runner-daemon/assets/container-task.sh` | `RepoProvider.pushBranch()` |
| Review creation | GitLab MR POST in `apps/runner-daemon/assets/container-task.sh` | `RepoProvider.createReview()` |

## Verification

- GitLab implementation can satisfy the provider-neutral request/result contract.
- A GitHub implementation can be added without changing workflow control flow.
- Shared result/event surfaces stop treating GitLab naming as the universal
  contract.
