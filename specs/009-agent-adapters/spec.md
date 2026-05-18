# Feature Specification: Agent Adapter Typed Contracts

**Feature Branch**: `009-agent-adapters`
**Created**: 2026-05-14
**Status**: Implemented (FR-007 deferred)
**Dependency Note**: Initialize from `specs/004-open-agents-framework/contracts/framework-alignment.md`, `contracts/module-inventory.md`, `contracts/fork-rules.md`, and `research.md` divergence records so each adapter surface is classified before replacing hardcoded runner logic.
**Input**: The `packages/agent-adapters` package is currently a stub that only exports its name. All agent-specific behavior (Codex CLI invocation, Copilot CLI invocation, auth handling, command generation) is hardcoded in `container-task.sh` and the runner daemon. The spec requires agent behavior to sit behind typed adapter contracts.

## User Scenarios & Testing *(mandatory)*

This is contract boundary work. Scenarios use named technical actors.

### Technical Scenario 1 - Codex Adapter Generates Correct Commands (Priority: P1)

A runner maintainer can use the Codex adapter to generate the correct CLI invocation (command, args, env) for a given task prompt, working directory, and auth configuration, without the runner daemon constructing the command string manually.

**Why this priority**: Command construction is currently scattered across shell script and TypeScript. Centralizing it behind a typed contract makes it testable and replaceable.

**Independent Test**: Call the Codex adapter's `buildCommand` method with a prompt and config; verify it produces the correct `codex exec` command with flags and environment variables.

**Acceptance Scenarios**:

1. **Given** a Codex adapter with auth directory and prompt, **When** `buildCommand` is called, **Then** it returns a command array starting with `codex`, `exec`, with `--dangerously-bypass-approvals-and-sandbox`, `--cd`, and the prompt as the final argument.
2. **Given** the Codex adapter is configured with an auth directory, **When** `buildEnvironment` is called, **Then** it returns environment variables including the Codex auth directory path.
3. **Given** the Codex adapter is configured with a timeout, **When** `buildCommand` is called, **Then** the timeout is reflected in the command or environment.
4. **Given** the runner spills a large prompt to a workspace file, **When** the Codex adapter builds the command, **Then** it uses stdin-backed prompt transport instead of embedding the full prompt in argv.

---

### Technical Scenario 2 - Copilot Adapter Generates Correct Commands (Priority: P1)

A runner maintainer can use the Copilot adapter to generate the correct CLI invocation for a given task prompt, working directory, and token configuration, including sandbox directories and redaction flags.

**Why this priority**: Copilot has different auth (token-based), different sandbox setup (home/config/cache dirs), and different flags than Codex. A dedicated adapter captures these differences.

**Independent Test**: Call the Copilot adapter's `buildCommand` method with a prompt and config; verify it produces the correct `copilot` command with `--prompt`, `--allow-all`, `--no-ask-user`, and sandbox environment variables.

**Acceptance Scenarios**:

1. **Given** a Copilot adapter with token and prompt, **When** `buildCommand` is called, **Then** it returns a command array starting with `copilot` with `--prompt`, `--allow-all`, `--no-ask-user`, `--no-color`, `--stream off`.
2. **Given** the Copilot adapter is configured with sandbox directories, **When** `buildEnvironment` is called, **Then** it returns environment variables for HOME, XDG_CONFIG_HOME, XDG_CACHE_HOME, and COPILOT_CLI_CONFIG_DIR.
3. **Given** the Copilot adapter is configured with MCP deny rules, **When** `buildCommand` is called, **Then** the deny flags are included.
4. **Given** the runner spills a large prompt to a workspace file, **When** the Copilot adapter builds the command, **Then** it attaches the file and uses a short wrapper prompt instead of embedding the full task in argv.

---

### Technical Scenario 3 - Adapter Interface Is Agent-Agnostic (Priority: P1)

The agent adapter interface is generic: `buildCommand`, `buildEnvironment`, optional `buildExecutionOptions`, `parseOutput`, `isSuccess`. The runner daemon and workflow provider interact with the interface, not the Codex or Copilot implementation directly.

**Why this priority**: Constitution principle III requires providers to be replaceable boundaries. Agent adapters are no exception. A future adapter (e.g., Claude CLI) must plug in without changing the runner.

