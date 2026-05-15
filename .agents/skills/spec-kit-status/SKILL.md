---
name: spec-kit-status
description: Project-local wrapper for the Spec Kit status-report extension. Use when you need an at-a-glance view of feature progress, artifact completeness, checklist coverage, or the next Spec Kit action.
---

# Spec Kit Status

Use the project-local Spec Kit status extension installed under:

```text
.specify/extensions/status-report/
```

## When To Use

- Check overall Spec Kit progress across features.
- Inspect the current feature's artifact completeness.
- See implementation task completion and checklist status.
- Recommend the next Spec Kit command to run.

## Commands

- `/speckit.status-report.show`
- Alias forms documented by the extension README

## Notes

- The extension manifest is `.specify/extensions/status-report/extension.yml`.
- The command prompt lives at `.specify/extensions/status-report/commands/show.md`.
- Bash helper: `.specify/extensions/status-report/scripts/bash/get-project-status.sh`
- PowerShell helper: `.specify/extensions/status-report/scripts/powershell/Get-ProjectStatus.ps1`
