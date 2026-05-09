import { NextResponse } from "next/server";
import { z } from "zod";

import { cancelLocalJob, createLocalJob, getLocalJob, listLocalRunners } from "@/lib/local-store";
import { jsonError } from "@/lib/http";

const jsonRpcRequestSchema = z
  .object({
    jsonrpc: z.literal("2.0").optional(),
    id: z.union([z.string(), z.number(), z.null()]).optional(),
    method: z.string(),
    params: z.unknown().optional(),
  })
  .strict();

const toolCallSchema = z
  .object({
    name: z.string(),
    arguments: z.record(z.string(), z.unknown()).default({}),
  })
  .strict();

function jsonRpc(id: string | number | null | undefined, result: unknown) {
  return NextResponse.json({
    jsonrpc: "2.0",
    id: id ?? null,
    result,
  });
}

function textToolResult(payload: unknown) {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(payload, null, 2),
      },
    ],
  };
}

export async function POST(request: Request) {
  try {
    const rpc = jsonRpcRequestSchema.parse(await request.json());

    if (rpc.method === "initialize") {
      return jsonRpc(rpc.id, {
        protocolVersion: "2025-06-18",
        serverInfo: {
          name: "mystra-local",
          version: "0.0.0",
        },
        capabilities: {
          tools: {},
        },
      });
    }

    if (rpc.method === "tools/list") {
      return jsonRpc(rpc.id, {
        tools: [
          {
            name: "mystra_create_job",
            description: "Create a local Mystra job.",
            inputSchema: {
              type: "object",
              required: ["taskId", "source", "repo", "branchName", "agent", "prompt"],
              properties: {
                taskId: { type: "string" },
                source: { type: "string", enum: ["mcp", "api"] },
                repo: { type: "string" },
                baseBranch: { type: "string", default: "main" },
                branchName: { type: "string" },
                agent: { type: "string", enum: ["codex", "copilot"] },
                prompt: { type: "string" },
                metadata: { type: "object" },
              },
            },
          },
          {
            name: "mystra_get_job",
            description: "Get local Mystra job status.",
            inputSchema: {
              type: "object",
              required: ["jobId"],
              properties: {
                jobId: { type: "string" },
              },
            },
          },
          {
            name: "mystra_cancel_job",
            description: "Cancel a local Mystra job.",
            inputSchema: {
              type: "object",
              required: ["jobId"],
              properties: {
                jobId: { type: "string" },
              },
            },
          },
          {
            name: "mystra_list_runners",
            description: "List local Mystra runner sessions.",
            inputSchema: {
              type: "object",
              properties: {},
            },
          },
        ],
      });
    }

    if (rpc.method === "tools/call") {
      const call = toolCallSchema.parse(rpc.params);

      if (call.name === "mystra_create_job") {
        return jsonRpc(rpc.id, textToolResult(createLocalJob(call.arguments)));
      }

      if (call.name === "mystra_get_job") {
        const jobId = z.string().parse(call.arguments.jobId);
        const snapshot = getLocalJob(jobId);
        return jsonRpc(rpc.id, textToolResult(snapshot ?? { error: "job_not_found" }));
      }

      if (call.name === "mystra_cancel_job") {
        const jobId = z.string().parse(call.arguments.jobId);
        const snapshot = cancelLocalJob(jobId);
        return jsonRpc(rpc.id, textToolResult(snapshot ?? { error: "job_not_found" }));
      }

      if (call.name === "mystra_list_runners") {
        return jsonRpc(rpc.id, textToolResult({ runners: listLocalRunners() }));
      }

      return jsonRpc(rpc.id, textToolResult({ error: "unknown_tool", tool: call.name }));
    }

    return jsonRpc(rpc.id, {
      error: {
        code: -32601,
        message: `Unknown method: ${rpc.method}`,
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
