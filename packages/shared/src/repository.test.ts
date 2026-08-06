import { describe, expect, it } from "vitest";

import {
  branchDeliveryReceiptSchema,
  repositoryListRequestSchema,
  repositoryListResponseSchema,
  repositorySelectorSchema,
  repositorySnapshotSchema,
  repositoryAuthBindingSchema,
  repositoryTargetSchema,
  reviewRequestSchema,
  reviewResultSchema,
} from "./repository.js";

describe("repository provider schemas", () => {
  const githubRepository = {
    integration: "github",
    provider: "github",
    externalId: "R_kgDOFixture",
    fullName: "Arcadia822/mystra-remote-e2e",
    url: "https://github.com/Arcadia822/mystra-remote-e2e",
    cloneUrl: "https://github.com/Arcadia822/mystra-remote-e2e.git",
    defaultBranch: "main",
    visibility: "private",
    isArchived: false,
    fetchedAt: "2026-07-26T00:00:00.000Z",
  };
  const gitlabRepository = {
    ...githubRepository,
    integration: "gitlab",
    provider: "gitlab",
    externalId: "101",
    fullName: "group/project",
    url: "https://gitlab.example.com/group/project",
    cloneUrl: "https://gitlab.example.com/group/project.git",
    visibility: "internal",
  } as const;

  it("accepts a provider selector and a resolved remote repository snapshot", () => {
    expect(repositorySelectorSchema.parse({
      integration: "github",
      connectionId: "00000000-0000-4000-8000-000000000039",
      identifier: "Arcadia822/mystra-remote-e2e",
    })).toEqual({
      integration: "github",
      connectionId: "00000000-0000-4000-8000-000000000039",
      identifier: "Arcadia822/mystra-remote-e2e",
    });
    expect(repositorySnapshotSchema.parse(githubRepository)).toEqual(githubRepository);
  });

  it("requires an explicit connection identity", () => {
    expect(() => repositorySelectorSchema.parse({
      integration: "github",
      identifier: "Arcadia822/mystra-remote-e2e",
    })).toThrow();
    expect(() => repositorySelectorSchema.parse({
      integration: "github",
      connectionId: "not-a-uuid",
      identifier: "Arcadia822/mystra-remote-e2e",
    })).toThrow();
  });

  it("rejects local, file, ssh, and provider-leaking repository snapshots", () => {
    for (const cloneUrl of [
      "local/mystra",
      "/Users/arcadia/Documents/mystra",
      "file:///tmp/mystra",
      "git@github.com:Arcadia822/mystra.git",
    ]) {
      expect(() => repositorySnapshotSchema.parse({
        ...githubRepository,
        cloneUrl,
      })).toThrow();
    }

    expect(() => repositorySnapshotSchema.parse({
      ...githubRepository,
      token: "must-not-leak",
    })).toThrow();
  });

  it("validates bounded repository pagination", () => {
    expect(repositoryListRequestSchema.parse({ first: 25 })).toEqual({ first: 25 });
    expect(() => repositoryListRequestSchema.parse({ first: 101 })).toThrow();
    expect(repositoryListResponseSchema.parse({
      items: [githubRepository],
      pageInfo: { hasNextPage: true, endCursor: "next-page" },
    }).items[0]?.provider).toBe("github");
  });

  it("accepts a GitLab review-created result with an opaque auth binding", () => {
    const target = repositoryTargetSchema.parse({
      projectId: "00000000-0000-4000-8000-000000000101",
      repository: gitlabRepository,
      defaultBaseBranch: "main",
    });

    const auth = repositoryAuthBindingSchema.parse({
      kind: "runner-env",
      provider: "gitlab",
      reference: "repo-auth/gitlab/default",
    });

    const parsed = reviewResultSchema.parse({
      status: "review_created",
      branch: {
        status: "pushed",
        branchName: "mystra/task-101",
        branchUrl: "https://gitlab.example.com/group/project/-/tree/mystra/task-101",
        commitSha: "abc123",
      },
      review: {
        provider: "gitlab",
        url: "https://gitlab.example.com/group/project/-/merge_requests/7",
        number: 7,
        displayId: "!7",
      },
      metadata: {
        target,
        auth,
      },
    });

    expect(parsed.review?.displayId).toBe("!7");
    expect(parsed.metadata.target).toEqual(target);
    expect(parsed.metadata.auth).toEqual(auth);
  });

  it("accepts a GitHub partial-success result when branch push succeeded but review creation failed", () => {
    const parsed = reviewResultSchema.parse({
      status: "review_failed_after_push",
      branch: {
        status: "pushed",
        branchName: "mystra/task-102",
        branchUrl: "https://github.com/acme/project/tree/mystra/task-102",
      },
      errorCode: "review_create_failed",
      errorMessage: "GitHub pull request creation returned 422",
    });

    expect(parsed.status).toBe("review_failed_after_push");
    expect(parsed.branch.status).toBe("pushed");
    expect(parsed.review).toBeUndefined();
  });

  it("accepts a GitHub review-created result with a normalized review handle", () => {
    const target = repositoryTargetSchema.parse({
      projectId: "00000000-0000-4000-8000-000000000106",
      repository: githubRepository,
      defaultBaseBranch: "main",
    });

    const auth = repositoryAuthBindingSchema.parse({
      kind: "runner-env",
      provider: "github",
      reference: "repo-auth/github/default",
    });

    const parsed = reviewResultSchema.parse({
      status: "review_created",
      branch: {
        status: "pushed",
        branchName: "mystra/task-106",
        branchUrl: "https://github.example.com/acme/project/tree/mystra/task-106",
        commitSha: "def456",
      },
      review: {
        provider: "github",
        url: "https://github.example.com/acme/project/pull/11",
        number: 11,
        displayId: "#11",
      },
      metadata: {
        target,
        auth,
      },
    });

    expect(parsed.review).toEqual({
      provider: "github",
      url: "https://github.example.com/acme/project/pull/11",
      number: 11,
      displayId: "#11",
    });
    expect(parsed.metadata.target).toEqual(target);
    expect(parsed.metadata.auth).toEqual(auth);
  });

  it("accepts an explicit no-diff outcome without a review handle", () => {
    const parsed = reviewResultSchema.parse({
      status: "no_diff",
      branch: {
        status: "no_diff",
        branchName: "mystra/task-103",
      },
    });

    expect(parsed.branch.status).toBe("no_diff");
    expect(parsed.metadata).toEqual({});
  });

  it("rejects review creation requests unless the branch was pushed", () => {
    const target = repositoryTargetSchema.parse({
      projectId: "00000000-0000-4000-8000-000000000104",
      repository: gitlabRepository,
      defaultBaseBranch: "main",
    });
    const auth = repositoryAuthBindingSchema.parse({
      kind: "runner-env",
      provider: "gitlab",
      reference: "MYSTRA_GITLAB_TOKEN",
    });

    expect(() =>
      reviewRequestSchema.parse({
        target,
        auth,
        branch: {
          status: "failed",
          branchName: "mystra/task-104",
          errorCode: "push_failed",
        },
        title: "Draft review",
        body: "This should not be created",
      }),
    ).toThrow("Review creation requires a pushed branch receipt");
  });

  it("rejects review-created results that omit the review handle", () => {
    const pushedBranch = branchDeliveryReceiptSchema.parse({
      status: "pushed",
      branchName: "mystra/task-105",
    });

    expect(() =>
      reviewResultSchema.parse({
        status: "review_created",
        branch: pushedBranch,
      }),
    ).toThrow("review_created results must include a review handle");
  });
});
