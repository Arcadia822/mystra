import { describe, expect, it } from "vitest";

import {
  agentNameSchema,
  cancelJobOutcomeSchema,
  cancellationRequestMetadataSchema,
  contextBundleCreateSchema,
  executionSpecArtifactSchema,
  executionSpecBundleSlug,
  executionSpecMountPath,
  contextBundleSchema,
  jobInlineContextBundlePayloadSchema,
  jobSpecSchema,
  jobRuntimeOverrideSchema,
  platformCapabilitiesSchema,
  platformDefaultsSchema,
  projectCreateSchema,
  projectRuntimeConfigSchema,
  projectSchema,
  projectUpdateSchema,
  resolvedRuntimeContractSchema,
  runnerEligibilitySchema,
  runnerLocalConfigSchema,
  runnerObservationSchema,
  runnerRegistrationSchema,
  staleMarkingResultSchema,
} from "./schemas.js";

describe("jobSpecSchema", () => {
  it("accepts a minimal API job with projectId and a task-provided branch name", () => {
    const parsed = jobSpecSchema.parse({
      taskId: "task-1",
      source: "api",
      projectId: "00000000-0000-4000-8000-000000000001",
      branchName: "feature/mystra-task-1",
      prompt: "Update the README",
    });

    expect(parsed.projectId).toBe("00000000-0000-4000-8000-000000000001");
    expect(parsed.baseBranch).toBeUndefined();
    expect(parsed.agent).toBeUndefined();
    expect(parsed.metadata).toEqual({});
    expect(parsed.branchName).toBe("feature/mystra-task-1");
  });

  it("does not sanitize task-provided branch names", () => {
    const parsed = jobSpecSchema.parse({
      taskId: "task-2",
      source: "mcp",
      projectId: "00000000-0000-4000-8000-000000000002",
      repo: "gitlab.example.com/group/project",
      baseBranch: "develop",
      branchName: "UPPER/space allowed by task",
      agent: "copilot",
      prompt: "Make the requested change",
    });

    expect(parsed.branchName).toBe("UPPER/space allowed by task");
    expect(parsed.baseBranch).toBe("develop");
    expect(parsed.agent).toBe("copilot");
  });

  it("rejects jobs without a branch name", () => {
    expect(() =>
      jobSpecSchema.parse({
        taskId: "task-3",
        source: "api",
        projectId: "00000000-0000-4000-8000-000000000003",
        prompt: "Update the README",
      }),
    ).toThrow();
  });

  it("rejects jobs without a projectId", () => {
    expect(() =>
      jobSpecSchema.parse({
        taskId: "task-missing-project",
        source: "api",
        branchName: "feature/missing-project",
        prompt: "Update the README",
      }),
    ).toThrow();
  });

  it("rejects agents outside the MVP adapter set", () => {
    expect(() => agentNameSchema.parse("claude")).toThrow();
    expect(() => agentNameSchema.parse("opencode")).toThrow();
  });

  it("rejects callback URLs because callbacks are not in the MVP contract", () => {
    expect(() =>
      jobSpecSchema.parse({
        taskId: "task-4",
        source: "api",
        projectId: "00000000-0000-4000-8000-000000000004",
        branchName: "feature/task-4",
        prompt: "Update the README",
        callbackUrl: "https://example.com/callback",
      }),
    ).toThrow();
  });
});

