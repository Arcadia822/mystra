import { randomUUID } from "node:crypto";

import { createSqlitePrismaClient } from "../../apps/control-plane/src/lib/db/prisma-client.ts";
import { PrismaRdbProvider } from "../../apps/control-plane/src/lib/db/prisma-provider.ts";
import { hashPassword } from "../../apps/control-plane/src/lib/auth/password.ts";

const databasePath = process.env.MYSTRA_DB_PATH;
if (!databasePath) throw new Error("MYSTRA_DB_PATH is required");

const username = "workspace_ui";
const password = "workspace-ui-test";
const db = new PrismaRdbProvider(createSqlitePrismaClient({ databaseUrl: `file:${databasePath}` }));

try {
  const credential = await hashPassword(password);
  const tenant = await db.registerLocalUser({
    username,
    ...credential,
    initialTeamDisplayName: "Workspace UI verification",
    tokenHash: randomUUID(),
    expiresAt: new Date(Date.now() + 60 * 60 * 1_000).toISOString(),
  });
  const connection = await db.upsertIntegrationConnection({
    teamId: tenant.initialTeam.id,
    integration: "github",
    provider: "github",
    authMethod: "personal-access-token",
    providerExternalId: "workspace-ui-actor",
    providerSubject: {},
    connectionConfig: {},
    capabilities: {
      repositories: {
        state: "enabled",
        config: {},
        permissions: { contents: "write" },
        accessSummary: { repositories: "octo-org/workspace-fixture" },
        verifiedAt: new Date().toISOString(),
      },
    },
    credentialState: "ready",
    credentialRef: "workspace-ui/absent-secret",
    status: "active",
  });
  const project = await db.createProject({
    teamId: tenant.initialTeam.id,
    name: "Workspace verification",
    slug: "workspace-verification",
    repositoryConnectionId: connection.id,
    repositoryExternalId: "octo-org/workspace-fixture",
    repositoryBaseBranch: "main",
    metadata: {},
  });
  const task = (await db.createTask({
    teamId: tenant.initialTeam.id,
    projectId: project.id,
    title: "Verify shared Task Workspace",
    description: "A browser fixture for feature 048.",
    idempotencyKey: randomUUID(),
  })).task;
  const runnerId = randomUUID();
  const runtime = await db.registerHostRuntime({
    runnerId,
    name: "Workspace fixture host",
    type: "host",
    platform: "darwin-arm64",
    providers: [],
    workspaceMaterialization: {
      version: 1,
      kinds: ["task-repository"],
      sharingModes: ["shared-mutable"],
    },
  });
  const created = await db.createTaskWorkspace({
    taskId: task.id,
    teamId: tenant.initialTeam.id,
    projectId: project.id,
    runtimeId: runtime.id,
    connectionId: connection.id,
    repositoryExternalId: project.repositoryExternalId,
    configuredBaseBranch: "main",
    baseRef: "refs/heads/main",
    baseCommit: "0123456789abcdef0123456789abcdef01234567",
    branchName: `mystra/task-${task.id.slice(0, 8)}-verify-shared-task-workspace`,
    branchStrategy: "task-fallback-v1",
    issueProvider: null,
    issueConnectionId: null,
    issueScopeExternalId: null,
    issueExternalId: null,
  });
  const claim = await db.claimTaskWorkspacePreparation({
    runnerId,
    leaseExpiresAt: new Date(Date.now() + 60_000).toISOString(),
  });
  if (!claim || claim.workspace.id !== created.workspace.id) {
    throw new Error("The UI fixture Workspace could not be claimed");
  }
  await db.completeTaskWorkspacePreparation({
    workspaceId: claim.workspace.id,
    attemptId: claim.attempt.id,
    runnerId,
    attemptSequence: claim.attempt.sequence,
    status: "succeeded",
    workspaceRef: `host-task-workspace:${claim.workspace.id}`,
    observed: {
      baseCommit: claim.workspace.baseCommit,
      branchName: claim.workspace.branchName,
    },
  });

  process.stdout.write(`${JSON.stringify({
    username,
    password,
    projectPath: `/projects/${project.slug}/settings`,
    taskPath: `/tasks/${task.id}`,
  }, null, 2)}\n`);
} finally {
  await db.close();
}
