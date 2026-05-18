import { NextResponse } from "next/server";
import {
  cancellationRequestMetadataSchema,
  contextBundleSchema,
  contextBundleCreateSchema,
  controlPlaneLifecycleHandoffEventTypes,
  jobSpecSchema,
  platformCapabilitiesSchema,
  projectCreateSchema,
  projectRuntimeConfigSchema,
  projectSchema,
  resolvedRuntimeContractSchema,
  runEventSchema,
  runResultSchema,
  runStateSchema,
  terminalRunEventTypes,
  workflowExecutionSnapshotSchema,
} from "@mystra/shared";
import { z } from "zod";

import { getDb } from "@/lib/db";
import type { PublicRunnerSession } from "@/lib/db/rdb-provider";

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

const jsonRpcErrorSchema = z.object({
  code: z.number(),
  message: z.string(),
  data: z.record(z.string(), z.unknown()).optional(),
});

const mcpRunnerHealthSchema = z.object({
  id: z.string(),
  runnerName: z.string(),
  status: z.enum(["healthy", "degraded"]),
  lastHeartbeatAt: z.string(),
  staleAfterSeconds: z.number(),
  activeRunCount: z.number(),
  maxConcurrency: z.number(),
  eligibleProjectIds: z.array(z.string()).optional(),
  eligibleRuntimeProviders: z.array(z.string()).optional(),
});

const mcpHealthResponseSchema = z.object({
  checkedAt: z.string(),
  controlPlane: z.object({
    status: z.literal("healthy"),
  }),
  runnerSummary: z.object({
    total: z.number(),
    healthy: z.number(),
    degraded: z.number(),
    activeRuns: z.number(),
  }),
  runners: z.array(mcpRunnerHealthSchema),
});

