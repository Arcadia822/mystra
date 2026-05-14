import { NextResponse } from "next/server";
import {
  contextBundleCreateSchema,
  controlPlaneLifecycleHandoffEventTypes,
  jobSpecSchema,
  projectCreateSchema,
  terminalRunEventTypes,
} from "@mystra/shared";
import { z } from "zod";

import { getDb } from "@/lib/db";
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
            name: "mystra_create_context_bundle",
            description: "Create a Mystra context bundle reference.",
            inputSchema: {
              type: "object",
              required: ["slug", "displayName", "source", "accessMode", "failureMode"],
              properties: {
                slug: { type: "string" },
                displayName: { type: "string" },
                source: {
                  type: "object",
                  required: ["kind"],
                  properties: {
                    kind: { type: "string", enum: ["local-template", "external-artifact", "job-inline"] },
                    ref: { type: "string" },
                    metadata: { type: "object" },
                  },
                  additionalProperties: false,
                },
                accessMode: { type: "string", enum: ["read-only", "job-scoped"] },
                mountPath: { type: "string" },
                freshness: { type: "object" },
                failureMode: { type: "string", enum: ["fail-run", "warn"] },
                metadata: { type: "object" },
                archivedAt: { type: ["string", "null"] },
              },
              additionalProperties: false,
            },
          },
          {
            name: "mystra_list_context_bundles",
            description: "List Mystra context bundle references.",
            inputSchema: {
              type: "object",
              properties: {
                includeArchived: { type: "boolean" },
              },
              additionalProperties: false,
            },
          },
          {
            name: "mystra_create_job",
            description: "Create a local Mystra job.",
            lifecycle: {
              handoffEvents: [...controlPlaneLifecycleHandoffEventTypes],
            },
            inputSchema: {
              type: "object",
              required: ["taskId", "source", "projectId", "branchName", "prompt"],
              properties: {
                taskId: { type: "string" },
                source: { type: "string", enum: ["mcp", "api"] },
                projectId: { type: "string" },
                repo: { type: "string" },
                baseBranch: { type: "string", default: "main" },
                branchName: { type: "string" },
                agent: { type: "string", enum: ["codex", "copilot"] },
                prompt: { type: "string" },
                runtime: {
                  type: "object",
                  properties: {
                    runtimeProfile: { type: "string", description: "Reserved for future Project-managed runtime profiles; rejected by the MVP resolver." },
                    provider: { type: "string", enum: ["docker"] },
                    image: { type: "string" },
                    contextBundleRefs: {
                      type: "array",
                      items: {
                        type: "object",
                        required: ["slug"],
                        properties: {
                          slug: { type: "string" },
                          required: { type: "boolean", default: true },
                          accessMode: { type: "string", enum: ["read-only", "job-scoped"], default: "read-only" },
                        },
                        additionalProperties: false,
                      },
                    },
                    metadata: { type: "object" },
                  },
                  additionalProperties: false,
                },
                metadata: { type: "object" },
              },
              additionalProperties: false,
            },
          },
          {
            name: "mystra_create_project",
            description: "Create a Mystra Project.",
            inputSchema: {
              type: "object",
              required: ["name", "slug", "repo", "defaultAgent", "runtime"],
              properties: {
                name: { type: "string" },
                slug: { type: "string" },
                repo: { type: "string" },
                baseBranch: { type: "string", default: "main" },
                defaultAgent: { type: "string", enum: ["codex", "copilot"] },
                runtime: {
                  type: "object",
                  required: ["image"],
                  properties: {
                    provider: { type: "string", enum: ["docker"], default: "docker" },
                    image: { type: "string" },
                    contextBundleRefs: {
                      type: "array",
                      items: {
                        type: "object",
                        required: ["slug"],
                        properties: {
                          slug: { type: "string" },
                          required: { type: "boolean", default: true },
                          accessMode: { type: "string", enum: ["read-only", "job-scoped"], default: "read-only" },
                        },
                        additionalProperties: false,
                      },
                    },
                    mounts: { type: "array" },
                    exposedPorts: { type: "array" },
                    cache: { type: "object" },
                    secretRefs: { type: "array" },
                    overridePolicy: {
                      type: "object",
                      properties: {
                        allowImageOverride: { type: "boolean", default: false },
                        allowContextBundleAdditions: { type: "boolean", default: false },
                        allowedContextBundleSlugs: { type: "array", items: { type: "string" } },
                      },
                      additionalProperties: false,
                    },
                    metadata: { type: "object" },
                  },
                  additionalProperties: false,
                },
                prewarmConfig: { type: "object" },
                metadata: { type: "object" },
              },
              additionalProperties: false,
            },
          },
          {
            name: "mystra_list_projects",
            description: "List Mystra Projects.",
            inputSchema: {
              type: "object",
              properties: {
                includeArchived: { type: "boolean" },
              },
            },
          },
          {
            name: "mystra_get_project",
            description: "Get a Mystra Project by slug.",
            inputSchema: {
              type: "object",
              required: ["slug"],
              properties: {
                slug: { type: "string" },
              },
            },
          },
          {
            name: "mystra_get_job",
            description: "Get local Mystra job status.",
            lifecycle: {
              handoffEvents: [...controlPlaneLifecycleHandoffEventTypes],
              terminalEvents: [...terminalRunEventTypes],
            },
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
      const db = getDb();

      if (call.name === "mystra_create_context_bundle") {
        return jsonRpc(rpc.id, textToolResult({
          contextBundle: db.createContextBundle(contextBundleCreateSchema.parse(call.arguments)),
        }));
      }

      if (call.name === "mystra_list_context_bundles") {
        const includeArchived = call.arguments.includeArchived === true;
        return jsonRpc(rpc.id, textToolResult({ contextBundles: db.listContextBundles({ includeArchived }) }));
      }

      if (call.name === "mystra_create_job") {
        return jsonRpc(rpc.id, textToolResult(db.createJob(jobSpecSchema.parse(call.arguments))));
      }

      if (call.name === "mystra_create_project") {
        return jsonRpc(rpc.id, textToolResult(db.createProject(projectCreateSchema.parse(call.arguments))));
      }

      if (call.name === "mystra_list_projects") {
        const includeArchived = call.arguments.includeArchived === true;
        return jsonRpc(rpc.id, textToolResult({ projects: db.listProjects({ includeArchived }) }));
      }

      if (call.name === "mystra_get_project") {
        const slug = z.string().parse(call.arguments.slug);
        const project = db.getProjectBySlug(slug);
        return jsonRpc(rpc.id, textToolResult(project ?? { error: "project_not_found" }));
      }

      if (call.name === "mystra_get_job") {
        const jobId = z.string().parse(call.arguments.jobId);
        const snapshot = db.getJob(jobId);
        return jsonRpc(rpc.id, textToolResult(snapshot ?? { error: "job_not_found" }));
      }

      if (call.name === "mystra_cancel_job") {
        const jobId = z.string().parse(call.arguments.jobId);
        const snapshot = db.cancelJob(jobId);
        return jsonRpc(rpc.id, textToolResult(snapshot ?? { error: "job_not_found" }));
      }

      if (call.name === "mystra_list_runners") {
        return jsonRpc(rpc.id, textToolResult({ runners: db.listRunners() }));
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
