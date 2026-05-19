# Research: Operator CLI Surface

## Decision 1: Ship a repo-local Node script, not a new workspace package

- **Decision**: Implement the CLI as `scripts/operator-cli.mjs` and expose it via
  a root `package.json` alias.
- **Why**: `scripts/submit-job.mjs` already proves this repo prefers small
  operator scripts for shell workflows. That keeps the diff small and avoids a
  fake distribution story.
- **Rejected alternative**: Create `packages/operator-cli/` with its own build and
  publish surface. Rejected because the feature spec requires an operator
  surface, not a packaged product.

## Decision 2: Reuse canonical management API routes exactly as they exist

- **Decision**: Build the CLI on top of `GET /api/projects`,
  `GET /api/projects/{slug}`, `GET /api/jobs`, and `GET /api/jobs/{id}`.
- **Why**: `014` and `015` already froze the truth surfaces for project and run
  inspection, including lane/workflow/context data.
- **Rejected alternative**: Add CLI-specific endpoints or MCP-only projections.
  Rejected because that would create a second truth surface.

## Decision 3: Support two output modes

- **Decision**: Default to human-readable output and add `--json` for structured
  output.
- **Why**: The spec is shell-first for operators, not UI-first. Human output is
  better for routine inspection, while `--json` supports piping and scripting.
- **Rejected alternative**: JSON-only output. Rejected because it makes routine
  shell use worse and pushes formatting work back onto operators.

## Decision 4: Derive result and failure outcomes from one canonical job snapshot

- **Decision**: `runs result` and `runs failure` both fetch
  `GET /api/jobs/{id}` and compute operator outcomes from `run.state` and
  `run.result`.
- **Why**: The canonical job snapshot already holds the durable truth. One read is
  cheaper and less ambiguous than multiple purpose-built endpoints.
- **Rejected alternative**: Add a dedicated result endpoint. Rejected because the
  data already exists in the canonical snapshot.

## Decision 5: Distinguish operator outcomes explicitly

- **Decision**: Map transport failures, management errors, `RESULT_NOT_READY`,
  and `RESULT_UNAVAILABLE` to explicit CLI outcomes and exit codes.
- **Why**: The spec requires operators to distinguish missing, unavailable,
  not-yet-ready, and failed states.
- **Rejected alternative**: Return generic non-zero exits with freeform stderr.
  Rejected because it hides the state distinctions the feature exists to expose.

## Code Evidence

- `scripts/submit-job.mjs` already implements small-script argument parsing,
  control-plane fetches, and shell JSON output.
- `apps/control-plane/app/api/projects/[slug]/route.ts` already exposes the lane
  inspection view needed for workflow/context inspection.
- `apps/control-plane/app/api/jobs/[id]/route.ts` already returns the canonical
  job snapshot required for run inspection and result/failure retrieval.
- `docs/LOCAL-USAGE.md` already teaches operators to use raw HTTP and MCP; the
  CLI can simplify those steps without replacing the underlying truth.

## GitNexus Note

This planning pass used direct repository inspection instead of GitNexus queries.
The touched surface is narrow, the source files are already known, and live
reads were enough to bound the change safely.
