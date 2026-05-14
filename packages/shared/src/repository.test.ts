import { describe, expect, it } from "vitest";

import {
  branchDeliveryReceiptSchema,
  repositoryAuthBindingSchema,
  repositoryTargetSchema,
  reviewRequestSchema,
  reviewResultSchema,
} from "./repository.js";

describe("repository provider schemas", () => {
  it("accepts a GitLab review-created result with an opaque auth binding", () => {
    const target = repositoryTargetSchema.parse({
      projectId: "00000000-0000-4000-8000-000000000101",
      repoUrl: "https://gitlab.example.com/group/project.git",
      hostKind: "gitlab",
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
      repoUrl: "https://gitlab.example.com/group/project.git",
      hostKind: "gitlab",
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
