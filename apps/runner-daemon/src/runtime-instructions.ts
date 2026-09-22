import type { RuntimeType } from "@mystra/shared";

/**
 * Concrete command forms declared by each Runtime type for its workload CLI invocation.
 *
 * Measured platform fact: In the AgentOS guest, `node` exists only as a 32-byte kernel command
 * stub, never as an executable file. Any `execve` chain through a shebang or `sh` wrapper fails
 * with `Exec format error` or `command not found: node` (exit 126/127). Only the Agent's own shell
 * resolves `node`. Hence AgentOS requires `node "$MYSTRA_AGENT_PATH" <args>`, whereas Host Runtime
 * uses direct `"$MYSTRA_AGENT_PATH" <args>`.
 */
export const RUNTIME_WORKLOAD_INSTRUCTIONS: Readonly<Record<RuntimeType, string>> = Object.freeze({
  host: [
    "Workload CLI commands for this Host Runtime must be executed directly via MYSTRA_AGENT_PATH:",
    '- Read task context: "$MYSTRA_AGENT_PATH" context get',
    '- Read task status: "$MYSTRA_AGENT_PATH" task status get',
    '- Report task status: "$MYSTRA_AGENT_PATH" task status set <in_progress|blocked> --expected-revision <number> [--note <text>]',
    '- Read workflow current stage: "$MYSTRA_AGENT_PATH" workflow current',
    '- Transition workflow stage: "$MYSTRA_AGENT_PATH" workflow transition <action-id>',
    "Do not build or invoke a Workspace copy of mystra-agent.",
  ].join("\n"),

  agentos: [
    "Workload CLI commands for this AgentOS Runtime must be invoked with node via MYSTRA_AGENT_PATH:",
    '- Read task context: node "$MYSTRA_AGENT_PATH" context get',
    '- Read task status: node "$MYSTRA_AGENT_PATH" task status get',
    '- Report task status: node "$MYSTRA_AGENT_PATH" task status set <in_progress|blocked> --expected-revision <number> [--note <text>]',
    '- Read workflow current stage: node "$MYSTRA_AGENT_PATH" workflow current',
    '- Transition workflow stage: node "$MYSTRA_AGENT_PATH" workflow transition <action-id>',
    "Do not build or invoke a Workspace copy of mystra-agent.",
  ].join("\n"),
});

export function resolveRuntimeWorkloadInstruction(runtimeType: RuntimeType): string {
  const instruction = RUNTIME_WORKLOAD_INSTRUCTIONS[runtimeType];
  if (!instruction) {
    throw new Error(`Unknown runtime type for workload instruction: ${String(runtimeType)}`);
  }
  return instruction;
}
