## Taco Spec Kit authoring and review

- Write new Spec Kit Markdown metadata as leading YAML frontmatter. Put the
  document title in the `title` property between `---` delimiters. Never imitate
  metadata with headings such as `## title: "..."` or bold prose.
- Use `feature_id` for the logical numbered feature identifier such as
  `001-search`. Do not call it a branch. Add `git_branch` only when an actual Git
  branch has been created and verified; Taco's spec template intentionally
  omits that optional property.
- When `speckit.specify` or another authoring command creates `spec.md`, do not
  add an ATX or Setext H1 that repeats the YAML title. Begin the Markdown body at
  H2 (`##`) or lower. Preserve an existing authored H1 during unrelated edits;
  do not silently migrate legacy content.
- Core files and known Spec Kit convention paths are routed automatically. Do not
  write a routing or scope property into documents: classification is Taco's
  built-in Category, recorded in the Taco file's navigation manifest. Never
  generate the deprecated `taco_scope` key or the legacy
  `**Taco scope**: ...` form; Taco reads neither one.
- Choose the artifact carrier by information type: keep narrative, constraints,
  decisions, and acceptance criteria in `spec.md`/`plan.md`; put reusable
  flow/sequence/state designs in `diagrams/*.mmd`, HTTP APIs in
  `contracts/openapi.yaml` as the single authoritative definition, and data
  structures in `data-model.md` plus native schema files when machine validation
  is needed. Link with relative paths, never duplicate definitions, never create
  placeholder files, and do not split small tasks that fit one Markdown file.
- Keep each Spec Kit feature directory canonical. Store its review file at
  `<feature-directory>/<feature-name>.taco.html` and update it only through the
  installed Taco commands: read the existing Taco first, assemble a fresh copy of
  the shell in memory, write the `taco/files` v1 bundle into `#taco-document`, and
  preserve `docId`, `comments`, `navigation`, and every other stored bundle field
  across refreshes. Exclude `*.taco.html` from the bundle and report every
  exclusion. No CLI is required.
- Validate the complete result before atomically replacing the destination; never
  copy a blank shell over a reviewed file. Preserve the original while review
  edits are unresolved or conflicted.
- After changing any feature artifact—including spec, plan, tasks, research,
  contracts, checklists, or recorded implementation progress—invoke
  `speckit.taco.update` before reporting the operation complete. In Codex this
  command is `$speckit-taco-update`.
- After a successful update, present the exact generated Taco through the Agent
  GUI's native clickable file or artifact surface. When local HTML navigation is
  explicitly supported and permitted, proactively open and verify the exact file
  (title and document content visible) in the user's browser without asking first
  — the file path is often hard to find. A headless or automation boot check is
  internal evidence only and is never a user-visible open. In Codex, return a
  clickable absolute file link and let the user's click open it in Browser; do not
  attempt autonomous `file://` navigation. Use a separate tab to preserve an
  existing unsaved review. If browser tools are unavailable, opening is
  prohibited, or navigation fails, keep the clickable-file handoff and state the
  reason. Claim verification only after observing the expected title and document
  content; never bypass restrictions with data/Blob URLs, external uploads, a
  development server, or weakened browser security.
- Import a human review through `speckit.taco.review` (in Codex,
  `$speckit-taco-review`): consume the reviewer's Handoff text (Markdown diffs +
  open comments), the review tab's `window.taco.getReviewHandoff()` object
  (structured `changedFiles` with root-relative paths + comments, including
  unsaved edits), or the saved file's `#taco-document` bundle. Handoff and the
  review-tab API need no save; only the saved-file channel does. Never transmit a
  collaboration-enabled Taco without user authorization.
- Resolve review paths against the reviewed bundle `root` and never write outside
  the feature directory. Never blind-overwrite a canonical file: compare it with
  the baseline the reviewer saw (original content / `sourceHash`) for whole-file
  replacement, or verify all diff hunks against current source. Preserve unrelated
  edits; report conflicts or missing baselines rather than guessing.
- Read every open comment and its complete history, modify canonical files to
  address actionable feedback, then update the same Taco once direct edits are
  handled. A blocked review must retain the original Taco without a false refresh.
