import { z } from "zod";

export const agentNameSchema = z.enum(["codex", "copilot"]);
export type AgentName = z.infer<typeof agentNameSchema>;

export const jobSourceSchema = z.enum(["mcp", "api"]);
export type JobSource = z.infer<typeof jobSourceSchema>;

export const mergeRequestSpecSchema = z
  .object({
    title: z.string().min(1).optional(),
    body: z.string().optional(),
  })
  .strict();
export type MergeRequestSpec = z.infer<typeof mergeRequestSpecSchema>;

export const runnerExecutorSchema = z.enum(["docker", "fake"]);
export type RunnerExecutor = z.infer<typeof runnerExecutorSchema>;

export const platformCapabilitiesSchema = z
  .object({
    agents: z.array(agentNameSchema).min(1),
    executor: runnerExecutorSchema,
    image: z.string().min(1).optional(),
  })
  .strict();
export type PlatformCapabilities = z.infer<typeof platformCapabilitiesSchema>;

export const platformDefaultsSchema = z
  .object({
    maxConcurrency: z.number().int().positive().default(1),
    runTimeoutSeconds: z.number().int().positive().default(3600),
    heartbeatExpirySeconds: z.number().int().positive().default(90),
    longPollTimeoutSeconds: z.number().int().positive().default(25),
    containerCpuQuota: z.number().int().positive().default(4),
    containerMemoryGb: z.number().int().positive().default(8),
  })
  .strict();
export type PlatformDefaults = z.infer<typeof platformDefaultsSchema>;

export const projectConfigSchema = z
  .object({
    repo: z.string().min(1),
    baseBranch: z.string().min(1).default("main"),
    branchName: z.string().min(1),
    agent: agentNameSchema,
    prompt: z.string().min(1),
    mergeRequest: mergeRequestSpecSchema.optional(),
    metadata: z.record(z.string(), z.unknown()).default({}),
  })
  .strict();
export type ProjectConfig = z.infer<typeof projectConfigSchema>;

export const jobSpecSchema = z
  .object({
    taskId: z.string().min(1),
    source: jobSourceSchema,
    repo: projectConfigSchema.shape.repo,
    baseBranch: projectConfigSchema.shape.baseBranch,
    branchName: projectConfigSchema.shape.branchName,
    agent: projectConfigSchema.shape.agent,
    prompt: projectConfigSchema.shape.prompt,
    mergeRequest: projectConfigSchema.shape.mergeRequest,
    metadata: projectConfigSchema.shape.metadata,
  })
  .strict();
export type JobSpec = z.infer<typeof jobSpecSchema>;

export const runnerRegistrationSchema = z
  .object({
    runnerName: z.string().min(1),
    capabilities: platformCapabilitiesSchema,
    maxConcurrency: z.number().int().positive().default(1),
  })
  .strict();
export type RunnerRegistration = z.infer<typeof runnerRegistrationSchema>;

export const runnerPollRequestSchema = z
  .object({
    runnerSessionId: z.string().uuid(),
    maxJobs: z.number().int().positive().default(1),
  })
  .strict();
export type RunnerPollRequest = z.infer<typeof runnerPollRequestSchema>;
