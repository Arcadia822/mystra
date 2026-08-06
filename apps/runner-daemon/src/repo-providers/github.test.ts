import { EventEmitter } from "node:events";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { reviewRequestSchema } from "@mystra/shared";

import { githubRepoProvider as rawGitHubRepoProvider } from "./github.js";

const ephemeralCredential = {
  provider: "github" as const,
  username: "x-access-token" as const,
  secret: "top-secret",
  expiresAt: "2099-08-05T09:00:00.000Z",
};

const githubRepoProvider = {
  ...rawGitHubRepoProvider,
  pushBranch: (input: Parameters<typeof rawGitHubRepoProvider.pushBranch>[0]) => rawGitHubRepoProvider.pushBranch(input, ephemeralCredential),
  createReview: (input: Parameters<typeof rawGitHubRepoProvider.createReview>[0]) => rawGitHubRepoProvider.createReview(input, ephemeralCredential),
};

const spawnMock = vi.hoisted(() => vi.fn());

function repositoryTarget(projectId: string, cloneUrl = "https://github.com/acme/project.git") {
  return {
    projectId,
    repository: {
      integration: "github",
      provider: "github",
      externalId: "github-repo",
      fullName: "acme/project",
      url: cloneUrl.replace(/\.git$/, ""),
      cloneUrl,
      defaultBranch: "main",
      visibility: "private" as const,
      isArchived: false,
      fetchedAt: "2026-07-25T00:00:00.000Z",
    },
    defaultBaseBranch: "main",
  };
}

vi.mock("node:child_process", () => ({
  spawn: spawnMock,
}));

