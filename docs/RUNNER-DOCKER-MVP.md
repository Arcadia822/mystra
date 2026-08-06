# Docker Runner MVP

## Contract

The stable Runner claims one Session together with parent Task context and a
resolved Docker runtime. It creates a Session-scoped workspace, launches the
sandbox, executes the selected Agent, verifies quality, prepares a preview,
pushes the branch, creates a review, and returns a structured Session result.

## Required environment

```sh
MYSTRA_RUNNER_REGISTRATION_SECRET=shared-enrollment-secret
MYSTRA_CONTROL_PLANE_URL=http://127.0.0.1:3000
MYSTRA_EXECUTOR=docker
MYSTRA_RUNNER_NAME=local-docker
MYSTRA_RUNNER_CONCURRENCY=1
COPILOT_GITHUB_TOKEN=...
```

Repository and Agent credentials are scoped to the phases that require them.
`COPILOT_GITHUB_TOKEN` authenticates the Agent only. GitHub repository clone,
push, and review use a short-lived installation token obtained from the control
plane for each phase; the Runner has no repository PAT environment variable.
The base sandbox receives neither by default. Sandbox containers must not mount
the host Docker socket or host home.

## Sequence

```text
claim Session
-> prepare workspace and context
-> launch sandbox
-> clone immutable Task Repository
-> execute Session Agent
-> test
-> build
-> preview and probe
-> commit and push Session branch
-> create review
-> persist Session result and release Runner capacity
```

Cancellation and timeout stop the target sandbox with a bounded cleanup
deadline. Failures never claim review-ready success. Successful review handoff
uses `waiting_for_review` and retains the preview sandbox according to policy.

## Verify

```sh
pnpm --filter @mystra/runner-daemon typecheck
pnpm --filter @mystra/runner-daemon test
pnpm --filter @mystra/control-plane test
```
