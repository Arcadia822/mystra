import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { networkInterfaces, tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import type { ResolvedRuntimeContract } from "@mystra/shared";
import { captureException, flushSentry, initSentry } from "./sentry.js";
import { createRunnerWorkflowProviderRegistry, type RunnerWorkflowProviderRegistry } from "./workflow-providers.js";

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
  previewHost: string;
  containerProxyUrl: string | undefined;
  workflowProviderName: string;
  workflowBlueprintName: string | undefined;
  workflowProviderModules: string[] | undefined;
  workflowBlueprintFiles: string[] | undefined;
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
      repo: string;
      baseBranch: string;
      branchName: string;
      agent: "codex" | "copilot";
      prompt: string;
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

interface DockerResult {
  status: "succeeded" | "failed" | "canceled" | "timed_out";
  summary: string;
  branch?: string;
  mrUrl?: string;
  mrIid?: number;
  errorCode?: string;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}

interface QualityGateMetadata {
  status?: unknown;
  sequence?: unknown;
  logPath?: unknown;
}

interface CloneStepOutput {
  workspacePath: string;
  baseCommit: string;
}

interface AgentStepOutput {
  branchName: string;
  noChanges: boolean;
  changedFiles: string[];
}

interface QualityGateStepOutput {
  status: "passed" | "failed";
  summary?: string;
  errorCode?: string;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}

interface PushStepOutput {
  branchName: string;
}

function readConfig(): RunnerConfig {
  return {
    controlPlaneUrl: process.env.MYSTRA_CONTROL_PLANE_URL ?? "http://localhost:3000",
    runnerName: process.env.MYSTRA_RUNNER_NAME ?? "local-runner",
    concurrency: positiveIntEnv("MYSTRA_RUNNER_CONCURRENCY", 1),
    pollIntervalSeconds: positiveIntEnv("MYSTRA_RUNNER_POLL_INTERVAL_SECONDS", 5),
    staleAfterSeconds: positiveIntEnv("MYSTRA_RUNNER_STALE_AFTER_SECONDS", 90),
    defaultExecutionTimeoutSeconds: positiveIntEnv("MYSTRA_RUNNER_DEFAULT_EXECUTION_TIMEOUT_SECONDS", 3600),
    cancelCheckIntervalSeconds: positiveIntEnv("MYSTRA_RUNNER_CANCEL_CHECK_INTERVAL_SECONDS", 10),
    cleanupTimeoutSeconds: positiveIntEnv("MYSTRA_RUNNER_CLEANUP_TIMEOUT_SECONDS", 30),
    eligibleProjectIds: csvEnv("MYSTRA_RUNNER_ELIGIBLE_PROJECT_IDS"),
    eligibleRuntimeProviders: csvEnv("MYSTRA_RUNNER_ELIGIBLE_RUNTIME_PROVIDERS"),
    once: process.env.MYSTRA_RUNNER_ONCE === "1",
    executor: process.env.MYSTRA_EXECUTOR === "docker" ? "docker" : "fake",
    workspaceRoot: process.env.MYSTRA_WORKSPACE_ROOT ?? path.join(tmpdir(), "mystra-workspaces"),
    cacheRoot: process.env.MYSTRA_CACHE_ROOT ?? path.join(process.env.HOME ?? tmpdir(), ".mystra", "cache"),
    codexAuthDir: process.env.MYSTRA_CODEX_AUTH_DIR,
    gitlabHttpBaseUrl: process.env.MYSTRA_GITLAB_HTTP_BASE_URL,
    previewHost: process.env.MYSTRA_PREVIEW_HOST ?? detectPreviewHost(),
    containerProxyUrl: process.env.MYSTRA_CONTAINER_PROXY_URL ?? defaultContainerProxyUrl(),
    workflowProviderName: process.env.MYSTRA_WORKFLOW_PROVIDER ?? "local",
    workflowBlueprintName: process.env.MYSTRA_WORKFLOW_BLUEPRINT,
    workflowProviderModules: csvEnv("MYSTRA_WORKFLOW_PROVIDER_MODULES"),
    workflowBlueprintFiles: csvEnv("MYSTRA_WORKFLOW_BLUEPRINT_FILES"),
  };
}

function positiveIntEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }
  const parsed = Number.parseInt(raw, 10);
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

function defaultContainerProxyUrl(): string | undefined {
  const proxy = process.env.HTTPS_PROXY ?? process.env.HTTP_PROXY ?? process.env.https_proxy ?? process.env.http_proxy;
  if (!proxy) {
    return undefined;
  }

  try {
    const url = new URL(proxy);
    if (["127.0.0.1", "localhost"].includes(url.hostname)) {
      url.hostname = "172.17.0.1";
      url.port = "18081";
      return url.toString();
    }
  } catch {
    return undefined;
  }

  return proxy;
}

