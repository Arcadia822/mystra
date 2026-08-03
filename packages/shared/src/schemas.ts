import { z } from "zod";

import { issueSnapshotSchema } from "./issue-core.js";
import {
  repositorySelectorSchema,
  repositorySnapshotSchema,
} from "./repository.js";

export const agentNameSchema = z.enum(["codex", "copilot"]);
export type AgentName = z.infer<typeof agentNameSchema>;

export const taskSourceSchema = z.enum(["mcp", "api", "issue"]);
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

export const contextBundleAccessModeSchema = z.enum(["read-only", "session-scoped"]);
export type ContextBundleAccessMode = z.infer<typeof contextBundleAccessModeSchema>;

export const contextBundleFailureModeSchema = z.enum(["fail-session", "warn"]);
export type ContextBundleFailureMode = z.infer<typeof contextBundleFailureModeSchema>;

const safePathSegmentPattern = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

function hasOnlySafeRelativePathSegments(value: string): boolean {
  return value.split(/[\\/]/).every((segment) => safePathSegmentPattern.test(segment));
}

function isSafePathSegment(value: string): boolean {
  return safePathSegmentPattern.test(value);
}

function requireContextBundleSourceRef(
  source: { kind: "local-template" | "external-artifact" | "session-inline"; ref?: string | undefined },
  ctx: z.RefinementCtx,
): void {
  if (source.kind === "session-inline") {
    return;
  }

  if (!source.ref) {
    ctx.addIssue({
      code: "custom",
      message: `Context bundle source ref is required for ${source.kind}`,
      path: ["ref"],
    });
    return;
  }
}

function rejectUnsafeContextBundleSourceRef(
  source: { kind: "local-template" | "external-artifact" | "session-inline"; ref?: string | undefined },
  ctx: z.RefinementCtx,
): void {
  if (source.kind === "session-inline" || !source.ref) {
    return;
  }

  if (
    source.ref.startsWith("/")
    || source.ref.startsWith("\\")
    || source.ref.includes("://")
    || !hasOnlySafeRelativePathSegments(source.ref)
  ) {
    ctx.addIssue({
      code: "custom",
      message: "Filesystem context bundle refs must use safe relative paths",
      path: ["ref"],
    });
  }
}

const contextBundleSourceBaseSchema = z
  .object({
    kind: z.enum(["local-template", "external-artifact", "session-inline"]),
    ref: z.string().min(1).optional(),
    metadata: z.record(z.string(), z.unknown()).default({}),
  })
  .strict();

export const contextBundleSourceSchema = contextBundleSourceBaseSchema.superRefine(requireContextBundleSourceRef);
export const contextBundleCreateSourceSchema = contextBundleSourceBaseSchema.superRefine((source, ctx) => {
  requireContextBundleSourceRef(source, ctx);
  rejectUnsafeContextBundleSourceRef(source, ctx);
  if (source.kind === "session-inline") {
    const parsed = sessionInlineContextBundlePayloadSchema.safeParse(source.metadata.sessionInline);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        ctx.addIssue({
          ...issue,
          path: ["metadata", "sessionInline", ...issue.path],
        });
      }
    }
  }
});
export type ContextBundleSource = z.infer<typeof contextBundleSourceSchema>;

function rejectUnsafeBundleFilePath(file: { path: string }, ctx: z.RefinementCtx): void {
  if (
    file.path.startsWith("/")
    || !hasOnlySafeRelativePathSegments(file.path)
  ) {
    ctx.addIssue({
      code: "custom",
      message: "Inline context bundle files must use safe relative paths",
      path: ["path"],
    });
  }
}

export const contextBundleInlineFileSchema = z
  .object({
    path: z.string().min(1),
    content: z.string(),
  })
  .strict()
  .superRefine(rejectUnsafeBundleFilePath);
export type ContextBundleInlineFile = z.infer<typeof contextBundleInlineFileSchema>;

export const sessionInlineContextBundlePayloadSchema = z
  .object({
    files: z.array(contextBundleInlineFileSchema).min(1),
  })
  .strict();
export type SessionInlineContextBundlePayload = z.infer<typeof sessionInlineContextBundlePayloadSchema>;

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

