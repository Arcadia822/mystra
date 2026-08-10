import { afterEach, describe, expect, it } from "vitest";

import {
  sessionClaimAssignmentSchema,
  type SessionClaimAssignment,
  type SessionEventInput,
} from "@mystra/shared";

import { createSessionE2eFixture } from "../../../test/session-e2e-support";
import { RuntimeSessionService } from "./runtime-session-service";

let fixture: Awaited<ReturnType<typeof createSessionE2eFixture>> | undefined;

afterEach(async () => {
  await fixture?.close();
  fixture = undefined;
});

describe("Session lifecycle SQLite/HTTP E2E", () => {
  it("resumes the active message without creating a synthetic Turn or second user message", async () => {
    fixture = await createSessionE2eFixture();
    const { sessionId, messageId } = await launch();
    const assignment = await claim();
    await append(assignment, eventStream(assignment, [
      ["session.provider_started", { providerSessionId: "provider-resume-1" }],
      ["session.response_started", {}],
      ["session.interrupted", {
        kind: "approval_required",
        continuationMode: "resume_message",
        reason: "Approval required",
      }],
      ["session.resumed", { continuationMode: "resume_message" }],
      ["session.response_completed", { stopReason: "end_turn" }],
    ]));

    await expect(fixture.sessions.get({ actor: fixture.actor, sessionId })).resolves.toMatchObject({
      state: "ready",
      activeMessageId: null,
      lastMessageId: messageId,
    });
    const history = await fixture.sessions.listEvents({ actor: fixture.actor, sessionId, limit: 100 });
    expect(history.events.filter(({ kind }) => kind === "session.user_message_submitted")).toHaveLength(1);
    expect(history.events.filter(({ kind }) => kind === "session.resumed")).toHaveLength(1);
    expect(JSON.stringify(history)).not.toMatch(/turnId|SessionTurn/iu);
  });

  it("supports interruption, new-message continuation, handoff, duplicate report, and close", async () => {
    fixture = await createSessionE2eFixture();
    const { sessionId, messageId } = await launch();
    const first = await claim();
    const firstEvents = eventStream(first, [
      ["session.provider_started", { providerSessionId: "provider-lifecycle-1" }],
      ["session.response_started", {}],
      ["session.interrupted", {
        kind: "input_required",
        continuationMode: "new_message",
        reason: "Need a clarified instruction",
      }],
    ]);
    await append(first, firstEvents);
    await expect(fixture.sessions.get({ actor: fixture.actor, sessionId })).resolves.toMatchObject({
      state: "interrupted",
      activeMessageId: messageId,
      continuationMode: "new_message",
    });

    const continuationMessageId = crypto.randomUUID();
    await fixture.sessions.sendMessage({
      actor: fixture.actor,
      sessionId,
      request: {
        messageId: continuationMessageId,
        content: [{ type: "text", text: "Use the clarified instruction" }],
      },
    });
    const continuation = await claim();
    expect(continuation).toMatchObject({
      message: { messageId: continuationMessageId },
      lease: { providerSessionId: "provider-lifecycle-1" },
    });
    const handoffEvents = eventStream(continuation, [
      ["session.response_started", {}],
      ["session.handoff_requested", { reason: "Human review" }],
      ["session.handoff_accepted", { reason: "Operator accepted" }],
      ["session.handoff_completed", { reason: "Operator completed" }],
    ]);
    await append(continuation, handoffEvents);
    const beforeReplay = await fixture.sessions.listEvents({ actor: fixture.actor, sessionId, limit: 100 });
    await append(continuation, handoffEvents);
    const afterReplay = await fixture.sessions.listEvents({ actor: fixture.actor, sessionId, limit: 100 });
    expect(afterReplay.events).toHaveLength(beforeReplay.events.length);
    expect(afterReplay.events.filter(({ kind }) => kind === "session.runtime_dispatched")).toHaveLength(2);
    await expect(fixture.sessions.get({ actor: fixture.actor, sessionId })).resolves.toMatchObject({
      state: "ready",
      activeMessageId: null,
      lastMessageId: continuationMessageId,
    });

    const closed = await fixture.sessions.close({ actor: fixture.actor, sessionId, reason: "E2E complete" });
    expect(closed.state).toBe("closed");
    await expect(fixture.sessions.close({ actor: fixture.actor, sessionId })).resolves.toEqual(closed);
  });

  it("fails an active Session after an expired lease and offline Runtime without migration", async () => {
    fixture = await createSessionE2eFixture();
    const { sessionId } = await launch();
    const assignment = await claim();
    await append(assignment, eventStream(assignment, [
      ["session.provider_started", { providerSessionId: "provider-lost-1" }],
      ["session.response_started", {}],
    ]));
    const reaper = new RuntimeSessionService({
      db: fixture.db,
      now: () => new Date("2026-08-10T08:00:00.000Z"),
    });

    await expect(reaper.reconcileExpiredLeases(async () => false)).resolves.toBe(1);
    await expect(fixture.sessions.get({ actor: fixture.actor, sessionId })).resolves.toMatchObject({
      id: sessionId,
      runtimeId: fixture.runtime.id,
      state: "failed",
      failureCode: "runtime_lost",
    });
    const history = await fixture.sessions.listEvents({ actor: fixture.actor, sessionId, limit: 100 });
    expect(history.events.at(-1)).toMatchObject({
      kind: "session.runtime_lost",
      payload: { code: "runtime_lost" },
    });
  });
});

