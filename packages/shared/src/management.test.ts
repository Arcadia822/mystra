import { describe, expect, it } from "vitest";

import {
  contextBundleCreateResponseSchema,
  contextBundleListResponseSchema,
  executionContextViewSchema,
  laneInspectionViewSchema,
  managementErrorResponseSchema,
  managementErrorSchema,
  projectCreateResponseSchema,
  projectListResponseSchema,
  projectSelectionViewSchema,
  runnerRepositoryCredentialRequestSchema,
  runnerRepositoryCredentialResponseSchema,
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
  teamId: "00000000-0000-4000-8000-000000000012",
  title: "Implement API slice",
  description: null,
  projectId: null,
  issue: null,
  status: "pending",
  metadata: {},
  statusRevision: 1,
  statusNote: null,
  statusUpdatedAt: "2026-05-15T00:00:00.000Z",
  statusActor: { kind: "system", actorId: null, agentId: null, executionContextId: null, sessionId: null },
  createdAt: "2026-05-15T00:00:00.000Z",
  updatedAt: "2026-05-15T00:00:00.000Z",
} as const;

const repositoryConnectionId = "00000000-0000-4000-8000-000000000039";

describe("integration connection management contracts", () => {
  it("returns provider readiness and non-secret connection metadata", () => {
    const parsed = integrationConnectionListResponseSchema.parse({
      providers: [{
        integration: "github",
        methods: [
          {
            type: "github-app",
            configured: true,
            connectUrl: "/api/integration-connections/github/connect",
          },
          {
            type: "personal-access-token",
            configured: false,
            createUrl: "/api/integration-connections/github/pat",
            disabledReason: "Secret store is not configured",
          },
        ],
      }],
      connections: [{
        id: repositoryConnectionId,
        teamId: task.teamId,
        integration: "github",
        provider: "github",
        authMethod: "github-app",
        providerExternalId: "18492",
        displayName: null,
        providerSubject: { externalId: "42", login: "arcadia", type: "User" },
        connectionConfig: {},
        capabilities: {
          repositories: {
            state: "enabled",
            config: { selection: "selected" },
            permissions: { contents: "write", pull_requests: "write" },
            accessSummary: {},
            verifiedAt: "2026-08-05T08:00:00.000Z",
          },
        },
        credentialState: "ready",
        status: "active",
        createdAt: "2026-08-05T08:00:00.000Z",
        updatedAt: "2026-08-05T08:00:00.000Z",
      }],
    });
    expect(parsed.connections[0]?.providerExternalId).toBe("18492");
    expect(JSON.stringify(parsed)).not.toMatch(/credentialRef|fingerprint|github_pat_|ghp_|ghs_|privateKey|clientSecret/i);
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
    id: "00000000-0000-4000-8000-000000000001",
    teamId: task.teamId,
    name: "Mystra",
    slug: "mystra",
    repositoryConnectionId,
    repositoryExternalId: remoteRepository.externalId,
    repositoryBaseBranch: "main",
    archivedAt: null,
    createdAt: "2026-05-15T00:00:00.000Z",
    updatedAt: "2026-05-15T00:00:00.000Z",
  } as const;

  it("retains explicit Project selection and execution context projections", () => {
    expect(projectSelectionViewSchema.parse(projectSelection).slug).toBe("mystra");
    expect(projectListResponseSchema.parse({ projects: [projectSelection] }).projects).toHaveLength(1);

    const context = executionContextViewSchema.parse({
      ...projectSelection,
      metadata: { projectLane: "mystra" },
      lane: {
        repositoryConnectionId,
        repositoryExternalId: remoteRepository.externalId,
        repositoryBaseBranch: "main",
        runtime: projectRuntime,
        contextBundleRefs: [],
        prewarmConfig: { manager: "pnpm" },
        metadata: { projectLane: "mystra" },
      },
    });

    expect(context.lane.runtime.image).toBe(projectRuntime.image);
    expect("workflow" in context.lane).toBe(false);
  });

  it("retains strict Project create and lane payloads", () => {
    const created = projectCreateResponseSchema.parse({
      project: {
        ...projectSelection,
        metadata: {},
      },
    });
    expect(created.project.slug).toBe("mystra");

    const lane = laneInspectionViewSchema.parse({
      repositoryConnectionId,
      repositoryExternalId: remoteRepository.externalId,
      repositoryBaseBranch: "develop",
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
      projectId: "00000000-0000-4000-8000-000000000001",
      projectSlug: "mystra",
      repositoryConnectionId,
      repositoryExternalId: remoteRepository.externalId,
      repositoryBaseBranch: "main",
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

describe("Task management views", () => {
  it("allows a pending Task to exist with zero Sessions", () => {
    expect(taskRecordSchema.parse(task).projectId).toBeNull();
    const detail = taskDetailResponseSchema.parse({ task });
    expect("state" in detail.task).toBe(false);
    expect("result" in detail.task).toBe(false);
    expect(detail.task.status).toBe("pending");
    expect(taskCreateResponseSchema.parse({ task, created: true }).task.id).toBe(task.id);
  });

  it("returns transient Issue availability without making Project mandatory", () => {
    const issueTask = {
      ...task,
      projectId: "00000000-0000-4000-8000-000000000001",
      issue: {
        provider: "linear",
        connectionId: repositoryConnectionId,
        scopeExternalId: "linear-team-id",
        externalId: "linear-issue-id",
        identifier: "ENG-42",
      },
    } as const;
    expect(taskDetailResponseSchema.parse({
      task: issueTask,
      issueResolution: {
        status: "available",
        title: "Fix the flaky test",
        identifier: "ENG-42",
        url: "https://linear.app/example/issue/ENG-42",
      },
    }).issueResolution?.status).toBe("available");
    expect(taskDetailResponseSchema.parse({
      task: issueTask,
      issueResolution: { status: "unavailable" },
    }).task.issue?.externalId).toBe("linear-issue-id");
  });

  it("does not project Session summaries into Task list items", () => {
    const listed = taskListResponseSchema.parse({ tasks: [task] });
    expect(listed.tasks[0]?.id).toBe(task.id);
    expect("state" in (listed.tasks[0] ?? {})).toBe(false);
  });

});
