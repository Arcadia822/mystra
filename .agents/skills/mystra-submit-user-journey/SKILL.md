---
name: mystra-submit-user-journey
description: Submits a complete user journey to Mystra MCP as durable Task intent plus one independently executable child Session.
---

# Mystra Submit User Journey

Require `projectId`, `branch`, `actor`, `goal`, and non-empty
`acceptanceCriteria`. Optional inputs are `agent`, context, and metadata.

1. Call `mystra_create_task` with `source: "mcp"`, Project ID, goal as the
   objective, and user-journey metadata.
2. Read the returned `task.id`.
3. Build a Session objective containing actor, goal, acceptance criteria, and
   optional context.
4. Call `mystra_create_session` with the Task ID, title, objective, branch, and
   optional Agent.
5. Return Task ID, Session ID, initial state, and branch.

Stop on missing input or transport failure. Task is intent; Session carries
execution state.
