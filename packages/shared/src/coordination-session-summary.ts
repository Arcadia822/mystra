import { z } from "zod";

import { sessionResultStatusSchema } from "./result.js";
import { sessionStateSchema, type SessionState } from "./state.js";

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
  "execution_started",
  "execution_running",
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
  status: sessionResultStatusSchema,
  summary: z.string().min(1),
  errorCode: z.string().min(1).optional(),
  errorMessage: z.string().min(1).optional(),
}).strict();
export type CoordinationTerminal = z.infer<typeof coordinationTerminalSchema>;

export const coordinationExecutionPhaseSchema = z.enum([
  "clone",
  "agent",
  "test",
  "build",
  "preview",
  "delivery",
]);
export type CoordinationExecutionPhase = z.infer<typeof coordinationExecutionPhaseSchema>;

const phaseAllowedSessionStates = {
  queued: ["queued", "dispatching"],
  assigned: ["assigned", "starting"],
  running: ["running"],
  review_ready: ["assigned", "starting", "running"],
  terminal: ["succeeded", "failed", "canceled", "timed_out", "waiting_for_review"],
} as const satisfies Record<CoordinationPhase, readonly SessionState[]>;

export const coordinationSessionSummarySchema = z.object({
  taskId: z.string().uuid(),
  sessionId: z.string().uuid(),
  projectSlug: z.string().min(1).optional(),
  sessionState: sessionStateSchema,
  phase: coordinationPhaseSchema,
  headline: z.string().min(1),
  milestone: coordinationMilestoneSchema,
  startedAt: z.string().datetime().optional(),
  finishedAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime(),
  currentPhase: coordinationExecutionPhaseSchema.optional(),
  terminal: coordinationTerminalSchema.optional(),
  links: coordinationLinksSchema.default({}),
}).strict().superRefine((summary, ctx) => {
  const allowedSessionStates = phaseAllowedSessionStates[summary.phase] as readonly SessionState[];

  if (!allowedSessionStates.includes(summary.sessionState)) {
    ctx.addIssue({
      code: "custom",
      message: `phase ${summary.phase} is incompatible with sessionState ${summary.sessionState}`,
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
    ctx.addIssue({ code: "custom", message: "terminal summaries must include terminal details", path: ["terminal"] });
  }
  if (summary.phase !== "terminal" && summary.terminal) {
    ctx.addIssue({ code: "custom", message: "non-terminal summaries must not include terminal details", path: ["terminal"] });
  }
  if (summary.finishedAt && summary.phase !== "terminal") {
    ctx.addIssue({ code: "custom", message: "finishedAt is only valid for terminal summaries", path: ["finishedAt"] });
  }
  if (summary.currentPhase && summary.phase !== "running" && summary.phase !== "review_ready") {
    ctx.addIssue({
      code: "custom",
      message: "currentPhase is only valid for running or review_ready summaries",
      path: ["currentPhase"],
    });
  }
});
export type CoordinationSessionSummary = z.infer<typeof coordinationSessionSummarySchema>;

export const coordinationSessionSummaryPayloadSchema = z.object({
  summary: coordinationSessionSummarySchema,
}).strict();
export type CoordinationSessionSummaryPayload = z.infer<typeof coordinationSessionSummaryPayloadSchema>;
