import { describe, expect, it } from "vitest";

import {
  coordinationSessionSummaryPayloadSchema,
  coordinationSessionSummarySchema,
} from "./coordination-session-summary.js";

const taskId = "11111111-1111-4111-8111-111111111111";
const sessionId = "22222222-2222-4222-8222-222222222222";

describe("coordinationSessionSummarySchema", () => {
  it("accepts queued summaries with a wrapped payload", () => {
    const parsed = coordinationSessionSummaryPayloadSchema.parse({
      summary: {
        taskId,
        sessionId,
        sessionState: "queued",
        phase: "queued",
        headline: "Waiting for Runner assignment",
        milestone: { key: "queued", label: "Queued", observedAt: "2026-05-17T00:00:00.000Z" },
        updatedAt: "2026-05-17T00:00:00.000Z",
      },
    });
    expect(parsed.summary.links).toEqual({});
  });

  it("accepts assigned and active summaries without terminal details", () => {
    const assigned = coordinationSessionSummarySchema.parse({
      taskId,
      sessionId,
      sessionState: "starting",
      phase: "assigned",
      headline: "Runner is preparing the Session",
      milestone: { key: "runner_assigned", label: "Runner assigned", observedAt: "2026-05-17T00:00:10.000Z" },
      startedAt: "2026-05-17T00:00:10.000Z",
      updatedAt: "2026-05-17T00:00:10.000Z",
    });
    const active = coordinationSessionSummarySchema.parse({
      taskId,
      sessionId,
      sessionState: "running",
      phase: "running",
      headline: "Agent execution is active",
      milestone: { key: "execution_running", label: "Execution active", observedAt: "2026-05-17T00:00:20.000Z" },
      startedAt: "2026-05-17T00:00:10.000Z",
      updatedAt: "2026-05-17T00:00:20.000Z",
      currentPhase: "agent",
      links: { branch: "mystra/task-2" },
    });
    expect(assigned.phase).toBe("assigned");
    expect(active.currentPhase).toBe("agent");
  });

  it("accepts review-ready and terminal summaries", () => {
    expect(coordinationSessionSummarySchema.parse({
      taskId,
      sessionId,
      sessionState: "running",
      phase: "review_ready",
      headline: "Review artifact is ready",
      milestone: { key: "review_created", label: "Review created", observedAt: "2026-05-17T00:01:00.000Z" },
      updatedAt: "2026-05-17T00:01:00.000Z",
      currentPhase: "delivery",
    }).phase).toBe("review_ready");

    const terminal = coordinationSessionSummarySchema.parse({
      taskId,
      sessionId,
      sessionState: "succeeded",
      phase: "terminal",
      headline: "Created the requested pull request",
      milestone: { key: "terminal", label: "Completed", observedAt: "2026-05-17T00:02:00.000Z" },
      finishedAt: "2026-05-17T00:02:00.000Z",
      updatedAt: "2026-05-17T00:02:00.000Z",
      terminal: { status: "succeeded", summary: "Created the requested pull request" },
    });
    expect(terminal.terminal?.status).toBe("succeeded");
  });

  it("rejects incompatible phase and terminal combinations", () => {
    expect(() => coordinationSessionSummarySchema.parse({
      taskId,
      sessionId,
      sessionState: "failed",
      phase: "running",
      headline: "This should not validate",
      milestone: { key: "execution_running", label: "Execution active", observedAt: "2026-05-17T00:03:00.000Z" },
      updatedAt: "2026-05-17T00:03:00.000Z",
    })).toThrow(/phase running is incompatible with sessionState failed/);
  });

  it("rejects internal event projections", () => {
    expect(() => coordinationSessionSummarySchema.parse({
      taskId,
      sessionId,
      sessionState: "queued",
      phase: "queued",
      headline: "Waiting for Runner assignment",
      milestone: { key: "queued", label: "Queued", observedAt: "2026-05-17T00:00:00.000Z" },
      sourceEventType: "session.queued",
      updatedAt: "2026-05-17T00:00:00.000Z",
    })).toThrow();
  });
});
