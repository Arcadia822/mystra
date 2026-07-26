import { describe, expect, it } from "vitest";

import {
  canonicalRunSnapshotSchema,
  contextBundleCreateResponseSchema,
  contextBundleListResponseSchema,
  executionContextViewSchema,
  laneInspectionViewSchema,
  managementErrorResponseSchema,
  managementErrorSchema,
  publicRunnerSessionSchema,
  projectCreateResponseSchema,
  projectSelectionViewSchema,
  runnerListResponseSchema,
  submittedLaneSnapshotSchema,
  projectListResponseSchema,
} from "./management.js";

const remoteRepository = {
  integration: "github",
  provider: "github",
  externalId: "R_kgDOFixture",
  fullName: "Arcadia822/mystra-remote-e2e",
  url: "https://github.com/Arcadia822/mystra-remote-e2e",
  cloneUrl: "https://github.com/Arcadia822/mystra-remote-e2e.git",
  defaultBranch: "main",
  visibility: "private",
  isArchived: false,
  fetchedAt: "2026-07-26T00:00:00.000Z",
} as const;

describe("managementErrorSchema", () => {
  it("accepts shared machine-readable errors", () => {
    const parsed = managementErrorSchema.parse({
      code: "PROJECT_NOT_FOUND",
      message: "Project not found: mystra",
      details: { slug: "mystra" },
    });

    expect(parsed.code).toBe("PROJECT_NOT_FOUND");
    expect(parsed.details).toEqual({ slug: "mystra" });
  });

  it("rejects unknown error codes", () => {
    expect(() =>
      managementErrorSchema.parse({
        code: "SOMETHING_ELSE",
        message: "unknown",
      }),
    ).toThrow();
  });

  it("wraps errors in the canonical error response shape", () => {
    const parsed = managementErrorResponseSchema.parse({
      error: {
        code: "INVALID_SUBMISSION",
        message: "projectId is required",
      },
    });

    expect(parsed.error.code).toBe("INVALID_SUBMISSION");
  });
});

