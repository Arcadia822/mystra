# Direct Execution Contract

## Ownership

```text
control plane: immutable Job/Run truth, claim, events, terminal result
runner:        one explicit machine-execution lifecycle
sandbox:       isolated process and retained preview environment
agent:         autonomous implementation inside declared bounds
repo:          branch and human review artifact
```

## Required order

1. Validate claimed Job, Project and resolved runtime.
2. Select SandboxProvider, AgentAdapter and RepoProvider.
3. Materialize immutable execution context.
4. Launch Docker sandbox.
5. Clone repository/base branch.
6. Invoke Agent once in bounded autopilot mode; Agent owns its internal work loop.
7. Reject no-change success.
8. Run Project test command.
9. Run Project build command.
10. Start preview and pass two host-side probes.
11. Push branch.
12. Create or reuse the unique open PR for head/base.
13. Complete Run as `waiting_for_review`.

There is no provider-selected blueprint, node registry, graph traversal or handler map.

## Resource semantics

- `running`: consumes runner active capacity.
- `waiting_for_review`: machine terminal, releases capacity, retains sandbox.
- failed test/build/preview/delivery: releases capacity and cannot report review-ready.
- canceled/timed_out: stop sandbox with bounded cleanup.

## Secret semantics

- Linear secret never reaches runner.
- GitHub token reaches clone/push/PR processes only.
- Copilot token reaches Copilot process only.
- Runtime secrets must not be placed in logged command arrays.
