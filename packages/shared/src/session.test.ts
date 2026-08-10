import { describe, expect, it } from "vitest";

import {
  applySessionEventProjection,
  sessionEventBatchSchema,
  sessionEventInputSchema,
  sessionEventWindowQuerySchema,
  sessionLaunchRequestSchema,
  sessionSchema,
  sessionStateSchema,
  taskSessionLaunchInputSchema,
  taskSessionListQuerySchema,
  type Session,
} from "./session.js";

const sessionId = "00000000-0000-4000-8000-000000000049";
const messageId = "00000000-0000-4000-8000-000000000050";

function baseSession() {
  return sessionSchema.parse({
    id: sessionId,
    teamId: "00000000-0000-4000-8000-000000000001",
    taskId: "00000000-0000-4000-8000-000000000002",
    projectId: null,
    runtimeId: "00000000-0000-4000-8000-000000000003",
    providerKey: "codex",
    agentId: "00000000-0000-4000-8000-000000000004",
    agentRevision: 1,
    state: "queued",
    activeMessageId: messageId,
    lastMessageId: null,
    interruptKind: null,
    continuationMode: null,
    failureCode: null,
    metadata: {},
    createdAt: "2026-08-10T00:00:00.000Z",
    updatedAt: "2026-08-10T00:00:00.000Z",
  });
}

function event(kind: string, payload: Record<string, unknown> = {}) {
  return sessionEventInputSchema.parse({
    eventId: crypto.randomUUID(),
    sessionId,
    sourceId: "runner:test",
    sourceSequence: 1,
    kind,
    version: 1,
    messageId,
    payload,
    metadata: {},
    occurredAt: "2026-08-10T00:00:01.000Z",
  });
}

