import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import { z } from 'zod';

const exec = promisify(execFile);

const PROHIBITED_ARGUMENT = /^(--config|--output|--output-dir|--file|--download)/;

/**
 * Session-scoped workload capabilities granted by the Control Plane. A command is only
 * reachable when its capability was granted to this Session; anything else is refused, so
 * the sandbox can never drive an operation the Execution Context did not authorize.
 */
const CAPABILITY_NAMES = new Set([
  'context:read',
  'task-status:read',
  'task-status:transition',
  'workflow:read',
  'workflow:transition',
  'workflow:projection:read',
  'workflow:projection:report',
]);

/** Read-mostly workload surface plus the scoped status report the Standard Prompt requires. */
const COMMAND_CAPABILITIES = [
  { argv: ['whoami'], capability: null },
  { argv: ['context', 'get'], capability: 'context:read' },
  { argv: ['task', 'status', 'get'], capability: 'task-status:read' },
  { argv: ['workflow', 'current'], capability: 'workflow:read' },
  { argv: ['workflow', 'current', '--json'], capability: 'workflow:read' },
  { argv: ['workflow', 'help'], capability: null },
];

const TASK_STATUS_VALUES = new Set(['blocked', 'in_progress']);
const TASK_STATUS_FLAGS = new Set(['--expected-revision', '--idempotency-key', '--note']);
const WORKFLOW_TRANSITION_FLAGS = new Set(['--expected-revision', '--command-id']);

/** Environment keys the host CLI may inherit. Credentials and the daemon's own env stay out. */
const CLIENT_ENVIRONMENT_KEYS = ['PATH', 'HOME', 'TMPDIR'];

function requiredCapability(args) {
  for (const command of COMMAND_CAPABILITIES) {
    if (command.argv.length === args.length && command.argv.every((token, index) => token === args[index])) {
      return command.capability;
    }
  }
  if (args[0] === 'task' && args[1] === 'status' && args[2] === 'set') {
    return 'task-status:transition';
  }
  if (args[0] === 'workflow' && args[1] === 'transition') {
    return 'workflow:transition';
  }
  return undefined;
}

/**
 * `task status set <blocked|in_progress> [--expected-revision N] [--idempotency-key K] [--note TEXT]`
 * with flag/value pairs only; the CLI validates the domain rules (blocked requires a note).
 */
function isTaskStatusSet(args) {
  if (args[0] !== 'task' || args[1] !== 'status' || args[2] !== 'set') return false;
  const [status, ...flags] = args.slice(3);
  if (typeof status !== 'string' || !TASK_STATUS_VALUES.has(status)) return false;
  if (flags.length % 2 !== 0) return false;
  for (let index = 0; index < flags.length; index += 2) {
    if (!TASK_STATUS_FLAGS.has(flags[index]) || flags[index + 1] === undefined) return false;
  }
  return true;
}

/**
 * `workflow transition <action-id> --expected-revision <n> [--command-id <uuid>] [--json]`.
 * Only the CLI's documented transition grammar crosses the host binding.
 */
function isWorkflowTransition(args) {
  if (args[0] !== 'workflow' || args[1] !== 'transition') return false;
  const [actionId, ...flags] = args.slice(2);
  if (typeof actionId !== 'string' || actionId.length === 0 || actionId.startsWith('--')) return false;
  const seen = new Set();
  for (let index = 0; index < flags.length; index += 1) {
    const flag = flags[index];
    if (flag === '--json') {
      if (seen.has(flag)) return false;
      seen.add(flag);
      continue;
    }
    const value = flags[index + 1];
    if (!WORKFLOW_TRANSITION_FLAGS.has(flag) || value === undefined || value.startsWith('--') || seen.has(flag)) return false;
    seen.add(flag);
    index += 1;
  }
  return true;
}

function clientEnvironment({ controlPlaneUrl, executionCode, guestWorkspaceDirectory }) {
  const environment = {
    NO_COLOR: '1',
    MYSTRA_CONTROL_PLANE_URL: controlPlaneUrl,
    MYSTRA_EXECUTION_CODE: executionCode,
    MYSTRA_WORKSPACE_ROOT: guestWorkspaceDirectory,
  };
  for (const key of CLIENT_ENVIRONMENT_KEYS) {
    const value = process.env[key];
    if (value) environment[key] = value;
  }
  return environment;
}

export function mystraBinding({ agentPath, controlPlaneUrl, executionCode, capabilities, workspaceDirectory, guestWorkspaceDirectory }) {
  if (!agentPath) throw new Error('Host Runtime must provide the mystra-agent CLI path');
  if (!controlPlaneUrl) throw new Error('Host Runtime must provide MYSTRA_CONTROL_PLANE_URL');
  if (!executionCode) throw new Error('Host Runtime must provide MYSTRA_EXECUTION_CODE');
  if (typeof workspaceDirectory !== 'string' || !path.isAbsolute(workspaceDirectory)) {
    throw new Error('Host Runtime must provide the absolute Task Workspace directory');
  }
  if (typeof guestWorkspaceDirectory !== 'string' || !path.posix.isAbsolute(guestWorkspaceDirectory)) {
    throw new Error('Host Runtime must provide the absolute guest Task Workspace directory');
  }
  const granted = new Set((Array.isArray(capabilities) ? capabilities : []).filter((name) => CAPABILITY_NAMES.has(name)));

  const redact = (value) => String(value ?? '').split(executionCode).join('[REDACTED]');

  return {
    name: 'mystra',
    description: 'Run the Runtime-provided mystra-agent workload CLI on the host; the execution code never enters the guest.',
    bindings: {
      run: {
        description: 'Execute mystra-agent with an argv array, without shell expansion. Returns exitCode, stdout, stderr.',
        inputSchema: z.object({ args: z.array(z.string().max(10000)).min(1).max(20) }),
        execute: async ({ args }) => {
          const capability = requiredCapability(args);
          if (capability === undefined) throw new Error(`Command is not permitted for this Runtime: ${args.join(' ')}`);
          if (args[0] === 'task' && args[1] === 'status' && args[2] === 'set' && !isTaskStatusSet(args)) {
            throw new Error('Task status report is malformed');
          }
          if (args[0] === 'workflow' && args[1] === 'transition' && !isWorkflowTransition(args)) {
            throw new Error('Workflow transition is malformed');
          }
          if (capability !== null && !granted.has(capability)) {
            throw new Error(`Session capability ${capability} is not granted for this Runtime`);
          }
          if (args.some((arg) => PROHIBITED_ARGUMENT.test(arg) || arg.includes('\0'))) {
            throw new Error('Host file and output arguments are not permitted');
          }
          try {
            // cwd is the Task Workspace on the host: `context get` reports the workspace the
            // guest actually writes to, and Workflow Skill materialization lands in that same
            // directory instead of the Runner daemon's own working directory.
            const result = await exec(agentPath, args, {
              cwd: workspaceDirectory,
              env: clientEnvironment({ controlPlaneUrl, executionCode, guestWorkspaceDirectory }),
              timeout: 45000,
              maxBuffer: 4 * 1024 * 1024,
            });
            return { exitCode: 0, stdout: redact(result.stdout), stderr: redact(result.stderr) };
          } catch (error) {
            if (typeof error.code === 'number') {
              return { exitCode: error.code, stdout: redact(error.stdout), stderr: redact(error.stderr) };
            }
            throw new Error(redact(error.message));
          }
        },
        timeout: 50000,
      },
    },
  };
}
