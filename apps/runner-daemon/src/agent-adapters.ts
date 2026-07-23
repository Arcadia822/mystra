import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  CodexAdapter,
  CopilotAdapter,
  createAgentAdapterRegistry,
  type AgentAdapter,
} from "@mystra/agent-adapters";

type AgentAdapterModuleRecord = Record<string, AgentAdapter>;

interface RunnerAgentAdapterRegistryOptions {
  moduleSpecifiers?: string[] | undefined;
  codexAuthDir?: string | undefined;
}

export interface RunnerAgentAdapterRegistryBundle {
  registry: ReturnType<typeof createAgentAdapterRegistry>;
  agentNames: string[];
}

function isAgentAdapter(value: unknown): value is AgentAdapter {
  if (!value || typeof value !== "object") {
    return false;
  }
  const adapter = value as Partial<AgentAdapter>;
  return typeof adapter.agentName === "string"
    && typeof adapter.buildCommand === "function"
    && typeof adapter.buildEnvironment === "function"
    && typeof adapter.parseOutput === "function"
    && typeof adapter.isSuccess === "function";
}

function validateAgentAdapters(
  adapterRecord: unknown,
  moduleSpecifier: string,
): AgentAdapterModuleRecord {
  if (!adapterRecord || typeof adapterRecord !== "object" || Array.isArray(adapterRecord)) {
    throw new Error(`Agent adapter module "${moduleSpecifier}" must export an adapter record`);
  }

  const entries = Object.entries(adapterRecord);
  if (entries.length === 0) {
    throw new Error(`Agent adapter module "${moduleSpecifier}" must export at least one adapter`);
  }

  const adapters: AgentAdapterModuleRecord = {};
  for (const [adapterName, adapter] of entries) {
    if (!isAgentAdapter(adapter)) {
      throw new Error(`Agent adapter module "${moduleSpecifier}" exported invalid adapter "${adapterName}"`);
    }
    if (adapter.agentName !== adapterName) {
      throw new Error(
        `Agent adapter module "${moduleSpecifier}" exported key "${adapterName}" for adapter "${adapter.agentName}"`,
      );
    }
    adapters[adapterName] = adapter;
  }

  return adapters;
}

function agentAdaptersFromModule(
  moduleNamespace: Record<string, unknown>,
  moduleSpecifier: string,
): AgentAdapterModuleRecord {
  if ("agentAdapters" in moduleNamespace) {
    return validateAgentAdapters(moduleNamespace.agentAdapters, moduleSpecifier);
  }
  if ("default" in moduleNamespace) {
    const defaultExport = moduleNamespace.default;
    if (defaultExport && typeof defaultExport === "object" && "agentAdapters" in defaultExport) {
      return validateAgentAdapters(
        (defaultExport as { agentAdapters: unknown }).agentAdapters,
        moduleSpecifier,
      );
    }
    return validateAgentAdapters(defaultExport, moduleSpecifier);
  }
  throw new Error(`Agent adapter module "${moduleSpecifier}" must export agentAdapters or a default adapter record`);
}

function resolveModuleSpecifier(moduleSpecifier: string): string {
  if (moduleSpecifier.startsWith(".") || path.isAbsolute(moduleSpecifier)) {
    return pathToFileURL(path.resolve(moduleSpecifier)).href;
  }
  return moduleSpecifier;
}

function defaultAgentAdapters(options: RunnerAgentAdapterRegistryOptions): AgentAdapterModuleRecord {
  return {
    codex: new CodexAdapter({
      ...(options.codexAuthDir ? { authDir: "/root/.codex" } : {}),
    }),
    copilot: new CopilotAdapter({
      cliVersion: "1.0.69-0",
      maxAutopilotContinues: 10,
      cliConfigDir: "/mystra/workspace/copilot-home/.copilot",
      homeDir: "/mystra/workspace/copilot-home",
      configDir: "/mystra/workspace/copilot-home/.config",
      cacheDir: "/mystra/workspace/copilot-home/.cache",
      denyMcpServers: ["linear"],
      deniedUrls: ["mcp.linear.app"],
    }),
  };
}

export async function createRunnerAgentAdapterRegistry(
  options: RunnerAgentAdapterRegistryOptions = {},
): Promise<RunnerAgentAdapterRegistryBundle> {
  const adapters = defaultAgentAdapters(options);

  for (const moduleSpecifier of options.moduleSpecifiers ?? []) {
    const moduleNamespace = await import(resolveModuleSpecifier(moduleSpecifier));
    for (const [adapterName, adapter] of Object.entries(agentAdaptersFromModule(moduleNamespace, moduleSpecifier))) {
      if (adapterName in adapters) {
        throw new Error(`Agent adapter "${adapterName}" is already registered`);
      }
      adapters[adapterName] = adapter;
    }
  }

  return {
    registry: createAgentAdapterRegistry(adapters),
    agentNames: Object.keys(adapters),
  };
}

export type RunnerAgentAdapterRegistry = ReturnType<typeof createAgentAdapterRegistry>;