**Independent Test**: Register a stub adapter that satisfies the interface; have the runner use it; verify the runner calls `buildCommand` and `buildEnvironment` correctly.

**Acceptance Scenarios**:

1. **Given** the AgentAdapter interface defines `buildCommand`, `buildEnvironment`, optional `buildExecutionOptions`, `parseOutput`, and `isSuccess`, **When** a new adapter implements the interface, **Then** the runner can use it without code changes.
2. **Given** the runner selects an adapter by agent name, **When** the agent name is "codex", **Then** the Codex adapter is used; when "copilot", the Copilot adapter is used.
3. **Given** a startup module exports a valid adapter record, **When** the runner starts with that module configured, **Then** the new adapter is registered without editing runner source.

---

### Technical Scenario 4 - Adapter Output Is Parseable (Priority: P2)

The adapter interface includes `parseOutput` and `isSuccess` methods that interpret the agent's exit code and stdout/stderr to determine whether the agent succeeded, failed, or produced an error that should be surfaced.

**Why this priority**: Output parsing is currently implicit (the shell script checks exit codes). Making it explicit and typed enables better error reporting and future retry logic.

**Independent Test**: Call `parseOutput` with a known Codex exit code and stderr; verify it returns a structured result with success/failure and error message.

**Acceptance Scenarios**:

1. **Given** the agent exits with code 0, **When** `isSuccess` is called, **Then** it returns true.
2. **Given** the agent exits with a non-zero code and stderr, **When** `parseOutput` is called, **Then** it returns a structured result with the error message extracted from stderr.

---

### Edge Cases

- What if a new agent type is requested that has no adapter? The long-term requirement remains a clear "unsupported agent" error at task claim time, but this is explicitly deferred out of the current MVP slices.
- What if the adapter generates a command that exceeds OS argument limits? The runner should spill large prompts to a workspace file and let the adapter choose file/stdin-backed transport.
- What if the agent produces unexpected output format? `parseOutput` should be defensive and return a best-effort result rather than crashing.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The AgentAdapter interface MUST define `buildCommand`, `buildEnvironment`, `parseOutput`, and `isSuccess` methods, and MAY define `buildExecutionOptions` for shell transport hints such as stdin-backed prompt files.
- **FR-002**: The CodexAdapter MUST implement the interface with Codex-specific command generation, auth, and output parsing.
- **FR-003**: The CopilotAdapter MUST implement the interface with Copilot-specific command generation, sandbox, and output parsing.
- **FR-004**: The runner daemon MUST select adapters by agent name and use the interface methods instead of hardcoded commands.
- **FR-005**: The `container-task.sh` agent invocation section MUST delegate to the adapter (or be retired by 005-workflow-blueprint).
- **FR-006**: Adapter inputs and outputs MUST use Zod-validated schemas.
- **FR-007**: Unsupported agent names MUST produce a clear error at task claim time. This behavior is explicitly deferred out of the current MVP execution slices and remains a follow-up requirement.
- **FR-008**: The runner MUST support startup-loaded adapter modules so new adapters can be registered without modifying built-in runner source.
- **FR-009**: The runner and adapters MUST support file-backed prompt transport when task prompts exceed safe argv limits.

### Key Entities

- **AgentAdapter**: Interface with `buildCommand`, `buildEnvironment`, optional `buildExecutionOptions`, `parseOutput`, `isSuccess`.
- **CodexAdapter**: Implementation for Codex CLI (auth dir, flags, output parsing).
- **CopilotAdapter**: Implementation for Copilot CLI (token auth, sandbox dirs, deny flags, output parsing).
- **AdapterRegistry**: Maps agent names to adapter implementations.
- **AgentExecutionRequest**: Typed adapter input with `prompt`, optional `promptFilePath`, and `workingDirectory`.
- **AgentExecutionOptions**: Optional execution hints such as `stdinFilePath` for file-backed prompt transport.
- **AgentResult**: Structured output from `parseOutput`: success/failure, error message, metadata.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The runner daemon uses typed adapter contracts instead of hardcoded agent commands.
- **SC-002**: A new agent adapter can be startup-registered and used without modifying the runner daemon source.
- **SC-003**: Codex and Copilot command generation is unit-testable without running the actual CLI.
- **SC-004**: The `packages/agent-adapters` package exports real functionality, not just a name.
- **SC-005**: Oversized prompts are transported without depending on argv-only delivery.
