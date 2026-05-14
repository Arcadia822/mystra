import { z } from "zod";
import mvpCodingBlueprintData from "./mvp-coding-blueprint.json" with { type: "json" };

export const workflowAppName = "mystra-workflows";

export const workflowNodeKindSchema = z.enum(["deterministic", "agentic"]);
export type WorkflowNodeKind = z.infer<typeof workflowNodeKindSchema>;

export const workflowHandlerNameSchema = z.enum([
  "git.clone",
  "agent.execute",
  "quality_gate.run",
  "git.push",
  "review.create",
]);
export type WorkflowHandlerName = z.infer<typeof workflowHandlerNameSchema>;

const workflowValueTypeSchema = z.enum(["string", "number", "boolean", "object", "array", "unknown"]);
export type WorkflowValueType = z.infer<typeof workflowValueTypeSchema>;

export const workflowBindingSchema = z.discriminatedUnion("source", [
  z.object({
    source: z.literal("workflow"),
    key: z.string().min(1),
  }).strict(),
  z.object({
    source: z.literal("node"),
    nodeId: z.string().min(1),
    key: z.string().min(1),
  }).strict(),
]);
export type WorkflowBinding = z.infer<typeof workflowBindingSchema>;

export const workflowRetryPolicySchema = z.object({
  maxAttempts: z.number().int().positive(),
}).strict();
export type WorkflowRetryPolicy = z.infer<typeof workflowRetryPolicySchema>;

export const workflowNodeSchema = z.object({
  id: z.string().min(1),
  kind: workflowNodeKindSchema,
  handler: workflowHandlerNameSchema,
  inputBindings: z.record(z.string(), workflowBindingSchema).default({}),
  outputSchema: z.record(z.string(), workflowValueTypeSchema).default({}),
  timeoutSeconds: z.number().int().positive().optional(),
  retryPolicy: workflowRetryPolicySchema.optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
}).strict();
export type WorkflowNode = z.infer<typeof workflowNodeSchema>;

export const workflowEdgeSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
}).strict();
export type WorkflowEdge = z.infer<typeof workflowEdgeSchema>;

export const workflowBlueprintSchema = z.object({
  name: z.string().min(1),
  version: z.string().min(1),
  nodes: z.array(workflowNodeSchema).min(1),
  edges: z.array(workflowEdgeSchema).default([]),
  entryNodes: z.array(z.string().min(1)).min(1),
  outputBindings: z.record(z.string(), workflowBindingSchema).default({}),
}).strict().superRefine((blueprint, ctx) => {
  const nodeIds = new Set<string>();
  for (const [index, node] of blueprint.nodes.entries()) {
    if (nodeIds.has(node.id)) {
      ctx.addIssue({
        code: "custom",
        path: ["nodes", index, "id"],
        message: `Duplicate node id "${node.id}"`,
      });
      continue;
    }
    nodeIds.add(node.id);
  }

  for (const [index, edge] of blueprint.edges.entries()) {
    if (!nodeIds.has(edge.from)) {
      ctx.addIssue({
        code: "custom",
        path: ["edges", index, "from"],
        message: `Edge source "${edge.from}" does not exist`,
      });
    }
    if (!nodeIds.has(edge.to)) {
      ctx.addIssue({
        code: "custom",
        path: ["edges", index, "to"],
        message: `Edge target "${edge.to}" does not exist`,
      });
    }
  }

  for (const [index, nodeId] of blueprint.entryNodes.entries()) {
    if (!nodeIds.has(nodeId)) {
      ctx.addIssue({
        code: "custom",
        path: ["entryNodes", index],
        message: `Entry node "${nodeId}" does not exist`,
      });
    }
  }

  for (const [index, node] of blueprint.nodes.entries()) {
    for (const [bindingKey, binding] of Object.entries(node.inputBindings)) {
      if (binding.source === "node" && !nodeIds.has(binding.nodeId)) {
        ctx.addIssue({
          code: "custom",
          path: ["nodes", index, "inputBindings", bindingKey],
          message: `Binding references unknown node "${binding.nodeId}"`,
        });
      }
    }
  }

  for (const [bindingKey, binding] of Object.entries(blueprint.outputBindings)) {
    if (binding.source === "node" && !nodeIds.has(binding.nodeId)) {
      ctx.addIssue({
        code: "custom",
        path: ["outputBindings", bindingKey],
        message: `Output binding references unknown node "${binding.nodeId}"`,
      });
    }
  }

  try {
    topologicalOrder(blueprint);
  } catch (error) {
    ctx.addIssue({
      code: "custom",
      path: ["edges"],
      message: error instanceof Error ? error.message : String(error),
    });
  }
});
export type WorkflowBlueprint = z.infer<typeof workflowBlueprintSchema>;

