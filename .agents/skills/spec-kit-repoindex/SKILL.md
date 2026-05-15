---
name: spec-kit-repoindex
description: Project-local wrapper for the Spec Kit repoindex extension. Use when you need onboarding, architecture mapping, or focused module analysis for an existing repository.
---

# Spec Kit Repoindex

Use the project-local repository indexing extension installed under:

```text
.specify/extensions/repoindex/
```

## When To Use

- Generate a high-level repository overview.
- Produce deeper architecture documentation for a brownfield codebase.
- Analyze one module or bounded area before changing it.

## Commands

- `/speckit.repoindex.overview`
- `/speckit.repoindex.architecture`
- `/speckit.repoindex.module <module-name-or-path>`

## Notes

- The extension manifest is `.specify/extensions/repoindex/extension.yml`.
- Command prompts live under `.specify/extensions/repoindex/commands/`.
- This extension ships command prompts only; it does not add helper scripts in this vendored copy.
