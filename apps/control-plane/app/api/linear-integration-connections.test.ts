import { randomUUID } from "node:crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { getDb } from "@/lib/db";
import { POST } from "./integration-connections/linear/api-key/route";
import { PUT } from "./integration-connections/linear/api-key/[id]/route";

const service = vi.hoisted(() => ({
  create: vi.fn(), replace: vi.fn(), delete: vi.fn(), listTeams: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ getDb: vi.fn() }));
vi.mock("@/lib/secrets", () => ({ getSecretProvider: vi.fn(() => undefined) }));
vi.mock("@/lib/integrations/linear-api-key-service", () => ({
  LinearApiKeyConnectionService: class {
    create = service.create;
    replace = service.replace;
    delete = service.delete;
    listTeams = service.listTeams;
  },
}));

const userId = randomUUID();
const teamId = randomUUID();
const connectionId = randomUUID();
const connection = {
  id: connectionId, teamId, integration: "linear", provider: "linear", authMethod: "api-key",
  providerExternalId: "viewer-1", displayName: "Product", providerSubject: { workspaceName: "Mystra" },
  connectionConfig: {}, capabilities: {}, credentialState: "ready", status: "active",
  createdAt: "2026-08-08T00:00:00.000Z", updatedAt: "2026-08-08T00:00:00.000Z",
};

function db(role: "owner" | "admin" | "member") {
  return {
    getAuthSessionByTokenHash: vi.fn(async () => ({ id: randomUUID(), userId, tokenHash: "hash", activeTeamId: teamId, expiresAt: "2027-08-08T00:00:00.000Z", createdAt: "2026-08-08T00:00:00.000Z", updatedAt: "2026-08-08T00:00:00.000Z" })),
    getUserById: vi.fn(async () => ({ id: userId, username: "operator", displayUsername: "operator", displayName: "Operator", status: "active", requirePasswordChange: false, createdAt: "2026-08-08T00:00:00.000Z", updatedAt: "2026-08-08T00:00:00.000Z" })),
    resolveActiveTeam: vi.fn(async () => ({ team: { id: teamId, displayName: "Primary", status: "active", createdAt: "2026-08-08T00:00:00.000Z", updatedAt: "2026-08-08T00:00:00.000Z" }, role })),
  };
}

function request(method: string, apiKey = "lin_secret") {
  return new Request("http://localhost/api/integration-connections/linear/api-key", {
    method, headers: { authorization: "Bearer route-test-token-045", "content-type": "application/json" },
    body: JSON.stringify({ apiKey, displayName: "Product" }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  service.create.mockResolvedValue(connection);
  service.replace.mockResolvedValue(connection);
});

describe("Linear API-key connection routes", () => {
  it("lets an Owner create a secret-free connection response", async () => {
    vi.mocked(getDb).mockResolvedValue(db("owner") as never);
    const response = await POST(request("POST"));
    expect(response.status).toBe(201);
    expect(service.create).toHaveBeenCalledWith({ apiKey: "lin_secret", displayName: "Product" });
    expect(JSON.stringify(await response.json())).not.toContain("lin_secret");
  });

  it("lets an Admin replace the exact connection", async () => {
    vi.mocked(getDb).mockResolvedValue(db("admin") as never);
    const response = await PUT(request("PUT", "lin_new"), { params: Promise.resolve({ id: connectionId }) });
    expect(response.status).toBe(200);
    expect(service.replace).toHaveBeenCalledWith(connectionId, { apiKey: "lin_new", displayName: "Product" });
  });

  it("denies a Member before the service receives the API key", async () => {
    vi.mocked(getDb).mockResolvedValue(db("member") as never);
    const response = await POST(request("POST"));
    expect(response.status).toBe(403);
    expect(service.create).not.toHaveBeenCalled();
  });
});
