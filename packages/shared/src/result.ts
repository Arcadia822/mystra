import { z } from "zod";

export const runResultStatusSchema = z.enum([
  "succeeded",
  "failed",
  "canceled",
  "timed_out",
  "needs_human_review",
]);
export type RunResultStatus = z.infer<typeof runResultStatusSchema>;

export const runResultSchema = z
  .object({
    status: runResultStatusSchema,
    summary: z.string().min(1),
    branch: z.string().min(1).optional(),
    mrUrl: z.string().url().optional(),
    mrIid: z.number().int().positive().optional(),
    errorCode: z.string().min(1).optional(),
    errorMessage: z.string().min(1).optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();
export type RunResult = z.infer<typeof runResultSchema>;