describe("platformCapabilitiesSchema", () => {
  it("accepts typed runner capabilities", () => {
    const parsed = platformCapabilitiesSchema.parse({
      agents: ["codex", "copilot"],
      executor: "docker",
      image: "ghcr.io/acme/mystra-runner:latest",
      providers: ["docker"],
      contextBundleModes: ["read-only"],
      mountKinds: ["workspace", "gitMirror"],
      portExposure: { supportsDynamicHostPorts: true },
      secretInjectionModes: ["env"],
    });

    expect(parsed.agents).toEqual(["codex", "copilot"]);
    expect(parsed.executor).toBe("docker");
    expect(parsed.image).toBe("ghcr.io/acme/mystra-runner:latest");
    expect(parsed.providers).toEqual(["docker"]);
    expect(parsed.contextBundleModes).toEqual(["read-only"]);
    expect(parsed.mountKinds).toEqual(["workspace", "gitMirror"]);
    expect(parsed.portExposure.supportsDynamicHostPorts).toBe(true);
    expect(parsed.secretInjectionModes).toEqual(["env"]);
  });

  it("accepts capabilities without an image override", () => {
    const parsed = platformCapabilitiesSchema.parse({
      agents: ["codex"],
      executor: "fake",
    });

    expect(parsed.image).toBeUndefined();
    expect(parsed.providers).toEqual([]);
  });

  it("rejects unknown capability keys", () => {
    expect(() =>
      platformCapabilitiesSchema.parse({
        agents: ["codex"],
        executor: "docker",
        skills: ["gnhf"],
      }),
    ).toThrow();
  });

  it("rejects empty agent lists", () => {
    expect(() =>
      platformCapabilitiesSchema.parse({
        agents: [],
        executor: "docker",
      }),
    ).toThrow();
  });

  it("rejects unsupported executors", () => {
    expect(() =>
      platformCapabilitiesSchema.parse({
        agents: ["codex"],
        executor: "kubernetes",
      }),
    ).toThrow();
  });

  it("rejects unsupported runtime capability values", () => {
    expect(() =>
      platformCapabilitiesSchema.parse({
        agents: ["codex"],
        executor: "docker",
        providers: ["kubernetes"],
      }),
    ).toThrow();
    expect(() =>
      platformCapabilitiesSchema.parse({
        agents: ["codex"],
        executor: "docker",
        mountKinds: ["dockerSocket"],
      }),
    ).toThrow();
    expect(() =>
      platformCapabilitiesSchema.parse({
        agents: ["codex"],
        executor: "docker",
        contextBundleModes: ["mutable"],
      }),
    ).toThrow();
    expect(() =>
      platformCapabilitiesSchema.parse({
        agents: ["codex"],
        executor: "docker",
        secretInjectionModes: ["vault"],
      }),
    ).toThrow();
  });
});