describe("project selection views", () => {
  it("accepts the minimal project identity needed for lane selection", () => {
    const parsed = projectSelectionViewSchema.parse({
      id: "00000000-0000-4000-8000-000000000001",
      name: "Mystra",
      slug: "mystra",
      repository: remoteRepository,
      baseBranch: "main",
      defaultAgent: "copilot",
      archivedAt: null,
      createdAt: "2026-05-15T00:00:00.000Z",
      updatedAt: "2026-05-15T00:00:00.000Z",
    });

    expect(parsed.slug).toBe("mystra");
    expect(parsed.repository.fullName).toBe("Arcadia822/mystra-remote-e2e");
  });

  it("accepts project list payloads with explicit success field names", () => {
    const parsed = projectListResponseSchema.parse({
      projects: [
        {
          id: "00000000-0000-4000-8000-000000000001",
          name: "Mystra",
          slug: "mystra",
          repository: remoteRepository,
          baseBranch: "main",
          defaultAgent: "copilot",
          archivedAt: null,
          createdAt: "2026-05-15T00:00:00.000Z",
          updatedAt: "2026-05-15T00:00:00.000Z",
        },
      ],
    });

    expect(parsed.projects).toHaveLength(1);
  });

  it("accepts project-card execution context views without invented workflow fields", () => {
    const parsed = executionContextViewSchema.parse({
      id: "00000000-0000-4000-8000-000000000001",
      name: "Mystra",
      slug: "mystra",
      repository: remoteRepository,
      baseBranch: "main",
      defaultAgent: "copilot",
      runtime: {
        provider: "docker",
        image: "ghcr.io/arcadia/mystra-runner:latest",
        contextBundleRefs: [],
        mounts: [],
        exposedPorts: [],
        cache: { coldStartAllowed: true, entries: [] },
        secretRefs: [],
        overridePolicy: {
          allowImageOverride: false,
          allowContextBundleAdditions: false,
          allowedContextBundleSlugs: [],
        },
        metadata: {},
      },
      prewarmConfig: { manager: "pnpm" },
      metadata: { projectLane: "mystra" },
      lane: {
        repository: remoteRepository,
        baseBranch: "main",
        defaultAgent: "copilot",
        runtime: {
          provider: "docker",
          image: "ghcr.io/arcadia/mystra-runner:latest",
          contextBundleRefs: [],
          mounts: [],
          exposedPorts: [],
          cache: { coldStartAllowed: true, entries: [] },
          secretRefs: [],
          overridePolicy: {
            allowImageOverride: false,
            allowContextBundleAdditions: false,
            allowedContextBundleSlugs: [],
          },
          metadata: {},
        },
        contextBundleRefs: [],
        prewarmConfig: { manager: "pnpm" },
        metadata: { projectLane: "mystra" },
      },
      archivedAt: null,
      createdAt: "2026-05-15T00:00:00.000Z",
      updatedAt: "2026-05-15T00:00:00.000Z",
    });

    expect(parsed.runtime.image).toBe("ghcr.io/arcadia/mystra-runner:latest");
    expect(parsed.metadata).toEqual({ projectLane: "mystra" });
    expect("workflow" in parsed.lane).toBe(false);
  });

  it("accepts project create payloads with explicit success field names", () => {
    const parsed = projectCreateResponseSchema.parse({
      project: {
        id: "00000000-0000-4000-8000-000000000001",
        name: "Mystra",
        slug: "mystra",
        repository: remoteRepository,
        baseBranch: "main",
        defaultAgent: "copilot",
        runtime: {
          provider: "docker",
          image: "ghcr.io/arcadia/mystra-runner:latest",
          contextBundleRefs: [],
          mounts: [],
          exposedPorts: [],
          cache: { coldStartAllowed: true, entries: [] },
          secretRefs: [],
          overridePolicy: {
            allowImageOverride: false,
            allowContextBundleAdditions: false,
            allowedContextBundleSlugs: [],
          },
          metadata: {},
        },
        prewarmConfig: { manager: "pnpm" },
        metadata: {},
        archivedAt: null,
        createdAt: "2026-05-15T00:00:00.000Z",
        updatedAt: "2026-05-15T00:00:00.000Z",
      },
    });

    expect(parsed.project.slug).toBe("mystra");
    expect(parsed.project.runtime.image).toBe("ghcr.io/arcadia/mystra-runner:latest");
  });

  it("accepts wrapped context bundle payloads with explicit success field names", () => {
    const created = contextBundleCreateResponseSchema.parse({
      contextBundle: {
        id: "00000000-0000-4000-8000-000000000002",
        slug: "agent-skills",
        displayName: "Agent Skills",
        source: {
          kind: "local-template",
          ref: "/tmp/mystra-skills",
          metadata: { prompt: "load skills" },
        },
        accessMode: "read-only",
        mountPath: "/mystra/skills",
        freshness: {},
        failureMode: "fail-run",
        metadata: {},
        archivedAt: null,
        createdAt: "2026-05-15T00:00:00.000Z",
        updatedAt: "2026-05-15T00:00:00.000Z",
      },
    });
    const listed = contextBundleListResponseSchema.parse({
      contextBundles: [created.contextBundle],
    });

    expect(created.contextBundle.slug).toBe("agent-skills");
    expect(listed.contextBundles).toHaveLength(1);
  });

  it("accepts public runner session payloads with explicit success field names", () => {
    const session = publicRunnerSessionSchema.parse({
      id: "00000000-0000-4000-8000-000000000003",
      runnerName: "runner-a",
      capabilities: {
        agents: ["codex"],
        executor: "docker",
      },
      maxConcurrency: 2,
      activeRunCount: 0,
      staleAfterSeconds: 60,
      eligibleProjectIds: ["00000000-0000-4000-8000-000000000001"],
      eligibleRuntimeProviders: ["docker"],
      lastHeartbeatAt: "2026-05-15T00:00:00.000Z",
      createdAt: "2026-05-15T00:00:00.000Z",
      updatedAt: "2026-05-15T00:00:00.000Z",
    });
    const listed = runnerListResponseSchema.parse({
      runners: [session],
    });

    expect(listed.runners[0]?.runnerName).toBe("runner-a");
    expect(listed.runners[0]?.capabilities.executor).toBe("docker");
  });

  it("accepts explicit lane inspection views and rejects workflow hints", () => {
    const lane = {
      repository: remoteRepository,
      baseBranch: "develop",
      defaultAgent: "copilot",
      runtime: {
        provider: "docker",
        image: "ghcr.io/arcadia/skrya-runner:latest",
        contextBundleRefs: [{ slug: "agent-skills", required: true, accessMode: "read-only" }],
        mounts: [],
        exposedPorts: [],
        cache: { coldStartAllowed: true, entries: [] },
        secretRefs: [],
        overridePolicy: {
          allowImageOverride: false,
          allowContextBundleAdditions: false,
          allowedContextBundleSlugs: [],
        },
        metadata: {},
      },
      contextBundleRefs: [{ slug: "agent-skills", required: true, accessMode: "read-only" }],
      prewarmConfig: { manager: "pnpm" },
      metadata: { projectLane: "skrya" },
    };
    const parsed = laneInspectionViewSchema.parse(lane);

    expect("workflow" in parsed).toBe(false);
    expect(parsed.contextBundleRefs[0]?.slug).toBe("agent-skills");
    expect(() => laneInspectionViewSchema.parse({
      ...lane,
      workflow: {
        blueprintName: "mvp.coding",
      },
    })).toThrow();
  });
});

