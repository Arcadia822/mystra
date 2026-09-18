import { describe, expect, it } from "vitest";

import { createLinearEventsCapability } from "./linear-events";

const capability = createLinearEventsCapability();

function payload(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    action: "update",
    type: "Issue",
    organizationId: "org-1",
    createdAt: "2026-09-16T10:00:00.000Z",
    updatedFrom: { stateId: "state-started" },
    data: {
      id: "issue-uuid-1",
      identifier: "TEST-1",
      teamId: "linear-team-1",
      stateId: "state-review",
    },
    ...overrides,
  });
}

const deliveryId = "234d1a4e-b617-4388-90fe-adc3633d6b72";

describe("linear events capability", () => {
  it("emits linear.issue.state_changed for a valid state change", async () => {
    const result = await capability.parseWebhook({
      rawBody: payload(),
      headers: {
        "content-type": "application/json",
        "linear-delivery": deliveryId,
        "linear-event": "Issue",
      },
      connectionConfig: {},
    });

    expect(result.kind).toBe("events");
    if (result.kind !== "events") return;
    expect(result.events).toHaveLength(1);
    const event = result.events[0]!;
    expect(event.providerEventId).toBe(deliveryId);
    expect(event.eventType).toBe("linear.issue.state_changed");
    expect(event.subject).toEqual({ type: "issue", externalId: "issue-uuid-1", identifier: "TEST-1" });
    expect(event.occurredAt).toBe("2026-09-16T10:00:00.000Z");
    expect(event.scope).toEqual({ scopeType: "linear-team", scopeExternalId: "linear-team-1" });
    expect(event.organizationId).toBe("org-1");
    expect(event.changes).toEqual({ state: { from: "state-started", to: "state-review" } });
  });

  it("uses Linear-Delivery as the event id (not webhook id or connection id)", async () => {
    const result = await capability.parseWebhook({
      rawBody: payload(),
      headers: { "linear-delivery": deliveryId, "linear-event": "Issue" },
      connectionConfig: {},
    });
    if (result.kind !== "events") throw new Error("expected events");
    expect(result.events[0]!.providerEventId).toBe(deliveryId);
  });

  it("ignores a plain title/description modification without a state change", async () => {
    const result = await capability.parseWebhook({
      rawBody: payload({ updatedFrom: { title: "Old title" } }),
      headers: { "linear-delivery": deliveryId, "linear-event": "Issue" },
      connectionConfig: {},
    });
    expect(result.kind).toBe("ignored");
  });

  it("ignores equal from/to state ids and unknown/null previous state", async () => {
    const sameState = await capability.parseWebhook({
      rawBody: payload({ updatedFrom: { stateId: "state-review" } }),
      headers: { "linear-delivery": deliveryId, "linear-event": "Issue" },
      connectionConfig: {},
    });
    expect(sameState.kind).toBe("ignored");

    const nullPrevious = await capability.parseWebhook({
      rawBody: payload({
        updatedFrom: { stateId: null },
        data: { id: "i-1", teamId: "t-1", stateId: "state-review" },
      }),
      headers: { "linear-delivery": deliveryId, "linear-event": "Issue" },
      connectionConfig: {},
    });
    expect(nullPrevious.kind).toBe("ignored");
  });

  it("ignores malformed payloads and invalid delivery ids", async () => {
    const malformed = await capability.parseWebhook({
      rawBody: "{ not json",
      headers: { "linear-delivery": deliveryId, "linear-event": "Issue" },
      connectionConfig: {},
    });
    expect(malformed.kind).toBe("ignored");

    const invalidDelivery = await capability.parseWebhook({
      rawBody: payload(),
      headers: { "linear-delivery": "not-a-uuid", "linear-event": "Issue" },
      connectionConfig: {},
    });
    expect(invalidDelivery.kind).toBe("ignored");

    const missingDelivery = await capability.parseWebhook({
      rawBody: payload(),
      headers: {},
      connectionConfig: {},
    });
    expect(missingDelivery.kind).toBe("ignored");
  });

  it("rejects a Linear-Event header that disagrees with the body", async () => {
    const result = await capability.parseWebhook({
      rawBody: payload(),
      headers: { "linear-delivery": deliveryId, "linear-event": "Comment" },
      connectionConfig: {},
    });
    expect(result.kind).toBe("ignored");
  });

  it("ignores payloads without a provider-stable teamId", async () => {
    const result = await capability.parseWebhook({
      rawBody: payload({ data: { id: "i-1", stateId: "state-review" } }),
      headers: { "linear-delivery": deliveryId, "linear-event": "Issue" },
      connectionConfig: {},
    });
    expect(result.kind).toBe("ignored");
  });

  it("validates only declared filters and matches exactly", () => {
    const canonical = capability.validateFilters("linear.issue.state_changed", {
      "changes.state.to": "state-review",
    });
    expect(canonical).toEqual({ "changes.state.to": "state-review" });

    expect(() =>
      capability.validateFilters("linear.issue.state_changed", { "subject.foo": "x" }),
    ).toThrow(/UNSUPPORTED_FILTER/u);

    expect(() => capability.validateFilters("unknown.event", {})).toThrow(/UNKNOWN_EVENT_TYPE/u);
  });

  it("matches filters against normalized event fields", () => {
    const event = {
      id: "linear:delivery:linear.issue.state_changed",
      integration: "linear",
      eventType: "linear.issue.state_changed",
      projectId: "550e8400-e29b-41d4-a716-446655440000",
      subject: { type: "issue", externalId: "issue-uuid-1" },
      occurredAt: "2026-09-16T10:00:00.000Z",
      receivedAt: "2026-09-16T10:00:01.000Z",
      changes: { state: { from: "state-started", to: "state-review" } },
    };

    expect(
      capability.matches("linear.issue.state_changed", { "changes.state.to": "state-review" }, event),
    ).toBe(true);
    expect(
      capability.matches("linear.issue.state_changed", { "changes.state.to": "state-done" }, event),
    ).toBe(false);
    expect(
      capability.matches("linear.issue.state_changed", { "subject.externalId": "issue-uuid-1" }, event),
    ).toBe(true);
  });
});
