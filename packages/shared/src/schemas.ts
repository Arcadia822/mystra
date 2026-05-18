import { z } from "zod";

export const agentNameSchema = z.enum(["codex", "copilot"]);
export type AgentName = z.infer<typeof agentNameSchema>;

export const taskSourceSchema = z.enum(["mcp", "api"]);
export type TaskSource = z.infer<typeof taskSourceSchema>;

export const mergeRequestSpecSchema = z
  .object({
    title: z.string().min(1).optional(),
    body: z.string().optional(),
  })
  .strict();
export type MergeRequestSpec = z.infer<typeof mergeRequestSpecSchema>;

export const runnerExecutorSchema = z.enum(["docker", "fake"]);
export type RunnerExecutor = z.infer<typeof runnerExecutorSchema>;

export const sandboxProviderSchema = z.enum(["docker"]);
export type SandboxProvider = z.infer<typeof sandboxProviderSchema>;

export const contextBundleAccessModeSchema = z.enum(["read-only", "job-scoped"]);
export type ContextBundleAccessMode = z.infer<typeof contextBundleAccessModeSchema>;

export const contextBundleFailureModeSchema = z.enum(["fail-run", "warn"]);
export type ContextBundleFailureMode = z.infer<typeof contextBundleFailureModeSchema>;

export const contextBundleSourceSchema = z
  .object({
    kind: z.enum(["local-template", "external-artifact", "job-inline"]),
    ref: z.string().min(1).optional(),
    metadata: z.record(z.string(), z.unknown()).default({}),
  })
  .strict();
export type ContextBundleSource = z.infer<typeof contextBundleSourceSchema>;

export const runtimeSecretRefSchema = z
  .object({
    name: z.string().min(1),
    mode: z.enum(["env", "file"]),
    target: z.string().min(1).optional(),
  })
  .strict();
export type RuntimeSecretRef = z.infer<typeof runtimeSecretRefSchema>;

export const runtimeMountKindSchema = z.enum(["workspace", "gitMirror", "cache", "contextBundle", "secret"]);
export type RuntimeMountKind = z.infer<typeof runtimeMountKindSchema>;

export const runtimeMountOwnerSchema = z.enum(["system", "project", "runtime"]);
export type RuntimeMountOwner = z.infer<typeof runtimeMountOwnerSchema>;

export const runtimeMountSchema = z
  .object({
    kind: runtimeMountKindSchema,
    owner: runtimeMountOwnerSchema.default("project"),
    target: z.string().min(1),
    sourceRef: z.string().min(1).optional(),
    readOnly: z.boolean().default(false),
  })
  .strict()
  .superRefine((mount, ctx) => {
    if (mount.target === "/root" || mount.target.startsWith("/root/") || mount.target.includes("/var/run/docker.sock")) {
      ctx.addIssue({
        code: "custom",
        message: "Runtime mounts must not target host home or the host Docker socket",
        path: ["target"],
      });
    }
  });
export type RuntimeMount = z.infer<typeof runtimeMountSchema>;

export const contextBundleRefSchema = z
  .object({
    slug: z.string().min(1),
    required: z.boolean().default(true),
    accessMode: contextBundleAccessModeSchema.default("read-only"),
  })
  .strict();
export type ContextBundleRef = z.infer<typeof contextBundleRefSchema>;

function rejectForbiddenContextBundleMountPath(
  bundle: { mountPath?: string | undefined },
  ctx: z.RefinementCtx,
): void {
  if (
    bundle.mountPath &&
    (bundle.mountPath === "/root" || bundle.mountPath.startsWith("/root/") || bundle.mountPath.includes("/var/run/docker.sock"))
  ) {
    ctx.addIssue({
      code: "custom",
      message: "Context bundles must not mount host home or the host Docker socket",
      path: ["mountPath"],
    });
  }
}

export const contextBundleCreateSchema = z
  .object({
    slug: z.string().min(1),
    displayName: z.string().min(1),
    source: contextBundleSourceSchema,
    accessMode: contextBundleAccessModeSchema,
    mountPath: z.string().min(1).optional(),
    freshness: z.record(z.string(), z.unknown()).default({}),
    failureMode: contextBundleFailureModeSchema,
    metadata: z.record(z.string(), z.unknown()).default({}),
    archivedAt: z.string().datetime().nullable().default(null),
  })
  .strict()
  .superRefine(rejectForbiddenContextBundleMountPath);
export type ContextBundleCreate = z.input<typeof contextBundleCreateSchema>;

