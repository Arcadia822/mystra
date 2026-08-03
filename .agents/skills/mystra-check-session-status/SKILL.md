---
name: mystra-check-session-status
description: Retrieves a human-readable Mystra Session status and result through MCP when a caller provides a Session ID.
---

# Mystra Check Session Status

Require `sessionId`, then call `mystra_get_session` at
`${MYSTRA_MCP_URL:-http://127.0.0.1:3000/api/mcp}`. Stop on empty input,
transport failure, or `SESSION_NOT_FOUND`.

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

Summarize Session ID, parent Task ID, state, Agent, branch, result summary, and
review URL. Do not expose internal execution facts as business objects.