function appendContainerProxyEnv(dockerArgs: string[], config: RunnerConfig, repo: string): void {
  if (!config.containerProxyUrl) {
    return;
  }

  const noProxy = new Set(
    [
      "localhost",
      "127.0.0.1",
      "::1",
      "10.0.0.0/8",
      "172.16.0.0/12",
      "192.168.0.0/16",
      "172.17.0.1",
      process.env.NO_PROXY,
      process.env.no_proxy,
      config.gitlabHttpBaseUrl ? new URL(config.gitlabHttpBaseUrl).hostname : undefined,
      repo.includes("://") ? new URL(repo).hostname : undefined,
    ]
      .filter((value): value is string => Boolean(value))
      .flatMap((value) => value.split(",").map((part) => part.trim()).filter(Boolean)),
  );
  const noProxyValue = [...noProxy].join(",");

  for (const name of ["HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "http_proxy", "https_proxy", "all_proxy"]) {
    dockerArgs.push("-e", `${name}=${config.containerProxyUrl}`);
  }
  dockerArgs.push("-e", `NO_PROXY=${noProxyValue}`, "-e", `no_proxy=${noProxyValue}`);
}

function detectPreviewHost(): string {
  for (const addresses of Object.values(networkInterfaces())) {
    for (const address of addresses ?? []) {
      if (address.family === "IPv4" && !address.internal) {
        return address.address;
      }
    }
  }
  return "localhost";
}

function apiUrl(config: RunnerConfig, apiPath: string): string {
  return new URL(apiPath, config.controlPlaneUrl).toString();
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
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`GET ${url} failed: ${response.status} ${await response.text()}`);
  }

  return await response.json() as T;
}

async function register(config: RunnerConfig): Promise<RegisterResponse> {
  return await postJson<RegisterResponse>(apiUrl(config, "/api/runner/register"), {
    runnerName: config.runnerName,
    capabilities: {
      executor: config.executor,
      agents: ["codex", "copilot"],
      providers: config.executor === "docker" ? ["docker"] : [],
      contextBundleModes: config.executor === "docker" ? ["read-only", "job-scoped"] : [],
      mountKinds: config.executor === "docker" ? ["workspace", "gitMirror", "cache", "contextBundle", "secret"] : [],
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

async function emitWorkflowNodeEvent(
  config: RunnerConfig,
  token: string,
  runId: string,
  phase: "started" | "succeeded" | "failed",
  node: {
    id: string;
    handler: string;
    kind: string;
  },
  data: Record<string, unknown> = {},
  severity: "debug" | "info" | "warn" | "error" = "info",
): Promise<void> {
  await emitEvent(
    config,
    token,
    runId,
    `workflow.node.${phase}`,
    {
      nodeId: node.id,
      handler: node.handler,
      nodeKind: node.kind,
      ...data,
    },
    severity,
  );
}

async function emitWorkflowLifecycleEvent(
  config: RunnerConfig,
  token: string,
  runId: string,
  type: "workflow.start_requested" | "workflow.started" | "workflow.start_failed",
  data: Record<string, unknown>,
  severity: "debug" | "info" | "warn" | "error" = "info",
): Promise<void> {
  await emitEvent(config, token, runId, type, data, severity);
}

function qualityGateMetadata(result: DockerResult): QualityGateMetadata | null {
  const value = result.metadata?.qualityGate;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as QualityGateMetadata;
}

async function emitQualityGateEvent(
  config: RunnerConfig,
  token: string,
  runId: string,
  result: DockerResult,
): Promise<void> {
  const qualityGate = qualityGateMetadata(result);
  if (!qualityGate) {
    return;
  }

  const status = qualityGate.status === "passed" ? "passed" : "failed";
  await emitEvent(config, token, runId, `quality_gate.${status}`, {
    sequence: Array.isArray(qualityGate.sequence) ? qualityGate.sequence : ["test", "build"],
    logPath: typeof qualityGate.logPath === "string"
      ? qualityGate.logPath
      : "/mystra/workspace/quality-gate.log",
  }, status === "passed" ? "info" : "error");
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
      captureException(error);
      console.warn(`[mystra-runner] cancellation poll failed for run=${runId}`, error);
    }
  }
}

function runCommand(command: string, args: string[], options: {
  env?: NodeJS.ProcessEnv;
  cwd?: string;
  signal?: AbortSignal;
} = {}): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env ?? process.env,
      stdio: "inherit",
    });
    const abort = () => {
      child.kill("SIGTERM");
    };

    if (options.signal?.aborted) {
      abort();
    } else {
      options.signal?.addEventListener("abort", abort, { once: true });
    }
    child.on("error", reject);
    child.on("exit", (code) => {
      options.signal?.removeEventListener("abort", abort);
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} ${args.join(" ")} exited with ${code ?? "unknown"}`));
    });
  });
}

function runCommandCapture(command: string, args: string[], options: {
  env?: NodeJS.ProcessEnv;
  cwd?: string;
} = {}): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const errorChunks: Buffer[] = [];
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env ?? process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    child.stdout.on("data", (chunk: Buffer) => chunks.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => errorChunks.push(chunk));
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve(Buffer.concat(chunks).toString("utf8").trim());
        return;
      }
      reject(new Error(`${command} ${args.join(" ")} exited with ${code ?? "unknown"}: ${Buffer.concat(errorChunks).toString("utf8")}`));
    });
  });
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable ${name}`);
  }
  return value;
}