describe("runtime schemas", () => {
  it("accepts Project-owned Docker runtime config", () => {
    const parsed = projectRuntimeConfigSchema.parse({
      provider: "docker",
      image: "registry.example.com/castrel/runtime:latest",
      contextBundleRefs: [{ slug: "agent-skills", required: true, accessMode: "read-only" }],
      mounts: [{ kind: "workspace", target: "/mystra/workspace", readOnly: false }],
      secretRefs: [{ name: "MYSTRA_GITLAB_TOKEN", mode: "env" }],
    });

    expect(parsed.image).toBe("registry.example.com/castrel/runtime:latest");
    expect(parsed.overridePolicy.allowImageOverride).toBe(false);
    expect(parsed.contextBundleRefs[0]?.slug).toBe("agent-skills");
    expect(parsed.mounts[0]?.owner).toBe("project");
  });

  it("accepts only constrained job runtime overrides", () => {
    const parsed = jobRuntimeOverrideSchema.parse({
      runtimeProfile: "frontend-dev",
      provider: "docker",
      image: "registry.example.com/castrel/frontend:latest",
      contextBundleRefs: [{ slug: "issue-context", accessMode: "job-scoped" }],
      metadata: { reason: "smoke-test" },
    });

    expect(parsed.runtimeProfile).toBe("frontend-dev");
    expect(parsed.contextBundleRefs?.[0]?.required).toBe(true);
  });

  it("rejects job runtime overrides for mount, secret, cache, or port mutation", () => {
    const base = {
      provider: "docker",
      image: "registry.example.com/castrel/runtime:latest",
    };

    expect(() => jobRuntimeOverrideSchema.parse({ ...base, mounts: [] })).toThrow();
    expect(() => jobRuntimeOverrideSchema.parse({ ...base, secretRefs: [] })).toThrow();
    expect(() => jobRuntimeOverrideSchema.parse({ ...base, cache: { entries: [] } })).toThrow();
    expect(() => jobRuntimeOverrideSchema.parse({ ...base, exposedPorts: [] })).toThrow();
  });

  it("rejects forbidden runtime mounts", () => {
    expect(() =>
      projectRuntimeConfigSchema.parse({
        provider: "docker",
        image: "registry.example.com/castrel/runtime:latest",
        mounts: [{ kind: "workspace", target: "/root/.codex", readOnly: true }],
      }),
    ).toThrow();

    expect(() =>
      projectRuntimeConfigSchema.parse({
        provider: "docker",
        image: "registry.example.com/castrel/runtime:latest",
        mounts: [{ kind: "workspace", target: "/var/run/docker.sock", readOnly: true }],
      }),
    ).toThrow();
  });

  it("accepts resolved runtime contracts for runner claims", () => {
    const parsed = resolvedRuntimeContractSchema.parse({
      provider: "docker",
      environment: {
        image: "mystra-runner:local",
      },
      contextBundles: [],
      executionContract: {
        kind: "execution-spec",
        artifactId: "00000000-0000-4000-8000-000000000080",
        uri: "mystra://runs/run-1/artifacts/execution-spec.json",
        bundleSlug: "execution-spec",
        mountPath: "/mystra/context/execution-spec",
        filePath: "/mystra/context/execution-spec/execution-spec.json",
        frozenAt: "2026-05-18T00:00:00.000Z",
      },
      mounts: [],
      exposedPorts: [{ containerPort: 3000, hostBinding: "0.0.0.0::3000" }],
      cache: { coldStartAllowed: true, entries: [] },
      secrets: [{ name: "MYSTRA_GITLAB_TOKEN", mode: "env" }],
    });

    expect(parsed.environment.image).toBe("mystra-runner:local");
    expect(parsed.environment.metadata).toEqual({});
    expect(parsed.executionContract?.bundleSlug).toBe("execution-spec");
  });

  it("rejects unsafe context bundle mount source refs in resolved runtime contracts", () => {
    expect(() =>
      resolvedRuntimeContractSchema.parse({
        provider: "docker",
        environment: {
          image: "mystra-runner:local",
        },
        contextBundles: [],
        mounts: [{
          kind: "contextBundle",
          target: "/mystra/skills",
          sourceRef: "agent-skills/v2",
          readOnly: true,
        }],
        exposedPorts: [],
        cache: { coldStartAllowed: true, entries: [] },
        secrets: [],
      }),
    ).toThrow(/single safe path segment/);
  });

  it("accepts context bundle definitions and create payloads", () => {
    const created = contextBundleCreateSchema.parse({
      slug: "agent-skills",
      displayName: "Agent Skills",
      source: { kind: "local-template", ref: "agent-skills" },
      accessMode: "read-only",
      mountPath: "/mystra/skills",
      failureMode: "fail-run",
    });

    expect(created.archivedAt).toBeNull();
    expect(created.source.metadata).toEqual({});

    const persisted = contextBundleSchema.parse({
      id: "00000000-0000-4000-8000-000000000020",
      ...created,
      createdAt: "2026-05-09T00:00:00.000Z",
      updatedAt: "2026-05-09T00:00:00.000Z",
    });

    expect(persisted.mountPath).toBe("/mystra/skills");
  });

  it("rejects context bundle mount paths that target host home or Docker socket", () => {
    expect(() =>
      contextBundleCreateSchema.parse({
        slug: "bad-home",
        displayName: "Bad Home",
        source: { kind: "local-template", ref: "bad-home" },
        accessMode: "read-only",
        mountPath: "/root/.codex",
        failureMode: "fail-run",
      }),
    ).toThrow();

    expect(() =>
      contextBundleCreateSchema.parse({
        slug: "bad-docker",
        displayName: "Bad Docker",
        source: { kind: "local-template", ref: "bad-docker" },
        accessMode: "read-only",
        mountPath: "/var/run/docker.sock",
        failureMode: "fail-run",
      }),
    ).toThrow();
  });

  it("accepts execution-spec artifacts and safe inline bundle payloads", () => {
    const payload = jobInlineContextBundlePayloadSchema.parse({
      files: [{ path: "execution-spec.json", content: "{\"taskId\":\"task-1\"}" }],
    });
    expect(payload.files[0]?.path).toBe("execution-spec.json");

    const artifact = executionSpecArtifactSchema.parse({
      version: 1,
      kind: "execution-spec",
      jobId: "00000000-0000-4000-8000-000000000091",
      runId: "00000000-0000-4000-8000-000000000092",
      taskId: "task-1",
      source: "api",
      projectId: "00000000-0000-4000-8000-000000000093",
      repo: "local/fixture",
      baseBranch: "main",
      branchName: "feature/execution-spec",
      agent: "codex",
      prompt: "Implement the approved spec",
      metadata: { sourceRevision: "spec-v1" },
      frozenAt: "2026-05-18T00:00:00.000Z",
      executionContract: {
        kind: "execution-spec",
        artifactId: "00000000-0000-4000-8000-000000000094",
        uri: "mystra://runs/00000000-0000-4000-8000-000000000092/artifacts/execution-spec.json",
        bundleSlug: "execution-spec",
        mountPath: "/mystra/context/execution-spec",
        filePath: "/mystra/context/execution-spec/execution-spec.json",
        frozenAt: "2026-05-18T00:00:00.000Z",
      },
    });
    expect(artifact.executionContract.filePath).toContain("execution-spec.json");
  });

  it("rejects unsafe inline bundle file paths", () => {
    expect(() =>
      jobInlineContextBundlePayloadSchema.parse({
        files: [{ path: "../execution-spec.json", content: "{}" }],
      }),
    ).toThrow();

    expect(() =>
      jobInlineContextBundlePayloadSchema.parse({
        files: [{ path: ".", content: "{}" }],
      }),
    ).toThrow(/safe relative paths/);
  });

  it("validates job-inline bundle payloads at create time", () => {
    const created = contextBundleCreateSchema.parse({
      slug: "inline-execution-plan",
      displayName: "Inline Execution Plan",
      source: {
        kind: "job-inline",
        metadata: {
          jobInline: {
            files: [{ path: "execution-spec.json", content: "{\"taskId\":\"task-1\"}" }],
          },
        },
      },
      accessMode: "job-scoped",
      mountPath: "/mystra/context/inline-plan",
      failureMode: "fail-run",
    });

    expect(created.source.metadata.jobInline).toEqual({
      files: [{ path: "execution-spec.json", content: "{\"taskId\":\"task-1\"}" }],
    });

    expect(() =>
      contextBundleCreateSchema.parse({
        slug: "bad-inline-plan",
        displayName: "Bad Inline Execution Plan",
        source: {
          kind: "job-inline",
          metadata: {
            jobInline: {
              files: [{ path: ".", content: "{}" }],
            },
          },
        },
        accessMode: "job-scoped",
        mountPath: "/mystra/context/bad-inline-plan",
        failureMode: "fail-run",
      }),
    ).toThrow(/safe relative paths/);
  });

  it("rejects reserved execution-spec bundle identifiers in create payloads", () => {
    expect(() =>
      contextBundleCreateSchema.parse({
        slug: executionSpecBundleSlug,
        displayName: "Conflicting Execution Spec",
        source: { kind: "local-template", ref: "conflicting-execution-spec" },
        accessMode: "read-only",
        failureMode: "fail-run",
      }),
    ).toThrow(/reserved/);

    expect(() =>
      contextBundleCreateSchema.parse({
        slug: "project-context",
        displayName: "Conflicting Execution Mount",
        source: { kind: "local-template", ref: "project-context" },
        accessMode: "read-only",
        mountPath: executionSpecMountPath,
        failureMode: "fail-run",
      }),
    ).toThrow(/reserved/);
  });

  it("rejects unsafe filesystem source refs and multi-segment slugs", () => {
    expect(() =>
      contextBundleCreateSchema.parse({
        slug: "agent-skills/v2",
        displayName: "Nested Slug",
        source: { kind: "local-template", ref: "templates/agent-skills" },
        accessMode: "read-only",
        failureMode: "fail-run",
      }),
    ).toThrow(/single safe path segment/);

    expect(() =>
      contextBundleCreateSchema.parse({
        slug: "agent-skills",
        displayName: "Absolute Source",
        source: { kind: "local-template", ref: "/tmp/agent-skills" },
        accessMode: "read-only",
        failureMode: "fail-run",
      }),
    ).toThrow(/safe relative paths/);

    expect(() =>
      contextBundleCreateSchema.parse({
        slug: "artifact-bundle",
        displayName: "Traversal Source",
        source: { kind: "external-artifact", ref: "../artifacts/spec.json" },
        accessMode: "read-only",
        failureMode: "fail-run",
      }),
    ).toThrow(/safe relative paths/);
  });
});

