# Contract: Runner Agent Step

This contract defines how the runner hands adapter execution payloads to the
container-task shell and how the shell reports the result back.

## Runner → Shell Payload

The runner serializes these env vars before invoking the `agent` step:

- `MYSTRA_AGENT_COMMAND_JSON`
- `MYSTRA_AGENT_ENV_JSON`
- `MYSTRA_AGENT_PREPARE_DIRS_JSON`
- `MYSTRA_AGENT_STDIN_FILE`

### Semantics

- `MYSTRA_AGENT_COMMAND_JSON` must decode to a non-empty command array.
- `MYSTRA_AGENT_ENV_JSON` must decode to a string map used to augment the
  process environment.
- `MYSTRA_AGENT_PREPARE_DIRS_JSON` must decode to a list of directories the
  shell creates before spawning the process.
- `MYSTRA_AGENT_STDIN_FILE` is optional and points at a workspace file the shell
  pipes to agent stdin when the adapter requests file-backed prompt transport.

## Shell Execution Rule

- The shell validates payload shape before spawning the process.
- The shell no longer branches on agent type for command construction.
- The shell may read `MYSTRA_AGENT_STDIN_FILE` and pipe its contents to stdin.
- The shell captures:
  - `exitCode`
  - `stdout`
  - `stderr`

into `agent-process-result.json` and then emits that content inside the agent
step output.

## Shell → Runner Step Output

The `agent` workflow step output includes:

- `branchName`
- `noChanges`
- `changedFiles`
- `processResult`

## Runner Interpretation Rule

- The runner reads `processResult` back from the step output.
- The runner passes `processResult` into `adapter.parseOutput(...)`.
- If `parseOutput` returns `success: false`, the workflow node fails with
  `agent_failed` semantics.
- If the adapter succeeds but `noChanges` is true, the workflow still fails with
  the existing `no_changes` MVP semantics.

## Stability Rule

This handoff must stay compatible with the 005 workflow-step model:

- `clone`
- `agent`
- `quality-gate`
- `push`
- `review-create`

009 changes the agent payload contract inside the `agent` step; it does not
replace the broader workflow-step shell protocol.
