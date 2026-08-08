# Quickstart: Verify Agent Management

## Prerequisites

```bash
fnm use 24.14.0
corepack use pnpm@10.25.0
pnpm install
pnpm db:generate
pnpm db:migrate:deploy
```

Use an authenticated local operator session with an active Team.

## CLI smoke path

```bash
pnpm operator:cli -- agents create \
  --name Reviewer \
  --system-prompt "Review every changed contract and report evidence." \
  --json

pnpm operator:cli -- agents list --json
pnpm operator:cli -- agents inspect <agent-id> --json

pnpm operator:cli -- agents update <agent-id> \
  --expected-revision 1 \
  --system-prompt "Review every changed contract and reject silent fallbacks." \
  --json

pnpm operator:cli -- agents archive <agent-id> \
  --expected-revision 2 \
  --json
```

Expected observations:

- create returns revision 1 and no Project/Provider/Runtime/Context fields;
- prompt update returns revision 2;
- a second update with expected revision 1 returns `AGENT_REVISION_CONFLICT`;
- archived Agent remains inspectable but disappears from the default list;
- archived Agent cannot be resolved as new Session input.

## Automated verification

```bash
pnpm --filter @mystra/shared exec vitest run src/agent.test.ts src/schemas.test.ts src/issue.test.ts
pnpm --filter @mystra/agent-adapters test
pnpm --filter @mystra/control-plane exec vitest run \
  src/lib/db/prisma-provider.sqlite.test.ts \
  src/lib/db/prisma-provider.postgresql.test.ts \
  src/lib/db/prisma-schema-parity.test.ts \
  app/api/routes.test.ts \
  app/api/mcp/route.test.ts \
  src/lib/operator-cli.test.ts
pnpm db:validate
pnpm test
pnpm typecheck
pnpm build
```

PostgreSQL contract tests require the existing `MYSTRA_TEST_POSTGRES_URL`; when unavailable, they must report a deliberate skip rather than being represented as executed.
