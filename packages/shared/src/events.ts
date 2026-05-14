import { z } from "zod";

export const runEventSeveritySchema = z.enum(["debug", "info", "warn", "error"]);
export type RunEventSeverity = z.infer<typeof runEventSeveritySchema>;

export const runEventTypeSchema = z.enum([
  "job.created",
  "workflow.start_requested",
  "workflow.start_failed",
  "workflow.started",
  "workflow.node.started",
  "workflow.node.succeeded",
  "workflow.node.failed",
  "run.queued",
  "runner.registered",
  "runner.heartbeat",
  "run.assigned",
  "container.starting",
  "container.started",
  "agent.started",
  "quality_gate.passed",
  "quality_gate.failed",
  "git.branch_created",
  "git.commit_created",
  "git.push_succeeded",
  "mr.created",
  "run.succeeded",
  "run.failed",
  "run.canceled",
  "run.timed_out",
  "run.needs_human_review",
  "artifact.created",
  "cancellation.requested",
  "cleanup.started",
  "run.cleanup_failed",
  "run.stale_marked",
]);
export type RunEventType = z.infer<typeof runEventTypeSchema>;

export const controlPlaneLifecycleHandoffEventTypes = [
  "job.created",
  "run.queued",
  "run.assigned",
] as const satisfies readonly RunEventType[];

export const terminalRunEventTypes = [
  "run.succeeded",
  "run.failed",
  "run.canceled",
  "run.timed_out",
  "run.needs_human_review",
] as const satisfies readonly RunEventType[];

export const runEventSchema = z
  .object({
    runId: z.string().uuid(),
    jobId: z.string().uuid(),
    timestamp: z.string().datetime(),
    type: runEventTypeSchema,
    severity: runEventSeveritySchema.default("info"),
    data: z.record(z.string(), z.unknown()).default({}),
  })
  .strict();
export type RunEvent = z.infer<typeof runEventSchema>;
