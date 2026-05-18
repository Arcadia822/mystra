# Data Model: Agent Adapter Typed Contracts

## AgentExecutionRequest

- **Purpose**: Canonical adapter input for building an agent command.
- **Fields**:
  - `prompt`
  - `promptFilePath`
  - `workingDirectory`
- **Rules**:
  - Both fields are required non-empty strings.
  - `promptFilePath` is optional and is used when the runner spills oversized
    prompts out of argv transport.
  - The runner owns constructing this request from the claimed task context.

## AgentExecutionOptions

- **Purpose**: Optional adapter-owned execution hints for the shell bridge.
- **Fields**:
  - `stdinFilePath`
- **Rules**:
  - Adapters only return this when they need file-backed prompt transport.
  - The runner passes these hints to the shell through explicit env vars rather
    than inferring them from command strings.

## AgentProcessResult

- **Purpose**: Structured record of the raw agent process outcome returned from
  the task container shell.
- **Fields**:
  - `exitCode`
  - `stdout`
  - `stderr`
- **Rules**:
  - The shell captures it per agent step and writes it into workflow step
    output.
  - The adapter may normalize malformed process output before treating it as a
    typed result.

## AgentParsedResult

- **Purpose**: Adapter-owned interpretation of an agent process result.
- **Fields**:
  - `success`
  - `errorMessage`
  - `metadata`
- **Rules**:
  - `success: false` must produce an actionable error message for the runner.
  - `metadata` is reserved for adapter-specific structured details that can be
    surfaced in workflow node events.

## AgentAdapter

- **Purpose**: Replaceable interface for one agent implementation.
- **Fields / Methods**:
  - `agentName`
  - `buildCommand(input)`
  - `buildEnvironment(input)`
  - `buildExecutionOptions(input)` (optional)
  - `parseOutput(result)`
  - `isSuccess(result)`
- **Rules**:
  - The runner interacts with this interface, not with agent-specific shell
    branches.
  - Implementations must keep command construction and process interpretation
    consistent with each other.

## AdapterRegistry

- **Purpose**: Maps agent names to concrete adapter implementations.
- **Fields / Methods**:
  - `get(name)`
- **Rules**:
  - Package-level registry lookup is synchronous and throws on unknown names.
  - The current runner instantiation includes built-in `codex` and `copilot`
    adapters plus optional startup-registered module adapters.

## RunnerAgentPayload

- **Purpose**: Runner-owned serialized handoff from TypeScript adapter contracts
  to the container-task shell.
- **Fields**:
  - `command` (`MYSTRA_AGENT_COMMAND_JSON`)
  - `environment` (`MYSTRA_AGENT_ENV_JSON`)
  - `prepareDirs` (`MYSTRA_AGENT_PREPARE_DIRS_JSON`)
- **Rules**:
  - Payload values are serialized by the runner before `docker exec`.
  - The shell validates payload shape before spawning the agent process.

## AgentStepOutput

- **Purpose**: Structured result written by the shell for the workflow
  `agent.execute` step.
- **Fields**:
  - `branchName`
  - `noChanges`
  - `changedFiles`
  - `processResult`
- **Rules**:
  - `processResult` always records the raw agent process exit code and captured
    stdout/stderr.
  - `noChanges` remains the current MVP terminal failure mode for successful
    agent runs that make no repository modifications.

## BuiltInCodexAdapter

- **Purpose**: Built-in adapter for Codex CLI execution.
- **Fields**:
  - optional `authDir`
  - optional `timeoutSeconds`
- **Rules**:
  - Builds `codex exec --dangerously-bypass-approvals-and-sandbox --cd ...`
  - Emits `CODEX_HOME` and optional `CODEX_TIMEOUT_SECONDS` through environment
    payloads.
  - Uses `-` plus `stdinFilePath` execution hints when the runner spills a large
    prompt to `/mystra/workspace/agent-prompt.txt`.

## BuiltInCopilotAdapter

- **Purpose**: Built-in adapter for Copilot CLI execution.
- **Fields**:
  - `cliConfigDir`
  - `homeDir`
  - `configDir`
  - `cacheDir`
  - optional `denyMcpServers`
  - optional `deniedUrls`
- **Rules**:
  - Builds `copilot --config-dir ... --prompt ... --allow-all --no-ask-user
    --no-color --stream off`
  - Uses `--attachment <promptFilePath>` plus a short wrapper prompt when the
    runner spills a large prompt out of argv transport.
  - Emits isolated HOME/XDG/COPILOT config env values for the task container.
