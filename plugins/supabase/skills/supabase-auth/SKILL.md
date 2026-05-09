---
name: supabase-auth
description: Use when configuring Supabase CLI authentication, access tokens, project credentials, auth providers, anon/service-role keys, or CI secrets.
metadata:
  priority: 4
  docs:
    - "https://supabase.com/docs/reference/cli/supabase-login"
    - "https://supabase.com/docs/guides/cli/managing-environments"
  promptSignals:
    phrases:
      - "supabase login"
      - "supabase access token"
      - "SUPABASE_ACCESS_TOKEN"
      - "SUPABASE_DB_PASSWORD"
      - "service role key"
      - "anon key"
---

# Supabase Auth And Credentials

Use this skill for credential handling around Supabase CLI, Management API access, project linking, provider configuration, and CI.

## CLI Authentication

Interactive login:

```bash
npx supabase login
```

Token-based login:

```bash
npx supabase login --token "$SUPABASE_ACCESS_TOKEN"
```

Non-interactive CI usage:

```bash
export SUPABASE_ACCESS_TOKEN="sbp_..."
export SUPABASE_PROJECT_ID="your-project-ref"
export SUPABASE_DB_PASSWORD="your-db-password"
```

Supabase stores CLI login tokens in native credential storage when available. If native credential storage is unavailable, it may write the token to `~/.supabase/access-token`; treat that file as sensitive.

## Credential Classes

- `SUPABASE_ACCESS_TOKEN`: Personal access token for the Supabase Management API and CLI automation.
- `SUPABASE_PROJECT_ID`: Project reference string used by CLI and CI workflows.
- `SUPABASE_DB_PASSWORD`: Database password used by remote database commands in non-interactive contexts.
- Publishable or anon key: Browser-safe client key, still subject to Row Level Security policy quality.
- Service-role key: Server-only administrative key. Never place this in browser bundles, mobile apps, public logs, or committed files.

## Safety Rules

- Never print tokens or keys back to the user unless the user explicitly provided a redacted example and asks about its shape.
- Prefer environment variables, encrypted CI secrets, and local ignored env files.
- Before generating code that uses service-role access, confirm it executes only on a server boundary.
- For hosted production projects, identify the target project ref before applying migrations, deploying functions, or changing auth provider settings.
- Use Supabase dashboard access tokens for automation only when OAuth/MCP browser authorization is not available.

## Auth Provider Configuration

For provider settings such as GitHub, Slack, or other OAuth/OIDC providers, use the dashboard or Supabase Management API with `Authorization: Bearer $SUPABASE_ACCESS_TOKEN`. Provider client secrets must remain in server-side configuration or Supabase provider settings, never in client code.

