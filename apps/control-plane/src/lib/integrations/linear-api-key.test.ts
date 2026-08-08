import { describe, expect, it, vi } from "vitest";

import { listLinearTeams, validateLinearApiKey } from "./linear-api-key";

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("Linear API-key validation", () => {
  it("validates viewer, workspace, Team access and Issue read without exposing the key", async () => {
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      expect(init?.headers).toMatchObject({ authorization: "lin_secret" });
      return response({ data: {
        viewer: { id: "viewer-1", name: "Ada" },
        organization: { id: "workspace-1", name: "Mystra" },
        teams: { nodes: [{ id: "team-1", key: "ENG", name: "Engineering", archivedAt: null }], pageInfo: { hasNextPage: false, endCursor: null } },
        issues: { nodes: [] },
      } });
    });

    await expect(validateLinearApiKey("lin_secret", { fetchImpl })).resolves.toMatchObject({
      providerExternalId: "viewer-1",
      workspace: { id: "workspace-1", name: "Mystra" },
      teamCount: 1,
    });
  });

  it("rejects GraphQL errors even when HTTP status is 200", async () => {
    await expect(validateLinearApiKey("lin_secret", {
      fetchImpl: vi.fn(async () => response({ data: { viewer: null }, errors: [{ message: "denied" }] })),
    })).rejects.toMatchObject({ code: "INTEGRATION_UNAUTHORIZED" });
  });

  it("maps unauthorized and rate-limited responses", async () => {
    await expect(validateLinearApiKey("bad", {
      fetchImpl: vi.fn(async () => response({}, 401)),
    })).rejects.toMatchObject({ code: "INTEGRATION_UNAUTHORIZED" });
    await expect(validateLinearApiKey("limited", {
      fetchImpl: vi.fn(async () => new Response("{}", { status: 429, headers: { "retry-after": "12" } })),
    })).rejects.toMatchObject({ code: "INTEGRATION_RATE_LIMITED", retryAfterSeconds: 12 });
    await expect(validateLinearApiKey("forbidden", {
      fetchImpl: vi.fn(async () => response({}, 403)),
    })).rejects.toMatchObject({ code: "INTEGRATION_UNAUTHORIZED" });
  });

  it("rejects invalid payloads and timeout failures", async () => {
    await expect(validateLinearApiKey("invalid-shape", {
      fetchImpl: vi.fn(async () => response({ data: { viewer: { id: "viewer-1" } } })),
    })).rejects.toMatchObject({ code: "INTEGRATION_INVALID_RESPONSE" });
    await expect(validateLinearApiKey("timeout", {
      fetchImpl: vi.fn(async () => { throw new DOMException("timed out", "AbortError"); }),
      timeoutMs: 1,
    })).rejects.toMatchObject({ code: "INTEGRATION_TIMEOUT" });
  });

  it("lists cursor-paginated Teams through the exact key", async () => {
    const fetchImpl = vi.fn(async () => response({ data: {
      teams: { nodes: [{ id: "team-2", key: "OPS", name: "Operations", archivedAt: null }], pageInfo: { hasNextPage: true, endCursor: "next" } },
    } }));
    await expect(listLinearTeams("lin_secret", { first: 10, after: "cursor" }, { fetchImpl }))
      .resolves.toEqual({ teams: [{ id: "team-2", key: "OPS", name: "Operations", archivedAt: null }], pageInfo: { hasNextPage: true, endCursor: "next" } });
  });
});
