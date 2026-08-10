import { homedir, hostname } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  hostHeartbeatResponseSchema,
  hostRuntimeRegistrationResponseSchema,
  type HostRuntimeRegistration,
  type ProviderCapability,
} from "@mystra/shared";

import { discoverProviderCapabilities } from "./provider-discovery.js";
import {
  buildHostRuntimeRegistrationPayload,
  defaultRunnerIdPath,
  getStableRunnerId,
} from "./registration.js";
import { captureException, flushSentry, initSentry } from "./sentry.js";
import { WorkspaceMaterializer } from "./workspace-materializer.js";
import { HttpWorkspaceControlPlaneClient, runWorkspaceLoop } from "./workspace-loop.js";
import { HttpSessionControlPlaneClient } from "./session/session-client.js";
import { runSessionLoop } from "./session/session-loop.js";

export const DEFAULT_HEARTBEAT_INTERVAL_SECONDS = 15;
export const DEFAULT_DISCOVERY_INTERVAL_SECONDS = 60;
export const DEFAULT_RETRY_INTERVAL_SECONDS = 5;

interface RunnerConfig {
  endpoint: string;
  name: string;
  runnerIdPath: string;
  heartbeatIntervalSeconds: number;
  discoveryIntervalSeconds: number;
  retryIntervalSeconds: number;
  workspaceRoot: string;
  workspacePollWaitSeconds: number;
  once: boolean;
}

class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly responseText: string,
  ) {
    super(`Control plane responded with ${status}: ${responseText}`);
  }
}

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

function endpointFromArgs(): string | undefined {
  const endpointIndex = process.argv.indexOf("--endpoint");
  if (endpointIndex === -1) {
    return undefined;
  }
  const endpoint = process.argv[endpointIndex + 1];
  if (!endpoint || endpoint.startsWith("-")) {
    throw new Error("--endpoint requires a URL");
  }
  return endpoint;
}

function boundedNonNegativeIntEnv(name: string, fallback: number, maximum: number): number {
  const value = process.env[name];
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > maximum) {
    throw new Error(`${name} must be an integer between 0 and ${maximum}`);
  }
  return parsed;
}

function readConfig(): RunnerConfig {
  const endpoint = endpointFromArgs()
    ?? process.env.MYSTRA_RUNNER_ENDPOINT
    ?? process.env.MYSTRA_CONTROL_PLANE_URL
    ?? "http://localhost:3000";
  new URL(endpoint);

  return {
    endpoint,
    name: process.env.MYSTRA_RUNNER_NAME ?? hostname(),
    runnerIdPath: process.env.MYSTRA_RUNNER_ID_PATH ?? defaultRunnerIdPath,
    heartbeatIntervalSeconds: positiveIntEnv(
      "MYSTRA_RUNNER_HEARTBEAT_INTERVAL_SECONDS",
      DEFAULT_HEARTBEAT_INTERVAL_SECONDS,
    ),
    discoveryIntervalSeconds: positiveIntEnv(
      "MYSTRA_RUNNER_DISCOVERY_INTERVAL_SECONDS",
      DEFAULT_DISCOVERY_INTERVAL_SECONDS,
    ),
    retryIntervalSeconds: positiveIntEnv(
      "MYSTRA_RUNNER_RETRY_INTERVAL_SECONDS",
      DEFAULT_RETRY_INTERVAL_SECONDS,
    ),
    workspaceRoot: path.resolve(
      process.env.MYSTRA_RUNNER_WORKSPACE_ROOT ?? path.join(homedir(), ".mystra", "workspaces"),
    ),
    workspacePollWaitSeconds: boundedNonNegativeIntEnv(
      "MYSTRA_RUNNER_WORKSPACE_POLL_WAIT_SECONDS",
      25,
      25,
    ),
    once: process.env.MYSTRA_RUNNER_ONCE === "1",
  };
}

async function postJson(pathname: string, endpoint: string, payload: unknown): Promise<unknown> {
  const response = await fetch(new URL(pathname, endpoint), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const responseText = await response.text();
  if (!response.ok) {
    throw new HttpError(response.status, responseText);
  }
  return responseText ? JSON.parse(responseText) : {};
}

function sleep(milliseconds: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timeout);
      reject(signal?.reason ?? new Error("Runner stopped"));
    };
    const timeout = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, milliseconds);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export async function retryUntilReachable<T>(
  operation: () => Promise<T>,
  label: string,
  retryIntervalSeconds: number,
  signal: AbortSignal,
  retryNotFound = false,
): Promise<T> {
  while (!signal.aborted) {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof HttpError && error.status === 404 && !retryNotFound) {
        throw error;
      }
      captureException(error);
      console.error(`[mystra-runner] ${label} failed; retrying:`, error);
      await sleep(retryIntervalSeconds * 1_000, signal);
    }
  }
  throw signal.reason ?? new Error("Runner stopped");
}

