import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { createServer, type Server } from "node:https";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";

import { createSqlitePrismaClient } from "../../apps/control-plane/src/lib/db/prisma-client.ts";
import { PrismaRdbProvider } from "../../apps/control-plane/src/lib/db/prisma-provider.ts";
import { createGitRemoteAccess } from "../../apps/control-plane/src/lib/git/remote-access.ts";
import { RemoteRepositoryReader } from "../../apps/control-plane/src/lib/git/remote-repository-reader.ts";
import { TaskWorkspaceService } from "../../apps/control-plane/src/lib/task-workspaces/task-workspace-service.ts";
import { WorkspacePreparationService } from "../../apps/control-plane/src/lib/task-workspaces/workspace-preparation-service.ts";
import { WorkspaceMaterializer } from "../../apps/runner-daemon/src/workspace-materializer.ts";

const repositoryRoot = path.resolve(import.meta.dirname, "../..");
const requireFromControlPlane = createRequire(path.join(repositoryRoot, "apps/control-plane/package.json"));
const Database = requireFromControlPlane("better-sqlite3") as typeof import("better-sqlite3");
const temporaryRoot = await mkdtemp(path.join(tmpdir(), "mystra-workspace-real-"));
let server: Server | undefined;
let db: PrismaRdbProvider | undefined;

function git(args: string[], cwd?: string): string {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
  });
  if (result.status !== 0) throw new Error(`Git fixture command failed: git ${args.join(" ")}`);
  return result.stdout.trim();
}