describe("platformDefaultsSchema", () => {
  it("applies MVP defaults", () => {
    const parsed = platformDefaultsSchema.parse({});

    expect(parsed).toEqual({
      maxConcurrency: 1,
      runTimeoutSeconds: 3600,
      heartbeatExpirySeconds: 90,
      longPollTimeoutSeconds: 25,
      containerCpuQuota: 4,
      containerMemoryGb: 8,
    });
  });

  it("rejects unknown default fields", () => {
    expect(() =>
      platformDefaultsSchema.parse({
        maxConcurrency: 2,
        retryCount: 3,
      }),
    ).toThrow();
  });

  it("rejects non-positive limits", () => {
    expect(() =>
      platformDefaultsSchema.parse({
        maxConcurrency: 0,
      }),
    ).toThrow();
  });
});

describe("projectSchema", () => {
  it("accepts a persisted project and applies JSON/archive defaults", () => {
    const parsed = projectSchema.parse({
      id: "00000000-0000-4000-8000-000000000010",
      name: "Castrel AI",
      slug: "castrel-ai",
      repo: "gitlab.example.com/group/project",
      defaultAgent: "copilot",
      runtime: {
        provider: "docker",
        image: "registry.example.com/castrel/runtime:latest",
      },
      createdAt: "2026-05-09T00:00:00.000Z",
      updatedAt: "2026-05-09T00:00:00.000Z",
    });

    expect(parsed.baseBranch).toBe("main");
    expect(parsed.archivedAt).toBeNull();
    expect(parsed.prewarmConfig).toEqual({});
    expect(parsed.metadata).toEqual({});
    expect(parsed.runtime.image).toBe("registry.example.com/castrel/runtime:latest");
  });

  it("accepts project create payloads with runtime.image", () => {
    const parsed = projectCreateSchema.parse({
      name: "Castrel AI",
      slug: "castrel-ai",
      repo: "gitlab.example.com/group/project",
      defaultAgent: "codex",
      runtime: {
        provider: "docker",
        image: "registry.example.com/castrel/runtime:latest",
      },
    });

    expect(parsed.runtime.image).toBe("registry.example.com/castrel/runtime:latest");
  });

  it("rejects project create payloads without runtime.image", () => {
    expect(() =>
      projectCreateSchema.parse({
        name: "Castrel AI",
        slug: "castrel-ai",
        repo: "gitlab.example.com/group/project",
        defaultAgent: "codex",
      }),
    ).toThrow();
  });

  it("rejects server-owned fields on create", () => {
    expect(() =>
      projectCreateSchema.parse({
        id: "00000000-0000-4000-8000-000000000011",
        name: "Castrel AI",
        slug: "castrel-ai",
        repo: "gitlab.example.com/group/project",
        defaultAgent: "codex",
        runtime: {
          provider: "docker",
          image: "registry.example.com/castrel/runtime:latest",
        },
      }),
    ).toThrow();
  });

  it("accepts update payloads that restore archived projects", () => {
    const parsed = projectUpdateSchema.parse({
      archivedAt: null,
      defaultAgent: "copilot",
    });

    expect(parsed.archivedAt).toBeNull();
    expect(parsed.defaultAgent).toBe("copilot");
  });

  it("rejects platform capability fields", () => {
    expect(() =>
      projectCreateSchema.parse({
        name: "Castrel AI",
        slug: "castrel-ai",
        repo: "gitlab.example.com/group/project",
        defaultAgent: "codex",
        runtime: {
          provider: "docker",
          image: "ghcr.io/acme/mystra-runner:latest",
        },
        executor: "docker",
      }),
    ).toThrow();
  });
});

