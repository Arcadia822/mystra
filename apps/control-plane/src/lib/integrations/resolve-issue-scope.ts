import type { RepositorySnapshot } from "@mystra/shared";

import { IntegrationFailure } from "./errors";
import type { IntegrationRegistry } from "./registry";
import type { IssueProvider } from "./types";

export async function resolveIssueRepositoryScope(input: {
  integrationName: string;
  repositoryIdentifier: string | undefined;
  provider: IssueProvider;
  registry: IntegrationRegistry;
}): Promise<RepositorySnapshot | undefined> {
  if (!input.repositoryIdentifier) {
    if (input.provider.repositoryScope === "required") {
      throw new IntegrationFailure({
        code: "REPOSITORY_SCOPE_REQUIRED",
        message: `${input.integrationName} Issues require a Repository scope`,
      });
    }
    return undefined;
  }

  const repository = await input.registry
    .requireRepoProvider(input.integrationName)
    .getRepository(input.repositoryIdentifier);
  if (!repository) {
    throw new IntegrationFailure({
      code: "REPOSITORY_NOT_FOUND",
      message: `Repository not found: ${input.repositoryIdentifier}`,
    });
  }
  return repository;
}
