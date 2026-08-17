import { z } from "zod";

import {
  agentContextSnapshotSchema,
  sessionExecutionCapabilitySchema,
} from "./task-execution-attempt.js";

import { sessionWorkspaceAttachmentSchema } from "./task-workspace.js";

export const SESSION_EVENT_MAX_BYTES = 64 * 1024;
export const SESSION_EVENT_BATCH_MAX_BYTES = 256 * 1024;
export const SESSION_EVENT_BATCH_MAX_COUNT = 100;
export const SESSION_TEXT_MAX_LENGTH = 64 * 1024;
export const SESSION_CHUNK_MAX_LENGTH = 16 * 1024;

const sensitiveKeyPattern = /^(authorization|cookie|credential|password|secret|token|access[_-]?token|refresh[_-]?token|api[_-]?key|private[_-]?key)$/iu;

export const sessionJsonValueSchema = z.json();
export const sessionJsonObjectSchema = z.record(z.string(), sessionJsonValueSchema);
export type SessionJsonObject = z.infer<typeof sessionJsonObjectSchema>;

function serializedBytes(value: unknown): number {
  return Buffer.byteLength(JSON.stringify(value), "utf8");
}

function findSensitivePath(value: unknown, path: string[] = []): string[] | undefined {
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const found = findSensitivePath(value[index], [...path, String(index)]);
      if (found) return found;
    }
    return undefined;
  }
  if (value === null || typeof value !== "object") return undefined;
  for (const [key, nested] of Object.entries(value)) {
    if (sensitiveKeyPattern.test(key)) return [...path, key];
    const found = findSensitivePath(nested, [...path, key]);
    if (found) return found;
  }
  return undefined;
}

function addStructuredValueIssues(
  value: unknown,
  ctx: z.RefinementCtx,
  maximumBytes: number,
): void {
  const sensitivePath = findSensitivePath(value);
  if (sensitivePath) {
    ctx.addIssue({
      code: "custom",
      message: `Sensitive key is not permitted in SessionEvent payload: ${sensitivePath.join(".")}`,
      path: sensitivePath,
    });
  }
  if (serializedBytes(value) > maximumBytes) {
    ctx.addIssue({ code: "custom", message: `Serialized value exceeds ${maximumBytes} bytes` });
  }
}

export function assertSessionStructuredValueSafe(
  value: unknown,
  maximumBytes = SESSION_EVENT_MAX_BYTES,
): void {
  const result = sessionJsonValueSchema.superRefine((candidate, ctx) => {
    addStructuredValueIssues(candidate, ctx, maximumBytes);
  }).safeParse(value);
  if (!result.success) throw result.error;
}

export const sessionStateSchema = z.enum([
  "queued",
  "dispatched",
  "message_pending",
  "running",
  "ready",
  "interrupted",
  "waiting_for_handoff",
  "closed",
  "failed",
]);
export type SessionState = z.infer<typeof sessionStateSchema>;

export const terminalSessionStates = ["closed", "failed"] as const satisfies readonly SessionState[];
const terminalStateSet = new Set<SessionState>(terminalSessionStates);

function isTerminalSessionState(state: SessionState): boolean {
  return terminalStateSet.has(state);
}

export const sessionInterruptKindSchema = z.enum([
  "input_required",
  "approval_required",
  "provider_refusal",
  "provider_limit",
  "external_action",
]);
export type SessionInterruptKind = z.infer<typeof sessionInterruptKindSchema>;

export const sessionContinuationModeSchema = z.enum(["resume_message", "new_message"]);
export type SessionContinuationMode = z.infer<typeof sessionContinuationModeSchema>;

export const sessionSchema = z.object({
  id: z.string().uuid(),
  teamId: z.string().uuid(),
  taskId: z.string().uuid(),
  projectId: z.string().uuid().nullable(),
  runtimeId: z.string().uuid(),
  providerKey: z.string().min(1).max(128),
  agentId: z.string().uuid().nullable(),
  agentRevision: z.number().int().positive().nullable(),
  state: sessionStateSchema,
  activeMessageId: z.string().uuid().nullable(),
  lastMessageId: z.string().uuid().nullable(),
  interruptKind: sessionInterruptKindSchema.nullable(),
  continuationMode: sessionContinuationModeSchema.nullable(),
  failureCode: z.string().min(1).max(128).nullable(),
  metadata: sessionJsonObjectSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
}).strict().superRefine((value, context) => {
  if ((value.agentId === null) !== (value.agentRevision === null)) {
    context.addIssue({ code: "custom", path: ["agentId"], message: "Session Agent Context must be wholly present or absent" });
  }
});
export type Session = z.infer<typeof sessionSchema>;

