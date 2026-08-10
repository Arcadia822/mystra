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

function workspaceRuntimeRegistration(name: string) {
  return {
    runnerId: randomUUID(),
    name,
    type: "host" as const,
    platform: "darwin-arm64",
    providers: [],
    workspaceMaterialization: {
      version: 1 as const,
      kinds: ["task-repository"] as ["task-repository"],
      sharingModes: ["shared-mutable"] as ["shared-mutable"],
    },
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

  async function tenant() {
    const suffix = randomUUID().replaceAll("-", "");
    return db.registerLocalUser({
      username: `user_${suffix}`,
      displayName: `User ${suffix}`,
      passwordHash: "scrypt$v1$hash",
      passwordSalt: "salt",
      passwordParams: "N=16384,r=8,p=1",
      initialTeamDisplayName: `Team ${suffix}`,
      tokenHash: randomUUID(),
      expiresAt: "2027-08-06T00:00:00.000Z",
    });
  }

  async function project() {
    const { initialTeam } = await tenant();
    const repositoryConnection = await db.upsertIntegrationConnection({
      teamId: initialTeam.id,
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
    return db.createProject({
      teamId: initialTeam.id,
      name: "Mystra",
      slug: `mystra-${randomUUID()}`,
      repositoryConnectionId: repositoryConnection.id,
      repositoryExternalId: "R_kgDOTest",
      repositoryBaseBranch: "main",
      metadata: { tier: "test" },
    });
  }

  it("persists, replaces, clears, lists, and protects integration connections", async () => {
    const { initialTeam } = await tenant();
    const created = await db.upsertIntegrationConnection({
      teamId: initialTeam.id,
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
    expect(created.displayName).toBe("Primary GitHub");
    expect("credentialRef" in (await db.getIntegrationConnection(created.id))!).toBe(false);
    expect((await db.getIntegrationConnectionRecord(created.id))?.credentialRef).toBe("github-pat/test");

    const cleared = await db.updateIntegrationConnectionDisplayName(created.id, null);
    expect(cleared?.displayName).toBeNull();

    const boundProject = await db.createProject({
      teamId: initialTeam.id,
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

    expect(await db.listProjectsForIntegrationConnection(created.id, { teamId: initialTeam.id }))
      .toEqual([boundProject]);
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
      teamId: (await tenant()).initialTeam.id,
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

  it("persists exactly one Linear Team source per Project and protects its connection", async () => {
    const parent = await project();
    const connection = await db.upsertIntegrationConnection({
      teamId: parent.teamId,
      integration: "linear",
      provider: "linear",
      authMethod: "api-key",
      providerExternalId: randomUUID(),
      displayName: "Linear product",
      providerSubject: { name: "Ada" },
      connectionConfig: { workspaceId: "workspace-1" },
      capabilities: { issues: { state: "enabled", config: {}, permissions: { read: true }, accessSummary: {}, verifiedAt: "2026-08-08T00:00:00.000Z" } },
      credentialRef: `linear-api-key/${randomUUID()}`,
      credentialState: "ready",
    });

    const created = await db.upsertProjectIssueSource({
      teamId: parent.teamId,
      projectId: parent.id,
      integration: "linear",
      connectionId: connection.id,
      scopeType: "linear-team",
      scopeExternalId: "linear-team-1",
    });
    expect(await db.getProjectIssueSource(parent.id, "linear", { teamId: parent.teamId })).toEqual(created);

    const replaced = await db.upsertProjectIssueSource({
      teamId: parent.teamId,
      projectId: parent.id,
      integration: "linear",
      connectionId: connection.id,
      scopeType: "linear-team",
      scopeExternalId: "linear-team-2",
    });
    expect(replaced.id).toBe(created.id);
    expect(replaced.scopeExternalId).toBe("linear-team-2");
    expect(await db.listProjectIssueSourcesForConnection(connection.id, { teamId: parent.teamId }))
      .toEqual([replaced]);

    await expect(db.deleteIntegrationConnection(connection.id)).rejects.toMatchObject({
      code: "INTEGRATION_CONNECTION_IN_USE",
    });
    expect(await db.deleteProjectIssueSource(parent.id, "linear", { teamId: parent.teamId })).toBe(true);
    expect(await db.getProjectIssueSource(parent.id, "linear", { teamId: parent.teamId })).toBeUndefined();
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

  it("persists no-Project and Project Tasks with durable manual replay", async () => {
    const standaloneTeam = (await tenant()).initialTeam;
    const idempotencyKey = randomUUID();
    const first = await db.createTask({
      teamId: standaloneTeam.id,
      title: "  Standalone context  ",
      description: null,
      projectId: null,
      idempotencyKey,
    });
    const replay = await db.createTask({
      teamId: standaloneTeam.id,
      title: "Different retry payload",
      description: "Ignored after the operation commits",
      projectId: null,
      idempotencyKey,
    });
    expect(first.created).toBe(true);
    expect(replay).toEqual({ task: first.task, created: false });
    expect(first.task).toMatchObject({
      teamId: standaloneTeam.id,
      title: "Standalone context",
      projectId: null,
      issue: null,
    });
    expect(await db.getTask(first.task.id, { teamId: standaloneTeam.id })).toEqual(first.task);

    const parent = await project();
    const ordinary = await db.createTask({
      teamId: parent.teamId,
      projectId: parent.id,
      title: "Project context",
      description: "Owned by Mystra",
      idempotencyKey: randomUUID(),
    });
    expect(ordinary.task.projectId).toBe(parent.id);
    expect((await db.listTasks({ projectId: parent.id })).map(({ id }) => id)).toEqual([ordinary.task.id]);
  });

  it("atomically creates one Task for an exact Issue under a 20-way race", async () => {
    const parent = await project();
    const sibling = await db.createProject({
      teamId: parent.teamId,
      name: "Same source sibling",
      slug: `sibling-${randomUUID()}`,
      repositoryConnectionId: parent.repositoryConnectionId,
      repositoryExternalId: parent.repositoryExternalId,
      repositoryBaseBranch: "main",
      metadata: {},
    });
    const issue = {
      provider: "github" as const,
      connectionId: parent.repositoryConnectionId,
      scopeExternalId: parent.repositoryExternalId,
      externalId: "I_kwDOExact42",
      identifier: "GH-42",
    };
    const results = await Promise.all(Array.from({ length: 20 }, (_, index) => db.createTaskFromIssue({
      teamId: parent.teamId,
      projectId: index % 2 === 0 ? parent.id : sibling.id,
      title: "Fix exact issue",
      description: null,
      issue,
    })));
    expect(results.filter(({ created }) => created)).toHaveLength(1);
    expect(new Set(results.map(({ task }) => task.id)).size).toBe(1);
    const task = results[0]!.task;
    expect(task.issue).toEqual(issue);

    const links = await db.findTaskIdsByIssueExternalIds({
      teamId: parent.teamId,
      provider: "github",
      connectionId: parent.repositoryConnectionId,
      scopeExternalId: parent.repositoryExternalId,
      externalIds: [issue.externalId, "I_missing", issue.externalId],
    });
    expect(links).toEqual({ [issue.externalId]: task.id });

    const updated = await db.updateTask(task.id, {
      title: "Updated owned title",
      description: "Updated owned description",
    }, { teamId: parent.teamId });
    expect(updated).toMatchObject({ title: "Updated owned title", description: "Updated owned description" });
    expect(updated?.projectId).toBe(task.projectId);
    expect(updated?.issue).toEqual(task.issue);

    const otherTeam = (await tenant()).initialTeam;
    expect(await db.getTask(task.id, { teamId: otherTeam.id })).toBeUndefined();
    expect(await db.updateTask(task.id, { title: "Forbidden" }, { teamId: otherTeam.id })).toBeUndefined();

    await db.archiveProject(parent.slug);
    await expect(db.createTaskFromIssue({
      teamId: parent.teamId,
      projectId: parent.id,
      title: "Another issue",
      description: null,
      issue: { ...issue, externalId: "I_kwDONew", identifier: "GH-43" },
    })).rejects.toMatchObject({ code: "RDB_RELATION_CONFLICT" });
  });

  it("persists host Runtimes and atomically replaces their Provider capabilities", async () => {
    const registration = {
      runnerId: "runner-contract",
      name: "Contract host",
      type: "host" as const,
      platform: "darwin-arm64",
      providers: [{
        provider: "copilot" as const,
        discovered: true,
        available: true,
        source: "path" as const,
        resolvedPath: "/usr/local/bin/copilot",
        version: "1.0.0",
        unavailableReason: null,
      }],
      workspaceMaterialization: {
        version: 1 as const,
        kinds: ["task-repository"] as ["task-repository"],
        sharingModes: ["shared-mutable"] as ["shared-mutable"],
      },
    };
    const registered = await db.registerHostRuntime(registration);

    expect(registered).toMatchObject({
      name: registration.name,
      type: "host",
      metadata: {
        runnerId: registration.runnerId,
        platform: registration.platform,
        workspaceMaterialization: registration.workspaceMaterialization,
      },
      status: "offline",
      lastSeenAt: null,
      providers: registration.providers,
    });
    expect(await db.registerHostRuntime(registration)).toEqual(registered);
    expect(await db.getRuntime(registered.id)).toEqual(registered);
    expect(await db.listRuntimes()).toEqual([registered]);

    const reported = await db.reportHostProviders(registration.runnerId, [{
      provider: "codex",
      discovered: false,
      available: false,
      source: "env-override",
      resolvedPath: null,
      version: null,
      unavailableReason: "override-path-missing",
    }]);
    expect(reported).toMatchObject({
      id: registered.id,
      providers: [expect.objectContaining({ provider: "codex", available: false })],
    });
    expect(reported?.updatedAt).not.toBe(registered.updatedAt);

    await expect(db.reportHostProviders(registration.runnerId, [
      ...reported!.providers,
      ...reported!.providers,
    ])).rejects.toMatchObject({ code: "RDB_CONFLICT" });
    expect((await db.getRuntime(registered.id))?.providers).toEqual(reported!.providers);

    const renamed = await db.renameRuntime(registered.id, { name: "Renamed host" });
    expect(renamed).toMatchObject({ id: registered.id, name: "Renamed host" });
    expect(await db.reportHostProviders("unknown-runner", registration.providers)).toBeUndefined();
  });

  it("persists one Task Workspace, fences attempts, and preserves Runtime affinity", async () => {
    const parent = await project();
    const task = (await db.createTask({
      teamId: parent.teamId,
      projectId: parent.id,
      title: "Prepare a repository",
      description: null,
      idempotencyKey: randomUUID(),
    })).task;
    const registration = workspaceRuntimeRegistration("Workspace host");
    const runtime = await db.registerHostRuntime(registration);
    const input = {
      teamId: parent.teamId,
      taskId: task.id,
      projectId: parent.id,
      runtimeId: runtime.id,
      connectionId: parent.repositoryConnectionId,
      repositoryExternalId: parent.repositoryExternalId,
      configuredBaseBranch: parent.repositoryBaseBranch,
      issueProvider: null,
      issueConnectionId: null,
      issueScopeExternalId: null,
      issueExternalId: null,
      baseRef: "refs/heads/main",
      baseCommit: "0123456789abcdef0123456789abcdef01234567",
      branchName: `mystra/task-${task.id.slice(0, 12).toLowerCase()}`,
      branchStrategy: "mystra-task-fallback-v1",
    } as const;

    const results = await Promise.all(Array.from({ length: 20 }, () => db.createTaskWorkspace(input)));
    expect(results.filter(({ created }) => created)).toHaveLength(1);
    expect(new Set(results.map(({ workspace }) => workspace.id)).size).toBe(1);
    const created = results[0]!;
    expect(created.workspace).toMatchObject({
      taskId: task.id,
      state: "queued",
      runtimeId: runtime.id,
      activeAttemptSequence: 1,
      workspaceRef: null,
    });
    expect(created.attempt).toMatchObject({ sequence: 1, state: "queued" });
    expect(await db.getTaskWorkspaceByTaskId(task.id, { teamId: parent.teamId }))
      .toEqual(created.workspace);

    const otherTeam = (await tenant()).initialTeam;
    expect(await db.getTaskWorkspaceByTaskId(task.id, { teamId: otherTeam.id })).toBeUndefined();

    const claimed = await db.claimTaskWorkspacePreparation({
      runnerId: registration.runnerId,
      leaseExpiresAt: "2026-08-10T05:00:00.000Z",
    });
    expect(claimed).toMatchObject({
      workspace: { id: created.workspace.id, state: "preparing" },
      attempt: { id: created.attempt.id, sequence: 1, state: "claimed", runnerId: registration.runnerId },
    });

    const workspaceRef = `host-task-workspace:${created.workspace.id}`;
    const ready = await db.completeTaskWorkspacePreparation({
      workspaceId: created.workspace.id,
      attemptId: created.attempt.id,
      runnerId: registration.runnerId,
      attemptSequence: 1,
      status: "succeeded",
      workspaceRef,
      observed: { baseCommit: input.baseCommit, branchName: input.branchName },
    });
    expect(ready).toMatchObject({ state: "ready", workspaceRef, readyAt: expect.any(String) });
    await expect(db.completeTaskWorkspacePreparation({
      workspaceId: created.workspace.id,
      attemptId: created.attempt.id,
      runnerId: registration.runnerId,
      attemptSequence: 1,
      status: "failed",
      failure: { code: "materialization_failed", message: "late failure" },
    })).rejects.toMatchObject({ code: "STALE_WORKSPACE_ATTEMPT" });

    await expect(db.createTaskWorkspace({ ...input, runtimeId: randomUUID() }))
      .rejects.toMatchObject({ code: "TASK_WORKSPACE_CONFLICT" });
  });

  it("retries a failed preparation under the same Workspace identity and marks missing ready data unavailable", async () => {
    const parent = await project();
    const task = (await db.createTask({
      teamId: parent.teamId,
      projectId: parent.id,
      title: "Retry workspace",
      description: null,
      idempotencyKey: randomUUID(),
    })).task;
    const registration = workspaceRuntimeRegistration("Retry host");
    const runtime = await db.registerHostRuntime(registration);
    const first = await db.createTaskWorkspace({
      teamId: parent.teamId,
      taskId: task.id,
      projectId: parent.id,
      runtimeId: runtime.id,
      connectionId: parent.repositoryConnectionId,
      repositoryExternalId: parent.repositoryExternalId,
      configuredBaseBranch: "main",
      issueProvider: null,
      issueConnectionId: null,
      issueScopeExternalId: null,
      issueExternalId: null,
      baseRef: "refs/heads/main",
      baseCommit: "a".repeat(40),
      branchName: `mystra/task-${task.id.slice(0, 12).toLowerCase()}`,
      branchStrategy: "mystra-task-fallback-v1",
    });
    const claim = await db.claimTaskWorkspacePreparation({
      runnerId: registration.runnerId,
      leaseExpiresAt: "2026-08-10T05:00:00.000Z",
    });
    await db.completeTaskWorkspacePreparation({
      workspaceId: first.workspace.id,
      attemptId: claim!.attempt.id,
      runnerId: registration.runnerId,
      attemptSequence: 1,
      status: "failed",
      failure: { code: "materialization_failed", message: "checkout failed" },
    });

    const retried = await db.retryTaskWorkspace({
      workspaceId: first.workspace.id,
      teamId: parent.teamId,
      runtimeId: runtime.id,
    });
    expect(retried).toMatchObject({
      workspace: { id: first.workspace.id, state: "queued", activeAttemptSequence: 2 },
      attempt: { sequence: 2, state: "queued" },
    });
    await expect(db.retryTaskWorkspace({
      workspaceId: first.workspace.id,
      teamId: parent.teamId,
      runtimeId: randomUUID(),
    })).rejects.toMatchObject({ code: "TASK_WORKSPACE_CONFLICT" });

    const secondClaim = await db.claimTaskWorkspacePreparation({
      runnerId: registration.runnerId,
      leaseExpiresAt: "2026-08-10T06:00:00.000Z",
    });
    const ready = await db.completeTaskWorkspacePreparation({
      workspaceId: first.workspace.id,
      attemptId: secondClaim!.attempt.id,
      runnerId: registration.runnerId,
      attemptSequence: 2,
      status: "succeeded",
      workspaceRef: `host-task-workspace:${first.workspace.id}`,
      observed: { baseCommit: first.workspace.baseCommit, branchName: first.workspace.branchName },
    });
    const unavailable = await db.markTaskWorkspaceUnavailable({
      workspaceId: ready.id,
      runtimeId: runtime.id,
      failureMessage: "Workspace directory is missing",
    });
    expect(unavailable).toMatchObject({
      id: ready.id,
      state: "unavailable",
      workspaceRef: null,
      failureCode: "workspace_missing",
    });
  });

  it("expires a preparation lease before accepting late reports and allows a fenced retry", async () => {
    const parent = await project();
    const task = (await db.createTask({
      teamId: parent.teamId,
      projectId: parent.id,
      title: "Expire workspace lease",
      description: null,
      idempotencyKey: randomUUID(),
    })).task;
    const registration = workspaceRuntimeRegistration("Lease host");
    const runtime = await db.registerHostRuntime(registration);
    const created = await db.createTaskWorkspace({
      teamId: parent.teamId,
      taskId: task.id,
      projectId: parent.id,
      runtimeId: runtime.id,
      connectionId: parent.repositoryConnectionId,
      repositoryExternalId: parent.repositoryExternalId,
      configuredBaseBranch: "main",
      issueProvider: null,
      issueConnectionId: null,
      issueScopeExternalId: null,
      issueExternalId: null,
      baseRef: "refs/heads/main",
      baseCommit: "c".repeat(40),
      branchName: `mystra/task-${task.id.slice(0, 12).toLowerCase()}`,
      branchStrategy: "mystra-task-fallback-v1",
    });
    const expired = await db.claimTaskWorkspacePreparation({
      runnerId: registration.runnerId,
      leaseExpiresAt: "2020-01-01T00:00:00.000Z",
    });
    expect(expired?.attempt.state).toBe("claimed");

    expect(await db.claimTaskWorkspacePreparation({
      runnerId: registration.runnerId,
      leaseExpiresAt: "2026-08-10T07:00:00.000Z",
    })).toBeUndefined();
    expect(await db.getTaskWorkspaceById(created.workspace.id)).toMatchObject({
      state: "failed",
      failureCode: "materialization_failed",
      failureMessage: "Workspace preparation lease expired",
    });
    await expect(db.completeTaskWorkspacePreparation({
      workspaceId: created.workspace.id,
      attemptId: expired!.attempt.id,
      runnerId: registration.runnerId,
      attemptSequence: 1,
      status: "succeeded",
      workspaceRef: `host-task-workspace:${created.workspace.id}`,
      observed: { baseCommit: created.workspace.baseCommit, branchName: created.workspace.branchName },
    })).rejects.toMatchObject({ code: "STALE_WORKSPACE_ATTEMPT" });

    const retried = await db.retryTaskWorkspace({
      workspaceId: created.workspace.id,
      teamId: parent.teamId,
      runtimeId: runtime.id,
    });
    expect(retried).toMatchObject({
      workspace: { id: created.workspace.id, state: "queued", activeAttemptSequence: 2 },
      attempt: { sequence: 2, state: "queued" },
    });
  });

  it("manages Team-owned Agents with revisions, pagination, and detached snapshots", async () => {
    const left = await tenant();
    const right = await tenant();
    const created = await db.createAgent({
      teamId: left.initialTeam.id,
      name: "Reviewer",
      systemPrompt: " Review the submitted evidence. ",
    });
    const duplicateName = await db.createAgent({
      teamId: left.initialTeam.id,
      name: "Reviewer",
      systemPrompt: "A different behavior role.",
    });

    expect(created).toMatchObject({
      teamId: left.initialTeam.id,
      name: "Reviewer",
      systemPrompt: " Review the submitted evidence. ",
      revision: 1,
      status: "active",
      archivedAt: null,
    });
    expect(duplicateName.id).not.toBe(created.id);
    expect(await db.getAgent(created.id, { teamId: right.initialTeam.id })).toBeUndefined();
    expect(await db.resolveActiveAgent(created.id, { teamId: right.initialTeam.id })).toBeUndefined();

    const firstPage = await db.listAgents({ teamId: left.initialTeam.id, limit: 1 });
    expect(firstPage.agents).toHaveLength(1);
    expect(firstPage.nextCursor).not.toBeNull();
    const secondPage = await db.listAgents({
      teamId: left.initialTeam.id,
      limit: 1,
      ...(firstPage.nextCursor ? { cursor: firstPage.nextCursor } : {}),
    });
    expect(secondPage.agents).toHaveLength(1);
    expect(new Set([firstPage.agents[0]!.id, secondPage.agents[0]!.id])).toEqual(
      new Set([created.id, duplicateName.id]),
    );

    const snapshot = await db.resolveActiveAgent(created.id, { teamId: left.initialTeam.id });
    expect(snapshot).toEqual({
      agentId: created.id,
      revision: 1,
      systemPrompt: " Review the submitted evidence. ",
    });

    const renamed = await db.updateAgent(created.id, {
      teamId: left.initialTeam.id,
      expectedRevision: 1,
      name: "Clinical Reviewer",
    });
    expect(renamed).toMatchObject({ name: "Clinical Reviewer", revision: 1 });

    const updated = await db.updateAgent(created.id, {
      teamId: left.initialTeam.id,
      expectedRevision: 1,
      systemPrompt: "Reject unsupported claims.",
    });
    expect(updated).toMatchObject({ revision: 2, systemPrompt: "Reject unsupported claims." });
    expect(snapshot).toEqual({
      agentId: created.id,
      revision: 1,
      systemPrompt: " Review the submitted evidence. ",
    });
    expect(await db.resolveActiveAgent(created.id, { teamId: left.initialTeam.id })).toEqual({
      agentId: created.id,
      revision: 2,
      systemPrompt: "Reject unsupported claims.",
    });

    const unchanged = await db.updateAgent(created.id, {
      teamId: left.initialTeam.id,
      expectedRevision: 2,
      systemPrompt: "Reject unsupported claims.",
    });
    expect(unchanged?.revision).toBe(2);

    const concurrent = await Promise.allSettled([
      db.updateAgent(created.id, {
        teamId: left.initialTeam.id,
        expectedRevision: 2,
        systemPrompt: "Concurrent left.",
      }),
      db.updateAgent(created.id, {
        teamId: left.initialTeam.id,
        expectedRevision: 2,
        systemPrompt: "Concurrent right.",
      }),
    ]);
    expect(concurrent.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(concurrent.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect(concurrent.find((result) => result.status === "rejected")).toMatchObject({
      reason: { code: "AGENT_REVISION_CONFLICT" },
    });

    const current = await db.getAgent(created.id, { teamId: left.initialTeam.id });
    const archived = await db.archiveAgent(created.id, {
      teamId: left.initialTeam.id,
      expectedRevision: current!.revision,
    });
    expect(archived).toMatchObject({ status: "archived" });
    expect(await db.getAgent(created.id, { teamId: left.initialTeam.id })).toEqual(archived);
    expect((await db.listAgents({ teamId: left.initialTeam.id })).agents.map(({ id }) => id))
      .toEqual([duplicateName.id]);
    expect((await db.listAgents({ teamId: left.initialTeam.id, includeArchived: true })).agents)
      .toContainEqual(archived);
    await expect(db.resolveActiveAgent(created.id, { teamId: left.initialTeam.id }))
      .rejects.toMatchObject({ code: "AGENT_ARCHIVED" });
    await expect(db.updateAgent(created.id, {
      teamId: left.initialTeam.id,
      expectedRevision: archived!.revision,
      name: "Forbidden",
    })).rejects.toMatchObject({ code: "AGENT_ARCHIVED" });
    await expect(db.archiveAgent(created.id, {
      teamId: left.initialTeam.id,
      expectedRevision: archived!.revision,
    })).resolves.toEqual(archived);
  });

  it("normalizes slug, foreign-key, and dispatch conflicts", async () => {
    const parent = await project();
    await expect(db.createProject({
      teamId: parent.teamId,
      name: "Duplicate",
      slug: parent.slug,
      repositoryConnectionId: parent.repositoryConnectionId,
      repositoryExternalId: "R_duplicate",
      repositoryBaseBranch: "main",
      metadata: {},
    })).rejects.toMatchObject({ code: "PROJECT_SLUG_CONFLICT" });

    await expect(db.createTask({
      teamId: parent.teamId,
      projectId: randomUUID(),
      title: "Missing project",
      description: null,
      idempotencyKey: randomUUID(),
    })).rejects.toMatchObject({
      code: "RDB_RELATION_CONFLICT",
    });
  });

  it("registers a User, owner Team, and active session atomically", async () => {
    const username = `user_${randomUUID().replaceAll("-", "")}`;
    const input = {
      username,
      displayName: "Operator",
      passwordHash: "scrypt$v1$hash",
      passwordSalt: "salt",
      passwordParams: "N=16384,r=8,p=1",
      initialTeamDisplayName: "Personal Team",
      tokenHash: randomUUID(),
      expiresAt: "2027-08-06T00:00:00.000Z",
    };
    const registered = await db.registerLocalUser(input);

    expect(registered.user.username).toBe(username);
    expect(registered.initialTeam.status).toBe("active");
    expect(registered.ownerMembership).toMatchObject({
      teamId: registered.initialTeam.id,
      userId: registered.user.id,
      role: "owner",
      status: "active",
    });
    expect(registered.session.activeTeamId).toBe(registered.initialTeam.id);
    expect(await db.resolveActiveTeam(registered.session.id)).toMatchObject({
      team: { id: registered.initialTeam.id },
      role: "owner",
    });

    const duplicate = await Promise.allSettled([
      db.registerLocalUser({ ...input, tokenHash: randomUUID() }),
      db.registerLocalUser({ ...input, tokenHash: randomUUID() }),
    ]);
    expect(duplicate.every((result) => result.status === "rejected")).toBe(true);
    expect(await db.getAuthAccountForUser(registered.user.id)).toMatchObject({
      passwordHash: input.passwordHash,
    });
  });

  it("filters existing resources by Team and rejects cross-Team writes", async () => {
    const left = await tenant();
    const right = await tenant();
    const connection = await db.upsertIntegrationConnection({
      teamId: left.initialTeam.id,
      integration: "github",
      provider: "github",
      authMethod: "personal-access-token",
      providerExternalId: randomUUID(),
      providerSubject: {},
      credentialState: "ready",
    });
    expect(await db.listIntegrationConnections({ teamId: right.initialTeam.id })).toEqual([]);
    await expect(db.createProject({
      teamId: right.initialTeam.id,
      name: "Cross-team",
      slug: `cross-team-${randomUUID()}`,
      repositoryConnectionId: connection.id,
      repositoryExternalId: "R_cross_team",
      repositoryBaseBranch: "main",
      metadata: {},
    })).rejects.toMatchObject({ code: "RDB_RELATION_CONFLICT" });
  });

  it("protects the last active Team and last active Owner", async () => {
    const registered = await tenant();
    await expect(db.removeMember(registered.initialTeam.id, registered.user.id))
      .rejects.toMatchObject({ code: "RDB_CONFLICT" });

    const additional = await db.createTeam(registered.user.id, "Additional Team");
    await expect(db.setMemberRole(additional.team.id, registered.user.id, "admin"))
      .rejects.toMatchObject({ code: "RDB_CONFLICT" });

    const other = await tenant();
    const added = await db.addMemberByUsername(additional.team.id, other.user.username);
    await db.setMemberRole(additional.team.id, added.userId, "owner");
    await expect(db.removeMember(additional.team.id, registered.user.id)).resolves.toBe(true);
    expect(await db.countActiveOwners(additional.team.id)).toBe(1);
  });

  it("updates account credentials and sessions without persisting password plaintext", async () => {
    const registered = await tenant();
    const otherSession = await db.createAuthSession({
      userId: registered.user.id,
      tokenHash: randomUUID(),
      expiresAt: "2027-08-06T00:00:00.000Z",
    });

    const renamed = await db.updateUserDisplayName(registered.user.id, "Renamed User");
    expect(renamed).toMatchObject({ id: registered.user.id, displayName: "Renamed User" });

    const updated = await db.replacePasswordCredentialAndRevokeOtherSessions({
      userId: registered.user.id,
      currentSessionId: registered.session.id,
      passwordHash: "scrypt$v1$replacement",
      passwordSalt: "replacement-salt",
      passwordParams: "N=32768,r=8,p=1,maxmem=67108864",
    });
    expect(updated).toMatchObject({
      id: registered.user.id,
      requirePasswordChange: false,
    });
    expect(await db.getAuthAccountForUser(registered.user.id)).toMatchObject({
      passwordHash: "scrypt$v1$replacement",
      passwordSalt: "replacement-salt",
    });
    expect(await db.listAuthSessionsForUser(registered.user.id)).toEqual([
      expect.objectContaining({ id: registered.session.id }),
    ]);
    expect(await db.deleteAuthSessionForUser(registered.user.id, otherSession.id)).toBe(false);
  });

  it("fails closed when account deactivation would violate Team lifecycle invariants", async () => {
    const registered = await tenant();

    await expect(db.deactivateLocalUser(registered.user.id)).rejects.toMatchObject({
      code: "RDB_CONFLICT",
    });

    const additional = await db.createTeam(registered.user.id, "Additional Team");
    const other = await tenant();
    await db.addMemberByUsername(registered.initialTeam.id, other.user.username);
    await db.setMemberRole(registered.initialTeam.id, other.user.id, "owner");
    await db.addMemberByUsername(additional.team.id, other.user.username);
    await db.setMemberRole(additional.team.id, other.user.id, "owner");

    await expect(db.deactivateLocalUser(registered.user.id)).resolves.toBe(true);
    expect(await db.getUserById(registered.user.id)).toMatchObject({ status: "disabled" });
    expect(await db.listAuthSessionsForUser(registered.user.id)).toEqual([]);
    expect(await db.countActiveTeamsForUser(registered.user.id)).toBe(2);
    expect(await db.countActiveOwners(additional.team.id)).toBe(2);
  });

  it("atomically persists, claims, continues, and pages a Session event ledger", async () => {
    const projectRecord = await project();
    const task = (await db.createTask({
      teamId: projectRecord.teamId,
      projectId: projectRecord.id,
      title: "Implement Session launch",
      description: null,
      idempotencyKey: randomUUID(),
    })).task;
    const agent = await db.createAgent({
      teamId: projectRecord.teamId,
      name: "Contract Agent",
      systemPrompt: "Execute the requested change.",
    });
    const runtime = await db.registerHostRuntime(workspaceRuntimeRegistration("Session runtime"));
    await db.reportHostProviders(runtime.metadata.runnerId, [{
      provider: "codex", discovered: true, available: true, source: "path",
      resolvedPath: "/usr/bin/codex", version: "1.0.0", unavailableReason: null,
    }]);
    const workspaceCreated = await db.createTaskWorkspace({
      teamId: projectRecord.teamId,
      taskId: task.id,
      projectId: projectRecord.id,
      runtimeId: runtime.id,
      connectionId: projectRecord.repositoryConnectionId,
      repositoryExternalId: projectRecord.repositoryExternalId,
      configuredBaseBranch: projectRecord.repositoryBaseBranch,
      issueProvider: null,
      issueConnectionId: null,
      issueScopeExternalId: null,
      issueExternalId: null,
      baseRef: "refs/heads/main",
      baseCommit: "d".repeat(40),
      branchName: `mystra/task-${task.id.slice(0, 12).toLowerCase()}`,
      branchStrategy: "mystra-task-fallback-v1",
    });
    const workspaceClaim = await db.claimTaskWorkspacePreparation({
      runnerId: runtime.metadata.runnerId,
      leaseExpiresAt: "2026-08-10T00:01:00.000Z",
    });
    const readyWorkspace = await db.completeTaskWorkspacePreparation({
      workspaceId: workspaceCreated.workspace.id,
      attemptId: workspaceClaim!.attempt.id,
      runnerId: runtime.metadata.runnerId,
      attemptSequence: workspaceClaim!.attempt.sequence,
      status: "succeeded",
      workspaceRef: `host-task-workspace:${workspaceCreated.workspace.id}`,
      observed: {
        baseCommit: workspaceCreated.workspace.baseCommit,
        branchName: workspaceCreated.workspace.branchName,
      },
    });
    const sessionId = randomUUID();
    const messageId = randomUUID();
    const timestamp = "2026-08-10T00:00:00.000Z";
    const launchRequest = {
      sessionId,
      runtimeId: runtime.id,
      providerKey: "codex",
      agentId: agent.id,
      context: { taskId: task.id, projectId: projectRecord.id },
      firstUserMessage: { messageId, content: [{ type: "text" as const, text: "Implement it" }] },
      metadata: {},
    };
    const session = {
      id: sessionId,
      teamId: projectRecord.teamId,
      taskId: task.id,
      projectId: projectRecord.id,
      runtimeId: runtime.id,
      providerKey: "codex",
      agentId: agent.id,
      agentRevision: agent.revision,
      state: "queued" as const,
      activeMessageId: messageId,
      lastMessageId: null,
      interruptKind: null,
      continuationMode: null,
      failureCode: null,
      metadata: {},
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    const initialPayloads = [
      { kind: "session.created" as const, payload: { runtimeId: runtime.id, providerKey: "codex", agentId: agent.id, agentRevision: agent.revision, taskId: task.id, projectId: projectRecord.id, context: launchRequest.context } },
      { kind: "session.system_prompt_configured" as const, payload: { components: ["runtime", "provider", "agent", "context"].map((name) => ({ name, content: name })), finalPrompt: "assembled prompt" } },
      { kind: "session.workspace_attached" as const, payload: { kind: "task", taskWorkspaceId: readyWorkspace.id, runtimeId: runtime.id, workspaceRef: readyWorkspace.workspaceRef!, sharingMode: "shared-mutable" } },
      { kind: "session.user_message_submitted" as const, payload: { content: launchRequest.firstUserMessage.content }, messageId },
    ];
    const events = initialPayloads.map((event, index) => ({
      eventId: randomUUID(), sessionId, sourceId: "control-plane", sourceSequence: index + 1,
      globalSequence: index + 1, kind: event.kind, version: 1 as const,
      ...(event.messageId ? { messageId: event.messageId } : {}), payload: event.payload,
      metadata: {}, occurredAt: timestamp, acceptedAt: timestamp,
    }));

    await expect(db.createSessionWithEvents({ session, launchRequest, events }))
      .resolves.toMatchObject({ created: true, session: { id: sessionId, state: "queued" } });
    await expect(db.createSessionWithEvents({ session, launchRequest, events }))
      .resolves.toMatchObject({ created: false });
    const launchReplays = await Promise.all(Array.from({ length: 20 }, () => (
      db.createSessionWithEvents({ session, launchRequest, events })
    )));
    expect(launchReplays.every((result) => result.created === false)).toBe(true);

    const leaseTokenHash = "a".repeat(64);
    await db.reportHostProviders(runtime.metadata.runnerId, [{
      provider: "codex", discovered: true, available: false, source: "path",
      resolvedPath: "/usr/bin/codex", version: "1.0.0", unavailableReason: "exec-failed",
    }]);
    await expect(db.claimSession({
      runtimeId: runtime.id,
      runnerId: runtime.metadata.runnerId,
      lease: {
        id: randomUUID(), runtimeId: runtime.id, runnerId: runtime.metadata.runnerId,
        leaseToken: "b".repeat(32), leaseTokenHash, providerSessionId: null,
        leaseExpiresAt: "2026-08-10T00:01:00.000Z", claimedAt: timestamp, updatedAt: timestamp,
      },
    })).rejects.toMatchObject({ code: "RDB_CONFLICT" });
    await db.reportHostProviders(runtime.metadata.runnerId, [{
      provider: "codex", discovered: true, available: true, source: "path",
      resolvedPath: "/usr/bin/codex", version: "1.0.0", unavailableReason: null,
    }]);
    await expect(db.claimSession({
      runtimeId: runtime.id,
      runnerId: "foreign-runner",
      lease: {
        id: randomUUID(), runtimeId: runtime.id, runnerId: "foreign-runner",
        leaseToken: "b".repeat(32), leaseTokenHash, providerSessionId: null,
        leaseExpiresAt: "2026-08-10T00:01:00.000Z", claimedAt: timestamp, updatedAt: timestamp,
      },
    })).rejects.toMatchObject({ code: "RDB_CONFLICT" });
    const claimed = await db.claimSession({
      runtimeId: runtime.id,
      runnerId: runtime.metadata.runnerId,
      lease: {
        id: randomUUID(), runtimeId: runtime.id, runnerId: runtime.metadata.runnerId,
        leaseToken: "b".repeat(32), leaseTokenHash, providerSessionId: null,
        leaseExpiresAt: "2026-08-10T00:01:00.000Z", claimedAt: timestamp, updatedAt: timestamp,
      },
    });
    expect(claimed?.session.state).toBe("dispatched");

    const runnerEvents = [
      { kind: "session.provider_started" as const, payload: { providerSessionId: "provider-1" } },
      { kind: "session.response_started" as const, payload: {}, messageId },
      { kind: "session.response_completed" as const, payload: { stopReason: "end_turn", summary: "done" }, messageId },
    ].map((event, index) => ({
      eventId: randomUUID(), sessionId, sourceId: runtime.metadata.runnerId, sourceSequence: index + 1,
      kind: event.kind, version: 1 as const, ...(event.messageId ? { messageId: event.messageId } : {}),
      payload: event.payload, metadata: {}, occurredAt: timestamp,
    }));
    await expect(db.appendSessionEvents({
      sessionId, teamId: projectRecord.teamId, leaseTokenHash: "f".repeat(64), events: runnerEvents,
    })).rejects.toMatchObject({ code: "RDB_CONFLICT" });
    await expect(db.appendSessionEvents({
      sessionId, teamId: randomUUID(), leaseTokenHash, events: runnerEvents,
    })).rejects.toMatchObject({ code: "RDB_NOT_FOUND" });
    await expect(db.appendSessionEvents({
      sessionId,
      teamId: projectRecord.teamId,
      leaseTokenHash,
      events: [{ ...runnerEvents[0]!, eventId: randomUUID(), sourceSequence: 2 }],
    })).rejects.toMatchObject({ code: "RDB_CONFLICT" });
    await expect(db.appendSessionEvents({
      sessionId,
      teamId: projectRecord.teamId,
      leaseTokenHash,
      events: [{
        ...runnerEvents[0]!,
        eventId: randomUUID(),
        metadata: { authorization: "must-not-persist" },
      }],
    })).rejects.toBeDefined();
    const appended = await db.appendSessionEvents({
      sessionId, teamId: projectRecord.teamId, leaseTokenHash, events: runnerEvents,
    });
    expect(appended.session).toMatchObject({ state: "ready", activeMessageId: null, lastMessageId: messageId });
    const page = await db.listSessionEvents({ sessionId, teamId: projectRecord.teamId, afterSequence: 4, limit: 10 });
    expect(page.events.map((event) => event.kind)).toEqual([
      "session.runtime_dispatched", "session.provider_started", "session.response_started", "session.response_completed",
    ]);
    const latest = await db.listSessionEvents({
      sessionId, teamId: projectRecord.teamId, order: "desc", limit: 2,
    });
    expect(latest.events.map((event) => event.globalSequence)).toEqual([8, 7]);
    expect(latest.olderCursor).toBe(7);
    const earlier = await db.listSessionEvents({
      sessionId, teamId: projectRecord.teamId, beforeSequence: latest.olderCursor!, order: "desc", limit: 2,
    });
    expect(earlier.events.map((event) => event.globalSequence)).toEqual([6, 5]);
    expect(earlier.olderCursor).toBe(5);

    let controlPlaneSequence = 5;
    for (let continuation = 0; continuation < 2; continuation += 1) {
      const nextMessageId = randomUUID();
      const messageSourceSequence = controlPlaneSequence++;
      const appendMessage = () => db.appendSessionEvents({
        sessionId,
        teamId: projectRecord.teamId,
        events: [{
          eventId: randomUUID(), sessionId, sourceId: "control-plane", sourceSequence: messageSourceSequence,
          kind: "session.user_message_submitted" as const, version: 1 as const, messageId: nextMessageId,
          payload: { content: [{ type: "text" as const, text: `Continue ${continuation}` }] }, metadata: {}, occurredAt: timestamp,
        }],
      });
      if (continuation === 0) {
        await Promise.all(Array.from({ length: 20 }, appendMessage));
        expect((await db.listSessionEvents({
          sessionId, teamId: projectRecord.teamId, messageId: nextMessageId, limit: 10,
        })).events).toHaveLength(1);
      } else {
        await appendMessage();
      }
      const continuationHash = String(continuation + 2).repeat(64);
      const continuationClaim = await db.claimSession({
        runtimeId: runtime.id,
        runnerId: runtime.metadata.runnerId,
        lease: {
          id: randomUUID(), runtimeId: runtime.id, runnerId: runtime.metadata.runnerId,
          leaseToken: String(continuation + 2).repeat(32), leaseTokenHash: continuationHash,
          providerSessionId: null, leaseExpiresAt: "2026-08-10T00:02:00.000Z",
          claimedAt: timestamp, updatedAt: timestamp,
        },
      });
      expect(continuationClaim).toMatchObject({
        session: { state: "dispatched", activeMessageId: nextMessageId },
        lease: { providerSessionId: "provider-1" },
      });
      const continuationEvents = [
        { kind: "session.response_started" as const, payload: {} },
        { kind: "session.response_completed" as const, payload: { stopReason: "end_turn" } },
      ].map((event, index) => ({
        eventId: randomUUID(), sessionId,
        sourceId: `${runtime.metadata.runnerId}:${nextMessageId}`, sourceSequence: index + 1,
        kind: event.kind, version: 1 as const, messageId: nextMessageId,
        payload: event.payload, metadata: {}, occurredAt: timestamp,
      }));
      const continued = await db.appendSessionEvents({
        sessionId, teamId: projectRecord.teamId, leaseTokenHash: continuationHash, events: continuationEvents,
      });
      expect(continued.session).toMatchObject({ state: "ready", lastMessageId: nextMessageId });
    }

    const stressMessageId = randomUUID();
    await db.appendSessionEvents({
      sessionId, teamId: projectRecord.teamId, events: [{
        eventId: randomUUID(), sessionId, sourceId: "control-plane", sourceSequence: controlPlaneSequence,
        kind: "session.user_message_submitted", version: 1, messageId: stressMessageId,
        payload: { content: [{ type: "text", text: "Stress event ledger" }] }, metadata: {}, occurredAt: timestamp,
      }],
    });
    const stressLeaseHash = "9".repeat(64);
    await db.claimSession({
      runtimeId: runtime.id, runnerId: runtime.metadata.runnerId,
      lease: {
        id: randomUUID(), runtimeId: runtime.id, runnerId: runtime.metadata.runnerId,
        leaseToken: "9".repeat(32), leaseTokenHash: stressLeaseHash, providerSessionId: null,
        leaseExpiresAt: "2026-08-10T00:03:00.000Z", claimedAt: timestamp, updatedAt: timestamp,
      },
    });
    await db.appendSessionEvents({
      sessionId, teamId: projectRecord.teamId, leaseTokenHash: stressLeaseHash,
      events: [{
        eventId: randomUUID(), sessionId, sourceId: `runner:stress:${stressMessageId}`, sourceSequence: 1,
        kind: "session.response_started", version: 1, messageId: stressMessageId,
        payload: {}, metadata: {}, occurredAt: timestamp,
      }],
    });
    const stressBatches = Array.from({ length: 100 }, (_, batchIndex) => (
      Array.from({ length: 100 }, (_, eventIndex) => {
        const sequence = batchIndex * 100 + eventIndex + 1;
        return {
          eventId: randomUUID(), sessionId, sourceId: "runner:stress-events", sourceSequence: sequence,
          kind: "session.usage_updated" as const, version: 1 as const,
          messageId: stressMessageId, payload: { totalTokens: sequence }, metadata: {}, occurredAt: timestamp,
        };
      })
    ));
    for (const batch of stressBatches) {
      await db.appendSessionEvents({
        sessionId, teamId: projectRecord.teamId, leaseTokenHash: stressLeaseHash, events: batch,
      });
    }
    let eventCount = 0;
    let afterSequence: number | undefined;
    do {
      const eventPage = await db.listSessionEvents({
        sessionId, teamId: projectRecord.teamId, limit: 500,
        ...(afterSequence ? { afterSequence } : {}),
      });
      eventCount += eventPage.events.length;
      afterSequence = eventPage.nextAfterSequence;
    } while (afterSequence);
    expect(eventCount).toBeGreaterThan(10_000);
    for (const batch of stressBatches) {
      await db.appendSessionEvents({
        sessionId, teamId: projectRecord.teamId, leaseTokenHash: stressLeaseHash, events: batch,
      });
    }
    let replayedEventCount = 0;
    afterSequence = undefined;
    do {
      const eventPage = await db.listSessionEvents({
        sessionId, teamId: projectRecord.teamId, limit: 500,
        ...(afterSequence ? { afterSequence } : {}),
      });
      replayedEventCount += eventPage.events.length;
      afterSequence = eventPage.nextAfterSequence;
    } while (afterSequence);
    expect(replayedEventCount).toBe(eventCount);
  }, 20_000);
}
