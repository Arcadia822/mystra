import { existsSync } from 'node:fs';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AgentOs } from '@rivet-dev/agentos-core';
import pi from '@agentos-software/pi';

function positiveSecondsEnvironment(name, fallback) {
  const value = process.env[name];
  if (value === undefined) return fallback;
  if (!/^[1-9]\d*$/.test(value)) throw new Error(`${name} must be a positive integer`);
  return Number(value);
}

const DEADLINE_SECONDS = positiveSecondsEnvironment('MYSTRA_AGENTOS_DEADLINE_SECONDS', 900);
const IDLE_SECONDS = positiveSecondsEnvironment('MYSTRA_AGENTOS_IDLE_SECONDS', 180);
const IDLE_POLL_MS = 15_000;
/** Bounded guest-side capability probe; a wedged process must not hold the Session open. */
const WORKLOAD_PROBE_TIMEOUT_MS = 30_000;
const STATE_ROOT = process.env.MYSTRA_AGENTOS_SESSION_STATE_ROOT ?? '/root/.mystra/agentos-sessions';
const MODEL_CONFIG_PATH = process.env.MYSTRA_AGENTOS_MODEL_CONFIG ?? '/opt/agentos/task-config.json';
/**
 * Host directory holding the bundled workload CLI that is projected read-only into the
 * guest. Default resolves beside the deployed adapter (`<package>/dist/agentos`); a
 * deployment may override it with `MYSTRA_AGENTOS_GUEST_CLI_DIR`.
 */
function guestCliDirectory() {
  return process.env.MYSTRA_AGENTOS_GUEST_CLI_DIR
    ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../dist/agentos');
}
const GUEST_CLI_BUNDLE_NAME = 'mystra-agent.cjs';

// Guest-visible layout. The host Runtime owns a single writable Task Workspace, a
// read-only workload CLI projection, and one guest-reachable Control Plane origin.
const GUEST_WORKSPACE = '/home/agentos/workspace';
const GUEST_CLI_MOUNT = '/opt/mystra-agent-cli';
const GUEST_AGENT_CONFIG = '/home/agentos/.pi/agent';
const GUEST_MODEL_CONFIG = `${GUEST_AGENT_CONFIG}/models.json`;
const GUEST_WORKSPACE_EXTENSIONS = `${GUEST_WORKSPACE}/.pi/extensions`;
const GUEST_WORKLOAD_CLI = `${GUEST_CLI_MOUNT}/${GUEST_CLI_BUNDLE_NAME}`;
/**
 * Guest-local copy of the bundle. The AgentOS `host_dir` projection does not reliably carry
 * the executable bit across VM instances (measured on host-c1: the same read-only
 * projection executed in one VM and failed with exit 126 in the next), and a read-only
 * projection cannot be chmod'ed in place. Each VM therefore gets its own copy with an
 * explicit mode before any credential exists or any prompt is dispatched.
 */
const GUEST_CLI_LOCAL = '/tmp/mystra-agent-cli/mystra-agent.cjs';
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
  const bundle = path.join(guestCliDirectory(), GUEST_CLI_BUNDLE_NAME);
  if (!existsSync(bundle)) {
    throw new Error(
      `AgentOS Pi workload CLI bundle is missing from ${bundle};`
      + ' build it with the runner-daemon "build:agentos-cli" script',
    );
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
 * host: an outbound request is `tcp://<hostname>:<port>`. A host-only pattern such as
 * `example.com` never matches and silently denies every request (verified against
 * agentos-core 0.2.19 locally and on host-c1). Only the model, Control Plane, and
 * explicitly configured Taco origin are approved; `default: "deny"` blocks everything else.
 */
export function permissionsForEndpoints(modelBaseUrl, controlPlaneUrl, tacoHostUrl) {
  let model;
  try {
    model = new URL(modelBaseUrl);
  } catch {
    throw new Error('AgentOS Pi model baseUrl must be an absolute URL');
  }
  if (model.protocol !== 'https:' || model.username || model.password) {
    throw new Error('AgentOS Pi model baseUrl must be HTTPS and must not contain credentials');
  }
  const controlPlane = new URL(controlPlaneUrl);
  if (controlPlane.protocol !== 'http:' && controlPlane.protocol !== 'https:') {
    throw new Error('AgentOS Pi Control Plane URL must be HTTP or HTTPS');
  }
  if (controlPlane.username || controlPlane.password) {
    throw new Error('AgentOS Pi Control Plane URL must not contain credentials');
  }
  let taco;
  if (tacoHostUrl !== undefined) {
    try {
      taco = new URL(tacoHostUrl);
    } catch {
      throw new Error('AgentOS Taco host must be a HTTPS origin');
    }
    if (taco.protocol !== 'https:' || taco.username || taco.password
      || taco.pathname !== '/' || taco.search || taco.hash
      || !/^[a-z0-9.-]+$/i.test(taco.hostname)) {
      throw new Error('AgentOS Taco host must be a HTTPS origin without credentials, path, query, fragment, or wildcards');
    }
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
        { mode: 'allow', operations: ['*'], patterns: [`tcp://${model.hostname}:${model.port || '443'}`] },
        { mode: 'allow', operations: ['*'], patterns: [canonicalResourceFor(controlPlane)] },
        ...(taco ? [{ mode: 'allow', operations: ['*'], patterns: [canonicalResourceFor(taco)] }] : []),
      ],
    },
  };
}

