# Data Model: Agent Runtime Skills

## Overview

`016` introduces no new persisted entities. It formalizes the local
coordinating skill surface that packages existing Mystra MCP interactions for
agents.

## Entities

### CoordinatingSkillSurface

The first-slice local skill pack for Mystra coordination.

**Responsibilities**

- expose a small set of repo-local agent-facing skills
- package required inputs into the current Mystra MCP contract
- preserve canonical success and failure meaning
- provide one reusable extension pattern for future skills

### ImplementationRequestSkill

Packages implementation-oriented work into `mystra_create_job`.

**Fields / responsibilities**

- `projectId`
- `taskId`
- `branchName`
- `specReference`
- `taskScope`
- optional `agent`
- optional `baseBranch`
- optional `planReference`
- optional `workflowBlueprintName`
- optional `constraints`
- submit summary expectations: `jobId`, `run.state`, branch / review handle when immediately available

**Rules**

- must reject missing required inputs before calling MCP
- must keep workflow hints inside `metadata.workflow`, not a new top-level field

### UserJourneySkill

Packages actor/goal/acceptance-criteria input into `mystra_create_job`.

**Fields / responsibilities**

- `projectId`
- `taskId`
- `branchName`
- `actor`
- `goal`
- `acceptanceCriteria[]`
- optional `agent`
- optional `baseBranch`
- optional `context`
- optional `metadata`

**Rules**

- acceptance criteria must be present and non-empty
- generated prompt must preserve actor, goal, and acceptance criteria distinctly

### JobStatusSkill

Packages `mystra_get_job` into a human-readable coordination summary.

**Fields / responsibilities**

- `jobId`
- output summary of `job id / task id`
- output summary of `run.state`
- output summary of terminal result / review link / workflow status when present

**Rules**

- missing jobs must surface returned `JOB_NOT_FOUND` meaning directly
- connection failures must be reported clearly and stop

### SubmissionSummary

The immediate result a coordinating agent expects after a successful submission.

**Fields**

- `jobId`
- `runState`
- `branch?`
- `reviewUrl?`

### StatusSummary

The condensed follow-up view a coordinating agent expects from the status skill.

**Fields**

- `jobId`
- `taskId?`
- `runState`
- `resultStatus?`
- `summary?`
- `workflowStatus?`
- `reviewUrl?`

## Relationships

```text
ImplementationRequestSkill
  -> mystra_create_job
    -> SubmissionSummary

UserJourneySkill
  -> mystra_create_job
    -> SubmissionSummary

JobStatusSkill
  -> mystra_get_job
    -> CanonicalRunSnapshot
      -> StatusSummary
```

## Invariants

1. The local skills do not own persisted state.
2. The local skills do not define a second project/job/run schema family.
3. The local skills remain consumers of the canonical management contract.
4. Future skills should reuse the same validation and summary conventions unless
   the canonical contract itself changes.
