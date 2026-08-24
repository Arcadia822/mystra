import { NextResponse } from "next/server";
import {
  agentArchiveRequestSchema,
  agentCreateRequestSchema,
  agentListQuerySchema,
  agentPageSchema,
  agentResponseSchema,
  agentUpdateRequestSchema,
  manualTaskCreateRequestSchema,
  taskCreateResponseSchema,
  taskDetailResponseSchema,
  taskListResponseSchema,
  taskDescriptionSchema,
  taskTitleSchema,
  taskStartRequestSchema,
  taskStartResultSchema,
  skillListQuerySchema,
  skillRevisionListQuerySchema,
} from "@mystra/shared";
import { z } from "zod";

import { getDb } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";
import { createTaskService } from "@/lib/tasks/task-service-factory";
import { createTaskProductionService } from "@/lib/tasks/task-production-service-factory";
import { SkillFailure } from "@/lib/skills/skill-errors";
import { createSkillServices } from "@/lib/skills/skill-service-factory";
import { requireHumanSession, requireTeamPermission } from "../_auth";

const jsonRpcRequestSchema = z.object({
  jsonrpc: z.literal("2.0").optional(),
  id: z.union([z.string(), z.number(), z.null()]).optional(),
  method: z.string(),
  params: z.unknown().optional(),
}).strict();

const toolCallSchema = z.object({
  name: z.string(),
  arguments: z.record(z.string(), z.unknown()).default({}),
}).strict();

function jsonRpc(id: string | number | null | undefined, result: unknown) {
  return NextResponse.json({ jsonrpc: "2.0", id: id ?? null, result });
}

function jsonRpcError(
  id: string | number | null | undefined,
  code: number,
  message: string,
  data?: Record<string, unknown>,
) {
  return NextResponse.json({
    jsonrpc: "2.0",
    id: id ?? null,
    error: { code, message, ...(data ? { data } : {}) },
  });
}

function textToolResult(payload: unknown) {
  return { content: [{ type: "text", text: JSON.stringify(payload, null, 2) }] };
}

function mcpAuthorizationErrorCode(error: unknown): "unauthenticated" | "password-change-required" | "forbidden" | undefined {
  if (!error || typeof error !== "object" || !("code" in error)) return undefined;
  const code = error.code;
  return code === "unauthenticated" || code === "password-change-required" || code === "forbidden"
    ? code
    : undefined;
}

function parseArguments<T extends z.ZodType>(
  id: string | number | null | undefined,
  tool: string,
  schema: T,
  value: unknown,
): { ok: true; data: z.infer<T> } | { ok: false; response: NextResponse } {
  const parsed = schema.safeParse(value);
  if (parsed.success) return { ok: true, data: parsed.data };
  return {
    ok: false,
    response: jsonRpcError(id, -32602, "Invalid params", { tool, issues: parsed.error.issues }),
  };
}

const idArgumentSchema = z.object({ id: z.string().uuid() }).strict();
const agentUpdateToolSchema = agentUpdateRequestSchema.extend({ id: z.string().uuid() }).strict();
const agentArchiveToolSchema = agentArchiveRequestSchema.extend({ id: z.string().uuid() }).strict();
const taskUpdateToolSchema = z.object({
  id: z.string().uuid(),
  title: taskTitleSchema.optional(),
  description: taskDescriptionSchema.optional(),
}).strict().refine((value) => value.title !== undefined || value.description !== undefined, {
  message: "At least one of title or description is required",
});
const taskStartToolSchema = taskStartRequestSchema.extend({ taskId: z.string().uuid() }).strict();
const skillIdArgumentSchema = z.object({ skillId: z.string().uuid() }).strict();
const skillRevisionArgumentSchema = skillIdArgumentSchema.extend({
  revisionId: z.string().trim().min(1).max(128),
}).strict();
const skillRevisionListToolSchema = skillRevisionListQuerySchema.extend({ skillId: z.string().uuid() }).strict();
const skillPreviewToolSchema = skillRevisionArgumentSchema.extend({
  path: z.string().trim().min(1).max(1_024),
}).strict();
const skillArchiveToolSchema = skillIdArgumentSchema.extend({
  expectedRevision: z.number().int().positive(),
}).strict();

