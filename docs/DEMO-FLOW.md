# Mystra Demo Flow

## Message

Mystra is the execution control plane for coding Agents. An external Agent or
operator may coordinate intake; Mystra owns durable Task intent, independent
Session execution, stable Runner capacity, sandbox boundaries, and repository
review evidence.

## Live path

1. Select or create a GitHub/Linear Issue.
2. Dispatch the Issue through MCP or CLI.
3. Show the atomic response containing Task ID and initial Session ID.
4. Open Task detail and explain that Task has no execution state and can contain
   multiple Sessions for separate subtasks.
5. Open the initial Session and show Agent, branch, state, Runner assignment,
   quality evidence, preview, and review handoff.
6. Open Runner detail and show stable identity, health, capacity, and current
   Task/Session assignments.
7. End on the repository branch or review URL.

## Suggested narration

> The coordinating Agent creates durable intent. Mystra creates one independent
> Session for this subtask, assigns stable execution capacity, and returns
> reviewable evidence. Another subtask would be another sibling Session, not an
> overwritten execution attempt.

## Do not imply

- Task has an execution lifecycle.
- Internal execution facts are public business objects.
- Retry, callback, public logs, or activity timeline already exist.
- GitLab is an enabled intake Integration.
- Hosted multi-tenancy or workflow orchestration above the Agent is delivered.

## Preparation

```sh
pnpm doctor
pnpm operator:cli -- projects list
pnpm operator:cli -- runners list
pnpm operator:cli -- issues list --integration linear --limit 10
```

Use a known Project and branch, verify the Runner registration secret is shared
with the control plane, and confirm review credentials before the presentation.

## Closing line

> Mystra turns intent into independent Agent Sessions and reviewable repository
> evidence while preserving stable platform boundaries.