describe("runnerRegistrationSchema", () => {
  it("requires typed platform capabilities", () => {
    const parsed = runnerRegistrationSchema.parse({
      runnerName: "runner-1",
      capabilities: {
        agents: ["codex", "copilot"],
        executor: "fake",
      },
    });

    expect(parsed.capabilities.executor).toBe("fake");
    expect(parsed.maxConcurrency).toBe(1);
  });

  it("rejects untyped capability bags", () => {
    expect(() =>
      runnerRegistrationSchema.parse({
        runnerName: "runner-2",
        capabilities: {
          supportsDocker: true,
        },
      }),
    ).toThrow();
  });
});

// --- 003-config-first-runner-durability schema tests ---

describe("runnerLocalConfigSchema", () => {
  it("applies MVP defaults for config-first runner", () => {
    const parsed = runnerLocalConfigSchema.parse({
      runnerName: "local-runner",
    });

    expect(parsed.concurrency).toBe(1);
    expect(parsed.pollIntervalSeconds).toBe(5);
    expect(parsed.staleAfterSeconds).toBe(90);
    expect(parsed.defaultExecutionTimeoutSeconds).toBe(3600);
    expect(parsed.cancelCheckIntervalSeconds).toBe(10);
    expect(parsed.cleanupTimeoutSeconds).toBe(30);
    expect(parsed.eligibleProjectIds).toBeUndefined();
    expect(parsed.eligibleRuntimeProviders).toBeUndefined();
  });

  it("accepts explicit concurrency and eligibility", () => {
    const parsed = runnerLocalConfigSchema.parse({
      runnerName: "gpu-runner",
      concurrency: 4,
      pollIntervalSeconds: 3,
      staleAfterSeconds: 120,
      defaultExecutionTimeoutSeconds: 7200,
      cancelCheckIntervalSeconds: 5,
      cleanupTimeoutSeconds: 60,
      eligibleProjectIds: ["00000000-0000-4000-8000-000000000001"],
      eligibleRuntimeProviders: ["docker"],
    });

    expect(parsed.concurrency).toBe(4);
    expect(parsed.eligibleProjectIds).toHaveLength(1);
    expect(parsed.eligibleRuntimeProviders).toEqual(["docker"]);
  });

  it("rejects non-positive concurrency", () => {
    expect(() =>
      runnerLocalConfigSchema.parse({
        runnerName: "bad-runner",
        concurrency: 0,
      }),
    ).toThrow();
  });

  it("rejects non-positive timeout values", () => {
    expect(() =>
      runnerLocalConfigSchema.parse({
        runnerName: "bad-runner",
        defaultExecutionTimeoutSeconds: -1,
      }),
    ).toThrow();

    expect(() =>
      runnerLocalConfigSchema.parse({
        runnerName: "bad-runner",
        cleanupTimeoutSeconds: 0,
      }),
    ).toThrow();
  });

  it("rejects unknown fields", () => {
    expect(() =>
      runnerLocalConfigSchema.parse({
        runnerName: "runner",
        retryCount: 3,
      }),
    ).toThrow();
  });
});