export const sessionSubjectSchema = z.object({
  actorId: z.string().min(1),
  teamId: z.string().uuid(),
  roles: z.array(z.enum(["owner", "admin", "member"])),
}).strict();
export type SessionSubject = z.infer<typeof sessionSubjectSchema>;

export const userMessageContentPartSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("text"), text: z.string().min(1).max(SESSION_TEXT_MAX_LENGTH) }).strict(),
  z.object({ type: z.literal("artifact"), artifactId: z.string().uuid() }).strict(),
]);
export type UserMessageContentPart = z.infer<typeof userMessageContentPartSchema>;

export const userMessageInputSchema = z.object({
  messageId: z.string().uuid(),
  content: z.array(userMessageContentPartSchema).min(1).max(64),
}).strict();
export type UserMessageInput = z.infer<typeof userMessageInputSchema>;

export const sessionLaunchRequestSchema = z.object({
  sessionId: z.string().uuid(),
  runtimeId: z.string().uuid(),
  providerKey: z.string().min(1).max(128),
  agentId: z.string().uuid().nullish().transform((value) => value ?? null),
  context: z.object({
    projectId: z.string().uuid().optional(),
    taskId: z.string().uuid(),
    manual: sessionJsonObjectSchema.optional(),
  }).strict(),
  firstUserMessage: userMessageInputSchema,
  metadata: sessionJsonObjectSchema.default({}),
}).strict().superRefine((value, ctx) => {
  addStructuredValueIssues(value.context.manual ?? {}, ctx, SESSION_EVENT_MAX_BYTES);
  addStructuredValueIssues(value.metadata, ctx, SESSION_EVENT_MAX_BYTES);
});
export type SessionLaunchRequest = z.input<typeof sessionLaunchRequestSchema>;
export type ParsedSessionLaunchRequest = z.output<typeof sessionLaunchRequestSchema>;

export const sessionSendMessageRequestSchema = userMessageInputSchema.extend({
  inReplyToMessageId: z.string().uuid().optional(),
}).strict();
export type SessionSendMessageRequest = z.infer<typeof sessionSendMessageRequestSchema>;

export const sessionEventKindSchema = z.enum([
  "session.created",
  "session.system_prompt_configured",
  "session.workspace_attached",
  "session.user_message_submitted",
  "session.runtime_dispatched",
  "session.provider_started",
  "session.response_started",
  "session.agent_message_chunk",
  "session.agent_thought_chunk",
  "session.plan_updated",
  "session.tool_call",
  "session.tool_call_updated",
  "session.usage_updated",
  "session.input_requested",
  "session.input_received",
  "session.approval_requested",
  "session.approval_resolved",
  "session.interrupted",
  "session.resumed",
  "session.handoff_requested",
  "session.handoff_accepted",
  "session.handoff_completed",
  "session.response_completed",
  "session.response_canceled",
  "session.response_failed",
  "session.close_requested",
  "session.closed",
  "session.runtime_lost",
  "session.failed",
]);
export type SessionEventKind = z.infer<typeof sessionEventKindSchema>;

const emptyPayloadSchema = z.object({}).strict();
const shortTextSchema = z.string().min(1).max(SESSION_CHUNK_MAX_LENGTH);
const normalTextSchema = z.string().min(1).max(SESSION_TEXT_MAX_LENGTH);
const optionalReasonSchema = z.object({ reason: normalTextSchema.optional() }).strict();

export const standardExecutionPromptSchema = z.object({
  version: z.string().regex(/^sha256:[a-f0-9]{64}$/u),
  content: normalTextSchema,
}).strict();
export type StandardExecutionPrompt = z.infer<typeof standardExecutionPromptSchema>;

const systemPromptComponentSchema = z.object({
  name: z.enum(["standard", "runtime", "provider", "agent_context", "execution_context"]),
  content: normalTextSchema,
}).strict();

