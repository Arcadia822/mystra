---
name: spec-kit-doctor
description: Project-local wrapper for the Spec Kit doctor extension. Use when you need a health check for Spec Kit structure, scripts, extensions, agent bindings, or feature artifacts.
---

# Spec Kit Doctor

Use the project-local Spec Kit doctor extension installed under:

```text
.specify/extensions/doctor/
```

## When To Use

- Validate Spec Kit project structure.
- Check feature artifact completeness across `specs/`.
- Inspect extension health and script availability.
- Run a quick diagnostic before deeper Spec Kit work.

## Commands

- `/speckit.doctor.check`
- `/speckit.doctor`

## Notes

- This repository uses the newer `.specify/scripts`, `.specify/templates`, and `.specify/memory` layout; the vendored doctor extension has been patched to validate that structure.
- The extension manifest is `.specify/extensions/doctor/extension.yml`.
- The command prompt lives at `.specify/extensions/doctor/commands/check.md`.
- Bash helper: `.specify/extensions/doctor/scripts/bash/doctor.sh`
- PowerShell helper: `.specify/extensions/doctor/scripts/powershell/doctor.ps1`