describe("cancelJobOutcomeSchema", () => {
  it("accepts immediate canceled outcome for queued work", () => {
    const parsed = cancelJobOutcomeSchema.parse({ kind: "canceled" });
    expect(parsed.kind).toBe("canceled");
  });

  it("accepts cancellation_requested outcome for runner-owned work", () => {
    const parsed = cancelJobOutcomeSchema.parse({ kind: "cancellation_requested" });
    expect(parsed.kind).toBe("cancellation_requested");
  });

  it("rejects unknown outcome kinds", () => {
    expect(() => cancelJobOutcomeSchema.parse({ kind: "retried" })).toThrow();
  });
});

describe("runnerObservationSchema", () => {
  it("accepts cleanup.started observation", () => {
    const parsed = runnerObservationSchema.parse({
      type: "cleanup.started",
      reason: "cancel",
    });
    expect(parsed.type).toBe("cleanup.started");
  });

  it("accepts run.canceled observation", () => {
    const parsed = runnerObservationSchema.parse({
      type: "run.canceled",
      summary: "Runner observed cancellation and stopped execution",
    });
    expect(parsed.type).toBe("run.canceled");
  });

  it("accepts run.timed_out observation", () => {
    const parsed = runnerObservationSchema.parse({
      type: "run.timed_out",
      summary: "Execution exceeded timeout",
    });
    expect(parsed.type).toBe("run.timed_out");
  });

  it("accepts run.cleanup_failed observation", () => {
    const parsed = runnerObservationSchema.parse({
      type: "run.cleanup_failed",
      summary: "Container stop failed",
    });
    expect(parsed.type).toBe("run.cleanup_failed");
  });

  it("rejects unknown observation types", () => {
    expect(() =>
      runnerObservationSchema.parse({
        type: "run.retried",
        summary: "Should not exist",
      }),
    ).toThrow();
  });
});

