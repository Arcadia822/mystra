---
name: mystra-check-session-status
description: Retrieves a human-readable Mystra Session status and result through MCP when a caller provides a Session ID.
metadata:
  priority: 4
  promptSignals:
    phrases:
      - "check Mystra Session"
      - "Session status"
      - "mystra_get_session"
      - "execution status"
---

# Mystra Check Session Status

Use this skill to inspect one previously created Mystra Session.

## Input

- Required: `sessionId`

Stop without calling MCP when it is empty. Report endpoint failures and
`SESSION_NOT_FOUND` directly.

## MCP call

Call `${MYSTRA_MCP_URL:-http://127.0.0.1:3000/api/mcp}`:

```json
{
  "jsonrpc": "2.0",
  "id": "session-status",
  "method": "tools/call",
  "params": {
    "name": "mystra_get_session",
    "arguments": { "sessionId": "<sessionId>" }
  }
}
```

Summarize the Session ID, parent Task ID, state, Agent, branch, result summary,
and review URL when present. Do not describe internal execution facts as
business objects.
