import { existsSync } from 'node:fs';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AgentOs } from '@rivet-dev/agentos-core';
import pi from '@agentos-software/pi';
import { mystraBinding } from './mystra-binding.mjs';

function positiveSecondsEnvironment(name, fallback) {
  const value = process.env[name];
  if (value === undefined) return fallback;
  if (!/^[1-9]\d*$/.test(value)) throw new Error(`${name} must be a positive integer`);
  return Number(value);
}

const DEADLINE_SECONDS = positiveSecondsEnvironment('MYSTRA_AGENTOS_DEADLINE_SECONDS', 900);
const IDLE_SECONDS = positiveSecondsEnvironment('MYSTRA_AGENTOS_IDLE_SECONDS', 180);
const IDLE_POLL_MS = 15_000;
/** Bounded guest-side capability probe; a wedged shell must not hold the Session open. */
const BINDING_CHECK_TIMEOUT_MS = 30_000;
/** Binding collection name; becomes the guest command `agentos-mystra`. */
const MYSTRA_BINDING_COLLECTION = 'mystra';
const STATE_ROOT = process.env.MYSTRA_AGENTOS_SESSION_STATE_ROOT ?? '/root/.mystra/agentos-sessions';
const MODEL_CONFIG_PATH = process.env.MYSTRA_AGENTOS_MODEL_CONFIG ?? '/opt/agentos/task-config.json';
const GUEST_BIN_DIRECTORY = process.env.MYSTRA_AGENTOS_GUEST_BIN
  ?? path.join(path.dirname(fileURLToPath(import.meta.url)), 'guest-bin');

// Guest-visible layout. The host Runtime owns a single writable Task Workspace and a
// read-only workload CLI projection; the guest never sees a host path.
const GUEST_WORKSPACE = '/home/agentos/workspace';
const GUEST_BIN_MOUNT = '/usr/local/sbin';
const GUEST_AGENT_CONFIG = '/home/agentos/.pi/agent';
const GUEST_MODEL_CONFIG = `${GUEST_AGENT_CONFIG}/models.json`;
const GUEST_WORKSPACE_EXTENSIONS = `${GUEST_WORKSPACE}/.pi/extensions`;
const GUEST_WORKLOAD_CLI = `${GUEST_BIN_MOUNT}/mystra-agent`;
const SESSION_MODES = new Set(['start', 'continue']);

function requireSessionScopedCapability(input) {
  const missing = [];
  if (!input.agentPath) missing.push('MYSTRA_AGENT_PATH');
  if (!input.controlPlaneUrl) missing.push('MYSTRA_CONTROL_PLANE_URL');
  if (!input.executionCode) missing.push('MYSTRA_EXECUTION_CODE');
  if (missing.length > 0) {
    throw new Error(`AgentOS Pi requires the Session-scoped workload capability; missing ${missing.join(', ')}`);
  }
  if (!Array.isArray(input.capabilities) || input.capabilities.length === 0) {
    throw new Error('AgentOS Pi requires the Session-scoped workload capabilities; none were granted');
  }
  if (typeof input.workspaceDirectory !== 'string' || !path.isAbsolute(input.workspaceDirectory)) {
    throw new Error('AgentOS Pi requires an absolute Task Workspace directory');
  }
  if (!existsSync(path.join(GUEST_BIN_DIRECTORY, 'mystra-agent'))) {
    throw new Error(`AgentOS Pi workload CLI projection is missing from ${GUEST_BIN_DIRECTORY}`);
  }
}

function requireModelConfig(config) {
  const model = config?.model;
  const fields = ['provider', 'baseUrl', 'api', 'apiKey', 'id'];
  if (model === null || typeof model !== 'object' || fields.some((field) => typeof model[field] !== 'string' || model[field].length === 0)) {
    throw new Error('AgentOS Pi model configuration is incomplete');
  }
  return model;
}

/** Race a session call against the bounded deadline without leaking a rejected loser. */
function bounded(promise, aborted) {
  promise.catch(() => {});
  return Promise.race([promise, aborted]);
}

const CANCEL_GRACE_MS = 10_000;
const DISPOSE_GRACE_MS = 30_000;

