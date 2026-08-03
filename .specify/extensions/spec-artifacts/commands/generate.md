## User Input

```text
$ARGUMENTS
```

## Goal

Generate or refresh owner-facing feature artifacts for a Spec-Kit feature. All
generated prose MUST be written in Chinese unless the user explicitly requests
another language:

- `FEATURE_DIR/features.md`
- `FEATURE_DIR/checklists.md`

These files are presentation/review artifacts. They MUST NOT replace or rewrite
standard Spec-Kit files.

## Input Parsing

Parse user input for:

- `--feature <name>`: feature directory name, numeric prefix, or
  `specs/<feature>` path
- optional original feature description text after flags

If no feature is specified, use the active feature from the current branch when
unambiguous. If no unambiguous feature can be found, stop and ask for a feature
identifier.

## Required Context

Load the feature as whole files only:

- `FEATURE_DIR/spec.md` as a complete document
- original user feature description when available
- already-loaded repository context such as 5xP files and constitution

Do not extract sections, parse headings, or infer structure from `spec.md`.
Treat `spec.md` as an opaque source document for synthesis.

## Output Contract

Write `FEATURE_DIR/features.md` with this structure:

```markdown
# 功能说明：<feature name>

## 摘要

## 功能地图

## 边界

## 分阶段能力图
```

Write `FEATURE_DIR/checklists.md` with this structure:

```markdown
# 评审清单：<feature name>

## Owner 评审

## Spec 就绪度

## 后续插件检查
```

Use unchecked checkboxes (`- [ ]`) for checklist items unless the current context
proves the item is already complete. Do not mark speculative items complete.

## Rules

- Do not modify `spec.md`, `plan.md`, `tasks.md`, or files under
  `checklists/`.
- Do not create a PRD or alternate requirements file.
- Do not parse `spec.md` into headings or reformat it.
- Keep `features.md` business-readable and concise, in Chinese.
- Keep `checklists.md` focused on review, readiness, and follow-up plugin work,
  in Chinese.
- If the spec is missing or incomplete, still write both artifacts with a clear
  missing-source note and conservative unchecked items.

## Completion Report

Report:

- feature directory
- whether `features.md` was written
- whether `checklists.md` was written
- confirmation that standard Spec-Kit artifacts were not modified
