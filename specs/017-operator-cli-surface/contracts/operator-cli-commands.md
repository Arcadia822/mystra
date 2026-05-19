# Contract: Operator CLI Commands

## Entry Point

```sh
pnpm operator:cli -- <group> <command> [args] [--json]
```

Environment:

- `MYSTRA_CONTROL_PLANE_URL` defaults to `http://localhost:3000`

## Commands

### `projects list`

- **API**: `GET /api/projects`
- **Success**:
  - human: one row per project with slug, repo, base branch, default agent
  - json: `{ "projects": [...] }`

### `projects inspect <slug>`

- **API**: `GET /api/projects/{slug}`
- **Success**:
  - human: project identity, lane facts, workflow hint, runtime/context summary
  - json: `{ "project": { ... } }`

### `runs list`

- **API**: `GET /api/jobs`
- **Success**:
  - human: one row per run with job id, project slug, state, branch, updated time
  - json: `{ "jobs": [...] }`

### `runs inspect <jobId>`

- **API**: `GET /api/jobs/{jobId}`
- **Success**:
  - human: job id, run state, project association, workflow identity, lane snapshot summary
  - json: canonical run snapshot

### `runs result <jobId>`

- **API**: `GET /api/jobs/{jobId}`
- **Success**:
  - human: terminal result summary, branch, MR/PR references, preview helpers when present
  - json: `{ "result": { ... }, "runState": "...", "jobId": "..." }`
- **Derived failures**:
  - `RESULT_NOT_READY`
  - `RESULT_UNAVAILABLE`

### `runs failure <jobId>`

- **API**: `GET /api/jobs/{jobId}`
- **Success**:
  - human: failure state, error code/message, summary, recent workflow/project context
  - json: `{ "result": { ... }, "runState": "...", "jobId": "..." }`
- **Derived failures**:
  - `RESULT_NOT_READY`
  - `RESULT_UNAVAILABLE`

## Shared Flags

- `--json`: emit structured JSON only
