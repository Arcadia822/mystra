import { randomUUID } from "node:crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { getDb } from "@/lib/db";
import { GET } from "./projects/[slug]/issues/[provider]/route";
import { POST } from "./projects/[slug]/issues/[provider]/task/route";

const service = vi.hoisted(() => ({ listGitHub: vi.fn(), listLinear: vi.fn(), resolveExactIssue: vi.fn() }));
vi.mock("@/lib/db", () => ({ getDb: vi.fn() }));
vi.mock("@/lib/secrets", () => ({ getSecretProvider: vi.fn(() => undefined) }));
vi.mock("@/lib/integrations/github-credential", () => ({ defaultGitHubCredentialResolver: vi.fn(async () => ({})) }));
vi.mock("@/lib/integrations/project-issues", () => ({ ProjectIssuesService: class { listGitHub = service.listGitHub; listLinear = service.listLinear; resolveExactIssue = service.resolveExactIssue; } }));

const userId = randomUUID();
const teamId = randomUUID();
function db(role: "owner" | "admin" | "member" = "member") {
  return {
    getAuthSessionByTokenHash: vi.fn(async () => ({ id: randomUUID(), userId, activeTeamId: teamId, expiresAt: "2027-08-08T00:00:00.000Z" })),
    getUserById: vi.fn(async () => ({ id: userId, status: "active", requirePasswordChange: false })),
    resolveActiveTeam: vi.fn(async () => ({ team: { id: teamId, status: "active" }, role })),
    createTaskFromIssue: vi.fn(async (input) => ({
      created: true,
      task: {
        id: "00000000-0000-4000-8000-000000000099",
        teamId,
        title: input.title,
        description: null,
        projectId: input.projectId,
        issue: input.issue,
        status: "pending",
        metadata: {},
        statusRevision: 1,
        statusNote: null,
        statusUpdatedAt: "2026-08-08T00:00:00.000Z",
        statusActor: { kind: "system", actorId: null, agentId: null, attemptId: null, sessionId: null },
        createdAt: "2026-08-08T00:00:00.000Z",
        updatedAt: "2026-08-08T00:00:00.000Z",
      },
    })),
  };
}
function request(provider: string) { return new Request(`http://localhost/api/projects/mystra/issues/${provider}?first=25`, { headers: { authorization: "Bearer route-test-token-045" } }); }

beforeEach(() => {
  vi.clearAllMocks();
  service.listGitHub.mockResolvedValue({ provider: "github", items: [], pageInfo: { hasNextPage: false } });
  service.listLinear.mockResolvedValue({ provider: "linear", items: [], pageInfo: { hasNextPage: false } });
  service.resolveExactIssue.mockResolvedValue({
    project: { id: "00000000-0000-4000-8000-000000000010" },
    provider: "github",
    connectionId: "00000000-0000-4000-8000-000000000011",
    scopeExternalId: "repo-42",
    issue: { externalId: "issue-7", identifier: "7", title: "Exact issue", url: "https://github.com/acme/repo/issues/7" },
  });
});

describe("Project Issue Task route", () => {
  it("creates a Task without navigating, starting a Session or writing upstream", async () => {
    const database = db();
    vi.mocked(getDb).mockResolvedValue(database as never);
    const response = await POST(new Request("http://localhost/api/projects/mystra/issues/github/task", {
      method: "POST",
      headers: { authorization: "Bearer route-test-token-045", "content-type": "application/json" },
      body: JSON.stringify({ externalId: "issue-7", identifier: "7" }),
    }), { params: Promise.resolve({ slug: "mystra", provider: "github" }) });
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({ created: true, task: { issue: { externalId: "issue-7" } } });
    expect(database.createTaskFromIssue).toHaveBeenCalledTimes(1);
    expect("createSession" in database).toBe(false);
  });

  it("rejects a stale external ID before creating a Task", async () => {
    const database = db();
    vi.mocked(getDb).mockResolvedValue(database as never);
    const response = await POST(new Request("http://localhost/api/projects/mystra/issues/github/task", {
      method: "POST",
      headers: { authorization: "Bearer route-test-token-045", "content-type": "application/json" },
      body: JSON.stringify({ externalId: "stale", identifier: "7" }),
    }), { params: Promise.resolve({ slug: "mystra", provider: "github" }) });
    expect(response.status).toBe(404);
    expect(database.createTaskFromIssue).not.toHaveBeenCalled();
  });

  it("returns the existing Linear Issue Task with 200", async () => {
    const database = db();
    service.resolveExactIssue.mockResolvedValueOnce({
      project: { id: "00000000-0000-4000-8000-000000000010" },
      provider: "linear",
      connectionId: "00000000-0000-4000-8000-000000000012",
      scopeExternalId: "linear-team-1",
      issue: { externalId: "linear-issue-7", identifier: "ENG-7", title: "Exact Linear issue", url: "https://linear.app/acme/issue/ENG-7" },
    });
    database.createTaskFromIssue.mockResolvedValueOnce({
      created: false,
      task: {
        id: "00000000-0000-4000-8000-000000000099", teamId, title: "Exact Linear issue", description: null,
        projectId: "00000000-0000-4000-8000-000000000010",
        issue: { provider: "linear", connectionId: "00000000-0000-4000-8000-000000000012", scopeExternalId: "linear-team-1", externalId: "linear-issue-7", identifier: "ENG-7" },
        status: "pending", metadata: {}, statusRevision: 1, statusNote: null,
        statusUpdatedAt: "2026-08-08T00:00:00.000Z",
        statusActor: { kind: "system", actorId: null, agentId: null, attemptId: null, sessionId: null },
        createdAt: "2026-08-08T00:00:00.000Z", updatedAt: "2026-08-08T00:00:00.000Z",
      },
    });
    vi.mocked(getDb).mockResolvedValue(database as never);
    const response = await POST(new Request("http://localhost/api/projects/mystra/issues/linear/task", {
      method: "POST",
      headers: { authorization: "Bearer route-test-token-045", "content-type": "application/json" },
      body: JSON.stringify({ externalId: "linear-issue-7", identifier: "ENG-7" }),
    }), { params: Promise.resolve({ slug: "mystra", provider: "linear" }) });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ created: false, task: { issue: { provider: "linear" } } });
  });
});

describe("Project Issues route", () => {
  it("allows Member read access with the resolved active Team", async () => {
    vi.mocked(getDb).mockResolvedValue(db() as never);
    const response = await GET(request("github"), { params: Promise.resolve({ slug: "mystra", provider: "github" }) });
    expect(response.status).toBe(200);
    expect(service.listGitHub).toHaveBeenCalledWith("mystra", teamId, { first: 25, state: "open" });
    expect(service.listLinear).not.toHaveBeenCalled();
  });

  it("keeps provider orchestration isolated", async () => {
    vi.mocked(getDb).mockResolvedValue(db("admin") as never);
    const response = await GET(request("linear"), { params: Promise.resolve({ slug: "mystra", provider: "linear" }) });
    expect(response.status).toBe(200);
    expect(service.listLinear).toHaveBeenCalledWith("mystra", teamId, { first: 25 });
    expect(service.listGitHub).not.toHaveBeenCalled();
  });

  it("rejects unknown providers before either upstream path", async () => {
    vi.mocked(getDb).mockResolvedValue(db() as never);
    const response = await GET(request("all"), { params: Promise.resolve({ slug: "mystra", provider: "all" }) });
    expect(response.status).toBe(404);
    expect(service.listGitHub).not.toHaveBeenCalled();
    expect(service.listLinear).not.toHaveBeenCalled();
  });
});
