import { describe, expect, it, vi } from "vitest";

import { IntegrationFailure } from "./errors";
import { ProjectIssuesService } from "./project-issues";

const teamId = "00000000-0000-4000-8000-000000000001";
const projectId = "00000000-0000-4000-8000-000000000002";
const githubConnectionId = "00000000-0000-4000-8000-000000000003";
const linearConnectionId = "00000000-0000-4000-8000-000000000004";

const project = {
  id: projectId, teamId, name: "Mystra", slug: "mystra",
  repositoryConnectionId: githubConnectionId, repositoryExternalId: "42", repositoryBaseBranch: "main",
  metadata: {}, archivedAt: null, createdAt: "2026-08-08T00:00:00.000Z", updatedAt: "2026-08-08T00:00:00.000Z",
};

function connection(id: string, integration: "github" | "linear") {
  return {
    id, teamId, integration, provider: integration,
    authMethod: integration === "github" ? "personal-access-token" : "api-key",
    providerExternalId: `${integration}-actor`, displayName: null, providerSubject: {}, connectionConfig: {}, capabilities: {},
    credentialState: "ready", credentialRef: integration === "linear" ? "linear-api-key/ref" : "github-pat/ref",
    status: "active", createdAt: "2026-08-08T00:00:00.000Z", updatedAt: "2026-08-08T00:00:00.000Z",
  };
}

describe("ProjectIssuesService", () => {
  it("uses the exact Project GitHub binding and wraps the provider cursor", async () => {
    const listProjectIssues = vi.fn(async () => ({ provider: "github" as const, items: [], pageInfo: { hasNextPage: true, endCursor: "2" } }));
    const db = {
      getProjectBySlug: vi.fn(async () => project),
      getIntegrationConnectionRecord: vi.fn(async () => connection(githubConnectionId, "github")),
      getProjectIssueSource: vi.fn(async () => undefined),
      findTaskIdsByIssueExternalIds: vi.fn(async () => ({})),
    };
    const service = new ProjectIssuesService({
      db: db as never,
      githubCredentials: { resolve: vi.fn(async () => ({ connection: connection(githubConnectionId, "github"), credential: { provider: "github", username: "x-access-token", secret: "token", expiresAt: "2026-08-08T01:00:00.000Z" } })) } as never,
      githubProvider: () => ({ listProjectIssues, getProjectIssue: vi.fn() }),
    });

    const first = await service.listGitHub("mystra", teamId, { first: 25, state: "open" });
    expect(listProjectIssues).toHaveBeenCalledWith(expect.objectContaining({ repositoryExternalId: "42" }));
    expect(first.pageInfo.endCursor).not.toBe("2");
    await service.listGitHub("mystra", teamId, { first: 25, state: "open", after: first.pageInfo.endCursor! });
    expect(listProjectIssues).toHaveBeenLastCalledWith(expect.objectContaining({ after: "2" }));
  });

  it("fails closed when Linear is not configured", async () => {
    const service = new ProjectIssuesService({
      db: {
        getProjectBySlug: vi.fn(async () => project),
        getIntegrationConnectionRecord: vi.fn(),
        getProjectIssueSource: vi.fn(async () => undefined),
        findTaskIdsByIssueExternalIds: vi.fn(async () => ({})),
      } as never,
      githubCredentials: { resolve: vi.fn() } as never,
    });
    await expect(service.listLinear("mystra", teamId, { first: 25 })).rejects.toEqual(expect.objectContaining<Partial<IntegrationFailure>>({ code: "ISSUE_SOURCE_NOT_CONFIGURED" }));
  });

  it("uses the configured Linear connection, Team and SecretProvider value", async () => {
    const listProjectIssues = vi.fn(async () => ({ provider: "linear" as const, items: [], pageInfo: { hasNextPage: false } }));
    const service = new ProjectIssuesService({
      db: {
        getProjectBySlug: vi.fn(async () => project),
        getIntegrationConnectionRecord: vi.fn(async () => connection(linearConnectionId, "linear")),
        getProjectIssueSource: vi.fn(async () => ({ connectionId: linearConnectionId, scopeExternalId: "linear-team-7" })),
        findTaskIdsByIssueExternalIds: vi.fn(async () => ({})),
      } as never,
      githubCredentials: { resolve: vi.fn() } as never,
      secrets: { get: vi.fn(async () => "lin-secret") } as never,
      linearProvider: (apiKey) => {
        expect(apiKey).toBe("lin-secret");
        return { listProjectIssues, getProjectIssue: vi.fn() };
      },
    });
    await service.listLinear("mystra", teamId, { first: 25, priority: 2 });
    expect(listProjectIssues).toHaveBeenCalledWith(expect.objectContaining({ linearTeamExternalId: "linear-team-7", priority: 2 }));
  });

  it("resolves an exact GitHub Issue only after checking the current connection and scope", async () => {
    const getProjectIssue = vi.fn(async () => ({
      externalId: "101", number: 7, title: "Exact", state: "open" as const, assignees: [], labels: [],
      milestone: null, updatedAt: "2026-08-08T00:00:00.000Z", url: "https://github.com/arcadia/mystra/issues/7",
    }));
    const getIntegrationConnectionRecord = vi.fn(async () => connection(githubConnectionId, "github"));
    const service = new ProjectIssuesService({
      db: {
        getProjectBySlug: vi.fn(async () => project),
        getIntegrationConnectionRecord,
        getProjectIssueSource: vi.fn(),
        findTaskIdsByIssueExternalIds: vi.fn(async () => ({})),
      } as never,
      githubCredentials: { resolve: vi.fn(async () => ({ connection: connection(githubConnectionId, "github"), credential: { secret: "token" } })) } as never,
      githubProvider: () => ({ listProjectIssues: vi.fn(), getProjectIssue }),
    });
    await expect(service.resolveExactIssue("mystra", teamId, "github", "7")).resolves.toMatchObject({
      connectionId: githubConnectionId,
      scopeExternalId: "42",
      issue: { externalId: "101" },
    });
    expect(getIntegrationConnectionRecord).toHaveBeenCalledWith(githubConnectionId);
    expect(getProjectIssue).toHaveBeenCalledWith({ repositoryExternalId: "42", identifier: "7" });
  });

  it("fails before provider access when a stored Linear source no longer resolves", async () => {
    const getProjectIssue = vi.fn();
    const service = new ProjectIssuesService({
      db: {
        getProjectBySlug: vi.fn(async () => project),
        getIntegrationConnectionRecord: vi.fn(async () => undefined),
        getProjectIssueSource: vi.fn(async () => ({ connectionId: linearConnectionId, scopeExternalId: "linear-team-7" })),
        findTaskIdsByIssueExternalIds: vi.fn(async () => ({})),
      } as never,
      githubCredentials: { resolve: vi.fn() } as never,
      secrets: { get: vi.fn(async () => "secret") } as never,
      linearProvider: () => ({ listProjectIssues: vi.fn(), getProjectIssue }),
    });
    await expect(service.resolveExactIssue("mystra", teamId, "linear", "ENG-7"))
      .rejects.toMatchObject({ code: "ISSUE_SCOPE_UNAVAILABLE" });
    expect(getProjectIssue).not.toHaveBeenCalled();
  });
});
