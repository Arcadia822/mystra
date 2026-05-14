import { z } from "zod";

export const repoProviderKindSchema = z.enum(["gitlab", "github"]);
export type RepoProviderKind = z.infer<typeof repoProviderKindSchema>;

export const repositoryTargetSchema = z
  .object({
    projectId: z.string().uuid(),
    repoUrl: z.string().min(1),
    hostKind: z.union([repoProviderKindSchema, z.literal("unknown")]).default("unknown"),
    defaultBaseBranch: z.string().min(1),
  })
  .strict();
export type RepositoryTarget = z.infer<typeof repositoryTargetSchema>;

export const repositoryAuthBindingSchema = z
  .object({
    kind: z.enum(["runner-env", "runtime-ref", "future-managed-ref"]),
    provider: repoProviderKindSchema,
    reference: z.string().min(1),
    metadata: z.record(z.string(), z.unknown()).default({}),
  })
  .strict();
export type RepositoryAuthBinding = z.infer<typeof repositoryAuthBindingSchema>;

export const branchDeliveryRequestSchema = z
  .object({
    target: repositoryTargetSchema,
    branchName: z.string().min(1),
    baseBranch: z.string().min(1),
    commitMessage: z.string().min(1),
    auth: repositoryAuthBindingSchema,
    metadata: z.record(z.string(), z.unknown()).default({}),
  })
  .strict();
export type BranchDeliveryRequest = z.infer<typeof branchDeliveryRequestSchema>;

export const branchDeliveryReceiptSchema = z
  .object({
    status: z.enum(["pushed", "no_diff", "failed"]),
    branchName: z.string().min(1),
    branchUrl: z.string().url().optional(),
    commitSha: z.string().min(1).optional(),
    errorCode: z.string().min(1).optional(),
    errorMessage: z.string().min(1).optional(),
  })
  .strict();
export type BranchDeliveryReceipt = z.infer<typeof branchDeliveryReceiptSchema>;

export const reviewHandleSchema = z
  .object({
    provider: repoProviderKindSchema,
    url: z.string().url(),
    number: z.number().int().positive(),
    displayId: z.string().min(1),
  })
  .strict();
export type ReviewHandle = z.infer<typeof reviewHandleSchema>;

export const reviewRequestSchema = z
  .object({
    target: repositoryTargetSchema,
    auth: repositoryAuthBindingSchema,
    branch: branchDeliveryReceiptSchema,
    title: z.string().min(1),
    body: z.string(),
    metadata: z.record(z.string(), z.unknown()).default({}),
  })
  .strict()
  .superRefine((request, ctx) => {
    if (request.branch.status !== "pushed") {
      ctx.addIssue({
        code: "custom",
        message: "Review creation requires a pushed branch receipt",
        path: ["branch", "status"],
      });
    }
  });
export type ReviewRequest = z.infer<typeof reviewRequestSchema>;

export const reviewResultSchema = z
  .object({
    status: z.enum([
      "review_created",
      "branch_pushed_no_review",
      "no_diff",
      "auth_invalid",
      "push_failed",
      "review_failed_after_push",
    ]),
    branch: branchDeliveryReceiptSchema,
    review: reviewHandleSchema.optional(),
    errorCode: z.string().min(1).optional(),
    errorMessage: z.string().min(1).optional(),
    metadata: z.record(z.string(), z.unknown()).default({}),
  })
  .strict()
  .superRefine((result, ctx) => {
    if (result.status === "review_created" && !result.review) {
      ctx.addIssue({
        code: "custom",
        message: "review_created results must include a review handle",
        path: ["review"],
      });
    }

    if (result.status === "no_diff" && result.branch.status !== "no_diff") {
      ctx.addIssue({
        code: "custom",
        message: "no_diff results must use a no_diff branch receipt",
        path: ["branch", "status"],
      });
    }

    if (
      (result.status === "branch_pushed_no_review" || result.status === "review_failed_after_push" || result.status === "review_created") &&
      result.branch.status !== "pushed"
    ) {
      ctx.addIssue({
        code: "custom",
        message: `${result.status} results must use a pushed branch receipt`,
        path: ["branch", "status"],
      });
    }
  });
export type ReviewResult = z.infer<typeof reviewResultSchema>;
