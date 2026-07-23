import { z } from "zod";

import { issueReferenceSchema } from "./issue.js";
import { reviewResultSchema } from "./repository.js";
import { sandboxOutcomeSchema } from "./sandbox.js";

export const runResultStatusSchema = z.enum([
  "succeeded",
  "failed",
  "canceled",
  "timed_out",
  "waiting_for_review",
]);
export type RunResultStatus = z.infer<typeof runResultStatusSchema>;

export const qualityPhaseResultSchema = z
  .object({
    status: z.enum(["passed", "failed"]),
    command: z.string().min(1),
    durationMs: z.number().int().nonnegative(),
  })
  .strict();
export type QualityPhaseResult = z.infer<typeof qualityPhaseResultSchema>;

export const qualityResultSchema = z
  .object({
    test: qualityPhaseResultSchema,
    build: qualityPhaseResultSchema.optional(),
    logPath: z.string().min(1).optional(),
  })
  .strict()
  .superRefine((quality, ctx) => {
    if (quality.test.status === "passed" && !quality.build) {
      ctx.addIssue({
        code: "custom",
        message: "A passed test phase must be followed by a build result",
        path: ["build"],
      });
    }
  });
export type QualityResult = z.infer<typeof qualityResultSchema>;

export const agentExecutionMetadataSchema = z
  .object({
    agent: z.literal("copilot"),
    cliVersion: z.string().min(1),
    mode: z.literal("autopilot"),
    maxAutopilotContinues: z.number().int().min(1).max(100),
    exitCode: z.number().int(),
    changedFiles: z.array(z.string().min(1)),
  })
  .strict();
export type AgentExecutionMetadata = z.infer<typeof agentExecutionMetadataSchema>;

export const previewHandoffSchema = z
  .object({
    url: z.string().url(),
    containerName: z.string().min(1),
    probeCount: z.number().int().min(2),
  })
  .strict();
export type PreviewHandoff = z.infer<typeof previewHandoffSchema>;

export const reviewHandoffSchema = z
  .object({
    issue: issueReferenceSchema,
    branch: z.string().min(1),
    commitSha: z.string().min(1),
    reviewResult: reviewResultSchema,
    quality: qualityResultSchema,
    preview: previewHandoffSchema,
    sandboxOutcome: sandboxOutcomeSchema,
    agentExecution: agentExecutionMetadataSchema,
  })
  .strict()
  .superRefine((handoff, ctx) => {
    if (handoff.quality.test.status !== "passed" || handoff.quality.build?.status !== "passed") {
      ctx.addIssue({
        code: "custom",
        message: "Review handoff requires passed test and build phases",
        path: ["quality"],
      });
    }
    if (handoff.reviewResult.status !== "review_created" || !handoff.reviewResult.review) {
      ctx.addIssue({
        code: "custom",
        message: "Review handoff requires a created or reused review handle",
        path: ["reviewResult"],
      });
    }
    if (
      handoff.sandboxOutcome.status !== "succeeded"
      || !handoff.sandboxOutcome.session.retained
      || handoff.sandboxOutcome.session.status !== "retained"
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Review handoff requires a retained successful sandbox",
        path: ["sandboxOutcome"],
      });
    }
  });
export type ReviewHandoff = z.infer<typeof reviewHandoffSchema>;

const runResultBaseSchema = z
  .object({
    status: runResultStatusSchema,
    summary: z.string().min(1),
    branch: z.string().min(1).optional(),
    mrUrl: z.string().url().optional(),
    mrIid: z.number().int().positive().optional(),
    reviewResult: reviewResultSchema.optional(),
    sandboxOutcome: sandboxOutcomeSchema.optional(),
    issue: issueReferenceSchema.optional(),
    commitSha: z.string().min(1).optional(),
    quality: qualityResultSchema.optional(),
    preview: previewHandoffSchema.optional(),
    agentExecution: agentExecutionMetadataSchema.optional(),
    errorCode: z.string().min(1).optional(),
    errorMessage: z.string().min(1).optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export const runResultSchema = runResultBaseSchema.superRefine((result, ctx) => {
  if (result.status !== "waiting_for_review") {
    return;
  }

  const parsed = reviewHandoffSchema.safeParse({
    issue: result.issue,
    branch: result.branch,
    commitSha: result.commitSha,
    reviewResult: result.reviewResult,
    quality: result.quality,
    preview: result.preview,
    sandboxOutcome: result.sandboxOutcome,
    agentExecution: result.agentExecution,
  });
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      ctx.addIssue({
        code: "custom",
        message: issue.message,
        path: issue.path,
      });
    }
  }
});
export type RunResult = z.infer<typeof runResultSchema>;
