import { randomUUID } from "node:crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { getDb } from "@/lib/db";
import { GitRemoteRepositoryError } from "@/lib/git/remote-repository-reader";
import { TaskWorkspaceFailure } from "@/lib/task-workspaces/task-workspace-errors";
import { GET as getProjectBranches } from "./projects/[slug]/repository/branches/route";
import { GET as getTaskWorkspace, POST as setupTaskWorkspace } from "./tasks/[id]/workspace/route";
import { POST as claimWorkspace } from "./runner/workspaces/claim/route";
import { POST as reportWorkspace } from "./runner/workspaces/[workspaceId]/attempts/[attemptId]/route";
import { POST as reportWorkspaceMissing } from "./runner/workspaces/[workspaceId]/availability/route";

const services = vi.hoisted(() => ({
  listBranches: vi.fn(),
  getWorkspace: vi.fn(),
  setupWorkspace: vi.fn(),
  claimWorkspace: vi.fn(),
  reportWorkspace: vi.fn(),
  reportWorkspaceMissing: vi.fn(),
  continueProduction: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ getDb: vi.fn() }));
vi.mock("@/lib/integrations/github-credential", () => ({
  defaultGitHubCredentialResolver: vi.fn(async () => ({})),
}));
vi.mock("@/lib/git/project-repository-branches", () => ({
  ProjectRepositoryBranchesService: class {
    list = services.listBranches;
  },
}));
vi.mock("@/lib/task-workspaces/task-workspace-service-factory", () => ({
  createTaskWorkspaceService: vi.fn(() => ({
    get: services.getWorkspace,
    setup: services.setupWorkspace,
  })),
}));
vi.mock("@/lib/task-workspaces/workspace-preparation-service-factory", () => ({
  createWorkspacePreparationService: vi.fn(() => ({
    claim: services.claimWorkspace,
    report: services.reportWorkspace,
    reportMissing: services.reportWorkspaceMissing,
  })),
}));
vi.mock("@/lib/tasks/task-production-service-factory", () => ({
  createTaskProductionService: vi.fn(() => ({
    continueAfterWorkspaceReady: services.continueProduction,
  })),
}));

const userId = randomUUID();
const teamId = randomUUID();
const taskId = "12345678-0000-4000-8000-000000000004";
const runtimeId = "00000000-0000-4000-8000-000000000005";
const workspace = {
  id: "00000000-0000-4000-8000-000000000006",
  taskId,
  projectId: "00000000-0000-4000-8000-000000000002",
  runtimeId,
  state: "queued" as const,
  sharingMode: "shared-mutable" as const,
  configuredBaseBranch: "main",
  baseRef: "refs/heads/main",
  baseCommit: "0123456789abcdef0123456789abcdef01234567",
  branchName: "mystra/task-12345678-000",
  branchStrategy: "mystra-task-fallback-v1",
  failure: null,
  createdAt: "2026-08-10T00:00:00.000Z",
  updatedAt: "2026-08-10T00:00:00.000Z",
  readyAt: null,
};
const claim = {
  workspaceId: workspace.id,
  attemptId: "00000000-0000-4000-8000-000000000007",
  attemptSequence: 1,
  leaseExpiresAt: "2026-08-10T00:01:00.000Z",
  workspaceRef: `host-task-workspace:${workspace.id}`,
  repository: {
    provider: "github",
    connectionId: "00000000-0000-4000-8000-000000000003",
    repositoryExternalId: "42",
    baseRef: workspace.baseRef,
    baseCommit: workspace.baseCommit,
    transport: { kind: "https" as const, endpoint: "https://github.com/example/mystra.git" },
  },
  branch: { name: workspace.branchName, strategy: workspace.branchStrategy },
  credential: { kind: "http-basic-token" as const, secret: "transient-token" },
};