/**
 * Await a cleanup call for at most `graceMs`. Cleanup must be bounded: a wedged cancel or
 * dispose cannot be allowed to hold the Runtime slot indefinitely. Rejections still
 * propagate unless the grace window expired, in which case `fallback` is returned.
 */
async function withinGrace(promise, graceMs, fallback) {
  promise.catch(() => {});
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((resolve) => {
        timer = setTimeout(() => resolve(fallback), graceMs);
        timer.unref?.();
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * AgentOS matches a pattern-scope rule against the canonical resource string, not the bare
 * host: an outbound HTTPS request is `tcp://<hostname>:<port>`. A host-only pattern such as
 * `example.com` never matches and silently denies every request (verified against
 * agentos-core 0.2.19 locally and on host-c1). The model endpoint is the single approved
 * egress destination; `default: "deny"` blocks everything else.
 */
export function permissionsForModelEndpoint(baseUrl) {
  let endpoint;
  try {
    endpoint = new URL(baseUrl);
  } catch {
    throw new Error('AgentOS Pi model baseUrl must be an absolute URL');
  }
  if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password) {
    throw new Error('AgentOS Pi model baseUrl must be HTTPS and must not contain credentials');
  }
  return {
    // AgentOS Core 0.2.19 forwards a supplied policy verbatim; it does not merge omitted
    // scopes with its documented defaults, so every scope is stated explicitly.
    fs: 'allow',
    childProcess: 'allow',
    process: 'allow',
    env: 'allow',
    binding: 'allow',
    network: {
      default: 'deny',
      rules: [
        { mode: 'allow', operations: ['*'], patterns: [`tcp://${endpoint.hostname}:${endpoint.port || '443'}`] },
      ],
    },
  };
}

async function configurePiModel(vm, model, onLog) {
  await vm.filesystem.writeFile(GUEST_MODEL_CONFIG, JSON.stringify({
    providers: {
      [model.provider]: {
        baseUrl: model.baseUrl,
        api: model.api,
        apiKey: model.apiKey,
        models: [{
          id: model.id,
          name: model.id,
          input: ['text'],
          contextWindow: 128000,
          maxTokens: 8192,
          ...(model.definition ?? {}),
        }],
      },
    },
  }));
  await vm.filesystem.writeFile(`${GUEST_AGENT_CONFIG}/settings.json`, JSON.stringify({
    defaultProvider: model.provider,
    defaultModel: model.id,
    defaultThinkingLevel: 'off',
  }));
  onLog(`[agentos-pi] guest model configured: ${model.provider}/${model.id}`);
}

/**
 * Fail closed when the durable conversation cannot be proven restored. Pi advertises no
 * native session load, so the only supported recovery is the sidecar restoring the
 * caller-owned AgentOS session id from the same SQLite database; replaying a transcript
 * ourselves is explicitly not a fallback.
 */
async function assertSessionRestored(vm, sessionId, mode, aborted) {
  const info = await bounded(vm.sessions.get({ sessionId }), aborted);
  if (!info || info.sessionId !== sessionId) {
    throw new Error(`AgentOS Pi could not restore Session ${sessionId}: the durable session is unknown`);
  }
  if (mode === 'continue' && !(info.latestSequence > 0)) {
    throw new Error(
      `AgentOS Pi could not restore Session ${sessionId}: no durable conversation was recovered`,
    );
  }
  return info;
}

/**
 * FR-006 requires the sandboxed Agent to reach its Session-scoped capability through the
 * Runtime-provided workload CLI. AgentOS projects `agentos` / `agentos-<collection>` command
 * stubs into the guest, but agentos-core 0.2.19 dispatches them only through the host-side
 * `execFile` path: inside the guest the shell answers `command not found` (measured on
 * host-c1, exit 127). A Session that silently lost every capability call would look
 * successful while never reporting status, so the guest channel is verified before any
 * model credential is written and the Session fails closed with the measured reason.
 */
async function assertGuestWorkloadBinding(vm, onLog, aborted) {
  const result = await bounded(
    vm.process.exec('agentos list-bindings', {
      timeoutMs: BINDING_CHECK_TIMEOUT_MS,
      output: { capture: 'all' },
    }),
    aborted,
  );
  const stdout = String(result?.stdout ?? '');
  if (result?.exitCode !== 0 || !stdout.includes(`"${MYSTRA_BINDING_COLLECTION}"`)) {
    throw new Error(
      `AgentOS Pi cannot reach the Runtime-provided workload binding from inside the guest`
      + ` (agentos list-bindings exit ${result?.exitCode ?? 'unknown'}); this Session would run`
      + ' without its Session-scoped capability',
    );
  }
  onLog('[agentos-pi] guest workload binding reachable');
}

async function cancelActivePrompt(vm, sessionId, onLog) {
  try {
    const result = await withinGrace(vm.sessions.cancelPrompt({ sessionId }), CANCEL_GRACE_MS, null);
    onLog(`[agentos-pi] cancel requested: ${result?.status ?? 'no confirmation within the grace window'}`);
  } catch (error) {
    onLog(`[agentos-pi] cancel warning: ${error?.message ?? error}`);
  }
}

export async function runPiInAgentOs({
  workspaceDirectory,
  userMessage,
  systemPrompt,
  sessionId,
  mode,
  agentPath,
  controlPlaneUrl,
  executionCode,
  capabilities,
  stateRoot = STATE_ROOT,
  modelConfigPath = MODEL_CONFIG_PATH,
  onLog = console.log,
}) {
  if (typeof sessionId !== 'string' || sessionId.length === 0) {
    throw new Error('AgentOS Pi requires an explicit Session id');
  }
  if (!SESSION_MODES.has(mode)) {
    throw new Error(`AgentOS Pi requires a start|continue Session mode, received ${String(mode)}`);
  }
  if (typeof userMessage !== 'string' || userMessage.trim().length === 0) {
    throw new Error('AgentOS Pi requires a non-empty user message');
  }
  const workload = { agentPath, controlPlaneUrl, executionCode, capabilities, workspaceDirectory };
  requireSessionScopedCapability(workload);

  const config = JSON.parse(await readFile(modelConfigPath, 'utf8'));
  const model = requireModelConfig(config);

  // The durable Session database lives OUTSIDE the task repository working tree, so a
  // rebuilt sandbox resumes the exact conversation without polluting the repository.
  const stateDirectory = path.join(stateRoot, sessionId);
  const databasePath = path.join(stateDirectory, 'session.sqlite');
  if (mode === 'continue' && !existsSync(databasePath)) {
    throw new Error(
      `AgentOS Pi cannot continue Session ${sessionId}: durable conversation state ${databasePath} is missing`,
    );
  }
  await mkdir(stateDirectory, { recursive: true, mode: 0o700 });

  // The guest has no route to the Control Plane and no execution code. The host Runtime
  // exposes its workload CLI as a binding and mounts the wrapper read-only where the guest
  // PATH resolves it; only the non-secret CLI path travels into the durable session env.
  const bindings = [mystraBinding({ ...workload, guestWorkspaceDirectory: GUEST_WORKSPACE })];
  const mounts = [
    {
      path: GUEST_WORKSPACE,
      readOnly: false,
      plugin: { id: 'host_dir', config: { hostPath: workspaceDirectory, readOnly: false } },
    },
    // Pi 0.2.7 auto-loads Workspace `.pi/extensions` while opening a Session. Shadow
    // that path with an empty read-only mount so repository content cannot execute
    // while the ephemeral model credential is present.
    {
      path: GUEST_WORKSPACE_EXTENSIONS,
      readOnly: true,
      plugin: { id: 'memory', config: {} },
    },
    // Model credentials live only in this ephemeral mount. They never enter the
    // durable Session SQLite database, process env, argv, Workspace, or events.
    {
      path: GUEST_AGENT_CONFIG,
      readOnly: false,
      plugin: { id: 'memory', config: {} },
    },
    {
      path: GUEST_BIN_MOUNT,
      readOnly: true,
      plugin: { id: 'host_dir', config: { hostPath: GUEST_BIN_DIRECTORY, readOnly: true } },
    },
  ];

  onLog(`[agentos-pi] creating AgentOs VM; workspace=${workspaceDirectory} sessionDb=${databasePath}`);
  let abort;
  const aborted = new Promise((_, reject) => { abort = reject; });
  // A deadline can fire before the prompt await attaches; keep it from becoming unhandled.
  aborted.catch(() => {});
  const deadline = setTimeout(
    () => abort(new Error('AgentOS Pi deadline exceeded')),
    DEADLINE_SECONDS * 1000,
  );
  let idleTimer;
  let response;
  // Armed before VM creation: a sidecar wedged during create/config would otherwise hold the
  // dispatch lease until it expires, since no session call would ever be raced.
  let vm;

  try {
    vm = await bounded(AgentOs.create({
      software: [pi],
      database: { type: 'sqlite_file', path: databasePath },
      bindings,
      mounts,
      permissions: permissionsForModelEndpoint(model.baseUrl),
    }), aborted);
    await assertGuestWorkloadBinding(vm, onLog, aborted);
    await bounded(configurePiModel(vm, model, onLog), aborted);

    onLog(`[agentos-pi] opening ${mode} pi session ${sessionId} in ${GUEST_WORKSPACE}`);
    await bounded(vm.sessions.open({
      sessionId,
      agent: 'pi',
      cwd: GUEST_WORKSPACE,
      // AgentOS persists this env in the durable session record and reapplies it on
      // restore: non-secret, guest-visible values only.
      env: { MYSTRA_AGENT_PATH: GUEST_WORKLOAD_CLI },
      permissionPolicy: 'allow_all',
      additionalInstructions: systemPrompt,
    }), aborted);
    // `sessions.open` loads Pi's model registry. Remove the only guest-readable copy
    // before any caller-controlled prompt can run; failure to remove it fails closed.
    await bounded(vm.filesystem.remove(GUEST_MODEL_CONFIG), aborted);
    onLog('[agentos-pi] ephemeral model credential removed before prompt');
    const restored = await assertSessionRestored(vm, sessionId, mode, aborted);
    onLog(`[agentos-pi] session ready: cwd=${restored.cwd} durableEvents=${restored.latestSequence}`);

    // Only an adapter-reported "running" session counts as agent work. A failed session is
    // an immediate failure; the idle bound is reserved for a genuinely wedged adapter.
    let lastActive = Date.now();
    idleTimer = setInterval(() => {
      void (async () => {
        let info;
        try {
          info = await vm.sessions.get({ sessionId });
        } catch {
          // A failed status probe is not evidence of progress.
          return;
        }
        const status = info?.state?.status;
        if (status === 'running') {
          lastActive = Date.now();
          return;
        }
        if (status === 'failed') {
          abort(new Error(`AgentOS Pi session failed: ${info.state.error?.message ?? 'unknown error'}`));
          return;
        }
        if (status === 'waiting') {
          abort(new Error('AgentOS Pi session is blocked on an unresolved permission request'));
          return;
        }
        if (Date.now() - lastActive >= IDLE_SECONDS * 1000) {
          abort(new Error('AgentOS Pi idle timeout'));
        }
      })();
    }, IDLE_POLL_MS);

    onLog('[agentos-pi] prompting agent');
    response = await bounded(
      vm.sessions.prompt({ sessionId, content: [{ type: 'text', text: userMessage }] }),
      aborted,
    );
  } catch (error) {
    // A failure before the VM existed has nothing to cancel and nothing to dispose.
    if (vm) await cancelActivePrompt(vm, sessionId, onLog);
    throw error;
  } finally {
    clearTimeout(deadline);
    clearInterval(idleTimer);
    if (vm) {
      try {
        // Releases this VM's lease only. The AgentOS sidecar is process-global and shared by
        // every concurrent Session in this daemon; disposing it here would kill its siblings.
        if (await withinGrace(vm.dispose(), DISPOSE_GRACE_MS, null) === null) {
          onLog('[agentos-pi] vm dispose did not confirm within the grace window');
        }
      } catch (error) {
        onLog(`[agentos-pi] vm dispose warning: ${error?.message ?? error}`);
      }
    }
  }

  const stopReason = response.stopReason;
  // The content array holds ONE text block per streamed delta, so the deltas concatenate
  // without separators; joining with a newline corrupts every operator-visible message.
  const messageText = (response.message?.content ?? [])
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join('');
  onLog(`[agentos-pi] agent finished: ${stopReason}`);

  if (stopReason !== 'end_turn') {
    return {
      success: false,
      stopReason,
      message: messageText,
      providerSessionId: sessionId,
      errorMessage: `AgentOS Pi stopped with ${stopReason}`,
    };
  }
  return { success: true, stopReason, message: messageText, providerSessionId: sessionId };
}
