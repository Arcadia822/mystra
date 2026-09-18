import { describe, expect, it } from "vitest";

import {
  EVENT_PROTOCOL_VERSION,
  EVENT_SUBPROTOCOL,
  MAX_EVENT_TYPES_PER_CATALOG,
  MAX_FILTERS_PER_EVENT_TYPE,
  MAX_SUBSCRIPTIONS_PER_CONNECTION,
  eventCatalogResponseSchema,
  eventErrorCodeSchema,
  normalizedEventSchema,
  serverHelloMessageSchema,
  clientSubscribeMessageSchema,
  serverSubscribedMessageSchema,
  clientUnsubscribeMessageSchema,
  serverUnsubscribedMessageSchema,
  serverEventMessageSchema,
  serverErrorMessageSchema,
  clientWsMessageSchema,
  serverWsMessageSchema,
} from "./integration-events.js";

const sampleProjectId = "550e8400-e29b-41d4-a716-446655440000";

describe("integration-events schemas", () => {
  it("exports correct protocol constants", () => {
    expect(EVENT_PROTOCOL_VERSION).toBe(1);
    expect(EVENT_SUBPROTOCOL).toBe("mystra.events.v1");
    expect(MAX_EVENT_TYPES_PER_CATALOG).toBe(256);
    expect(MAX_FILTERS_PER_EVENT_TYPE).toBe(16);
    expect(MAX_SUBSCRIPTIONS_PER_CONNECTION).toBe(32);
  });

  describe("eventCatalogResponseSchema", () => {
    it("accepts a valid catalog", () => {
      const parsed = eventCatalogResponseSchema.parse({
        protocolVersion: 1,
        delivery: "online-only",
        events: [
          {
            integration: "linear",
            eventType: "linear.issue.state_changed",
            subjectType: "issue",
            filters: [
              { key: "subject.externalId", operator: "eq", valueType: "string" },
              { key: "changes.state.from", operator: "eq", valueType: "string" },
              { key: "changes.state.to", operator: "eq", valueType: "string" },
            ],
          },
        ],
      });
      expect(parsed.events).toHaveLength(1);
    });

    it("rejects unknown protocolVersion", () => {
      expect(() =>
        eventCatalogResponseSchema.parse({
          protocolVersion: 2,
          delivery: "online-only",
          events: [],
        }),
      ).toThrow();
    });

    it("rejects unknown fields in catalog (strict)", () => {
      expect(() =>
        eventCatalogResponseSchema.parse({
          protocolVersion: 1,
          delivery: "online-only",
          events: [],
          extra: "rejected",
        }),
      ).toThrow();
    });

    it("rejects catalog exceeding MAX_EVENT_TYPES_PER_CATALOG", () => {
      const events = Array.from({ length: 257 }, (_, i) => ({
        integration: `test-${i}`,
        eventType: `test.event.${i}`,
        subjectType: "test",
        filters: [],
      }));
      expect(() =>
        eventCatalogResponseSchema.parse({
          protocolVersion: 1,
          delivery: "online-only",
          events,
        }),
      ).toThrow();
    });
  });

  describe("normalizedEventSchema", () => {
    const validEvent = {
      id: "linear:234d1a4e-b617-4388-90fe-adc3633d6b72:linear.issue.state_changed",
      integration: "linear",
      eventType: "linear.issue.state_changed",
      projectId: sampleProjectId,
      subject: {
        type: "issue",
        externalId: "539068e2-ae88-4d09-bd75-22eb4a59612f",
        identifier: "TEST-1",
      },
      occurredAt: "2026-09-16T10:00:00.000Z",
      receivedAt: "2026-09-16T10:00:01.000Z",
      changes: { state: { from: "started", to: "review" } },
    };

    it("accepts valid normalized event", () => {
      const parsed = normalizedEventSchema.parse(validEvent);
      expect(parsed.id).toBe(validEvent.id);
      expect(parsed.projectId).toBe(sampleProjectId);
    });

    it("rejects unknown fields (strict)", () => {
      expect(() =>
        normalizedEventSchema.parse({
          ...validEvent,
          extraField: "not allowed",
        }),
      ).toThrow();
    });

    it("rejects non-uuid projectId", () => {
      expect(() =>
        normalizedEventSchema.parse({
          ...validEvent,
          projectId: "not-a-uuid",
        }),
      ).toThrow();
    });

    it("rejects non-datetime timestamps", () => {
      expect(() =>
        normalizedEventSchema.parse({
          ...validEvent,
          occurredAt: "not-a-datetime",
        }),
      ).toThrow();
    });
  });

  describe("WebSocket protocol messages", () => {
    it("validates server hello message", () => {
      const hello = {
        protocolVersion: 1,
        type: "hello" as const,
        connectionId: "conn-1",
        delivery: "online-only" as const,
        heartbeatIntervalMs: 30000,
        pongTimeoutMs: 10000,
        maxSubscriptions: 32,
      };
      expect(serverHelloMessageSchema.parse(hello)).toEqual(hello);
      expect(serverWsMessageSchema.parse(hello)).toEqual(hello);
    });

    it("validates client subscribe message and rejects unknown fields", () => {
      const sub = {
        protocolVersion: 1,
        type: "subscribe" as const,
        requestId: "r1",
        subscriptionId: "sub-1",
        projectId: sampleProjectId,
        integration: "linear",
        eventType: "linear.issue.state_changed",
        filters: { "changes.state.to": "review" },
      };
      expect(clientSubscribeMessageSchema.parse(sub)).toEqual(sub);
      expect(clientWsMessageSchema.parse(sub)).toEqual(sub);

      expect(() =>
        clientSubscribeMessageSchema.parse({
          ...sub,
          extraUnknown: 123,
        }),
      ).toThrow();
    });

    it("validates server subscribed confirmation", () => {
      const ack = {
        protocolVersion: 1,
        type: "subscribed" as const,
        requestId: "r1",
        subscriptionId: "sub-1",
      };
      expect(serverSubscribedMessageSchema.parse(ack)).toEqual(ack);
      expect(serverWsMessageSchema.parse(ack)).toEqual(ack);
    });

    it("validates client unsubscribe and server unsubscribed confirmation", () => {
      const unsub = {
        protocolVersion: 1,
        type: "unsubscribe" as const,
        requestId: "r2",
        subscriptionId: "sub-1",
      };
      expect(clientUnsubscribeMessageSchema.parse(unsub)).toEqual(unsub);
      expect(clientWsMessageSchema.parse(unsub)).toEqual(unsub);

      const unack = {
        protocolVersion: 1,
        type: "unsubscribed" as const,
        requestId: "r2",
        subscriptionId: "sub-1",
      };
      expect(serverUnsubscribedMessageSchema.parse(unack)).toEqual(unack);
      expect(serverWsMessageSchema.parse(unack)).toEqual(unack);
    });

    it("validates server event frame", () => {
      const eventMsg = {
        protocolVersion: 1,
        type: "event" as const,
        subscriptionId: "sub-1",
        event: {
          id: "linear:1:linear.issue.state_changed",
          integration: "linear",
          eventType: "linear.issue.state_changed",
          projectId: sampleProjectId,
          subject: {
            type: "issue",
            externalId: "ext-1",
          },
          occurredAt: "2026-09-16T10:00:00.000Z",
          receivedAt: "2026-09-16T10:00:01.000Z",
          changes: {},
        },
      };
      expect(serverEventMessageSchema.parse(eventMsg)).toEqual(eventMsg);
      expect(serverWsMessageSchema.parse(eventMsg)).toEqual(eventMsg);
    });

    it("validates server error codes and message", () => {
      const errorCodes = [
        "INVALID_MESSAGE",
        "UNSUPPORTED_VERSION",
        "UNKNOWN_EVENT_TYPE",
        "UNSUPPORTED_FILTER",
        "SUBSCRIPTION_CONFLICT",
        "SUBSCRIPTION_LIMIT",
        "FORBIDDEN",
        "UNAUTHENTICATED",
        "INTERNAL_ERROR",
      ] as const;

      for (const code of errorCodes) {
        expect(eventErrorCodeSchema.parse(code)).toBe(code);
        const errMsg = {
          protocolVersion: 1,
          type: "error" as const,
          requestId: "r1",
          code,
          message: "Test error",
          retryable: false,
        };
        expect(serverErrorMessageSchema.parse(errMsg)).toEqual(errMsg);
        expect(serverWsMessageSchema.parse(errMsg)).toEqual(errMsg);
      }
    });

    it("rejects unknown error code", () => {
      expect(() => eventErrorCodeSchema.parse("UNKNOWN_CODE")).toThrow();
    });
  });
});
