# Spec Kit Doctor

A Spec Kit extension that diagnoses project health and reports issues.

## What it does

Scans your Spec Kit project and checks 6 areas:

- **Project structure** — are `.specify/`, `specs/`, `.specify/scripts/`, `.specify/templates/`, and `.specify/memory/` present?
- **AI agent configuration** — which agent is set up, do its commands exist?
- **Feature specifications** — for each feature, are spec.md/plan.md/tasks.md present?
- **Scripts health** — are all `.specify/scripts/bash` and `.specify/scripts/powershell` scripts present and executable?
- **Extensions health** — is `.specify/extensions.yml` present, and are installed extension directories available?
- **Git status** — are you in a repo, what branch?

Reports findings as errors, warnings, and notes with suggested fixes.

## Installation

```bash
specify extension add doctor
```

Or install from GitHub:

```bash
specify extension add --from https://github.com/KhawarHabibKhan/spec-kit-doctor/archive/refs/tags/v1.0.0.zip
```

## Usage

```
/speckit.doctor.check
```

Or using the alias:

```
/speckit.doctor
```

## Requirements

- Spec Kit >= 0.1.0
