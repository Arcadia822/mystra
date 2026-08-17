import { afterEach, describe, expect, it } from "vitest";

import {
  sessionClaimAssignmentSchema,
  type SessionClaimAssignment,
  type SessionEventInput,
} from "@mystra/shared";

import { createSessionE2eFixture } from "../../../test/session-e2e-support";

let fixture: Awaited<ReturnType<typeof createSessionE2eFixture>> | undefined;

afterEach(async () => {
  await fixture?.close();
  fixture = undefined;
});

describe("Session execution SQLite/HTTP E2E", () => {
  it.each([
    { label: "without Agent Context", selectedAgent: false },
    { label: "with frozen Optional Agent Context", selectedAgent: true },
  ])("starts production $label, replays idempotently, and completes through Runner HTTP", async ({ selectedAgent }) => {
    fixture = await createSessionE2eFixture();
    const idempotencyKey = `session-e2e-${selectedAgent ? "agent" : "standard"}`;
    const request = {
      runtimeId: fixture.runtime.id,
      providerKey: "codex",
      expectedRevision: 1,
      idempotencyKey,
      ...(selectedAgent ? { agentId: fixture.agent.id } : {}),
    };

    const started = await fixture.production.start({ actor: fixture.actor, taskId: fixture.task.id, request });
    expect(started).toMatchObject({
      created: true,
      task: { status: "in_progress", statusRevision: 2 },
      executionContext: selectedAgent
        ? { agentId: fixture.agent.id, agentName: fixture.agent.name, agentRevision: fixture.agent.revision }
        : { agentId: null, agentName: null, agentRevision: null, agentSystemPrompt: null },
    });
    expect(started.executionContext.sessionId).toBe(started.executionContext.plannedSessionId);

    const replay = await fixture.production.start({ actor: fixture.actor, taskId: fixture.task.id, request });
    expect(replay).toMatchObject({
      created: false,
      executionContext: { id: started.executionContext.id, sessionId: started.executionContext.sessionId },
    });

    const assignment = await claim(fixture.endpoint, fixture.runtime.id, fixture.runnerId);
    expect(assignment.session.id).toBe(started.executionContext.sessionId);
    expect(assignment.systemPrompt).toContain("You are executing a Mystra production Task");
    if (selectedAgent) {
      expect(assignment.systemPrompt).toContain(fixture.agent.systemPrompt);
    } else {
      expect(assignment.systemPrompt).not.toContain(fixture.agent.systemPrompt);
    }
    await fakeProviderResponse(fixture.endpoint, assignment, `fake-production-${selectedAgent ? "agent" : "standard"}`);
    await expect(fixture.sessions.get({ actor: fixture.actor, sessionId: assignment.session.id })).resolves.toMatchObject({
      state: "ready",
      agentId: selectedAgent ? fixture.agent.id : null,
    });
  });

  it("executes the launch message and two continuations through one Provider session", async () => {
    fixture = await createSessionE2eFixture();
    const sessionId = crypto.randomUUID();
    const launched = await fixture.taskSessionLaunches.launch({
      actor: fixture.actor,
      taskId: fixture.task.id,
      request: {
        sessionId, providerKey: "codex",
        manualContext: { text: "Exercise the Task-bound Web launch path" },
      },
    });
    expect(launched.state).toBe("ready");
    if (launched.state !== "ready") throw new Error("Expected ready Session launch");
    const firstMessageId = launched.session.activeMessageId!;
    expect(launched).toMatchObject({
      state: "ready",
      created: true,
      session: { state: "queued", activeMessageId: firstMessageId, agentId: null, agentRevision: null },
    });
    expect((await fixture.sessions.listEvents({
      actor: fixture.actor,
      sessionId,
      limit: 20,
    })).events.map(({ kind }) => kind)).toEqual([
      "session.created",
      "session.system_prompt_configured",
      "session.workspace_attached",
      "session.user_message_submitted",
    ]);

    const first = await claim(fixture.endpoint, fixture.runtime.id, fixture.runnerId);
    expect(first.message.messageId).toBe(firstMessageId);
    expect(first.session).toMatchObject({ agentId: null, agentRevision: null });
    expect(first.systemPrompt).toContain("You are executing a Mystra production Task");
    expect(first.systemPrompt).not.toContain(fixture.agent.systemPrompt);
    expect(first.lease.providerSessionId).toBeNull();
    await fakeProviderResponse(fixture.endpoint, first, "fake-provider-session-1");
    await expect(fixture.sessions.get({ actor: fixture.actor, sessionId })).resolves.toMatchObject({
      state: "ready",
      activeMessageId: null,
      lastMessageId: firstMessageId,
    });

    const messageIds = [crypto.randomUUID(), crypto.randomUUID()];
    for (const [index, messageId] of messageIds.entries()) {
      await expect(fixture.sessions.sendMessage({
        actor: fixture.actor,
        sessionId,
        request: {
          messageId,
          content: [{ type: "text", text: `Continue ${index + 1}` }],
        },
      })).resolves.toMatchObject({ created: true, session: { state: "message_pending", activeMessageId: messageId } });
      const continuation = await claim(fixture.endpoint, fixture.runtime.id, fixture.runnerId);
      expect(continuation).toMatchObject({
        message: { messageId },
        lease: { providerSessionId: "fake-provider-session-1" },
      });
      await fakeProviderResponse(fixture.endpoint, continuation);
    }

    const final = await fixture.sessions.get({ actor: fixture.actor, sessionId });
    expect(final).toMatchObject({ state: "ready", activeMessageId: null, lastMessageId: messageIds[1] });
    const history = await fixture.sessions.listEvents({ actor: fixture.actor, sessionId, limit: 100 });
    expect(history.events.filter(({ kind }) => kind === "session.runtime_dispatched")).toHaveLength(3);
    expect(history.events.filter(({ kind }) => kind === "session.user_message_submitted")).toHaveLength(3);
    expect(history.events.filter(({ kind }) => kind === "session.provider_started")).toHaveLength(1);
    expect(JSON.stringify({ final, history })).not.toMatch(/turnId|SessionTurn|maxConcurrency|slot/iu);
  });
});

