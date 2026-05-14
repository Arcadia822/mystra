# Quickstart: GitHub Repository Provider Parity

## Goal

Verify that Mystra can deliver a GitHub-backed branch and pull request through
the existing repository-provider seam without introducing a GitHub-only workflow
path.

## Focused Verification Sequence

1. Run shared contract tests after any schema or result-surface change:

   ```sh
   pnpm --filter @mystra/shared test
   ```

2. Run runner provider tests after any GitHub provider or auth-plumbing change:

   ```sh
   pnpm --filter @mystra/runner-daemon test
   ```

3. Run broad type safety after cross-package changes:

   ```sh
   pnpm typecheck
   ```

## Manual Runtime Check

Use a GitHub-backed project with runtime-injected repository credentials:

```text
repoUrl: https://github.com/<owner>/<repo>.git
hostKind: github
baseBranch: main
branchName: mystra/<task>
auth binding: runner-env -> MYSTRA_GITHUB_TOKEN
```

Expected behavior:

1. Clone/bootstrap completes without requiring GitLab-only env names.
2. The branch push returns a normalized `BranchDeliveryReceipt` with a GitHub
   branch URL.
3. Pull-request creation returns a normalized `ReviewResult.review` handle with
   a GitHub PR URL and `#<number>` display ID.
4. The PR title carries the task title, and the PR body stays as the task body
   unless a frontend preview URL is present; when preview metadata exists, the
   body appends the preview block, quality-gate summary, and backend retained
   container note.
5. When preview metadata is present, GitHub may also publish a best-effort
   retained-preview follow-up comment, and `contextCommentStatus` records
   whether that optional comment was published or failed.
6. Structured outputs remain coherent for both normalized review data and any
   transitional MR-shaped compatibility fields.

## Edge Verification

- SSH-style remote: `git@github.example.com:org/repo.git`
- No diff after quality gate
- Missing or invalid `MYSTRA_GITHUB_TOKEN`
- Push succeeds but PR creation fails
- Quality-gate metadata without a frontend preview URL leaves the PR body
  unchanged
- Optional reviewer-context comment publication fails after PR creation
