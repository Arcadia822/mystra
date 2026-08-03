import { z } from "zod";

import { resolvedRuntimeContractSchema } from "./schemas.js";

export const sandboxRetentionPolicySchema = z.enum(["destroy_on_finish", "retain_for_preview"]);
export type SandboxRetentionPolicy = z.infer<typeof sandboxRetentionPolicySchema>;

export const sandboxLaunchRequestSchema = z
  .object({
    sessionId: z.string().uuid(),
    runtime: resolvedRuntimeContractSchema,
    workspacePath: z.string().min(1),
    gitMirrorPath: z.string().min(1).optional(),
    retentionPolicy: sandboxRetentionPolicySchema.default("destroy_on_finish"),
  })
  .strict();
export type SandboxLaunchRequest = z.infer<typeof sandboxLaunchRequestSchema>;

export const sandboxSessionStatusSchema = z.enum(["starting", "running", "stopped", "retained", "cleanup_failed"]);
export type SandboxSessionStatus = z.infer<typeof sandboxSessionStatusSchema>;

export const sandboxSessionSchema = z
  .object({
    provider: z.string().min(1),
    sessionId: z.string().min(1),
    status: sandboxSessionStatusSchema,
    startedAt: z.string().datetime(),
    finishedAt: z.string().datetime().optional(),
    retained: z.boolean(),
  })
  .strict();
export type SandboxSession = z.infer<typeof sandboxSessionSchema>;

export const sandboxPortBindingSchema = z
  .object({
    name: z.string().min(1).optional(),
    containerPort: z.number().int().positive(),
    hostBinding: z.string().min(1).optional(),
    url: z.string().url().optional(),
    reachable: z.boolean(),
  })
  .strict();
export type SandboxPortBinding = z.infer<typeof sandboxPortBindingSchema>;

export const cleanupOutcomeSchema = z
  .object({
    status: z.enum(["succeeded", "failed", "skipped"]),
    attemptedAt: z.string().datetime(),
    errorCode: z.string().min(1).optional(),
    errorMessage: z.string().min(1).optional(),
  })
  .strict();
export type CleanupOutcome = z.infer<typeof cleanupOutcomeSchema>;

export const sandboxObservationSchema = z
  .object({
    session: sandboxSessionSchema,
    ports: z.array(sandboxPortBindingSchema).default([]),
    metadata: z.record(z.string(), z.unknown()).default({}),
  })
  .strict();
export type SandboxObservation = z.infer<typeof sandboxObservationSchema>;

export const sandboxOutcomeSchema = z
  .object({
    status: z.enum(["succeeded", "failed", "canceled", "timed_out"]),
    session: sandboxSessionSchema,
    ports: z.array(sandboxPortBindingSchema),
    cleanup: cleanupOutcomeSchema,
    metadata: z.record(z.string(), z.unknown()).default({}),
  })
  .strict();
export type SandboxOutcome = z.infer<typeof sandboxOutcomeSchema>;