async function claim(endpoint: string, runtimeId: string, runnerId: string): Promise<SessionClaimAssignment> {
  const response = await fetch(new URL("/api/runner/sessions/claim", endpoint), {
    method: "POST",
    headers: { "content-type": "application/json", "x-mystra-runtime-id": runtimeId },
    body: JSON.stringify({ runnerId, waitSeconds: 0 }),
  });
  const body = await response.json() as { assignment: unknown };
  if (response.status !== 200) throw new Error(JSON.stringify({ status: response.status, body }));
  return sessionClaimAssignmentSchema.parse(body.assignment);
}

async function fakeProviderResponse(
  endpoint: string,
  assignment: SessionClaimAssignment,
  providerSessionId?: string,
): Promise<void> {
  let sourceSequence = 0;
  const event = (
    kind: SessionEventInput["kind"],
    payload: SessionEventInput["payload"],
  ): SessionEventInput => ({
    eventId: crypto.randomUUID(),
    sessionId: assignment.session.id,
    sourceId: `${assignment.lease.runnerId}:${assignment.message.messageId}`,
    sourceSequence: ++sourceSequence,
    kind,
    version: 1,
    messageId: assignment.message.messageId,
    payload,
    metadata: {},
    occurredAt: "2026-08-10T01:00:01.000Z",
  });
  const events = [
    ...(providerSessionId
      ? [event("session.provider_started", { providerSessionId })]
      : []),
    event("session.response_started", {}),
    event("session.agent_message_chunk", { text: "Fake Provider response" }),
    event("session.response_completed", { stopReason: "end_turn" }),
  ];
  const response = await fetch(new URL(
    `/api/runner/sessions/${encodeURIComponent(assignment.session.id)}/events`,
    endpoint,
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
