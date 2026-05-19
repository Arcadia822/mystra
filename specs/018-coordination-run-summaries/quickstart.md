# Quickstart: Coordination Run Summaries

## Prerequisites

- `pnpm install`
- A local control plane started with `pnpm dev:control-plane`
- A test project and job available in the SQLite-backed local environment

## 1. Verify Shared Summary Contract

```sh
pnpm --filter @mystra/shared test
```

Expected:

- Compact summary schema validates queued, running, and terminal examples.
- Invalid phase/milestone combinations are rejected.

## 2. Verify Control-Plane Summary Projection

```sh
pnpm --filter @mystra/control-plane test
```

Expected:

- Provider and route tests cover summary derivation from run/result/event state.
- Not-found and terminal edge cases are covered.

## 3. Fetch A Compact Summary Over HTTP

```sh
curl -sS http://localhost:3000/api/jobs/<job-id>/summary
```

Expected:

- Response contains compact summary identifiers, current phase, milestone, and timestamps.
- Response does not include the full `events` array or workflow node history.

## 4. Fetch A Compact Summary Through MCP

Call the new MCP tool with the existing local control-plane endpoint:

```json
{
  "name": "mystra_get_job_summary",
  "arguments": {
    "jobId": "<job-id>"
  }
}
```

Expected:

- Tool returns the same compact summary contract as the HTTP route.

## 5. Check The Same Summary From CLI

```sh
pnpm job:status -- --job-id <job-id>
```

Expected:

- CLI prints the compact summary as JSON.

## 6. Wait For Terminal State From CLI

```sh
pnpm job:status -- --job-id <job-id> --wait
```

Expected:

- CLI polls the compact summary surface until terminal state.
- Success exits `0`; failure-like terminal outcomes exit non-zero.

## 7. Broad Validation

```sh
pnpm typecheck
pnpm test
pnpm build
```

Expected:

- Shared contracts, control-plane routes, MCP tooling, and CLI script remain aligned.