const tools = [
  {
    name: "mystra_create_agent",
    description: "Create a Team-owned Agent with a system prompt.",
    inputSchema: {
      type: "object",
      required: ["name", "systemPrompt"],
      properties: {
        name: { type: "string", minLength: 1, maxLength: 120 },
        systemPrompt: { type: "string", minLength: 1, maxLength: 32768 },
      },
      additionalProperties: false,
    },
  },
  {
    name: "mystra_list_agents",
    description: "List Agents in the active Team.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "integer", minimum: 1, maximum: 100 },
        cursor: { type: "string", format: "uuid" },
        includeArchived: { type: "boolean" },
      },
      additionalProperties: false,
    },
  },
  { name: "mystra_get_agent", description: "Inspect one Agent, including archived records.", inputSchema: { type: "object", required: ["id"], properties: { id: { type: "string", format: "uuid" } }, additionalProperties: false } },
  {
    name: "mystra_update_agent",
    description: "Rename an active Agent or update its system prompt with revision protection.",
    inputSchema: {
      type: "object",
      required: ["id", "expectedRevision"],
      properties: {
        id: { type: "string", format: "uuid" },
        expectedRevision: { type: "integer", minimum: 1 },
        name: { type: "string", minLength: 1, maxLength: 120 },
        systemPrompt: { type: "string", minLength: 1, maxLength: 32768 },
      },
      additionalProperties: false,
    },
  },
  {
    name: "mystra_archive_agent",
    description: "Archive an Agent with revision protection.",
    inputSchema: {
      type: "object",
      required: ["id", "expectedRevision"],
      properties: {
        id: { type: "string", format: "uuid" },
        expectedRevision: { type: "integer", minimum: 1 },
      },
      additionalProperties: false,
    },
  },
  {
    name: "mystra_create_task",
    description: "Create a durable Task context in the active Team.",
    inputSchema: {
      type: "object",
      required: ["title", "idempotencyKey"],
      properties: {
        title: { type: "string", minLength: 1, maxLength: 500 },
        description: { type: ["string", "null"], maxLength: 100000 },
        projectId: { type: "string", format: "uuid" },
        idempotencyKey: { type: "string", format: "uuid" },
      },
      additionalProperties: false,
    },
  },
  { name: "mystra_list_tasks", description: "List durable Task records.", inputSchema: { type: "object", properties: {}, additionalProperties: false } },
  { name: "mystra_get_task", description: "Inspect one durable Task record.", inputSchema: { type: "object", required: ["id"], properties: { id: { type: "string", format: "uuid" } }, additionalProperties: false } },
  { name: "mystra_update_task", description: "Update Task-owned title or description.", inputSchema: { type: "object", required: ["id"], properties: { id: { type: "string", format: "uuid" }, title: { type: "string", minLength: 1, maxLength: 500 }, description: { type: ["string", "null"], maxLength: 100000 } }, additionalProperties: false } },
  {
    name: "mystra_start_task_production",
    description: "Start Task production with the Standard Execution Prompt and optional Agent Context.",
    inputSchema: {
      type: "object",
      required: ["taskId", "runtimeId", "providerKey", "expectedRevision", "idempotencyKey"],
      properties: {
        taskId: { type: "string", format: "uuid" },
        runtimeId: { type: "string", format: "uuid" },
        providerKey: { type: "string", minLength: 1, maxLength: 128 },
        agentId: { type: ["string", "null"], format: "uuid" },
        expectedRevision: { type: "integer", minimum: 1 },
        idempotencyKey: { type: "string", minLength: 1, maxLength: 200 },
      },
      additionalProperties: false,
    },
  },
  {
    name: "skills_list",
    description: "List Skills in the active Team. Binary create/publish/download use the canonical HTTP API or `mystra skills upload|publish|download` CLI commands.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "integer", minimum: 1, maximum: 100 },
        cursor: { type: ["string", "null"] },
        query: { type: ["string", "null"], maxLength: 500 },
        includeArchived: { type: "boolean" },
      },
      additionalProperties: false,
    },
  },
  { name: "skill_get", description: "Get one Skill from the active Team.", inputSchema: { type: "object", required: ["skillId"], properties: { skillId: { type: "string", format: "uuid" } }, additionalProperties: false } },
  { name: "skill_revisions_list", description: "List immutable Revisions for one Skill.", inputSchema: { type: "object", required: ["skillId"], properties: { skillId: { type: "string", format: "uuid" }, limit: { type: "integer", minimum: 1, maximum: 100 }, cursor: { type: ["string", "null"] } }, additionalProperties: false } },
  { name: "skill_revision_get", description: "Get one immutable Skill Revision by id or sequence.", inputSchema: { type: "object", required: ["skillId", "revisionId"], properties: { skillId: { type: "string", format: "uuid" }, revisionId: { type: "string", minLength: 1, maxLength: 128 } }, additionalProperties: false } },
  { name: "skill_file_preview", description: "Preview one exact text file from an immutable Skill Revision.", inputSchema: { type: "object", required: ["skillId", "revisionId", "path"], properties: { skillId: { type: "string", format: "uuid" }, revisionId: { type: "string", minLength: 1, maxLength: 128 }, path: { type: "string", minLength: 1, maxLength: 1024 } }, additionalProperties: false } },
  { name: "skill_archive", description: "Archive one active Skill with resource-revision protection. Archive does not delete immutable ZIP objects.", inputSchema: { type: "object", required: ["skillId", "expectedRevision"], properties: { skillId: { type: "string", format: "uuid" }, expectedRevision: { type: "integer", minimum: 1 } }, additionalProperties: false } },
  { name: "mystra_health", description: "Report local control-plane database health.", inputSchema: { type: "object", properties: {}, additionalProperties: false } },
] as const;

