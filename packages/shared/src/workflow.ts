import { z } from "zod";

import { runResultStatusSchema } from "./result.js";

export const workflowNodeKindSchema = z.enum(["deterministic", "agentic"]);
export type WorkflowNodeKind = z.infer<typeof workflowNodeKindSchema>;

export const workflowNodeExecutionStatusSchema = z.enum(["running", "succeeded", "failed"]);
export type WorkflowNodeExecutionStatus = z.infer<typeof workflowNodeExecutionStatusSchema>;

export const workflowExecutionStatusSchema = z.enum([
  "running",
  ...runResultStatusSchema.options,
]);
export type WorkflowExecutionStatus = z.infer<typeof workflowExecutionStatusSchema>;

export const workflowNodeExecutionSnapshotSchema = z.object({
  nodeId: z.string().min(1),
  handler: z.string().min(1),
  nodeKind: workflowNodeKindSchema,
  status: workflowNodeExecutionStatusSchema,
  startedAt: z.string().datetime(),
  finishedAt: z.string().datetime().optional(),
  data: z.record(z.string(), z.unknown()).default({}),
}).strict();
export type WorkflowNodeExecutionSnapshot = z.infer<typeof workflowNodeExecutionSnapshotSchema>;

export const workflowExecutionSnapshotSchema = z.object({
  provider: z.string().min(1).optional(),
  blueprintName: z.string().min(1).optional(),
  blueprintVersion: z.string().min(1).optional(),
  status: workflowExecutionStatusSchema,
  currentNodeId: z.string().min(1).optional(),
  terminalNodeId: z.string().min(1).optional(),
  nodeExecutions: z.array(workflowNodeExecutionSnapshotSchema).default([]),
  startedAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
}).strict();
export type WorkflowExecutionSnapshot = z.infer<typeof workflowExecutionSnapshotSchema>;
