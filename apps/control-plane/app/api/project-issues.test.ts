import { randomUUID } from "node:crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { getDb } from "@/lib/db";
import { GET } from "./projects/[slug]/issues/[provider]/route";

const service = vi.hoisted(() => ({ listGitHub: vi.fn(), listLinear: vi.fn() }));
vi.mock("@/lib/db", () => ({ getDb: vi.fn() }));
vi.mock("@/lib/secrets", () => ({ getSecretProvider: vi.fn(() => undefined) }));
vi.mock("@/lib/integrations/github-credential", () => ({ defaultGitHubCredentialResolver: vi.fn(async () => ({})) }));
vi.mock("@/lib/integrations/project-issues", () => ({ ProjectIssuesService: class { listGitHub = service.listGitHub; listLinear = service.listLinear; } }));

const userId = randomUUID();
const teamId = randomUUID();
function db(role: "owner" | "admin" | "member" = "member") {
  return {
    getAuthSessionByTokenHash: vi.fn(async () => ({ id: randomUUID(), userId, activeTeamId: teamId, expiresAt: "2027-08-08T00:00:00.000Z" })),
    getUserById: vi.fn(async () => ({ id: userId, status: "active", requirePasswordChange: false })),
    resolveActiveTeam: vi.fn(async () => ({ team: { id: teamId, status: "active" }, role })),
  };
}
function request(provider: string) { return new Request(`http://localhost/api/projects/mystra/issues/${provider}?first=25`, { headers: { authorization: "Bearer route-test-token-045" } }); }

beforeEach(() => {
  vi.clearAllMocks();
  service.listGitHub.mockResolvedValue({ provider: "github", items: [], pageInfo: { hasNextPage: false } });
  service.listLinear.mockResolvedValue({ provider: "linear", items: [], pageInfo: { hasNextPage: false } });
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