describe("staleMarkingResultSchema", () => {
  it("accepts stale marking result with run ids", () => {
    const parsed = staleMarkingResultSchema.parse({
      runnerSessionId: "00000000-0000-4000-8000-000000000001",
      staleRunIds: ["00000000-0000-4000-8000-000000000010"],
    });
    expect(parsed.staleRunIds).toHaveLength(1);
  });

  it("accepts stale marking result with no active runs", () => {
    const parsed = staleMarkingResultSchema.parse({
      runnerSessionId: "00000000-0000-4000-8000-000000000002",
      staleRunIds: [],
    });
    expect(parsed.staleRunIds).toEqual([]);
  });
});

describe("cancellationRequestMetadataSchema", () => {
  it("accepts minimal cancellation request", () => {
    const parsed = cancellationRequestMetadataSchema.parse({
      requestedAt: "2026-05-10T00:00:00.000Z",
    });
    expect(parsed.requestedAt).toBe("2026-05-10T00:00:00.000Z");
    expect(parsed.requestedBy).toBeUndefined();
  });

  it("accepts cancellation request with requestedBy", () => {
    const parsed = cancellationRequestMetadataSchema.parse({
      requestedAt: "2026-05-10T00:00:00.000Z",
      requestedBy: "operator",
    });
    expect(parsed.requestedBy).toBe("operator");
  });
});

describe("runnerEligibilitySchema", () => {
  it("accepts empty eligibility (no local restriction)", () => {
    const parsed = runnerEligibilitySchema.parse({});
    expect(parsed.eligibleProjectIds).toBeUndefined();
    expect(parsed.eligibleRuntimeProviders).toBeUndefined();
  });

  it("accepts explicit project and provider eligibility", () => {
    const parsed = runnerEligibilitySchema.parse({
      eligibleProjectIds: ["00000000-0000-4000-8000-000000000001"],
      eligibleRuntimeProviders: ["docker"],
    });
    expect(parsed.eligibleProjectIds).toHaveLength(1);
    expect(parsed.eligibleRuntimeProviders).toEqual(["docker"]);
  });
});
