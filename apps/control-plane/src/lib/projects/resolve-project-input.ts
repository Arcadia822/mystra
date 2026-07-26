import {
  projectCreateRequestSchema,
  projectCreateSchema,
  projectUpdateRequestSchema,
  projectUpdateSchema,
  type ProjectCreate,
  type ProjectCreateRequest,
  type ProjectUpdate,
  type ProjectUpdateRequest,
  type RepositorySnapshot,
} from "@mystra/shared";

import { IntegrationFailure } from "../integrations/errors";
import type { IntegrationRegistry } from "../integrations/registry";

async function resolveRepository(
  input: { integration: string; identifier: string },
  registry: IntegrationRegistry,
): Promise<RepositorySnapshot> {
  const repository = await registry
    .requireRepoProvider(input.integration)
    .getRepository(input.identifier);
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
  return repository;
}

export async function resolveProjectCreateInput(
  input: ProjectCreateRequest,
  registry: IntegrationRegistry,
): Promise<ProjectCreate> {
  const request = projectCreateRequestSchema.parse(input);
  const repository = await resolveRepository(request.repository, registry);
  return projectCreateSchema.parse({
    ...request,
    repository,
    baseBranch: request.baseBranch ?? repository.defaultBranch,
  });
}

export async function resolveProjectUpdateInput(
  input: ProjectUpdateRequest,
  registry: IntegrationRegistry,
): Promise<ProjectUpdate> {
  const request = projectUpdateRequestSchema.parse(input);
  if (!request.repository) {
    return projectUpdateSchema.parse(request);
  }
  const repository = await resolveRepository(request.repository, registry);
  return projectUpdateSchema.parse({
    ...request,
    repository,
    baseBranch: request.baseBranch ?? repository.defaultBranch,
  });
}
