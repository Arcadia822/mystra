import { describe, expect, it, vi } from "vitest";

import { IntegrationFailure } from "./errors";
import { LinearIssueProvider } from "./linear";

const linearIssue = {
  id: "issue-id",
  identifier: "MYS-101",
  title: "Ship the demo",
  description: "Complete the vertical slice.",
  url: "https://linear.app/mystra/issue/MYS-101",
  priority: 2,
  priorityLabel: "High",
  state: { id: "state-id", name: "Todo", type: "unstarted" },
  assignee: { id: "user-id", name: "Arcadia" },
  labels: { nodes: [{ id: "label-id", name: "demo" }] },
  createdAt: "2026-07-23T01:00:00.000Z",
  updatedAt: "2026-07-23T02:00:00.000Z",
  cycle: { id: "cycle-id", name: "Cycle 12", number: 12 },
};

function graphQlResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}

describe("LinearIssueProvider", () => {
  it("lists native Issue rows through an exact Linear Team filter", async () => {
    const fetchImpl = vi.fn(async (..._args: Parameters<typeof fetch>) => graphQlResponse({
      data: { issues: { nodes: [linearIssue], pageInfo: { hasNextPage: false, endCursor: null } } },
    }));
    const provider = new LinearIssueProvider({ apiKey: "linear-test-key", fetchImpl });
    const result = await provider.listProjectIssues({
      linearTeamExternalId: "team-id",
      first: 25,
      priority: 2,
      cycle: "cycle-id",
    });

    expect(result.provider).toBe("linear");
    expect(result.items[0]).toMatchObject({ identifier: "MYS-101", cycle: { number: 12 } });
    const request = JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body)) as { variables: Record<string, unknown> };
    expect(request.variables.filter).toEqual({
      team: { id: { eq: "team-id" } },
      priority: { eq: 2 },
      cycle: { id: { eq: "cycle-id" } },
    });
  });

  it("lists normalized Issues and forwards an opaque cursor", async () => {
    const fetchImpl = vi.fn(async (..._args: Parameters<typeof fetch>) =>
      graphQlResponse({
        data: {
          issues: {
            nodes: [linearIssue],
            pageInfo: { hasNextPage: true, endCursor: "opaque-cursor" },
          },
        },
      }));
    const provider = new LinearIssueProvider({
      apiKey: "linear-test-key",
      fetchImpl,
      timeoutMs: 100,
    });

    const result = await provider.listIssues({ first: 10, after: "incoming-cursor" });

    expect(result.items[0]).toEqual(expect.objectContaining({
      reference: expect.objectContaining({
        integration: "linear",
        provider: "linear",
        externalId: "issue-id",
        identifier: "MYS-101",
      }),
      title: "Ship the demo",
      state: { id: "state-id", name: "Todo", type: "unstarted" },
      priority: { value: 2, label: "High" },
      assignee: { id: "user-id", name: "Arcadia" },
      labels: [{ id: "label-id", name: "demo" }],
      fetchedAt: expect.any(String),
    }));
    expect(result.pageInfo).toEqual({ hasNextPage: true, endCursor: "opaque-cursor" });
    const request = JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body)) as {
      query: string;
      variables: { first: number; after: string };
    };
    expect(request.variables).toEqual({ first: 10, after: "incoming-cursor" });
    expect(request.query).toContain("issues(first: $first, after: $after)");
  });

  it("gets an Issue by identifier and returns undefined only for explicit null", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(graphQlResponse({ data: { issue: linearIssue } }))
      .mockResolvedValueOnce(graphQlResponse({ data: { issue: null } }));
    const provider = new LinearIssueProvider({ apiKey: "linear-test-key", fetchImpl });

    expect((await provider.getIssue({ identifier: "MYS-101" }))?.reference.identifier)
      .toBe("MYS-101");
    expect(await provider.getIssue({ identifier: "MYS-404" })).toBeUndefined();

    const request = JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body)) as {
      query: string;
      variables: { identifier: string };
    };
    expect(request.variables.identifier).toBe("MYS-101");
    expect(request.query).toContain("issue(id: $identifier)");
  });

  it("fails closed when LINEAR_API_KEY is missing without calling fetch", async () => {
    const fetchImpl = vi.fn();
    const provider = new LinearIssueProvider({ apiKey: undefined, fetchImpl });

    await expect(provider.listIssues({ first: 25 })).rejects.toMatchObject({
      code: "INTEGRATION_NOT_CONFIGURED",
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it.each([401, 403])("maps HTTP %s to unauthorized without exposing credentials", async (status) => {
    const fetchImpl = vi.fn(async () => new Response("authorization failed", { status }));
    const provider = new LinearIssueProvider({ apiKey: "secret-linear-key", fetchImpl });

    const error = await provider.getIssue({ identifier: "MYS-101" })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(IntegrationFailure);
    expect(error).toMatchObject({ code: "INTEGRATION_UNAUTHORIZED" });
    expect(String(error)).not.toContain("secret-linear-key");
  });

  it("maps 429 and preserves a valid retry-after duration", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response("rate limited", { status: 429, headers: { "retry-after": "17" } }));
    const provider = new LinearIssueProvider({ apiKey: "linear-test-key", fetchImpl });

    await expect(provider.listIssues({ first: 25 })).rejects.toMatchObject({
      code: "INTEGRATION_RATE_LIMITED",
      retryAfterSeconds: 17,
    });
  });

  it("maps timeout and upstream 5xx failures", async () => {
    const timeoutProvider = new LinearIssueProvider({
      apiKey: "linear-test-key",
      fetchImpl: vi.fn(async () => {
        throw new DOMException("aborted", "AbortError");
      }),
      timeoutMs: 1,
    });
    const upstreamProvider = new LinearIssueProvider({
      apiKey: "linear-test-key",
      fetchImpl: vi.fn(async () => new Response("unavailable", { status: 503 })),
    });

    await expect(timeoutProvider.getIssue({ identifier: "MYS-101" })).rejects.toMatchObject({
      code: "INTEGRATION_TIMEOUT",
    });
    await expect(upstreamProvider.getIssue({ identifier: "MYS-101" })).rejects.toMatchObject({
      code: "INTEGRATION_UPSTREAM_ERROR",
    });
  });

  it("rejects GraphQL errors even when partial data is present", async () => {
    const provider = new LinearIssueProvider({
      apiKey: "linear-test-key",
      fetchImpl: vi.fn(async () =>
        graphQlResponse({
          data: { issue: linearIssue },
          errors: [{ message: "partial authorization failure" }],
        })),
    });

    await expect(provider.getIssue({ identifier: "MYS-101" })).rejects.toMatchObject({
      code: "INTEGRATION_UPSTREAM_ERROR",
    });
  });

  it.each([
    { data: { issues: { nodes: [{ ...linearIssue, url: "not-a-url" }], pageInfo: { hasNextPage: false } } } },
    { data: { issues: { nodes: null, pageInfo: { hasNextPage: false } } } },
    { data: null },
  ])("rejects malformed provider payloads", async (body) => {
    const provider = new LinearIssueProvider({
      apiKey: "linear-test-key",
      fetchImpl: vi.fn(async () => graphQlResponse(body)),
    });

    await expect(provider.listIssues({ first: 25 })).rejects.toMatchObject({
      code: "INTEGRATION_INVALID_RESPONSE",
    });
  });
});