function cacheKey(input: string): string {
  return createHash("sha256").update(input).digest("hex").slice(0, 16);
}

function gitMirrorPath(config: RunnerConfig, repo: string): string {
  return path.join(config.cacheRoot, "git", `${cacheKey(repo)}.git`);
}

async function refreshGitMirror(config: RunnerConfig, repo: string): Promise<string> {
  const mirror = gitMirrorPath(config, repo);
  await mkdir(path.dirname(mirror), { recursive: true });

  try {
    await runCommand("git", ["-C", mirror, "remote", "set-url", "origin", repo]);
    await runCommand("git", ["-C", mirror, "remote", "update", "--prune"]);
  } catch {
    await rm(mirror, { force: true, recursive: true });
    await runCommand("git", ["clone", "--mirror", repo, mirror]);
  }

  return mirror;
}

async function dockerTaskScript(): Promise<string> {
  const sourceRelativePath = new URL("../assets/container-task.sh", import.meta.url);
  return await readFile(sourceRelativePath, "utf8");
}

function defaultDockerMounts(): ResolvedRuntimeContract["mounts"] {
  return [
    { kind: "workspace", owner: "system", target: "/mystra/workspace", readOnly: false },
    { kind: "gitMirror", owner: "system", target: "/mystra/cache/git/repo.git", readOnly: true },
    { kind: "cache", owner: "system", target: "/mystra/cache/pnpm-store", sourceRef: "pnpm-store", readOnly: false },
    { kind: "cache", owner: "system", target: "/mystra/cache/uv", sourceRef: "uv", readOnly: false },
    { kind: "cache", owner: "system", target: "/mystra/cache/uv-python", sourceRef: "uv-python", readOnly: false },
  ];
}

function mountIdentity(mount: ResolvedRuntimeContract["mounts"][number]): string {
  return `${mount.kind}:${mount.target}`;
}

function effectiveDockerMounts(runtimeMounts: ResolvedRuntimeContract["mounts"]): ResolvedRuntimeContract["mounts"] {
  const merged = [...defaultDockerMounts()];
  const seen = new Set(merged.map(mountIdentity));

  for (const mount of runtimeMounts) {
    const key = mountIdentity(mount);
    if (seen.has(key)) {
      continue;
    }
    merged.push(mount);
    seen.add(key);
  }

  return merged;
}

function defaultDockerPorts(): ResolvedRuntimeContract["exposedPorts"] {
  return [
    { containerPort: 3000, hostBinding: "0.0.0.0::3000", name: "frontend" },
    { containerPort: 8000, hostBinding: "0.0.0.0::8000", name: "backend" },
  ];
}

function defaultDockerSecrets(): ResolvedRuntimeContract["secrets"] {
  return [{ name: "MYSTRA_GITLAB_TOKEN", mode: "env" }];
}

function cachePath(config: RunnerConfig, mount: ResolvedRuntimeContract["mounts"][number]): string {
  const cacheName = mount.sourceRef ?? path.basename(mount.target);
  return path.join(config.cacheRoot, cacheName);
}

function runtimeMountSource(
  config: RunnerConfig,
  workspace: string,
  gitMirror: string,
  mount: ResolvedRuntimeContract["mounts"][number],
): string {
  switch (mount.kind) {
    case "workspace":
      return workspace;
    case "gitMirror":
      return gitMirror;
    case "cache":
      return cachePath(config, mount);
    case "contextBundle":
      if (!mount.sourceRef) {
        throw new Error(`Runtime contextBundle mount for ${mount.target} is missing sourceRef`);
      }
      return path.join(config.cacheRoot, "context-bundles", mount.sourceRef);
    case "secret":
      if (!mount.sourceRef) {
        throw new Error(`Runtime secret mount for ${mount.target} is missing sourceRef`);
      }
      return mount.sourceRef;
  }
}

function appendRuntimeMounts(
  dockerArgs: string[],
  config: RunnerConfig,
  workspace: string,
  gitMirror: string,
  mounts: ResolvedRuntimeContract["mounts"],
): void {
  for (const mount of mounts) {
    const suffix = mount.readOnly ? ":ro" : "";
    dockerArgs.push("-v", `${runtimeMountSource(config, workspace, gitMirror, mount)}:${mount.target}${suffix}`);
  }
}

function appendRuntimePorts(dockerArgs: string[], ports: ResolvedRuntimeContract["exposedPorts"]): void {
  for (const port of ports) {
    dockerArgs.push("-p", port.hostBinding ?? `0.0.0.0::${port.containerPort}`);
  }
}

function appendRuntimeSecrets(
  dockerArgs: string[],
  env: NodeJS.ProcessEnv,
  secrets: ResolvedRuntimeContract["secrets"],
): void {
  for (const secret of secrets) {
    if (secret.mode !== "env") {
      throw new Error(`Runtime secret mode ${secret.mode} is not implemented by the Docker runner`);
    }
    const target = secret.target ?? secret.name;
    if (target === secret.name) {
      dockerArgs.push("-e", secret.name);
    } else {
      env[target] = process.env[secret.name];
      dockerArgs.push("-e", target);
    }
  }
}