export const executionSpecBundleSlug = "execution-spec";
export const executionSpecFileName = "execution-spec.json";
export const executionSpecMountPath = "/mystra/context/execution-spec";

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

    if (mount.kind === "contextBundle" && mount.sourceRef && !isSafePathSegment(mount.sourceRef)) {
      ctx.addIssue({
        code: "custom",
        message: "Context bundle mount sourceRef must use a single safe path segment",
        path: ["sourceRef"],
      });
    }
  });
export type RuntimeMount = z.infer<typeof runtimeMountSchema>;

export const runtimeMountInputSchema = runtimeMountSchema.superRefine((mount, ctx) => {
  if (mount.kind === "contextBundle" && !mount.sourceRef) {
    ctx.addIssue({
      code: "custom",
      message: "Context bundle mounts must include sourceRef",
      path: ["sourceRef"],
    });
  }
});

export const contextBundleRefSchema = z
  .object({
    slug: z.string().min(1),
    required: z.boolean().default(true),
    accessMode: contextBundleAccessModeSchema.default("read-only"),
  })
  .strict()
  .superRefine((bundleRef, ctx) => {
    rejectUnsafeContextBundleSlug(bundleRef, ctx);
    rejectReservedContextBundleFields(bundleRef, ctx);
  });
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

function rejectReservedContextBundleFields(
  bundle: { slug: string; mountPath?: string | undefined },
  ctx: z.RefinementCtx,
): void {
  if (bundle.slug === executionSpecBundleSlug) {
    ctx.addIssue({
      code: "custom",
      message: `Context bundle slug is reserved for system-managed execution contracts: ${executionSpecBundleSlug}`,
      path: ["slug"],
    });
  }

  if (bundle.mountPath === executionSpecMountPath) {
    ctx.addIssue({
      code: "custom",
      message: `Context bundle mount path is reserved for system-managed execution contracts: ${executionSpecMountPath}`,
      path: ["mountPath"],
    });
  }
}

function rejectUnsafeContextBundleSlug(
  bundle: { slug: string },
  ctx: z.RefinementCtx,
): void {
  if (!isSafePathSegment(bundle.slug)) {
    ctx.addIssue({
      code: "custom",
      message: "Context bundle slugs must use a single safe path segment",
      path: ["slug"],
    });
  }
}

export const contextBundleCreateSchema = z
  .object({
    slug: z.string().min(1),
    displayName: z.string().min(1),
    source: contextBundleCreateSourceSchema,
    accessMode: contextBundleAccessModeSchema,
    mountPath: z.string().min(1).optional(),
    freshness: z.record(z.string(), z.unknown()).default({}),
    failureMode: contextBundleFailureModeSchema,
    metadata: z.record(z.string(), z.unknown()).default({}),
    archivedAt: z.string().datetime().nullable().default(null),
  })
  .strict()
  .superRefine((bundle, ctx) => {
    rejectForbiddenContextBundleMountPath(bundle, ctx);
    rejectUnsafeContextBundleSlug(bundle, ctx);
    rejectReservedContextBundleFields(bundle, ctx);
  });
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

