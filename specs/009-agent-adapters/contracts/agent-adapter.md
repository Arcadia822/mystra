# Contract: Agent Adapter

This contract defines the Mystra-owned boundary for agent-specific CLI
execution.

## Required Interface

Each adapter implementation MUST expose:

- `agentName`
- `buildCommand(input)`
- `buildEnvironment(input)`
- `parseOutput(result)`
- `isSuccess(result)`

## Input Contract

`buildCommand` and `buildEnvironment` consume a validated
`AgentExecutionRequest` with:

- `prompt`
- `promptFilePath` (optional)
- `workingDirectory`

`prompt` and `workingDirectory` are required non-empty strings.
`promptFilePath` is optional and is used when the runner spills oversized
prompts to a workspace file.

## Optional Execution Hints

Adapters may expose `buildExecutionOptions(input)` and return:

- `stdinFilePath`

This keeps file/stdin prompt transport explicit instead of forcing the shell to
guess behavior from command arrays.

## Process Result Contract

`parseOutput` and `isSuccess` consume an `AgentProcessResult` with:

- `exitCode`
- `stdout`
- `stderr`

The adapter MAY normalize malformed process values into a best-effort result
before applying strict validation.

## Built-in Adapter Semantics

### Codex

- Command must begin with `codex exec`
- Must include `--dangerously-bypass-approvals-and-sandbox`
- Must include `--cd <workingDirectory>`
- May emit `CODEX_HOME`
- May emit `CODEX_TIMEOUT_SECONDS`
- When `promptFilePath` is supplied, must use `-` for prompt input and may
  return `stdinFilePath` so the shell can pipe the file into stdin.

### Copilot

- Command must begin with `copilot --config-dir <dir>`
- Must include `--prompt`, `--allow-all`, `--no-ask-user`, `--no-color`,
  `--stream off`
- When `promptFilePath` is supplied, must include `--attachment <path>` and use
  a short wrapper prompt instead of the full task text in argv
- May include repeated `--disable-mcp-server` and `--deny-url` flags
- Must emit isolated HOME/XDG/COPILOT config env values

## Registry Rule

- Adapter lookup is by agent name.
- Unknown names currently throw from the registry.
- Dedicated unsupported-agent runtime hardening remains a deferred follow-up
  rather than current MVP behavior.

## Replaceability Rule

Any future adapter must satisfy this contract without forcing a redesign of:

- `packages/agent-adapters`
- `apps/runner-daemon/src/index.ts`
- `apps/runner-daemon/assets/container-task.sh`

Runtime extension is now available through startup-loaded adapter modules; any
future adapter can register through that surface as long as it satisfies this
contract.