export const effectiveSystemPromptEvidenceSchema = z.object({
  standardPrompt: standardExecutionPromptSchema,
  agentContext: agentContextSnapshotSchema.nullable(),
  components: z.array(systemPromptComponentSchema).min(4).max(5),
  finalPrompt: normalTextSchema,
}).strict().superRefine((value, context) => {
  const expected = value.agentContext
    ? ["standard", "runtime", "provider", "agent_context", "execution_context"]
    : ["standard", "runtime", "provider", "execution_context"];
  const actual = value.components.map((component) => component.name);
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    context.addIssue({ code: "custom", path: ["components"], message: "System Prompt components are out of order" });
  }
  if (value.components[0]?.content !== value.standardPrompt.content) {
    context.addIssue({ code: "custom", path: ["components", 0, "content"], message: "Standard Prompt component does not match evidence" });
  }
  const agentComponent = value.components.find((component) => component.name === "agent_context");
  if (value.agentContext && !agentComponent?.content.includes(promptSafeText(value.agentContext.systemPrompt))) {
    context.addIssue({ code: "custom", path: ["components"], message: "Agent Context component does not contain the frozen snapshot" });
  }
});
export type EffectiveSystemPromptEvidence = z.infer<typeof effectiveSystemPromptEvidenceSchema>;

function promptSafeText(value: string): string {
  return JSON.stringify(value).slice(1, -1)
    .replaceAll("&", "\\u0026")
    .replaceAll("<", "\\u003c")
    .replaceAll(">", "\\u003e");
}

const sessionEventPayloadSchemas = {
  "session.created": z.object({
    runtimeId: z.string().uuid(),
    providerKey: z.string().min(1).max(128),
    agentContext: agentContextSnapshotSchema.nullable(),
    taskId: z.string().uuid(),
    projectId: z.string().uuid().nullable(),
    context: sessionJsonObjectSchema,
  }).strict(),
  "session.system_prompt_configured": effectiveSystemPromptEvidenceSchema,
  "session.workspace_attached": sessionWorkspaceAttachmentSchema,
  "session.user_message_submitted": z.object({
    content: z.array(userMessageContentPartSchema).min(1).max(64),
    inReplyToMessageId: z.string().uuid().optional(),
  }).strict(),
  "session.runtime_dispatched": z.object({
    leaseId: z.string().uuid(),
    runtimeId: z.string().uuid(),
  }).strict(),
  "session.provider_started": z.object({ providerSessionId: z.string().min(1).max(1_024) }).strict(),
  "session.response_started": emptyPayloadSchema,
  "session.agent_message_chunk": z.object({ text: shortTextSchema }).strict(),
  "session.agent_thought_chunk": z.object({ text: shortTextSchema }).strict(),
  "session.plan_updated": z.object({ plan: normalTextSchema }).strict(),
  "session.tool_call": z.object({
    toolCallId: z.string().min(1).max(512),
    name: z.string().min(1).max(256),
    input: sessionJsonObjectSchema,
  }).strict(),
  "session.tool_call_updated": z.object({
    toolCallId: z.string().min(1).max(512),
    status: z.enum(["running", "completed", "failed"]),
    output: sessionJsonValueSchema.optional(),
  }).strict(),
  "session.usage_updated": z.object({
    inputTokens: z.number().int().nonnegative().optional(),
    outputTokens: z.number().int().nonnegative().optional(),
    totalTokens: z.number().int().nonnegative().optional(),
    costUsd: z.number().nonnegative().optional(),
  }).strict(),
  "session.input_requested": z.object({ requestId: z.string().min(1).max(512), prompt: normalTextSchema }).strict(),
  "session.input_received": z.object({ requestId: z.string().min(1).max(512), response: normalTextSchema }).strict(),
  "session.approval_requested": z.object({
    requestId: z.string().min(1).max(512),
    description: normalTextSchema,
  }).strict(),
  "session.approval_resolved": z.object({
    requestId: z.string().min(1).max(512),
    decision: z.enum(["approved", "denied"]),
  }).strict(),
  "session.interrupted": z.object({
    kind: sessionInterruptKindSchema,
    continuationMode: sessionContinuationModeSchema,
    reason: normalTextSchema,
    stopReason: z.string().min(1).max(512).optional(),
  }).strict(),
  "session.resumed": z.object({ continuationMode: sessionContinuationModeSchema }).strict(),
  "session.handoff_requested": optionalReasonSchema,
  "session.handoff_accepted": optionalReasonSchema,
  "session.handoff_completed": optionalReasonSchema,
  "session.response_completed": z.object({
    stopReason: z.string().min(1).max(512),
    summary: normalTextSchema.optional(),
    artifactIds: z.array(z.string().uuid()).max(256).optional(),
  }).strict(),
  "session.response_canceled": optionalReasonSchema,
  "session.response_failed": z.object({ code: z.string().min(1).max(128), message: normalTextSchema }).strict(),
  "session.close_requested": optionalReasonSchema,
  "session.closed": optionalReasonSchema,
  "session.runtime_lost": z.object({ code: z.string().min(1).max(128), message: normalTextSchema }).strict(),
  "session.failed": z.object({ code: z.string().min(1).max(128), message: normalTextSchema }).strict(),
} as const satisfies Record<SessionEventKind, z.ZodType>;