export const contextBundleSchema = z
  .object({
    id: z.string().uuid(),
    slug: z.string().min(1),
    displayName: z.string().min(1),
    source: contextBundleSourceSchema,
    accessMode: contextBundleAccessModeSchema,
    mountPath: z.string().min(1).optional(),
    freshness: z.record(z.string(), z.unknown()).default({}),
    failureMode: contextBundleFailureModeSchema,
    metadata: z.record(z.string(), z.unknown()).default({}),
    archivedAt: z.string().datetime().nullable().default(null),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict()
  .superRefine(rejectForbiddenContextBundleMountPath);
export type ContextBundle = z.infer<typeof contextBundleSchema>;

export const projectRuntimeConfigSchema = z
  .object({
    provider: sandboxProviderSchema.default("docker"),
    image: z.string().min(1),
    contextBundleRefs: z.array(contextBundleRefSchema).default([]),
    mounts: z.array(runtimeMountSchema).default([]),
    exposedPorts: z.array(z.object({
      containerPort: z.number().int().positive(),
      hostBinding: z.string().min(1).optional(),
      name: z.string().min(1).optional(),
    }).strict()).default([]),
    cache: z.object({
      coldStartAllowed: z.boolean().default(true),
      entries: z.array(z.object({
        kind: z.string().min(1),
        target: z.string().min(1),
      }).strict()).default([]),
    }).strict().default({ coldStartAllowed: true, entries: [] }),
    secretRefs: z.array(runtimeSecretRefSchema).default([]),
    overridePolicy: z.object({
      allowImageOverride: z.boolean().default(false),
      allowContextBundleAdditions: z.boolean().default(false),
      allowedContextBundleSlugs: z.array(z.string().min(1)).default([]),
    }).strict().default({
      allowImageOverride: false,
      allowContextBundleAdditions: false,
      allowedContextBundleSlugs: [],
    }),
    metadata: z.record(z.string(), z.unknown()).default({}),
  })
  .strict();
export type ProjectRuntimeConfig = z.infer<typeof projectRuntimeConfigSchema>;

export const taskRuntimeOverrideSchema = z
  .object({
    runtimeProfile: z.string().min(1).optional(),
    provider: sandboxProviderSchema.optional(),
    image: z.string().min(1).optional(),
    contextBundleRefs: z.array(contextBundleRefSchema).optional(),
    metadata: z.record(z.string(), z.unknown()).default({}),
  })
  .strict();
export type TaskRuntimeOverride = z.infer<typeof taskRuntimeOverrideSchema>;

export const resolvedRuntimeContractSchema = z
  .object({
    provider: sandboxProviderSchema,
    environment: z.object({
      image: z.string().min(1),
      pullPolicy: z.enum(["if-not-present", "always", "never"]).optional(),
      metadata: z.record(z.string(), z.unknown()).default({}),
    }).strict(),
    contextBundles: z.array(z.object({
      slug: z.string().min(1),
      required: z.boolean(),
      accessMode: contextBundleAccessModeSchema,
      mountPath: z.string().min(1).optional(),
      source: contextBundleSourceSchema,
      failureMode: contextBundleFailureModeSchema,
    }).strict()).default([]),
    mounts: z.array(runtimeMountSchema).default([]),
    exposedPorts: z.array(z.object({
      containerPort: z.number().int().positive(),
      hostBinding: z.string().min(1).optional(),
      name: z.string().min(1).optional(),
    }).strict()).default([]),
    cache: z.object({
      coldStartAllowed: z.boolean().default(true),
      entries: z.array(z.object({
        kind: z.string().min(1),
        target: z.string().min(1),
      }).strict()).default([]),
    }).strict().default({ coldStartAllowed: true, entries: [] }),
    secrets: z.array(runtimeSecretRefSchema).default([]),
    limits: z.object({
      runTimeoutSeconds: z.number().int().positive().optional(),
      containerCpuQuota: z.number().int().positive().optional(),
      containerMemoryGb: z.number().int().positive().optional(),
    }).strict().optional(),
  })
  .strict();
export type ResolvedRuntimeContract = z.infer<typeof resolvedRuntimeContractSchema>;

export const platformCapabilitiesSchema = z
  .object({
    agents: z.array(agentNameSchema).min(1),
    executor: runnerExecutorSchema,
    image: z.string().min(1).optional(),
    providers: z.array(sandboxProviderSchema).default([]),
    contextBundleModes: z.array(contextBundleAccessModeSchema).default([]),
    mountKinds: z.array(runtimeMountKindSchema).default([]),
    portExposure: z.object({
      supportsDynamicHostPorts: z.boolean().default(false),
    }).strict().default({ supportsDynamicHostPorts: false }),
    secretInjectionModes: z.array(z.enum(["env", "file"])).default([]),
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

const jsonObjectSchema = z.record(z.string(), z.unknown());

export const projectSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string().min(1),
    slug: z.string().min(1),
    repo: z.string().min(1),
    baseBranch: z.string().min(1).default("main"),
    defaultAgent: agentNameSchema,
    runtime: projectRuntimeConfigSchema,
    prewarmConfig: jsonObjectSchema.default({}),
    metadata: jsonObjectSchema.default({}),
    archivedAt: z.string().datetime().nullable().default(null),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict();
export type Project = z.infer<typeof projectSchema>;

export const projectCreateSchema = z
  .object({
    name: z.string().min(1),
    slug: z.string().min(1),
    repo: z.string().min(1),
    baseBranch: z.string().min(1).default("main"),
    defaultAgent: agentNameSchema,
    runtime: projectRuntimeConfigSchema,
    prewarmConfig: jsonObjectSchema.default({}),
    metadata: jsonObjectSchema.default({}),
  })
  .strict();
export type ProjectCreate = z.infer<typeof projectCreateSchema>;

export const projectUpdateSchema = z
  .object({
    name: z.string().min(1).optional(),
    slug: z.string().min(1).optional(),
    repo: z.string().min(1).optional(),
    baseBranch: z.string().min(1).optional(),
    defaultAgent: agentNameSchema.optional(),
    runtime: projectRuntimeConfigSchema.optional(),
    prewarmConfig: jsonObjectSchema.optional(),
    metadata: jsonObjectSchema.optional(),
    archivedAt: z.string().datetime().nullable().optional(),
  })
  .strict();
export type ProjectUpdate = z.infer<typeof projectUpdateSchema>;

export const taskSpecSchema = z
  .object({
    taskId: z.string().min(1),
    source: taskSourceSchema,
    projectId: z.string().uuid(),
    repo: z.string().min(1).optional(),
    baseBranch: z.string().min(1).optional(),
    branchName: z.string().min(1),
    agent: agentNameSchema.optional(),
    prompt: z.string().min(1),
    mergeRequest: mergeRequestSpecSchema.optional(),
    runtime: taskRuntimeOverrideSchema.optional(),
    metadata: jsonObjectSchema.default({}),
  })
  .strict();
export type TaskSpec = z.infer<typeof taskSpecSchema>;

export const runnerRegistrationSchema = z
  .object({
    runnerName: z.string().min(1),
    capabilities: platformCapabilitiesSchema,
    maxConcurrency: z.number().int().positive().default(1),
    staleAfterSeconds: z.number().int().positive().default(90),
    eligibleProjectIds: z.array(z.string().uuid()).optional(),
    eligibleRuntimeProviders: z.array(z.string().min(1)).optional(),
  })
  .strict();
export type RunnerRegistration = z.infer<typeof runnerRegistrationSchema>;

export const runnerPollRequestSchema = z
  .object({
    runnerSessionId: z.string().uuid(),
    maxTasks: z.number().int().positive().default(1),
  })
  .strict();
export type RunnerPollRequest = z.infer<typeof runnerPollRequestSchema>;

// --- 003-config-first-runner-durability: Runner Local Config ---

export const runnerLocalConfigSchema = z
  .object({
    runnerName: z.string().min(1),
    concurrency: z.number().int().positive().default(1),
    pollIntervalSeconds: z.number().int().positive().default(5),
    staleAfterSeconds: z.number().int().positive().default(90),
    defaultExecutionTimeoutSeconds: z.number().int().positive().default(3600),
    cancelCheckIntervalSeconds: z.number().int().positive().default(10),
    cleanupTimeoutSeconds: z.number().int().positive().default(30),
    eligibleProjectIds: z.array(z.string().uuid()).optional(),
    eligibleRuntimeProviders: z.array(z.string().min(1)).optional(),
  })
  .strict();
export type RunnerLocalConfig = z.infer<typeof runnerLocalConfigSchema>;

// --- 003-config-first-runner-durability: Cancellation Outcome ---

export const cancelTaskOutcomeSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("canceled") }).strict(),
  z.object({ kind: z.literal("cancellation_requested") }).strict(),
]);
export type CancelTaskOutcome = z.infer<typeof cancelTaskOutcomeSchema>;