function providerSetChanged(
  previous: ProviderCapability[],
  next: ProviderCapability[],
): boolean {
  return JSON.stringify(previous) !== JSON.stringify(next);
}

async function register(
  config: RunnerConfig,
  runnerId: string,
  providers: ProviderCapability[],
): Promise<{ runtimeId: string }> {
  const payload: HostRuntimeRegistration = buildHostRuntimeRegistrationPayload({
    runnerId,
    name: config.name,
    platform: `${process.platform}/${process.arch}`,
    providers,
  });
  return hostRuntimeRegistrationResponseSchema.parse(
    await postJson("/api/runner/register", config.endpoint, payload),
  );
}

async function heartbeat(config: RunnerConfig, runnerId: string): Promise<void> {
  hostHeartbeatResponseSchema.parse(
    await postJson("/api/runner/heartbeat", config.endpoint, { runnerId }),
  );
}

async function reportProviders(
  config: RunnerConfig,
  runnerId: string,
  providers: ProviderCapability[],
): Promise<void> {
  await postJson("/api/runner/providers", config.endpoint, { runnerId, providers });
}

export async function runDaemon(
  config: RunnerConfig,
  signal: AbortSignal,
): Promise<void> {
  const runnerId = await getStableRunnerId({ filePath: config.runnerIdPath });
  let providers = await discoverProviderCapabilities();
  let runtimeId = "";

  const registerRunner = async (): Promise<void> => {
    const response = await retryUntilReachable(
      () => register(config, runnerId, providers),
      "registration",
      config.retryIntervalSeconds,
      signal,
      true,
    );
    runtimeId = response.runtimeId;
  };

  await registerRunner();
  console.log(`[mystra-runner] registered runtime=${runtimeId} runnerId=${runnerId}`);
  if (config.once) {
    return;
  }

  const materializer = new WorkspaceMaterializer({ root: config.workspaceRoot });
  const workspaceLoop = runWorkspaceLoop({
    runnerId,
    client: new HttpWorkspaceControlPlaneClient(config.endpoint),
    materializer,
    waitSeconds: config.workspacePollWaitSeconds,
    retryIntervalSeconds: config.retryIntervalSeconds,
    signal,
  });
  const sessionLoop = runSessionLoop({
    runtimeId,
    runnerId,
    client: new HttpSessionControlPlaneClient(config.endpoint),
    workspace: materializer,
    waitSeconds: config.workspacePollWaitSeconds,
    retryIntervalSeconds: config.retryIntervalSeconds,
    signal,
  });

  let nextHeartbeatAt = Date.now();
  let nextDiscoveryAt = Date.now() + config.discoveryIntervalSeconds * 1_000;
  while (!signal.aborted) {
    const now = Date.now();
    if (now >= nextHeartbeatAt) {
      try {
        await retryUntilReachable(
          () => heartbeat(config, runnerId),
          "heartbeat",
          config.retryIntervalSeconds,
          signal,
        );
      } catch (error) {
        if (!(error instanceof HttpError) || error.status !== 404) {
          throw error;
        }
        await registerRunner();
      }
      nextHeartbeatAt = Date.now() + config.heartbeatIntervalSeconds * 1_000;
    }

    if (Date.now() >= nextDiscoveryAt) {
      const nextProviders = await discoverProviderCapabilities();
      if (providerSetChanged(providers, nextProviders)) {
        providers = nextProviders;
        try {
          await retryUntilReachable(
            () => reportProviders(config, runnerId, providers),
            "provider report",
            config.retryIntervalSeconds,
            signal,
          );
        } catch (error) {
          if (!(error instanceof HttpError) || error.status !== 404) {
            throw error;
          }
          await registerRunner();
        }
      }
      nextDiscoveryAt = Date.now() + config.discoveryIntervalSeconds * 1_000;
    }

    await sleep(
      Math.max(1, Math.min(nextHeartbeatAt, nextDiscoveryAt) - Date.now()),
      signal,
    );
  }
  await workspaceLoop;
  await sessionLoop;
}

async function main(): Promise<void> {
  initSentry("mystra-runner");
  const controller = new AbortController();
  const stop = () => controller.abort(new Error("Runner stopped"));
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);

  try {
    await runDaemon(readConfig(), controller.signal);
  } finally {
    process.off("SIGINT", stop);
    process.off("SIGTERM", stop);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    if (error instanceof Error && error.message === "Runner stopped") {
      return;
    }
    captureException(error);
    console.error(error);
    void flushSentry();
    process.exitCode = 1;
  });
}