export async function POST(request: Request) {
  let rpcPayload: unknown;
  try {
    rpcPayload = await request.json();
  } catch {
    return jsonRpcError(null, -32700, "Parse error");
  }
  const rpcResult = jsonRpcRequestSchema.safeParse(rpcPayload);
  if (!rpcResult.success) {
    return jsonRpcError(null, -32600, "Invalid Request", { issues: rpcResult.error.issues });
  }
  const rpc = rpcResult.data;
  if (!/^Bearer\s+[A-Za-z0-9_-]{16,}$/i.test(request.headers.get("authorization") ?? "")) {
    return jsonRpcError(rpc.id, -32001, "Unauthenticated");
  }
  let db;
  let active;
  let actorId: string;
  try {
    db = await getDb();
    const subject = await requireHumanSession(db, request, "mcp");
    actorId = subject.user.id;
    active = await requireTeamPermission(db, subject, "team.resource.access");
  } catch (error) {
    const code = mcpAuthorizationErrorCode(error);
    if (code === "unauthenticated") {
      return jsonRpcError(rpc.id, -32001, "Unauthenticated");
    }
    if (code === "password-change-required") {
      return jsonRpcError(rpc.id, -32002, "Password change required");
    }
    if (code === "forbidden") {
      return jsonRpcError(rpc.id, -32003, "Forbidden");
    }
    return jsonRpcError(rpc.id, -32603, "Internal error");
  }
  if (rpc.method === "initialize") {
    return jsonRpc(rpc.id, {
      protocolVersion: "2025-06-18",
      serverInfo: { name: "mystra-local", version: "0.0.0" },
      capabilities: { tools: {} },
    });
  }
  if (rpc.method === "tools/list") {
    return jsonRpc(rpc.id, { tools });
  }
  if (rpc.method !== "tools/call") {
    return jsonRpcError(rpc.id, -32601, `Unknown method: ${rpc.method}`);
  }
  const callResult = toolCallSchema.safeParse(rpc.params);
  if (!callResult.success) {
    return jsonRpcError(rpc.id, -32600, "Invalid Request", { issues: callResult.error.issues });
  }
  const call = callResult.data;
  try {
    if (call.name === "mystra_create_agent") {
      requirePermission(active, "team.settings.manage");
      const parsed = parseArguments(rpc.id, call.name, agentCreateRequestSchema, call.arguments);
      if (!parsed.ok) return parsed.response;
      return jsonRpc(rpc.id, textToolResult(agentResponseSchema.parse({
        agent: await db.createAgent({ ...parsed.data, teamId: active.team.id }),
      })));
    }
    if (call.name === "mystra_list_agents") {
      const parsed = parseArguments(rpc.id, call.name, agentListQuerySchema, call.arguments);
      if (!parsed.ok) return parsed.response;
      return jsonRpc(rpc.id, textToolResult(agentPageSchema.parse(await db.listAgents({
        teamId: active.team.id,
        limit: parsed.data.limit,
        includeArchived: parsed.data.includeArchived,
        ...(parsed.data.cursor ? { cursor: parsed.data.cursor } : {}),
      }))));
    }
    if (call.name === "mystra_get_agent") {
      const parsed = parseArguments(rpc.id, call.name, idArgumentSchema, call.arguments);
      if (!parsed.ok) return parsed.response;
      const agent = await db.getAgent(parsed.data.id, { teamId: active.team.id });
      return jsonRpc(rpc.id, textToolResult(agent
        ? agentResponseSchema.parse({ agent })
        : { error: { code: "AGENT_NOT_FOUND", message: `Agent not found: ${parsed.data.id}` } }));
    }
    if (call.name === "mystra_update_agent") {
      requirePermission(active, "team.settings.manage");
      const parsed = parseArguments(rpc.id, call.name, agentUpdateToolSchema, call.arguments);
      if (!parsed.ok) return parsed.response;
      const { id, ...input } = parsed.data;
      const agent = await db.updateAgent(id, { ...input, teamId: active.team.id });
      return jsonRpc(rpc.id, textToolResult(agent
        ? agentResponseSchema.parse({ agent })
        : { error: { code: "AGENT_NOT_FOUND", message: `Agent not found: ${id}` } }));
    }
    if (call.name === "mystra_archive_agent") {
      requirePermission(active, "team.settings.manage");
      const parsed = parseArguments(rpc.id, call.name, agentArchiveToolSchema, call.arguments);
      if (!parsed.ok) return parsed.response;
      const agent = await db.archiveAgent(parsed.data.id, {
        teamId: active.team.id,
        expectedRevision: parsed.data.expectedRevision,
      });
      return jsonRpc(rpc.id, textToolResult(agent
        ? agentResponseSchema.parse({ agent })
        : { error: { code: "AGENT_NOT_FOUND", message: `Agent not found: ${parsed.data.id}` } }));
    }
    if (call.name === "mystra_create_task") {
      const parsed = parseArguments(
        rpc.id,
        call.name,
        manualTaskCreateRequestSchema,
        call.arguments,
      );
      if (!parsed.ok) return parsed.response;
      return jsonRpc(rpc.id, textToolResult(taskCreateResponseSchema.parse(
        await db.createTask({ ...parsed.data, teamId: active.team.id }),
      )));
    }
    if (call.name === "mystra_list_tasks") {
      return jsonRpc(rpc.id, textToolResult(taskListResponseSchema.parse({
        tasks: await db.listTasks({ teamId: active.team.id }),
      })));
    }
    if (call.name === "mystra_get_task") {
      const parsed = parseArguments(rpc.id, call.name, idArgumentSchema, call.arguments);
      if (!parsed.ok) return parsed.response;
      const task = await db.getTask(parsed.data.id, { teamId: active.team.id });
      return jsonRpc(rpc.id, textToolResult(task
        ? taskDetailResponseSchema.parse({
          task,
          ...(task.issue ? { issueResolution: await (await createTaskService(db)).resolveIssue(task) } : {}),
        })
        : { error: { code: "TASK_NOT_FOUND", message: `Task not found: ${parsed.data.id}` } }));
    }
    if (call.name === "mystra_update_task") {
      const parsed = parseArguments(rpc.id, call.name, taskUpdateToolSchema, call.arguments);
      if (!parsed.ok) return parsed.response;
      const { id, ...input } = parsed.data;
      const task = await db.updateTask(id, input, { teamId: active.team.id });
      return jsonRpc(rpc.id, textToolResult(task
        ? { task }
        : { error: { code: "TASK_NOT_FOUND", message: `Task not found: ${id}` } }));
    }
    if (call.name === "mystra_start_task_production") {
      const parsed = parseArguments(rpc.id, call.name, taskStartToolSchema, call.arguments);
      if (!parsed.ok) return parsed.response;
      const { taskId, ...request } = parsed.data;
      const result = await createTaskProductionService(db).start({
        actor: { actorId, teamId: active.team.id },
        taskId,
        request,
      });
      return jsonRpc(rpc.id, textToolResult(taskStartResultSchema.parse(result)));
    }
    if (call.name === "skills_list") {
      const parsed = parseArguments(rpc.id, call.name, skillListQuerySchema, call.arguments);
      if (!parsed.ok) return parsed.response;
      const services = await createSkillServices(db);
      return jsonRpc(rpc.id, textToolResult(await services.query.list({ teamId: active.team.id, ...parsed.data })));
    }
    if (call.name === "skill_get") {
      const parsed = parseArguments(rpc.id, call.name, skillIdArgumentSchema, call.arguments);
      if (!parsed.ok) return parsed.response;
      const services = await createSkillServices(db);
      return jsonRpc(rpc.id, textToolResult(await services.query.get({ teamId: active.team.id, skillId: parsed.data.skillId })));
    }
    if (call.name === "skill_revisions_list") {
      const parsed = parseArguments(rpc.id, call.name, skillRevisionListToolSchema, call.arguments);
      if (!parsed.ok) return parsed.response;
      const { skillId, ...query } = parsed.data;
      const services = await createSkillServices(db);
      return jsonRpc(rpc.id, textToolResult(await services.query.listRevisions({ teamId: active.team.id, skillId, ...query })));
    }
    if (call.name === "skill_revision_get") {
      const parsed = parseArguments(rpc.id, call.name, skillRevisionArgumentSchema, call.arguments);
      if (!parsed.ok) return parsed.response;
      const services = await createSkillServices(db);
      return jsonRpc(rpc.id, textToolResult(await services.query.getRevision({ teamId: active.team.id, skillId: parsed.data.skillId, revisionId: parsed.data.revisionId })));
    }
    if (call.name === "skill_file_preview") {
      const parsed = parseArguments(rpc.id, call.name, skillPreviewToolSchema, call.arguments);
      if (!parsed.ok) return parsed.response;
      const services = await createSkillServices(db);
      return jsonRpc(rpc.id, textToolResult(await services.preview.preview({ teamId: active.team.id, ...parsed.data })));
    }
    if (call.name === "skill_archive") {
      requirePermission(active, "team.skill.manage");
      const parsed = parseArguments(rpc.id, call.name, skillArchiveToolSchema, call.arguments);
      if (!parsed.ok) return parsed.response;
      const services = await createSkillServices(db);
      await services.publication.archive({
        teamId: active.team.id,
        skillId: parsed.data.skillId,
        expectedResourceRevision: parsed.data.expectedRevision,
        archivedByUserId: actorId,
      });
      return jsonRpc(rpc.id, textToolResult(await services.query.get({
        teamId: active.team.id,
        skillId: parsed.data.skillId,
      })));
    }
    if (call.name === "mystra_health") {
      const tasks = await db.listTasks({ teamId: active.team.id });
      return jsonRpc(rpc.id, textToolResult({
        checkedAt: new Date().toISOString(),
        controlPlane: { status: "healthy" },
        tasks: { total: tasks.length },
        temporarilyUnavailable: ["sessions", "runners", "contextBundles"],
      }));
    }
    return jsonRpcError(rpc.id, -32601, `Unknown tool: ${call.name}`, { tool: call.name });
  } catch (error) {
    const authorizationCode = mcpAuthorizationErrorCode(error);
    if (authorizationCode === "forbidden") {
      return jsonRpcError(rpc.id, -32003, "Forbidden", { tool: call.name });
    }
    const agentCode = agentDomainErrorCode(error);
    if (agentCode) {
      const message = error instanceof Error ? error.message : agentCode;
      return jsonRpc(rpc.id, textToolResult({ error: { code: agentCode, message } }));
    }
    const productionCode = taskProductionDomainErrorCode(error);
    if (productionCode) {
      const message = error instanceof Error ? error.message : productionCode;
      return jsonRpc(rpc.id, textToolResult({ error: { code: productionCode, message } }));
    }
    if (error instanceof SkillFailure) {
      return jsonRpc(rpc.id, textToolResult({ error: { code: error.code, message: error.message, ...(error.details ? { details: error.details } : {}) } }));
    }
    return jsonRpcError(rpc.id, -32603, "Internal error", { tool: call.name });
  }
}

function taskProductionDomainErrorCode(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error)) return undefined;
  const code = String(error.code);
  return [
    "task_not_found", "task_not_eligible", "agent_unavailable", "runtime_unavailable",
    "task_status_conflict", "invalid_request",
  ].includes(code) ? code : undefined;
}

function agentDomainErrorCode(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error)) return undefined;
  return ["AGENT_ARCHIVED", "AGENT_REVISION_CONFLICT"].includes(String(error.code))
    ? String(error.code) as "AGENT_ARCHIVED" | "AGENT_REVISION_CONFLICT"
    : undefined;
}
