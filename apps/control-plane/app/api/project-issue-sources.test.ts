import { randomUUID } from "node:crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { getDb } from "@/lib/db";
import { GET } from "./projects/[slug]/issue-sources/route";
import { PUT } from "./projects/[slug]/issue-sources/linear/route";

const sourceService = vi.hoisted(() => ({ get: vi.fn(), upsert: vi.fn(), delete: vi.fn() }));
vi.mock("@/lib/db", () => ({ getDb: vi.fn() }));
vi.mock("@/lib/secrets", () => ({ getSecretProvider: vi.fn(() => undefined) }));
vi.mock("@/lib/integrations/project-issue-sources", () => ({ ProjectIssueSourceService: class { get = sourceService.get; upsert = sourceService.upsert; delete = sourceService.delete; } }));

const userId = randomUUID();
const teamId = randomUUID();
const connectionId = randomUUID();
const sources = {
  github: { integration: "github", connectionId, repositoryExternalId: "42", availability: "available" },
  linear: null,
};
function db(role: "owner" | "admin" | "member") {
  return {
    getAuthSessionByTokenHash: vi.fn(async () => ({ id: randomUUID(), userId, activeTeamId: teamId, expiresAt: "2027-08-08T00:00:00.000Z" })),
    getUserById: vi.fn(async () => ({ id: userId, status: "active", requirePasswordChange: false })),
    resolveActiveTeam: vi.fn(async () => ({ team: { id: teamId, status: "active" }, role })),
  };
}
function request(method = "GET") {
  return new Request("http://localhost/api/projects/mystra/issue-sources/linear", {
    method, headers: { authorization: "Bearer route-test-token-045", ...(method === "PUT" ? { "content-type": "application/json" } : {}) },
    ...(method === "PUT" ? { body: JSON.stringify({ connectionId, linearTeamExternalId: "linear-team-1" }) } : {}),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  sourceService.get.mockResolvedValue(sources);
  sourceService.upsert.mockResolvedValue(sources);
});

describe("Project Issue source routes", () => {
  it("allows a Member to read source availability", async () => {
    vi.mocked(getDb).mockResolvedValue(db("member") as never);
    const response = await GET(request(), { params: Promise.resolve({ slug: "mystra" }) });
    expect(response.status).toBe(200);
    expect(sourceService.get).toHaveBeenCalledWith("mystra", teamId);
  });

  it("denies Member source mutation before revalidation", async () => {
    vi.mocked(getDb).mockResolvedValue(db("member") as never);
    const response = await PUT(request("PUT"), { params: Promise.resolve({ slug: "mystra" }) });
    expect(response.status).toBe(403);
    expect(sourceService.upsert).not.toHaveBeenCalled();
  });

  it("allows an Admin to save one exact Linear source", async () => {
    vi.mocked(getDb).mockResolvedValue(db("admin") as never);
    const response = await PUT(request("PUT"), { params: Promise.resolve({ slug: "mystra" }) });
    expect(response.status).toBe(200);
    expect(sourceService.upsert).toHaveBeenCalledWith("mystra", teamId, { connectionId, linearTeamExternalId: "linear-team-1" });
  });
});
