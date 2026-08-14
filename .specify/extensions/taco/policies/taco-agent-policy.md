## Taco Spec Kit authoring and review

- Write new Spec Kit Markdown metadata as leading YAML frontmatter. Put the
  document title in the `title` property between `---` delimiters. Never imitate
  metadata with headings such as `## title: "..."` or bold prose.
- When `speckit.specify` or another authoring command creates `spec.md`, do not
  add an ATX or Setext H1 that repeats the YAML title. Begin the Markdown body at
  H2 (`##`) or lower. Preserve an existing authored H1 during unrelated edits;
  do not silently migrate legacy content.
- Core files and known Spec Kit convention paths are routed automatically. For
  any other Markdown file that needs an explicit Taco stage, add `taco_scope`
  to its YAML frontmatter. Offer `spec`, `plan`, and `tasks`; preserve other
  text values as authored, but do not treat them as valid routes or create a
  custom stage. Do not generate the legacy `**Taco scope**: ...` form.
- Keep each Spec Kit feature directory canonical. Store its review file at
  `<feature-directory>/<feature-name>.taco.html` and update it only through the
  installed Taco commands.
- After changing any feature artifact—including spec, plan, tasks, research,
  contracts, checklists, or recorded implementation progress—invoke
  `speckit.taco.update` before reporting the operation complete. In Codex this
  command is `$speckit-taco-update`.
- After a successful update, present the exact generated Taco through the Agent
  GUI's native clickable file or artifact surface. In Codex, return a clickable
  absolute file link and let the user's click open it in Browser; do not attempt
  autonomous `file://` navigation. Other GUIs may open and verify it directly
  only when they explicitly support local HTML navigation.
- Import a saved human review through `speckit.taco.review` (in Codex,
  `$speckit-taco-review`). Preview before writing, stop on conflicts, and never
  use `--force` without explicit authorization for the exact paths.
- Read every open comment and its complete history, modify canonical files to
  address actionable feedback, then update the same Taco for the next review.
- Treat collaboration-enabled Taco files as potentially credential-bearing;
  do not send their contents to external services without user authorization.
