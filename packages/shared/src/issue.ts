import { z } from "zod";

import {
  jobRuntimeOverrideSchema,
  mergeRequestSpecSchema,
} from "./schemas.js";

export * from "./issue-core.js";

const safeBranchNamePattern =
  /^(?!-)(?!.*\.\.)(?!.*\/\/)(?!.*@\{)(?!.*[~^:?*[\]\\\s])(?!.*\/$)(?!.*\.lock$)(?!.*\.$)[A-Za-z0-9._/-]+$/;

export const issueDispatchRequestSchema = z
  .object({
    projectId: z.string().uuid(),
    agent: z.literal("copilot"),
    branchName: z.string().min(1).max(255).regex(safeBranchNamePattern),
    mergeRequest: mergeRequestSpecSchema.optional(),
    runtime: jobRuntimeOverrideSchema.optional(),
  })
  .strict();
export type IssueDispatchRequest = z.infer<typeof issueDispatchRequestSchema>;