export const projectRuntimeConfigInputSchema = z
  .object({
    provider: sandboxProviderSchema.default("docker"),
    image: z.string().min(1),
    contextBundleRefs: z.array(contextBundleRefSchema).default([]),
    mounts: z.array(runtimeMountInputSchema).default([]),
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

export const sessionRuntimeOverrideSchema = z
  .object({
    runtimeProfile: z.string().min(1).optional(),
    provider: sandboxProviderSchema.optional(),
    image: z.string().min(1).optional(),
    contextBundleRefs: z.array(contextBundleRefSchema).optional(),
    metadata: z.record(z.string(), z.unknown()).default({}),
  })
  .strict();
export type SessionRuntimeOverride = z.infer<typeof sessionRuntimeOverrideSchema>;

export const executionContractReferenceSchema = z
  .object({
    kind: z.literal("execution-spec"),
    artifactId: z.string().uuid(),
    uri: z.string().min(1),
    bundleSlug: z.string().min(1),
    mountPath: z.string().min(1),
    filePath: z.string().min(1),
    frozenAt: z.string().datetime(),
  })
  .strict();
export type ExecutionContractReference = z.infer<typeof executionContractReferenceSchema>;

export const executionSpecArtifactSchema = z
  .object({
    version: z.literal(3),
    kind: z.literal("execution-spec"),
    taskId: z.string().uuid(),
    sessionId: z.string().uuid(),
    source: taskSourceSchema,
    projectId: z.string().uuid(),
    repository: repositorySnapshotSchema,
    baseBranch: z.string().min(1),
    branch: z.string().min(1),
    agent: agentNameSchema,
    objective: z.string().min(1),
    issue: issueSnapshotSchema.optional(),
    dispatchKey: z.string().min(1).max(1_000).optional(),
    mergeRequest: mergeRequestSpecSchema.optional(),
    metadata: z.record(z.string(), z.unknown()).default({}),
    frozenAt: z.string().datetime(),
    executionContract: executionContractReferenceSchema,
  })
  .strict()
  .superRefine((artifact, ctx) => {
    if (artifact.source === "issue" && (!artifact.issue || !artifact.dispatchKey)) {
      ctx.addIssue({
        code: "custom",
        message: "Issue-driven execution specs require issue and dispatchKey",
        path: ["issue"],
      });
    }
  });
export type ExecutionSpecArtifact = z.infer<typeof executionSpecArtifactSchema>;

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
    executionContract: executionContractReferenceSchema.optional(),
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
      sessionTimeoutSeconds: z.number().int().positive().optional(),
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
    sessionTimeoutSeconds: z.number().int().positive().default(3600),
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
    repository: repositorySnapshotSchema,
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
    repository: repositorySnapshotSchema,
    baseBranch: z.string().min(1).default("main"),
    defaultAgent: agentNameSchema,
    runtime: projectRuntimeConfigInputSchema,
    prewarmConfig: jsonObjectSchema.default({}),
    metadata: jsonObjectSchema.default({}),
  })
  .strict();
export type ProjectCreate = z.infer<typeof projectCreateSchema>;

export const projectCreateRequestSchema = z
  .object({
    name: z.string().min(1),
    slug: z.string().min(1),
    repository: repositorySelectorSchema,
    baseBranch: z.string().min(1).optional(),
    defaultAgent: agentNameSchema,
    runtime: projectRuntimeConfigInputSchema,
    prewarmConfig: jsonObjectSchema.default({}),
    metadata: jsonObjectSchema.default({}),
  })
  .strict();
export type ProjectCreateRequest = z.input<typeof projectCreateRequestSchema>;

export const projectUpdateSchema = z
  .object({
    name: z.string().min(1).optional(),
    slug: z.string().min(1).optional(),
    repository: repositorySnapshotSchema.optional(),
    baseBranch: z.string().min(1).optional(),
    defaultAgent: agentNameSchema.optional(),
    runtime: projectRuntimeConfigInputSchema.optional(),
    prewarmConfig: jsonObjectSchema.optional(),
    metadata: jsonObjectSchema.optional(),
    archivedAt: z.string().datetime().nullable().optional(),
  })
  .strict();
export type ProjectUpdate = z.infer<typeof projectUpdateSchema>;

export const projectUpdateRequestSchema = z
  .object({
    name: z.string().min(1).optional(),
    slug: z.string().min(1).optional(),
    repository: repositorySelectorSchema.optional(),
    baseBranch: z.string().min(1).optional(),
    defaultAgent: agentNameSchema.optional(),
    runtime: projectRuntimeConfigInputSchema.optional(),
    prewarmConfig: jsonObjectSchema.optional(),
    metadata: jsonObjectSchema.optional(),
    archivedAt: z.string().datetime().nullable().optional(),
  })
  .strict();
export type ProjectUpdateRequest = z.input<typeof projectUpdateRequestSchema>;

const taskCreateBaseSchema = z
  .object({
    source: taskSourceSchema,
    projectId: z.string().uuid(),
    objective: z.string().min(1),
    issue: issueSnapshotSchema.optional(),
    dispatchKey: z.string().min(1).max(1_000).optional(),
    metadata: jsonObjectSchema.default({}),
  })
  .strict();

