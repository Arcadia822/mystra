import { describe, expect, it } from "vitest";

import {
  agentNameSchema,
  cancelTaskOutcomeSchema,
  cancellationRequestMetadataSchema,
  contextBundleCreateSchema,
  contextBundleSchema,
  taskRuntimeOverrideSchema,
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
  taskSpecSchema,
} from "./schemas.js";

describe("taskSpecSchema", () => {
  it("accepts a minimal API task submission with projectId and a task-provided branch name", () => {
    const parsed = taskSpecSchema.parse({
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
    const parsed = taskSpecSchema.parse({
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

  it("rejects task submissions without a branch name", () => {
    expect(() =>
      taskSpecSchema.parse({
        taskId: "task-3",
        source: "api",
        projectId: "00000000-0000-4000-8000-000000000003",
        prompt: "Update the README",
      }),
    ).toThrow();
  });

  it("rejects task submissions without a projectId", () => {
    expect(() =>
      taskSpecSchema.parse({
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

  it("rejects callback URLs because callbacks are not in the MVP task contract", () => {
    expect(() =>
      taskSpecSchema.parse({
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

  it("accepts only constrained task runtime overrides", () => {
    const parsed = taskRuntimeOverrideSchema.parse({
      runtimeProfile: "frontend-dev",
      provider: "docker",
      image: "registry.example.com/castrel/frontend:latest",
      contextBundleRefs: [{ slug: "issue-context", accessMode: "job-scoped" }],
      metadata: { reason: "smoke-test" },
    });

    expect(parsed.runtimeProfile).toBe("frontend-dev");
    expect(parsed.contextBundleRefs?.[0]?.required).toBe(true);
  });

  it("rejects task runtime overrides for mount, secret, cache, or port mutation", () => {
    const base = {
      provider: "docker",
      image: "registry.example.com/castrel/runtime:latest",
    };

    expect(() => taskRuntimeOverrideSchema.parse({ ...base, mounts: [] })).toThrow();
    expect(() => taskRuntimeOverrideSchema.parse({ ...base, secretRefs: [] })).toThrow();
    expect(() => taskRuntimeOverrideSchema.parse({ ...base, cache: { entries: [] } })).toThrow();
    expect(() => taskRuntimeOverrideSchema.parse({ ...base, exposedPorts: [] })).toThrow();
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
      mounts: [],
      exposedPorts: [{ containerPort: 3000, hostBinding: "0.0.0.0::3000" }],
      cache: { coldStartAllowed: true, entries: [] },
      secrets: [{ name: "MYSTRA_GITLAB_TOKEN", mode: "env" }],
    });

    expect(parsed.environment.image).toBe("mystra-runner:local");
    expect(parsed.environment.metadata).toEqual({});
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

describe("cancelTaskOutcomeSchema", () => {
  it("accepts immediate canceled outcome for queued work", () => {
    const parsed = cancelTaskOutcomeSchema.parse({ kind: "canceled" });
    expect(parsed.kind).toBe("canceled");
  });

  it("accepts cancellation_requested outcome for runner-owned work", () => {
    const parsed = cancelTaskOutcomeSchema.parse({ kind: "cancellation_requested" });
    expect(parsed.kind).toBe("cancellation_requested");
  });

  it("rejects unknown outcome kinds", () => {
    expect(() => cancelTaskOutcomeSchema.parse({ kind: "retried" })).toThrow();
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
