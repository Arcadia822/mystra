import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

import type { AgentProcessResult } from "@mystra/agent-adapters";
import {
  sessionInlineContextBundlePayloadSchema,
  type BranchDeliveryReceipt,
  type CleanupOutcome,
  type IssueReference,
  type QualityPhaseResult,
  type RepoProviderKind,
  type RepositorySnapshot,
  type ResolvedRuntimeContract,
  type SessionResult,
  type SandboxObservation,
  type SandboxOutcome,
  type SandboxSession,
} from "@mystra/shared";

import {
  createRunnerAgentAdapterRegistry,
  type RunnerAgentAdapterRegistry,
} from "./agent-adapters.js";
import { executeDirectExecution } from "./direct-execution.js";
import { probePreview } from "./preview-probe.js";
import {
  createRunnerRepoProviderRegistry,
  type RunnerRepoProviderRegistry,
} from "./repo-providers.js";
import {
  createRunnerSandboxProviderRegistry,
  type RunnerSandboxProviderRegistry,
} from "./sandbox-providers.js";
import { captureException, flushSentry, initSentry } from "./sentry.js";

interface RunnerConfig {
  controlPlaneUrl: string;
  registrationSecret: string;
  runnerName: string;
  concurrency: number;
  pollIntervalSeconds: number;
  staleAfterSeconds: number;
  defaultExecutionTimeoutSeconds: number;
  cancelCheckIntervalSeconds: number;
  cleanupTimeoutSeconds: number;
  eligibleProjectIds: string[] | undefined;
  eligibleRuntimeProviders: string[] | undefined;
  once: boolean;
  executor: "fake" | "docker";
  workspaceRoot: string;
  cacheRoot: string;
  codexAuthDir: string | undefined;
  gitlabHttpBaseUrl: string | undefined;
  githubHttpBaseUrl: string | undefined;
  previewHost: string;
  agentAdapterModules: string[] | undefined;
  repoProviderModules: string[] | undefined;
  sandboxProviderModules: string[] | undefined;
}

interface RegisterResponse {
  runner: {
    id: string;
    name: string;
  };
  credential: string;
  heartbeatIntervalSeconds: number;
}

interface ClaimedSessionResponse {
  task: {
    id: string;
    projectId: string;
    objective: string;
    repository: RepositorySnapshot;
    issue?: {
      reference: IssueReference;
    };
  };
  session: {
    id: string;
    taskId: string;
    title: string;
    objective: string;
    branch: string;
    agent: string;
    mergeRequest?: {
      title?: string;
      body?: string;
    };
    cancellationRequest?: {
      requestedAt: string;
    } | null;
  };
  project: {
    id: string;
    slug: string;
    prewarmConfig: Record<string, unknown>;
  };
  runtime: ResolvedRuntimeContract;
}

interface ClonePhaseOutput {
  workspacePath: string;
  baseCommit: string;
}

interface AgentPhaseOutput {
  branchName: string;
  changedFiles: string[];
  processResult: AgentProcessResult;
}

interface QualityPhaseOutput extends QualityPhaseResult {
  logPath?: string;
}

interface PreviewPhaseOutput {
  command: string;
  pid: number;
  port: number;
  logPath: string;
}

interface CommitPhaseOutput {
  branchName: string;
  commitSha: string;
}

const MAX_INLINE_AGENT_PROMPT_BYTES = 16 * 1024;
const COPILOT_CLI_VERSION = "1.0.69-0";
const MAX_AUTOPILOT_CONTINUES = 10;

function positiveIntEnv(name: string, fallback: number): number {
  const value = process.env[name];
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}