describe("github repo provider", () => {
  beforeEach(() => {
    spawnMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.MYSTRA_GITHUB_TOKEN;
  });

  function mockSpawnSequence(...steps: Array<{ code: number; stdout?: string; stderr?: string }>): void {
    spawnMock.mockImplementation(() => {
      const next = steps.shift() ?? { code: 0 };
      const child = new EventEmitter() as EventEmitter & {
        stdout: EventEmitter;
        stderr: EventEmitter;
      };
      child.stdout = new EventEmitter();
      child.stderr = new EventEmitter();
      queueMicrotask(() => {
        if (next.stdout) {
          child.stdout.emit("data", Buffer.from(next.stdout));
        }
        if (next.stderr) {
          child.stderr.emit("data", Buffer.from(next.stderr));
        }
        child.emit("exit", next.code);
      });
      return child;
    });
  }

  it("pushes GitHub branches through the provider and returns a GitHub branch URL", async () => {
    mockSpawnSequence(
      { code: 0 },
      { code: 0 },
      { code: 0, stdout: "def456\n" },
    );
    process.env.MYSTRA_GITHUB_TOKEN = "top-secret";

    const receipt = await githubRepoProvider.pushBranch({
      target: repositoryTarget("00000000-0000-4000-8000-000000000500"),
      branchName: "mystra/task-500",
      baseBranch: "main",
      commitMessage: "Mystra task 500",
      auth: {
        kind: "runtime-ref",
        provider: "github",
        reference: "github-app-installation",
        metadata: {},
      },
      metadata: {
        localRepoPath: "/tmp/mystra-github-repo",
      },
    });

    expect(receipt).toEqual({
      status: "pushed",
      branchName: "mystra/task-500",
      branchUrl: "https://github.com/acme/project/tree/mystra%2Ftask-500",
      commitSha: "def456",
    });
    expect(spawnMock.mock.calls.flatMap((call) => call[1] as string[]).join(" ")).not.toContain("top-secret");
    expect(spawnMock).toHaveBeenNthCalledWith(
      1,
      "git",
      ["remote", "set-url", "origin", "https://github.com/acme/project.git"],
      expect.any(Object),
    );
  });

  it("normalizes SSH-style enterprise remotes behind the provider boundary", async () => {
    mockSpawnSequence(
      { code: 0 },
      { code: 0 },
      { code: 0, stdout: "fedcba\n" },
    );
    process.env.MYSTRA_GITHUB_TOKEN = "top-secret";

    const receipt = await githubRepoProvider.pushBranch({
      target: repositoryTarget(
        "00000000-0000-4000-8000-000000000501",
        "https://github.enterprise.example/acme/project.git",
      ),
      branchName: "mystra/task-501",
      baseBranch: "main",
      commitMessage: "Mystra task 501",
      auth: {
        kind: "runtime-ref",
        provider: "github",
        reference: "github-app-installation",
        metadata: {},
      },
      metadata: {
        localRepoPath: "/tmp/mystra-github-enterprise-repo",
      },
    });

    expect(receipt).toEqual({
      status: "pushed",
      branchName: "mystra/task-501",
      branchUrl: "https://github.enterprise.example/acme/project/tree/mystra%2Ftask-501",
      commitSha: "fedcba",
    });
  });

  it("uses provider-owned API base overrides for GitHub Enterprise pull request creation", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        number: 16,
        html_url: "https://github.enterprise.example/acme/project/pull/16",
      }), { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    process.env.MYSTRA_GITHUB_TOKEN = "top-secret";

    const result = await githubRepoProvider.createReview({
      target: repositoryTarget(
        "00000000-0000-4000-8000-000000000510",
        "https://github.enterprise.example/acme/project.git",
      ),
      auth: {
        kind: "runtime-ref",
        provider: "github",
        reference: "github-app-installation",
        metadata: {},
      },
      branch: {
        status: "pushed",
        branchName: "mystra/task-510",
      },
      title: "Mystra task 510",
      body: "Implement the requested change",
      metadata: {
        githubHttpBaseUrl: "https://github.enterprise.example/custom/api/",
      },
    });

    expect(result).toEqual({
      status: "review_created",
      branch: {
        status: "pushed",
        branchName: "mystra/task-510",
      },
      review: {
        provider: "github",
        url: "https://github.enterprise.example/acme/project/pull/16",
        number: 16,
        displayId: "#16",
      },
      metadata: {
        githubHttpBaseUrl: "https://github.enterprise.example/custom/api/",
        repo: "acme/project",
        targetBranch: "main",
      },
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://github.enterprise.example/custom/api/repos/acme/project/pulls",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          title: "Mystra task 510",
          head: "mystra/task-510",
          base: "main",
          body: "Implement the requested change",
        }),
      }),
    );
  });

  it("rejects no-diff GitHub review requests before provider review creation begins", () => {
    expect(() =>
      reviewRequestSchema.parse({
        target: repositoryTarget("00000000-0000-4000-8000-000000000506"),
        auth: {
          kind: "runtime-ref",
          provider: "github",
          reference: "github-app-installation",
          metadata: {},
        },
        branch: {
          status: "no_diff",
          branchName: "mystra/task-506",
        },
        title: "Mystra task 506",
        body: "No diff means no review should be created",
        metadata: {},
      }),
    ).toThrow("Review creation requires a pushed branch receipt");
  });

  it("returns auth_invalid when the ephemeral installation credential is missing", async () => {
    const result = await rawGitHubRepoProvider.createReview({
      target: repositoryTarget("00000000-0000-4000-8000-000000000507"),
      auth: {
        kind: "runtime-ref",
        provider: "github",
        reference: "github-app-installation",
        metadata: {},
      },
      branch: {
        status: "pushed",
        branchName: "mystra/task-507",
      },
      title: "Mystra task 507",
      body: "Implement the requested change",
      metadata: {},
    });

    expect(result).toEqual({
      status: "auth_invalid",
      branch: {
        status: "pushed",
        branchName: "mystra/task-507",
      },
      errorCode: "auth_invalid",
      errorMessage: "GitHub review creation requires an ephemeral installation credential",
      metadata: {},
    });
  });

  it("returns push_failed when git push is rejected after auth is configured", async () => {
    mockSpawnSequence(
      { code: 0 },
      { code: 1 },
    );
    process.env.MYSTRA_GITHUB_TOKEN = "top-secret";

    const receipt = await githubRepoProvider.pushBranch({
      target: repositoryTarget("00000000-0000-4000-8000-000000000508"),
      branchName: "mystra/task-508",
      baseBranch: "main",
      commitMessage: "Mystra task 508",
      auth: {
        kind: "runtime-ref",
        provider: "github",
        reference: "github-app-installation",
        metadata: {},
      },
      metadata: {
        localRepoPath: "/tmp/mystra-github-repo",
      },
    });

    expect(receipt).toEqual({
      status: "failed",
      branchName: "mystra/task-508",
      errorCode: "push_failed",
      errorMessage: "git push -u origin mystra/task-508 exited with 1",
    });
  });

  it("returns review_failed_after_push when pull request creation fails after a pushed branch", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response("validation failed", { status: 422 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    process.env.MYSTRA_GITHUB_TOKEN = "top-secret";

    const result = await githubRepoProvider.createReview({
      target: repositoryTarget("00000000-0000-4000-8000-000000000509"),
      auth: {
        kind: "runtime-ref",
        provider: "github",
        reference: "github-app-installation",
        metadata: {},
      },
      branch: {
        status: "pushed",
        branchName: "mystra/task-509",
        branchUrl: "https://github.com/acme/project/tree/mystra/task-509",
      },
      title: "Mystra task 509",
      body: "Implement the requested change",
      metadata: {},
    });

    expect(result).toEqual({
      status: "review_failed_after_push",
      branch: {
        status: "pushed",
        branchName: "mystra/task-509",
        branchUrl: "https://github.com/acme/project/tree/mystra/task-509",
      },
      errorCode: "review_create_failed",
      errorMessage: "GitHub pull request create failed 422: validation failed",
      metadata: {},
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("reuses an existing open pull request after GitHub reports a duplicate", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response("already exists", { status: 422 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([{
        number: 19,
        html_url: "https://github.com/acme/project/pull/19",
      }]), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    process.env.MYSTRA_GITHUB_TOKEN = "top-secret";

    const result = await githubRepoProvider.createReview({
      target: repositoryTarget("00000000-0000-4000-8000-000000000519"),
      auth: {
        kind: "runtime-ref",
        provider: "github",
        reference: "github-app-installation",
        metadata: {},
      },
      branch: {
        status: "pushed",
        branchName: "mystra/task-519",
      },
      title: "Mystra task 519",
      body: "Implement the requested change",
      metadata: {},
    });

    expect(result).toEqual({
      status: "review_created",
      branch: {
        status: "pushed",
        branchName: "mystra/task-519",
      },
      review: {
        provider: "github",
        url: "https://github.com/acme/project/pull/19",
        number: 19,
        displayId: "#19",
      },
      metadata: {
        repo: "acme/project",
        targetBranch: "main",
        reused: true,
      },
    });
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://api.github.com/repos/acme/project/pulls?state=open&head=acme%3Amystra%2Ftask-519&base=main",
      expect.objectContaining({ headers: expect.any(Object) }),
    );
  });

  it.each([403, 500])(
    "fails closed and redacts GitHub HTTP %s response bodies",
    async (status) => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce(new Response("upstream echoed top-secret", { status }));
      vi.stubGlobal("fetch", fetchMock);
      process.env.MYSTRA_GITHUB_TOKEN = "top-secret";

      const result = await githubRepoProvider.createReview({
        target: repositoryTarget("00000000-0000-4000-8000-000000000520"),
        auth: {
          kind: "runtime-ref",
          provider: "github",
          reference: "github-app-installation",
          metadata: {},
        },
        branch: {
          status: "pushed",
          branchName: "mystra/task-520",
        },
        title: "Mystra task 520",
        body: "Implement the requested change",
        metadata: {},
      });

      expect(result).toEqual(expect.objectContaining({
        status: "review_failed_after_push",
        errorCode: "review_create_failed",
        errorMessage: expect.stringContaining("[REDACTED]"),
      }));
      expect(result.errorMessage).not.toContain("top-secret");
    },
  );

  it("creates normalized GitHub review handles from pull request responses", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        number: 12,
        html_url: "https://github.com/acme/project/pull/12",
      }), { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    process.env.MYSTRA_GITHUB_TOKEN = "top-secret";

    const result = await githubRepoProvider.createReview({
      target: repositoryTarget(
        "00000000-0000-4000-8000-000000000502",
        "https://github.com/acme/project/",
      ),
      auth: {
        kind: "runtime-ref",
        provider: "github",
        reference: "github-app-installation",
        metadata: {},
      },
      branch: {
        status: "pushed",
        branchName: "mystra/task-502",
      },
      title: "Mystra task 502",
      body: "Implement the requested change",
      metadata: {},
    });

    expect(result).toEqual({
      status: "review_created",
      branch: {
        status: "pushed",
        branchName: "mystra/task-502",
      },
      review: {
        provider: "github",
        url: "https://github.com/acme/project/pull/12",
        number: 12,
        displayId: "#12",
      },
      metadata: {
        repo: "acme/project",
        targetBranch: "main",
      },
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("composes GitHub pull request bodies with preview and quality-gate context", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        number: 13,
        html_url: "https://github.com/acme/project/pull/13",
      }), { status: 201 }))
      .mockResolvedValueOnce(new Response("", { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    process.env.MYSTRA_GITHUB_TOKEN = "top-secret";

    const result = await githubRepoProvider.createReview({
      target: repositoryTarget("00000000-0000-4000-8000-000000000503"),
      auth: {
        kind: "runtime-ref",
        provider: "github",
        reference: "github-app-installation",
        metadata: {},
      },
      branch: {
        status: "pushed",
        branchName: "mystra/task-503",
      },
      title: "Mystra task 503",
      body: "Implement the requested change",
      metadata: {
        frontendPreviewUrl: "http://127.0.0.1:41003",
        backendPreviewUrl: "http://127.0.0.1:42003",
        previewContainer: "mystra-preview-container",
        qualityGate: {
          status: "passed",
          sequence: ["test", "build"],
          logPath: "/mystra/workspace/quality-gate.log",
        },
      },
    });

    expect(result).toEqual({
      status: "review_created",
      branch: {
        status: "pushed",
        branchName: "mystra/task-503",
      },
      review: {
        provider: "github",
        url: "https://github.com/acme/project/pull/13",
        number: 13,
        displayId: "#13",
      },
      metadata: {
        frontendPreviewUrl: "http://127.0.0.1:41003",
        backendPreviewUrl: "http://127.0.0.1:42003",
        previewContainer: "mystra-preview-container",
        qualityGate: {
          status: "passed",
          sequence: ["test", "build"],
          logPath: "/mystra/workspace/quality-gate.log",
        },
        repo: "acme/project",
        targetBranch: "main",
        contextCommentStatus: "published",
      },
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://api.github.com/repos/acme/project/pulls",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          title: "Mystra task 503",
          head: "mystra/task-503",
          base: "main",
          body: "Implement the requested change\n\n---\n\nMystra preview:\n\n- Frontend: http://127.0.0.1:41003\n- Backend: http://127.0.0.1:42003\n- Container: mystra-preview-container\n- Quality gate: passed (`test -> build`)\n- Backend note: the backend port is reserved in the retained container. It may still require repository-specific DB/Redis environment before the backend process stays up.\n",
        }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://api.github.com/repos/acme/project/issues/13/comments",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          body: "Mystra retained preview status:\n\n- Frontend: http://127.0.0.1:41003\n- Backend: http://127.0.0.1:42003\n- Container: mystra-preview-container\n- Quality gate: passed (`test -> build`)\n\nThe task container is intentionally kept running for review. Backend may still require repository-specific DB/Redis environment before the process stays up.",
        }),
      }),
    );
  });

  it("keeps review_created when the optional GitHub preview comment fails", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        number: 15,
        html_url: "https://github.com/acme/project/pull/15",
      }), { status: 201 }))
      .mockResolvedValueOnce(new Response("comment failed", { status: 500 }));
    vi.stubGlobal("fetch", fetchMock);
    process.env.MYSTRA_GITHUB_TOKEN = "top-secret";

    const result = await githubRepoProvider.createReview({
      target: repositoryTarget("00000000-0000-4000-8000-000000000505"),
      auth: {
        kind: "runtime-ref",
        provider: "github",
        reference: "github-app-installation",
        metadata: {},
      },
      branch: {
        status: "pushed",
        branchName: "mystra/task-505",
      },
      title: "Mystra task 505",
      body: "Implement the requested change",
      metadata: {
        frontendPreviewUrl: "http://127.0.0.1:41005",
        backendPreviewUrl: "http://127.0.0.1:42005",
        previewContainer: "mystra-preview-container",
        qualityGate: {
          status: "passed",
          sequence: ["test", "build"],
          logPath: "/mystra/workspace/quality-gate.log",
        },
      },
    });

    expect(result).toEqual({
      status: "review_created",
      branch: {
        status: "pushed",
        branchName: "mystra/task-505",
      },
      review: {
        provider: "github",
        url: "https://github.com/acme/project/pull/15",
        number: 15,
        displayId: "#15",
      },
      metadata: {
        frontendPreviewUrl: "http://127.0.0.1:41005",
        backendPreviewUrl: "http://127.0.0.1:42005",
        previewContainer: "mystra-preview-container",
        qualityGate: {
          status: "passed",
          sequence: ["test", "build"],
          logPath: "/mystra/workspace/quality-gate.log",
        },
        repo: "acme/project",
        targetBranch: "main",
        contextCommentStatus: "failed",
      },
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenLastCalledWith(
      "https://api.github.com/repos/acme/project/issues/15/comments",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          body: "Mystra retained preview status:\n\n- Frontend: http://127.0.0.1:41005\n- Backend: http://127.0.0.1:42005\n- Container: mystra-preview-container\n- Quality gate: passed (`test -> build`)\n\nThe task container is intentionally kept running for review. Backend may still require repository-specific DB/Redis environment before the process stays up.",
        }),
      }),
    );
  });

  it("omits the GitHub preview section when preview metadata is absent", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        number: 14,
        html_url: "https://github.com/acme/project/pull/14",
      }), { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    process.env.MYSTRA_GITHUB_TOKEN = "top-secret";

    await githubRepoProvider.createReview({
      target: repositoryTarget("00000000-0000-4000-8000-000000000504"),
      auth: {
        kind: "runtime-ref",
        provider: "github",
        reference: "github-app-installation",
        metadata: {},
      },
      branch: {
        status: "pushed",
        branchName: "mystra/task-504",
      },
      title: "Mystra task 504",
      body: "Implement the requested change",
      metadata: {
        qualityGate: {
          status: "passed",
          sequence: ["test", "build"],
          logPath: "/mystra/workspace/quality-gate.log",
        },
      },
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.github.com/repos/acme/project/pulls",
      expect.objectContaining({
        body: JSON.stringify({
          title: "Mystra task 504",
          head: "mystra/task-504",
          base: "main",
          body: "Implement the requested change",
        }),
      }),
    );
  });
});
