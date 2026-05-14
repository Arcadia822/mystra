import { z } from "zod";

export const agentAdaptersPackageName = "@mystra/agent-adapters";

export const agentExecutionRequestSchema = z.object({
  prompt: z.string().min(1),
  workingDirectory: z.string().min(1),
}).strict();
export type AgentExecutionRequest = z.infer<typeof agentExecutionRequestSchema>;

export const agentProcessResultSchema = z.object({
  exitCode: z.number().int(),
  stdout: z.string(),
  stderr: z.string(),
}).strict();
export type AgentProcessResult = z.infer<typeof agentProcessResultSchema>;

export const agentParsedResultSchema = z.object({
  success: z.boolean(),
  errorMessage: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
}).strict();
export type AgentParsedResult = z.infer<typeof agentParsedResultSchema>;

export interface AgentAdapter {
  readonly agentName: string;
  buildCommand(input: AgentExecutionRequest): string[];
  buildEnvironment(input: AgentExecutionRequest): Record<string, string>;
  parseOutput(result: AgentProcessResult): AgentParsedResult;
  isSuccess(result: AgentProcessResult): boolean;
}

function parseExecutionRequest(input: AgentExecutionRequest): AgentExecutionRequest {
  return agentExecutionRequestSchema.parse(input);
}

function parseProcessResult(result: AgentProcessResult): AgentProcessResult {
  return agentProcessResultSchema.parse(result);
}

export class CodexAdapter implements AgentAdapter {
  readonly agentName = "codex";

  constructor(private readonly options: {
    authDir?: string;
    timeoutSeconds?: number;
  } = {}) {}

  buildCommand(input: AgentExecutionRequest): string[] {
    const request = parseExecutionRequest(input);
    return [
      "codex",
      "exec",
      "--dangerously-bypass-approvals-and-sandbox",
      "--cd",
      request.workingDirectory,
      request.prompt,
    ];
  }

  buildEnvironment(_input: AgentExecutionRequest): Record<string, string> {
    return {
      ...(this.options.authDir ? { CODEX_HOME: this.options.authDir } : {}),
      ...(this.options.timeoutSeconds ? { CODEX_TIMEOUT_SECONDS: String(this.options.timeoutSeconds) } : {}),
    };
  }

  parseOutput(result: AgentProcessResult): AgentParsedResult {
    const parsed = parseProcessResult(result);
    return {
      success: this.isSuccess(parsed),
      ...(parsed.exitCode === 0 ? {} : { errorMessage: parsed.stderr.trim() || parsed.stdout.trim() || `codex exited with ${parsed.exitCode}` }),
      metadata: {},
    };
  }

  isSuccess(result: AgentProcessResult): boolean {
    return parseProcessResult(result).exitCode === 0;
  }
}

export class CopilotAdapter implements AgentAdapter {
  readonly agentName = "copilot";

  constructor(private readonly options: {
    cliConfigDir: string;
    homeDir: string;
    configDir: string;
    cacheDir: string;
    denyMcpServers?: string[];
    deniedUrls?: string[];
  }) {}

  buildCommand(input: AgentExecutionRequest): string[] {
    const request = parseExecutionRequest(input);
    const command = [
      "copilot",
      "--config-dir",
      this.options.cliConfigDir,
    ];
    for (const server of this.options.denyMcpServers ?? []) {
      command.push("--disable-mcp-server", server);
    }
    for (const url of this.options.deniedUrls ?? []) {
      command.push("--deny-url", url);
    }
    command.push(
      "--prompt",
      request.prompt,
      "--allow-all",
      "--no-ask-user",
      "--no-color",
      "--stream",
      "off",
    );
    return command;
  }

  buildEnvironment(_input: AgentExecutionRequest): Record<string, string> {
    return {
      HOME: this.options.homeDir,
      XDG_CONFIG_HOME: this.options.configDir,
      XDG_CACHE_HOME: this.options.cacheDir,
      COPILOT_CLI_CONFIG_DIR: this.options.cliConfigDir,
    };
  }

  parseOutput(result: AgentProcessResult): AgentParsedResult {
    const parsed = parseProcessResult(result);
    return {
      success: this.isSuccess(parsed),
      ...(parsed.exitCode === 0 ? {} : { errorMessage: parsed.stderr.trim() || parsed.stdout.trim() || `copilot exited with ${parsed.exitCode}` }),
      metadata: {},
    };
  }

  isSuccess(result: AgentProcessResult): boolean {
    return parseProcessResult(result).exitCode === 0;
  }
}

export function createAgentAdapterRegistry(
  adapters: Record<string, AgentAdapter>,
): {
  get(name: string): AgentAdapter;
} {
  return {
    get(name: string): AgentAdapter {
      const adapter = adapters[name];
      if (!adapter) {
        throw new Error(`Unknown agent adapter "${name}"`);
      }
      return adapter;
    },
  };
}
