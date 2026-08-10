import { describe, expect, it, vi } from "vitest";

import type { IntegrationConnectionRecord } from "../db/rdb-provider.js";
import { readGitRemoteAccess } from "./remote-access.js";
import { ProjectRemoteAccessFactory } from "./remote-access-factory.js";

const teamId = "00000000-0000-4000-8000-000000000001";
const connectionId = "00000000-0000-4000-8000-000000000003";
const project = {
  id: "00000000-0000-4000-8000-000000000002",
  teamId,
  name: "Mystra",
  slug: "mystra",
  repositoryConnectionId: connectionId,
  repositoryExternalId: "42",
  repositoryBaseBranch: "main",
  metadata: {},
  archivedAt: null,
  createdAt: "2026-08-10T00:00:00.000Z",
  updatedAt: "2026-08-10T00:00:00.000Z",
};

function connection(id = connectionId): IntegrationConnectionRecord {
  return {
    id,
    teamId,
    integration: "github",
    provider: "github",
    authMethod: "personal-access-token",
    providerExternalId: "octocat",
    displayName: null,
    providerSubject: {},
    connectionConfig: {},
    capabilities: {},
    credentialState: "ready",
    credentialRef: "github-pat/ref",
    status: "active",
    createdAt: "2026-08-10T00:00:00.000Z",
    updatedAt: "2026-08-10T00:00:00.000Z",
  };
}

const repository = {
  integration: "github",
  provider: "github",
  externalId: "42",
  fullName: "example/mystra",
  url: "https://github.com/example/mystra",
  cloneUrl: "https://github.com/example/mystra.git",
  defaultBranch: "main",
  visibility: "private" as const,
  isArchived: false,
  fetchedAt: "2026-08-10T00:00:00.000Z",
};

describe("ProjectRemoteAccessFactory", () => {
  it("resolves only the exact Project connection and repository into opaque transient access", async () => {
    const resolve = vi.fn(async () => ({
      connection: connection(),
      credential: {
        provider: "github" as const,
        username: "x-access-token" as const,
        secret: "private-token",
        expiresAt: "2026-08-10T00:05:00.000Z",
      },
    }));
    const getProjectRepository = vi.fn(async () => repository);
    const factory = new ProjectRemoteAccessFactory({
      githubCredentials: { resolve },
      githubProvider: () => ({ getProjectRepository }),
    });

    const access = await factory.resolve(project);

    expect(resolve).toHaveBeenCalledWith(connectionId);
    expect(getProjectRepository).toHaveBeenCalledWith("42");
    expect(readGitRemoteAccess(access)).toEqual({
      endpoint: "https://github.com/example/mystra.git",
      credential: {
        kind: "http-basic-token",
        username: "x-access-token",
        secret: "private-token",
      },
    });
    expect(JSON.stringify(access)).toBe("{}");
  });

  it("fails closed on connection, Team, repository identity, and repository state mismatch", async () => {
    const cases = [
      { resolvedConnection: connection("00000000-0000-4000-8000-000000000099"), resolvedRepository: repository },
      { resolvedConnection: { ...connection(), teamId: "00000000-0000-4000-8000-000000000099" }, resolvedRepository: repository },
      { resolvedConnection: connection(), resolvedRepository: { ...repository, externalId: "99" } },
      { resolvedConnection: connection(), resolvedRepository: { ...repository, isArchived: true } },
      { resolvedConnection: connection(), resolvedRepository: undefined },
    ];

    for (const value of cases) {
      const factory = new ProjectRemoteAccessFactory({
        githubCredentials: {
          resolve: vi.fn(async () => ({
            connection: value.resolvedConnection,
            credential: {
              provider: "github" as const,
              username: "x-access-token" as const,
              secret: "private-token",
              expiresAt: "2026-08-10T00:05:00.000Z",
            },
          })),
        },
        githubProvider: () => ({
          getProjectRepository: vi.fn(async () => value.resolvedRepository),
        }),
      });
      await expect(factory.resolve(project)).rejects.toMatchObject({ code: "repository_unavailable" });
    }
  });
});
