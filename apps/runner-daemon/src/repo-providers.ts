import path from "node:path";
import { pathToFileURL } from "node:url";

import type {
  BranchDeliveryRequest,
  BranchDeliveryReceipt,
  RepoProviderKind,
  RepositorySnapshot,
  RepositoryTarget,
  ReviewRequest,
  ReviewResult,
} from "@mystra/shared";
import { githubRepoProvider } from "./repo-providers/github.js";
import { gitlabRepoProvider } from "./repo-providers/gitlab.js";

export interface RepoDeliveryProvider {
  readonly providerName: RepoProviderKind;
  supports(repository: RepositorySnapshot): boolean;
  pushBranch(input: BranchDeliveryRequest): Promise<BranchDeliveryReceipt>;
  createReview(input: ReviewRequest): Promise<ReviewResult>;
}

type RepoProviderModuleRecord = Record<string, RepoDeliveryProvider>;

interface RunnerRepoProviderRegistryOptions {
  moduleSpecifiers?: string[] | undefined;
  builtinProviders?: RepoProviderModuleRecord | undefined;
}

export interface RunnerRepoProviderRegistry {
  get(providerName: string): RepoDeliveryProvider | undefined;
  select(target: RepositoryTarget): RepoDeliveryProvider | undefined;
}

export interface RunnerRepoProviderRegistryBundle {
  registry: RunnerRepoProviderRegistry;
  providerNames: string[];
}

function isRepoProvider(value: unknown): value is RepoDeliveryProvider {
  if (!value || typeof value !== "object") {
    return false;
  }

  const provider = value as Partial<RepoDeliveryProvider>;
  return typeof provider.providerName === "string"
    && typeof provider.supports === "function"
    && typeof provider.pushBranch === "function"
    && typeof provider.createReview === "function";
}

function validateRepoProviders(
  providerRecord: unknown,
  moduleSpecifier: string,
): RepoProviderModuleRecord {
  if (!providerRecord || typeof providerRecord !== "object" || Array.isArray(providerRecord)) {
    throw new Error(`Repo provider module "${moduleSpecifier}" must export a provider record`);
  }

  const entries = Object.entries(providerRecord);
  if (entries.length === 0) {
    throw new Error(`Repo provider module "${moduleSpecifier}" must export at least one provider`);
  }

  const providers: RepoProviderModuleRecord = {};
  for (const [providerName, provider] of entries) {
    if (!isRepoProvider(provider)) {
      throw new Error(`Repo provider module "${moduleSpecifier}" exported invalid provider "${providerName}"`);
    }
    if (provider.providerName !== providerName) {
      throw new Error(
        `Repo provider module "${moduleSpecifier}" exported key "${providerName}" for provider "${provider.providerName}"`,
      );
    }
    providers[providerName] = provider;
  }

  return providers;
}

function repoProvidersFromModule(
  moduleNamespace: Record<string, unknown>,
  moduleSpecifier: string,
): RepoProviderModuleRecord {
  if ("repoProviders" in moduleNamespace) {
    return validateRepoProviders(moduleNamespace.repoProviders, moduleSpecifier);
  }
  if ("default" in moduleNamespace) {
    const defaultExport = moduleNamespace.default;
    if (defaultExport && typeof defaultExport === "object" && "repoProviders" in defaultExport) {
      return validateRepoProviders(
        (defaultExport as { repoProviders: unknown }).repoProviders,
        moduleSpecifier,
      );
    }
    return validateRepoProviders(defaultExport, moduleSpecifier);
  }
  throw new Error(`Repo provider module "${moduleSpecifier}" must export repoProviders or a default provider record`);
}

function resolveModuleSpecifier(moduleSpecifier: string): string {
  if (moduleSpecifier.startsWith(".") || path.isAbsolute(moduleSpecifier)) {
    return pathToFileURL(path.resolve(moduleSpecifier)).href;
  }
  return moduleSpecifier;
}

function createRepoProviderRegistry(providers: RepoProviderModuleRecord): RunnerRepoProviderRegistry {
  return {
    get(providerName: string): RepoDeliveryProvider | undefined {
      return providers[providerName];
    },
    select(target: RepositoryTarget): RepoDeliveryProvider | undefined {
      const provider = providers[target.repository.provider];
      return provider?.supports(target.repository) ? provider : undefined;
    },
  };
}

export async function createRunnerRepoProviderRegistry(
  options: RunnerRepoProviderRegistryOptions = {},
): Promise<RunnerRepoProviderRegistryBundle> {
  const providers: RepoProviderModuleRecord = {
    ...(options.builtinProviders ?? {
      gitlab: gitlabRepoProvider,
      github: githubRepoProvider,
    }),
  };

  for (const moduleSpecifier of options.moduleSpecifiers ?? []) {
    const moduleNamespace = await import(resolveModuleSpecifier(moduleSpecifier));
    for (const [providerName, provider] of Object.entries(repoProvidersFromModule(moduleNamespace, moduleSpecifier))) {
      if (providerName in providers) {
        throw new Error(`Repo provider "${providerName}" is already registered`);
      }
      providers[providerName] = provider;
    }
  }

  return {
    registry: createRepoProviderRegistry(providers),
    providerNames: Object.keys(providers),
  };
}
