---
name: spec-kit-repoindex
description: Project-local wrapper for the Spec Kit repoindex extension. Use when you need GitNexus-backed onboarding, architecture mapping, or focused module analysis for an existing repository.
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
- Build repo-wide current-state documentation without inventing a new docs flow.

## Commands

- `/speckit.repoindex.overview`
- `/speckit.repoindex.architecture`
- `/speckit.repoindex.module <module-name-or-path>`

## Mystra Defaults

1. Refresh GitNexus first. Start with `npx gitnexus status`; if the index is stale, run `npx gitnexus analyze --force` before trusting structural claims.
2. Use GitNexus as the primary structure source when available:
   - `gitnexus://repo/mystra/context`
   - `gitnexus://repo/mystra/clusters`
   - `gitnexus://repo/mystra/processes`
   - `gitnexus://repo/mystra/process/{name}`
3. Anchor repoindex output on Mystra's durable project context, not just directory scans:
   - `AGENTS.md`
   - `PRODUCT.md`
   - `PLATFORM.md`
   - `PROCESS.md`
   - relevant `docs/*.md` and `specs/spec-status.md`
4. Default output is the current response. Do **not** create a repository file unless the user explicitly asks to persist the repoindex.
5. If the user explicitly wants a durable repo-wide artifact, use:
   - `docs/repoindex/overview.md`
   - `docs/repoindex/architecture.md`
   - `docs/repoindex/modules/<module-name>.md`

## Notes

- The extension manifest is `.specify/extensions/repoindex/extension.yml`.
- Command prompts live under `.specify/extensions/repoindex/commands/`.
- This vendored copy is prompt-driven; the quality of the output depends on using GitNexus plus the 5xP files instead of a blind tree walk.