function previewPort(
  ports: ResolvedRuntimeContract["exposedPorts"],
  name: string,
  containerPort: number,
): number | undefined {
  return ports.find((port) => port.name === name)?.containerPort
    ?? ports.find((port) => port.containerPort === containerPort)?.containerPort;
}

function renderRuntimeContextPrompt(runtime: ResolvedRuntimeContract): string[] {
  const lines = ["Mystra context bundles:"];
  if (runtime.contextBundles.length === 0) {
    lines.push("- No explicit context bundles were resolved for this run.");
    return lines;
  }

  for (const bundle of runtime.contextBundles) {
    const mountedAt = bundle.mountPath ? ` mounted at ${bundle.mountPath}` : "";
    lines.push(`- ${bundle.slug}: ${bundle.required ? "required" : "optional"}, ${bundle.accessMode}, ${bundle.source.kind}${mountedAt}`);
    if (bundle.source.ref) {
      lines.push(`  - Source ref: ${bundle.source.ref}`);
    }
    const prompt = bundle.source.metadata.prompt ?? bundle.source.metadata.instructions;
    if (typeof prompt === "string" && prompt.trim()) {
      lines.push(`  - ${prompt.trim()}`);
    }
  }

  return lines;
}

function workflowStepOutputHostPath(workspace: string, nodeId: string): string {
  return path.join(workspace, "workflow-step-output", `${nodeId}.json`);
}

function workflowStepOutputContainerPath(nodeId: string): string {
  return `/mystra/workspace/workflow-step-output/${nodeId}.json`;
}

async function readWorkflowStepOutput<T>(outputPath: string): Promise<T> {
  return JSON.parse(await readFile(outputPath, "utf8")) as T;
}

async function executeContainerWorkflowStep<T>(options: {
  containerName: string;
  stepCommand: "clone" | "agent" | "quality-gate" | "push" | "review-create";
  nodeId: string;
  workspace: string;
  env?: NodeJS.ProcessEnv;
  signal?: AbortSignal;
  frontendUrl?: string | null;
  backendUrl?: string | null;
}): Promise<T> {
  const outputPath = workflowStepOutputHostPath(options.workspace, options.nodeId);
  await mkdir(path.dirname(outputPath), { recursive: true });
  await rm(outputPath, { force: true });

  const args = [
    "exec",
    "-e",
    `MYSTRA_STEP_OUTPUT_FILE=${workflowStepOutputContainerPath(options.nodeId)}`,
    "-e",
    `MYSTRA_FRONTEND_PREVIEW_URL=${options.frontendUrl ?? ""}`,
    "-e",
    `MYSTRA_BACKEND_PREVIEW_URL=${options.backendUrl ?? ""}`,
    options.containerName,
    "bash",
    "/mystra/workspace/task.sh",
    options.stepCommand,
  ];

  try {
    await runCommand("docker", args, {
      ...(options.env ? { env: options.env } : {}),
      ...(options.signal ? { signal: options.signal } : {}),
    });
  } catch (error) {
    try {
      return await readWorkflowStepOutput<T>(outputPath);
    } catch {
      throw error;
    }
  }

  return await readWorkflowStepOutput<T>(outputPath);
}

async function resultFromWorkflowExecution(
  workspace: string,
  branchName: string,
  failedNodeId: string | undefined,
  errorMessage: string | undefined,
): Promise<DockerResult> {
  if (!failedNodeId) {
    return {
      status: "failed",
      summary: "Workflow execution failed before a terminal node completed.",
      branch: branchName,
      errorCode: "workflow_failed",
      ...(errorMessage ? { errorMessage } : {}),
    };
  }

  const outputPath = workflowStepOutputHostPath(workspace, failedNodeId);

  try {
    if (failedNodeId === "agent") {
      const agentOutput = await readWorkflowStepOutput<AgentStepOutput>(outputPath);
      if (agentOutput.noChanges) {
        return {
          status: "failed",
          summary: "Agent finished without repository changes",
          branch: branchName,
          errorCode: "no_changes",
          errorMessage: "Agent finished without repository changes",
        };
      }
    }

    if (failedNodeId === "quality_gate") {
      const qualityGate = await readWorkflowStepOutput<QualityGateStepOutput>(outputPath);
      return {
        status: "failed",
        summary: qualityGate.summary ?? "Quality gate failed during test -> build. See quality-gate.log in the retained workspace.",
        branch: branchName,
        errorCode: qualityGate.errorCode ?? "quality_gate_failed",
        ...((qualityGate.errorMessage ?? qualityGate.summary)
          ? { errorMessage: qualityGate.errorMessage ?? qualityGate.summary }
          : {}),
        ...(qualityGate.metadata ? { metadata: qualityGate.metadata } : {}),
      };
    }

    const output = await readWorkflowStepOutput<DockerResult>(outputPath);
    return {
      ...output,
      branch: output.branch ?? branchName,
    };
  } catch {
    return {
      status: "failed",
      summary: "Workflow execution failed before writing a terminal node result",
      branch: branchName,
      errorCode: "workflow_failed",
      ...(errorMessage ? { errorMessage } : {}),
    };
  }
}

