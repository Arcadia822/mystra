# Data Model: Repository Provider Contracts

## Entities

### RepositoryTarget

The provider-neutral description of where Mystra is delivering review output.

| Field | Type | Notes |
|---|---|---|
| `projectId` | UUID | Durable project owner for the repository target |
| `repoUrl` | string | Canonical remote URL or host/path identifier |
| `hostKind` | `gitlab \| github \| unknown` | Derived from repository identity, not sandbox provider |
| `defaultBaseBranch` | string | Branch the review targets by default |

### RepositoryAuthBinding

Opaque repository auth reference consumed by the active provider.

| Field | Type | Notes |
|---|---|---|
| `kind` | `runner-env \| runtime-ref \| future-managed-ref` | MVP can use `runner-env`; richer refs stay possible later |
| `provider` | `gitlab \| github` | Which provider resolves the binding |
| `reference` | string | Opaque binding name; not a secret value |
| `metadata` | object | Non-secret hints such as API base URL or scope label |

### BranchDeliveryRequest

Provider-neutral input for branch push behavior.

| Field | Type | Notes |
|---|---|---|
| `target` | `RepositoryTarget` | Repository host and base metadata |
| `branchName` | string | Task-owned branch name; Mystra does not sanitize in MVP |
| `baseBranch` | string | Effective base branch for push/review |
| `commitMessage` | string | Commit title/body policy remains task-owned |
| `auth` | `RepositoryAuthBinding` | Execution-time binding only |

### ReviewRequest

Provider-neutral request to create a merge request or pull request.

| Field | Type | Notes |
|---|---|---|
| `branch` | `BranchDeliveryReceipt` | Review creation depends on successful branch delivery |
| `title` | string | Task-owned review title |
| `body` | string | Task-owned review body |
| `draft` | boolean | Optional future policy field |

### BranchDeliveryReceipt

Structured result of remote branch delivery.

| Field | Type | Notes |
|---|---|---|
| `status` | `pushed \| no_diff \| failed` | Branch push outcome |
| `branchName` | string | Remote branch identifier |
| `branchUrl` | string? | Provider-normalized branch URL when available |
| `commitSha` | string? | Effective pushed commit, if known |
| `errorCode` | string? | Distinct failure code |
| `errorMessage` | string? | Human-readable failure summary |

### ReviewHandle

Normalized review reference for either GitLab or GitHub.

| Field | Type | Notes |
|---|---|---|
| `provider` | `gitlab \| github` | Review host |
| `url` | string | Web URL for reviewers |
| `number` | integer | Provider review number / IID |
| `displayId` | string | Human-friendly identifier such as `!42` or `#42` |

### ReviewResult

Final repository-delivery outcome returned to Mystra.

| Field | Type | Notes |
|---|---|---|
| `status` | `review_created \| branch_pushed_no_review \| no_diff \| auth_invalid \| push_failed \| review_failed_after_push` | Distinct operator-visible outcome |
| `branch` | `BranchDeliveryReceipt` | Always present when a branch step was attempted |
| `review` | `ReviewHandle`? | Present only on review creation success |
| `errorCode` | string? | Stable machine-readable failure class |
| `errorMessage` | string? | Human-readable summary |
| `metadata` | object | Provider-specific diagnostics kept out of shared core fields |

## State Notes

- `BranchDeliveryReceipt.status = no_diff` is terminal for repository delivery and
  must not be collapsed into generic success/failure semantics.
- `ReviewResult.status = review_failed_after_push` preserves the pushed branch so
  the operator can recover manually.
- `RepositoryAuthBinding` is intentionally opaque and non-secret. Concrete secret
  values remain execution-time concerns outside the shared contract.
