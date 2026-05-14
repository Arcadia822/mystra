import type { ReviewResult } from "@mystra/shared";

export interface ReviewProjectionInput {
  mrUrl?: string;
  mrIid?: number;
  reviewResult?: ReviewResult;
}

export interface ReviewCreatedEventData {
  [key: string]: unknown;
  provider: string;
  reviewUrl: string | undefined;
  reviewNumber: number | undefined;
  displayId: string | undefined;
}

export interface MergeRequestEventData {
  [key: string]: unknown;
  mrUrl: string | undefined;
  mrIid: number | undefined;
}

export interface ReviewWorkflowNodeSuccessData {
  [key: string]: unknown;
  reviewStatus: ReviewResult["status"] | undefined;
  reviewProvider: string;
  reviewUrl: string | undefined;
  reviewNumber: number | undefined;
  reviewDisplayId: string | undefined;
  mrUrl: string | undefined;
  mrIid: number | undefined;
}

export interface DockerReviewResultProjection {
  status: "succeeded" | "failed";
  summary: string;
  branch: string;
  mrUrl?: string;
  mrIid?: number;
  reviewResult: ReviewResult;
  metadata?: Record<string, unknown>;
  errorCode?: string;
  errorMessage?: string;
}

function reviewArtifactLabel(provider: string): string {
  switch (provider) {
    case "gitlab":
      return "GitLab MR";
    case "github":
      return "GitHub PR";
    default:
      return "review";
  }
}

export function buildReviewCreatedEventData(input: ReviewProjectionInput): ReviewCreatedEventData {
  const review = input.reviewResult?.review;
  return {
    provider: review?.provider ?? "gitlab",
    reviewUrl: review?.url ?? input.mrUrl,
    reviewNumber: review?.number ?? input.mrIid,
    displayId: review?.displayId ?? (input.mrIid ? `!${input.mrIid}` : undefined),
  };
}

export function buildMergeRequestEventData(input: ReviewProjectionInput): MergeRequestEventData {
  const review = input.reviewResult?.review;
  return {
    mrUrl: review?.url ?? input.mrUrl,
    mrIid: review?.number ?? input.mrIid,
  };
}

export function buildWorkflowNodeReviewSuccessData(input: ReviewProjectionInput): ReviewWorkflowNodeSuccessData {
  const reviewCreated = buildReviewCreatedEventData(input);
  const mrCreated = buildMergeRequestEventData(input);
  return {
    reviewStatus: input.reviewResult?.status,
    reviewProvider: reviewCreated.provider,
    reviewUrl: reviewCreated.reviewUrl,
    reviewNumber: reviewCreated.reviewNumber,
    reviewDisplayId: reviewCreated.displayId,
    mrUrl: mrCreated.mrUrl,
    mrIid: mrCreated.mrIid,
  };
}

export function dockerResultFromReviewResult(reviewResult: ReviewResult): DockerReviewResultProjection {
  if (reviewResult.status === "review_created" && reviewResult.review) {
    return {
      status: "succeeded",
      summary: `Created ${reviewArtifactLabel(reviewResult.review.provider)} ${reviewResult.review.displayId}`,
      branch: reviewResult.branch.branchName,
      mrUrl: reviewResult.review.url,
      mrIid: reviewResult.review.number,
      reviewResult,
      ...(Object.keys(reviewResult.metadata).length > 0 ? { metadata: reviewResult.metadata } : {}),
    };
  }

  return {
    status: "failed",
    summary: reviewResult.errorMessage ?? "Review creation failed",
    branch: reviewResult.branch.branchName,
    reviewResult,
    errorCode: reviewResult.errorCode ?? "review_create_failed",
    errorMessage: reviewResult.errorMessage ?? "Review creation failed",
    ...(Object.keys(reviewResult.metadata).length > 0 ? { metadata: reviewResult.metadata } : {}),
  };
}
