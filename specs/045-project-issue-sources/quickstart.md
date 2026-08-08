# Quickstart: Verify Project Issue Sources

## Prerequisites

- Node `24.14.0`, pnpm `10.25.0`.
- `MYSTRA_SECRET_STORE_KEY` configured for SecretProvider.
- A GitHub-backed Project and a Linear API key with access to at least one Linear Team.

## Static and contract verification

```bash
fnm use 24.14.0
corepack use pnpm@10.25.0
pnpm test
pnpm typecheck
pnpm lint
```

Run the feature-targeted suites first during implementation, then the full commands above. Both SQLite and PostgreSQL `RdbProvider` contract suites must include ProjectIssueSource CRUD/uniqueness/reference protection.

## Runtime journey

1. Start control plane and apply current Prisma schema.
2. Register/login and open Settings -> Integrations -> Linear.
3. Add an API key; verify workspace and Team summary appears while the key never appears in DOM/network response.
4. Open a Project and configure one Linear Team using one exact connection.
5. In Project -> Issues, verify GitHub and Linear tabs use their distinct columns.
6. Switch filters/pages in both tabs and confirm state remains provider-local.
7. Open a row and confirm it goes directly to the provider website; no Mystra detail route is used.
8. Open `/issues`; confirm no remote Issue request occurs before selecting a Project.
9. As Member, confirm read access works and all connection/source mutations fail closed.

## Negative checks

- invalid key create/replace leaves prior connection unchanged.
- referenced Linear connection cannot be deleted.
- removed/revoked Linear Team produces scope-unavailable, not workspace-wide Issues.
- old cursor after Project/source/provider change is rejected/cleared.
- GitHub Pull Requests never appear in GitHub Issue results.
- Linear failure does not block GitHub view and vice versa.
- no Task/Session mutation request occurs from any Issue page.
- 320/768/1024/1440px have no page-level unrecoverable horizontal scroll; keyboard focus remains visible.

## Verification evidence — 2026-08-08

- Runtime: existing control-plane preview at `http://localhost:3001`; `GET /issues` returned HTTP 200.
- Database: both Prisma schemas validated; SQLite migration `20260808173000_project_issue_sources` applied and migration status reported up to date.
- Full quality gates: `pnpm typecheck`, `pnpm lint`, `pnpm test`, and the production build all passed. Test totals were 396 passed and 12 skipped; the build emitted only the repository's existing Sentry warnings.
- Browser journey: a temporary Owner account, Team, Project, and deliberately unusable GitHub connection exercised the no-Project state, Project selection, GitHub failure isolation, unconfigured Linear state, Project Issues/Settings tabs, source controls, and Settings -> Integrations -> Linear. All temporary records were removed and their zero counts verified afterward.
- Responsive checks: document width equaled viewport width at 320, 768, 1024, and 1440 px after the narrow-screen fix; browser console recorded zero warnings or errors.
- Security/boundary checks: no product `LINEAR_API_KEY` environment fallback, public plaintext-key field, Issue detail route, Issue-to-Task control, or Issue write-back control was found.
- Keyboard-only traversal passed in connected Chrome. Starting from `document.body`, native `Tab` reached the sidebar controls, Project link, account link, and Project selector in logical order. Typing the Project's first character selected it without pointer input. `Tab` then reached GitHub and Linear provider tabs; `Enter` switched both directions. GitHub state/assignee/label/milestone/Refresh controls were reachable, accepted keyboard input, retained `octocat`/`bug`/`v1` after switching to Linear and back, and Refresh preserved the isolated GitHub credential error. Focused tabs and Refresh rendered a visible approximately `2px solid rgb(52, 123, 80)` outline. Chrome console reported zero warnings or errors.
- Keyboard QA cleanup: the temporary User, Team, Project, connection, sessions, and auth account were deleted by exact ID and verified as `0000` remaining records. The temporary registration response was moved to Trash.
