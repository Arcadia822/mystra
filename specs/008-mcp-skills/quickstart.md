# Quickstart: MCP Companion Skills

This quickstart documents the repo-local Mystra companion skills implemented for
feature `008`.

## Available Skills

The current companion skill pack lives under:

```text
.agents/skills/
├── mystra-submit-user-journey/
├── mystra-submit-implementation-request/
└── mystra-check-task-status/
```

## Discovery

From the repository root, list the available Mystra companion skills with:

```sh
find .agents/skills -maxdepth 2 -name SKILL.md | grep 'mystra-'
```

## Installation Model

This repository uses a repo-local skill-pack layout. Agents that honor
`.agents/skills/<skill>/SKILL.md` inside the working repository can use these
skills directly without an extra publishing step.

If you need the same skills in another workspace, copy the desired skill
directories from `.agents/skills/` into that environment's local skill folder.

## MCP Endpoint Prerequisite

The skills assume a reachable Mystra MCP endpoint.

- Default expectation: `http://127.0.0.1:3000/api/mcp`
- Recommended override: set `MYSTRA_MCP_URL` in your shell/environment when the
  endpoint lives elsewhere

## Skill Coverage

| Skill | Purpose | MCP tool(s) |
|---|---|---|
| `mystra-submit-user-journey` | Create a task from actor/goal/acceptance-criteria input | `mystra_create_task` |
| `mystra-submit-implementation-request` | Create a task from spec/task implementation context | `mystra_create_task` |
| `mystra-check-task-status` | Retrieve structured run/result status for a task | `mystra_get_task` |

## Manual Fallback

If the agent runtime cannot load repo-local skills, the same flows can be
performed manually by POSTing JSON-RPC requests to `/api/mcp`.

Validate the endpoint first:

```sh
curl -sS "${MYSTRA_MCP_URL:-http://127.0.0.1:3000/api/mcp}" \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":"tools","method":"tools/list"}'
```