/**
 * The canonical resource string for an HTTP(S) origin. `URL` drops the default port, so
 * the effective port has to be reconstructed or the rule silently never matches.
 */
function canonicalResourceFor(endpoint) {
  const port = endpoint.port || (endpoint.protocol === 'https:' ? '443' : '80');
  return `tcp://${endpoint.hostname}:${port}`;
}

/**
 * AgentOS blocks guest requests to loopback unless the port is exempted from its SSRF
 * checks; the exemption is what lets the sandbox reach the Control Plane on the host
 * (verified on host-c1: the rule alone still fails, the exemption plus the rule answers
 * with an HTTP status). Non-loopback origins need no exemption.
 */
export function loopbackExemptPortsFor(controlPlaneUrl) {
  const endpoint = new URL(controlPlaneUrl);
  // `URL.hostname` keeps the brackets of an IPv6 literal.
  const hostname = endpoint.hostname.replace(/^\[|\]$/g, '');
  if (!LOOPBACK_HOSTS.has(hostname)) return [];
  const port = Number(endpoint.port || (endpoint.protocol === 'https:' ? '443' : '80'));
  return Number.isInteger(port) && port > 0 ? [port] : [];
}

const LOOPBACK_HOSTS = new Set(['127.0.0.1', '::1', 'localhost']);

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
 * FR-006 requires the sandboxed Agent to reach its Session-scoped capability from inside
 * the guest. The workload CLI is copied to a guest-local path with an explicit executable
 * mode and then asked to resolve its own Session through the injected execution code.
 *
 * Measured platform fact: In the AgentOS guest, `node` exists only as a 32-byte kernel command
 * stub, never as an executable file. Any `execve` chain through a shebang (such as directly
 * executing `${GUEST_CLI_LOCAL}`) or a `sh` wrapper fails with `Exec format error` or
 * `command not found: node` (exit 126/127). Only the Agent's own shell resolves `node`.
 * Hence the pre-flight probe must run `node <guest bundle path> whoami` to reliably test
 * projection, interpreter, execution code, egress policy, and Control Plane reachability
 * before any model credential is written. Any failure fails the Session closed with the
 * measured reason.
 */
