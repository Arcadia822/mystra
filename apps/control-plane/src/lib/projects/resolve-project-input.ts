import {
  projectCreateRequestSchema,
  projectCreateSchema,
  projectUpdateRequestSchema,
  projectUpdateSchema,
  type ProjectCreate,
  type ProjectCreateRequest,
  type ProjectUpdate,
  type ProjectUpdateRequest,
  type IntegrationConnection,
  type RepositorySnapshot,
} from "@mystra/shared";

import { IntegrationFailure } from "../integrations/errors";
import type { IntegrationRegistry } from "../integrations/registry";
import { readProjectDefaults } from "./project-defaults";

export type ProjectConnectionLookup = {
  getIntegrationConnection(id: string): IntegrationConnection | undefined;
};

async function resolveRepository(
  input: { integration: string; connectionId: string; identifier: string },
  registry: IntegrationRegistry,
  connections: ProjectConnectionLookup,
  allowedInactiveConnectionId?: string,
): Promise<{ connection: IntegrationConnection; repository: RepositorySnapshot }> {
  const connection = connections.getIntegrationConnection(input.connectionId);
  if (!connection) {
    throw new IntegrationFailure({
      code: "INTEGRATION_CONNECTION_NOT_FOUND",
      message: `Integration connection not found: ${input.connectionId}`,
    });
  }
  if (connection.integration !== input.integration) {
    throw new IntegrationFailure({
      code: "INTEGRATION_CONNECTION_MISMATCH",
      message: "Repository integration does not match the selected connection",
    });
  }
  if (connection.status !== "active" && connection.id !== allowedInactiveConnectionId) {
    throw new IntegrationFailure({
      code: "INTEGRATION_CONNECTION_INACTIVE",
      message: "The selected integration connection is inactive",
    });
  }
  const provider = registry.requireRepoProvider(input.integration);
  if (provider.providerName !== connection.provider) {
    throw new IntegrationFailure({
      code: "INTEGRATION_CONNECTION_MISMATCH",
      message: "Repository provider does not match the selected connection",
    });
  }
  const repository = await provider.getRepository(input.identifier);
  if (!repository) {
    throw new IntegrationFailure({
      code: "REPOSITORY_NOT_FOUND",
      message: `Repository not found: ${input.identifier}`,
    });
  }
  if (repository.isArchived) {
    throw new Error(
      `INVALID_PROJECT: Archived repositories cannot be bound to Projects: ${repository.fullName}`,
    );
  }
  if (repository.integration !== connection.integration || repository.provider !== connection.provider) {
    throw new IntegrationFailure({
      code: "INTEGRATION_CONNECTION_MISMATCH",
      message: "Resolved repository does not match the selected connection",
    });
  }
  return { connection, repository };
}

export async function resolveProjectCreateInput(
  input: ProjectCreateRequest,
  registry: IntegrationRegistry,
  connections: ProjectConnectionLookup,
): Promise<ProjectCreate> {
  const request = projectCreateRequestSchema.parse(input);
  const { connection, repository } = await resolveRepository(request.repository, registry, connections);
  const defaults = readProjectDefaults();
  return projectCreateSchema.parse({
    ...request,
    repositoryConnectionId: connection.id,
    repository,
    baseBranch: request.baseBranch ?? repository.defaultBranch,
    defaultAgent: request.defaultAgent ?? defaults.defaultAgent,
    runtime: request.runtime ?? defaults.runtime,
  });
}

export async function resolveProjectUpdateInput(
  input: ProjectUpdateRequest,
  registry: IntegrationRegistry,
  connections: ProjectConnectionLookup,
  allowedInactiveConnectionId?: string,
): Promise<ProjectUpdate> {
  const request = projectUpdateRequestSchema.parse(input);
  if (!request.repository) {
    return projectUpdateSchema.parse(request);
  }
  const { connection, repository } = await resolveRepository(
    request.repository,
    registry,
    connections,
    allowedInactiveConnectionId,
  );
  return projectUpdateSchema.parse({
    ...request,
    repositoryConnectionId: connection.id,
    repository,
    baseBranch: request.baseBranch ?? repository.defaultBranch,
  });
}
