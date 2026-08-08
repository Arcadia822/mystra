import { describe, expect, it, vi } from "vitest";

import { ProjectIssueSourceService } from "./project-issue-sources";

const teamId = "00000000-0000-4000-8000-000000000001";
const projectId = "00000000-0000-4000-8000-000000000002";
const githubConnectionId = "00000000-0000-4000-8000-000000000003";
const linearConnectionId = "00000000-0000-4000-8000-000000000004";
const project = { id: projectId, teamId, slug: "mystra", repositoryConnectionId: githubConnectionId, repositoryExternalId: "42", archivedAt: null };

function connection(id: string, integration: "github" | "linear", owner = teamId) {
  return {
    id, teamId: owner, integration, provider: integration, authMethod: integration === "linear" ? "api-key" : "personal-access-token",
    status: "active", credentialState: "ready", credentialRef: `${integration}/secret`,
  };
}

describe("ProjectIssueSourceService", () => {
  it("derives GitHub and resolves configured Linear Team with the exact connection", async () => {
    const db = {
      getProjectBySlug: vi.fn(async () => project),
      getProjectIssueSource: vi.fn(async () => ({ connectionId: linearConnectionId, scopeExternalId: "linear-team-1" })),
      getIntegrationConnectionRecord: vi.fn(async (id: string) => id === githubConnectionId ? connection(id, "github") : connection(id, "linear")),
      upsertProjectIssueSource: vi.fn(), deleteProjectIssueSource: vi.fn(),
    };
    const resolveTeam = vi.fn(async () => ({ id: "linear-team-1", key: "MYS", name: "Mystra", archivedAt: null }));
    const result = await new ProjectIssueSourceService({ db: db as never, secrets: { get: vi.fn(async () => "lin-key") } as never, resolveTeam }).get("mystra", teamId);
    expect(result.github).toMatchObject({ connectionId: githubConnectionId, repositoryExternalId: "42", availability: "available" });
    expect(result.linear).toMatchObject({ connectionId: linearConnectionId, linearTeamExternalId: "linear-team-1", team: { key: "MYS" } });
    expect(resolveTeam).toHaveBeenCalledWith("lin-key", "linear-team-1");
  });

  it("revalidates Team external ID before a single-source upsert", async () => {
    const upsertProjectIssueSource = vi.fn();
    const db = {
      getProjectBySlug: vi.fn(async () => project),
      getProjectIssueSource: vi.fn(async () => undefined),
      getIntegrationConnectionRecord: vi.fn(async (id: string) => id === githubConnectionId ? connection(id, "github") : connection(id, "linear")),
      upsertProjectIssueSource, deleteProjectIssueSource: vi.fn(),
    };
    const resolveTeam = vi.fn(async () => ({ id: "linear-team-1", key: "MYS", name: "Mystra", archivedAt: null }));
    const service = new ProjectIssueSourceService({ db: db as never, secrets: { get: vi.fn(async () => "lin-key") } as never, resolveTeam });
    await service.upsert("mystra", teamId, { connectionId: linearConnectionId, linearTeamExternalId: "linear-team-1" });
    expect(upsertProjectIssueSource).toHaveBeenCalledWith(expect.objectContaining({ projectId, connectionId: linearConnectionId, scopeExternalId: "linear-team-1" }));
    expect(project.repositoryConnectionId).toBe(githubConnectionId);
  });

  it("fails closed for a cross-Team Linear connection", async () => {
    const service = new ProjectIssueSourceService({
      db: {
        getProjectBySlug: vi.fn(async () => project), getProjectIssueSource: vi.fn(),
        getIntegrationConnectionRecord: vi.fn(async () => connection(linearConnectionId, "linear", "00000000-0000-4000-8000-000000000099")),
        upsertProjectIssueSource: vi.fn(), deleteProjectIssueSource: vi.fn(),
      } as never,
      secrets: { get: vi.fn(async () => "lin-key") } as never,
    });
    await expect(service.upsert("mystra", teamId, { connectionId: linearConnectionId, linearTeamExternalId: "linear-team-1" }))
      .rejects.toMatchObject({ code: "INTEGRATION_CONNECTION_MISMATCH" });
  });
});
