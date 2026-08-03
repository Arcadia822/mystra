---
name: mystra-submit-implementation-request
description: Submits an implementation request to Mystra MCP by creating durable Task intent followed by one independent child Session.
metadata:
  priority: 4
  promptSignals:
    phrases:
      - "submit implementation request"
      - "spec reference"
      - "task scope"
      - "mystra_create_task"
---

# Mystra Submit Implementation Request

Use this skill when requirements, a spec, or a bounded implementation scope are
ready for Mystra execution.

## Inputs

Required: `projectId`, `branch`, `specReference`, `taskScope`.

Optional: `agent`, `planReference`, `constraints`, `metadata`.

Stop if any required input is empty. Do not add Project or Repository fields to
the Session request.

## Step 1: create Task intent

Call `mystra_create_task` with:

```json
{
  "projectId": "<projectId>",
  "source": "mcp",
  "objective": "<taskScope>",
  "metadata": {
    "submissionKind": "implementation-request",
    "specReference": "<specReference>",
    "planReference": "<optional planReference>"
  }
}
```

Read `task.id` from the tool result. Stop if Task creation fails.

## Step 2: create child Session

Build the Session objective from the scope, references, and constraints, then
call `mystra_create_session`:

```json
{
  "taskId": "<created task.id>",
  "title": "Implement requested scope",
  "objective": "<generated implementation objective>",
  "branch": "<branch>",
  "agent": "<optional agent>"
}
```

Return the Task ID, Session ID, initial Session state, and branch. Do not imply
that the Task itself has an execution state.
