import { describe, expect, it, vi } from "vitest";

import { validateGitHubPat } from "./github-pat";

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}

describe("validateGitHubPat", () => {
  it("validates identity and visible repository capability without returning the token", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        id: 42,
        login: "arcadia",
        type: "User",
        avatar_url: "https://avatars.githubusercontent.com/u/42?v=4",
      }))
      .mockResolvedValueOnce(jsonResponse([{
        id: 101,
        full_name: "arcadia/mystra",
        permissions: { pull: true, push: true, admin: false },
      }]));

    const result = await validateGitHubPat("github_pat_super_secret", { fetchImpl });

    expect(result).toMatchObject({
      providerExternalId: expect.stringMatching(/^pat:[0-9a-f]{64}$/),
      account: { externalId: "42", login: "arcadia", type: "User" },
      repositorySelection: "token",
      permissions: { contents: "write", pull_requests: "unverified" },
      accessSummary: { repositoryCountAtLeast: 1, pullRequests: "unverified" },
    });
    expect(JSON.stringify(result)).not.toContain("github_pat_super_secret");
    expect(fetchImpl.mock.calls.map((call) => call[0])).toEqual([
      "https://api.github.com/user",
      "https://api.github.com/user/repos?per_page=100&affiliation=owner%2Ccollaborator%2Corganization_member",
    ]);
  });

  it("rejects a token that cannot reveal any repository", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ id: 42, login: "arcadia", type: "User" }))
      .mockResolvedValueOnce(jsonResponse([]));

    await expect(validateGitHubPat("github_pat_empty", { fetchImpl })).rejects.toMatchObject({
      code: "INTEGRATION_CREDENTIAL_INVALID",
    });
  });

  it.each([
    [401, "INTEGRATION_CREDENTIAL_INVALID"],
    [403, "INTEGRATION_CREDENTIAL_INVALID"],
    [429, "INTEGRATION_RATE_LIMITED"],
    [500, "INTEGRATION_UPSTREAM_ERROR"],
  ])("maps GitHub HTTP %s to %s without echoing the credential", async (status, code) => {
    const fetchImpl = vi.fn(async () => new Response("failed", {
      status,
      headers: status === 429 ? { "retry-after": "9" } : {},
    }));

    const error = await validateGitHubPat("github_pat_never_echo", { fetchImpl }).catch((value) => value);
    expect(error).toMatchObject({ code });
    expect(String(error)).not.toContain("github_pat_never_echo");
  });
});