async function prepareGuestWorkloadCli(vm, capabilityEnvironment, onLog, aborted) {
  const prepare = await bounded(
    vm.process.exec(
      `mkdir -p ${path.posix.dirname(GUEST_CLI_LOCAL)} && cp ${GUEST_WORKLOAD_CLI} ${GUEST_CLI_LOCAL} && chmod 0755 ${GUEST_CLI_LOCAL}`,
      { timeoutMs: WORKLOAD_PROBE_TIMEOUT_MS, output: { capture: 'all' } },
    ),
    aborted,
  );
  if (prepare?.exitCode !== 0) {
    throw new Error(
      'AgentOS Pi could not stage the Runtime-provided workload CLI inside the guest'
      + ` (exit ${prepare?.exitCode ?? 'unknown'}: ${String(prepare?.stderr ?? '').trim().slice(0, 300) || 'no stderr'})`,
    );
  }
  const probe = await bounded(
    vm.process.exec(`node ${GUEST_CLI_LOCAL} whoami`, {
      env: capabilityEnvironment,
      timeoutMs: WORKLOAD_PROBE_TIMEOUT_MS,
      output: { capture: 'all' },
    }),
    aborted,
  );
  if (probe?.exitCode !== 0) {
    throw new Error(
      'AgentOS Pi cannot reach the Runtime-provided workload CLI from inside the guest'
      + ` (node ${GUEST_CLI_LOCAL} whoami exit ${probe?.exitCode ?? 'unknown'}:`
      + ` ${String(probe?.stderr ?? '').trim().slice(0, 300) || 'no stderr'});`
      + ' this Session would run without its Session-scoped capability',
    );
  }
  onLog('[agentos-pi] guest workload CLI resolved its Session capability');
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
  const guestControlPlaneUrl = process.env.MYSTRA_AGENTOS_CONTROL_PLANE_URL?.trim() || controlPlaneUrl;
  const controlPlaneEndpoint = new URL(guestControlPlaneUrl);
  if (controlPlaneEndpoint.username || controlPlaneEndpoint.password) {
    throw new Error('AgentOS Pi Control Plane URL must not contain credentials');
  }

  const config = JSON.parse(await readFile(modelConfigPath, 'utf8'));
  const model = requireModelConfig(config);
  const tacoHostUrl = process.env.MYSTRA_AGENTOS_TACO_HOST_URL;
  const permissions = permissionsForEndpoints(model.baseUrl, guestControlPlaneUrl, tacoHostUrl);
  const tacoPackagePath = path.join(guestCliDirectory(), 'taco-cli.aospkg');
  if (tacoHostUrl !== undefined) {
    for (const file of ['taco-cli.aospkg', 'taco-skill/SKILL.md', 'taco-skill/taco-shell.html']) {
      if (!existsSync(path.join(guestCliDirectory(), file))) {
        throw new Error(`AgentOS Taco artifact missing: ${file}; run build:agentos-cli before enabling Taco`);
      }
    }
  }

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

  // The guest holds the Session-scoped execution code and reaches the Control Plane
  // directly, so the host Runtime and the AgentOS Runtime deliver the same workload
  // contract. The code lives only in the durable Session environment: never a guest file,
  // argv, event or log.
  const capabilityEnvironment = {
    MYSTRA_AGENT_PATH: GUEST_CLI_LOCAL,
    MYSTRA_CONTROL_PLANE_URL: guestControlPlaneUrl,
    MYSTRA_EXECUTION_CODE: executionCode,
    MYSTRA_WORKSPACE_ROOT: GUEST_WORKSPACE,
    ...(tacoHostUrl !== undefined ? {
      TACO_HOST_URL: new URL(tacoHostUrl).origin,
      TACO_SKILL_PATH: `${GUEST_CLI_MOUNT}/taco-skill`,
    } : {}),
  };
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
    // The workload CLI is one self-contained bundle; the guest never sees the repository.
    {
      path: GUEST_CLI_MOUNT,
      readOnly: true,
      plugin: { id: 'host_dir', config: { hostPath: guestCliDirectory(), readOnly: true } },
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
      software: tacoHostUrl !== undefined ? [pi, { packagePath: tacoPackagePath }] : [pi],
      database: { type: 'sqlite_file', path: databasePath },
      mounts,
      permissions,
      loopbackExemptPorts: loopbackExemptPortsFor(guestControlPlaneUrl),
    }), aborted);
    await prepareGuestWorkloadCli(vm, capabilityEnvironment, onLog, aborted);
    await bounded(configurePiModel(vm, model, onLog), aborted);

    onLog(`[agentos-pi] opening ${mode} pi session ${sessionId} in ${GUEST_WORKSPACE}`);
    await bounded(vm.sessions.open({
      sessionId,
      agent: 'pi',
      cwd: GUEST_WORKSPACE,
      // AgentOS persists this env in the durable session record and reapplies it on
      // restore, so later turns and rebuilt VMs resolve the same Session capability.
      env: capabilityEnvironment,
      permissionPolicy: 'allow_all',
      additionalInstructions: tacoHostUrl === undefined ? systemPrompt : [
        systemPrompt,
        'This Runtime preinstalls taco-cli 0.1.3 on PATH. Run taco-cli help for its version and commands.',
        'For local Taco authoring, read "$TACO_SKILL_PATH/SKILL.md" and use "$TACO_SKILL_PATH/taco-shell.html". Template packs are not installed.',
        'Use taco-cli publish <file> --dry-run before publishing. TACO_HOST_URL selects the approved host.',
        'Publication is public and unauthenticated. Publish only content explicitly authorized for sharing. Never upload credentials or private repository/session data.',
        'This CLI has no bundle command; assemble locally with the skill. Network update is not implemented. Do not claim a new publication updates an existing Taco.',
      ].join('\n'),
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
