import { randomUUID } from "node:crypto";

import { afterEach, beforeEach, expect, it } from "vitest";

import type { RdbProvider } from "./rdb-provider";

export function runRdbProviderContract(openProvider: () => Promise<RdbProvider>): void {
  let db: RdbProvider;

  beforeEach(async () => {
    db = await openProvider();
  });

  afterEach(async () => {
    await db.close();
  });

  async function connection() {
    return db.upsertIntegrationConnection({
      integration: "github",
      provider: "github",
      authMethod: "personal-access-token",
      providerExternalId: randomUUID(),
      displayName: "Primary GitHub",
      providerSubject: { login: "octocat" },
      connectionConfig: { repositorySelection: "all" },
      capabilities: {
        repositories: {
          state: "enabled",
          config: {},
          permissions: { contents: "write" },
          accessSummary: { repositories: "all" },
          verifiedAt: "2026-08-06T00:00:00.000Z",
        },
      },
      credentialRef: "github-pat/test",
      credentialState: "ready",
    });
  }

  async function project() {
    const repositoryConnection = await connection();
    return db.createProject({
      name: "Mystra",
      slug: `mystra-${randomUUID()}`,
      repositoryConnectionId: repositoryConnection.id,
      repositoryExternalId: "R_kgDOTest",
      repositoryBaseBranch: "main",
      metadata: { tier: "test" },
    });
  }

  it("persists, replaces, clears, lists, and protects integration connections", async () => {
    const created = await connection();
    expect(created.displayName).toBe("Primary GitHub");
    expect("credentialRef" in (await db.getIntegrationConnection(created.id))!).toBe(false);
    expect((await db.getIntegrationConnectionRecord(created.id))?.credentialRef).toBe("github-pat/test");

    const cleared = await db.updateIntegrationConnectionDisplayName(created.id, null);
    expect(cleared?.displayName).toBeNull();

    const boundProject = await db.createProject({
      name: "Bound",
      slug: `bound-${randomUUID()}`,
      repositoryConnectionId: created.id,
      repositoryExternalId: "R_bound",
      repositoryBaseBranch: "main",
      metadata: {},
    });

    const capabilities = {
      issues: {
        state: "disabled" as const,
        config: { reason: "not-configured" },
        permissions: {},
        accessSummary: {},
        verifiedAt: null,
      },
    };
    const replaced = await db.replaceIntegrationConnectionCapabilities(created.id, capabilities);
    expect(replaced?.capabilities).toEqual(capabilities);

    expect(await db.listProjectsForIntegrationConnection(created.id)).toEqual([boundProject]);
    await expect(db.deleteIntegrationConnection(created.id)).rejects.toMatchObject({
      code: "INTEGRATION_CONNECTION_IN_USE",
    });
  });

  it("persists projects with immutable repository identity and deterministic ordering", async () => {
    const first = await project();
    const second = await project();
    expect((await db.listProjects()).map(({ id }) => id)).toEqual([second.id, first.id]);

    const updated = await db.updateProject(first.slug, {
      name: "Mystra renamed",
      slug: `${first.slug}-renamed`,
      repositoryBaseBranch: "develop",
      metadata: { renamed: true },
    });
    expect(updated).toMatchObject({
      id: first.id,
      repositoryConnectionId: first.repositoryConnectionId,
      repositoryExternalId: first.repositoryExternalId,
      repositoryBaseBranch: "develop",
    });

    const archived = await db.archiveProject(updated!.slug);
    expect(archived?.archivedAt).toBeTruthy();
    expect(await db.listProjects()).toEqual([second]);
    expect(await db.listProjects({ includeArchived: true })).toHaveLength(2);
  });

  it("persists tasks and dispatches one task for a repeated issue key", async () => {
    const parent = await project();
    const ordinary = await db.createTask({ projectId: parent.id, metadata: { kind: "manual" } });
    expect(await db.getTask(ordinary.id)).toEqual(ordinary);

    const key = `linear:ENG-1:${parent.id}`;
    const [left, right] = await Promise.all([
      db.dispatchIssue({ projectId: parent.id, issueDispatchKey: key, metadata: { source: "linear" } }),
      db.dispatchIssue({ projectId: parent.id, issueDispatchKey: key, metadata: { source: "linear" } }),
    ]);
    expect([left.created, right.created].sort()).toEqual([false, true]);
    expect(left.task.id).toBe(right.task.id);
    expect(await db.getTaskByIssueDispatchKey(key)).toEqual(left.task);
    expect((await db.listTasks({ projectId: parent.id })).map(({ id }) => id)).toEqual([
      left.task.id,
      ordinary.id,
    ]);
  });

  it("normalizes slug, foreign-key, and dispatch conflicts", async () => {
    const parent = await project();
    await expect(db.createProject({
      name: "Duplicate",
      slug: parent.slug,
      repositoryConnectionId: parent.repositoryConnectionId,
      repositoryExternalId: "R_duplicate",
      repositoryBaseBranch: "main",
      metadata: {},
    })).rejects.toMatchObject({ code: "PROJECT_SLUG_CONFLICT" });

    await expect(db.createTask({ projectId: randomUUID(), metadata: {} })).rejects.toMatchObject({
      code: "RDB_RELATION_CONFLICT",
    });

    const key = `github:1:${parent.id}`;
    await db.createTask({ projectId: parent.id, issueDispatchKey: key, metadata: {} });
    await expect(db.createTask({
      projectId: parent.id,
      issueDispatchKey: key,
      metadata: {},
    })).rejects.toMatchObject({ code: "DISPATCH_CONFLICT" });
  });
}