export interface WorkflowNodeExecution {
  nodeId: string;
  handler: WorkflowHandlerName;
  status: "succeeded" | "failed" | "skipped";
  inputs: Record<string, unknown>;
  outputs?: Record<string, unknown>;
  errorMessage?: string;
}

export interface WorkflowExecutionResult {
  status: "succeeded" | "failed";
  outputs: Record<string, unknown>;
  executions: WorkflowNodeExecution[];
  failedNodeId?: string;
  errorMessage?: string;
}

export interface WorkflowHandlerContext {
  blueprint: WorkflowBlueprint;
  node: WorkflowNode;
  signal?: AbortSignal | undefined;
}

export type WorkflowStepHandler = (
  inputs: Record<string, unknown>,
  context: WorkflowHandlerContext,
) => Promise<Record<string, unknown>> | Record<string, unknown>;

export interface WorkflowExecutionContext {
  workflowInput: Record<string, unknown>;
  handlers: Partial<Record<WorkflowHandlerName, WorkflowStepHandler>>;
  signal?: AbortSignal;
}

export interface WorkflowResumeSnapshot {
  blueprint: WorkflowBlueprint;
  completedNodeOutputs: Record<string, Record<string, unknown>>;
}

export interface WorkflowProviderCapabilities {
  parallelNodeExecution: boolean;
}

export interface WorkflowProvider {
  readonly providerName: string;
  readonly defaultBlueprint: string;
  readonly supportedNodeKinds: readonly WorkflowNodeKind[];
  readonly capabilities: WorkflowProviderCapabilities;
  loadBlueprint(name: string): WorkflowBlueprint;
  validateBlueprint(blueprint: WorkflowBlueprint): WorkflowBlueprint;
  executeBlueprint(blueprint: WorkflowBlueprint, context: WorkflowExecutionContext): Promise<WorkflowExecutionResult>;
  resumeExecution(snapshot: WorkflowResumeSnapshot, context: WorkflowExecutionContext): Promise<WorkflowExecutionResult>;
  supportsNodeKind(kind: WorkflowNodeKind): boolean;
}

function topologicalOrder(blueprint: WorkflowBlueprint): string[] {
  const nodeIds = blueprint.nodes.map((node) => node.id);
  const indegree = new Map(nodeIds.map((nodeId) => [nodeId, 0]));
  const adjacency = new Map(nodeIds.map((nodeId) => [nodeId, [] as string[]]));

  for (const edge of blueprint.edges) {
    indegree.set(edge.to, (indegree.get(edge.to) ?? 0) + 1);
    adjacency.get(edge.from)?.push(edge.to);
  }

  const queue = nodeIds.filter((nodeId) => (indegree.get(nodeId) ?? 0) === 0);
  const order: string[] = [];

  while (queue.length > 0) {
    const next = queue.shift();
    if (!next) {
      break;
    }
    order.push(next);
    for (const downstream of adjacency.get(next) ?? []) {
      const remaining = (indegree.get(downstream) ?? 0) - 1;
      indegree.set(downstream, remaining);
      if (remaining === 0) {
        queue.push(downstream);
      }
    }
  }

  if (order.length !== blueprint.nodes.length) {
    throw new Error("Blueprint graph must be acyclic");
  }

  return order;
}

function resolveBindings(
  bindings: Record<string, WorkflowBinding>,
  workflowInput: Record<string, unknown>,
  nodeOutputs: Map<string, Record<string, unknown>>,
): Record<string, unknown> {
  const resolved: Record<string, unknown> = {};

  for (const [inputName, binding] of Object.entries(bindings)) {
    resolved[inputName] = binding.source === "workflow"
      ? workflowInput[binding.key]
      : nodeOutputs.get(binding.nodeId)?.[binding.key];
  }

  return resolved;
}

function resolveWorkflowOutputs(
  blueprint: WorkflowBlueprint,
  workflowInput: Record<string, unknown>,
  nodeOutputs: Map<string, Record<string, unknown>>,
): Record<string, unknown> {
  return resolveBindings(blueprint.outputBindings, workflowInput, nodeOutputs);
}

export function validateBlueprint(blueprint: WorkflowBlueprint): WorkflowBlueprint {
  return workflowBlueprintSchema.parse(blueprint);
}

export class LocalWorkflowProvider implements WorkflowProvider {
  readonly providerName = "local";
  readonly defaultBlueprint: string;
  readonly supportedNodeKinds = ["deterministic", "agentic"] as const satisfies readonly WorkflowNodeKind[];
  readonly capabilities: WorkflowProviderCapabilities = {
    parallelNodeExecution: false,
  };
  private readonly blueprints: Map<string, WorkflowBlueprint>;

  constructor(options: { blueprints: WorkflowBlueprint[] }) {
    this.blueprints = new Map(
      options.blueprints.map((blueprint) => {
        const validated = validateBlueprint(blueprint);
        return [validated.name, validated];
      }),
    );
    const [firstBlueprint] = options.blueprints;
    if (!firstBlueprint) {
      throw new Error("LocalWorkflowProvider requires at least one blueprint");
    }
    this.defaultBlueprint = firstBlueprint.name;
  }

