import { z } from "zod";

import type {
  ProviderAdapter,
  ProviderExecutionOptions,
  ProviderParsedResult,
  ProviderProcessResult,
} from "./index.js";

const providerSessionExecutionRequestSchema = z.object({
  prompt: z.string().min(1),
  workingDirectory: z.string().min(1),
}).strict();
const providerSessionProcessResultSchema = z.object({
  exitCode: z.number().int(),
  stdout: z.string(),
  stderr: z.string(),
}).strict();

const uuidSchema = z.string().uuid();

export type ProviderSessionStartRequest = {
  mystraSessionId: string;
  systemPrompt: string;
  userMessage: string;
  workingDirectory: string;
};

export type ProviderSessionContinueRequest = {
  mystraSessionId: string;
  providerSessionId: string;
  userMessage: string;
  workingDirectory: string;
};

export type ProviderSessionCommand = {
  argv: string[];
  environment: Record<string, string>;
  executionOptions: ProviderExecutionOptions;
  workingDirectory: string;
};

export type ProviderSessionParsedResult = ProviderParsedResult & {
  providerSessionId?: string;
};

export interface ProviderSessionAdapter {
  readonly providerName: string;
  buildStartCommand(input: ProviderSessionStartRequest): ProviderSessionCommand;
  buildContinueCommand(input: ProviderSessionContinueRequest): ProviderSessionCommand;
  parseResult(result: ProviderProcessResult): ProviderSessionParsedResult;
}

function combinedInitialPrompt(systemPrompt: string, userMessage: string): string {
  return `<system_prompt>\n${systemPrompt}\n</system_prompt>\n\n<user_message>\n${userMessage}\n</user_message>`;
}

function executionParts(adapter: ProviderAdapter, prompt: string, workingDirectory: string) {
  const request = providerSessionExecutionRequestSchema.parse({ prompt, workingDirectory });
  return {
    environment: adapter.buildEnvironment(request),
    executionOptions: adapter.buildExecutionOptions?.(request) ?? {},
  };
}

function extractCodexThreadId(stdout: string): string | undefined {
  for (const line of stdout.split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      const value = JSON.parse(line) as Record<string, unknown>;
      if (value.type === "thread.started" && typeof value.thread_id === "string" && value.thread_id.length > 0) {
        return value.thread_id;
      }
    } catch {
      // Non-JSON diagnostic lines do not define the provider session identity.
    }
  }
  return undefined;
}

export function createProviderSessionAdapter(adapter: ProviderAdapter): ProviderSessionAdapter {
  if (adapter.providerName !== "codex" && adapter.providerName !== "copilot") {
    throw new Error(`Provider ${adapter.providerName} does not support durable Sessions`);
  }

  let copilotSessionId: string | undefined;

  return {
    providerName: adapter.providerName,
    buildStartCommand(input) {
      uuidSchema.parse(input.mystraSessionId);
      const prompt = combinedInitialPrompt(input.systemPrompt, input.userMessage);
      const parts = executionParts(adapter, prompt, input.workingDirectory);
      if (adapter.providerName === "codex") {
        return {
          argv: ["codex", "exec", "--json", "--dangerously-bypass-approvals-and-sandbox", "--cd", input.workingDirectory, prompt],
          workingDirectory: input.workingDirectory,
          ...parts,
        };
      }
      copilotSessionId = input.mystraSessionId;
      const argv = adapter.buildCommand({ prompt, workingDirectory: input.workingDirectory });
      argv.splice(1, 0, "--session-id", input.mystraSessionId);
      return { argv, workingDirectory: input.workingDirectory, ...parts };
    },
    buildContinueCommand(input) {
      uuidSchema.parse(input.mystraSessionId);
      const parts = executionParts(adapter, input.userMessage, input.workingDirectory);
      if (adapter.providerName === "codex") {
        return {
          argv: ["codex", "exec", "resume", "--json", "--dangerously-bypass-approvals-and-sandbox", "--cd", input.workingDirectory, input.providerSessionId, input.userMessage],
          workingDirectory: input.workingDirectory,
          ...parts,
        };
      }
      if (input.providerSessionId !== input.mystraSessionId) {
        throw new Error("Copilot provider session id must equal the Mystra Session id");
      }
      copilotSessionId = input.providerSessionId;
      const argv = adapter.buildCommand({ prompt: input.userMessage, workingDirectory: input.workingDirectory });
      argv.splice(1, 0, "--session-id", input.providerSessionId);
      return { argv, workingDirectory: input.workingDirectory, ...parts };
    },
    parseResult(result) {
      const parsedProcess = providerSessionProcessResultSchema.parse(result);
      const parsed = adapter.parseOutput(parsedProcess);
      const providerSessionId = adapter.providerName === "codex"
        ? extractCodexThreadId(parsedProcess.stdout)
        : copilotSessionId;
      return { ...parsed, ...(providerSessionId ? { providerSessionId } : {}) };
    },
  };
}