function csvEnv(name: string): string[] | undefined {
  const values = (process.env[name] ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return values.length > 0 ? values : undefined;
}

function readConfig(): RunnerConfig {
  return {
    controlPlaneUrl: process.env.MYSTRA_CONTROL_PLANE_URL ?? "http://localhost:3000",
    registrationSecret: requiredEnv("MYSTRA_RUNNER_REGISTRATION_SECRET"),
    runnerName: process.env.MYSTRA_RUNNER_NAME ?? "local-runner",
    concurrency: positiveIntEnv("MYSTRA_RUNNER_CONCURRENCY", 1),
    pollIntervalSeconds: positiveIntEnv("MYSTRA_RUNNER_POLL_INTERVAL_SECONDS", 5),
    staleAfterSeconds: positiveIntEnv("MYSTRA_RUNNER_STALE_AFTER_SECONDS", 90),
    defaultExecutionTimeoutSeconds: positiveIntEnv(
      "MYSTRA_RUNNER_DEFAULT_EXECUTION_TIMEOUT_SECONDS",
      3600,
    ),
    cancelCheckIntervalSeconds: positiveIntEnv(
      "MYSTRA_RUNNER_CANCEL_CHECK_INTERVAL_SECONDS",
      10,
    ),
    cleanupTimeoutSeconds: positiveIntEnv("MYSTRA_RUNNER_CLEANUP_TIMEOUT_SECONDS", 30),
    eligibleProjectIds: csvEnv("MYSTRA_RUNNER_ELIGIBLE_PROJECT_IDS"),
    eligibleRuntimeProviders: csvEnv("MYSTRA_RUNNER_ELIGIBLE_RUNTIME_PROVIDERS"),
    once: process.env.MYSTRA_RUNNER_ONCE === "1",
    executor: process.env.MYSTRA_EXECUTOR === "docker" ? "docker" : "fake",
    workspaceRoot: process.env.MYSTRA_WORKSPACE_ROOT
      ?? path.join(tmpdir(), "mystra-workspaces"),
    cacheRoot: process.env.MYSTRA_CACHE_ROOT
      ?? path.join(process.env.HOME ?? tmpdir(), ".mystra", "cache"),
    codexAuthDir: process.env.MYSTRA_CODEX_AUTH_DIR,
    gitlabHttpBaseUrl: process.env.MYSTRA_GITLAB_HTTP_BASE_URL,
    githubHttpBaseUrl: process.env.MYSTRA_GITHUB_HTTP_BASE_URL,
    previewHost: process.env.MYSTRA_PREVIEW_HOST ?? "127.0.0.1",
    agentAdapterModules: csvEnv("MYSTRA_AGENT_ADAPTER_MODULES"),
    repoProviderModules: csvEnv("MYSTRA_REPO_PROVIDER_MODULES"),
    sandboxProviderModules: csvEnv("MYSTRA_SANDBOX_PROVIDER_MODULES"),
  };
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable ${name}`);
  }
  return value;
}

function apiUrl(config: RunnerConfig, pathname: string): string {
  return new URL(pathname, config.controlPlaneUrl).toString();
}

async function postJson<T>(
  url: string,
  body: unknown,
  token?: string,
): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`POST ${url} failed: ${response.status} ${await response.text()}`);
  }
  return await response.json() as T;
}

async function getJson<T>(url: string, token: string): Promise<T> {
  const response = await fetch(url, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    throw new Error(`GET ${url} failed: ${response.status} ${await response.text()}`);
  }
  return await response.json() as T;
}

async function claimAvailableSession(
  config: RunnerConfig,
  runnerId: string,
  credential: string,
): Promise<ClaimedSessionResponse | undefined> {
  const response = await fetch(apiUrl(config, "/api/runner/sessions"), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${credential}`,
    },
    body: JSON.stringify({ runnerId, maxSessions: 1 }),
  });
  if (response.status === 204) return undefined;
  if (!response.ok) {
    throw new Error(`Session claim failed: ${response.status} ${await response.text()}`);
  }
  return await response.json() as ClaimedSessionResponse;
}

async function register(
  config: RunnerConfig,
  registeredAgents: string[] = [],
): Promise<RegisterResponse> {
  return await postJson(apiUrl(config, "/api/runner/register"), {
    runnerName: config.runnerName,
    capabilities: {
      executor: config.executor,
      agents: config.executor === "docker" ? registeredAgents : [],
      providers: config.executor === "docker" ? ["docker"] : [],
      contextBundleModes: config.executor === "docker" ? ["read-only", "session-scoped"] : [],
      mountKinds: config.executor === "docker"
        ? ["workspace", "cache", "contextBundle", "secret"]
        : [],
      portExposure: {
        supportsDynamicHostPorts: config.executor === "docker",
      },
      secretInjectionModes: config.executor === "docker" ? ["env"] : [],
    },
    maxConcurrency: config.concurrency,
    staleAfterSeconds: config.staleAfterSeconds,
    eligibleProjectIds: config.eligibleProjectIds,
    eligibleRuntimeProviders: config.eligibleRuntimeProviders,
  }, config.registrationSecret);
}

async function emitEvent(
  config: RunnerConfig,
  token: string,
  sessionId: string,
  type: string,
  data: Record<string, unknown> = {},
  severity: "debug" | "info" | "warn" | "error" = "info",
): Promise<void> {
  await postJson(apiUrl(config, `/api/runner/sessions/${sessionId}/events`), {
    type,
    severity,
    data,
  }, token);
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timeout = setTimeout(resolve, ms);
    const abort = () => {
      clearTimeout(timeout);
      resolve();
    };
    if (signal?.aborted) {
      abort();
      return;
    }
    signal?.addEventListener("abort", abort, { once: true });
  });
}

