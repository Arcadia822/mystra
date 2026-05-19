import { z } from "zod";

import { runEventTypeSchema } from "./events.js";
import { runResultStatusSchema } from "./result.js";
import { runStateSchema, type RunState } from "./state.js";

export const coordinationPhaseSchema = z.enum([
  "queued",
  "assigned",
  "running",
  "review_ready",
  "terminal",
]);
export type CoordinationPhase = z.infer<typeof coordinationPhaseSchema>;

export const coordinationMilestoneKeySchema = z.enum([
  "queued",
  "runner_assigned",
  "workflow_started",
  "workflow_running",
  "review_created",
  "terminal",
]);
export type CoordinationMilestoneKey = z.infer<typeof coordinationMilestoneKeySchema>;

export const coordinationMilestoneSchema = z.object({
  key: coordinationMilestoneKeySchema,
  label: z.string().min(1),
  observedAt: z.string().datetime(),
}).strict();
export type CoordinationMilestone = z.infer<typeof coordinationMilestoneSchema>;

export const coordinationLinksSchema = z.object({
  branch: z.string().min(1).optional(),
  reviewUrl: z.string().url().optional(),
  reviewDisplayId: z.string().min(1).optional(),
  frontendPreviewUrl: z.string().url().optional(),
  backendPreviewUrl: z.string().url().optional(),
}).strict();
export type CoordinationLinks = z.infer<typeof coordinationLinksSchema>;

export const coordinationTerminalSchema = z.object({
  status: runResultStatusSchema,
  summary: z.string().min(1),
  errorCode: z.string().min(1).optional(),
  errorMessage: z.string().min(1).optional(),
}).strict();
export type CoordinationTerminal = z.infer<typeof coordinationTerminalSchema>;

export const summarySourceEventTypeSchema = z.union([
  runEventTypeSchema,
  z.literal("run.result"),
  z.literal("run.state"),
]);
export type SummarySourceEventType = z.infer<typeof summarySourceEventTypeSchema>;

const phaseAllowedRunStates = {
  queued: ["queued", "dispatching"],
  assigned: ["assigned", "starting"],
  running: ["running"],
  review_ready: ["assigned", "starting", "running"],
  terminal: ["succeeded", "failed", "canceled", "timed_out", "needs_human_review"],
} as const satisfies Record<CoordinationPhase, readonly RunState[]>;

export const coordinationRunSummarySchema = z.object({
  jobId: z.string().uuid(),
  runId: z.string().uuid(),
  attempt: z.number().int().positive(),
  taskId: z.string().min(1),
  projectSlug: z.string().min(1).optional(),
  runState: runStateSchema,
  phase: coordinationPhaseSchema,
  headline: z.string().min(1),
  milestone: coordinationMilestoneSchema,
  sourceEventType: summarySourceEventTypeSchema,
  startedAt: z.string().datetime().optional(),
  finishedAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime(),
  currentNodeId: z.string().min(1).optional(),
  terminal: coordinationTerminalSchema.optional(),
  links: coordinationLinksSchema.default({}),
}).strict().superRefine((summary, ctx) => {
  const allowedRunStates = phaseAllowedRunStates[summary.phase] as readonly RunState[];

  if (!allowedRunStates.includes(summary.runState)) {
    ctx.addIssue({
      code: "custom",
      message: `phase ${summary.phase} is incompatible with runState ${summary.runState}`,
      path: ["phase"],
    });
  }

  if (summary.phase === "review_ready" && summary.milestone.key !== "review_created") {
    ctx.addIssue({
      code: "custom",
      message: "review_ready summaries must use the review_created milestone",
      path: ["milestone", "key"],
    });
  }

  if (summary.phase === "terminal" && !summary.terminal) {
    ctx.addIssue({
      code: "custom",
      message: "terminal summaries must include terminal details",
      path: ["terminal"],
    });
  }

  if (summary.phase !== "terminal" && summary.terminal) {
    ctx.addIssue({
      code: "custom",
      message: "non-terminal summaries must not include terminal details",
      path: ["terminal"],
    });
  }

  if (summary.finishedAt && summary.phase !== "terminal") {
    ctx.addIssue({
      code: "custom",
      message: "finishedAt is only valid for terminal summaries",
      path: ["finishedAt"],
    });
  }

  if (summary.currentNodeId && summary.phase !== "running" && summary.phase !== "review_ready") {
    ctx.addIssue({
      code: "custom",
      message: "currentNodeId is only valid for running or review_ready summaries",
      path: ["currentNodeId"],
    });
  }
});
export type CoordinationRunSummary = z.infer<typeof coordinationRunSummarySchema>;

export const coordinationRunSummaryPayloadSchema = z.object({
  summary: coordinationRunSummarySchema,
}).strict();
export type CoordinationRunSummaryPayload = z.infer<typeof coordinationRunSummaryPayloadSchema>;
