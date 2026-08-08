import { z } from "zod";

export const agentAdaptersPackageName = "@mystra/agent-adapters";

export const providerExecutionRequestSchema = z.object({
  prompt: z.string().min(1),
  promptFilePath: z.string().min(1).optional(),
  workingDirectory: z.string().min(1),
}).strict();
export type ProviderExecutionRequest = z.infer<typeof providerExecutionRequestSchema>;

export interface ProviderExecutionOptions {
  stdinFilePath?: string;
}

export const providerProcessResultSchema = z.object({
  exitCode: z.number().int(),
  stdout: z.string(),
  stderr: z.string(),
}).strict();
export type ProviderProcessResult = z.infer<typeof providerProcessResultSchema>;

export const providerParsedResultSchema = z.object({
  success: z.boolean(),
  errorMessage: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
}).strict();
export type ProviderParsedResult = z.infer<typeof providerParsedResultSchema>;

export interface ProviderAdapter {
  readonly providerName: string;
  buildCommand(input: ProviderExecutionRequest): string[];
  buildEnvironment(input: ProviderExecutionRequest): Record<string, string>;
  buildExecutionOptions?(input: ProviderExecutionRequest): ProviderExecutionOptions;
  parseOutput(result: ProviderProcessResult): ProviderParsedResult;
  isSuccess(result: ProviderProcessResult): boolean;
}

function parseExecutionRequest(input: ProviderExecutionRequest): ProviderExecutionRequest {
  return providerExecutionRequestSchema.parse(input);
}

function sanitizeExitCode(value: unknown): number {
  if (typeof value === "number" && Number.isInteger(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number.parseInt(value, 10);
    if (Number.isInteger(parsed)) {
      return parsed;
    }
  }
  return 1;
}

function sanitizeProcessText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asProcessRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object"
    ? value as Record<string, unknown>
    : undefined;
}

function parseProcessResult(result: ProviderProcessResult): ProviderProcessResult {
  const parsed = providerProcessResultSchema.safeParse(result);
  if (parsed.success) {
    return parsed.data;
  }

  const raw = asProcessRecord(result);
  return providerProcessResultSchema.parse({
    exitCode: sanitizeExitCode(raw?.exitCode),
    stdout: sanitizeProcessText(raw?.stdout),
    stderr: sanitizeProcessText(raw?.stderr),
  });
}

export class CodexProviderAdapter implements ProviderAdapter {
  readonly providerName = "codex";

  constructor(private readonly options: {
    authDir?: string;
    timeoutSeconds?: number;
  } = {}) {}

  buildCommand(input: ProviderExecutionRequest): string[] {
    const request = parseExecutionRequest(input);
    return [
      "codex",
      "exec",
      "--dangerously-bypass-approvals-and-sandbox",
      "--cd",
      request.workingDirectory,
      request.promptFilePath ? "-" : request.prompt,
    ];
  }

  buildEnvironment(_input: ProviderExecutionRequest): Record<string, string> {
    return {
      ...(this.options.authDir ? { CODEX_HOME: this.options.authDir } : {}),
      ...(this.options.timeoutSeconds ? { CODEX_TIMEOUT_SECONDS: String(this.options.timeoutSeconds) } : {}),
    };
  }

  buildExecutionOptions(input: ProviderExecutionRequest): ProviderExecutionOptions {
    const request = parseExecutionRequest(input);
    return request.promptFilePath
      ? { stdinFilePath: request.promptFilePath }
      : {};
  }

  parseOutput(result: ProviderProcessResult): ProviderParsedResult {
    const parsed = parseProcessResult(result);
    return {
      success: this.isSuccess(parsed),
      ...(parsed.exitCode === 0 ? {} : { errorMessage: parsed.stderr.trim() || parsed.stdout.trim() || `codex exited with ${parsed.exitCode}` }),
      metadata: {},
    };
  }

  isSuccess(result: ProviderProcessResult): boolean {
    return parseProcessResult(result).exitCode === 0;
  }
}

export class CopilotProviderAdapter implements ProviderAdapter {
  readonly providerName = "copilot";

  constructor(private readonly options: {
    cliConfigDir: string;
    homeDir: string;
    configDir: string;
    cacheDir: string;
    cliVersion?: string;
    maxAutopilotContinues?: number;
    denyMcpServers?: string[];
    deniedUrls?: string[];
  }) {}

  buildCommand(input: ProviderExecutionRequest): string[] {
    const request = parseExecutionRequest(input);
    const command = ["copilot"];
    if (request.promptFilePath) {
      command.push("--attachment", request.promptFilePath);
    }
    for (const server of this.options.denyMcpServers ?? []) {
      command.push("--disable-mcp-server", server);
    }
    for (const url of this.options.deniedUrls ?? []) {
      command.push("--deny-url", url);
    }
    command.push(
      "--prompt",
      request.promptFilePath
        ? "Follow the attached instructions file as the complete user task."
        : request.prompt,
      "--allow-all",
      "--autopilot",
      "--max-autopilot-continues",
      String(this.options.maxAutopilotContinues ?? 10),
      "--no-color",
      "--stream",
      "off",
    );
    return command;
  }

  buildEnvironment(_input: ProviderExecutionRequest): Record<string, string> {
    return {
      HOME: this.options.homeDir,
      XDG_CONFIG_HOME: this.options.configDir,
      XDG_CACHE_HOME: this.options.cacheDir,
      COPILOT_CLI_CONFIG_DIR: this.options.cliConfigDir,
    };
  }

  parseOutput(result: ProviderProcessResult): ProviderParsedResult {
    const parsed = parseProcessResult(result);
    return {
      success: this.isSuccess(parsed),
      ...(parsed.exitCode === 0 ? {} : { errorMessage: parsed.stderr.trim() || parsed.stdout.trim() || `copilot exited with ${parsed.exitCode}` }),
      metadata: {
        provider: "copilot",
        cliVersion: this.options.cliVersion ?? "unknown",
        mode: "autopilot",
        maxAutopilotContinues: this.options.maxAutopilotContinues ?? 10,
        exitCode: parsed.exitCode,
      },
    };
  }

  isSuccess(result: ProviderProcessResult): boolean {
    return parseProcessResult(result).exitCode === 0;
  }
}

export function createProviderAdapterRegistry(
  adapters: Record<string, ProviderAdapter>,
): {
  get(name: string): ProviderAdapter;
} {
  return {
    get(name: string): ProviderAdapter {
      const adapter = adapters[name];
      if (!adapter) {
        throw new Error(`Unknown Provider adapter "${name}"`);
      }
      return adapter;
    },
  };
}