export const sessionEventInputSchema = z.object({
  eventId: z.string().uuid(),
  sessionId: z.string().uuid(),
  sourceId: z.string().min(1).max(512),
  sourceSequence: z.number().int().positive(),
  kind: sessionEventKindSchema,
  version: z.literal(1),
  messageId: z.string().uuid().nullable().optional(),
  payload: sessionJsonObjectSchema,
  metadata: sessionJsonObjectSchema.default({}),
  occurredAt: z.string().datetime(),
}).strict().superRefine((event, ctx) => {
  const parsedPayload = sessionEventPayloadSchemas[event.kind].safeParse(event.payload);
  if (!parsedPayload.success) {
    for (const issue of parsedPayload.error.issues) {
      ctx.addIssue({ ...issue, path: ["payload", ...issue.path] });
    }
  }
  addStructuredValueIssues(event.payload, ctx, SESSION_EVENT_MAX_BYTES);
  addStructuredValueIssues(event.metadata, ctx, SESSION_EVENT_MAX_BYTES);
  if (serializedBytes(event) > SESSION_EVENT_MAX_BYTES) {
    ctx.addIssue({ code: "custom", message: `SessionEvent exceeds ${SESSION_EVENT_MAX_BYTES} bytes` });
  }
});
export type SessionEventInput = z.infer<typeof sessionEventInputSchema>;

export const sessionEventSchema = sessionEventInputSchema.safeExtend({
  globalSequence: z.number().int().positive(),
  acceptedAt: z.string().datetime(),
}).strict();
export type SessionEvent = z.infer<typeof sessionEventSchema>;

export const sessionEventBatchSchema = z.object({
  leaseToken: z.string().min(32).max(4_096),
  events: z.array(sessionEventInputSchema).min(1).max(SESSION_EVENT_BATCH_MAX_COUNT),
}).strict().superRefine((batch, ctx) => {
  if (serializedBytes(batch) > SESSION_EVENT_BATCH_MAX_BYTES) {
    ctx.addIssue({ code: "custom", message: `SessionEvent batch exceeds ${SESSION_EVENT_BATCH_MAX_BYTES} bytes` });
  }
});
export type SessionEventBatch = z.infer<typeof sessionEventBatchSchema>;

export const sessionEventPageQuerySchema = z.object({
  afterSequence: z.coerce.number().int().nonnegative().default(0),
  limit: z.coerce.number().int().positive().max(500).default(100),
  messageId: z.string().uuid().optional(),
}).strict();
export type SessionEventPageQuery = z.infer<typeof sessionEventPageQuerySchema>;

export const sessionEventPageSchema = z.object({
  events: z.array(sessionEventSchema),
  nextAfterSequence: z.number().int().positive().optional(),
  olderCursor: z.number().int().positive().optional(),
}).strict();
export type SessionEventPage = z.infer<typeof sessionEventPageSchema>;

export const taskSessionListQuerySchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().positive().max(50).default(50),
}).strict();
export type TaskSessionListQuery = z.infer<typeof taskSessionListQuerySchema>;

export const taskSessionPageSchema = z.object({
  sessions: z.array(sessionSchema),
  nextCursor: z.string().uuid().optional(),
}).strict();
export type TaskSessionPage = z.infer<typeof taskSessionPageSchema>;

export const taskSessionLaunchInputSchema = z.object({
  sessionId: z.string().uuid(),
  providerKey: z.string().min(1).max(128),
  agentId: z.string().uuid().nullish().transform((value) => value ?? null),
  manualContext: z.object({
    text: z.string().trim().min(1).max(SESSION_TEXT_MAX_LENGTH),
  }).strict().optional(),
}).strict();
export type TaskSessionLaunchInput = z.input<typeof taskSessionLaunchInputSchema>;
export type ParsedTaskSessionLaunchInput = z.output<typeof taskSessionLaunchInputSchema>;

