# Verification Evidence

## Static and automated gates

- `pnpm lint`: PASS
- `pnpm typecheck`: PASS
- `pnpm test`: PASS
  - shared: 123
  - agent-adapters: 6
  - control-plane: 111
  - runner-daemon: 81
  - total: 321
- `pnpm build`: PASS
  - `/projects`: static route
  - `/projects/[slug]`: dynamic route

## CLI/API parity fixture

Fixture:

- id: `06111354-40e0-483c-82a4-b0f9e0527f5c`
- slug: `mystra-035-fixture`
- repo: `local/mystra-035-fixture`
- base branch: `main`
- agent: `copilot`
- runtime: `docker`
- image: `mystra-copilot:fixture`
- prewarm key: `manager`

`projects list`, `projects inspect mystra-035-fixture`, `/projects` 和
`/projects/mystra-035-fixture` 展示一致。

## Browser evidence

- Project list: PASS
- Project detail: PASS
- Project empty state on isolated empty SQLite: PASS
- Project missing slug: `PROJECT_NOT_FOUND` error state PASS
- Tasks `Dispatch from Issue` DOM count: `0`
- Captured server requests: `/api/projects`、`/api/projects/:slug`、`/api/jobs` only
- `/api/integrations/*/issues` requests: `0`
- Browser console warnings/errors: `0`
- responsive horizontal overflow:
  - 320px: false
  - 768px: false
  - 1024px: false
  - 1440px: false
- Projects nav active state: PASS
- semantic Project links and visible focus: PASS

## Scope evidence

- Project API: unchanged
- Operator CLI: unchanged
- shared schemas: unchanged
- RdbProvider/SQLite: unchanged
- Linear/GitHub Issue: no request and no mutation
- unrelated dirty working-tree files: preserved and excluded from staging
