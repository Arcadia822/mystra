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
