import path from "node:path";
import { pathToFileURL } from "node:url";

import type {
  CleanupOutcome,
  SandboxLaunchRequest,
  SandboxObservation,
  SandboxOutcome,
  SandboxSession,
} from "@mystra/shared";
import { sandboxProviders as builtinSandboxProviders } from "./sandbox-providers/docker.js";

export interface SandboxLaunchContext {
  dockerArgs?: string[] | undefined;
  env?: NodeJS.ProcessEnv | undefined;
  containerName?: string | undefined;
}

export interface SandboxInspectContext {
  runtimePorts?: SandboxLaunchRequest["runtime"]["exposedPorts"] | undefined;
  previewHost?: string | undefined;
}

export interface SandboxStopContext {
  cleanupTimeoutSeconds?: number | undefined;
}

export interface SandboxCollectOutcomeContext {
  status?: SandboxOutcome["status"] | undefined;
  cleanup?: CleanupOutcome | undefined;
  observation?: SandboxObservation | undefined;
  finishedAt?: string | undefined;
  retained?: boolean | undefined;
}

export interface SandboxProvider {
  readonly providerName: string;
  launch(input: SandboxLaunchRequest, context?: SandboxLaunchContext): Promise<SandboxSession>;
  inspect(session: SandboxSession, context?: SandboxInspectContext): Promise<SandboxObservation>;
  stop(session: SandboxSession, reason: "cancel" | "timeout" | "shutdown", context?: SandboxStopContext): Promise<CleanupOutcome>;
  collectOutcome(session: SandboxSession, context?: SandboxCollectOutcomeContext): Promise<SandboxOutcome>;
}

type SandboxProviderModuleRecord = Record<string, SandboxProvider>;

interface RunnerSandboxProviderRegistryOptions {
  moduleSpecifiers?: string[] | undefined;
  builtinProviders?: SandboxProviderModuleRecord | undefined;
}

export interface RunnerSandboxProviderRegistry {
  get(providerName: string): SandboxProvider | undefined;
}

export interface RunnerSandboxProviderRegistryBundle {
  registry: RunnerSandboxProviderRegistry;
  providerNames: string[];
}

function isSandboxProvider(value: unknown): value is SandboxProvider {
  if (!value || typeof value !== "object") {
    return false;
  }

  const provider = value as Partial<SandboxProvider>;
  return typeof provider.providerName === "string"
    && typeof provider.launch === "function"
    && typeof provider.inspect === "function"
    && typeof provider.stop === "function"
    && typeof provider.collectOutcome === "function";
}

function validateSandboxProviders(
  providerRecord: unknown,
  moduleSpecifier: string,
): SandboxProviderModuleRecord {
  if (!providerRecord || typeof providerRecord !== "object" || Array.isArray(providerRecord)) {
    throw new Error(`Sandbox provider module "${moduleSpecifier}" must export a provider record`);
  }

  const entries = Object.entries(providerRecord);
  if (entries.length === 0) {
    throw new Error(`Sandbox provider module "${moduleSpecifier}" must export at least one provider`);
  }

  const providers: SandboxProviderModuleRecord = {};
  for (const [providerName, provider] of entries) {
    if (!isSandboxProvider(provider)) {
      throw new Error(`Sandbox provider module "${moduleSpecifier}" exported invalid provider "${providerName}"`);
    }
    if (provider.providerName !== providerName) {
      throw new Error(
        `Sandbox provider module "${moduleSpecifier}" exported key "${providerName}" for provider "${provider.providerName}"`,
      );
    }
    providers[providerName] = provider;
  }

  return providers;
}

function sandboxProvidersFromModule(
  moduleNamespace: Record<string, unknown>,
  moduleSpecifier: string,
): SandboxProviderModuleRecord {
  if ("sandboxProviders" in moduleNamespace) {
    return validateSandboxProviders(moduleNamespace.sandboxProviders, moduleSpecifier);
  }
  if ("default" in moduleNamespace) {
    const defaultExport = moduleNamespace.default;
    if (defaultExport && typeof defaultExport === "object" && "sandboxProviders" in defaultExport) {
      return validateSandboxProviders(
        (defaultExport as { sandboxProviders: unknown }).sandboxProviders,
        moduleSpecifier,
      );
    }
    return validateSandboxProviders(defaultExport, moduleSpecifier);
  }
  throw new Error(`Sandbox provider module "${moduleSpecifier}" must export sandboxProviders or a default provider record`);
}

function resolveModuleSpecifier(moduleSpecifier: string): string {
  if (moduleSpecifier.startsWith(".") || path.isAbsolute(moduleSpecifier)) {
    return pathToFileURL(path.resolve(moduleSpecifier)).href;
  }
  return moduleSpecifier;
}

function createSandboxProviderRegistry(providers: SandboxProviderModuleRecord): RunnerSandboxProviderRegistry {
  return {
    get(providerName: string): SandboxProvider | undefined {
      return providers[providerName];
    },
  };
}

export async function createRunnerSandboxProviderRegistry(
  options: RunnerSandboxProviderRegistryOptions = {},
): Promise<RunnerSandboxProviderRegistryBundle> {
  const providers: SandboxProviderModuleRecord = {
    ...(options.builtinProviders ?? builtinSandboxProviders),
  };

  for (const moduleSpecifier of options.moduleSpecifiers ?? []) {
    const moduleNamespace = await import(resolveModuleSpecifier(moduleSpecifier));
    for (const [providerName, provider] of Object.entries(sandboxProvidersFromModule(moduleNamespace, moduleSpecifier))) {
      if (providerName in providers) {
        throw new Error(`Sandbox provider "${providerName}" is already registered`);
      }
      providers[providerName] = provider;
    }
  }

  return {
    registry: createSandboxProviderRegistry(providers),
    providerNames: Object.keys(providers),
  };
}