async function executeFakeJob(
  config: RunnerConfig,
  token: string,
  claim: ClaimedJobResponse,
): Promise<void> {
  if (!claim.job || !claim.run) {
    return;
  }

  const { job, run } = claim;
  console.log(`[mystra-runner] claimed job=${job.id} run=${run.id} task=${job.spec.taskId}`);

  await emitEvent(config, token, run.id, "container.started", {
    executor: "fake",
  });
  await emitEvent(config, token, run.id, "agent.started", {
    agent: job.spec.agent,
  });

  await postJson(apiUrl(config, `/api/runner/jobs/${run.id}/result`), {
    status: "succeeded",
    summary: `Fake runner completed task ${job.spec.taskId}`,
    branch: job.spec.branchName,
    metadata: {
      repo: job.spec.repo,
      baseBranch: job.spec.baseBranch,
      promptPreview: job.spec.prompt.slice(0, 120),
    },
  }, token);

  console.log(`[mystra-runner] completed run=${run.id}`);
}

async function executeDockerJob(
  config: RunnerConfig,
  token: string,
  claim: ClaimedJobResponse,
  workflowRegistry: RunnerWorkflowProviderRegistry,
): Promise<void> {
  if (!claim.job || !claim.run || !claim.project) {
    return;
  }

  const { job, run, project, runtime } = claim;
  if (!runtime) {
    throw new Error(`Claimed Docker job ${job.id} is missing resolved runtime`);
  }
  if (runtime.provider !== "docker") {
    throw new Error(`Claimed Docker job ${job.id} uses unsupported runtime provider ${runtime.provider}`);
  }

  const image = runtime.environment.image;
  const runtimeMounts = effectiveDockerMounts(runtime.mounts);
  const runtimePorts = runtime.exposedPorts.length > 0 ? runtime.exposedPorts : defaultDockerPorts();
  const runtimeSecrets = runtime.secrets.length > 0 ? runtime.secrets : defaultDockerSecrets();
  const gitlabToken = requiredEnv("MYSTRA_GITLAB_TOKEN");
  const gitMirror = await refreshGitMirror(config, job.spec.repo);
  await mkdir(config.workspaceRoot, { recursive: true });
  const workspace = await mkdtemp(path.join(config.workspaceRoot, `${run.id}-`));
  const scriptPath = path.join(workspace, "task.sh");
  const promptPath = path.join(workspace, "prompt.txt");

  await mkdir(workspace, { recursive: true });
  for (const mount of runtimeMounts) {
    if (mount.kind === "cache") {
      await mkdir(cachePath(config, mount), { recursive: true });
    }
  }
  await writeFile(scriptPath, await dockerTaskScript(), { mode: 0o755 });
  await writeFile(promptPath, [
    ...renderRuntimeContextPrompt(runtime),
    "",
    "User task:",
    job.spec.prompt,
    "",
    "Requirements:",
    "- Implement the requested change in this repository.",
    "- Run the relevant local tests or type checks before finishing.",
    "- Leave the final work committed by Mystra after you finish; do not create the MR yourself.",
  ].join("\n"));

  console.log(`[mystra-runner] docker claimed job=${job.id} run=${run.id} task=${job.spec.taskId}`);
  await emitEvent(config, token, run.id, "container.starting", {
    executor: "docker",
    image,
    projectSlug: project.slug,
  });

  const containerName = `mystra-${run.id}`;
  const containerEnv: NodeJS.ProcessEnv = {
    ...process.env,
    MYSTRA_GITLAB_TOKEN: gitlabToken,
  };
  const dockerArgs = [
    "run",
    "-d",
    "--name",
    containerName,
    "-e",
    "MYSTRA_SKILLS_DIR=/mystra/skills",
    "-e",
    `MYSTRA_TASK_ID=${job.spec.taskId}`,
    "-e",
    `MYSTRA_REPO=${job.spec.repo}`,
    "-e",
    `MYSTRA_GITLAB_HTTP_BASE_URL=${config.gitlabHttpBaseUrl ?? ""}`,
    "-e",
    "MYSTRA_GIT_REFERENCE_PATH=/mystra/cache/git/repo.git",
    "-e",
    `MYSTRA_BASE_BRANCH=${job.spec.baseBranch}`,
    "-e",
    `MYSTRA_BRANCH_NAME=${job.spec.branchName}`,
    "-e",
    `MYSTRA_AGENT=${job.spec.agent}`,
    "-e",
    `MYSTRA_PROMPT=${job.spec.prompt}`,
    "-e",
    `MYSTRA_MR_TITLE=${job.spec.mergeRequest?.title ?? `Mystra task ${job.spec.taskId}`}`,
    "-e",
    `MYSTRA_MR_BODY=${job.spec.mergeRequest?.body ?? job.spec.prompt}`,
    "-e",
    `MYSTRA_COMMIT_MESSAGE=${job.spec.mergeRequest?.title ?? `Mystra task ${job.spec.taskId}`}`,
    "-e",
    `MYSTRA_GIT_AUTHOR_NAME=${process.env.MYSTRA_GIT_AUTHOR_NAME ?? "Mystra Runner"}`,
    "-e",
    `MYSTRA_GIT_AUTHOR_EMAIL=${process.env.MYSTRA_GIT_AUTHOR_EMAIL ?? "mystra-runner@example.invalid"}`,
    "-e",
    "RESULT_FILE=/mystra/workspace/result.json",
    "-e",
    "PNPM_STORE_DIR=/mystra/cache/pnpm-store",
    "-e",
    "NPM_CONFIG_STORE_DIR=/mystra/cache/pnpm-store",
    "-e",
    "npm_config_store_dir=/mystra/cache/pnpm-store",
    "-e",
    "UV_CACHE_DIR=/mystra/cache/uv",
    "-e",
    "UV_PYTHON_INSTALL_DIR=/mystra/cache/uv-python",
    "-e",
    "UV_LINK_MODE=copy",
  ];
  appendRuntimePorts(dockerArgs, runtimePorts);
  appendRuntimeSecrets(dockerArgs, containerEnv, runtimeSecrets);
  appendRuntimeMounts(dockerArgs, config, workspace, gitMirror, runtimeMounts);

  if (job.spec.agent === "codex" && config.codexAuthDir) {
    dockerArgs.push("-v", `${config.codexAuthDir}:/root/.codex`);
  }
  if (process.env.COPILOT_GITHUB_TOKEN) {
    // Copilot auth works from the forwarded token; avoid inheriting host MCP config.
    dockerArgs.push("-e", "COPILOT_GITHUB_TOKEN");
  }
  appendContainerProxyEnv(dockerArgs, config, job.spec.repo);

  dockerArgs.push(image, "sleep", "infinity");

  let terminalOverride: DockerResult | undefined;
  let cancellationRequested = Boolean(run.cancellationRequest);
  let executionTimedOut = false;
  let cleanupRequired = false;

  try {
    const containerId = await runCommandCapture("docker", dockerArgs, {
      env: containerEnv,
    });
    const frontendContainerPort = previewPort(runtimePorts, "frontend", 3000);
    const backendContainerPort = previewPort(runtimePorts, "backend", 8000);
    const frontendPort = frontendContainerPort
      ? await runCommandCapture("docker", ["port", containerName, `${frontendContainerPort}/tcp`])
      : "";
    const backendPort = backendContainerPort
      ? await runCommandCapture("docker", ["port", containerName, `${backendContainerPort}/tcp`])
      : "";
    const frontendUrl = frontendPort ? `http://${config.previewHost}:${frontendPort.split(":").at(-1)}` : null;
    const backendUrl = backendPort ? `http://${config.previewHost}:${backendPort.split(":").at(-1)}` : null;

    await emitEvent(config, token, run.id, "container.started", {
      executor: "docker",
      image,
      projectSlug: project.slug,
      containerId,
      containerName,
      frontendUrl,
      backendUrl,
    });

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
        cancellationRequested = true;
        executionAbort.abort();
      },
    );

    if (cancellationRequested) {
      executionAbort.abort();
    }

    let workflowDockerResult: DockerResult | undefined;
    let workflowStarted = false;
    let workflowLifecycleData: {
      provider: string;
      blueprintName: string;
      blueprintVersion: string;
    } = {
      provider: "local",
      blueprintName: "mvp.coding",
      blueprintVersion: "1.0.0",
    };
    try {
      const { provider: workflowProvider, blueprint: workflowBlueprint } = workflowRegistry.resolve(
        config.workflowProviderName,
        config.workflowBlueprintName,
      );
      workflowLifecycleData = {
        provider: workflowProvider.providerName,
        blueprintName: workflowBlueprint.name,
        blueprintVersion: workflowBlueprint.version,
      };

      await emitWorkflowLifecycleEvent(
        config,
        token,
        run.id,
        "workflow.start_requested",
        {
          ...workflowLifecycleData,
          entryNodes: workflowBlueprint.entryNodes,
          nodeCount: workflowBlueprint.nodes.length,
        },
      );

      await emitWorkflowLifecycleEvent(
        config,
        token,
        run.id,
        "workflow.started",
        {
          ...workflowLifecycleData,
          entryNodes: workflowBlueprint.entryNodes,
          nodeCount: workflowBlueprint.nodes.length,
        },
      );
      workflowStarted = true;

      const workflowResult = await workflowProvider.executeBlueprint(workflowBlueprint, {
        workflowInput: {
          repo: job.spec.repo,
          prompt: job.spec.prompt,
          branchName: job.spec.branchName,
        },
        signal: executionAbort.signal,
        handlers: {
          "git.clone": async (_inputs, context) => {
            await emitWorkflowNodeEvent(config, token, run.id, "started", context.node);
            try {
              const output = await executeContainerWorkflowStep<CloneStepOutput>({
                containerName,
                stepCommand: "clone",
                nodeId: "clone",
                workspace,
                env: {
                  ...process.env,
                  MYSTRA_GITLAB_TOKEN: gitlabToken,
                },
                signal: executionAbort.signal,
                frontendUrl,
                backendUrl,
              });
              await emitWorkflowNodeEvent(config, token, run.id, "succeeded", context.node, {
                baseCommit: output.baseCommit,
              });
              return { ...output };
            } catch (error) {
              await emitWorkflowNodeEvent(config, token, run.id, "failed", context.node, {
                summary: error instanceof Error ? error.message : String(error),
              }, "error");
              throw error;
            }
          },
          "agent.execute": async (_inputs, context) => {
            await emitWorkflowNodeEvent(config, token, run.id, "started", context.node, {
              agent: job.spec.agent,
            });
            await emitEvent(config, token, run.id, "agent.started", {
              agent: job.spec.agent,
            });
            try {
              const output = await executeContainerWorkflowStep<AgentStepOutput>({
                containerName,
                stepCommand: "agent",
                nodeId: "agent",
                workspace,
                env: {
                  ...process.env,
                  MYSTRA_GITLAB_TOKEN: gitlabToken,
                },
                signal: executionAbort.signal,
                frontendUrl,
                backendUrl,
              });
              if (output.noChanges) {
                await emitWorkflowNodeEvent(config, token, run.id, "failed", context.node, {
                  summary: "Agent finished without repository changes",
                }, "error");
                throw new Error("Agent finished without repository changes");
              }
              await emitWorkflowNodeEvent(config, token, run.id, "succeeded", context.node, {
                changedFilesCount: output.changedFiles.length,
              });
              return { ...output };
            } catch (error) {
              if (!(error instanceof Error && error.message === "Agent finished without repository changes")) {
                await emitWorkflowNodeEvent(config, token, run.id, "failed", context.node, {
                  summary: error instanceof Error ? error.message : String(error),
                }, "error");
              }
              throw error;
            }
          },
          "quality_gate.run": async (_inputs, context) => {
            await emitWorkflowNodeEvent(config, token, run.id, "started", context.node);
            try {
              const output = await executeContainerWorkflowStep<QualityGateStepOutput>({
                containerName,
                stepCommand: "quality-gate",
                nodeId: "quality_gate",
                workspace,
                env: {
                  ...process.env,
                  MYSTRA_GITLAB_TOKEN: gitlabToken,
                },
                signal: executionAbort.signal,
                frontendUrl,
                backendUrl,
              });
              await emitEvent(
                config,
                token,
                run.id,
                `quality_gate.${output.status}`,
                {
                  sequence: ["test", "build"],
                  logPath: "/mystra/workspace/quality-gate.log",
                },
                output.status === "passed" ? "info" : "error",
              );
              if (output.status !== "passed") {
                await emitWorkflowNodeEvent(config, token, run.id, "failed", context.node, {
                  summary: output.summary ?? "Quality gate failed",
                }, "error");
                throw new Error(output.summary ?? "Quality gate failed");
              }
              await emitWorkflowNodeEvent(config, token, run.id, "succeeded", context.node, {
                sequence: ["test", "build"],
              });
              return { ...output };
            } catch (error) {
              if (!(error instanceof Error && (error.message === "Quality gate failed" || error.message.includes("Quality gate failed")))) {
                await emitWorkflowNodeEvent(config, token, run.id, "failed", context.node, {
                  summary: error instanceof Error ? error.message : String(error),
                }, "error");
              }
              throw error;
            }
          },
          "git.push": async (_inputs, context) => {
            await emitWorkflowNodeEvent(config, token, run.id, "started", context.node);
            try {
              const output = await executeContainerWorkflowStep<PushStepOutput>({
                containerName,
                stepCommand: "push",
                nodeId: "push",
                workspace,
                env: {
                  ...process.env,
                  MYSTRA_GITLAB_TOKEN: gitlabToken,
                },
                signal: executionAbort.signal,
                frontendUrl,
                backendUrl,
              });
              await emitEvent(config, token, run.id, "git.push_succeeded", {
                branchName: output.branchName,
              });
              await emitWorkflowNodeEvent(config, token, run.id, "succeeded", context.node, {
                branchName: output.branchName,
              });
              return { ...output };
            } catch (error) {
              await emitWorkflowNodeEvent(config, token, run.id, "failed", context.node, {
                summary: error instanceof Error ? error.message : String(error),
              }, "error");
              throw error;
            }
          },
          "review.create": async (_inputs, context) => {
            await emitWorkflowNodeEvent(config, token, run.id, "started", context.node);
            try {
              const output = await executeContainerWorkflowStep<DockerResult>({
                containerName,
                stepCommand: "review-create",
                nodeId: "review_create",
                workspace,
                env: {
                  ...process.env,
                  MYSTRA_GITLAB_TOKEN: gitlabToken,
                },
                signal: executionAbort.signal,
                frontendUrl,
                backendUrl,
              });
              if (output.status === "succeeded") {
                await emitEvent(config, token, run.id, "mr.created", {
                  mrUrl: output.mrUrl,
                  mrIid: output.mrIid,
                });
                await emitWorkflowNodeEvent(config, token, run.id, "succeeded", context.node, {
                  mrUrl: output.mrUrl,
                  mrIid: output.mrIid,
                });
                return {
                  reviewUrl: output.mrUrl ?? "",
                  mrIid: output.mrIid ?? 0,
                };
              }
              throw new Error(output.errorMessage ?? output.summary);
            } catch (error) {
              await emitWorkflowNodeEvent(config, token, run.id, "failed", context.node, {
                summary: error instanceof Error ? error.message : String(error),
              }, "error");
              throw error;
            }
          },
        },
      });

      workflowDockerResult = workflowResult.status === "succeeded"
        ? await readWorkflowStepOutput<DockerResult>(workflowStepOutputHostPath(workspace, "review_create"))
        : await resultFromWorkflowExecution(
          workspace,
          job.spec.branchName,
          workflowResult.failedNodeId,
          workflowResult.errorMessage,
        );
    } catch (error) {
      if (!workflowStarted && !cancellationRequested && !executionTimedOut && !executionAbort.signal.aborted) {
        await emitWorkflowLifecycleEvent(
          config,
          token,
          run.id,
          "workflow.start_failed",
          {
            ...workflowLifecycleData,
            summary: error instanceof Error ? error.message : String(error),
          },
          "error",
        );
      }
      if (cancellationRequested || executionTimedOut || executionAbort.signal.aborted) {
        cleanupRequired = true;
      } else {
        throw error;
      }
    } finally {
      executionActive = false;
      pollStop.abort();
      clearTimeout(timeout);
      await cancellationPoll;
    }

    if (cleanupRequired) {
      const reason = executionTimedOut ? "timeout" : "cancel";
      await emitEvent(config, token, run.id, "cleanup.started", { reason }, "warn");
      try {
        await runCommand("docker", [
          "stop",
          "--time",
          String(config.cleanupTimeoutSeconds),
          containerName,
        ]);
      } catch (error) {
        captureException(error);
        await emitEvent(config, token, run.id, "run.cleanup_failed", {
          reason,
          errorMessage: error instanceof Error ? error.message : String(error),
        }, "error");
        terminalOverride = {
          status: "failed",
          summary: `Docker cleanup failed after ${reason}.`,
          branch: job.spec.branchName,
          errorCode: "cleanup_failed",
          errorMessage: error instanceof Error ? error.message : String(error),
        };
      }

      terminalOverride ??= {
        status: executionTimedOut ? "timed_out" : "canceled",
        summary: executionTimedOut
          ? `Docker task exceeded ${config.defaultExecutionTimeoutSeconds}s execution timeout.`
          : "Docker task was canceled and cleaned up.",
        branch: job.spec.branchName,
      };
    }

    const result = terminalOverride ?? workflowDockerResult ?? {
      status: "failed",
      summary: "Docker task failed before writing a result",
      branch: job.spec.branchName,
      errorCode: "missing_result",
      errorMessage: "Workflow execution did not produce a terminal result",
    };

    await emitQualityGateEvent(config, token, run.id, result);
    await postJson(apiUrl(config, `/api/runner/jobs/${run.id}/result`), result, token);
    await rm(scriptPath, { force: true });
    console.log(`[mystra-runner] docker completed run=${run.id} status=${result.status}`);
  } catch (error) {
    captureException(error);
    console.error(error);
    const result: DockerResult = {
      status: "failed",
      summary: "Docker workflow execution failed before writing a result",
      branch: job.spec.branchName,
      errorCode: "workflow_failed",
      errorMessage: error instanceof Error ? error.message : String(error),
    };
    await emitQualityGateEvent(config, token, run.id, result);
    await postJson(apiUrl(config, `/api/runner/jobs/${run.id}/result`), result, token);
    await rm(scriptPath, { force: true });
  }
}

