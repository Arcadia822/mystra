---
name: supabase-cli
description: Use when working with the Supabase CLI for local development, project linking, migrations, generated types, Edge Functions, secrets, or CI workflows.
metadata:
  priority: 4
  docs:
    - "https://supabase.com/docs/guides/local-development/cli/getting-started"
    - "https://supabase.com/docs/reference/cli"
  bashPatterns:
    - '^\\s*(npx\\s+)?supabase(?:\\s|$)'
    - '\\bpnpm\\s+supabase\\b'
    - '\\byarn\\s+supabase\\b'
    - '\\bbunx\\s+supabase\\b'
  pathPatterns:
    - 'supabase/config.toml'
    - 'supabase/migrations/**'
    - 'supabase/functions/**'
    - 'supabase/seed.sql'
---

# Supabase CLI

Use the Supabase CLI as the primary interface for local Supabase development, database migrations, Edge Functions, generated types, secrets, and hosted project linking.

## Current Installation Guidance

Prefer one of these supported installation modes:

```bash
# Project-local Node install. Requires Node.js 20+.
npm install supabase --save-dev
npx supabase --help

# macOS global install.
brew install supabase/tap/supabase
supabase --help
```

Do not install the CLI globally with `npm install -g supabase`; current Supabase docs state that global npm installation is unsupported. For repeatable project work, prefer a dev dependency and run through `npx`, `npm exec`, or package scripts.

Local development requires Docker Desktop, OrbStack, Rancher Desktop, Podman, or another Docker-compatible container runtime.

## Common Workflows

Initialize and start a local project:

```bash
npx supabase init
npx supabase start
```

Link to a hosted project:

```bash
npx supabase login
npx supabase link --project-ref "$SUPABASE_PROJECT_ID"
```

Manage migrations:

```bash
npx supabase migration new add_example_table
npx supabase db diff --local -f add_example_table
npx supabase db reset
npx supabase db push
```

Generate TypeScript types:

```bash
npx supabase gen types typescript --local > src/database.types.ts
npx supabase gen types typescript --project-id "$SUPABASE_PROJECT_ID" > src/database.types.ts
```

Work with Edge Functions:

```bash
npx supabase functions new my-function
npx supabase functions serve my-function
npx supabase functions deploy my-function
```

Manage hosted secrets:

```bash
npx supabase secrets set MY_SECRET=value
npx supabase secrets list
```

## Operating Rules

- Inspect `supabase/config.toml` and existing migrations before changing database state.
- Never run `db push`, `migration up`, destructive SQL, or production function deploys without identifying the target project.
- Use non-interactive environment variables in CI: `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_ID`, and when needed `SUPABASE_DB_PASSWORD`.
- Prefer `db diff` and committed migration files over one-off dashboard edits.
- Treat generated types as build artifacts only if the repository already does; otherwise commit them when the app imports them.

