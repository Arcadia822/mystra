---
name: supabase-mcp
description: Use when connecting Codex or another MCP client to Supabase hosted MCP, local Supabase MCP, or project-scoped read-only database tools.
metadata:
  priority: 4
  docs:
    - "https://supabase.com/mcp"
  promptSignals:
    phrases:
      - "Supabase MCP"
      - "mcp.supabase.com"
      - "query Supabase with MCP"
      - "project-scoped MCP"
---

# Supabase MCP

Use Supabase MCP when an agent needs structured access to project metadata, database inspection, SQL execution, migrations, logs, advisors, generated TypeScript types, Edge Functions, or Supabase docs search.

## Hosted MCP

Default hosted endpoint:

```json
{
  "mcpServers": {
    "supabase": {
      "url": "https://mcp.supabase.com/mcp"
    }
  }
}
```

Recommended safer project-scoped read-only endpoint:

```json
{
  "mcpServers": {
    "supabase": {
      "url": "https://mcp.supabase.com/mcp?project_ref=YOUR_PROJECT_REF&read_only=true"
    }
  }
}
```

Hosted Supabase MCP uses browser-based OAuth in clients that support it. Current Supabase documentation says a personal access token is no longer required for the default hosted MCP flow.

## Local Development MCP

When the local Supabase stack is running through the CLI, the local MCP server is available at:

```text
http://localhost:54321/mcp
```

Use local MCP for local database inspection and development tasks. Do not expose local or self-hosted MCP endpoints publicly.

## Operating Rules

- Prefer `read_only=true` when the task is inspection, documentation lookup, type generation, or debugging.
- Scope hosted MCP with `project_ref` whenever the project is known.
- Avoid connecting MCP clients to production data unless the user explicitly accepts that risk and the operation is read-only.
- Treat SQL execution and migration tools as write-capable. Confirm target project and expected change before using them.
- For CI or clients without browser OAuth, use Supabase's documented manual authentication path with a scoped PAT passed as an authorization header if the client supports headers.