function runCommand(
  command: string,
  args: string[],
  options: {
    env?: NodeJS.ProcessEnv;
    signal?: AbortSignal;
  } = {},
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env: options.env ?? process.env,
      signal: options.signal,
      stdio: "inherit",
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} ${args.join(" ")} exited with ${code ?? "unknown"}`));
    });
  });
}

async function dockerTaskScript(): Promise<string> {
  return await readFile(new URL("../assets/container-task.sh", import.meta.url), "utf8");
}

function repositoryAuthBinding(providerName: RepoProviderKind) {
  return {
    kind: providerName === "gitlab" ? "runner-env" as const : "runtime-ref" as const,
    provider: providerName,
    reference: providerName === "gitlab"
      ? "MYSTRA_GITLAB_TOKEN"
      : "github-app-installation",
    metadata: {},
  };
}

function repositoryMetadata(
  config: RunnerConfig,
  providerName: RepoProviderKind,
): Record<string, unknown> {
  if (providerName === "gitlab" && config.gitlabHttpBaseUrl) {
    return { gitlabHttpBaseUrl: config.gitlabHttpBaseUrl };
  }
  if (providerName === "github" && config.githubHttpBaseUrl) {
    return { githubHttpBaseUrl: config.githubHttpBaseUrl };
  }
  return {};
}

function repositoryPhaseEnvironment(
  config: RunnerConfig,
  providerName: RepoProviderKind,
  repositoryToken?: string,
): NodeJS.ProcessEnv {
  const auth = repositoryAuthBinding(providerName);
  return {
    ...(providerName === "gitlab"
      ? { [auth.reference]: requiredEnv(auth.reference) }
      : { MYSTRA_REPOSITORY_TOKEN: repositoryToken ?? "" }),
    MYSTRA_REPOSITORY_PROVIDER: providerName,
    MYSTRA_REPOSITORY_AUTH_REFERENCE: auth.reference,
    MYSTRA_REPOSITORY_AUTH_USERNAME: providerName === "gitlab"
      ? "oauth2"
      : "x-access-token",
    ...(providerName === "gitlab" && config.gitlabHttpBaseUrl
      ? { MYSTRA_REPOSITORY_HTTP_BASE_URL: config.gitlabHttpBaseUrl }
      : {}),
    ...(providerName === "github" && config.githubHttpBaseUrl
      ? { MYSTRA_REPOSITORY_HTTP_BASE_URL: config.githubHttpBaseUrl }
      : {}),
  };
}

async function fetchRepositoryCredential(
  config: RunnerConfig,
  runnerCredential: string,
  sessionId: string,
  purpose: "clone" | "push" | "review",
) {
  return await postJson<import("@mystra/shared").RunnerRepositoryCredentialResponse>(
    apiUrl(config, `/api/runner/sessions/${encodeURIComponent(sessionId)}/repository-credential`),
    { purpose },
    runnerCredential,
  );
}

function phaseOutputHostPath(workspace: string, phase: string): string {
  return path.join(workspace, "phase-output", `${phase}.json`);
}

function phaseOutputContainerPath(phase: string): string {
  return `/mystra/workspace/phase-output/${phase}.json`;
}

async function readPhaseOutput<T>(outputPath: string): Promise<T> {
  return JSON.parse(await readFile(outputPath, "utf8")) as T;
}

async function executeContainerPhase<T>(input: {
  containerName: string;
  workspace: string;
  phase: "clone" | "agent" | "test" | "build" | "preview" | "commit";
  environment?: NodeJS.ProcessEnv;
  signal?: AbortSignal;
  previewPort?: number;
}): Promise<T> {
  const outputPath = phaseOutputHostPath(input.workspace, input.phase);
  await mkdir(path.dirname(outputPath), { recursive: true });
  await rm(outputPath, { force: true });
  const environment = input.environment ?? {};
  const envArgs = Object.entries(environment)
    .filter((entry): entry is [string, string] => typeof entry[1] === "string")
    .flatMap(([name]) => ["-e", name]);
  const args = [
    "exec",
    "-e",
    `MYSTRA_PHASE_OUTPUT_FILE=${phaseOutputContainerPath(input.phase)}`,
    "-e",
    `MYSTRA_PREVIEW_PORT=${input.previewPort ?? 3000}`,
    ...envArgs,
    input.containerName,
    "bash",
    "/mystra/workspace/task.sh",
    input.phase,
  ];
  try {
    await runCommand("docker", args, {
      env: { ...process.env, ...environment },
      ...(input.signal ? { signal: input.signal } : {}),
    });
  } catch (error) {
    try {
      return await readPhaseOutput<T>(outputPath);
    } catch {
      throw error;
    }
  }
  return await readPhaseOutput<T>(outputPath);
}

function runtimePorts(runtime: ResolvedRuntimeContract): ResolvedRuntimeContract["exposedPorts"] {
  return runtime.exposedPorts.length > 0
    ? runtime.exposedPorts
    : [{ containerPort: 3000, hostBinding: "0.0.0.0::3000", name: "frontend" }];
}

async function materializeContextBundle(
  config: RunnerConfig,
  runtime: ResolvedRuntimeContract,
  target: string,
  sourceRef: string,
): Promise<string> {
  const bundle = runtime.contextBundles.find((candidate) =>
    candidate.mountPath === target
  );
  if (!bundle) {
    throw new Error(`No context bundle resolves mount ${target}`);
  }
  if (bundle.source.kind !== "session-inline") {
    throw new Error(`Context bundle source ${bundle.source.kind} is unsupported`);
  }
  const payload = sessionInlineContextBundlePayloadSchema.parse(
    bundle.source.metadata.sessionInline,
  );
  const destination = path.join(config.cacheRoot, "context-bundles", sourceRef);
  await rm(destination, { recursive: true, force: true });
  await mkdir(destination, { recursive: true });
  for (const file of payload.files) {
    const targetPath = path.resolve(destination, file.path);
    if (!targetPath.startsWith(`${path.resolve(destination)}${path.sep}`)) {
      throw new Error(`Context bundle file escapes destination: ${file.path}`);
    }
    await mkdir(path.dirname(targetPath), { recursive: true });
    await writeFile(targetPath, file.content);
  }
  return destination;
}

async function appendRuntimeMounts(
  dockerArgs: string[],
  config: RunnerConfig,
  workspace: string,
  runtime: ResolvedRuntimeContract,
): Promise<void> {
  dockerArgs.push("-v", `${workspace}:/mystra/workspace`);
  const seen = new Set(["/mystra/workspace"]);
  for (const mount of runtime.mounts) {
    if (seen.has(mount.target) || mount.kind === "secret" || mount.kind === "gitMirror") {
      continue;
    }
    let source: string;
    if (mount.kind === "workspace") {
      source = workspace;
    } else if (mount.kind === "contextBundle") {
      if (!mount.sourceRef) {
        throw new Error(`Context bundle mount ${mount.target} is missing sourceRef`);
      }
      source = await materializeContextBundle(
        config,
        runtime,
        mount.target,
        mount.sourceRef,
      );
    } else {
      const ref = mount.sourceRef ?? path.basename(mount.target);
      source = path.join(config.cacheRoot, ref);
      await mkdir(source, { recursive: true });
    }
    dockerArgs.push(
      "-v",
      `${source}:${mount.target}${mount.readOnly ? ":ro" : ""}`,
    );
    seen.add(mount.target);
  }
}

function appendRuntimePorts(
  dockerArgs: string[],
  ports: ResolvedRuntimeContract["exposedPorts"],
): void {
  for (const port of ports) {
    dockerArgs.push(
      "-p",
      port.hostBinding ?? `0.0.0.0::${port.containerPort}`,
    );
  }
}

async function pollCancellationRequest(
  config: RunnerConfig,
  token: string,
  sessionId: string,
  stopSignal: AbortSignal,
  isActive: () => boolean,
  requestCancel: () => void,
): Promise<void> {
  while (isActive()) {
    await sleep(config.cancelCheckIntervalSeconds * 1000, stopSignal);
    if (!isActive()) {
      return;
    }
    try {
      const claim = await getJson<ClaimedSessionResponse>(
        apiUrl(config, `/api/runner/sessions/${sessionId}`),
        token,
      );
      if (claim.session.cancellationRequest) {
        requestCancel();
        return;
      }
    } catch (error) {
      console.warn(
        "[mystra-runner] cancellation poll failed",
        error instanceof Error ? error.message : String(error),
      );
    }
  }
}

function repositoryTarget(claim: ClaimedSessionResponse) {
  return {
    projectId: claim.project.id,
    repository: claim.task.repository,
    defaultBaseBranch: claim.task.repository.defaultBranch,
  } as const;
}

function buildAgentPrompt(
  runtime: ResolvedRuntimeContract,
  prompt: string,
): string {
  const bundleLines = runtime.contextBundles.map((bundle) =>
    `- ${bundle.slug}${bundle.mountPath ? ` at ${bundle.mountPath}` : ""}`
  );
  return [
    ...(runtime.executionContract
      ? [
          `Read ${runtime.executionContract.filePath} before editing.`,
          "Treat that execution artifact as the source of truth.",
        ]
      : []),
    ...(bundleLines.length > 0 ? ["Available context:", ...bundleLines] : []),
    "",
    prompt,
    "",
    "Implement the requested change, keep it focused, and leave all edits in the repository.",
  ].join("\n");
}

async function executeFakeSession(
  config: RunnerConfig,
  token: string,
  claim: ClaimedSessionResponse,
): Promise<void> {
  await emitEvent(config, token, claim.session.id, "execution.started", {
    executor: "fake",
  });
  await postJson(apiUrl(config, `/api/runner/sessions/${claim.session.id}/result`), {
    status: "succeeded",
    summary: `Fake Runner completed Session ${claim.session.id}`,
    branch: claim.session.branch,
  }, token);
}

async function executeDockerSession(
  config: RunnerConfig,
  token: string,
  claim: ClaimedSessionResponse,
  agentRegistry: RunnerAgentAdapterRegistry,
  repoRegistry: RunnerRepoProviderRegistry,
  sandboxRegistry: RunnerSandboxProviderRegistry,
): Promise<void> {
  const { task, session, project, runtime } = claim;
  if (runtime.provider !== "docker") {
    throw new Error(`Claimed Session ${session.id} has no supported Docker runtime`);
  }
  if (!task.issue) {
    throw new Error(`Claimed Task ${task.id} has no immutable Issue snapshot`);
  }
  if (session.agent !== "copilot") {
    throw new Error(
      `Direct Issue execution supports only the Copilot adapter, received ${session.agent}`,
    );
  }

  const target = repositoryTarget(claim);
  const repoProvider = repoRegistry.select(target);
  if (!repoProvider) {
    throw new Error(
      `No repository delivery provider supports ${target.repository.provider}`,
    );
  }
  const sandboxProvider = sandboxRegistry.get("docker");
  if (!sandboxProvider) {
    throw new Error("Docker sandbox provider is not registered");
  }
  const adapter = agentRegistry.get(session.agent);
  const prompt = buildAgentPrompt(runtime, session.objective);
  const promptFilePath = Buffer.byteLength(prompt, "utf8") > MAX_INLINE_AGENT_PROMPT_BYTES
    ? "/mystra/workspace/agent-prompt.txt"
    : undefined;
  const request = {
    prompt,
    ...(promptFilePath ? { promptFilePath } : {}),
    workingDirectory: "/mystra/workspace/repo",
  };
  const agentCommand = adapter.buildCommand(request);
  const agentEnvironment = adapter.buildEnvironment(request);
  const executionOptions = adapter.buildExecutionOptions?.(request);
  const prepareDirs = [...new Set(
    Object.values(agentEnvironment).filter((value) => value.startsWith("/")),
  )];
  const ports = runtimePorts(runtime);
  const previewPort = ports.find((port) =>
    port.name === "frontend" || port.containerPort === 3000
  )?.containerPort ?? ports[0]?.containerPort ?? 3000;
  await mkdir(config.workspaceRoot, { recursive: true });
  const workspace = await mkdtemp(path.join(config.workspaceRoot, `${session.id}-`));
  const scriptPath = path.join(workspace, "task.sh");
  await writeFile(scriptPath, await dockerTaskScript(), { mode: 0o755 });
  await writeFile(path.join(workspace, "prompt.txt"), prompt);
  if (promptFilePath) {
    await writeFile(path.join(workspace, "agent-prompt.txt"), prompt);
  }

  const containerName = `mystra-${session.id}`;
  const image = runtime.environment.image;
  const reviewTitle = session.mergeRequest?.title ?? session.title;
  const commitMessage = `Update Task ${task.id} ${reviewTitle}`;
  const dockerArgs = [
    "run",
    "-d",
    "--name",
    containerName,
    "-e",
    `MYSTRA_TASK_ID=${task.id}`,
    "--env",
    `MYSTRA_SESSION_ID=${session.id}`,
    "-e",
    `MYSTRA_REPO=${task.repository.cloneUrl}`,
    "-e",
    `MYSTRA_BASE_BRANCH=${task.repository.defaultBranch}`,
    "-e",
    `MYSTRA_BRANCH_NAME=${session.branch}`,
    "-e",
    `MYSTRA_AGENT_COMMAND_JSON=${JSON.stringify(agentCommand)}`,
    "-e",
    `MYSTRA_AGENT_ENV_JSON=${JSON.stringify(agentEnvironment)}`,
    "-e",
    `MYSTRA_AGENT_PREPARE_DIRS_JSON=${JSON.stringify(prepareDirs)}`,
    "-e",
    `MYSTRA_AGENT_STDIN_FILE=${executionOptions?.stdinFilePath ?? ""}`,
    "-e",
    "MYSTRA_AGENT_PROCESS_RESULT_FILE=/mystra/workspace/agent-process-result.json",
    "-e",
    `MYSTRA_COMMIT_MESSAGE=${commitMessage}`,
    "-e",
    `MYSTRA_GIT_AUTHOR_NAME=${process.env.MYSTRA_GIT_AUTHOR_NAME ?? "Mystra Runner"}`,
    "-e",
    `MYSTRA_GIT_AUTHOR_EMAIL=${process.env.MYSTRA_GIT_AUTHOR_EMAIL ?? "mystra-runner@example.invalid"}`,
    "-e",
    "PNPM_STORE_DIR=/mystra/cache/pnpm-store",
    "-e",
    "UV_CACHE_DIR=/mystra/cache/uv",
  ];
  appendRuntimePorts(dockerArgs, ports);
  await appendRuntimeMounts(dockerArgs, config, workspace, runtime);
  dockerArgs.push(image, "sleep", "infinity");

  let sandboxSession: SandboxSession | undefined;
  let sandboxObservation: SandboxObservation | undefined;
  let cleanupOutcome: CleanupOutcome | undefined;
  let executionTimedOut = false;
  const executionAbort = new AbortController();
  const pollStop = new AbortController();
  let executionActive = true;
  const timeout = setTimeout(() => {
    executionTimedOut = true;
    executionAbort.abort();
  }, config.defaultExecutionTimeoutSeconds * 1000);
  const cancellationPoll = pollCancellationRequest(
    config,
    token,
    session.id,
    pollStop.signal,
    () => executionActive,
    () => {
      executionAbort.abort();
    },
  );
  if (session.cancellationRequest) {
    executionAbort.abort();
  }

  try {
    const cloneCredential = repoProvider.providerName === "github"
      ? (await fetchRepositoryCredential(config, token, session.id, "clone")).credential
      : undefined;
    const repositoryEnvironment = repositoryPhaseEnvironment(
      config,
      repoProvider.providerName,
      cloneCredential?.secret,
    );
    const direct = await executeDirectExecution({
      repositorySecret: {
        name: repoProvider.providerName === "github" ? "MYSTRA_REPOSITORY_TOKEN" : repositoryAuthBinding(repoProvider.providerName).reference,
        value: repoProvider.providerName === "github" ? cloneCredential!.secret : requiredEnv(repositoryAuthBinding(repoProvider.providerName).reference),
      },
      agentSecret: {
        name: "COPILOT_GITHUB_TOKEN",
        value: requiredEnv("COPILOT_GITHUB_TOKEN"),
      },
      maxAutopilotContinues: MAX_AUTOPILOT_CONTINUES,
      dependencies: {
        emit: async (type, data, severity) => {
          await emitEvent(config, token, session.id, type, data, severity);
        },
        launchSandbox: async ({ environment }) => {
          await emitEvent(config, token, session.id, "container.starting", {
            image,
            projectSlug: project.slug,
            sandboxProvider: sandboxProvider.providerName,
            repositoryProvider: repoProvider.providerName,
          });
          sandboxSession = await sandboxProvider.launch({
            sessionId: session.id,
            runtime,
            workspacePath: workspace,
            retentionPolicy: "retain_for_preview",
          }, {
            dockerArgs,
            env: { ...process.env, ...environment },
            containerName,
          });
          sandboxObservation = await sandboxProvider.inspect(sandboxSession, {
            runtimePorts: ports,
            previewHost: config.previewHost,
          });
          await emitEvent(config, token, session.id, "container.started", {
            image,
            containerName,
            containerId: sandboxSession.sessionId,
          });
        },
        clone: async ({ environment }) => {
          return await executeContainerPhase<ClonePhaseOutput>({
            containerName,
            workspace,
            phase: "clone",
            environment: { ...repositoryEnvironment, ...environment },
            signal: executionAbort.signal,
          });
        },
        runAgent: async ({ environment }) => {
          const output = await executeContainerPhase<AgentPhaseOutput>({
            containerName,
            workspace,
            phase: "agent",
            environment,
            signal: executionAbort.signal,
          });
          const parsed = adapter.parseOutput(output.processResult);
          return {
            exitCode: output.processResult.exitCode,
            cliVersion: typeof parsed.metadata.cliVersion === "string"
              ? parsed.metadata.cliVersion
              : COPILOT_CLI_VERSION,
            changedFiles: output.changedFiles,
          };
        },
        runTest: async ({ environment }) => {
          const output = await executeContainerPhase<QualityPhaseOutput>({
            containerName,
            workspace,
            phase: "test",
            environment,
            signal: executionAbort.signal,
          });
          return {
            status: output.status,
            command: output.command,
            durationMs: output.durationMs,
          };
        },
        runBuild: async ({ environment }) => {
          const output = await executeContainerPhase<QualityPhaseOutput>({
            containerName,
            workspace,
            phase: "build",
            environment,
            signal: executionAbort.signal,
          });
          return {
            status: output.status,
            command: output.command,
            durationMs: output.durationMs,
          };
        },
      },
    });

    if (executionAbort.signal.aborted) {
      const reason = executionTimedOut ? "timeout" : "cancel";
      if (sandboxSession) {
        await emitEvent(config, token, session.id, "cleanup.started", { reason }, "warn");
        cleanupOutcome = await sandboxProvider.stop(sandboxSession, reason, {
          cleanupTimeoutSeconds: config.cleanupTimeoutSeconds,
        });
      }
      const sandboxOutcome = sandboxSession
        ? await sandboxProvider.collectOutcome(sandboxSession, {
            status: executionTimedOut ? "timed_out" : "canceled",
            observation: sandboxObservation,
            cleanup: cleanupOutcome,
            finishedAt: new Date().toISOString(),
            retained: cleanupOutcome?.status === "failed",
          })
        : undefined;
      const result: SessionResult = {
        status: executionTimedOut ? "timed_out" : "canceled",
        summary: executionTimedOut
          ? `Docker task exceeded ${config.defaultExecutionTimeoutSeconds}s`
          : "Docker task was canceled",
        branch: session.branch,
        ...(sandboxOutcome ? { sandboxOutcome } : {}),
      };
      await postJson(apiUrl(config, `/api/runner/sessions/${session.id}/result`), result, token);
      return;
    }

    if (direct.status === "failed") {
      const sandboxOutcome = sandboxSession
        ? await sandboxProvider.collectOutcome(sandboxSession, {
            status: "failed",
            observation: sandboxObservation,
            finishedAt: new Date().toISOString(),
            retained: true,
          })
        : undefined;
      const result: SessionResult = {
        status: "failed",
        summary: direct.summary,
        branch: session.branch,
        errorCode: direct.errorCode,
        errorMessage: direct.summary,
        ...(direct.agentExecution ? { agentExecution: direct.agentExecution } : {}),
        ...(direct.quality ? { quality: direct.quality } : {}),
        ...(sandboxOutcome ? { sandboxOutcome } : {}),
      };
      await postJson(apiUrl(config, `/api/runner/sessions/${session.id}/result`), result, token);
      return;
    }

    const preview = await executeContainerPhase<PreviewPhaseOutput>({
      containerName,
      workspace,
      phase: "preview",
      signal: executionAbort.signal,
      previewPort,
    });
    if (!sandboxSession) {
      throw new Error("Sandbox session disappeared before preview");
    }
    sandboxObservation = await sandboxProvider.inspect(sandboxSession, {
      runtimePorts: ports,
      previewHost: config.previewHost,
    });
    const previewUrl = sandboxObservation.ports.find((port) =>
      port.containerPort === preview.port
    )?.url ?? (typeof sandboxObservation.metadata.frontendUrl === "string"
      ? sandboxObservation.metadata.frontendUrl
      : undefined);
    if (!previewUrl) {
      throw new Error("Sandbox provider did not expose a preview URL");
    }
    const probeCount = await probePreview(previewUrl, executionAbort.signal);
    await emitEvent(config, token, session.id, "preview.ready", {
      url: previewUrl,
      containerName,
      probeCount,
    });

    const commit = await executeContainerPhase<CommitPhaseOutput>({
      containerName,
      workspace,
      phase: "commit",
      signal: executionAbort.signal,
    });
    const auth = repositoryAuthBinding(repoProvider.providerName);
    const pushCredential = repoProvider.providerName === "github"
      ? (await fetchRepositoryCredential(config, token, session.id, "push")).credential
      : undefined;
    const branchReceipt: BranchDeliveryReceipt = await repoProvider.pushBranch({
      target,
      branchName: commit.branchName,
      baseBranch: task.repository.defaultBranch,
      commitMessage,
      auth,
      metadata: {
        localRepoPath: path.join(workspace, "repo"),
        ...repositoryMetadata(config, repoProvider.providerName),
      },
    }, pushCredential);
    if (branchReceipt.status !== "pushed") {
      throw new Error(branchReceipt.errorMessage ?? "Branch delivery failed");
    }
    await emitEvent(config, token, session.id, "git.push_succeeded", {
      branchName: branchReceipt.branchName,
      commitSha: branchReceipt.commitSha ?? commit.commitSha,
    });

    const reviewCredential = repoProvider.providerName === "github"
      ? (await fetchRepositoryCredential(config, token, session.id, "review")).credential
      : undefined;
    const reviewResult = await repoProvider.createReview({
      target,
      auth,
      branch: branchReceipt,
      title: reviewTitle,
      body: session.mergeRequest?.body ?? session.objective,
      metadata: {
        frontendPreviewUrl: previewUrl,
        previewContainer: containerName,
        qualityGate: {
          status: "passed",
          test: direct.quality.test,
          build: direct.quality.build,
        },
        ...repositoryMetadata(config, repoProvider.providerName),
      },
    }, reviewCredential);
    if (reviewResult.status !== "review_created" || !reviewResult.review) {
      throw new Error(reviewResult.errorMessage ?? "Review creation failed");
    }
    await emitEvent(config, token, session.id, "review.created", {
      provider: reviewResult.review.provider,
      url: reviewResult.review.url,
      number: reviewResult.review.number,
    });

    const sandboxOutcome: SandboxOutcome = await sandboxProvider.collectOutcome(
      sandboxSession,
      {
        status: "succeeded",
        observation: sandboxObservation,
        finishedAt: new Date().toISOString(),
        retained: true,
      },
    );
    const result: SessionResult = {
      status: "waiting_for_review",
      summary: `Issue ${task.issue.reference.identifier} is ready for review`,
      issue: task.issue.reference,
      branch: branchReceipt.branchName,
      commitSha: branchReceipt.commitSha ?? commit.commitSha,
      reviewResult,
      quality: direct.quality,
      preview: {
        url: previewUrl,
        containerName,
        probeCount,
      },
      sandboxOutcome,
      agentExecution: direct.agentExecution,
    };
    await postJson(apiUrl(config, `/api/runner/sessions/${session.id}/result`), result, token);
    console.log(`[mystra-runner] session=${session.id} waiting_for_review`);
  } catch (error) {
    captureException(error);
    const summary = error instanceof Error ? error.message : String(error);
    let sandboxOutcome: SandboxOutcome | undefined;
    if (sandboxSession) {
      sandboxOutcome = await sandboxProvider.collectOutcome(sandboxSession, {
        status: "failed",
        observation: sandboxObservation,
        finishedAt: new Date().toISOString(),
        retained: true,
      });
    }
    const result: SessionResult = {
      status: "failed",
      summary: "Direct Docker execution failed",
      branch: session.branch,
      errorCode: "direct_execution_failed",
      errorMessage: summary,
      ...(sandboxOutcome ? { sandboxOutcome } : {}),
    };
    await postJson(apiUrl(config, `/api/runner/sessions/${session.id}/result`), result, token);
  } finally {
    executionActive = false;
    pollStop.abort();
    clearTimeout(timeout);
    await cancellationPoll;
  }
}

async function executeSession(
  config: RunnerConfig,
  token: string,
  claim: ClaimedSessionResponse,
  agentRegistry?: RunnerAgentAdapterRegistry,
  repoRegistry?: RunnerRepoProviderRegistry,
  sandboxRegistry?: RunnerSandboxProviderRegistry,
): Promise<void> {
  if (config.executor === "docker") {
    if (!agentRegistry || !repoRegistry || !sandboxRegistry) {
      throw new Error("Agent, repository, and sandbox registries must be initialized");
    }
    await executeDockerSession(
      config,
      token,
      claim,
      agentRegistry,
      repoRegistry,
      sandboxRegistry,
    );
    return;
  }
  await executeFakeSession(config, token, claim);
}

async function main(): Promise<void> {
  initSentry("mystra-runner");
  const config = readConfig();
  const agentRegistryBundle = config.executor === "docker"
    ? await createRunnerAgentAdapterRegistry({
        moduleSpecifiers: config.agentAdapterModules,
        codexAuthDir: config.codexAuthDir,
      })
    : undefined;
  const repoRegistryBundle = config.executor === "docker"
    ? await createRunnerRepoProviderRegistry({
        moduleSpecifiers: config.repoProviderModules,
      })
    : undefined;
  const sandboxRegistryBundle = config.executor === "docker"
    ? await createRunnerSandboxProviderRegistry({
        moduleSpecifiers: config.sandboxProviderModules,
      })
    : undefined;
  const agentRegistry = agentRegistryBundle?.registry;
  const registration = await register(
    config,
    agentRegistryBundle?.agentNames.filter((agentName) => agentName === "copilot"),
  );
  const activeSessions = new Map<string, Promise<void>>();
  let stopAfterActiveSessions = false;

  console.log(
    `[mystra-runner] registered ${registration.runner.name} id=${registration.runner.id} executor=${config.executor}`,
  );

  while (true) {
    await postJson(apiUrl(config, "/api/runner/heartbeat"), {
      runnerId: registration.runner.id,
      activeSessionIds: [...activeSessions.keys()],
    }, registration.credential);
    let claimedAny = false;
    while (!stopAfterActiveSessions && activeSessions.size < config.concurrency) {
      const claim = await claimAvailableSession(config, registration.runner.id, registration.credential);
      if (!claim) {
        break;
      }
      claimedAny = true;
      const activeSession = executeSession(
        config,
        registration.credential,
        claim,
        agentRegistry,
        repoRegistryBundle?.registry,
        sandboxRegistryBundle?.registry,
      )
        .catch((error: unknown) => {
          captureException(error);
          console.error(error);
        })
        .finally(() => {
          activeSessions.delete(claim.session.id);
        });
      activeSessions.set(claim.session.id, activeSession);
      if (config.once) {
        stopAfterActiveSessions = true;
      }
    }

    if (config.once && !claimedAny && activeSessions.size === 0) {
      console.log("[mystra-runner] no queued Session found");
      return;
    }
    if (stopAfterActiveSessions && activeSessions.size === 0) {
      return;
    }
    if (activeSessions.size > 0) {
      await Promise.race([
        ...activeSessions.values(),
        sleep(config.pollIntervalSeconds * 1000),
      ]);
      continue;
    }
    await sleep(config.pollIntervalSeconds * 1000);
  }
}

main().catch((error: unknown) => {
  captureException(error);
  console.error(error);
  void flushSentry();
  process.exitCode = 1;
});
