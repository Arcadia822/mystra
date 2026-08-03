import { z } from "zod";

import {
  agentNameSchema,
  mergeRequestSpecSchema,
  sessionRuntimeOverrideSchema,
} from "./schemas.js";

export * from "./issue-core.js";

const safeBranchNamePattern =
  /^(?!-)(?!.*\.\.)(?!.*\/\/)(?!.*@\{)(?!.*[~^:?*[\]\\\s])(?!.*\/$)(?!.*\.lock$)(?!.*\.$)[A-Za-z0-9._/-]+$/;

export const issueDispatchRequestSchema = z
  .object({
    projectId: z.string().uuid(),
    agent: agentNameSchema,
    branch: z.string().min(1).max(255).regex(safeBranchNamePattern),
    sessionObjective: z.string().min(1).optional(),
    mergeRequest: mergeRequestSpecSchema.optional(),
    runtime: sessionRuntimeOverrideSchema.optional(),
  })
  .strict();
export type IssueDispatchRequest = z.infer<typeof issueDispatchRequestSchema>;