describe("canonicalRunSnapshotSchema", () => {
  it("keeps terminal results nested at run.result", () => {
    const parsed = canonicalRunSnapshotSchema.parse({
      job: {
        id: "00000000-0000-4000-8000-000000000010",
        spec: {
          taskId: "task-10",
          source: "api",
          projectId: "00000000-0000-4000-8000-000000000001",
          repository: remoteRepository,
          baseBranch: "main",
          agent: "copilot",
          branchName: "mystra/task-10",
          prompt: "Implement the requested change",
          metadata: {},
        },
        createdAt: "2026-05-15T00:00:00.000Z",
        updatedAt: "2026-05-15T00:00:00.000Z",
      },
      run: {
        id: "00000000-0000-4000-8000-000000000011",
        jobId: "00000000-0000-4000-8000-000000000010",
        state: "succeeded",
        attempt: 1,
        result: {
          status: "succeeded",
          summary: "Created the requested review",
          branch: "mystra/task-10",
        },
        createdAt: "2026-05-15T00:00:00.000Z",
        updatedAt: "2026-05-15T00:02:00.000Z",
        startedAt: "2026-05-15T00:00:10.000Z",
        finishedAt: "2026-05-15T00:02:00.000Z",
      },
      events: [
        {
          runId: "00000000-0000-4000-8000-000000000011",
          jobId: "00000000-0000-4000-8000-000000000010",
          type: "job.created",
          timestamp: "2026-05-15T00:00:00.000Z",
          severity: "info",
          data: {},
        },
      ],
      project: {
        id: "00000000-0000-4000-8000-000000000001",
        name: "Mystra",
        slug: "mystra",
        repository: remoteRepository,
        baseBranch: "main",
        defaultAgent: "copilot",
        runtime: {
          provider: "docker",
          image: "ghcr.io/arcadia/mystra-runner:latest",
          contextBundleRefs: [],
          mounts: [],
          exposedPorts: [],
          cache: { coldStartAllowed: true, entries: [] },
          secretRefs: [],
          overridePolicy: {
            allowImageOverride: false,
            allowContextBundleAdditions: false,
            allowedContextBundleSlugs: [],
          },
          metadata: {},
        },
        prewarmConfig: { manager: "pnpm" },
        lane: {
          repository: remoteRepository,
          baseBranch: "main",
          defaultAgent: "copilot",
          runtime: {
            provider: "docker",
            image: "ghcr.io/arcadia/mystra-runner:latest",
            contextBundleRefs: [],
            mounts: [],
            exposedPorts: [],
            cache: { coldStartAllowed: true, entries: [] },
            secretRefs: [],
            overridePolicy: {
              allowImageOverride: false,
              allowContextBundleAdditions: false,
              allowedContextBundleSlugs: [],
            },
            metadata: {},
          },
          contextBundleRefs: [],
          prewarmConfig: { manager: "pnpm" },
          metadata: { projectLane: "mystra" },
        },
        archivedAt: null,
        createdAt: "2026-05-15T00:00:00.000Z",
        updatedAt: "2026-05-15T00:00:00.000Z",
      },
      lane: {
        projectId: "00000000-0000-4000-8000-000000000001",
        projectSlug: "mystra",
        repository: remoteRepository,
        baseBranch: "main",
        defaultAgent: "copilot",
        runtime: {
          provider: "docker",
          environment: {
            image: "ghcr.io/arcadia/mystra-runner:latest",
            metadata: {},
          },
          contextBundles: [],
          mounts: [],
          exposedPorts: [],
          cache: { coldStartAllowed: true, entries: [] },
          secrets: [],
        },
        contextBundleRefs: [],
        prewarmConfig: { manager: "pnpm" },
        metadata: { projectLane: "mystra" },
        submittedAt: "2026-05-15T00:00:00.000Z",
      },
    });

    expect(parsed.run.result?.status).toBe("succeeded");
    expect(parsed.project?.slug).toBe("mystra");
    expect(parsed.lane?.projectSlug).toBe("mystra");
    expect(() => canonicalRunSnapshotSchema.parse({
      ...parsed,
      workflow: {
        provider: "local",
        blueprintName: "mvp.coding",
        blueprintVersion: "1.0.0",
        nodeExecutions: [],
      },
    })).toThrow();
  });

  it("accepts submitted lane snapshots as additive historical attribution", () => {
    const parsed = submittedLaneSnapshotSchema.parse({
      projectId: "00000000-0000-4000-8000-000000000001",
      projectSlug: "skrya",
      repository: remoteRepository,
      baseBranch: "develop",
      defaultAgent: "copilot",
      runtime: {
        provider: "docker",
        environment: {
          image: "ghcr.io/arcadia/skrya-runner:latest",
          metadata: {},
        },
        contextBundles: [
          {
            slug: "issue-context",
            required: true,
            accessMode: "job-scoped",
            mountPath: "/mystra/context/issue",
            source: {
              kind: "job-inline",
              metadata: {},
            },
            failureMode: "fail-run",
          },
        ],
        mounts: [],
        exposedPorts: [],
        cache: { coldStartAllowed: true, entries: [] },
        secrets: [],
      },
      contextBundleRefs: [{ slug: "issue-context", required: true, accessMode: "job-scoped" }],
      prewarmConfig: { manager: "pnpm" },
      metadata: { projectLane: "skrya" },
      submittedAt: "2026-05-15T00:00:00.000Z",
    });

    expect(parsed.projectSlug).toBe("skrya");
    expect(parsed.runtime.environment.image).toBe("ghcr.io/arcadia/skrya-runner:latest");
    expect(() => submittedLaneSnapshotSchema.parse({
      ...parsed,
      workflow: {
        blueprintName: "mvp.coding",
      },
    })).toThrow();
  });
});