async function executeJob(
  config: RunnerConfig,
  token: string,
  claim: ClaimedJobResponse,
  workflowRegistry?: RunnerWorkflowProviderRegistry,
): Promise<void> {
  if (config.executor === "docker") {
    if (!workflowRegistry) {
      throw new Error("Workflow registry must be initialized before executing Docker jobs");
    }
    await executeDockerJob(config, token, claim, workflowRegistry);
    return;
  }
  await executeFakeJob(config, token, claim);
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolveSleep) => {
    const timeout = setTimeout(resolveSleep, ms);
    const abort = () => {
      clearTimeout(timeout);
      resolveSleep();
    };
    if (signal?.aborted) {
      abort();
      return;
    }
    signal?.addEventListener("abort", abort, { once: true });
  });
}

async function main(): Promise<void> {
  initSentry("mystra-runner");
  const config = readConfig();
  const workflowRegistry = config.executor === "docker"
    ? await createRunnerWorkflowProviderRegistry({
      moduleSpecifiers: config.workflowProviderModules,
      blueprintFiles: config.workflowBlueprintFiles,
    })
    : undefined;
  const registration = await register(config);
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
      const activeJob = executeJob(config, registration.runnerToken, claim, workflowRegistry)
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
      await Promise.race([...activeJobs, sleep(config.pollIntervalSeconds * 1000)]);
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
