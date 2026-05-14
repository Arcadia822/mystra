# Contract: GitHub Review Context Projection

## Purpose

Specify how Mystra's reviewer-facing task context maps onto GitHub review
surfaces while preserving provider-neutral run-result contracts.

## Required Reviewer Context

The created GitHub review artifact uses:

- The PR title for the task title
- The PR body for the task body
- A provider-owned preview block when a frontend preview URL is present
- The quality-gate summary inside that preview block
- A backend retained-container note when both preview URLs are present

## PR Body Shape

```text
<task body>   # unchanged when no frontend preview URL exists

---

Mystra preview:

- Frontend: <url or "not exposed">
- Backend: <url or "not exposed">
- Container: <name or "unknown">
- Quality gate: passed (`test -> build`)   # only when present
- Backend note: the backend port is reserved in the retained container. It may
  still require repository-specific DB/Redis environment before the backend
  process stays up.   # only when backendPreviewUrl is present
```

Rules:

- Omit the preview section entirely when `frontendPreviewUrl` is absent, even if
  `qualityGate` metadata exists
- Do not emit empty placeholders for a missing frontend preview URL
- Keep the body provider-owned; shared contracts carry only generic metadata

## Optional Supplemental Comment

The provider may publish a best-effort follow-up PR comment for retained-preview
operational notes that would be too noisy in the main PR body.

Rules:

- Comment publication is optional and currently only attempted when
  `frontendPreviewUrl` is present
- Comment failure must not change `ReviewResult.status` away from
  `review_created` when the PR already exists
- If attempted, comment outcome is recorded in provider metadata as
  `contextCommentStatus: "published" | "failed"`; when not attempted, the field
  is omitted

## Result Projection

- `ReviewResult.review.url` uses the PR HTML URL
- `ReviewResult.review.number` uses the PR number
- `ReviewResult.review.displayId` uses `#<number>`
- `ReviewResult.metadata.repo` uses the normalized `<owner>/<repo>` path
- `ReviewResult.metadata.targetBranch` uses `RepositoryTarget.defaultBaseBranch`
- Transitional `mrUrl` / `mrIid` compatibility fields, where still required, are
  projections from the normalized review handle rather than GitHub-owned fields

## Non-Goals

- A separate GitHub review UX beyond the created PR
- Provider-specific fields in shared control-plane or MCP contracts
- Treating comment publication as required for MVP parity