const publicRunnerSessionSchema = z.object({
  id: z.string().uuid(),
  runnerName: z.string().min(1),
  capabilities: platformCapabilitiesSchema,
  maxConcurrency: z.number().int().positive(),
  activeRunCount: z.number().int().nonnegative(),
  staleAfterSeconds: z.number().int().positive(),
  eligibleProjectIds: z.array(z.string().uuid()).optional(),
  eligibleRuntimeProviders: z.array(z.string()).optional(),
  lastHeartbeatAt: z.string().datetime(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
}).strict();

const jobRecordSchema = z.object({
  id: z.string().uuid(),
  spec: jobSpecSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
}).strict();

const runRecordSchema = z.object({
  id: z.string().uuid(),
  jobId: z.string().uuid(),
  state: runStateSchema,
  attempt: z.number().int().positive(),
  assignedRunnerSessionId: z.string().uuid().optional(),
  resolvedRuntime: resolvedRuntimeContractSchema.optional(),
  result: runResultSchema.optional(),
  failureReason: z.string().min(1).optional(),
  cancellationRequest: cancellationRequestMetadataSchema.optional(),
  staleReason: z.string().min(1).optional(),
  staleMarkedAt: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  startedAt: z.string().datetime().optional(),
  finishedAt: z.string().datetime().optional(),
}).strict();

const projectClaimSchema = z.object({
  id: z.string().uuid(),
  slug: projectSchema.shape.slug,
  runtime: projectRuntimeConfigSchema,
  prewarmConfig: z.record(z.string(), z.unknown()).default({}),
}).strict();

const jobSnapshotSchema = z.object({
  job: jobRecordSchema,
  run: runRecordSchema,
  events: z.array(runEventSchema),
  workflow: workflowExecutionSnapshotSchema.optional(),
  project: projectClaimSchema.optional(),
  runtime: resolvedRuntimeContractSchema.optional(),
}).strict();

const listRunnersPayloadSchema = z.object({
  runners: z.array(publicRunnerSessionSchema),
}).strict();

const listContextBundlesPayloadSchema = z.object({
  contextBundles: z.array(contextBundleSchema),
}).strict();

const listProjectsPayloadSchema = z.object({
  projects: z.array(projectSchema),
}).strict();

function jsonRpcError(
  id: string | number | null | undefined,
  code: number,
  message: string,
  data?: Record<string, unknown>,
) {
  return NextResponse.json({
    jsonrpc: "2.0",
    id: id ?? null,
    error: jsonRpcErrorSchema.parse({
      code,
      message,
      ...(data ? { data } : {}),
    }),
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

function validatedToolResult<T extends z.ZodTypeAny>(schema: T, payload: unknown) {
  return textToolResult(schema.parse(payload));
}

function parseToolArguments<T extends z.ZodType>(
  id: string | number | null | undefined,
  toolName: string,
  schema: T,
  arguments_: unknown,
): { ok: true; data: z.infer<T> } | { ok: false; response: NextResponse } {
  const parsed = schema.safeParse(arguments_);
  if (parsed.success) {
    return { ok: true, data: parsed.data };
  }

  return {
    ok: false,
    response: jsonRpcError(id, -32602, "Invalid params", {
      tool: toolName,
      issues: parsed.error.issues,
    }),
  };
}

function runnerHealth(runner: PublicRunnerSession, checkedAt: string) {
  const heartbeatAgeMs = new Date(checkedAt).getTime() - new Date(runner.lastHeartbeatAt).getTime();
  const status = heartbeatAgeMs <= runner.staleAfterSeconds * 1000 ? "healthy" : "degraded";

  return mcpRunnerHealthSchema.parse({
    id: runner.id,
    runnerName: runner.runnerName,
    status,
    lastHeartbeatAt: runner.lastHeartbeatAt,
    staleAfterSeconds: runner.staleAfterSeconds,
    activeRunCount: runner.activeRunCount,
    maxConcurrency: runner.maxConcurrency,
    ...(runner.eligibleProjectIds ? { eligibleProjectIds: runner.eligibleProjectIds } : {}),
    ...(runner.eligibleRuntimeProviders ? { eligibleRuntimeProviders: runner.eligibleRuntimeProviders } : {}),
  });
}

function healthPayload(runners: PublicRunnerSession[]) {
  const checkedAt = new Date().toISOString();
  const projectedRunners = runners.map((runner) => runnerHealth(runner, checkedAt));
  const degraded = projectedRunners.filter((runner) => runner.status === "degraded").length;
  const healthy = projectedRunners.length - degraded;
  const activeRuns = projectedRunners.reduce((sum, runner) => sum + runner.activeRunCount, 0);

  return mcpHealthResponseSchema.parse({
    checkedAt,
    controlPlane: { status: "healthy" },
    runnerSummary: {
      total: projectedRunners.length,
      healthy,
      degraded,
      activeRuns,
    },
    runners: projectedRunners,
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const rpcResult = jsonRpcRequestSchema.safeParse(body);
    if (!rpcResult.success) {
      return jsonRpcError(null, -32600, "Invalid Request", {
        issues: rpcResult.error.issues,
      });
    }

    const rpc = rpcResult.data;

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
          {
            name: "mystra_health",
            description: "Report local Mystra MCP health and runner heartbeat status.",
            inputSchema: {
              type: "object",
              properties: {},
              additionalProperties: false,
            },
          },
        ],
      });
    }

    if (rpc.method === "tools/call") {
      const callResult = toolCallSchema.safeParse(rpc.params);
      if (!callResult.success) {
        return jsonRpcError(rpc.id, -32600, "Invalid Request", {
          issues: callResult.error.issues,
        });
      }

      const call = callResult.data;
      const db = getDb();

      if (call.name === "mystra_create_context_bundle") {
        const parsed = parseToolArguments(rpc.id, call.name, contextBundleCreateSchema, call.arguments);
        if (!parsed.ok) {
          return parsed.response;
        }
        return jsonRpc(rpc.id, validatedToolResult(z.object({
          contextBundle: contextBundleSchema,
        }).strict(), {
          contextBundle: db.createContextBundle(parsed.data),
        }));
      }

      if (call.name === "mystra_list_context_bundles") {
        const includeArchived = call.arguments.includeArchived === true;
        return jsonRpc(rpc.id, validatedToolResult(listContextBundlesPayloadSchema, {
          contextBundles: db.listContextBundles({ includeArchived }),
        }));
      }

      if (call.name === "mystra_create_job") {
        const parsed = parseToolArguments(rpc.id, call.name, jobSpecSchema, call.arguments);
        if (!parsed.ok) {
          return parsed.response;
        }
        return jsonRpc(rpc.id, validatedToolResult(jobSnapshotSchema, db.createJob(parsed.data)));
      }

      if (call.name === "mystra_create_project") {
        const parsed = parseToolArguments(rpc.id, call.name, projectCreateSchema, call.arguments);
        if (!parsed.ok) {
          return parsed.response;
        }
        return jsonRpc(rpc.id, validatedToolResult(projectSchema, db.createProject(parsed.data)));
      }

      if (call.name === "mystra_list_projects") {
        const includeArchived = call.arguments.includeArchived === true;
        return jsonRpc(rpc.id, validatedToolResult(listProjectsPayloadSchema, {
          projects: db.listProjects({ includeArchived }),
        }));
      }

      if (call.name === "mystra_get_project") {
        const slug = z.string().parse(call.arguments.slug);
        const project = db.getProjectBySlug(slug);
        return jsonRpc(rpc.id, textToolResult(project ?? { error: "project_not_found" }));
      }

      if (call.name === "mystra_get_job") {
        const jobId = z.string().parse(call.arguments.jobId);
        const snapshot = db.getJob(jobId);
        return jsonRpc(rpc.id, textToolResult(snapshot ? jobSnapshotSchema.parse(snapshot) : { error: "job_not_found" }));
      }

      if (call.name === "mystra_cancel_job") {
        const jobId = z.string().parse(call.arguments.jobId);
        const snapshot = db.cancelJob(jobId);
        return jsonRpc(rpc.id, textToolResult(snapshot ?? { error: "job_not_found" }));
      }

      if (call.name === "mystra_list_runners") {
        return jsonRpc(rpc.id, validatedToolResult(listRunnersPayloadSchema, { runners: db.listRunners() }));
      }

      if (call.name === "mystra_health") {
        return jsonRpc(rpc.id, textToolResult(healthPayload(db.listRunners())));
      }

      return jsonRpcError(rpc.id, -32601, `Unknown tool: ${call.name}`, {
        tool: call.name,
      });
    }

    return jsonRpcError(rpc.id, -32601, `Unknown method: ${rpc.method}`);
  } catch (error) {
    void error;
    return jsonRpcError(null, -32000, "An internal error occurred processing the MCP request");
  }
}
