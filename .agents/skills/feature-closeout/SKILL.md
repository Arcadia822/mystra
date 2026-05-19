---
name: feature-closeout
description: Close out a finished feature by syncing Spec-Kit and code-intelligence state, refreshing durable onboarding docs, and cleaning merged git/issue state with explicit user confirmation.
---

# Feature Closeout

Use this skill after a feature is implemented and reviewed, either:

1. on the **feature branch** before the final merge-ready handoff, or
2. on **`main`** after the feature has already been merged.

This is a repository-hygiene and documentation-sync skill. It is not the place
to invent new scope.

## Branch-Aware Intent

### When on a feature branch

- Treat the branch as the last staging area for one coherent feature.
- Refresh Spec-Kit and repository indexes so docs match the landed code.
- If the owner wants one clean branch-level commit, squash/rebuild the branch
  history into a single commit **only after explicit user confirmation**.

### When on `main`

- Do **not** rewrite history.
- Refresh Spec-Kit and repository indexes after merge.
- If the refresh changes durable docs or status artifacts, record them in one
  focused **`chore:`** commit on `main`.

## Required Inputs

- Current branch name
- Whether the feature is already merged
- Any linked issue numbers, if issue closure is expected

## Mandatory Closeout Checklist

1. **Refresh feature health**
   - Run `spec-kit-status`
   - Run `spec-kit-doctor`
   - Reconcile any stale `specs/spec-status.md`, missing `plan.md` / `tasks.md`,
     or drift between landed code and feature artifacts

2. **Refresh code-intelligence surfaces**
   - Check GitNexus freshness with `pnpm dlx gitnexus status`
   - If stale or materially changed, run `pnpm dlx gitnexus analyze --force`
   - Refresh repoindex-backed durable docs as needed:
     - `docs/repoindex/overview.md`
     - `docs/repoindex/architecture.md`
     - `docs/repoindex/modules/<name>.md`
   - Remember: repoindex commands default to chat output; persistence requires
     writing the reviewed result into those docs paths intentionally

3. **Reconcile feature artifacts**
   - Ensure the current feature's `spec.md`, `plan.md`, and `tasks.md` reflect
     the code that actually landed
   - If code shipped from another branch and only docs drifted, backfill the
     minimal truthful Spec-Kit artifacts instead of pretending the feature is
     still unimplemented

4. **Handle merged branch cleanup**
   - Identify merged local and remote branches related to the feature
   - Delete them **only with explicit user confirmation**
   - Never delete the current branch

5. **Handle issue cleanup**
   - If the feature merged via a tracked issue and the owner wants issue hygiene,
     close the completed issue(s)
   - Closing issues also requires explicit confirmation unless the repository has
     a clearly documented auto-close rule already in effect

## Git Rules

- **User confirmation required** for:
  - deleting local branches
  - deleting remote branches
  - closing issues
  - squashing or rebuilding branch history
- On `main`, prefer one `chore:` commit for closeout-only doc/index/status sync
- On a feature branch, prefer one coherent feature commit history; if the owner
  explicitly wants a single commit, rebuild to one final commit before merge

## Expected Output

Return a concise closeout report covering:

- current branch mode (`feature` or `main`)
- Spec-Kit status/doctor outcome
- whether GitNexus and repoindex were refreshed
- any docs/status artifacts updated
- any issues ready to close
- any merged branches ready to delete, clearly marked as awaiting confirmation
