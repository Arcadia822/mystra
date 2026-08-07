import { randomUUID } from "node:crypto";

import { afterEach, beforeEach, expect, it } from "vitest";

import type { RdbProvider } from "./rdb-provider";

function envelope(reference: string) {
  return {
    reference,
    version: 1 as const,
    algorithm: "aes-256-gcm+aes-256-gcm-wrap" as const,
    keyId: "contract-v1",
    ciphertext: "Y2lwaGVydGV4dA==",
    ciphertextIv: "MDEyMzQ1Njc4OWFi",
    ciphertextAuthTag: "MDEyMzQ1Njc4OWFiY2RlZg==",
    wrappedDataKey: "d3JhcHBlZA==",
    wrappedDataKeyIv: "YWJjZGVmMDEyMzQ1",
    wrappedDataKeyAuthTag: "ZmVkY2JhOTg3NjU0MzIxMA==",
  };
}

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

  it("persists immutable envelopes and atomically follows a PAT credential lifecycle", async () => {
    const id = randomUUID();
    const firstReference = `github-pat/${id}/${randomUUID()}`;
    const secondReference = `github-pat/${id}/${randomUUID()}`;
    const input = {
      id,
      integration: "github",
      provider: "github",
      authMethod: "personal-access-token",
      providerExternalId: `pat:${randomUUID()}`,
      displayName: "Envelope contract",
      providerSubject: { login: "octocat" },
      connectionConfig: {},
      capabilities: {},
      credentialState: "ready" as const,
      credentialRef: firstReference,
      status: "active" as const,
    };

    const created = await db.upsertIntegrationConnectionWithSecret(input, envelope(firstReference));
    expect(created.credentialRef).toBe(firstReference);
    expect(await db.getSecretEnvelope(firstReference)).toMatchObject({
      reference: firstReference,
      keyId: "contract-v1",
    });

    const collidingReference = `github-pat/${id}/${randomUUID()}`;
    await db.createSecretEnvelope(envelope(collidingReference));
    await expect(db.replaceIntegrationConnectionWithSecret(
      id,
      { ...input, providerExternalId: `pat:${randomUUID()}`, credentialRef: collidingReference },
      envelope(collidingReference),
      firstReference,
    )).rejects.toMatchObject({ code: "INTEGRATION_CONNECTION_CONFLICT" });
    expect((await db.getIntegrationConnectionRecord(id))?.credentialRef).toBe(firstReference);
    expect(await db.getSecretEnvelope(firstReference)).toBeDefined();

    const replaced = await db.replaceIntegrationConnectionWithSecret(
      id,
      { ...input, providerExternalId: `pat:${randomUUID()}`, credentialRef: secondReference },
      envelope(secondReference),
      firstReference,
    );
    expect(replaced?.credentialRef).toBe(secondReference);
    expect(await db.getSecretEnvelope(firstReference)).toBeUndefined();
    expect(await db.getSecretEnvelope(secondReference)).toBeDefined();

    await expect(db.deleteIntegrationConnectionWithSecret(id, firstReference))
      .rejects.toMatchObject({ code: "RDB_CONFLICT" });
    expect(await db.getIntegrationConnectionRecord(id)).toBeDefined();
    expect(await db.getSecretEnvelope(secondReference)).toBeDefined();

    expect(await db.deleteIntegrationConnectionWithSecret(id, secondReference)).toBe(true);
    expect(await db.getIntegrationConnectionRecord(id)).toBeUndefined();
    expect(await db.getSecretEnvelope(secondReference)).toBeUndefined();
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

    const distinctKeys = [`linear:ENG-2:${parent.id}`, `linear:ENG-3:${parent.id}`];
    const distinct = await Promise.all(distinctKeys.map((issueDispatchKey) => db.dispatchIssue({
      projectId: parent.id,
      issueDispatchKey,
      metadata: { source: "linear" },
    })));
    expect(distinct.map(({ created }) => created)).toEqual([true, true]);
    expect(new Set(distinct.map(({ task }) => task.id)).size).toBe(2);

    const listedTaskIds = (await db.listTasks({ projectId: parent.id })).map(({ id }) => id);
    expect(listedTaskIds).toHaveLength(4);
    expect(new Set(listedTaskIds)).toEqual(new Set([
      distinct[0]!.task.id,
      distinct[1]!.task.id,
      left.task.id,
      ordinary.id,
    ]));

    await db.archiveProject(parent.slug);
    await expect(db.dispatchIssue({
      projectId: parent.id,
      issueDispatchKey: key,
      metadata: { ignoredOnReplay: true },
    })).resolves.toEqual({ task: left.task, created: false });
    await expect(db.dispatchIssue({
      projectId: parent.id,
      issueDispatchKey: `linear:ENG-4:${parent.id}`,
      metadata: {},
    })).rejects.toMatchObject({ code: "RDB_RELATION_CONFLICT" });
    expect(await db.getTaskByIssueDispatchKey(`linear:ENG-4:${parent.id}`)).toBeUndefined();
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
