import { describe, expect, it, vi } from "vitest";

import { TaskService } from "./task-service";

const teamId = "00000000-0000-4000-8000-000000000001";
const projectId = "00000000-0000-4000-8000-000000000002";
const connectionId = "00000000-0000-4000-8000-000000000003";
const project = {
  id: projectId, teamId, slug: "mystra", repositoryConnectionId: connectionId,
  repositoryExternalId: "repo-42", archivedAt: null,
};
const resolved = {
  project,
  provider: "github" as const,
  connectionId,
  scopeExternalId: "repo-42",
  issue: { externalId: "issue-7", identifier: "7", title: "Fix it", url: "https://github.com/acme/repo/issues/7" },
};
const task = {
  id: "00000000-0000-4000-8000-000000000004", teamId, title: "Fix it", description: null,
  projectId, issue: { provider: "github" as const, connectionId, scopeExternalId: "repo-42", externalId: "issue-7", identifier: "7" },
  status: "pending" as const, metadata: {}, statusRevision: 1, statusNote: null,
  statusUpdatedAt: "2026-08-08T00:00:00.000Z",
  statusActor: { kind: "system" as const, actorId: null, agentId: null, attemptId: null, sessionId: null },
  createdAt: "2026-08-08T00:00:00.000Z", updatedAt: "2026-08-08T00:00:00.000Z",
};

describe("TaskService", () => {
  it("composes an Issue Task only after exact external identity verification", async () => {
    const createTaskFromIssue = vi.fn(async (input) => ({ task: { ...task, ...input }, created: true }));
    const service = new TaskService({
      db: { createTaskFromIssue, getProjectById: vi.fn(), getProjectIssueSource: vi.fn() } as never,
      issues: { resolveExactIssue: vi.fn(async () => resolved) } as never,
    });
    await expect(service.createFromIssue("mystra", teamId, "github", { externalId: "issue-7", identifier: "7" }))
      .resolves.toMatchObject({ created: true });
    expect(createTaskFromIssue).toHaveBeenCalledWith(expect.objectContaining({
      teamId, projectId, title: "Fix it", issue: expect.objectContaining({ externalId: "issue-7" }),
    }));
  });

  it("rejects a stale row external ID before persistence", async () => {
    const createTaskFromIssue = vi.fn();
    const service = new TaskService({
      db: { createTaskFromIssue, getProjectById: vi.fn(), getProjectIssueSource: vi.fn() } as never,
      issues: { resolveExactIssue: vi.fn(async () => resolved) } as never,
    });
    await expect(service.createFromIssue("mystra", teamId, "github", { externalId: "stale", identifier: "7" }))
      .rejects.toMatchObject({ code: "ISSUE_NOT_FOUND" });
    expect(createTaskFromIssue).not.toHaveBeenCalled();
  });

  it("returns unavailable without provider access when the source changed", async () => {
    const resolveExactIssue = vi.fn();
    const service = new TaskService({
      db: {
        createTaskFromIssue: vi.fn(),
        getProjectById: vi.fn(async () => ({ ...project, repositoryExternalId: "changed" })),
        getProjectIssueSource: vi.fn(),
      } as never,
      issues: { resolveExactIssue } as never,
    });
    await expect(service.resolveIssue(task)).resolves.toEqual({ status: "unavailable" });
    expect(resolveExactIssue).not.toHaveBeenCalled();
  });

  it("keeps the Task readable when provider resolution fails", async () => {
    const service = new TaskService({
      db: {
        createTaskFromIssue: vi.fn(), getProjectById: vi.fn(async () => project), getProjectIssueSource: vi.fn(),
      } as never,
      issues: { resolveExactIssue: vi.fn(async () => { throw new Error("upstream failed"); }) } as never,
    });
    await expect(service.resolveIssue(task)).resolves.toEqual({ status: "unavailable" });
  });
});
