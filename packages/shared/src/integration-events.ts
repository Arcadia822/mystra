import { z } from "zod";

export const EVENT_PROTOCOL_VERSION = 1 as const;
export const EVENT_SUBPROTOCOL = "mystra.events.v1" as const;

export const MAX_EVENT_TYPES_PER_CATALOG = 256;
export const MAX_FILTERS_PER_EVENT_TYPE = 16;
export const MAX_SUBSCRIPTIONS_PER_CONNECTION = 32;
export const integrationWebhookEndpointSchema = z
  .object({
    id: z.string().uuid(),
    teamId: z.string().uuid(),
    connectionId: z.string().uuid(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict();
export type IntegrationWebhookEndpoint = z.infer<typeof integrationWebhookEndpointSchema>;

export const integrationWebhookEndpointPublicViewSchema = z
  .object({
    id: z.string().uuid(),
    connectionId: z.string().uuid(),
    integration: z.string().min(1),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict();
export type IntegrationWebhookEndpointPublicView = z.infer<typeof integrationWebhookEndpointPublicViewSchema>;

export const integrationWebhookResponseSchema = z
  .object({
    endpoint: integrationWebhookEndpointPublicViewSchema,
    webhookUrl: z.string().url(),
  })
  .strict();
export type IntegrationWebhookResponse = z.infer<typeof integrationWebhookResponseSchema>;


export const eventFilterDescriptorSchema = z
  .object({
    key: z.string().min(1).max(128),
    operator: z.literal("eq"),
    valueType: z.literal("string"),
  })
  .strict();
export type EventFilterDescriptor = z.infer<typeof eventFilterDescriptorSchema>;

export const eventCatalogItemSchema = z
  .object({
    integration: z.string().min(1).max(64),
    eventType: z.string().min(1).max(128),
    subjectType: z.string().min(1).max(64),
    filters: z.array(eventFilterDescriptorSchema).max(MAX_FILTERS_PER_EVENT_TYPE),
  })
  .strict();
export type EventCatalogItem = z.infer<typeof eventCatalogItemSchema>;

export const eventCatalogResponseSchema = z
  .object({
    protocolVersion: z.literal(EVENT_PROTOCOL_VERSION),
    delivery: z.literal("online-only"),
    events: z.array(eventCatalogItemSchema).max(MAX_EVENT_TYPES_PER_CATALOG),
  })
  .strict();
export type EventCatalogResponse = z.infer<typeof eventCatalogResponseSchema>;

export const eventSubjectSchema = z
  .object({
    type: z.string().min(1).max(64),
    externalId: z.string().min(1).max(256),
    identifier: z.string().min(1).max(256).optional(),
  })
  .strict();
export type EventSubject = z.infer<typeof eventSubjectSchema>;

export const normalizedEventSchema = z
  .object({
    id: z.string().min(1).max(256),
    integration: z.string().min(1).max(64),
    eventType: z.string().min(1).max(128),
    projectId: z.string().uuid(),
    subject: eventSubjectSchema,
    occurredAt: z.string().datetime(),
    receivedAt: z.string().datetime(),
    changes: z.record(z.string(), z.unknown()),
  })
  .strict();
export type NormalizedEvent = z.infer<typeof normalizedEventSchema>;

export const serverHelloMessageSchema = z
  .object({
    protocolVersion: z.literal(EVENT_PROTOCOL_VERSION),
    type: z.literal("hello"),
    connectionId: z.string().min(1).max(128),
    delivery: z.literal("online-only"),
    heartbeatIntervalMs: z.number().int().positive(),
    pongTimeoutMs: z.number().int().positive(),
    maxSubscriptions: z.number().int().positive(),
  })
  .strict();
export type ServerHelloMessage = z.infer<typeof serverHelloMessageSchema>;

export const clientSubscribeMessageSchema = z
  .object({
    protocolVersion: z.literal(EVENT_PROTOCOL_VERSION),
    type: z.literal("subscribe"),
    requestId: z.string().min(1).max(128),
    subscriptionId: z.string().min(1).max(128),
    projectId: z.string().uuid(),
    integration: z.string().min(1).max(64),
    eventType: z.string().min(1).max(128),
    filters: z.record(z.string().min(1).max(128), z.string().max(256)).optional(),
  })
  .strict();
export type ClientSubscribeMessage = z.infer<typeof clientSubscribeMessageSchema>;

export const serverSubscribedMessageSchema = z
  .object({
    protocolVersion: z.literal(EVENT_PROTOCOL_VERSION),
    type: z.literal("subscribed"),
    requestId: z.string().min(1).max(128),
    subscriptionId: z.string().min(1).max(128),
  })
  .strict();
export type ServerSubscribedMessage = z.infer<typeof serverSubscribedMessageSchema>;

export const clientUnsubscribeMessageSchema = z
  .object({
    protocolVersion: z.literal(EVENT_PROTOCOL_VERSION),
    type: z.literal("unsubscribe"),
    requestId: z.string().min(1).max(128),
    subscriptionId: z.string().min(1).max(128),
  })
  .strict();
export type ClientUnsubscribeMessage = z.infer<typeof clientUnsubscribeMessageSchema>;

export const serverUnsubscribedMessageSchema = z
  .object({
    protocolVersion: z.literal(EVENT_PROTOCOL_VERSION),
    type: z.literal("unsubscribed"),
    requestId: z.string().min(1).max(128),
    subscriptionId: z.string().min(1).max(128),
  })
  .strict();
export type ServerUnsubscribedMessage = z.infer<typeof serverUnsubscribedMessageSchema>;

export const serverEventMessageSchema = z
  .object({
    protocolVersion: z.literal(EVENT_PROTOCOL_VERSION),
    type: z.literal("event"),
    subscriptionId: z.string().min(1).max(128),
    event: normalizedEventSchema,
  })
  .strict();
export type ServerEventMessage = z.infer<typeof serverEventMessageSchema>;

export const eventErrorCodeSchema = z.enum([
  "INVALID_MESSAGE",
  "UNSUPPORTED_VERSION",
  "UNKNOWN_EVENT_TYPE",
  "UNSUPPORTED_FILTER",
  "SUBSCRIPTION_CONFLICT",
  "SUBSCRIPTION_LIMIT",
  "FORBIDDEN",
  "UNAUTHENTICATED",
  "INTERNAL_ERROR",
]);
export type EventErrorCode = z.infer<typeof eventErrorCodeSchema>;

export const serverErrorMessageSchema = z
  .object({
    protocolVersion: z.literal(EVENT_PROTOCOL_VERSION),
    type: z.literal("error"),
    requestId: z.string().min(1).max(128).optional(),
    code: eventErrorCodeSchema,
    message: z.string().min(1).max(512),
    retryable: z.boolean(),
  })
  .strict();
export type ServerErrorMessage = z.infer<typeof serverErrorMessageSchema>;

export const clientWsMessageSchema = z.discriminatedUnion("type", [
  clientSubscribeMessageSchema,
  clientUnsubscribeMessageSchema,
]);
export type ClientWsMessage = z.infer<typeof clientWsMessageSchema>;

export const serverWsMessageSchema = z.discriminatedUnion("type", [
  serverHelloMessageSchema,
  serverSubscribedMessageSchema,
  serverUnsubscribedMessageSchema,
  serverEventMessageSchema,
  serverErrorMessageSchema,
]);
export type ServerWsMessage = z.infer<typeof serverWsMessageSchema>;
