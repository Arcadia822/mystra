import { NextResponse } from "next/server";
import {
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

const tools = [
  {
    name: "mystra_create_task",
    description: "Create an empty Mystra Task.",
    inputSchema: {
      type: "object",
      required: ["projectId"],
      properties: {
        projectId: { type: "string", format: "uuid" },
        issueDispatchKey: { type: "string" },
        metadata: { type: "object" },
      },
      additionalProperties: false,
    },
  },
  { name: "mystra_list_tasks", description: "List durable Task records.", inputSchema: { type: "object", properties: {}, additionalProperties: false } },
  { name: "mystra_get_task", description: "Inspect one durable Task record.", inputSchema: { type: "object", required: ["id"], properties: { id: { type: "string", format: "uuid" } }, additionalProperties: false } },
  { name: "mystra_health", description: "Report local control-plane database health.", inputSchema: { type: "object", properties: {}, additionalProperties: false } },
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
  const db = await getDb();
  try {
    if (call.name === "mystra_create_task") {
      const parsed = parseArguments(rpc.id, call.name, taskCreateRequestSchema, call.arguments);
      if (!parsed.ok) return parsed.response;
      return jsonRpc(rpc.id, textToolResult(taskCreateResponseSchema.parse({ task: await db.createTask(parsed.data) })));
    }
    if (call.name === "mystra_list_tasks") {
      return jsonRpc(rpc.id, textToolResult(taskListResponseSchema.parse({ tasks: await db.listTasks() })));
    }
    if (call.name === "mystra_get_task") {
      const parsed = parseArguments(rpc.id, call.name, idArgumentSchema, call.arguments);
      if (!parsed.ok) return parsed.response;
      const task = await db.getTask(parsed.data.id);
      return jsonRpc(rpc.id, textToolResult(task
        ? taskDetailResponseSchema.parse({ task })
        : { error: { code: "TASK_NOT_FOUND", message: `Task not found: ${parsed.data.id}` } }));
    }
    if (call.name === "mystra_health") {
      const tasks = await db.listTasks();
      return jsonRpc(rpc.id, textToolResult({
        checkedAt: new Date().toISOString(),
        controlPlane: { status: "healthy" },
        tasks: { total: tasks.length },
        temporarilyUnavailable: ["sessions", "runners", "contextBundles"],
      }));
    }
    return jsonRpcError(rpc.id, -32601, `Unknown tool: ${call.name}`, { tool: call.name });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown MCP failure";
    return jsonRpcError(rpc.id, -32000, message, { tool: call.name });
  }
}
