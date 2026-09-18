import { describe, expect, it } from "vitest";

import { IntegrationRegistry } from "@/lib/integrations/registry";
import { EventCatalog } from "@/lib/events/catalog";
import { EventRouter } from "@/lib/events/router";
import type { IntegrationPlugin } from "@/lib/integrations/types";
import type { NormalizedEvent } from "@mystra/shared";

function makePlugin(
  name: string,
  eventTypes: string[],
  options: { validateFilters?: (eventType: string, filters: Record<string, string>) => Record<string, string> } = {},
): IntegrationPlugin {
  return {
    descriptor: { name, provider: name, capabilities: ["events"] },
    capabilities: {
      events: {
        descriptors: eventTypes.map((eventType) => ({
          integration: name,
          eventType,
          subjectType: "item",
          filters: [{ key: "status", operator: "eq", valueType: "string" }],
        })),
        parseWebhook() {
          return { kind: "ignored", reason: "unused" };
        },
        validateFilters(eventType, filters) {
          if (options.validateFilters) return options.validateFilters(eventType, filters);
          for (const key of Object.keys(filters)) {
            if (key !== "status") {
              throw new Error(`UNSUPPORTED_FILTER: ${key}`);
            }
          }
          return filters;
        },
        matches(_eventType, canonicalFilters, event) {
          const changes = event.changes as { status?: string };
          for (const [key, val] of Object.entries(canonicalFilters)) {
            if (key === "status" && changes.status !== val) return false;
          }
          return true;
        },
      },
    },
  };
}

describe("EventCatalog", () => {
  it("assembles catalog from registered capabilities", () => {
    const registry = new IntegrationRegistry([
      makePlugin("alpha", ["alpha.item.updated"]),
      makePlugin("beta", ["beta.item.updated"]),
    ]);
    const catalog = new EventCatalog(registry);
    const response = catalog.toResponse();
    expect(response.protocolVersion).toBe(1);
    expect(response.delivery).toBe("online-only");
    expect(response.events.map((e) => e.eventType).sort()).toEqual([
      "alpha.item.updated",
      "beta.item.updated",
    ]);
  });

  it("fails fast on duplicate event types", () => {
    const registry = new IntegrationRegistry([
      makePlugin("alpha", ["alpha.item.updated", "alpha.item.updated"]),
    ]);
    expect(() => new EventCatalog(registry)).toThrow(/Duplicate event type/u);
  });

  it("fails fast when eventType does not start with integration namespace", () => {
    const registry = new IntegrationRegistry([makePlugin("alpha", ["beta.item.updated"])]);
    expect(() => new EventCatalog(registry)).toThrow(/must start with integration prefix/u);
  });
});