// --- 003-config-first-runner-durability: Runner Observation ---

export const runnerObservationSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("cleanup.started"),
      reason: z.enum(["cancel", "timeout"]),
    })
    .strict(),
  z
    .object({
      type: z.literal("run.canceled"),
      summary: z.string().min(1),
    })
    .strict(),
  z
    .object({
      type: z.literal("run.timed_out"),
      summary: z.string().min(1),
    })
    .strict(),
  z
    .object({
      type: z.literal("run.cleanup_failed"),
      summary: z.string().min(1),
    })
    .strict(),
]);
export type RunnerObservation = z.infer<typeof runnerObservationSchema>;

// --- 003-config-first-runner-durability: Stale Marking Result ---

export const staleMarkingResultSchema = z
  .object({
    runnerSessionId: z.string().uuid(),
    staleRunIds: z.array(z.string().uuid()),
  })
  .strict();
export type StaleMarkingResult = z.infer<typeof staleMarkingResultSchema>;

// --- 003-config-first-runner-durability: Cancellation Request Metadata ---

export const cancellationRequestMetadataSchema = z
  .object({
    requestedAt: z.string().datetime(),
    requestedBy: z.string().min(1).optional(),
  })
  .strict();
export type CancellationRequestMetadata = z.infer<typeof cancellationRequestMetadataSchema>;

// --- 003-config-first-runner-durability: Runner Eligibility ---

export const runnerEligibilitySchema = z
  .object({
    eligibleProjectIds: z.array(z.string().uuid()).optional(),
    eligibleRuntimeProviders: z.array(z.string().min(1)).optional(),
  })
  .strict();
export type RunnerEligibility = z.infer<typeof runnerEligibilitySchema>;
