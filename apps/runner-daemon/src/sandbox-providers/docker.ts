import type { ResolvedRuntimeContract, SandboxOutcome } from "@mystra/shared";
import { spawn } from "node:child_process";

import type {
  SandboxCollectOutcomeContext,
  SandboxInspectContext,
  SandboxLaunchContext,
  SandboxProvider,
  SandboxStopContext,
} from "../sandbox-providers.js";

export interface DockerSandboxProjectionOptions {
  sessionId: string;
  startedAt: string;
  finishedAt: string;
  retained: boolean;
  cleanupStatus: "succeeded" | "failed" | "skipped";
  cleanupAttemptedAt: string;
  cleanupErrorMessage?: string;
  runtimePorts: ResolvedRuntimeContract["exposedPorts"];
  frontendPortOutput: string;
  backendPortOutput: string;
  frontendUrl: string | null;
  backendUrl: string | null;
}

function runCommand(command: string, args: string[], options: {
  env?: NodeJS.ProcessEnv;
} = {}): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
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
} = {}): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const errorChunks: Buffer[] = [];
    const child = spawn(command, args, {
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

function buildDockerSandboxOutcome(options: DockerSandboxProjectionOptions & {
  status: SandboxOutcome["status"];
}): SandboxOutcome {
  return {
    status: options.status,
    session: {
      provider: "docker",
      sessionId: options.sessionId,
      status: options.cleanupStatus === "failed"
        ? "cleanup_failed"
        : options.retained
          ? "retained"
          : "stopped",
      startedAt: options.startedAt,
      finishedAt: options.finishedAt,
      retained: options.retained,
    },
    ports: buildDockerSandboxPorts(
      options.runtimePorts,
      options.frontendPortOutput,
      options.backendPortOutput,
      options.frontendUrl,
      options.backendUrl,
    ),
    cleanup: {
      status: options.cleanupStatus,
      attemptedAt: options.cleanupAttemptedAt,
      ...(options.cleanupStatus === "failed"
        ? {
          errorCode: "cleanup_failed",
          ...(options.cleanupErrorMessage ? { errorMessage: options.cleanupErrorMessage } : {}),
        }
        : {}),
    },
    metadata: {},
  };
}

export const dockerSandboxProvider: SandboxProvider = {
  providerName: "docker",
  async launch(input, context?: SandboxLaunchContext) {
    if (!context?.dockerArgs || !context.containerName) {
      throw new Error("Docker sandbox launch requires dockerArgs and containerName context");
    }

    await runCommandCapture("docker", context.dockerArgs, context.env ? {
      env: context.env,
    } : {});

    return {
      provider: "docker",
      sessionId: context.containerName,
      status: "running",
      startedAt: new Date().toISOString(),
      retained: input.retentionPolicy === "retain_for_preview",
    };
  },
  async inspect(session, context?: SandboxInspectContext) {
    const frontendContainerPort = (context?.runtimePorts ?? []).find((port) => port.name === "frontend" || port.containerPort === 3000)?.containerPort;
    const backendContainerPort = (context?.runtimePorts ?? []).find((port) => port.name === "backend" || port.containerPort === 8000)?.containerPort;
    const frontendPortOutput = frontendContainerPort
      ? await runCommandCapture("docker", ["port", session.sessionId, `${frontendContainerPort}/tcp`]).catch(() => "")
      : "";
    const backendPortOutput = backendContainerPort
      ? await runCommandCapture("docker", ["port", session.sessionId, `${backendContainerPort}/tcp`]).catch(() => "")
      : "";
    const frontendUrl = previewUrl(context?.previewHost, frontendPortOutput);
    const backendUrl = previewUrl(context?.previewHost, backendPortOutput);

    return {
      session,
      ports: buildDockerSandboxPorts(
        context?.runtimePorts ?? [],
        frontendPortOutput,
        backendPortOutput,
        frontendUrl,
        backendUrl,
      ),
      metadata: {
        ...(frontendUrl ? { frontendUrl } : {}),
        ...(backendUrl ? { backendUrl } : {}),
      },
    };
  },
  async stop(session, _reason, context?: SandboxStopContext) {
    const attemptedAt = new Date().toISOString();
    try {
      await runCommand("docker", [
        "stop",
        "--time",
        String(context?.cleanupTimeoutSeconds ?? 30),
        session.sessionId,
      ]);
      return {
        status: "succeeded",
        attemptedAt,
      };
    } catch (error) {
      return {
        status: "failed",
        attemptedAt,
        errorCode: "cleanup_failed",
        errorMessage: error instanceof Error ? error.message : String(error),
      };
    }
  },
  async collectOutcome(session, context?: SandboxCollectOutcomeContext) {
    const observation = context?.observation ?? {
      session,
      ports: [],
      metadata: {},
    };
    const cleanup = context?.cleanup ?? {
      status: "skipped" as const,
      attemptedAt: context?.finishedAt ?? new Date().toISOString(),
    };
    const frontendPort = observation.ports.find((port) => port.name === "frontend" || port.containerPort === 3000);
    const backendPort = observation.ports.find((port) => port.name === "backend" || port.containerPort === 8000);

    return buildDockerSandboxOutcome({
      status: context?.status ?? "failed",
      sessionId: session.sessionId,
      startedAt: session.startedAt,
      finishedAt: context?.finishedAt ?? new Date().toISOString(),
      retained: context?.retained ?? session.retained,
      cleanupStatus: cleanup.status,
      cleanupAttemptedAt: cleanup.attemptedAt,
      ...(cleanup.errorMessage ? { cleanupErrorMessage: cleanup.errorMessage } : {}),
      runtimePorts: observation.ports.map((port) => ({
        containerPort: port.containerPort,
        ...(port.name ? { name: port.name } : {}),
        ...(port.hostBinding ? { hostBinding: port.hostBinding } : {}),
      })),
      frontendPortOutput: frontendPort?.hostBinding ?? "",
      backendPortOutput: backendPort?.hostBinding ?? "",
      frontendUrl: frontendPort?.url ?? null,
      backendUrl: backendPort?.url ?? null,
    });
  },
};

export const sandboxProviders = {
  docker: dockerSandboxProvider,
} as const;

function trimHostBinding(portOutput: string): string | undefined {
  const trimmed = portOutput.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function previewUrl(previewHost: string | undefined, portOutput: string): string | null {
  const hostBinding = trimHostBinding(portOutput);
  const hostPort = hostBinding?.split(":").at(-1);
  return hostPort && previewHost ? `http://${previewHost}:${hostPort}` : null;
}

export function buildDockerSandboxPorts(
  runtimePorts: ResolvedRuntimeContract["exposedPorts"],
  frontendPortOutput: string,
  backendPortOutput: string,
  frontendUrl: string | null,
  backendUrl: string | null,
): SandboxOutcome["ports"] {
  const frontendHostBinding = trimHostBinding(frontendPortOutput);
  const backendHostBinding = trimHostBinding(backendPortOutput);

  return runtimePorts.map((port) => {
    const isFrontend = port.name === "frontend" || port.containerPort === 3000;
    const isBackend = port.name === "backend" || port.containerPort === 8000;
    const resolvedHostBinding = isFrontend
      ? frontendHostBinding ?? port.hostBinding
      : isBackend
        ? backendHostBinding ?? port.hostBinding
        : port.hostBinding;
    const resolvedUrl = isFrontend
      ? frontendUrl ?? undefined
      : isBackend
        ? backendUrl ?? undefined
        : undefined;

    return {
      ...(port.name ? { name: port.name } : {}),
      containerPort: port.containerPort,
      ...(resolvedHostBinding ? { hostBinding: resolvedHostBinding } : {}),
      ...(resolvedUrl ? { url: resolvedUrl } : {}),
      reachable: Boolean(resolvedUrl),
    };
  });
}

export function attachDockerSandboxOutcome<T extends { status: SandboxOutcome["status"] }>(
  result: T,
  options: DockerSandboxProjectionOptions,
): T & { sandboxOutcome: SandboxOutcome } {
  return {
    ...result,
    sandboxOutcome: buildDockerSandboxOutcome({
      ...options,
      status: result.status,
    }),
  };
}
