import { z } from "zod";

export const runEventSeveritySchema = z.enum(["debug", "info", "warn", "error"]);
export type RunEventSeverity = z.infer<typeof runEventSeveritySchema>;

export const runEventTypeSchema = z.enum([
  "job.created",
  "run.queued",
  "runner.registered",
  "runner.heartbeat",
  "run.assigned",
  "execution.started",
  "container.starting",
  "container.started",
  "repository.clone.started",
  "repository.clone.succeeded",
  "agent.started",
  "agent.succeeded",
  "agent.failed",
  "quality.test.started",
  "quality.test.passed",
  "quality.test.failed",
  "quality.build.started",
  "quality.build.passed",
  "quality.build.failed",
  "preview.started",
  "preview.ready",
  "preview.failed",
  "git.branch_created",
  "git.commit_created",
  "git.push_succeeded",
  "review.created",
  "review.reused",
  "run.succeeded",
  "run.failed",
  "run.canceled",
  "run.timed_out",
  "run.waiting_for_review",
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
  "run.waiting_for_review",
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
