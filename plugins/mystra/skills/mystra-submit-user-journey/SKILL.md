---
name: mystra-submit-user-journey
description: Submits a structured user journey to Mystra MCP as Task intent plus an independently executable child Session.
metadata:
  priority: 4
  promptSignals:
    phrases:
      - "submit to Mystra"
      - "create Mystra Task"
      - "user journey"
      - "acceptance criteria"
      - "mystra_create_task"
---

# Mystra Submit User Journey

Use this skill when an Agent has a concrete user journey that Mystra should
implement.

## Inputs

Required: `projectId`, `branch`, `actor`, `goal`, and one or more
`acceptanceCriteria` items.

Optional: `agent`, `context`, `metadata`.

Stop on empty required input, an empty acceptance list, or an unreachable MCP
endpoint. Do not silently retry.

## Step 1: create Task intent

Call `mystra_create_task` with `source: "mcp"`, the Project ID, the user goal as
`objective`, and metadata containing `submissionKind: "user-journey"`, actor,
and goal. Read the returned `task.id`.

## Step 2: create child Session

Build an objective containing actor, goal, acceptance criteria, and optional
context. Call:

```json
{
  "taskId": "<created task.id>",
  "title": "Implement user journey",
  "objective": "<structured journey objective>",
  "branch": "<branch>",
  "agent": "<optional agent>"
}
```

Return Task ID, Session ID, initial Session state, and branch. Task is durable
intent; Session is the execution-bearing object.
