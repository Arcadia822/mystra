import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

import type { AgentProcessResult } from "@mystra/agent-adapters";
import {
  jobInlineContextBundlePayloadSchema,
  type BranchDeliveryReceipt,
  type CleanupOutcome,
  type IssueReference,
  type QualityPhaseResult,
  type RepoProviderKind,
  type RepositorySnapshot,
  type ResolvedRuntimeContract,
  type RunResult,
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
  runnerSessionId: string;
  runnerToken: string;
}

interface ClaimedJobResponse {
  job: {
    id: string;
    spec: {
      taskId: string;
      repository: RepositorySnapshot;
      baseBranch: string;
      branchName: string;
      agent: string;
      prompt: string;
      issue?: {
        reference: IssueReference;
      };
      mergeRequest?: {
        title?: string;
        body?: string;
      };
    };
  } | null;
  run: {
    id: string;
    state?: string;
    cancellationRequest?: {
      requestedAt: string;
    } | null;
  } | null;
  project: {
    id: string;
    slug: string;
    prewarmConfig: Record<string, unknown>;
  } | null;
  runtime: ResolvedRuntimeContract | null;
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
      contextBundleModes: config.executor === "docker" ? ["read-only", "job-scoped"] : [],
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
  });
}

async function emitEvent(
  config: RunnerConfig,
  token: string,
  runId: string,
  type: string,
  data: Record<string, unknown> = {},
  severity: "debug" | "info" | "warn" | "error" = "info",
): Promise<void> {
  await postJson(apiUrl(config, `/api/runner/jobs/${runId}/events`), {
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
    kind: "runner-env" as const,
    provider: providerName,
    reference: providerName === "gitlab"
      ? "MYSTRA_GITLAB_TOKEN"
      : "MYSTRA_GITHUB_TOKEN",
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
): NodeJS.ProcessEnv {
  const auth = repositoryAuthBinding(providerName);
  return {
    [auth.reference]: requiredEnv(auth.reference),
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
  if (bundle.source.kind !== "job-inline") {
    throw new Error(`Context bundle source ${bundle.source.kind} is unsupported`);
  }
  const payload = jobInlineContextBundlePayloadSchema.parse(
    bundle.source.metadata.jobInline,
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
  runId: string,
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
      const snapshot = await getJson<ClaimedJobResponse>(
        apiUrl(config, `/api/runner/jobs/${runId}`),
        token,
      );
      if (snapshot.run?.cancellationRequest) {
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

function repositoryTarget(claim: ClaimedJobResponse) {
  if (!claim.job || !claim.project) {
    throw new Error("Claim is missing repository metadata");
  }
  return {
    projectId: claim.project.id,
    repository: claim.job.spec.repository,
    defaultBaseBranch: claim.job.spec.baseBranch,
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

async function executeFakeJob(
  config: RunnerConfig,
  token: string,
  claim: ClaimedJobResponse,
): Promise<void> {
  if (!claim.job || !claim.run) {
    return;
  }
  await emitEvent(config, token, claim.run.id, "execution.started", {
    executor: "fake",
  });
  await postJson(apiUrl(config, `/api/runner/jobs/${claim.run.id}/result`), {
    status: "succeeded",
    summary: `Fake runner completed task ${claim.job.spec.taskId}`,
    branch: claim.job.spec.branchName,
  }, token);
}

async function executeDockerJob(
  config: RunnerConfig,
  token: string,
  claim: ClaimedJobResponse,
  agentRegistry: RunnerAgentAdapterRegistry,
  repoRegistry: RunnerRepoProviderRegistry,
  sandboxRegistry: RunnerSandboxProviderRegistry,
): Promise<void> {
  if (!claim.job || !claim.run || !claim.project) {
    return;
  }
  const { job, run, project, runtime } = claim;
  if (!runtime || runtime.provider !== "docker") {
    throw new Error(`Claimed job ${job.id} has no supported Docker runtime`);
  }
  if (!job.spec.issue) {
    throw new Error(`Claimed job ${job.id} has no immutable issue snapshot`);
  }
  if (job.spec.agent !== "copilot") {
    throw new Error(
      `Direct Issue execution supports only the Copilot adapter, received ${job.spec.agent}`,
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
  const adapter = agentRegistry.get(job.spec.agent);
  const prompt = buildAgentPrompt(runtime, job.spec.prompt);
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
  const workspace = await mkdtemp(path.join(config.workspaceRoot, `${run.id}-`));
  const scriptPath = path.join(workspace, "task.sh");
  await writeFile(scriptPath, await dockerTaskScript(), { mode: 0o755 });
  await writeFile(path.join(workspace, "prompt.txt"), prompt);
  if (promptFilePath) {
    await writeFile(path.join(workspace, "agent-prompt.txt"), prompt);
  }

  const containerName = `mystra-${run.id}`;
  const image = runtime.environment.image;
  const reviewTitle = job.spec.mergeRequest?.title ?? `Mystra task ${job.spec.taskId}`;
  const commitMessage = `Update #${job.spec.taskId} ${reviewTitle}`;
  const dockerArgs = [
    "run",
    "-d",
    "--name",
    containerName,
    "-e",
    `MYSTRA_TASK_ID=${job.spec.taskId}`,
    "-e",
    `MYSTRA_REPO=${job.spec.repository.cloneUrl}`,
    "-e",
    `MYSTRA_BASE_BRANCH=${job.spec.baseBranch}`,
    "-e",
    `MYSTRA_BRANCH_NAME=${job.spec.branchName}`,
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
    run.id,
    pollStop.signal,
    () => executionActive,
    () => {
      executionAbort.abort();
    },
  );
  if (run.cancellationRequest) {
    executionAbort.abort();
  }

  try {
    const repositoryEnvironment = repositoryPhaseEnvironment(
      config,
      repoProvider.providerName,
    );
    const direct = await executeDirectExecution({
      repositorySecret: {
        name: repositoryAuthBinding(repoProvider.providerName).reference,
        value: requiredEnv(repositoryAuthBinding(repoProvider.providerName).reference),
      },
      agentSecret: {
        name: "COPILOT_GITHUB_TOKEN",
        value: requiredEnv("COPILOT_GITHUB_TOKEN"),
      },
      maxAutopilotContinues: MAX_AUTOPILOT_CONTINUES,
      dependencies: {
        emit: async (type, data, severity) => {
          await emitEvent(config, token, run.id, type, data, severity);
        },
        launchSandbox: async ({ environment }) => {
          await emitEvent(config, token, run.id, "container.starting", {
            image,
            projectSlug: project.slug,
            sandboxProvider: sandboxProvider.providerName,
            repositoryProvider: repoProvider.providerName,
          });
          sandboxSession = await sandboxProvider.launch({
            runId: run.id,
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
          await emitEvent(config, token, run.id, "container.started", {
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
        await emitEvent(config, token, run.id, "cleanup.started", { reason }, "warn");
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
      const result: RunResult = {
        status: executionTimedOut ? "timed_out" : "canceled",
        summary: executionTimedOut
          ? `Docker task exceeded ${config.defaultExecutionTimeoutSeconds}s`
          : "Docker task was canceled",
        branch: job.spec.branchName,
        ...(sandboxOutcome ? { sandboxOutcome } : {}),
      };
      await postJson(apiUrl(config, `/api/runner/jobs/${run.id}/result`), result, token);
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
      const result: RunResult = {
        status: "failed",
        summary: direct.summary,
        branch: job.spec.branchName,
        errorCode: direct.errorCode,
        errorMessage: direct.summary,
        ...(direct.agentExecution ? { agentExecution: direct.agentExecution } : {}),
        ...(direct.quality ? { quality: direct.quality } : {}),
        ...(sandboxOutcome ? { sandboxOutcome } : {}),
      };
      await postJson(apiUrl(config, `/api/runner/jobs/${run.id}/result`), result, token);
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
    await emitEvent(config, token, run.id, "preview.ready", {
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
    const branchReceipt: BranchDeliveryReceipt = await repoProvider.pushBranch({
      target,
      branchName: commit.branchName,
      baseBranch: job.spec.baseBranch,
      commitMessage,
      auth,
      metadata: {
        localRepoPath: path.join(workspace, "repo"),
        ...repositoryMetadata(config, repoProvider.providerName),
      },
    });
    if (branchReceipt.status !== "pushed") {
      throw new Error(branchReceipt.errorMessage ?? "Branch delivery failed");
    }
    await emitEvent(config, token, run.id, "git.push_succeeded", {
      branchName: branchReceipt.branchName,
      commitSha: branchReceipt.commitSha ?? commit.commitSha,
    });

    const reviewResult = await repoProvider.createReview({
      target,
      auth,
      branch: branchReceipt,
      title: reviewTitle,
      body: job.spec.mergeRequest?.body ?? job.spec.prompt,
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
    });
    if (reviewResult.status !== "review_created" || !reviewResult.review) {
      throw new Error(reviewResult.errorMessage ?? "Review creation failed");
    }
    await emitEvent(config, token, run.id, "review.created", {
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
    const result: RunResult = {
      status: "waiting_for_review",
      summary: `Issue ${job.spec.issue.reference.identifier} is ready for review`,
      issue: job.spec.issue.reference,
      branch: branchReceipt.branchName,
      commitSha: branchReceipt.commitSha ?? commit.commitSha,
      reviewResult,
      mrUrl: reviewResult.review.url,
      mrIid: reviewResult.review.number,
      quality: direct.quality,
      preview: {
        url: previewUrl,
        containerName,
        probeCount,
      },
      sandboxOutcome,
      agentExecution: direct.agentExecution,
    };
    await postJson(apiUrl(config, `/api/runner/jobs/${run.id}/result`), result, token);
    console.log(`[mystra-runner] run=${run.id} waiting_for_review`);
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
    const result: RunResult = {
      status: "failed",
      summary: "Direct Docker execution failed",
      branch: job.spec.branchName,
      errorCode: "direct_execution_failed",
      errorMessage: summary,
      ...(sandboxOutcome ? { sandboxOutcome } : {}),
    };
    await postJson(apiUrl(config, `/api/runner/jobs/${run.id}/result`), result, token);
  } finally {
    executionActive = false;
    pollStop.abort();
    clearTimeout(timeout);
    await cancellationPoll;
  }
}

async function executeJob(
  config: RunnerConfig,
  token: string,
  claim: ClaimedJobResponse,
  agentRegistry?: RunnerAgentAdapterRegistry,
  repoRegistry?: RunnerRepoProviderRegistry,
  sandboxRegistry?: RunnerSandboxProviderRegistry,
): Promise<void> {
  if (config.executor === "docker") {
    if (!agentRegistry || !repoRegistry || !sandboxRegistry) {
      throw new Error("Agent, repository, and sandbox registries must be initialized");
    }
    await executeDockerJob(
      config,
      token,
      claim,
      agentRegistry,
      repoRegistry,
      sandboxRegistry,
    );
    return;
  }
  await executeFakeJob(config, token, claim);
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
  const activeJobs = new Set<Promise<void>>();
  let stopAfterActiveJobs = false;

  console.log(
    `[mystra-runner] registered ${config.runnerName} session=${registration.runnerSessionId} executor=${config.executor}`,
  );

  while (true) {
    await postJson(apiUrl(config, "/api/runner/heartbeat"), {}, registration.runnerToken);
    let claimedAny = false;
    while (!stopAfterActiveJobs && activeJobs.size < config.concurrency) {
      const claim = await getJson<ClaimedJobResponse>(
        apiUrl(config, "/api/runner/jobs"),
        registration.runnerToken,
      );
      if (!claim.job || !claim.run) {
        break;
      }
      claimedAny = true;
      const activeJob = executeJob(
        config,
        registration.runnerToken,
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
          activeJobs.delete(activeJob);
        });
      activeJobs.add(activeJob);
      if (config.once) {
        stopAfterActiveJobs = true;
      }
    }

    if (config.once && !claimedAny && activeJobs.size === 0) {
      console.log("[mystra-runner] no queued job found");
      return;
    }
    if (stopAfterActiveJobs && activeJobs.size === 0) {
      return;
    }
    if (activeJobs.size > 0) {
      await Promise.race([
        ...activeJobs,
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
