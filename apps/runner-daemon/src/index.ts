import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { networkInterfaces, tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import type { ResolvedRuntimeContract } from "@mystra/shared";
import { captureException, flushSentry, initSentry } from "./sentry.js";

interface RunnerConfig {
  controlPlaneUrl: string;
  runnerName: string;
  once: boolean;
  executor: "fake" | "docker";
  workspaceRoot: string;
  cacheRoot: string;
  codexAuthDir: string | undefined;
  gitlabHttpBaseUrl: string | undefined;
  previewHost: string;
  containerProxyUrl: string | undefined;
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
  } | null;
  project: {
    id: string;
    slug: string;
    prewarmConfig: Record<string, unknown>;
  } | null;
  runtime: ResolvedRuntimeContract | null;
}

interface DockerResult {
  status: "succeeded" | "failed";
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

function readConfig(): RunnerConfig {
  return {
    controlPlaneUrl: process.env.MYSTRA_CONTROL_PLANE_URL ?? "http://localhost:3000",
    runnerName: process.env.MYSTRA_RUNNER_NAME ?? "local-runner",
    once: process.env.MYSTRA_RUNNER_ONCE === "1",
    executor: process.env.MYSTRA_EXECUTOR === "docker" ? "docker" : "fake",
    workspaceRoot: process.env.MYSTRA_WORKSPACE_ROOT ?? path.join(tmpdir(), "mystra-workspaces"),
    cacheRoot: process.env.MYSTRA_CACHE_ROOT ?? path.join(process.env.HOME ?? tmpdir(), ".mystra", "cache"),
    codexAuthDir: process.env.MYSTRA_CODEX_AUTH_DIR,
    gitlabHttpBaseUrl: process.env.MYSTRA_GITLAB_HTTP_BASE_URL,
    previewHost: process.env.MYSTRA_PREVIEW_HOST ?? detectPreviewHost(),
    containerProxyUrl: process.env.MYSTRA_CONTAINER_PROXY_URL ?? defaultContainerProxyUrl(),
  };
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
    maxConcurrency: 1,
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

function runCommand(command: string, args: string[], options: {
  env?: NodeJS.ProcessEnv;
  cwd?: string;
} = {}): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env ?? process.env,
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
  const resultPath = path.join(workspace, "result.json");

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
    `MYSTRA_QUALITY_FIX_ATTEMPTS=${process.env.MYSTRA_QUALITY_FIX_ATTEMPTS ?? "2"}`,
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
    await emitEvent(config, token, run.id, "agent.started", {
      agent: job.spec.agent,
    });
    await runCommand("docker", [
      "exec",
      "-e",
      `MYSTRA_FRONTEND_PREVIEW_URL=${frontendUrl}`,
      "-e",
      `MYSTRA_BACKEND_PREVIEW_URL=${backendUrl}`,
      containerName,
      "bash",
      "/mystra/workspace/task.sh",
    ], {
      env: {
        ...process.env,
        MYSTRA_GITLAB_TOKEN: gitlabToken,
      },
    });
  } catch (error) {
    captureException(error);
    console.error(error);
  }

  let result: DockerResult;
  try {
    result = JSON.parse(await readFile(resultPath, "utf8")) as DockerResult;
  } catch (error) {
    result = {
      status: "failed",
      summary: "Docker task failed before writing a result",
      branch: job.spec.branchName,
      errorCode: "missing_result",
      errorMessage: error instanceof Error ? error.message : String(error),
    };
  }

  await emitQualityGateEvent(config, token, run.id, result);
  await postJson(apiUrl(config, `/api/runner/jobs/${run.id}/result`), result, token);
  await rm(scriptPath, { force: true });
  console.log(`[mystra-runner] docker completed run=${run.id} status=${result.status}`);
}

async function executeJob(
  config: RunnerConfig,
  token: string,
  claim: ClaimedJobResponse,
): Promise<void> {
  if (config.executor === "docker") {
    await executeDockerJob(config, token, claim);
    return;
  }
  await executeFakeJob(config, token, claim);
}

async function main(): Promise<void> {
  initSentry("mystra-runner");
  const config = readConfig();
  const registration = await register(config);
  console.log(
    `[mystra-runner] registered ${config.runnerName} session=${registration.runnerSessionId} executor=${config.executor}`,
  );

  while (true) {
    await postJson(apiUrl(config, "/api/runner/heartbeat"), {}, registration.runnerToken);
    const claim = await getJson<ClaimedJobResponse>(
      apiUrl(config, "/api/runner/jobs"),
      registration.runnerToken,
    );

    if (claim.job && claim.run) {
      await executeJob(config, registration.runnerToken, claim);
      if (config.once) {
        return;
      }
    } else if (config.once) {
      console.log("[mystra-runner] no queued job found");
      return;
    }
  }
}

main().catch((error: unknown) => {
  captureException(error);
  console.error(error);
  void flushSentry();
  process.exitCode = 1;
});