async function launch(): Promise<{ sessionId: string; messageId: string }> {
  const sessionId = crypto.randomUUID();
  const messageId = crypto.randomUUID();
  await fixture!.sessions.launch({
    actor: fixture!.actor,
    request: {
      sessionId,
      runtimeId: fixture!.runtime.id,
      providerKey: "codex",
      agentId: fixture!.agent.id,
      context: { taskId: fixture!.task.id, projectId: fixture!.project.id },
      firstUserMessage: { messageId, content: [{ type: "text", text: "Exercise lifecycle" }] },
      metadata: {},
    },
  });
  return { sessionId, messageId };
}

async function claim(): Promise<SessionClaimAssignment> {
  const response = await fetch(new URL("/api/runner/sessions/claim", fixture!.endpoint), {
    method: "POST",
    headers: { "content-type": "application/json", "x-mystra-runtime-id": fixture!.runtime.id },
    body: JSON.stringify({ runnerId: fixture!.runnerId, waitSeconds: 0 }),
  });
  const body = await response.json() as { assignment: unknown };
  if (response.status !== 200) throw new Error(JSON.stringify({ status: response.status, body }));
  return sessionClaimAssignmentSchema.parse(body.assignment);
}

function eventStream(
  assignment: SessionClaimAssignment,
  definitions: Array<[SessionEventInput["kind"], SessionEventInput["payload"]]>,
): SessionEventInput[] {
  return definitions.map(([kind, payload], index) => ({
    eventId: crypto.randomUUID(),
    sessionId: assignment.session.id,
    sourceId: `${assignment.lease.runnerId}:${assignment.message.messageId}`,
    sourceSequence: index + 1,
    kind,
    version: 1,
    messageId: assignment.message.messageId,
    payload,
    metadata: {},
    occurredAt: `2026-08-10T01:00:${String(index + 1).padStart(2, "0")}.000Z`,
  }));
}

async function append(assignment: SessionClaimAssignment, events: SessionEventInput[]): Promise<void> {
  const response = await fetch(new URL(
    `/api/runner/sessions/${encodeURIComponent(assignment.session.id)}/events`,
    fixture!.endpoint,
  ), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-mystra-team-id": assignment.session.teamId,
      "x-mystra-lease-token": assignment.lease.leaseToken,
    },
    body: JSON.stringify({ leaseToken: assignment.lease.leaseToken, events }),
  });
  expect(response.status).toBe(200);
}
