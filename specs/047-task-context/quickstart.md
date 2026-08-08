# Quickstart: Verify Task Context Container

## Prerequisites

```bash
fnm use 24.14.0
corepack use pnpm@10.25.0
pnpm install
pnpm db:generate
pnpm db:migrate:deploy
```

Use an authenticated local operator with an active Team. Configure one GitHub Project and, for Linear verification, one Project Linear Team source.

## Manual API path

```bash
pnpm operator:cli -- tasks create \
  --title "Review the Task context contract" \
  --description "Keep durable Agent-facing work notes." \
  --idempotency-key 00000000-0000-4000-8000-000000000047 \
  --json

pnpm operator:cli -- tasks create \
  --title "Review the Task context contract" \
  --description "Keep durable Agent-facing work notes." \
  --idempotency-key 00000000-0000-4000-8000-000000000047 \
  --json
```

Both commands must return the same Task ID. The first reports `created=true`; the second `created=false`. Neither requires Project or starts Session.

```bash
pnpm operator:cli -- tasks update <task-id> \
  --title "Review the final Task context contract" \
  --description "Updated without changing Project or Issue references." \
  --json
```

## Web path

1. Open `/new`.
2. Create a title-only Task with no Project; verify the Task detail opens.
3. Return to `/new`; verify the prior Project/draft is absent after success.
4. Create a Task with a Project and description.
5. Open `/tasks`; verify both appear exactly once, under `No project` and the selected Project.
6. Open a Project Issues tab. On one GitHub row click `Create Task`.
7. Verify the page does not navigate, success text appears and the row changes to `Open Task`.
8. Refresh; verify it still renders `Open Task`. Click it explicitly and verify Task detail.
9. Repeat for Linear.
10. Update Task title/description; verify Project/Issue values remain fixed and no relation controls exist.

## Automated verification

```bash
pnpm --filter @mystra/shared exec vitest run \
  src/task.test.ts src/project-issues.test.ts src/schemas.test.ts src/management.test.ts

pnpm --filter @mystra/control-plane exec vitest run \
  src/lib/db/prisma-provider.sqlite.test.ts \
  src/lib/db/prisma-provider.postgresql.test.ts \
  src/lib/db/prisma-schema-parity.test.ts \
  src/lib/tasks/task-service.test.ts \
  src/lib/integrations/project-issues.test.ts \
  app/api/routes.test.ts \
  app/api/project-issues.test.ts \
  app/api/mcp/route.test.ts \
  app/_components/shell-model.test.ts \
  app/_components/new-task-model.test.ts \
  src/lib/operator-cli.test.ts

pnpm db:validate
pnpm test
pnpm typecheck
pnpm build
```

PostgreSQL provider tests require `MYSTRA_TEST_POSTGRES_URL`; a missing variable must be reported as an explicit skip, not as live PostgreSQL evidence.

## Browser evidence

Test 320, 768, 1024 and 1440px. At each width verify no horizontal page overflow, title/description labels are exposed in the accessibility tree, focus is visible, submitting is conveyed by text, provider links remain usable, and console warnings/errors are zero. Capture network evidence that Task create/update only call Task routes and that Issue actions issue no provider write or Session requests.

## 2026-08-08 delivery evidence

- SQLite: all seven migrations, including `20260808200000_task_context`, deployed
  to an isolated database; `db:migrate:status` reported current.
- Real HTTP: 20 concurrent manual creates with one idempotency key returned one
  Task ID (`created=true` once, `created=false` 19 times). PATCH, GET and LIST
  returned that same no-Project/no-Issue Task.
- Full gates: 17 shared test files / 163 tests, 58 passing control-plane files /
  265 tests, 1 skipped control-plane file / 14 skipped tests, 1 agent-adapter
  file / 6 tests, and 3 runner files / 7 tests; full typecheck and production
  build passed. PostgreSQL runtime tests were skipped because
  `MYSTRA_TEST_POSTGRES_URL` was absent; both Prisma schemas validated.
- Real Chrome: `/new`, `/tasks`, Task detail, and controlled GitHub/Linear Issue
  rows passed at 320, 768, 1024 and 1440px. New create, Task edit, invalid-title
  focus/error, scoped draft clear, Issue `Create Task` → `Open Task`, explicit
  provider links, and stay-on-list behavior were exercised. Console errors,
  page errors and failed post-login network responses were zero. Provider row UI
  used controlled API fixtures because no live provider credential was present;
  exact credential/provider behavior is covered by service and route tests.
- Chrome found one page-level overflow caused by an absolute `srOnly` table
  heading. The heading was replaced with an accessible column label and all
  viewport/provider combinations then reported document width equal to viewport.
