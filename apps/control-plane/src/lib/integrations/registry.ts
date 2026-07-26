import { integrationDescriptorSchema, type IntegrationDescriptor } from "@mystra/shared";

import { IntegrationFailure } from "./errors";
import { createGitHubIntegration } from "./github";
import { createLinearIntegration } from "./linear";
import type {
  IntegrationPlugin,
  IssueProvider,
  RepoProvider,
} from "./types";

export class IntegrationRegistry {
  private readonly integrations = new Map<string, IntegrationPlugin>();

  constructor(integrations: Iterable<IntegrationPlugin>) {
    for (const integration of integrations) {
      const descriptor = integrationDescriptorSchema.parse(integration.descriptor);
      if (this.integrations.has(descriptor.name)) {
        throw new Error(`Duplicate Integration name: ${descriptor.name}`);
      }

      const actualCapabilities = [
        ...(integration.capabilities.repositories ? ["repositories" as const] : []),
        ...(integration.capabilities.issues ? ["issues" as const] : []),
      ];
      if (
        actualCapabilities.length !== descriptor.capabilities.length
        || actualCapabilities.some((capability) =>
          !descriptor.capabilities.includes(capability))
      ) {
        throw new Error(
          `Integration ${descriptor.name} descriptor capabilities do not match its providers`,
        );
      }
      this.integrations.set(descriptor.name, integration);
    }
  }

  list(): IntegrationDescriptor[] {
    return [...this.integrations.values()]
      .map((integration) => integration.descriptor)
      .sort((left, right) => left.name.localeCompare(right.name));
  }

  requireRepoProvider(name: string): RepoProvider {
    const integration = this.requireIntegration(name);
    if (!integration.capabilities.repositories) {
      throw new IntegrationFailure({
        code: "REPOSITORY_CAPABILITY_UNAVAILABLE",
        message: `Integration does not provide Repositories: ${name}`,
      });
    }
    return integration.capabilities.repositories;
  }

  requireIssueProvider(name: string): IssueProvider {
    const integration = this.requireIntegration(name);
    if (!integration.capabilities.issues) {
      throw new IntegrationFailure({
        code: "ISSUE_CAPABILITY_UNAVAILABLE",
        message: `Integration does not provide Issues: ${name}`,
      });
    }
    return integration.capabilities.issues;
  }

  private requireIntegration(name: string): IntegrationPlugin {
    const integration = this.integrations.get(name);
    if (!integration) {
      throw new IntegrationFailure({
        code: "INTEGRATION_NOT_FOUND",
        message: `Integration not found: ${name}`,
      });
    }
    return integration;
  }
}

export function defaultIntegrationRegistry(): IntegrationRegistry {
  return new IntegrationRegistry([
    createGitHubIntegration({
      token: process.env.MYSTRA_GITHUB_TOKEN,
      fetchImpl: globalThis.fetch,
    }),
    createLinearIntegration({
      apiKey: process.env.LINEAR_API_KEY,
      fetchImpl: globalThis.fetch,
    }),
  ]);
}
