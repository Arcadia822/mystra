import { IntegrationFailure } from "./errors";
import { LinearIssueProvider } from "./linear";
import type { Integration, IssueProvider } from "./types";

export class IntegrationRegistry {
  private readonly integrations: Map<string, Integration>;

  constructor(integrations: Iterable<Integration>) {
    this.integrations = new Map(
      [...integrations].map((integration) => [integration.name, integration]),
    );
  }

  requireIssueProvider(name: string): IssueProvider {
    const integration = this.integrations.get(name);
    if (!integration) {
      throw new IntegrationFailure({
        code: "INTEGRATION_NOT_FOUND",
        message: `Integration not found: ${name}`,
      });
    }
    if (!integration.capabilities.issues) {
      throw new IntegrationFailure({
        code: "ISSUE_CAPABILITY_UNAVAILABLE",
        message: `Integration does not provide Issues: ${name}`,
      });
    }
    return integration.capabilities.issues;
  }
}

export function defaultIntegrationRegistry(): IntegrationRegistry {
  return new IntegrationRegistry([{
    name: "linear",
    provider: "linear",
    capabilities: {
      issues: new LinearIssueProvider({
        apiKey: process.env.LINEAR_API_KEY,
        fetchImpl: globalThis.fetch,
      }),
    },
  }]);
}
