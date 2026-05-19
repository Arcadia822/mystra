# Data Model: Operator CLI Surface

## Overview

The CLI introduces no new persisted entities. It projects existing management API
data into a shell-friendly interaction model.

## Views And Outcomes

### OperatorCLIInvocation

Represents one shell command execution.

| Field | Type | Notes |
|---|---|---|
| `commandPath` | string[] | e.g. `["runs", "result"]` |
| `target` | string \| undefined | project slug or job id |
| `outputMode` | `"human"` \| `"json"` | default human, `--json` optional |
| `controlPlaneUrl` | string | defaults from env or localhost |

### OperatorInspectionView

Read-only projection returned to the operator.

| Kind | Backing API data | Purpose |
|---|---|---|
| Project list | `ProjectListResponse.projects` | identify projects and core execution facts |
| Project detail | `ProjectDetailResponse.project` | inspect lane, workflow hint, runtime, and context facts |
| Run list | `JobListResponse.jobs` | inspect recent runs and project association |
| Run detail | `CanonicalRunSnapshot` | inspect one run's durable state |
| Run result | `CanonicalRunSnapshot.run.result` | report terminal summary and references |
| Run failure view | `CanonicalRunSnapshot.run.result` + `run.state` | report failure context in a structured way |

### OperatorOutcome

Command-level result visible to the shell.

| Field | Type | Notes |
|---|---|---|
| `ok` | boolean | command success vs failure outcome |
| `code` | string | `OK`, management error code, transport code, or derived result code |
| `message` | string | human explanation |
| `payload` | unknown | structured success or error payload |
| `exitCode` | number | shell exit code |

## Outcome Derivation Rules

```text
management API error
  -> OperatorOutcome(ok=false, code=<management error>, exitCode!=0)

transport / invalid JSON failure
  -> OperatorOutcome(ok=false, code=TRANSPORT_ERROR, exitCode!=0)

runs result + active run
  -> OperatorOutcome(ok=false, code=RESULT_NOT_READY, exitCode!=0)

runs result + terminal run without run.result
  -> OperatorOutcome(ok=false, code=RESULT_UNAVAILABLE, exitCode!=0)

runs failure + successful run
  -> OperatorOutcome(ok=false, code=RESULT_UNAVAILABLE, exitCode!=0)

successful inspection command
  -> OperatorOutcome(ok=true, code=OK, exitCode=0)
```

## Presentation Shapes

### Human-readable mode

- concise labels
- one section per command
- stderr for failures
- stdout for success payloads

### JSON mode

- pure JSON on stdout
- no mixed prose
- include the derived operator outcome wrapper for failure cases
