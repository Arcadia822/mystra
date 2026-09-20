#!/usr/bin/env node

// `--version` must not need the AgentOS SDK to load, so identity is resolved by a
// dependency-free module and the runner is imported only on the execution path.
import { agentosRuntimeIdentity } from "./agentos-runtime-info.mjs";

// Required by the Provider session contract in @mystra/agent-adapters/session.ts.
const SESSION_ID_ENVIRONMENT_KEY = "MYSTRA_SESSION_ID";
const SESSION_MODE_ENVIRONMENT_KEY = "MYSTRA_SESSION_MODE";
const SESSION_SYSTEM_PROMPT_ENVIRONMENT_KEY = "MYSTRA_SESSION_SYSTEM_PROMPT";
const AGENT_PATH_ENVIRONMENT_KEY = "MYSTRA_AGENT_PATH";
const CONTROL_PLANE_URL_ENVIRONMENT_KEY = "MYSTRA_CONTROL_PLANE_URL";
const EXECUTION_CODE_ENVIRONMENT_KEY = "MYSTRA_EXECUTION_CODE";
const WORKLOAD_CAPABILITIES_ENVIRONMENT_KEY = "MYSTRA_WORKLOAD_CAPABILITIES";

function fail(message, exitCode) {
  process.stderr.write(`${message}\n`);
  process.exit(exitCode);
}

// The first message is caller-controlled text and may itself start with a dash, so argv is
// split explicitly: only `--cd <directory>` is an option, everything else is the message.
const argv = process.argv.slice(2);

if (argv[0] === "--version" || argv[0] === "-v") {
  // Resolved from the packages actually installed next to this shim. An unresolvable
  // manifest is a real failure; the Runtime never prints an unproven version claim.
  try {
    const { agentosCore, pi } = agentosRuntimeIdentity();
    process.stdout.write(`pi ${pi.version} (${pi.name}) agentos-core ${agentosCore.version} (${agentosCore.name})\n`);
    process.exit(0);
  } catch (error) {
    fail(`AgentOS Pi runtime identity is unavailable: ${error?.message ?? error}`, 1);
  }
}

let workingDirectory = process.cwd();
let userMessage = "";
for (let index = 0; index < argv.length; index += 1) {
  const token = argv[index];
  if (token === "--cd") {
    const directory = argv[index + 1];
    if (directory === undefined) fail("AgentOS Pi shim requires a directory after --cd", 2);
    workingDirectory = directory;
    index += 1;
    continue;
  }
  if (userMessage.length === 0) userMessage = token;
}

const sessionId = process.env[SESSION_ID_ENVIRONMENT_KEY] ?? "";
const mode = process.env[SESSION_MODE_ENVIRONMENT_KEY] ?? "";
const systemPrompt = process.env[SESSION_SYSTEM_PROMPT_ENVIRONMENT_KEY];
const capabilities = (process.env[WORKLOAD_CAPABILITIES_ENVIRONMENT_KEY] ?? "")
  .split(",")
  .map((capability) => capability.trim())
  .filter((capability) => capability.length > 0);

try {
  const { runPiInAgentOs } = await import("./agentos-runner.mjs");
  const result = await runPiInAgentOs({
    workspaceDirectory: workingDirectory,
    userMessage,
    systemPrompt,
    sessionId,
    mode,
    agentPath: process.env[AGENT_PATH_ENVIRONMENT_KEY],
    controlPlaneUrl: process.env[CONTROL_PLANE_URL_ENVIRONMENT_KEY],
    executionCode: process.env[EXECUTION_CODE_ENVIRONMENT_KEY],
    capabilities,
    onLog: (message) => process.stderr.write(`${message}\n`),
  });

  if (!result.success) {
    process.stderr.write(`AgentOS Pi run failed: ${result.errorMessage ?? result.stopReason ?? "unknown"}\n`);
    process.exit(1);
  }

  process.stdout.write(`${result.message}\n`);
  process.exit(0);
} catch (error) {
  const message = error?.message ?? String(error);
  process.stderr.write(`AgentOS Pi execution failed: ${message}\n`);
  const bounded = message.includes("deadline") || message.includes("idle timeout");
  process.exit(bounded ? 124 : 1);
}
