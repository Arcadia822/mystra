# Quickstart: MCP Companion Skills

This quickstart documents the repo-local Mystra companion skills implemented for
feature `008`, plus the local Codex plugin wrapper now published from this
repository.

## Available Skills

The current companion skill pack lives under:

```text
.agents/skills/
├── mystra-submit-user-journey/
├── mystra-submit-implementation-request/
└── mystra-check-job-status/
```

The installable Codex plugin wrapper lives under:

```text
plugins/mystra/
├── .codex-plugin/plugin.json
├── .mcp.json
├── assets/icon.svg
└── skills/
```

## Discovery

From the repository root, list the available Mystra companion skills with:

```sh
find .agents/skills -maxdepth 2 -name SKILL.md | grep 'mystra-'
```

List the local plugin manifests with:

```sh
find plugins/mystra -maxdepth 3 -type f | sort
```

## Installation Model

This repository now supports two local installation surfaces:

1. Direct repo-local skills from `.agents/skills/` for agents that honor
   in-repository skill directories.
2. A local Codex plugin from `plugins/mystra/`, registered in
   `.agents/plugins/marketplace.json`, for environments that install plugins
   through a local marketplace manifest.

If you need the same skills in another workspace, copy the desired skill
directories from `.agents/skills/` into that environment's local skill folder,
or copy `plugins/mystra/` and the matching marketplace entry into that
workspace's local plugin registry.

## MCP Endpoint Prerequisite

The skills assume a reachable Mystra MCP endpoint.

- Default expectation: `http://127.0.0.1:3000/api/mcp`
- Recommended override: set `MYSTRA_MCP_URL` in your shell/environment when the
  endpoint lives elsewhere

## Skill Coverage

| Skill | Purpose | MCP tool(s) |
|---|---|---|
| `mystra-submit-user-journey` | Create a job from actor/goal/acceptance-criteria input | `mystra_create_job` |
| `mystra-submit-implementation-request` | Create a job from spec/task implementation context | `mystra_create_job` |
| `mystra-check-job-status` | Retrieve structured run/result status for a job | `mystra_get_job` |

## Manual Fallback

If the agent runtime cannot load repo-local skills, the same flows can be
performed manually by POSTing JSON-RPC requests to `/api/mcp`.

Validate the endpoint first:

```sh
curl -sS "${MYSTRA_MCP_URL:-http://127.0.0.1:3000/api/mcp}" \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":"tools","method":"tools/list"}'
```
