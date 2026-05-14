import { describe, expect, it } from "vitest";

import {
  buildReviewCreatedEventData,
  buildWorkflowNodeReviewSuccessData,
  dockerResultFromReviewResult,
} from "./review-projections.js";

describe("review projections", () => {
  it("labels GitHub review results as pull requests while preserving MR compatibility fields", () => {
    const reviewResult = {
      status: "review_created" as const,
      branch: {
        status: "pushed" as const,
        branchName: "mystra/task-1200",
        branchUrl: "https://github.com/acme/project/tree/mystra/task-1200",
      },
      review: {
        provider: "github" as const,
        url: "https://github.com/acme/project/pull/12",
        number: 12,
        displayId: "#12",
      },
      metadata: {
        repo: "acme/project",
      },
    };

    expect(dockerResultFromReviewResult(reviewResult)).toEqual({
      status: "succeeded",
      summary: "Created GitHub PR #12",
      branch: "mystra/task-1200",
      mrUrl: "https://github.com/acme/project/pull/12",
      mrIid: 12,
      reviewResult,
      metadata: {
        repo: "acme/project",
      },
    });

    expect(buildWorkflowNodeReviewSuccessData({
      reviewResult,
    })).toEqual({
      reviewStatus: "review_created",
      reviewProvider: "github",
      reviewUrl: "https://github.com/acme/project/pull/12",
      reviewNumber: 12,
      reviewDisplayId: "#12",
      mrUrl: "https://github.com/acme/project/pull/12",
      mrIid: 12,
    });
  });

  it("falls back to legacy MR fields when normalized review data is absent", () => {
    expect(buildReviewCreatedEventData({
      mrUrl: "https://gitlab.example.com/group/project/-/merge_requests/9",
      mrIid: 9,
    })).toEqual({
      provider: "gitlab",
      reviewUrl: "https://gitlab.example.com/group/project/-/merge_requests/9",
      reviewNumber: 9,
      displayId: "!9",
    });
  });
});
