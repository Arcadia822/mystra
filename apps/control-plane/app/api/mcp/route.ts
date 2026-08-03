import { NextResponse } from "next/server";
import {
  cancelSessionResponseSchema,
  coordinationSessionSummaryPayloadSchema,
  runnerDetailResponseSchema,
  runnerListResponseSchema,
  sessionCancellationRequestSchema,
  sessionCreateRequestSchema,
  sessionCreateResponseSchema,
  sessionDetailResponseSchema,
  sessionListResponseSchema,
  taskCreateRequestSchema,
  taskCreateResponseSchema,
  taskDetailResponseSchema,
  taskListResponseSchema,
} from "@mystra/shared";
import { z } from "zod";

import { getDb } from "@/lib/db";

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
const taskIdArgumentSchema = z.object({ taskId: z.string().uuid() }).strict();
const sessionIdArgumentSchema = z.object({ sessionId: z.string().uuid() }).strict();
const createSessionArgumentsSchema = sessionCreateRequestSchema.extend({ taskId: z.string().uuid() }).strict();
const cancelSessionArgumentsSchema = sessionCancellationRequestSchema.extend({ sessionId: z.string().uuid() }).strict();

const tools = [
  {
    name: "mystra_create_task",
    description: "Create an empty Mystra Task.",
    inputSchema: {
      type: "object",
      required: ["projectId", "source", "objective"],
      properties: {
        projectId: { type: "string", format: "uuid" },
        source: { type: "string", enum: ["api", "mcp"] },
        objective: { type: "string" },
        metadata: { type: "object" },
      },
      additionalProperties: false,
    },
  },
  { name: "mystra_list_tasks", description: "List Task projections.", inputSchema: { type: "object", properties: {}, additionalProperties: false } },
  { name: "mystra_get_task", description: "Inspect a Task and its Session summary.", inputSchema: { type: "object", required: ["id"], properties: { id: { type: "string", format: "uuid" } }, additionalProperties: false } },
  {
    name: "mystra_create_session",
    description: "Create an explicit child Session for a Task.",
    inputSchema: {
      type: "object",
      required: ["taskId", "title", "objective"],
      properties: {
        taskId: { type: "string", format: "uuid" },
        title: { type: "string" },
        objective: { type: "string" },
        agent: { type: "string", enum: ["codex", "copilot"] },
        branch: { type: "string" },
        runtime: { type: "object" },
        metadata: { type: "object" },
      },
      additionalProperties: false,
    },
  },
  { name: "mystra_list_sessions", description: "List Sessions for a Task.", inputSchema: { type: "object", required: ["taskId"], properties: { taskId: { type: "string", format: "uuid" } }, additionalProperties: false } },
  { name: "mystra_get_session", description: "Inspect one Session.", inputSchema: { type: "object", required: ["sessionId"], properties: { sessionId: { type: "string", format: "uuid" } }, additionalProperties: false } },
  { name: "mystra_cancel_session", description: "Cancel or request cancellation for one Session.", inputSchema: { type: "object", required: ["sessionId"], properties: { sessionId: { type: "string", format: "uuid" }, reason: { type: "string" }, requestedBy: { type: "string" } }, additionalProperties: false } },
  { name: "mystra_get_session_summary", description: "Get the compact coordination summary for one Session.", inputSchema: { type: "object", required: ["sessionId"], properties: { sessionId: { type: "string", format: "uuid" } }, additionalProperties: false } },
  { name: "mystra_list_runners", description: "List stable Mystra Runners.", inputSchema: { type: "object", properties: {}, additionalProperties: false } },
  { name: "mystra_get_runner", description: "Inspect one stable Mystra Runner.", inputSchema: { type: "object", required: ["id"], properties: { id: { type: "string", format: "uuid" } }, additionalProperties: false } },
  { name: "mystra_health", description: "Report local control-plane and Runner health.", inputSchema: { type: "object", properties: {}, additionalProperties: false } },
] as const;