  loadBlueprint(name: string): WorkflowBlueprint {
    const blueprint = this.blueprints.get(name);
    if (!blueprint) {
      throw new Error(`Unknown workflow blueprint "${name}"`);
    }
    return blueprint;
  }

  validateBlueprint(blueprint: WorkflowBlueprint): WorkflowBlueprint {
    const validated = validateBlueprint(blueprint);
    for (const node of validated.nodes) {
      if (!this.supportsNodeKind(node.kind)) {
        throw new Error(`Unsupported workflow node kind "${node.kind}"`);
      }
    }
    return validated;
  }

  async executeBlueprint(
    blueprint: WorkflowBlueprint,
    context: WorkflowExecutionContext,
  ): Promise<WorkflowExecutionResult> {
    return await this.executeValidatedBlueprint(
      this.validateBlueprint(blueprint),
      context,
      new Map<string, Record<string, unknown>>(),
      [],
    );
  }

  async resumeExecution(
    snapshot: WorkflowResumeSnapshot,
    context: WorkflowExecutionContext,
  ): Promise<WorkflowExecutionResult> {
    const existingExecutions: WorkflowNodeExecution[] = Object.entries(snapshot.completedNodeOutputs).map(
      ([nodeId, outputs]) => ({
        nodeId,
        handler: this.validateBlueprint(snapshot.blueprint).nodes.find((node) => node.id === nodeId)?.handler ?? "git.clone",
        status: "succeeded",
        inputs: {},
        outputs,
      }),
    );
    return await this.executeValidatedBlueprint(
      this.validateBlueprint(snapshot.blueprint),
      context,
      new Map(Object.entries(snapshot.completedNodeOutputs)),
      existingExecutions,
    );
  }

  supportsNodeKind(kind: WorkflowNodeKind): boolean {
    return this.supportedNodeKinds.includes(kind);
  }

  private async executeValidatedBlueprint(
    blueprint: WorkflowBlueprint,
    context: WorkflowExecutionContext,
    initialNodeOutputs: Map<string, Record<string, unknown>>,
    initialExecutions: WorkflowNodeExecution[],
  ): Promise<WorkflowExecutionResult> {
    const nodeOutputs = new Map(initialNodeOutputs);
    const executions = [...initialExecutions];
    const nodesById = new Map(blueprint.nodes.map((node) => [node.id, node]));

    for (const nodeId of topologicalOrder(blueprint)) {
      if (nodeOutputs.has(nodeId)) {
        continue;
      }

      const node = nodesById.get(nodeId);
      if (!node) {
        throw new Error(`Unknown workflow node "${nodeId}"`);
      }

      const handler = context.handlers[node.handler];
      if (!handler) {
        throw new Error(`Missing workflow handler "${node.handler}"`);
      }

      const inputs = resolveBindings(node.inputBindings, context.workflowInput, nodeOutputs);

      try {
        const outputs = await handler(inputs, {
          blueprint,
          node,
          signal: context.signal,
        });
        nodeOutputs.set(node.id, outputs);
        executions.push({
          nodeId: node.id,
          handler: node.handler,
          status: "succeeded",
          inputs,
          outputs,
        });
      } catch (error) {
        executions.push({
          nodeId: node.id,
          handler: node.handler,
          status: "failed",
          inputs,
          errorMessage: error instanceof Error ? error.message : String(error),
        });
        return {
          status: "failed",
          failedNodeId: node.id,
          errorMessage: error instanceof Error ? error.message : String(error),
          outputs: resolveWorkflowOutputs(blueprint, context.workflowInput, nodeOutputs),
          executions,
        };
      }
    }

    return {
      status: "succeeded",
      outputs: resolveWorkflowOutputs(blueprint, context.workflowInput, nodeOutputs),
      executions,
    };
  }
}

export function createWorkflowProviderRegistry(
  providers: Record<string, WorkflowProvider>,
): {
  get(name?: string): WorkflowProvider;
  resolve(name?: string, blueprintName?: string): {
    provider: WorkflowProvider;
    blueprint: WorkflowBlueprint;
  };
} {
  if (!providers.local) {
    throw new Error("Workflow provider registry requires a local provider");
  }

  return {
    get(name = "local"): WorkflowProvider {
      const provider = providers[name];
      if (!provider) {
        throw new Error(`Unknown workflow provider "${name}"`);
      }
      return provider;
    },
    resolve(name = "local", blueprintName?: string) {
      const provider = this.get(name);
      const blueprint = provider.loadBlueprint(blueprintName ?? provider.defaultBlueprint);
      return { provider, blueprint };
    },
  };
}

export const mvpCodingBlueprint = workflowBlueprintSchema.parse(mvpCodingBlueprintData);
