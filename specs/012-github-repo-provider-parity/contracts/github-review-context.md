# Contract: GitHub Review Context Projection

## Purpose

Specify how Mystra's reviewer-facing task context maps onto GitHub review
surfaces while preserving provider-neutral run-result contracts.

## Required Reviewer Context

The GitHub pull-request body is the required review surface for:

- Task title and body
- Preview URLs when present
- Quality-gate summary when present
- Optional retained-preview operational note

## PR Body Shape

```text
<task body>

---

Mystra preview:

- Frontend: <url or "not exposed">
- Backend: <url or "not exposed">
- Container: <name or "unknown">
- Quality gate: passed (`test -> build`)   # only when present
```

Rules:

- Omit the preview section entirely when no preview metadata exists
- Do not emit empty placeholders for missing preview URLs
- Keep the body provider-owned; shared contracts carry only generic metadata

## Optional Supplemental Comment

The provider may publish a best-effort follow-up PR comment for retained-preview
operational notes that would be too noisy in the main PR body.

Rules:

- Comment publication is optional
- Comment failure must not change `ReviewResult.status` away from
  `review_created` when the PR already exists
- If attempted, comment outcome should be recorded in provider metadata

## Result Projection

- `ReviewResult.review.url` uses the PR HTML URL
- `ReviewResult.review.number` uses the PR number
- `ReviewResult.review.displayId` uses `#<number>`
- Transitional `mrUrl` / `mrIid` compatibility fields, where still required, are
  projections from the normalized review handle rather than GitHub-owned fields

## Non-Goals

- A separate GitHub review UX beyond the created PR
- Provider-specific fields in shared control-plane or MCP contracts
- Treating comment publication as required for MVP parity