export async function POST(request: Request) {
  const rpcResult = jsonRpcRequestSchema.safeParse(await request.json());
  if (!rpcResult.success) {
    return jsonRpcError(null, -32600, "Invalid Request", { issues: rpcResult.error.issues });
  }
  const rpc = rpcResult.data;
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
  const db = getDb();
  try {
    if (call.name === "mystra_create_task") {
      const parsed = parseArguments(rpc.id, call.name, taskCreateRequestSchema, call.arguments);
      if (!parsed.ok) return parsed.response;
      return jsonRpc(rpc.id, textToolResult(taskCreateResponseSchema.parse({ task: db.createTask(parsed.data) })));
    }
    if (call.name === "mystra_list_tasks") {
      return jsonRpc(rpc.id, textToolResult(taskListResponseSchema.parse({ tasks: db.listTasks() })));
    }
    if (call.name === "mystra_get_task") {
      const parsed = parseArguments(rpc.id, call.name, idArgumentSchema, call.arguments);
      if (!parsed.ok) return parsed.response;
      const task = db.getTask(parsed.data.id);
      const sessionSummary = db.getTaskSessionSummary(parsed.data.id);
      return jsonRpc(rpc.id, textToolResult(task && sessionSummary
        ? taskDetailResponseSchema.parse({ task, sessionSummary })
        : { error: { code: "TASK_NOT_FOUND", message: `Task not found: ${parsed.data.id}` } }));
    }
    if (call.name === "mystra_create_session") {
      const parsed = parseArguments(rpc.id, call.name, createSessionArgumentsSchema, call.arguments);
      if (!parsed.ok) return parsed.response;
      const { taskId, ...input } = parsed.data;
      return jsonRpc(rpc.id, textToolResult(sessionCreateResponseSchema.parse({ session: db.createSession(taskId, input) })));
    }
    if (call.name === "mystra_list_sessions") {
      const parsed = parseArguments(rpc.id, call.name, taskIdArgumentSchema, call.arguments);
      if (!parsed.ok) return parsed.response;
      return jsonRpc(rpc.id, textToolResult(sessionListResponseSchema.parse({ taskId: parsed.data.taskId, sessions: db.listSessions(parsed.data.taskId) })));
    }
    if (call.name === "mystra_get_session") {
      const parsed = parseArguments(rpc.id, call.name, sessionIdArgumentSchema, call.arguments);
      if (!parsed.ok) return parsed.response;
      const session = db.getSession(parsed.data.sessionId);
      const task = session ? db.getTask(session.taskId) : undefined;
      return jsonRpc(rpc.id, textToolResult(session && task
        ? sessionDetailResponseSchema.parse({ session, task })
        : { error: { code: "SESSION_NOT_FOUND", message: `Session not found: ${parsed.data.sessionId}` } }));
    }
    if (call.name === "mystra_cancel_session") {
      const parsed = parseArguments(rpc.id, call.name, cancelSessionArgumentsSchema, call.arguments);
      if (!parsed.ok) return parsed.response;
      const { sessionId, ...input } = parsed.data;
      return jsonRpc(rpc.id, textToolResult(cancelSessionResponseSchema.parse(db.cancelSession(sessionId, input))));
    }
    if (call.name === "mystra_get_session_summary") {
      const parsed = parseArguments(rpc.id, call.name, sessionIdArgumentSchema, call.arguments);
      if (!parsed.ok) return parsed.response;
      const summary = db.getSessionSummary(parsed.data.sessionId);
      return jsonRpc(rpc.id, textToolResult(summary
        ? coordinationSessionSummaryPayloadSchema.parse({ summary })
        : { error: { code: "SESSION_NOT_FOUND", message: `Session not found: ${parsed.data.sessionId}` } }));
    }
    if (call.name === "mystra_list_runners") {
      return jsonRpc(rpc.id, textToolResult(runnerListResponseSchema.parse({ runners: db.listRunners() })));
    }
    if (call.name === "mystra_get_runner") {
      const parsed = parseArguments(rpc.id, call.name, idArgumentSchema, call.arguments);
      if (!parsed.ok) return parsed.response;
      const runner = db.getRunner(parsed.data.id);
      return jsonRpc(rpc.id, textToolResult(runner
        ? runnerDetailResponseSchema.parse({ runner })
        : { error: { code: "RUNNER_NOT_FOUND", message: `Runner not found: ${parsed.data.id}` } }));
    }
    if (call.name === "mystra_health") {
      const runners = db.listRunners();
      return jsonRpc(rpc.id, textToolResult({
        checkedAt: new Date().toISOString(),
        controlPlane: { status: "healthy" },
        runners: {
          total: runners.length,
          healthy: runners.filter((runner) => runner.health === "healthy").length,
          stale: runners.filter((runner) => runner.health === "stale").length,
          activeSessions: runners.reduce((sum, runner) => sum + runner.activeSessionCount, 0),
        },
      }));
    }
    return jsonRpcError(rpc.id, -32601, `Unknown tool: ${call.name}`, { tool: call.name });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown MCP failure";
    return jsonRpcError(rpc.id, -32000, message, { tool: call.name });
  }
}
