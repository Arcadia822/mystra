import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  LocalWorkflowProvider,
  createWorkflowProviderRegistry,
  mvpCodingBlueprint,
  workflowBlueprintSchema,
  type WorkflowBlueprint,
  type WorkflowProvider,
} from "@mystra/workflows";

type WorkflowProviderModuleRecord = Record<string, WorkflowProvider>;
interface RunnerWorkflowProviderRegistryOptions {
  moduleSpecifiers?: string[] | undefined;
  blueprintFiles?: string[] | undefined;
}

function isWorkflowProvider(value: unknown): value is WorkflowProvider {
  if (!value || typeof value !== "object") {
    return false;
  }
  const provider = value as Partial<WorkflowProvider>;
  return typeof provider.providerName === "string"
    && typeof provider.defaultBlueprint === "string"
    && Array.isArray(provider.supportedNodeKinds)
    && typeof provider.capabilities === "object"
    && provider.capabilities !== null
    && typeof provider.loadBlueprint === "function"
    && typeof provider.validateBlueprint === "function"
    && typeof provider.executeBlueprint === "function"
    && typeof provider.resumeExecution === "function"
    && typeof provider.supportsNodeKind === "function";
}

function duplicateNames(values: string[]): string[] {
  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()].filter(([, count]) => count > 1).map(([value]) => value);
}

async function loadWorkflowBlueprints(filePaths?: string[]): Promise<WorkflowBlueprint[]> {
  const blueprints: WorkflowBlueprint[] = [mvpCodingBlueprint];

  for (const filePath of filePaths ?? []) {
    const resolvedPath = path.resolve(filePath);
    const text = await readFile(resolvedPath, "utf8");
    const parsed = JSON.parse(text) as unknown;
    blueprints.push(workflowBlueprintSchema.parse(parsed));
  }

  const duplicates = duplicateNames(blueprints.map((blueprint) => blueprint.name));
  if (duplicates.length > 0) {
    throw new Error(`Workflow blueprint names must be unique: ${duplicates.join(", ")}`);
  }

  return blueprints;
}

function defaultWorkflowProviders(blueprints: WorkflowBlueprint[]): WorkflowProviderModuleRecord {
  return {
    local: new LocalWorkflowProvider({
      blueprints,
    }),
  };
}

function validateWorkflowProviders(
  providerRecord: unknown,
  moduleSpecifier: string,
): WorkflowProviderModuleRecord {
  if (!providerRecord || typeof providerRecord !== "object" || Array.isArray(providerRecord)) {
    throw new Error(`Workflow provider module "${moduleSpecifier}" must export a provider record`);
  }

  const entries = Object.entries(providerRecord);
  if (entries.length === 0) {
    throw new Error(`Workflow provider module "${moduleSpecifier}" must export at least one provider`);
  }

  const providers: WorkflowProviderModuleRecord = {};
  for (const [providerName, provider] of entries) {
    if (!isWorkflowProvider(provider)) {
      throw new Error(`Workflow provider module "${moduleSpecifier}" exported invalid provider "${providerName}"`);
    }
    if (provider.providerName !== providerName) {
      throw new Error(
        `Workflow provider module "${moduleSpecifier}" exported key "${providerName}" for provider "${provider.providerName}"`,
      );
    }
    providers[providerName] = provider;
  }
  return providers;
}

function workflowProvidersFromModule(
  moduleNamespace: Record<string, unknown>,
  moduleSpecifier: string,
): WorkflowProviderModuleRecord {
  if ("workflowProviders" in moduleNamespace) {
    return validateWorkflowProviders(moduleNamespace.workflowProviders, moduleSpecifier);
  }
  if ("default" in moduleNamespace) {
    const defaultExport = moduleNamespace.default;
    if (defaultExport && typeof defaultExport === "object" && "workflowProviders" in defaultExport) {
      return validateWorkflowProviders(
        (defaultExport as { workflowProviders: unknown }).workflowProviders,
        moduleSpecifier,
      );
    }
    return validateWorkflowProviders(defaultExport, moduleSpecifier);
  }
  throw new Error(`Workflow provider module "${moduleSpecifier}" must export workflowProviders or a default provider record`);
}

function resolveModuleSpecifier(moduleSpecifier: string): string {
  if (moduleSpecifier.startsWith(".") || path.isAbsolute(moduleSpecifier)) {
    return pathToFileURL(path.resolve(moduleSpecifier)).href;
  }
  return moduleSpecifier;
}

export async function createRunnerWorkflowProviderRegistry(
  options: RunnerWorkflowProviderRegistryOptions = {},
): Promise<ReturnType<typeof createWorkflowProviderRegistry>> {
  const providers = defaultWorkflowProviders(await loadWorkflowBlueprints(options.blueprintFiles));

  for (const moduleSpecifier of options.moduleSpecifiers ?? []) {
    const moduleNamespace = await import(resolveModuleSpecifier(moduleSpecifier));
    for (const [providerName, provider] of Object.entries(workflowProvidersFromModule(moduleNamespace, moduleSpecifier))) {
      if (providerName in providers) {
        throw new Error(`Workflow provider "${providerName}" is already registered`);
      }
      providers[providerName] = provider;
    }
  }

  return createWorkflowProviderRegistry(providers);
}

export type RunnerWorkflowProviderRegistry = Awaited<ReturnType<typeof createRunnerWorkflowProviderRegistry>>;
