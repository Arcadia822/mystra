import { z } from "zod";

import { providerNameSchema } from "./schemas.js";

export const AGENT_SYSTEM_PROMPT_MAX_LENGTH = 32_768;
export const AGENT_LIST_DEFAULT_LIMIT = 50;
export const AGENT_LIST_MAX_LIMIT = 100;

export const agentStatusSchema = z.enum(["active", "archived"]);
export type AgentStatus = z.infer<typeof agentStatusSchema>;

export const agentDisplayNameSchema = z.string().trim().min(1).max(120);
export const agentSystemPromptSchema = z
  .string()
  .max(AGENT_SYSTEM_PROMPT_MAX_LENGTH)
  .refine((value) => value.trim().length > 0, "System prompt must contain non-whitespace text");

export const agentSchema = z.object({
  id: z.string().uuid(),
  teamId: z.string().uuid(),
  name: agentDisplayNameSchema,
  systemPrompt: agentSystemPromptSchema,
  revision: z.number().int().positive(),
  status: agentStatusSchema,
  archivedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
}).strict();
export type Agent = z.infer<typeof agentSchema>;

export const agentCreateRequestSchema = z.object({
  name: agentDisplayNameSchema,
  systemPrompt: agentSystemPromptSchema,
}).strict();
export type AgentCreateRequest = z.input<typeof agentCreateRequestSchema>;

export const agentCreateSchema = agentCreateRequestSchema.extend({
  teamId: z.string().uuid(),
}).strict();
export type AgentCreate = z.infer<typeof agentCreateSchema>;

export const agentUpdateRequestSchema = z.object({
  expectedRevision: z.number().int().positive(),
  name: agentDisplayNameSchema.optional(),
  systemPrompt: agentSystemPromptSchema.optional(),
}).strict().refine(
  (input) => input.name !== undefined || input.systemPrompt !== undefined,
  { message: "Agent update must include name or systemPrompt" },
);
export type AgentUpdateRequest = z.infer<typeof agentUpdateRequestSchema>;

export const agentArchiveRequestSchema = z.object({
  expectedRevision: z.number().int().positive(),
}).strict();
export type AgentArchiveRequest = z.infer<typeof agentArchiveRequestSchema>;

const queryBooleanSchema = z.preprocess((value) => {
  if (value === "true") return true;
  if (value === "false" || value === undefined) return false;
  return value;
}, z.boolean());

export const agentListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(AGENT_LIST_MAX_LIMIT).default(AGENT_LIST_DEFAULT_LIMIT),
  cursor: z.string().uuid().optional(),
  includeArchived: queryBooleanSchema.default(false),
}).strict();
export type AgentListQuery = z.infer<typeof agentListQuerySchema>;

export const agentPageSchema = z.object({
  agents: z.array(agentSchema),
  nextCursor: z.string().uuid().nullable(),
}).strict();
export type AgentPage = z.infer<typeof agentPageSchema>;

export const agentResponseSchema = z.object({ agent: agentSchema }).strict();
export type AgentResponse = z.infer<typeof agentResponseSchema>;

export const resolvedAgentSnapshotSchema = z.object({
  agentId: z.string().uuid(),
  revision: z.number().int().positive(),
  systemPrompt: agentSystemPromptSchema,
}).strict();
export type ResolvedAgentSnapshot = z.infer<typeof resolvedAgentSnapshotSchema>;

export const sessionExecutionSelectionSchema = z.object({
  runtimeId: z.string().uuid(),
  provider: providerNameSchema,
  agentId: z.string().uuid(),
  contextId: z.string().uuid(),
}).strict();
export type SessionExecutionSelection = z.infer<typeof sessionExecutionSelectionSchema>;

export const sessionOptionalBusinessReferencesSchema = z.object({
  projectId: z.string().uuid().optional(),
  taskId: z.string().uuid().optional(),
}).strict();
export type SessionOptionalBusinessReferences = z.infer<typeof sessionOptionalBusinessReferencesSchema>;
