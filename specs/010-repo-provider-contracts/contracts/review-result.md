# Contract: Normalized Review Result

## Purpose

Mystra needs one normalized repository-delivery result shape that can represent
GitLab merge requests, GitHub pull requests, and partial-success outcomes
without leaking provider-specific field names into unrelated contracts.

## Proposed Shape

```ts
interface BranchDeliveryReceipt {
  status: "pushed" | "no_diff" | "failed";
  branchName: string;
  branchUrl?: string;
  commitSha?: string;
  errorCode?: string;
  errorMessage?: string;
}

interface ReviewHandle {
  provider: "gitlab" | "github";
  url: string;
  number: number;
  displayId: string;
}

interface ReviewResult {
  status:
    | "review_created"
    | "branch_pushed_no_review"
    | "no_diff"
    | "auth_invalid"
    | "push_failed"
    | "review_failed_after_push";
  branch: BranchDeliveryReceipt;
  review?: ReviewHandle;
  errorCode?: string;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}
```

## Mapping Notes

| Provider | Native identifier | Normalized fields |
|---|---|---|
| GitLab | MR IID / web URL | `review.number`, `review.url`, `review.displayId = !<iid>` |
| GitHub | PR number / HTML URL | `review.number`, `review.url`, `review.displayId = #<number>` |

## Transitional Note

Current `RunResult` still exposes `mrUrl` and `mrIid`. Until code migrates, that
surface should be treated as implementation debt rather than the stable contract
that other features are allowed to depend on.