function db() {
  return {
    getTask: vi.fn(async () => ({ id: taskId, teamId, runtimeId })),
    getAuthSessionByTokenHash: vi.fn(async () => ({
      id: randomUUID(),
      userId,
      activeTeamId: teamId,
      expiresAt: "2027-08-10T00:00:00.000Z",
    })),
    getUserById: vi.fn(async () => ({
      id: userId,
      status: "active",
      requirePasswordChange: false,
    })),
    resolveActiveTeam: vi.fn(async () => ({
      team: { id: teamId, status: "active" },
      role: "member",
    })),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  services.listBranches.mockResolvedValue({
    branches: [],
    head: null,
    pageInfo: { hasNextPage: false, endCursor: null },
  });
  services.getWorkspace.mockResolvedValue(workspace);
  services.setupWorkspace.mockResolvedValue({ workspace, created: true, retried: false });
  services.claimWorkspace.mockResolvedValue(claim);
  services.reportWorkspace.mockResolvedValue({ id: workspace.id, teamId, taskId, state: "ready" });
  services.reportWorkspaceMissing.mockResolvedValue({ id: workspace.id, state: "unavailable" });
});

describe("Runner Workspace routes", () => {
  it("claims only through enrolled runner identity and returns 204 when empty", async () => {
    vi.mocked(getDb).mockResolvedValue(db() as never);
    const response = await claimWorkspace(new Request("http://localhost/api/runner/workspaces/claim", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ runnerId: "00000000-0000-4000-8000-000000000008", waitSeconds: 0 }),
    }));
    expect({ status: response.status, body: await response.clone().json() }).toEqual({
      status: 200,
      body: claim,
    });
    expect(services.claimWorkspace).toHaveBeenCalledWith({
      runnerId: "00000000-0000-4000-8000-000000000008",
      waitSeconds: 0,
    });
    await expect(response.json()).resolves.toEqual(claim);

    services.claimWorkspace.mockResolvedValueOnce(undefined);
    const empty = await claimWorkspace(new Request("http://localhost/api/runner/workspaces/claim", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ runnerId: "00000000-0000-4000-8000-000000000008" }),
    }));
    expect(empty.status).toBe(204);
  });

  it("reports a fenced success and maps a stale attempt to 409", async () => {
    vi.mocked(getDb).mockResolvedValue(db() as never);
    const body = {
      runnerId: "00000000-0000-4000-8000-000000000008",
      attemptSequence: 1,
      status: "succeeded",
      workspaceRef: claim.workspaceRef,
      observed: { baseCommit: workspace.baseCommit, branchName: workspace.branchName },
    };
    const response = await reportWorkspace(new Request("http://localhost/report", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }), { params: Promise.resolve({ workspaceId: workspace.id, attemptId: claim.attemptId }) });
    expect(response.status).toBe(200);
    expect(services.reportWorkspace).toHaveBeenCalledWith({
      workspaceId: workspace.id,
      attemptId: claim.attemptId,
      report: body,
    });
    await expect(response.json()).resolves.toEqual({ workspaceId: workspace.id, state: "ready" });

    services.reportWorkspace.mockRejectedValueOnce(new TaskWorkspaceFailure(
      "stale_workspace_attempt",
      "stale",
    ));
    const stale = await reportWorkspace(new Request("http://localhost/report", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }), { params: Promise.resolve({ workspaceId: workspace.id, attemptId: claim.attemptId }) });
    expect(stale.status).toBe(409);
  });

  it("accepts a Runtime-owned missing report and returns unavailable", async () => {
    vi.mocked(getDb).mockResolvedValue(db() as never);
    const report = {
      runnerId: "00000000-0000-4000-8000-000000000008",
      status: "missing",
      failure: { code: "workspace_missing", message: "Workspace repository is missing" },
    };
    const response = await reportWorkspaceMissing(new Request("http://localhost/availability", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(report),
    }), { params: Promise.resolve({ workspaceId: workspace.id }) });
    expect(response.status).toBe(200);
    expect(services.reportWorkspaceMissing).toHaveBeenCalledWith({ workspaceId: workspace.id, report });
    await expect(response.json()).resolves.toEqual({ workspaceId: workspace.id, state: "unavailable" });
  });
});

