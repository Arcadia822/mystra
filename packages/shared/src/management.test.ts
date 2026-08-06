import { describe, expect, it } from "vitest";

import {
  cancelSessionResponseSchema,
  contextBundleCreateResponseSchema,
  contextBundleListResponseSchema,
  executionContextViewSchema,
  laneInspectionViewSchema,
  managementErrorResponseSchema,
  managementErrorSchema,
  publicRunnerSchema,
  projectCreateResponseSchema,
  projectListResponseSchema,
  projectSelectionViewSchema,
  runnerDetailResponseSchema,
  runnerListResponseSchema,
  runnerRepositoryCredentialRequestSchema,
  runnerRepositoryCredentialResponseSchema,
  sessionDetailResponseSchema,
  sessionListResponseSchema,
  sessionRecordSchema,
  submittedLaneSnapshotSchema,
  taskCreateResponseSchema,
  taskDetailResponseSchema,
  taskListResponseSchema,
  taskRecordSchema,
  integrationConnectionListResponseSchema,
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

const projectRuntime = {
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
} as const;

const task = {
  id: "00000000-0000-4000-8000-000000000010",
  projectId: "00000000-0000-4000-8000-000000000001",
  source: "api",
  objective: "Improve repository onboarding",
  repository: remoteRepository,
  metadata: {},
  createdAt: "2026-05-15T00:00:00.000Z",
  updatedAt: "2026-05-15T00:00:00.000Z",
} as const;

const session = {
  id: "00000000-0000-4000-8000-000000000011",
  taskId: task.id,
  title: "Implement API slice",
  objective: "Add the management resources",
  agent: "copilot",
  branch: "mystra/task-session-api",
  state: "succeeded",
  result: {
    status: "succeeded",
    summary: "Created the requested resources",
    branch: "mystra/task-session-api",
  },
  metadata: {},
  createdAt: "2026-05-15T00:00:00.000Z",
  updatedAt: "2026-05-15T00:02:00.000Z",
  startedAt: "2026-05-15T00:00:10.000Z",
  finishedAt: "2026-05-15T00:02:00.000Z",
} as const;

const repositoryConnectionId = "00000000-0000-4000-8000-000000000039";

describe("integration connection management contracts", () => {
  it("returns provider readiness and non-secret connection metadata", () => {
    const parsed = integrationConnectionListResponseSchema.parse({
      providers: [{
        integration: "github",
        connectionType: "github-app-installation",
        configured: true,
        connectUrl: "/api/integration-connections/github/connect",
      }],
      connections: [{
        id: repositoryConnectionId,
        integration: "github",
        provider: "github",
        externalId: "18492",
        account: { externalId: "42", login: "arcadia", type: "User" },
        repositorySelection: "selected",
        permissions: { contents: "write", pull_requests: "write" },
        status: "active",
        createdAt: "2026-08-05T08:00:00.000Z",
        updatedAt: "2026-08-05T08:00:00.000Z",
      }],
    });
    expect(parsed.connections[0]?.externalId).toBe("18492");
    expect(JSON.stringify(parsed)).not.toMatch(/token|privateKey|clientSecret/i);
  });

  it("keeps the private Runner credential bounded and strict", () => {
    expect(runnerRepositoryCredentialRequestSchema.parse({ purpose: "clone" })).toEqual({ purpose: "clone" });
    const parsed = runnerRepositoryCredentialResponseSchema.parse({
      credential: {
        provider: "github",
        username: "x-access-token",
        secret: "ghs_ephemeral",
        expiresAt: "2026-08-05T09:00:00.000Z",
      },
    });
    expect(parsed.credential.expiresAt).toBe("2026-08-05T09:00:00.000Z");
    expect(() => runnerRepositoryCredentialRequestSchema.parse({ purpose: "shell" })).toThrow();
    expect(() => runnerRepositoryCredentialResponseSchema.parse({
      credential: { ...parsed.credential, refreshToken: "must-not-exist" },
    })).toThrow();
  });
});

describe("management errors", () => {
  it("accepts shared Task and Session errors", () => {
    expect(managementErrorSchema.parse({
      code: "TASK_NOT_FOUND",
      message: "Task not found",
      details: { taskId: task.id },
    }).code).toBe("TASK_NOT_FOUND");
    expect(managementErrorResponseSchema.parse({
      error: { code: "SESSION_BRANCH_CONFLICT", message: "Branch is already active" },
    }).error.code).toBe("SESSION_BRANCH_CONFLICT");
  });

  it("rejects removed compatibility error codes", () => {
    // legacy-term-audit: allow -- negative compatibility assertion only.
    expect(() => managementErrorSchema.parse({ code: "JOB_NOT_FOUND", message: "removed" })).toThrow();
    // legacy-term-audit: allow -- negative compatibility assertion only.
    expect(() => managementErrorSchema.parse({ code: "RUN_NOT_FOUND", message: "removed" })).toThrow();
  });
});

describe("Project management views", () => {
  const projectSelection = {
    id: task.projectId,
    name: "Mystra",
    slug: "mystra",
    repositoryConnectionId,
    repository: remoteRepository,
    baseBranch: "main",
    defaultAgent: "copilot",
    archivedAt: null,
    createdAt: "2026-05-15T00:00:00.000Z",
    updatedAt: "2026-05-15T00:00:00.000Z",
  } as const;

  it("retains explicit Project selection and execution context projections", () => {
    expect(projectSelectionViewSchema.parse(projectSelection).slug).toBe("mystra");
    expect(projectListResponseSchema.parse({ projects: [projectSelection] }).projects).toHaveLength(1);

    const context = executionContextViewSchema.parse({
      ...projectSelection,
      runtime: projectRuntime,
      prewarmConfig: { manager: "pnpm" },
      metadata: { projectLane: "mystra" },
      lane: {
        repository: remoteRepository,
        baseBranch: "main",
        defaultAgent: "copilot",
        runtime: projectRuntime,
        contextBundleRefs: [],
        prewarmConfig: { manager: "pnpm" },
        metadata: { projectLane: "mystra" },
      },
    });

    expect(context.runtime.image).toBe(projectRuntime.image);
    expect("workflow" in context.lane).toBe(false);
  });

  it("retains strict Project create and lane payloads", () => {
    const created = projectCreateResponseSchema.parse({
      project: {
        ...projectSelection,
        runtime: projectRuntime,
        prewarmConfig: {},
        metadata: {},
      },
    });
    expect(created.project.slug).toBe("mystra");

    const lane = laneInspectionViewSchema.parse({
      repository: remoteRepository,
      baseBranch: "develop",
      defaultAgent: "copilot",
      runtime: projectRuntime,
      contextBundleRefs: [],
    });
    expect(() => laneInspectionViewSchema.parse({ ...lane, workflow: {} })).toThrow();
  });

  it("retains wrapped context bundle payloads with Session language", () => {
    const created = contextBundleCreateResponseSchema.parse({
      contextBundle: {
        id: "00000000-0000-4000-8000-000000000002",
        slug: "agent-skills",
        displayName: "Agent Skills",
        source: { kind: "local-template", ref: "mystra-skills", metadata: {} },
        accessMode: "read-only",
        mountPath: "/mystra/skills",
        freshness: {},
        failureMode: "fail-session",
        metadata: {},
        archivedAt: null,
        createdAt: "2026-05-15T00:00:00.000Z",
        updatedAt: "2026-05-15T00:00:00.000Z",
      },
    });
    expect(contextBundleListResponseSchema.parse({
      contextBundles: [created.contextBundle],
    }).contextBundles).toHaveLength(1);
  });

  it("accepts submitted lane snapshots without exposing execution facts", () => {
    const parsed = submittedLaneSnapshotSchema.parse({
      projectId: task.projectId,
      projectSlug: "mystra",
      repository: remoteRepository,
      baseBranch: "main",
      defaultAgent: "copilot",
      runtime: {
        provider: "docker",
        environment: { image: projectRuntime.image, metadata: {} },
        contextBundles: [{
          slug: "issue-context",
          required: true,
          accessMode: "session-scoped",
          source: { kind: "session-inline", metadata: { sessionInline: { files: [{ path: "context.md", content: "fixture" }] } } },
          failureMode: "fail-session",
        }],
        mounts: [],
        exposedPorts: [],
        cache: { coldStartAllowed: true, entries: [] },
        secrets: [],
      },
      contextBundleRefs: [{ slug: "issue-context", required: true, accessMode: "session-scoped" }],
      submittedAt: "2026-05-15T00:00:00.000Z",
    });
    expect(parsed.runtime.contextBundles[0]?.accessMode).toBe("session-scoped");
  });
});

describe("Task and Session management views", () => {
  it("allows a Task to exist with zero Sessions and no lifecycle state", () => {
    expect(taskRecordSchema.parse(task).objective).toBe(task.objective);
    const detail = taskDetailResponseSchema.parse({
      task,
      sessionSummary: { sessionCount: 0, activeSessionCount: 0 },
    });
    expect(detail.sessionSummary.sessionCount).toBe(0);
    expect("state" in detail.task).toBe(false);
    expect("result" in detail.task).toBe(false);
    expect(taskCreateResponseSchema.parse({ task }).task.id).toBe(task.id);
  });

  it("returns Session projections without making them Task state", () => {
    const latestSession = {
      id: session.id,
      taskId: task.id,
      title: session.title,
      state: session.state,
      agent: session.agent,
      branch: session.branch,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      startedAt: session.startedAt,
      finishedAt: session.finishedAt,
    };
    const listed = taskListResponseSchema.parse({
      tasks: [{ ...task, sessionCount: 1, activeSessionCount: 0, latestSession }],
    });
    expect(listed.tasks[0]?.latestSession?.id).toBe(session.id);
    expect("state" in (listed.tasks[0] ?? {})).toBe(false);
  });

  it("keeps result and lifecycle evidence on Session only", () => {
    expect(sessionRecordSchema.parse(session).result?.status).toBe("succeeded");
    expect(sessionListResponseSchema.parse({ taskId: task.id, sessions: [session] }).sessions).toHaveLength(1);
    const detail = sessionDetailResponseSchema.parse({ session, task });
    expect(detail.session.taskId).toBe(task.id);
    expect("events" in detail).toBe(false);
  });

  it("returns cancellation outcome with the Session", () => {
    const parsed = cancelSessionResponseSchema.parse({ outcome: "canceled", session });
    expect(parsed.session.id).toBe(session.id);
  });

  it("rejects embedded execution facts as a public collection", () => {
    expect(() => sessionDetailResponseSchema.parse({
      session,
      task,
      events: [{ type: "session.succeeded" }],
    })).toThrow();
  });
});

describe("Runner management views", () => {
  const runner = {
    id: "00000000-0000-4000-8000-000000000003",
    name: "runner-a",
    capabilities: { agents: ["codex"], executor: "docker" },
    maxConcurrency: 2,
    activeSessionCount: 1,
    health: "healthy",
    staleAfterSeconds: 60,
    eligibleProjectIds: [task.projectId],
    eligibleRuntimeProviders: ["docker"],
    currentAssignments: [{ taskId: task.id, sessionId: session.id }],
    lastHeartbeatAt: "2026-05-15T00:00:00.000Z",
    createdAt: "2026-05-15T00:00:00.000Z",
    updatedAt: "2026-05-15T00:00:00.000Z",
  } as const;

  it("uses one stable Runner resource with capacity and assignments", () => {
    expect(publicRunnerSchema.parse(runner).name).toBe("runner-a");
    expect(runnerListResponseSchema.parse({ runners: [runner] }).runners).toHaveLength(1);
    expect(runnerDetailResponseSchema.parse({ runner }).runner.currentAssignments[0]?.sessionId).toBe(session.id);
  });

  it("rejects credentials and internal connection wrappers", () => {
    expect(() => publicRunnerSchema.parse({ ...runner, credentialHash: "secret" })).toThrow();
    expect(() => publicRunnerSchema.parse({ ...runner, activeSessionCount: 2 })).toThrow();
  });
});
