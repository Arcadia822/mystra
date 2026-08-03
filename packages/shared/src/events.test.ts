import { describe, expect, it } from "vitest";

import {
  controlPlaneSessionHandoffEventTypes,
  sessionEventSchema,
  sessionEventTypeSchema,
  terminalSessionEventTypes,
} from "./events.js";

const sessionId = "550e8400-e29b-41d4-a716-446655440000";
const taskId = "550e8400-e29b-41d4-a716-446655440001";

describe("sessionEventSchema", () => {
  it("accepts a structured internal fact without raw log offsets", () => {
    const parsed = sessionEventSchema.parse({
      sessionId,
      taskId,
      timestamp: "2026-04-30T00:00:00.000Z",
      type: "container.started",
      severity: "info",
      data: { containerId: "abc123" },
    });

    expect(parsed.type).toBe("container.started");
    expect(parsed.data).toEqual({ containerId: "abc123" });
  });

  it("rejects raw agent logs and workflow facts", () => {
    for (const type of ["agent.log", "workflow.node.failed"]) {
      expect(() => sessionEventSchema.parse({
        sessionId,
        taskId,
        timestamp: "2026-04-30T00:00:00.000Z",
        type,
        severity: "error",
        data: {},
      })).toThrow();
    }
  });

  it("accepts execution, quality, preview and review facts", () => {
    for (const type of [
      "execution.started",
      "repository.clone.started",
      "repository.clone.succeeded",
      "agent.succeeded",
      "quality.test.failed",
      "quality.build.passed",
      "preview.ready",
      "review.reused",
      "session.waiting_for_review",
    ] as const) {
      expect(sessionEventTypeSchema.parse(type)).toBe(type);
    }
  });

  it("exports Session-only handoff and terminal vocabularies", () => {
    expect(controlPlaneSessionHandoffEventTypes).toEqual([
      "task.created",
      "session.queued",
      "session.assigned",
    ]);
    expect(terminalSessionEventTypes).toEqual([
      "session.succeeded",
      "session.failed",
      "session.canceled",
      "session.timed_out",
      "session.waiting_for_review",
    ]);
  });

  it("rejects the superseded lifecycle vocabulary", () => {
    // legacy-term-audit: allow -- negative compatibility assertions only.
    for (const type of ["job.created", "run.queued", "run.succeeded"]) {
      expect(() => sessionEventTypeSchema.parse(type)).toThrow();
    }
  });
});
