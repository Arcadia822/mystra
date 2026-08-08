import { describe, expect, it, vi } from "vitest";

import { GitHubIntegrationProvider } from "./github";

const githubRepository = {
  id: 42,
  full_name: "arcadia/mystra-fixture",
  html_url: "https://github.com/arcadia/mystra-fixture",
  clone_url: "https://github.com/arcadia/mystra-fixture.git",
  default_branch: "main",
  visibility: "private",
  archived: false,
};

const githubIssue = {
  id: 101,
  number: 7,
  title: "Render the remote project",
  body: "Use the selected remote repository.",
  html_url: "https://github.com/arcadia/mystra-fixture/issues/7",
  state: "open",
  state_reason: null,
  assignee: { id: 3, login: "arcadia" },
  labels: [{ id: 9, name: "demo" }],
  created_at: "2026-07-25T01:00:00.000Z",
  updated_at: "2026-07-25T02:00:00.000Z",
};

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}

describe("GitHubIntegrationProvider repositories", () => {
  it("lists and gets normalized remote repositories with opaque pagination", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ repositories: [githubRepository] }, {
        headers: {
          link: '<https://api.github.com/installation/repositories?per_page=10&page=3>; rel="next"',
        },
      }))
      .mockResolvedValueOnce(jsonResponse(githubRepository));
    const provider = new GitHubIntegrationProvider({
      token: "github-test-token",
      fetchImpl,
    });

    const listed = await provider.listRepositories({ first: 10, after: "2" });
    const resolved = await provider.getRepository("arcadia/mystra-fixture");

    expect(listed.items[0]).toMatchObject({
      integration: "github",
      provider: "github",
      externalId: "42",
      fullName: "arcadia/mystra-fixture",
      defaultBranch: "main",
      visibility: "private",
      isArchived: false,
      fetchedAt: expect.any(String),
    });
    expect(listed.pageInfo).toEqual({ hasNextPage: true, endCursor: "3" });
    expect(resolved).toEqual(expect.objectContaining({
      fullName: "arcadia/mystra-fixture",
    }));
    expect(fetchImpl.mock.calls[0]?.[0]).toBe(
      "https://api.github.com/installation/repositories?per_page=10&page=2",
    );
    expect(fetchImpl.mock.calls[1]?.[0]).toBe(
      "https://api.github.com/repos/arcadia/mystra-fixture",
    );
  });

  it("returns undefined only for explicit repository 404", async () => {
    const provider = new GitHubIntegrationProvider({
      token: "github-test-token",
      fetchImpl: vi.fn(async () => new Response("missing", { status: 404 })),
    });

    await expect(provider.getRepository("arcadia/missing")).resolves.toBeUndefined();
  });

  it("lists PAT-visible repositories from the authenticated-user endpoint", async () => {
    const fetchImpl = vi.fn(async (_input: URL | RequestInfo) => jsonResponse([{
      ...githubRepository,
      permissions: { pull: true, push: true, admin: false },
    }]));
    const provider = new GitHubIntegrationProvider({
      token: "github_pat_exact",
      repositoryListingMode: "authenticated-user",
      fetchImpl,
    });

    const result = await provider.listRepositories({ first: 25 });

    expect(result.items[0]?.fullName).toBe("arcadia/mystra-fixture");
    expect(fetchImpl.mock.calls[0]?.[0]).toBe(
      "https://api.github.com/user/repos?per_page=25&page=1&affiliation=owner%2Ccollaborator%2Corganization_member",
    );
  });

  it.each([
    [401, "INTEGRATION_UNAUTHORIZED"],
    [403, "INTEGRATION_UNAUTHORIZED"],
    [429, "INTEGRATION_RATE_LIMITED"],
    [500, "INTEGRATION_UPSTREAM_ERROR"],
  ])("maps repository HTTP %s to %s", async (status, code) => {
    const provider = new GitHubIntegrationProvider({
      token: "github-test-token",
      fetchImpl: vi.fn(async () => new Response("failed", {
        status,
        headers: status === 429 ? { "retry-after": "11" } : {},
      })),
    });

    await expect(provider.listRepositories({ first: 25 })).rejects.toMatchObject({
      code,
      ...(status === 429 ? { retryAfterSeconds: 11 } : {}),
    });
  });

  it("fails closed for missing credentials, timeout, invalid JSON, and invalid shape", async () => {
    const fetchImpl = vi.fn();
    const missing = new GitHubIntegrationProvider({ token: undefined, fetchImpl });
    await expect(missing.listRepositories({ first: 25 })).rejects.toMatchObject({
      code: "INTEGRATION_NOT_CONFIGURED",
    });
    expect(fetchImpl).not.toHaveBeenCalled();

    const timeout = new GitHubIntegrationProvider({
      token: "token",
      fetchImpl: vi.fn(async () => {
        throw new DOMException("aborted", "AbortError");
      }),
    });
    await expect(timeout.listRepositories({ first: 25 })).rejects.toMatchObject({
      code: "INTEGRATION_TIMEOUT",
    });

    const invalidJson = new GitHubIntegrationProvider({
      token: "token",
      fetchImpl: vi.fn(async () => new Response("{", { status: 200 })),
    });
    await expect(invalidJson.listRepositories({ first: 25 })).rejects.toMatchObject({
      code: "INTEGRATION_INVALID_RESPONSE",
    });

    const invalidShape = new GitHubIntegrationProvider({
      token: "token",
      fetchImpl: vi.fn(async () => jsonResponse({ repositories: [{ ...githubRepository, clone_url: "/tmp/local" }] })),
    });
    await expect(invalidShape.listRepositories({ first: 25 })).rejects.toMatchObject({
      code: "INTEGRATION_INVALID_RESPONSE",
    });
  });
});

