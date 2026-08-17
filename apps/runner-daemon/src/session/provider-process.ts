import { spawn } from "node:child_process";

import type { ProviderProcessResult, ProviderSessionCommand } from "@mystra/agent-adapters";

const MAX_CAPTURED_PROVIDER_OUTPUT = 1_048_576;

export type ProviderProcessObserver = {
  onStdoutChunk?(chunk: string): void;
};

export function runProviderProcess(
  command: ProviderSessionCommand,
  signal?: AbortSignal,
  observer?: ProviderProcessObserver,
): Promise<ProviderProcessResult> {
  const [executable, ...args] = command.argv;
  if (!executable) throw new Error("Provider command is empty");
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      cwd: command.workingDirectory,
      env: { ...process.env, ...command.environment },
      stdio: ["ignore", "pipe", "pipe"],
      signal,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout = appendBounded(stdout, chunk);
      observer?.onStdoutChunk?.(chunk);
    });
    child.stderr.on("data", (chunk: string) => { stderr = appendBounded(stderr, chunk); });
    child.once("error", reject);
    child.once("close", (code) => resolve({ exitCode: code ?? 1, stdout, stderr }));
  });
}

function appendBounded(current: string, chunk: string): string {
  if (current.length >= MAX_CAPTURED_PROVIDER_OUTPUT) return current;
  return (current + chunk).slice(0, MAX_CAPTURED_PROVIDER_OUTPUT);
}
