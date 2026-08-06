# Quickstart: GitHub Project Onboarding

## GitHub App configuration

Create or configure one GitHub App with:

- Setup URL: `http://127.0.0.1:3000/api/integration-connections/github/setup`
- OAuth callback URL: `http://127.0.0.1:3000/api/integration-connections/github/oauth/callback`
- Request user authorization during installation: **off** (setup URL and this option are mutually exclusive)
- Webhooks: off for 039
- Repository permissions: Contents read/write, Pull requests read/write, Metadata read; Issues read if GitHub Issue intake is used

Provide deployment secrets only to Control Plane:

```bash
export MYSTRA_GITHUB_APP_ID="..."
export MYSTRA_GITHUB_APP_CLIENT_ID="..."
export MYSTRA_GITHUB_APP_CLIENT_SECRET="..."
export MYSTRA_GITHUB_APP_SLUG="..."
export MYSTRA_GITHUB_APP_PRIVATE_KEY="$(< /absolute/path/to/app.private-key.pem)"
export MYSTRA_GITHUB_APP_CALLBACK_URL="http://127.0.0.1:3000/api/integration-connections/github/oauth/callback"
```

Do not set `MYSTRA_GITHUB_TOKEN`; 039 removes that repository credential path. `COPILOT_GITHUB_TOKEN` remains a separate Agent credential and does not authorize repository discovery or delivery.

## Start locally

```bash
fnm use 24.14.0
corepack use pnpm@10.25.0
pnpm --filter @mystra/control-plane dev
```

Open `http://127.0.0.1:3000`, then:

1. Settings → Integrations → Connect GitHub.
2. Choose an account and repository scope on GitHub.
3. Complete OAuth validation and confirm Settings shows the account/installation.
4. Click the Projects `+`; confirm the URL does not change.
5. Choose a repository, verify the picker collapses, configure and create.

## Focused verification

```bash
pnpm --filter @mystra/shared test
pnpm --filter @mystra/control-plane test
pnpm --filter @mystra/runner-daemon test
pnpm typecheck
pnpm build
```

Then run a private-repository Session through clone, push and PR creation. Confirm no repository PAT is present in Control Plane or Runner environment.

## Secret audit

```bash
rg -n "MYSTRA_GITHUB_TOKEN|ghu_|ghs_" apps packages docs scripts
```

Expected: no active production reference to `MYSTRA_GITHUB_TOKEN`; token-prefix fixtures may appear only in explicit redaction/security tests and must never contain real values.