describe("GitHubIntegrationProvider issues", () => {
  it("lists repository-ID-scoped native Issue rows and excludes Pull Requests", async () => {
    const nativeIssue = {
      ...githubIssue,
      assignees: [{ id: 3, login: "arcadia", avatar_url: "https://avatars.githubusercontent.com/u/3" }],
      labels: [{ id: 9, name: "demo", color: "d73a4a" }],
      milestone: { id: 11, title: "v1" },
    };
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(jsonResponse(githubRepository))
      .mockResolvedValueOnce(jsonResponse([
        nativeIssue,
        { ...nativeIssue, id: 102, number: 8, pull_request: { url: "ignored" } },
      ]));
    const provider = new GitHubIntegrationProvider({ token: "github-test-token", fetchImpl });

    const result = await provider.listProjectIssues({
      repositoryExternalId: "42",
      first: 25,
      state: "open",
      label: "demo",
    });

    expect(result.provider).toBe("github");
    expect(result.items).toEqual([expect.objectContaining({
      number: 7,
      assignees: [expect.objectContaining({ login: "arcadia" })],
      labels: [expect.objectContaining({ color: "d73a4a" })],
      milestone: { id: "11", title: "v1" },
    })]);
    expect(fetchImpl.mock.calls[0]?.[0]).toBe("https://api.github.com/repositories/42");
    expect(String(fetchImpl.mock.calls[1]?.[0])).toContain("labels=demo");
  });

  it("requires repository scope and filters pull requests from issue lists", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse([
      githubIssue,
      { ...githubIssue, id: 102, number: 8, pull_request: { url: "ignored" } },
    ]));
    const provider = new GitHubIntegrationProvider({
      token: "github-test-token",
      fetchImpl,
    });
    const repository = (await provider.getRepository("arcadia/mystra-fixture")
      .catch(() => undefined)) ?? {
      integration: "github",
      provider: "github",
      externalId: "42",
      fullName: "arcadia/mystra-fixture",
      url: "https://github.com/arcadia/mystra-fixture",
      cloneUrl: "https://github.com/arcadia/mystra-fixture.git",
      defaultBranch: "main",
      visibility: "private" as const,
      isArchived: false,
      fetchedAt: "2026-07-25T00:00:00.000Z",
    };
    fetchImpl.mockClear();

    await expect(provider.listIssues({ first: 25 })).rejects.toMatchObject({
      code: "REPOSITORY_SCOPE_REQUIRED",
    });
    const result = await provider.listIssues({ first: 25, repository });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      reference: {
        integration: "github",
        provider: "github",
        externalId: "101",
        identifier: "7",
        url: githubIssue.html_url,
        repository: {
          integration: "github",
          provider: "github",
          externalId: "42",
          fullName: "arcadia/mystra-fixture",
          url: "https://github.com/arcadia/mystra-fixture",
        },
      },
      title: githubIssue.title,
      state: { id: "open", name: "Open", type: "open" },
      assignee: { id: "3", name: "arcadia" },
      labels: [{ id: "9", name: "demo" }],
    });
  });

  it("gets repository-scoped issues and treats PR/404 as absent", async () => {
    const repository = {
      integration: "github",
      provider: "github",
      externalId: "42",
      fullName: "arcadia/mystra-fixture",
      url: "https://github.com/arcadia/mystra-fixture",
      cloneUrl: "https://github.com/arcadia/mystra-fixture.git",
      defaultBranch: "main",
      visibility: "private" as const,
      isArchived: false,
      fetchedAt: "2026-07-25T00:00:00.000Z",
    };
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(githubIssue))
      .mockResolvedValueOnce(jsonResponse({ ...githubIssue, pull_request: { url: "ignored" } }))
      .mockResolvedValueOnce(new Response("missing", { status: 404 }));
    const provider = new GitHubIntegrationProvider({
      token: "github-test-token",
      fetchImpl,
    });

    await expect(provider.getIssue({ identifier: "7" })).rejects.toMatchObject({
      code: "REPOSITORY_SCOPE_REQUIRED",
    });
    await expect(provider.getIssue({ identifier: "7", repository }))
      .resolves.toMatchObject({ title: githubIssue.title });
    await expect(provider.getIssue({ identifier: "8", repository })).resolves.toBeUndefined();
    await expect(provider.getIssue({ identifier: "404", repository })).resolves.toBeUndefined();
  });
});