function validateIssueDrivenTask(
  task: {
    source: z.infer<typeof taskSourceSchema>;
    issue?: z.infer<typeof issueSnapshotSchema> | undefined;
    dispatchKey?: string | undefined;
  },
  ctx: z.RefinementCtx,
): void {
    if (task.source === "issue" && (!task.issue || !task.dispatchKey)) {
      ctx.addIssue({
        code: "custom",
        message: "Issue-driven Tasks require issue and dispatchKey",
        path: ["issue"],
      });
    }
    if (task.source !== "issue" && (task.issue || task.dispatchKey)) {
      ctx.addIssue({
        code: "custom",
        message: "Only Issue-driven Tasks may include issue or dispatchKey",
        path: ["source"],
      });
    }
}

export const taskCreateRequestSchema = taskCreateBaseSchema
  .omit({ issue: true, dispatchKey: true })
  .extend({ source: z.enum(["api", "mcp"]) })
  .strict();
export type TaskCreateRequest = z.input<typeof taskCreateRequestSchema>;

export const taskCreateSchema = taskCreateBaseSchema
  .extend({
    repository: repositorySnapshotSchema,
  })
  .strict()
  .superRefine(validateIssueDrivenTask);
export type TaskCreate = z.infer<typeof taskCreateSchema>;

export const sessionCreateRequestSchema = z
  .object({
    title: z.string().min(1),
    objective: z.string().min(1),
    agent: agentNameSchema.optional(),
    branch: z.string().min(1).optional(),
    mergeRequest: mergeRequestSpecSchema.optional(),
    runtime: sessionRuntimeOverrideSchema.optional(),
    metadata: jsonObjectSchema.default({}),
  })
  .strict();
export type SessionCreateRequest = z.input<typeof sessionCreateRequestSchema>;

export const sessionCreateSchema = sessionCreateRequestSchema
  .extend({
    taskId: z.string().uuid(),
    agent: agentNameSchema,
    branch: z.string().min(1),
  })
  .strict();
export type SessionCreate = z.infer<typeof sessionCreateSchema>;

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
    runnerId: z.string().uuid(),
    maxSessions: z.number().int().positive().default(1),
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

export const cancelSessionOutcomeSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("canceled") }).strict(),
  z.object({ kind: z.literal("cancellation_requested") }).strict(),
]);
export type CancelSessionOutcome = z.infer<typeof cancelSessionOutcomeSchema>;

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
      type: z.literal("session.canceled"),
      summary: z.string().min(1),
    })
    .strict(),
  z
    .object({
      type: z.literal("session.timed_out"),
      summary: z.string().min(1),
    })
    .strict(),
  z
    .object({
      type: z.literal("session.cleanup_failed"),
      summary: z.string().min(1),
    })
    .strict(),
]);
export type RunnerObservation = z.infer<typeof runnerObservationSchema>;

// --- 003-config-first-runner-durability: Stale Marking Result ---

export const staleMarkingResultSchema = z
  .object({
    runnerId: z.string().uuid(),
    staleSessionIds: z.array(z.string().uuid()),
  })
  .strict();
export type StaleMarkingResult = z.infer<typeof staleMarkingResultSchema>;

// --- 003-config-first-runner-durability: Cancellation Request Metadata ---

export const cancellationRequestMetadataSchema = z
  .object({
    requestedAt: z.string().datetime(),
    requestedBy: z.string().min(1).optional(),
    reason: z.string().min(1).optional(),
  })
  .strict();
export type CancellationRequestMetadata = z.infer<typeof cancellationRequestMetadataSchema>;

export const sessionCancellationRequestSchema = z
  .object({
    requestedBy: z.string().min(1).optional(),
    reason: z.string().min(1).optional(),
  })
  .strict();
export type SessionCancellationRequest = z.input<typeof sessionCancellationRequestSchema>;

// --- 003-config-first-runner-durability: Runner Eligibility ---

export const runnerEligibilitySchema = z
  .object({
    eligibleProjectIds: z.array(z.string().uuid()).optional(),
    eligibleRuntimeProviders: z.array(z.string().min(1)).optional(),
  })
  .strict();
export type RunnerEligibility = z.infer<typeof runnerEligibilitySchema>;