export const taskSessionLaunchResponseSchema = z.discriminatedUnion("state", [
  z.object({
    state: z.literal("preparing"),
    sessionId: z.string().uuid(),
  }).strict(),
  z.object({
    state: z.literal("ready"),
    session: sessionSchema,
    created: z.boolean(),
  }).strict(),
]);
export type TaskSessionLaunchResponse = z.infer<typeof taskSessionLaunchResponseSchema>;

export const sessionResponseSchema = z.object({ session: sessionSchema }).strict();
export type SessionResponse = z.infer<typeof sessionResponseSchema>;

export const sessionEventWindowQuerySchema = z.object({
  latest: z.coerce.number().int().positive().max(200).optional(),
  beforeSequence: z.coerce.number().int().positive().optional(),
  afterSequence: z.coerce.number().int().nonnegative().optional(),
  limit: z.coerce.number().int().positive().max(200).default(100),
}).strict().superRefine((query, ctx) => {
  const modes = [query.latest !== undefined, query.beforeSequence !== undefined, query.afterSequence !== undefined]
    .filter(Boolean).length;
  if (modes > 1) ctx.addIssue({ code: "custom", message: "Event window modes are mutually exclusive" });
}).transform((query) => (
  query.latest === undefined && query.beforeSequence === undefined && query.afterSequence === undefined
    ? { ...query, latest: query.limit }
    : query
));
export type SessionEventWindowQuery = z.infer<typeof sessionEventWindowQuerySchema>;

export const sessionEventWindowSchema = z.object({
  events: z.array(sessionEventSchema),
  olderCursor: z.number().int().positive().optional(),
  nextAfterSequence: z.number().int().positive().optional(),
}).strict();
export type SessionEventWindow = z.infer<typeof sessionEventWindowSchema>;

export const sessionClaimRequestSchema = z.object({
  runnerId: z.string().min(1),
  waitSeconds: z.number().int().min(0).max(25).default(0),
}).strict();
export type SessionClaimRequest = z.infer<typeof sessionClaimRequestSchema>;

export const sessionDispatchLeaseSchema = z.object({
  id: z.string().uuid(),
  sessionId: z.string().uuid(),
  runtimeId: z.string().uuid(),
  runnerId: z.string().min(1),
  leaseToken: z.string().min(32),
  providerSessionId: z.string().min(1).max(1_024).nullable(),
  leaseExpiresAt: z.string().datetime(),
  claimedAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
}).strict();
export type SessionDispatchLease = z.infer<typeof sessionDispatchLeaseSchema>;

export const sessionClaimAssignmentSchema = z.object({
  session: sessionSchema,
  lease: sessionDispatchLeaseSchema,
  systemPrompt: z.string().min(1).max(SESSION_TEXT_MAX_LENGTH),
  workspace: sessionWorkspaceAttachmentSchema,
  message: userMessageInputSchema,
  execution: sessionExecutionCapabilitySchema.optional(),
}).strict();
export type SessionClaimAssignment = z.infer<typeof sessionClaimAssignmentSchema>;

const passiveEventKinds = new Set<SessionEventKind>([
  "session.created",
  "session.system_prompt_configured",
  "session.workspace_attached",
  "session.agent_message_chunk",
  "session.agent_thought_chunk",
  "session.plan_updated",
  "session.tool_call",
  "session.tool_call_updated",
  "session.usage_updated",
  "session.input_requested",
  "session.input_received",
  "session.approval_requested",
  "session.approval_resolved",
  "session.handoff_accepted",
  "session.close_requested",
]);

function requireState(session: Session, allowed: readonly SessionState[], target: SessionState): void {
  if (!allowed.includes(session.state)) {
    throw new Error(`Invalid Session state transition: ${session.state} -> ${target}`);
  }
}

