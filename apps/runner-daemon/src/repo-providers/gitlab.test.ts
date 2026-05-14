import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildGitLabMergeRequestEventData,
  buildGitLabReviewCreatedEventData,
  gitlabRepoProvider,
} from "./gitlab.js";

const spawnMock = vi.hoisted(() => vi.fn());

vi.mock("node:child_process", () => ({
  spawn: spawnMock,
}));

describe("gitlab review projections", () => {
  beforeEach(() => {
    spawnMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.MYSTRA_GITLAB_TOKEN;
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

  it("prefers normalized review metadata when present", () => {
    const reviewCreated = buildGitLabReviewCreatedEventData({
      mrUrl: "https://gitlab.example.com/group/project/-/merge_requests/7",
      mrIid: 7,
      reviewResult: {
        status: "review_created",
        branch: {
          status: "pushed",
          branchName: "mystra/task-7",
        },
        review: {
          provider: "gitlab",
          url: "https://gitlab.example.com/group/project/-/merge_requests/8",
          number: 8,
          displayId: "!8",
        },
        metadata: {},
      },
    });

    expect(reviewCreated).toEqual({
      provider: "gitlab",
      reviewUrl: "https://gitlab.example.com/group/project/-/merge_requests/8",
      reviewNumber: 8,
      displayId: "!8",
    });

    expect(buildGitLabMergeRequestEventData({
      mrUrl: "https://gitlab.example.com/group/project/-/merge_requests/7",
      mrIid: 7,
      reviewResult: {
        status: "review_created",
        branch: { status: "pushed", branchName: "mystra/task-7" },
        review: {
          provider: "gitlab",
          url: "https://gitlab.example.com/group/project/-/merge_requests/8",
          number: 8,
          displayId: "!8",
        },
        metadata: {},
      },
    })).toEqual({
      mrUrl: "https://gitlab.example.com/group/project/-/merge_requests/8",
      mrIid: 8,
    });
  });

  it("falls back to legacy merge-request fields during the transition", () => {
    expect(buildGitLabReviewCreatedEventData({
      mrUrl: "https://gitlab.example.com/group/project/-/merge_requests/9",
      mrIid: 9,
    })).toEqual({
      provider: "gitlab",
      reviewUrl: "https://gitlab.example.com/group/project/-/merge_requests/9",
      reviewNumber: 9,
      displayId: "!9",
    });
  });

  it("preserves normalized GitHub review handles through the legacy GitLab helper names", () => {
    const reviewResult = {
      status: "review_created" as const,
      branch: {
        status: "pushed" as const,
        branchName: "mystra/task-17",
      },
      review: {
        provider: "github" as const,
        url: "https://github.com/acme/project/pull/17",
        number: 17,
        displayId: "#17",
      },
      metadata: {},
    };

    expect(buildGitLabReviewCreatedEventData({
      mrUrl: "https://gitlab.example.com/group/project/-/merge_requests/17",
      mrIid: 17,
      reviewResult,
    })).toEqual({
      provider: "github",
      reviewUrl: "https://github.com/acme/project/pull/17",
      reviewNumber: 17,
      displayId: "#17",
    });

    expect(buildGitLabMergeRequestEventData({
      mrUrl: "https://gitlab.example.com/group/project/-/merge_requests/17",
      mrIid: 17,
      reviewResult,
    })).toEqual({
      mrUrl: "https://github.com/acme/project/pull/17",
      mrIid: 17,
    });
  });

  it("pushes GitLab branches through the provider using runner-env auth", async () => {
    mockSpawnSequence(
      { code: 0 },
      { code: 0 },
      { code: 0, stdout: "abc123\n" },
    );
    process.env.MYSTRA_GITLAB_TOKEN = "top-secret";

    const receipt = await gitlabRepoProvider.pushBranch({
      target: {
        projectId: "00000000-0000-4000-8000-000000000400",
        repoUrl: "https://gitlab.example.com/group/project.git",
        hostKind: "gitlab",
        defaultBaseBranch: "main",
      },
      branchName: "mystra/task-400",
      baseBranch: "main",
      commitMessage: "Mystra task 400",
      auth: {
        kind: "runner-env",
        provider: "gitlab",
        reference: "MYSTRA_GITLAB_TOKEN",
        metadata: {},
      },
      metadata: {
        localRepoPath: "/tmp/mystra-repo",
      },
    });

    expect(receipt).toEqual({
      status: "pushed",
      branchName: "mystra/task-400",
      branchUrl: "https://gitlab.example.com/group/project/-/tree/mystra%2Ftask-400",
      commitSha: "abc123",
    });
  });

  it("returns push_failed when local repo metadata is missing", async () => {
    process.env.MYSTRA_GITLAB_TOKEN = "top-secret";

    const receipt = await gitlabRepoProvider.pushBranch({
      target: {
        projectId: "00000000-0000-4000-8000-000000000403",
        repoUrl: "https://gitlab.example.com/group/project.git",
        hostKind: "gitlab",
        defaultBaseBranch: "main",
      },
      branchName: "mystra/task-403",
      baseBranch: "main",
      commitMessage: "Mystra task 403",
      auth: {
        kind: "runner-env",
        provider: "gitlab",
        reference: "MYSTRA_GITLAB_TOKEN",
        metadata: {},
      },
      metadata: {},
    });

    expect(receipt).toEqual({
      status: "failed",
      branchName: "mystra/task-403",
      errorCode: "push_failed",
      errorMessage: "GitLab branch delivery requires localRepoPath metadata",
    });
  });

  it("creates GitLab reviews through the provider using runner-env auth and preview metadata", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        iid: 11,
        web_url: "https://gitlab.example.com/group/project/-/merge_requests/11",
      }), { status: 201 }))
      .mockResolvedValueOnce(new Response("", { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    process.env.MYSTRA_GITLAB_TOKEN = "top-secret";

    const result = await gitlabRepoProvider.createReview({
      target: {
        projectId: "00000000-0000-4000-8000-000000000401",
        repoUrl: "https://gitlab.example.com/group/project.git",
        hostKind: "gitlab",
        defaultBaseBranch: "main",
      },
      auth: {
        kind: "runner-env",
        provider: "gitlab",
        reference: "MYSTRA_GITLAB_TOKEN",
        metadata: {},
      },
      branch: {
        status: "pushed",
        branchName: "mystra/task-401",
      },
      title: "Mystra task 401",
      body: "Implement the requested change",
      metadata: {
        frontendPreviewUrl: "http://127.0.0.1:41000",
        backendPreviewUrl: "http://127.0.0.1:42000",
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
        branchName: "mystra/task-401",
      },
      review: {
        provider: "gitlab",
        url: "https://gitlab.example.com/group/project/-/merge_requests/11",
        number: 11,
        displayId: "!11",
      },
      metadata: {
        frontendPreviewUrl: "http://127.0.0.1:41000",
        backendPreviewUrl: "http://127.0.0.1:42000",
        previewContainer: "mystra-preview-container",
        qualityGate: {
          status: "passed",
          sequence: ["test", "build"],
          logPath: "/mystra/workspace/quality-gate.log",
        },
        repo: "group/project",
        targetBranch: "main",
      },
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("returns auth_invalid when the configured GitLab runner-env token is missing", async () => {
    const result = await gitlabRepoProvider.createReview({
      target: {
        projectId: "00000000-0000-4000-8000-000000000402",
        repoUrl: "https://gitlab.example.com/group/project.git",
        hostKind: "gitlab",
        defaultBaseBranch: "main",
      },
      auth: {
        kind: "runner-env",
        provider: "gitlab",
        reference: "MYSTRA_GITLAB_TOKEN",
        metadata: {},
      },
      branch: {
        status: "pushed",
        branchName: "mystra/task-402",
      },
      title: "Mystra task 402",
      body: "Implement the requested change",
      metadata: {},
    });

    expect(result).toEqual({
      status: "auth_invalid",
      branch: {
        status: "pushed",
        branchName: "mystra/task-402",
      },
      errorCode: "auth_invalid",
      errorMessage: "Missing GitLab auth token in MYSTRA_GITLAB_TOKEN",
      metadata: {},
    });
  });
});
