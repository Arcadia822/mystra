import { describe, expect, it } from "vitest";

import { IntegrationRegistry } from "../integrations/registry";
import type { IntegrationPlugin } from "../integrations/types";
import {
  resolveProjectCreateInput,
  resolveProjectUpdateInput,
} from "./resolve-project-input";

const repository = {
  integration: "github",
  provider: "github",
  externalId: "42",
  fullName: "arcadia/mystra-fixture",
  url: "https://github.com/arcadia/mystra-fixture",
  cloneUrl: "https://github.com/arcadia/mystra-fixture.git",
  defaultBranch: "trunk",
  visibility: "private" as const,
  isArchived: false,
  fetchedAt: "2026-07-25T00:00:00.000Z",
};

const connection = {
  id: "00000000-0000-4000-8000-000000000039",
  integration: "github",
  provider: "github",
  externalId: "18492",
  account: { externalId: "42", login: "arcadia", type: "User" },
  repositorySelection: "selected" as const,
  permissions: { contents: "write", pull_requests: "write" },
  status: "active" as const,
  createdAt: "2026-08-05T08:00:00.000Z",
  updatedAt: "2026-08-05T08:00:00.000Z",
};

const connections = {
  getIntegrationConnection(id: string) {
    return id === connection.id ? connection : undefined;
  },
};

function registry(resolved = repository): IntegrationRegistry {
  const plugin: IntegrationPlugin = {
    descriptor: {
      name: "github",
      provider: "github",
      capabilities: ["repositories"],
    },
    capabilities: {
      repositories: {
        providerName: "github",
        async listRepositories() {
          return { items: [resolved], pageInfo: { hasNextPage: false } };
        },
        async getRepository(identifier) {
          return identifier === resolved.fullName ? resolved : undefined;
        },
      },
    },
  };
  return new IntegrationRegistry([plugin]);
}

const createRequest = {
  name: "Fixture",
  slug: "fixture",
  repository: {
    integration: "github",
    connectionId: connection.id,
    identifier: "arcadia/mystra-fixture",
  },
  defaultAgent: "copilot" as const,
  runtime: {
    provider: "docker" as const,
    image: "mystra-copilot:fixture",
  },
};

describe("Project request resolution", () => {
  it("resolves a selector and defaults the base branch from the remote snapshot", async () => {
    await expect(resolveProjectCreateInput(createRequest, registry(), connections)).resolves.toEqual(
      expect.objectContaining({
        repositoryConnectionId: connection.id,
        repository,
        baseBranch: "trunk",
      }),
    );
  });

  it("preserves an explicit base branch and resolves update selectors atomically", async () => {
    await expect(resolveProjectCreateInput({
      ...createRequest,
      baseBranch: "release",
    }, registry(), connections)).resolves.toEqual(expect.objectContaining({
      baseBranch: "release",
    }));
    await expect(resolveProjectUpdateInput({
      repository: createRequest.repository,
    }, registry(), connections)).resolves.toEqual({
      repositoryConnectionId: connection.id,
      repository,
      baseBranch: "trunk",
    });
  });

  it("rejects missing and archived repositories before persistence", async () => {
    await expect(resolveProjectCreateInput({
      ...createRequest,
      repository: { ...createRequest.repository, identifier: "arcadia/missing" },
    }, registry(), connections)).rejects.toMatchObject({ code: "REPOSITORY_NOT_FOUND" });

    await expect(resolveProjectCreateInput(
      createRequest,
      registry({ ...repository, isArchived: true }),
      connections,
    )).rejects.toThrow(/INVALID_PROJECT.*archived/i);
  });

  it("rejects missing, inactive and provider-mismatched connections", async () => {
    await expect(resolveProjectCreateInput({
      ...createRequest,
      repository: { ...createRequest.repository, connectionId: "00000000-0000-4000-8000-000000000099" },
    }, registry(), connections)).rejects.toMatchObject({ code: "INTEGRATION_CONNECTION_NOT_FOUND" });

    await expect(resolveProjectCreateInput(createRequest, registry(), {
      getIntegrationConnection: () => ({ ...connection, status: "inactive" as const }),
    })).rejects.toMatchObject({ code: "INTEGRATION_CONNECTION_INACTIVE" });

    await expect(resolveProjectCreateInput(createRequest, registry(), {
      getIntegrationConnection: () => ({ ...connection, provider: "gitlab" }),
    })).rejects.toMatchObject({ code: "INTEGRATION_CONNECTION_MISMATCH" });
  });
});