export function applySessionEventProjection(session: Session, event: SessionEventInput): Session {
  if (event.sessionId !== session.id) throw new Error("SessionEvent belongs to another Session");
  if (passiveEventKinds.has(event.kind)) {
    if (["session.created", "session.system_prompt_configured", "session.workspace_attached"].includes(event.kind)) {
      requireState(session, ["queued"], session.state);
    } else if ([
      "session.agent_message_chunk", "session.agent_thought_chunk", "session.plan_updated",
      "session.tool_call", "session.tool_call_updated", "session.usage_updated",
      "session.input_requested", "session.approval_requested",
    ].includes(event.kind)) {
      requireState(session, ["running"], session.state);
    } else if (["session.input_received", "session.approval_resolved"].includes(event.kind)) {
      requireState(session, ["interrupted"], session.state);
    } else if (event.kind === "session.handoff_accepted") {
      requireState(session, ["waiting_for_handoff"], session.state);
    } else if (event.kind === "session.close_requested" && isTerminalSessionState(session.state)) {
      requireState(session, [], session.state);
    }
    return { ...session, updatedAt: event.occurredAt };
  }

  switch (event.kind) {
    case "session.user_message_submitted": {
      const continuationAllowed = session.state === "interrupted" && session.continuationMode === "new_message";
      if (session.state !== "queued" && session.state !== "ready" && !continuationAllowed) {
        throw new Error(`Invalid Session state transition: ${session.state} -> message_pending`);
      }
      if (!event.messageId) throw new Error("User message event requires messageId");
      return {
        ...session,
        state: session.state === "queued" ? "queued" : "message_pending",
        activeMessageId: event.messageId,
        interruptKind: null,
        continuationMode: null,
        updatedAt: event.occurredAt,
      };
    }
    case "session.runtime_dispatched":
      requireState(session, ["queued", "message_pending"], "dispatched");
      return { ...session, state: "dispatched", updatedAt: event.occurredAt };
    case "session.provider_started":
      requireState(session, ["dispatched"], "message_pending");
      return { ...session, state: "message_pending", updatedAt: event.occurredAt };
    case "session.response_started":
      requireState(session, ["dispatched", "message_pending", "interrupted"], "running");
      if (!event.messageId || event.messageId !== session.activeMessageId) {
        throw new Error("Response event does not match activeMessageId");
      }
      return { ...session, state: "running", interruptKind: null, continuationMode: null, updatedAt: event.occurredAt };
    case "session.interrupted": {
      requireState(session, ["running"], "interrupted");
      const payload = sessionEventPayloadSchemas["session.interrupted"].parse(event.payload);
      return {
        ...session,
        state: "interrupted",
        interruptKind: payload.kind,
        continuationMode: payload.continuationMode,
        updatedAt: event.occurredAt,
      };
    }
    case "session.resumed": {
      requireState(session, ["interrupted"], "running");
      const payload = sessionEventPayloadSchemas["session.resumed"].parse(event.payload);
      const state = payload.continuationMode === "resume_message" ? "running" : "message_pending";
      return { ...session, state, interruptKind: null, continuationMode: null, updatedAt: event.occurredAt };
    }
    case "session.handoff_requested":
      requireState(session, ["running", "interrupted"], "waiting_for_handoff");
      return { ...session, state: "waiting_for_handoff", updatedAt: event.occurredAt };
    case "session.handoff_completed":
      requireState(session, ["waiting_for_handoff"], "ready");
      return {
        ...session,
        state: "ready",
        lastMessageId: session.activeMessageId,
        activeMessageId: null,
        updatedAt: event.occurredAt,
      };
    case "session.response_completed":
    case "session.response_canceled":
      requireState(session, ["running", "interrupted", "waiting_for_handoff"], "ready");
      if (!event.messageId || event.messageId !== session.activeMessageId) {
        throw new Error("Response event does not match activeMessageId");
      }
      return {
        ...session,
        state: "ready",
        lastMessageId: event.messageId,
        activeMessageId: null,
        interruptKind: null,
        continuationMode: null,
        failureCode: null,
        updatedAt: event.occurredAt,
      };
    case "session.response_failed":
    case "session.runtime_lost":
    case "session.failed": {
      if (isTerminalSessionState(session.state)) {
        requireState(session, [], "failed");
      }
      const payload = (event.payload as { code?: unknown });
      return {
        ...session,
        state: "failed",
        activeMessageId: null,
        interruptKind: null,
        continuationMode: null,
        failureCode: typeof payload.code === "string" ? payload.code : "session_failed",
        updatedAt: event.occurredAt,
      };
    }
    case "session.closed":
      if (isTerminalSessionState(session.state)) requireState(session, [], "closed");
      return {
        ...session,
        state: "closed",
        activeMessageId: null,
        interruptKind: null,
        continuationMode: null,
        updatedAt: event.occurredAt,
      };
  }
  throw new Error(`Unsupported SessionEvent kind: ${event.kind}`);
}