describe("Task Workspace operator route", () => {
  it("sets up and reads the Runtime-locked Team-scoped Workspace without exposing workspaceRef", async () => {
    vi.mocked(getDb).mockResolvedValue(db() as never);
    const setupResponse = await setupTaskWorkspace(new Request(
      `http://localhost/api/tasks/${taskId}/workspace`,
      {
        method: "POST",
        headers: { authorization: "Bearer route-test-token-048", "content-type": "application/json" },
        body: JSON.stringify({
          runtimeId,
          idempotencyKey: "00000000-0000-4000-8000-000000000099",
        }),
      },
    ), { params: Promise.resolve({ id: taskId }) });
    expect(setupResponse.status).toBe(202);
    expect(services.setupWorkspace).toHaveBeenCalledWith({
      actor: { teamId },
      taskId,
      runtimeId,
      idempotencyKey: "00000000-0000-4000-8000-000000000099",
    });
    const setupPayload = await setupResponse.json();
    expect(setupPayload).toEqual({ workspace });
    expect(setupPayload.workspace).not.toHaveProperty("workspaceRef");

    const getResponse = await getTaskWorkspace(new Request(
      `http://localhost/api/tasks/${taskId}/workspace`,
      { headers: { authorization: "Bearer route-test-token-048" } },
    ), { params: Promise.resolve({ id: taskId }) });
    expect(getResponse.status).toBe(200);
    expect(services.getWorkspace).toHaveBeenCalledWith({ actor: { teamId }, taskId, runtimeId });
    await expect(getResponse.json()).resolves.toEqual({ workspace });
  });

  it("returns stable missing and setup failure responses", async () => {
    vi.mocked(getDb).mockResolvedValue(db() as never);
    services.getWorkspace.mockResolvedValueOnce(undefined);
    const missing = await getTaskWorkspace(new Request(
      `http://localhost/api/tasks/${taskId}/workspace`,
      { headers: { authorization: "Bearer route-test-token-048" } },
    ), { params: Promise.resolve({ id: taskId }) });
    expect(missing.status).toBe(404);
    await expect(missing.json()).resolves.toMatchObject({ error: { code: "workspace_missing" } });

    services.setupWorkspace.mockRejectedValueOnce(Object.assign(new Error("Project required"), {
      name: "TaskWorkspaceFailure",
      code: "task_project_required",
      status: 409,
    }));
    const failed = await setupTaskWorkspace(new Request(
      `http://localhost/api/tasks/${taskId}/workspace`,
      {
        method: "POST",
        headers: { authorization: "Bearer route-test-token-048", "content-type": "application/json" },
        body: JSON.stringify({ runtimeId, idempotencyKey: "00000000-0000-4000-8000-000000000099" }),
      },
    ), { params: Promise.resolve({ id: taskId }) });
    expect(failed.status).toBe(409);
    await expect(failed.json()).resolves.toMatchObject({ error: { code: "task_project_required" } });
  });
});

describe("Project repository branch route", () => {
  it("derives Project repository scope from the authenticated Team", async () => {
    vi.mocked(getDb).mockResolvedValue(db() as never);

    const response = await getProjectBranches(new Request(
      "http://localhost/api/projects/mystra/repository/branches?first=25&query=release",
      { headers: { authorization: "Bearer route-test-token-048" } },
    ), { params: Promise.resolve({ slug: "mystra" }) });

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(services.listBranches).toHaveBeenCalledWith("mystra", teamId, {
      first: 25,
      query: "release",
    });
    await expect(response.json()).resolves.toEqual({
      branches: [],
      head: null,
      pageInfo: { hasNextPage: false, endCursor: null },
    });
  });

  it("returns stable branch-read failure instead of an empty success page", async () => {
    vi.mocked(getDb).mockResolvedValue(db() as never);
    services.listBranches.mockRejectedValueOnce(new GitRemoteRepositoryError(
      "repository_branches_unavailable",
      "Remote repository branches are unavailable",
    ));

    const response = await getProjectBranches(new Request(
      "http://localhost/api/projects/mystra/repository/branches",
      { headers: { authorization: "Bearer route-test-token-048" } },
    ), { params: Promise.resolve({ slug: "mystra" }) });

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "repository_branches_unavailable",
        message: "Remote repository branches are unavailable",
      },
    });
  });

  it("rejects invalid pagination before calling the branch service", async () => {
    vi.mocked(getDb).mockResolvedValue(db() as never);
    const response = await getProjectBranches(new Request(
      "http://localhost/api/projects/mystra/repository/branches?first=101",
      { headers: { authorization: "Bearer route-test-token-048" } },
    ), { params: Promise.resolve({ slug: "mystra" }) });

    expect(response.status).toBe(400);
    expect(services.listBranches).not.toHaveBeenCalled();
  });
});
