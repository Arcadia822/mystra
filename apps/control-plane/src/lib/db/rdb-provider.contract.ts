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
    };
    const registered = await db.registerHostRuntime(registration);

    expect(registered).toMatchObject({
      name: registration.name,
      type: "host",
      metadata: { runnerId: registration.runnerId, platform: registration.platform },
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
}
