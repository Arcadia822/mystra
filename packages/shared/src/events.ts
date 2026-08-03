import { z } from "zod";

export const sessionEventSeveritySchema = z.enum(["debug", "info", "warn", "error"]);
export type SessionEventSeverity = z.infer<typeof sessionEventSeveritySchema>;

export const sessionEventTypeSchema = z.enum([
  "task.created",
  "session.queued",
  "runner.registered",
  "runner.heartbeat",
  "session.assigned",
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
  "session.succeeded",
  "session.failed",
  "session.canceled",
  "session.timed_out",
  "session.waiting_for_review",
  "artifact.created",
  "cancellation.requested",
  "cleanup.started",
  "session.cleanup_failed",
  "session.stale_marked",
]);
export type SessionEventType = z.infer<typeof sessionEventTypeSchema>;

export const controlPlaneSessionHandoffEventTypes = [
  "task.created",
  "session.queued",
  "session.assigned",
] as const satisfies readonly SessionEventType[];

export const terminalSessionEventTypes = [
  "session.succeeded",
  "session.failed",
  "session.canceled",
  "session.timed_out",
  "session.waiting_for_review",
] as const satisfies readonly SessionEventType[];

/**
 * Internal execution fact. This schema is shared with the authenticated Runner
 * protocol but is intentionally absent from management Task/Session responses.
 */
export const sessionEventSchema = z
  .object({
    sessionId: z.string().uuid(),
    taskId: z.string().uuid(),
    timestamp: z.string().datetime(),
    type: sessionEventTypeSchema,
    severity: sessionEventSeveritySchema.default("info"),
    data: z.record(z.string(), z.unknown()).default({}),
  })
  .strict();
export type SessionEvent = z.infer<typeof sessionEventSchema>;
