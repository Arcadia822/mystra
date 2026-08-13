import { describe, expect, it } from "vitest";

import { sessionEventKindSchema, sessionEventSchema } from "./events.js";

const sessionId = "550e8400-e29b-41d4-a716-446655440000";

describe("sessionEventSchema", () => {
  it("accepts an ordered typed event", () => {
    const parsed = sessionEventSchema.parse({
      eventId: "550e8400-e29b-41d4-a716-446655440001",
      sessionId,
      sourceId: "control-plane",
      sourceSequence: 1,
      globalSequence: 1,
      kind: "session.created",
      version: 1,
      payload: {
        runtimeId: "550e8400-e29b-41d4-a716-446655440002",
        providerKey: "codex",
        agentContext: {
          agentId: "550e8400-e29b-41d4-a716-446655440003",
          name: "Reviewer",
          revision: 1,
          systemPrompt: "Review evidence.",
        },
        taskId: "550e8400-e29b-41d4-a716-446655440004",
        projectId: null,
        context: {},
      },
      occurredAt: "2026-08-10T00:00:00.000Z",
      acceptedAt: "2026-08-10T00:00:00.000Z",
    });
    expect(parsed.kind).toBe("session.created");
  });

  it("rejects raw logs and obsolete lifecycle facts", () => {
    for (const kind of ["agent.log", "session.assigned", "session.waiting_for_review"]) {
      expect(() => sessionEventKindSchema.parse(kind)).toThrow();
    }
  });

  it("exports continuation, interruption, handoff and terminal events", () => {
    for (const kind of [
      "session.user_message_submitted", "session.response_completed", "session.interrupted",
      "session.resumed", "session.handoff_requested", "session.closed", "session.failed",
    ]) {
      expect(sessionEventKindSchema.parse(kind)).toBe(kind);
    }
  });
});