describe("EventRouter", () => {
  const registry = new IntegrationRegistry([
    makePlugin("alpha", ["alpha.item.updated"]),
    makePlugin("beta", ["beta.item.updated"]),
  ]);
  const catalog = new EventCatalog(registry);

  function event(integration: string, eventType: string, projectId: string, status: string): NormalizedEvent {
    return {
      id: `${integration}:evt:${eventType}`,
      integration,
      eventType,
      projectId,
      subject: { type: "item", externalId: "ext-1" },
      occurredAt: "2026-09-16T10:00:00.000Z",
      receivedAt: "2026-09-16T10:00:01.000Z",
      changes: { status },
    };
  }

  it("isolates subscriptions by integration source (no cross-streaming)", () => {
    const router = new EventRouter(registry, catalog);
    const receivedByAlpha: string[] = [];
    const receivedByBeta: string[] = [];

    router.subscribe({
      connectionId: "conn-1",
      subscriptionId: "sub-alpha",
      projectId: "proj-1",
      integration: "alpha",
      eventType: "alpha.item.updated",
      send: (e) => receivedByAlpha.push(e.id),
    });
    router.subscribe({
      connectionId: "conn-2",
      subscriptionId: "sub-beta",
      projectId: "proj-1",
      integration: "beta",
      eventType: "beta.item.updated",
      send: (e) => receivedByBeta.push(e.id),
    });

    router.dispatch(event("alpha", "alpha.item.updated", "proj-1", "open"));
    expect(receivedByAlpha).toHaveLength(1);
    expect(receivedByBeta).toHaveLength(0);
  });

  it("broadcasts one event to multiple matching subscriptions on the same connection", () => {
    const router = new EventRouter(registry, catalog);
    let count1 = 0;
    let count2 = 0;

    router.subscribe({
      connectionId: "conn-1",
      subscriptionId: "s1",
      projectId: "proj-1",
      integration: "alpha",
      eventType: "alpha.item.updated",
      send: () => { count1++; },
    });
    router.subscribe({
      connectionId: "conn-1",
      subscriptionId: "s2",
      projectId: "proj-1",
      integration: "alpha",
      eventType: "alpha.item.updated",
      send: () => { count2++; },
    });

    router.dispatch(event("alpha", "alpha.item.updated", "proj-1", "open"));
    expect(count1).toBe(1);
    expect(count2).toBe(1);
  });

  it("errors on unknown event type and unsupported filter key", () => {
    const router = new EventRouter(registry, catalog);

    expect(() =>
      router.subscribe({
        connectionId: "conn-1",
        subscriptionId: "s1",
        projectId: "proj-1",
        integration: "alpha",
        eventType: "unknown.event",
        send: () => {},
      }),
    ).toThrow(/UNKNOWN_EVENT_TYPE/u);

    expect(() =>
      router.subscribe({
        connectionId: "conn-1",
        subscriptionId: "s2",
        projectId: "proj-1",
        integration: "alpha",
        eventType: "alpha.item.updated",
        filters: { bogus: "x" },
        send: () => {},
      }),
    ).toThrow(/UNSUPPORTED_FILTER/u);
  });

  it("handles idempotent duplicate subscribe and conflicting subscribe", () => {
    const router = new EventRouter(registry, catalog);
    const first = router.subscribe({
      connectionId: "conn-1",
      subscriptionId: "s1",
      projectId: "proj-1",
      integration: "alpha",
      eventType: "alpha.item.updated",
      filters: { status: "open" },
      send: () => {},
    });
    expect(first.status).toBe("subscribed");
    const generation = first.status === "subscribed" ? first.subscription.generation : -1;

    const repeat = router.subscribe({
      connectionId: "conn-1",
      subscriptionId: "s1",
      projectId: "proj-1",
      integration: "alpha",
      eventType: "alpha.item.updated",
      filters: { status: "open" },
      send: () => {},
    });
    expect(repeat.status).toBe("subscribed");
    if (repeat.status === "subscribed") {
      expect(repeat.subscription.generation).toBe(generation);
    }

    const conflict = router.subscribe({
      connectionId: "conn-1",
      subscriptionId: "s1",
      projectId: "proj-1",
      integration: "alpha",
      eventType: "alpha.item.updated",
      filters: { status: "closed" },
      send: () => {},
    });
    expect(conflict.status).toBe("conflict");
  });

  it("enforces generation cap so subscriptions created after admission do not receive backlog", () => {
    const router = new EventRouter(registry, catalog);
    let received = 0;

    const result = router.subscribe({
      connectionId: "conn-1",
      subscriptionId: "s-late",
      projectId: "proj-1",
      integration: "alpha",
      eventType: "alpha.item.updated",
      send: () => { received++; },
    });
    expect(result.status).toBe("subscribed");
    const lateGeneration = result.status === "subscribed" ? result.subscription.generation : 0;

    // Dispatch with a cap lower than the late subscription's generation
    router.dispatch(event("alpha", "alpha.item.updated", "proj-1", "open"), lateGeneration - 1);
    expect(received).toBe(0);

    // Dispatch with a sufficient cap delivers
    router.dispatch(event("alpha", "alpha.item.updated", "proj-1", "open"), lateGeneration);
    expect(received).toBe(1);
  });

  it("cleans up all subscriptions when connection removed", () => {
    const router = new EventRouter(registry, catalog);
    router.subscribe({
      connectionId: "conn-1",
      subscriptionId: "s1",
      projectId: "proj-1",
      integration: "alpha",
      eventType: "alpha.item.updated",
      send: () => {},
    });
    expect(router.getSubscriptionCount()).toBe(1);
    router.removeConnection("conn-1");
    expect(router.getSubscriptionCount()).toBe(0);
  });
});
