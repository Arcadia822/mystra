import { z } from "zod";

import type {
  CandidateEvent,
  IntegrationEventCapability,
  WebhookParseResult,
} from "./types";

export const LINEAR_ISSUE_STATE_CHANGED_EVENT = "linear.issue.state_changed";
export const LINEAR_SCOPE_TYPE = "linear-team";

const linearIssueWebhookSchema = z
  .object({
    action: z.literal("update"),
    type: z.literal("Issue"),
    organizationId: z.string().min(1),
    createdAt: z.string().datetime(),
    updatedFrom: z.object({ stateId: z.string().min(1).optional() }).partial().optional(),
    data: z
      .object({
        id: z.string().min(1),
        identifier: z.string().min(1).optional(),
        teamId: z.string().min(1).optional(),
        stateId: z.string().min(1).optional(),
      })
      .passthrough(),
  })
  .passthrough();

export interface LinearWebhookHeaders {
  readonly "linear-delivery"?: string;
  readonly "linear-event"?: string;
}

const deliveryIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

export function createLinearEventsCapability(): IntegrationEventCapability {
  return {
    descriptors: [
      {
        integration: "linear",
        eventType: LINEAR_ISSUE_STATE_CHANGED_EVENT,
        subjectType: "issue",
        filters: [
          { key: "subject.externalId", operator: "eq", valueType: "string" },
          { key: "changes.state.from", operator: "eq", valueType: "string" },
          { key: "changes.state.to", operator: "eq", valueType: "string" },
        ],
      },
    ],

    requiredHeaders: ["content-type", "linear-delivery", "linear-event"],

    parseWebhook(input): WebhookParseResult {
      const delivery = input.headers["linear-delivery"];
      if (!delivery || !deliveryIdPattern.test(delivery)) {
        return { kind: "ignored", reason: "invalid_delivery_id" };
      }

      const eventHeader = input.headers["linear-event"];
      if (eventHeader !== undefined && eventHeader !== "Issue") {
        return { kind: "ignored", reason: "unexpected_event_header" };
      }

      let raw: unknown;
      try {
        raw = JSON.parse(input.rawBody);
      } catch {
        return { kind: "ignored", reason: "invalid_payload" };
      }

      const parsed = linearIssueWebhookSchema.safeParse(raw);
      if (!parsed.success) {
        return { kind: "ignored", reason: "invalid_payload" };
      }

      const body = parsed.data;
      if (eventHeader !== undefined && eventHeader !== body.type) {
        return { kind: "ignored", reason: "event_header_mismatch" };
      }

      const teamId = body.data.teamId;
      if (!teamId) {
        return { kind: "ignored", reason: "ignored" };
      }

      const previousStateId = body.updatedFrom?.stateId;
      const nextStateId = body.data.stateId;
      if (
        !previousStateId
        || !nextStateId
        || previousStateId === nextStateId
      ) {
        return { kind: "ignored", reason: "ignored" };
      }

      const candidate: CandidateEvent = {
        providerEventId: delivery,
        eventType: LINEAR_ISSUE_STATE_CHANGED_EVENT,
        subject: {
          type: "issue",
          externalId: body.data.id,
          ...(body.data.identifier ? { identifier: body.data.identifier } : {}),
        },
        occurredAt: body.createdAt,
        scope: {
          scopeType: LINEAR_SCOPE_TYPE,
          scopeExternalId: teamId,
        },
        organizationId: body.organizationId,
        changes: {
          state: {
            from: previousStateId,
            to: nextStateId,
          },
        },
      };

      return { kind: "events", events: [candidate] };
    },

    validateFilters(eventType, filters) {
      if (eventType !== LINEAR_ISSUE_STATE_CHANGED_EVENT) {
        throw new Error(`UNKNOWN_EVENT_TYPE: ${eventType}`);
      }
      const supported = new Set([
        "subject.externalId",
        "changes.state.from",
        "changes.state.to",
      ]);
      const canonical: Record<string, string> = {};
      for (const [key, value] of Object.entries(filters)) {
        if (!supported.has(key)) {
          throw new Error(`UNSUPPORTED_FILTER: ${key}`);
        }
        canonical[key] = value;
      }
      return canonical;
    },

    matches(eventType, canonicalFilters, normalizedEvent) {
      if (eventType !== LINEAR_ISSUE_STATE_CHANGED_EVENT) return false;
      const changes = normalizedEvent.changes as {
        state?: { from?: unknown; to?: unknown };
      };
      const subjects: Record<string, string> = {
        "subject.externalId": normalizedEvent.subject.externalId,
        "changes.state.from": typeof changes.state?.from === "string" ? changes.state.from : "",
        "changes.state.to": typeof changes.state?.to === "string" ? changes.state.to : "",
      };
      for (const [key, expected] of Object.entries(canonicalFilters)) {
        if (subjects[key] !== expected) return false;
      }
      return true;
    },
  };
}