try {
  const source = path.join(temporaryRoot, "source");
  const documentRoot = path.join(temporaryRoot, "https");
  const bare = path.join(documentRoot, "repository.git");
  await mkdir(source, { recursive: true });
  await mkdir(documentRoot, { recursive: true });
  git(["init", "--initial-branch=main"], source);
  git(["config", "user.email", "fixture@mystra.local"], source);
  git(["config", "user.name", "Mystra Fixture"], source);
  await import("node:fs/promises").then(({ writeFile }) => writeFile(path.join(source, "README.md"), "fixture\n"));
  git(["add", "README.md"], source);
  git(["commit", "-m", "fixture"], source);
  git(["branch", "release/0.1"], source);
  const exactCommit = git(["rev-parse", "HEAD"], source);
  git(["clone", "--bare", source, bare]);
  git(["update-server-info"], bare);

  const key = path.join(temporaryRoot, "key.pem");
  const cert = path.join(temporaryRoot, "cert.pem");
  const openssl = spawnSync("openssl", [
    "req", "-x509", "-newkey", "rsa:2048", "-nodes",
    "-keyout", key, "-out", cert, "-days", "1", "-subj", "/CN=127.0.0.1",
    "-addext", "subjectAltName=IP:127.0.0.1",
  ], { encoding: "utf8" });
  if (openssl.status !== 0) throw new Error("Could not create the HTTPS Git fixture certificate");

  server = createServer({ key: await readFile(key), cert: await readFile(cert) }, async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url ?? "/", "https://127.0.0.1").pathname);
      const file = path.resolve(documentRoot, `.${pathname}`);
      if (!file.startsWith(`${documentRoot}${path.sep}`)) throw new Error("unsafe path");
      const details = await stat(file);
      if (!details.isFile()) throw new Error("not a file");
      response.statusCode = 200;
      response.setHeader("content-length", details.size);
      response.setHeader("content-type", pathname.endsWith("/info/refs") ? "text/plain" : "application/octet-stream");
      if (request.method === "HEAD") response.end();
      else response.end(await readFile(file));
    } catch {
      response.statusCode = 404;
      response.end("not found");
    }
  });
  await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("HTTPS Git fixture did not bind");
  const endpoint = `https://127.0.0.1:${address.port}/repository.git`;
  process.env.GIT_SSL_NO_VERIFY = "1";
  const transientSecret = "fixture-secret-never-persist";
  const access = createGitRemoteAccess({
    endpoint,
    credential: { kind: "http-basic-token", username: "x-access-token", secret: transientSecret },
  });
  const reader = new RemoteRepositoryReader();
  const advertisement = await reader.inspectBranches({
    access, timeoutMs: 30_000, maxRefs: 10_000, maxOutputBytes: 8 * 1024 * 1024,
  });
  const resolved = await reader.resolveBranch({
    access, branch: "main", timeoutMs: 30_000, maxRefs: 10_000, maxOutputBytes: 8 * 1024 * 1024,
  });
  if (resolved.commit !== exactCommit || advertisement.head?.name !== "main") {
    throw new Error("Standard Git branch read did not preserve exact identity");
  }

  const databasePath = path.join(temporaryRoot, "control-plane.db");
  const sqlite = new Database(databasePath);
  for (const directory of [
    "20260806182000_init",
    "20260806210000_secret_envelopes",
    "20260807150000_identity_team_rbac",
    "20260807181000_runtime_provider",
    "20260808173000_project_issue_sources",
    "20260808180000_agent_definition",
    "20260808200000_task_context",
    "20260810130000_task_workspace_setup",
  ]) {
    sqlite.exec(readFileSync(path.join(
      repositoryRoot,
      `apps/control-plane/prisma/sqlite/migrations/${directory}/migration.sql`,
    ), "utf8"));
  }
  sqlite.close();
  db = new PrismaRdbProvider(createSqlitePrismaClient({ databaseUrl: `file:${databasePath}` }));
  const tenant = await db.registerLocalUser({
    username: `fixture_${randomUUID().replaceAll("-", "")}`,
    passwordHash: "scrypt$v1$fixture",
    passwordSalt: "fixture",
    passwordParams: "N=16384,r=8,p=1",
    initialTeamDisplayName: "Workspace fixture",
    tokenHash: randomUUID(),
    expiresAt: "2027-08-10T00:00:00.000Z",
  });
  const connection = await db.upsertIntegrationConnection({
    teamId: tenant.initialTeam.id,
    integration: "github",
    provider: "github",
    authMethod: "personal-access-token",
    providerExternalId: "fixture-actor",
    providerSubject: {},
    connectionConfig: {},
    capabilities: {
      repositories: {
        state: "enabled",
        config: {},
        permissions: { contents: "write" },
        accessSummary: { repositories: "fixture" },
        verifiedAt: "2026-08-10T00:00:00.000Z",
      },
    },
    credentialState: "ready",
    credentialRef: "fixture/opaque",
    status: "active",
  });
  const project = await db.createProject({
    teamId: tenant.initialTeam.id,
    name: "Workspace fixture",
    slug: `fixture-${randomUUID()}`,
    repositoryConnectionId: connection.id,
    repositoryExternalId: "fixture-repository",
    repositoryBaseBranch: "main",
    metadata: {},
  });
  const task = (await db.createTask({
    teamId: tenant.initialTeam.id,
    projectId: project.id,
    title: "Real Workspace fixture",
    description: null,
    idempotencyKey: randomUUID(),
  })).task;
  const runnerId = randomUUID();
  const runtime = await db.registerHostRuntime({
    runnerId,
    name: "Real fixture host",
    type: "host",
    platform: "darwin-arm64",
    providers: [],
    workspaceMaterialization: {
      version: 1,
      kinds: ["task-repository"],
      sharingModes: ["shared-mutable"],
    },
  });
  const repositoryAccess = { resolve: async () => access };
  const taskService = new TaskWorkspaceService({
    db,
    repositoryAccess,
    repositoryReader: reader,
    issueBranches: { resolve: async () => { throw new Error("No Issue expected"); } },
    runtimeResolver: { getRuntime: async (id) => id === runtime.id ? { ...runtime, status: "online" } : undefined },
  });
  const setup = await taskService.setup({
    actor: { teamId: tenant.initialTeam.id },
    taskId: task.id,
    runtimeId: runtime.id,
    idempotencyKey: randomUUID(),
  });
  const preparation = new WorkspacePreparationService({ db, repositoryAccess });
  const claim = await preparation.claim({ runnerId, waitSeconds: 0 });
  if (!claim) throw new Error("Workspace attempt was not claimable");
  const materializer = new WorkspaceMaterializer({ root: path.join(temporaryRoot, "workspaces") });
  const report = await materializer.materialize(claim, runnerId);
  const ready = await preparation.report({
    workspaceId: claim.workspaceId,
    attemptId: claim.attemptId,
    report,
  });
  const resolvedWorkspace = await materializer.resolveReadyWorkspace(report.workspaceRef);
  await writeFile(path.join(resolvedWorkspace.directory, "session-mutation.txt"), "shared mutation\n");
  git(["config", "user.email", "session@mystra.local"], resolvedWorkspace.directory);
  git(["config", "user.name", "Mystra Session"], resolvedWorkspace.directory);
  git(["add", "session-mutation.txt"], resolvedWorkspace.directory);
  git(["commit", "-m", "session mutation"], resolvedWorkspace.directory);
  const resolvedAfterMutation = await materializer.resolveReadyWorkspace(report.workspaceRef);
  const publicWorkspace = await taskService.get({ actor: { teamId: tenant.initialTeam.id }, taskId: task.id });
  const serializedPublic = JSON.stringify(publicWorkspace);
  if (
    ready.state !== "ready"
    || ready.baseCommit !== exactCommit
    || resolvedAfterMutation.baseCommit !== exactCommit
    || resolvedAfterMutation.currentCommit === exactCommit
    || serializedPublic.includes(transientSecret)
    || serializedPublic.includes(temporaryRoot)
    || serializedPublic.includes("workspaceRef")
  ) {
    throw new Error("Real Workspace closure violated its public or provenance contract");
  }
  process.stdout.write(`${JSON.stringify({
    status: ready.state,
    symbolicHead: advertisement.head?.name,
    branches: advertisement.branches.map((branch) => branch.name).sort(),
    exactCommit,
    currentCommit: resolvedAfterMutation.currentCommit,
    workingBranch: ready.branchName,
    workspaceRef: ready.workspaceRef,
    sharedMutationAccepted: true,
    publicSecretLeak: false,
    publicPathLeak: false,
  }, null, 2)}\n`);
} finally {
  await db?.close().catch(() => undefined);
  await new Promise<void>((resolve) => server?.close(() => resolve()) ?? resolve());
  delete process.env.GIT_SSL_NO_VERIFY;
  await rm(temporaryRoot, { recursive: true, force: true });
}
