## User Input

```text
$ARGUMENTS
```

## Goal

Provide a clear, at-a-glance view of project status and workflow progress — answering "Where am I and what should I do next?" Always writes a fresh `{SPECS_DIR}/spec-status.md` status snapshot. (For artifact quality analysis, use `/speckit.analyze` instead.)

**CRITICAL: Run this script BEFORE doing anything else (execute from repo root):**
- macOS/Linux: `sh .specify/extensions/status-report/scripts/bash/get-project-status.sh --json`
- Windows: `pwsh .specify/extensions/status-report/scripts/powershell/Get-ProjectStatus.ps1 -Json`

The script discovers the repo layout, computes task counts, and writes the cache file.

**NEVER scan directories, read files, or infer project state manually. All data must come from the script JSON output. If the script fails, report the error and stop.**

## Input Parsing

Parse user input for:
- **Feature identifier** (optional, positional): name (`002-dashboard`), number prefix (`002`), or path (`specs/002-dashboard`)
- **Flags**: `--all` (overview only), `--verbose` (task breakdown + artifact summaries), `--json` (machine-readable), `--feature <name>` (explicit selection)

**Precedence**: Explicit feature > positional argument > current branch > `--all` required

## Execution Steps

### 1. Initialize Context (MANDATORY — run the script)

**Run the script** above from the repo root. Parse its JSON output to populate:

- **REPO_ROOT**: Project root directory
- **SPECS_DIR**: `{REPO_ROOT}/specs` (fall back to `{REPO_ROOT}/.specify/specs`)
- **STATUS_FILE**: `{SPECS_DIR}/spec-status.md` — written fresh by the script on every run
- **MEMORY_DIR**: `{REPO_ROOT}/.specify/memory` (fall back to `{REPO_ROOT}/memory`)
- **CURRENT_BRANCH**: Current git branch
- **HAS_GIT**: Whether project is a git repository

The script always does a fresh scan and returns pre-computed task counts for every feature — do **not** read individual `tasks.md` files.

### 2. Load Constitution Status

Use `constitution.exists` from the script JSON output:
- `true`: `✓ Defined`
- `false`: `○ Not defined`

### 3. Build Feature Table

Use the `features` array from the script JSON. Each entry has `has_spec`, `has_plan`, `has_tasks`, `tasks_total`, `tasks_completed`, and `is_current`. Do not scan directories.

| Stage | ✓ | ○ | - |
|-------|---|---|---|
| Specify | `has_spec: true` | `false` | — |
| Plan | `has_plan: true` | `false` + has spec | no spec |
| Tasks | `has_tasks: true` | `false` + has plan | no plan |
| Implement | see below | | |

**Implementation stage** (from `tasks_total`/`tasks_completed`):
- `tasks_total` is 0: `○ Ready`
- `tasks_completed == tasks_total`: `✓ Complete`
- Partial: `● {completed}/{total} ({percent}%)`

### 4. Determine Target Feature

Use `target_feature`, `is_feature_branch`, and `branch` from the script JSON:

1. `--all` flag: overview only, no detail section
2. Feature specified (positional or `--feature`): match against `features[].name`
3. `is_feature_branch: true`: use `target_feature`
4. `is_feature_branch: false`: show `ℹ Not on a feature branch`, overview only

### 5. Build Feature Detail (if target feature selected)

Use fields from the matching feature object in the script JSON — do not read files:

| Field | Artifact |
|-------|----------|
| `has_spec` | spec.md |
| `has_plan` | plan.md |
| `has_tasks` | tasks.md |
| `has_research` | research.md |
| `has_data_model` | data-model.md |
| `has_quickstart` | quickstart.md |
| `has_contracts` | contracts/ |
| `has_checklists` | checklists/ |

Display: `✓` exists, `○` ready to create (prerequisite met), `-` not applicable yet

**Checklists**: use `checklist_files` array from the script JSON. Format: `✓ {name} {done}/{total}` or `● {name} {done}/{total}`

**Task progress** (`--verbose` only): use `tasks_total`/`tasks_completed` from the script JSON per feature.

### 6. Determine Next Action

| Current State | Next Action | Message |
|---------------|-------------|---------|
| No spec.md | `/speckit.specify` | Create feature specification |
| spec.md, no plan.md | `/speckit.plan` | Create implementation plan |
| plan.md, no tasks.md | `/speckit.tasks` | Generate implementation tasks |
| tasks.md, 0% or partial | `/speckit.implement` | Begin/continue implementation |
| tasks.md, 100% complete | (none) | Ready for review/merge |

Optionally mention `/speckit.clarify` (if spec exists, no clarifications) or `/speckit.analyze` (if tasks exist, not analyzed).

### 7. Generate Output

> `{STATUS_FILE}` is written fresh by the script on every run. Do **not** modify it manually.

**Human-readable format** (default):

```
Spec-Driven Development Status

Project: {project_name}
Branch: {current_branch}
Constitution: {constitution_status}

Features
+-----------------+---------+------+-------+------------------+
| Feature         | Specify | Plan | Tasks | Implement        |
+-----------------+---------+------+-------+------------------+
| 001-onboarding  |    ✓    |  ✓   |   ✓   | ✓ Complete       |
| 002-dashboard   |    ✓    |  ✓   |   ✓   | ● 12/18 (67%)    |
| 003-user-auth < |    ✓    |  ✓   |   ○   | -                |
+-----------------+---------+------+-------+------------------+

Legend: ✓ complete  ● in progress  ○ ready  - not started
```

If no features exist, show `(none)` row and message: `No features defined yet. Run /speckit.specify to create your first feature.`

Mark current/active feature with `<`. Show `{FEATURE_DETAIL_SECTION}` after table when a target feature is selected.

**Feature detail section**:

```
003-user-auth

Artifacts:
  ✓ spec.md        ✓ plan.md        ○ tasks.md
  ✓ research.md    ✓ data-model.md  - quickstart.md
  ✓ contracts/     - checklists/

Checklists: None defined

Next: /speckit.tasks
  Generate implementation tasks from your plan
```

**Verbose additions** (`--verbose`): Append per-phase task progress and per-checklist completion counts.

**JSON format** (`--json`): Output the script's JSON enriched with `current_feature` detail (artifacts, checklists, next_action). Follow the same data structure the script returns.

## Operating Principles

- **Status file**: `spec-status.md` is written fresh by the script on every run — never edit manually. No other project files should be modified.
- **Efficiency**: File existence checks only, no full content reads. Use script's task counts, not manual parsing.
- **Graceful handling**: Missing dirs = empty state, missing files = not yet created, parse errors = skip and note, non-git = note unavailable.
- **UX**: Always show features overview, mark active feature with `<`, make next action obvious, support quick checks and `--verbose` deep dives.