describe("canonical Session contract", () => {
  it("uses ready as a stable state and only closed/failed as terminal states", () => {
    expect(sessionStateSchema.options).toEqual([
      "queued", "dispatched", "message_pending", "running", "ready",
      "interrupted", "waiting_for_handoff", "closed", "failed",
    ]);
  });

  it("requires Task-bound launch and rejects Turn/capacity fields", () => {
    const parsed = sessionLaunchRequestSchema.parse({
      sessionId,
      runtimeId: "00000000-0000-4000-8000-000000000003",
      providerKey: "codex",
      agentId: "00000000-0000-4000-8000-000000000004",
      context: { taskId: "00000000-0000-4000-8000-000000000002" },
      firstUserMessage: {
        messageId,
        content: [{ type: "text", text: "Implement feature 049" }],
      },
      metadata: {},
    });
    expect(parsed.context.taskId).toBeTruthy();
    expect(() => sessionLaunchRequestSchema.parse({ ...parsed, turnId: crypto.randomUUID() })).toThrow();
    expect(() => sessionLaunchRequestSchema.parse({ ...parsed, availableSlots: 1 })).toThrow();
    expect(() => sessionLaunchRequestSchema.parse({ ...parsed, context: {} })).toThrow();
  });

  it("validates bounded Task Session launch and list inputs", () => {
    expect(taskSessionListQuerySchema.parse({ limit: "50" })).toEqual({ limit: 50 });
    expect(() => taskSessionListQuerySchema.parse({ limit: 51 })).toThrow();
    expect(taskSessionLaunchInputSchema.parse({
      sessionId,
      providerKey: "codex",
      agentId: "00000000-0000-4000-8000-000000000004",
      manualContext: { text: "  Inspect the failing test.  " },
    }).manualContext?.text).toBe("Inspect the failing test.");
    expect(() => taskSessionLaunchInputSchema.parse({
      sessionId,
      providerKey: "codex",
      agentId: "00000000-0000-4000-8000-000000000004",
      manualContext: { text: "   " },
    })).toThrow();
  });

  it("allows exactly one bounded human event window mode", () => {
    expect(sessionEventWindowQuerySchema.parse({})).toEqual({ limit: 100, latest: 100 });
    expect(sessionEventWindowQuerySchema.parse({ latest: "20" })).toEqual({ latest: 20, limit: 100 });
    expect(sessionEventWindowQuerySchema.parse({ afterSequence: "0", limit: "50" }))
      .toEqual({ afterSequence: 0, limit: 50 });
    expect(() => sessionEventWindowQuerySchema.parse({ latest: 20, beforeSequence: 10 })).toThrow();
    expect(() => sessionEventWindowQuerySchema.parse({ limit: 201 })).toThrow();
  });

  it("validates payloads by event kind and rejects secret-shaped or oversized values", () => {
    expect(event("session.response_started", {}).kind).toBe("session.response_started");
    expect(() => event("session.response_started", { unexpected: true })).toThrow();
    expect(() => event("session.agent_message_chunk", { text: "x".repeat(16_385) })).toThrow();
    expect(() => sessionEventInputSchema.parse({
      ...event("session.agent_message_chunk", { text: "ok" }),
      metadata: { accessToken: "secret" },
    })).toThrow();
  });

  it("caps event batches by count and serialized size", () => {
    const item = event("session.agent_message_chunk", { text: "ok" });
    expect(sessionEventBatchSchema.parse({ leaseToken: "a".repeat(32), events: [item] }).events).toHaveLength(1);
    expect(() => sessionEventBatchSchema.parse({
      leaseToken: "a".repeat(32),
      events: Array.from({ length: 101 }, () => item),
    })).toThrow();
  });

  it("projects queued through ready without making ready terminal", () => {
    let session = baseSession();
    session = applySessionEventProjection(session, event("session.runtime_dispatched", {
      leaseId: crypto.randomUUID(),
      runtimeId: session.runtimeId,
    }));
    expect(session.state).toBe("dispatched");
    session = applySessionEventProjection(session, event("session.provider_started", {
      providerSessionId: "provider-session-1",
    }));
    expect(session.state).toBe("message_pending");
    session = applySessionEventProjection(session, event("session.response_started"));
    expect(session.state).toBe("running");
    session = applySessionEventProjection(session, event("session.response_completed", {
      stopReason: "end_turn",
    }));
    expect(session).toMatchObject({
      state: "ready",
      activeMessageId: null,
      lastMessageId: messageId,
    });
  });

  it("fails closed on invalid transitions", () => {
    expect(() => applySessionEventProjection(
      { ...baseSession(), state: "ready", activeMessageId: null },
      event("session.response_started"),
    )).toThrow("Invalid Session state transition");
    expect(() => applySessionEventProjection(
      { ...baseSession(), state: "ready", activeMessageId: null },
      event("session.tool_call", { toolCallId: "tool-1", name: "shell", input: {} }),
    )).toThrow("Invalid Session state transition");
  });

  it("preserves interruption continuation and handoff semantics", () => {
    let session: Session = { ...baseSession(), state: "running" };
    session = applySessionEventProjection(session, event("session.interrupted", {
      kind: "input_required", continuationMode: "resume_message", reason: "Need input",
    }));
    expect(session).toMatchObject({ state: "interrupted", continuationMode: "resume_message" });
    session = applySessionEventProjection(session, event("session.resumed", { continuationMode: "resume_message" }));
    session = applySessionEventProjection(session, event("session.handoff_requested", { reason: "Review" }));
    expect(session.state).toBe("waiting_for_handoff");
    session = applySessionEventProjection(session, event("session.handoff_completed", { reason: "Accepted" }));
    expect(session).toMatchObject({ state: "ready", activeMessageId: null, lastMessageId: messageId });
  });

  it("allows explicit close from a nonterminal state and rejects mutation afterwards", () => {
    const closed = applySessionEventProjection(baseSession(), event("session.closed", { reason: "Operator closed" }));
    expect(closed.state).toBe("closed");
    expect(() => applySessionEventProjection(closed, event("session.failed", { code: "late", message: "Late" }))).toThrow();
  });
});
