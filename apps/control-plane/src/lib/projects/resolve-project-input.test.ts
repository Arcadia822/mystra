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
    await expect(resolveProjectCreateInput(createRequest, registry())).resolves.toEqual(
      expect.objectContaining({
        repository,
        baseBranch: "trunk",
      }),
    );
  });

  it("preserves an explicit base branch and resolves update selectors atomically", async () => {
    await expect(resolveProjectCreateInput({
      ...createRequest,
      baseBranch: "release",
    }, registry())).resolves.toEqual(expect.objectContaining({
      baseBranch: "release",
    }));
    await expect(resolveProjectUpdateInput({
      repository: createRequest.repository,
    }, registry())).resolves.toEqual({
      repository,
      baseBranch: "trunk",
    });
  });

  it("rejects missing and archived repositories before persistence", async () => {
    await expect(resolveProjectCreateInput({
      ...createRequest,
      repository: { integration: "github", identifier: "arcadia/missing" },
    }, registry())).rejects.toMatchObject({ code: "REPOSITORY_NOT_FOUND" });

    await expect(resolveProjectCreateInput(
      createRequest,
      registry({ ...repository, isArchived: true }),
    )).rejects.toThrow(/INVALID_PROJECT.*archived/i);
  });
});
