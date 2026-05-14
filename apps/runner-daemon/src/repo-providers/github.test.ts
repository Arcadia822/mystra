import { EventEmitter } from "node:events";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { githubRepoProvider } from "./github.js";

const spawnMock = vi.hoisted(() => vi.fn());

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
      target: {
        projectId: "00000000-0000-4000-8000-000000000500",
        repoUrl: "https://github.com/acme/project.git",
        hostKind: "github",
        defaultBaseBranch: "main",
      },
      branchName: "mystra/task-500",
      baseBranch: "main",
      commitMessage: "Mystra task 500",
      auth: {
        kind: "runner-env",
        provider: "github",
        reference: "MYSTRA_GITHUB_TOKEN",
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
  });

  it("normalizes SSH-style enterprise remotes behind the provider boundary", async () => {
    mockSpawnSequence(
      { code: 0 },
      { code: 0 },
      { code: 0, stdout: "fedcba\n" },
    );
    process.env.MYSTRA_GITHUB_TOKEN = "top-secret";

    const receipt = await githubRepoProvider.pushBranch({
      target: {
        projectId: "00000000-0000-4000-8000-000000000501",
        repoUrl: "git@github.enterprise.example:acme/project.git",
        hostKind: "github",
        defaultBaseBranch: "main",
      },
      branchName: "mystra/task-501",
      baseBranch: "main",
      commitMessage: "Mystra task 501",
      auth: {
        kind: "runner-env",
        provider: "github",
        reference: "MYSTRA_GITHUB_TOKEN",
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

  it("creates normalized GitHub review handles from pull request responses", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        number: 12,
        html_url: "https://github.com/acme/project/pull/12",
      }), { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    process.env.MYSTRA_GITHUB_TOKEN = "top-secret";

    const result = await githubRepoProvider.createReview({
      target: {
        projectId: "00000000-0000-4000-8000-000000000502",
        repoUrl: "https://github.com/acme/project/",
        hostKind: "github",
        defaultBaseBranch: "main",
      },
      auth: {
        kind: "runner-env",
        provider: "github",
        reference: "MYSTRA_GITHUB_TOKEN",
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
});
