import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import path from "node:path";

import Database from "better-sqlite3";

import { sessionWorkspaceAttachmentSchema } from "@mystra/shared";

import { createSqlitePrismaClient } from "../src/lib/db/prisma-client";
import { PrismaRdbProvider } from "../src/lib/db/prisma-provider";
import { RuntimeSessionService } from "../src/lib/sessions/runtime-session-service";
import { SessionService } from "../src/lib/sessions/session-service";

const migrationDirectories = [
  "20260806182000_init",
  "20260806210000_secret_envelopes",
  "20260807150000_identity_team_rbac",
  "20260807181000_runtime_provider",
  "20260808173000_project_issue_sources",
  "20260808180000_agent_definition",
  "20260808200000_task_context",
  "20260810130000_task_workspace_setup",
  "20260810160000_session_launch_framework",
];

export async function createSessionE2eFixture() {
  const directory = path.join(process.cwd(), `.test-session-e2e-${process.pid}-${randomUUID()}`);
  mkdirSync(directory, { recursive: true });
  const databasePath = path.join(directory, "session.db");
  const sqlite = new Database(databasePath);
  for (const migrationDirectory of migrationDirectories) {
    sqlite.exec(readFileSync(path.join(
      process.cwd(),
      "prisma/sqlite/migrations",
      migrationDirectory,
      "migration.sql",
    ), "utf8"));
  }
  sqlite.close();

  let tick = 0;
  const now = () => new Date(Date.UTC(2026, 7, 10, 0, 0, 0, tick++)).toISOString();
  const db = new PrismaRdbProvider(createSqlitePrismaClient({
    databaseUrl: `file:${databasePath}`,
  }), { now });
  const registration = await db.registerLocalUser({
    username: `session_e2e_${randomUUID().replaceAll("-", "")}`,
    displayName: "Session E2E",
    passwordHash: "scrypt$v1$hash",
    passwordSalt: "salt",
    passwordParams: "N=16384,r=8,p=1",
    initialTeamDisplayName: "Session E2E Team",
    tokenHash: randomUUID(),
    expiresAt: "2027-08-10T00:00:00.000Z",
  });
  const teamId = registration.initialTeam.id;
  const connection = await db.upsertIntegrationConnection({
    teamId,
    integration: "github",
    provider: "github",
    authMethod: "personal-access-token",
    providerExternalId: randomUUID(),
    displayName: "Session E2E GitHub",
    providerSubject: { login: "session-e2e" },
    connectionConfig: {},
    capabilities: {
      repositories: {
        state: "enabled",
        config: {},
        permissions: { contents: "write" },
        accessSummary: { repositories: "all" },
        verifiedAt: "2026-08-10T00:00:00.000Z",
      },
    },
    credentialRef: "github-pat/session-e2e",
    credentialState: "ready",
  });
  const project = await db.createProject({
    teamId,
    name: "Session E2E",
    slug: `session-e2e-${randomUUID()}`,
    repositoryConnectionId: connection.id,
    repositoryExternalId: "R_session_e2e",
    repositoryBaseBranch: "main",
    metadata: {},
  });
  const task = (await db.createTask({
    teamId,
    projectId: project.id,
    title: "Execute three Session messages",
    description: "Prove the 049 Session lifecycle.",
    idempotencyKey: randomUUID(),
  })).task;
  const agent = await db.createAgent({
    teamId,
    name: "Session E2E Agent",
    systemPrompt: "Execute the requested task and report typed evidence.",
  });
  const runnerId = randomUUID();
  const registeredRuntime = await db.registerHostRuntime({
    runnerId,
    name: "Session E2E Runtime",
    type: "host",
    platform: "darwin/arm64",
    providers: [],
    workspaceMaterialization: {
      version: 1,
      kinds: ["task-repository"],
      sharingModes: ["shared-mutable"],
    },
  });
  const reportedRuntime = (await db.reportHostProviders(runnerId, [{
    provider: "codex",
    discovered: true,
    available: true,
    source: "path",
    resolvedPath: "/usr/bin/codex",
    version: "1.0.0",
    unavailableReason: null,
  }]))!;
  const runtime = {
    ...reportedRuntime,
    status: "online" as const,
    lastSeenAt: "2026-08-10T00:00:00.000Z",
  };
  const createdWorkspace = await db.createTaskWorkspace({
    teamId,
    taskId: task.id,
    projectId: project.id,
    runtimeId: registeredRuntime.id,
    connectionId: connection.id,
    repositoryExternalId: project.repositoryExternalId,
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
  const preparation = await db.claimTaskWorkspacePreparation({
    runnerId,
    leaseExpiresAt: "2026-08-11T00:00:00.000Z",
  });
  const workspace = await db.completeTaskWorkspacePreparation({
    workspaceId: createdWorkspace.workspace.id,
    attemptId: preparation!.attempt.id,
    runnerId,
    attemptSequence: preparation!.attempt.sequence,
    status: "succeeded",
    workspaceRef: `host-task-workspace:${createdWorkspace.workspace.id}`,
    observed: {
      baseCommit: createdWorkspace.workspace.baseCommit,
      branchName: createdWorkspace.workspace.branchName,
    },
  });

  const sessions = new SessionService({
    db,
    runtimeResolver: async (id) => id === runtime.id ? runtime : undefined,
    workspace: {
      resolveSessionAttachment: async (input) => {
        const ready = await db.getTaskWorkspaceByTaskId(input.taskId, { teamId: input.teamId });
        return sessionWorkspaceAttachmentSchema.parse({
          kind: "task",
          taskWorkspaceId: ready!.id,
          runtimeId: ready!.runtimeId,
          workspaceRef: ready!.workspaceRef,
          sharingMode: ready!.sharingMode,
        });
      },
    },
    now,
  });
  let tokenSequence = 0;
  const runtimeSessions = new RuntimeSessionService({
    db,
    now: () => new Date("2026-08-10T01:00:00.000Z"),
    newToken: () => String(++tokenSequence).padStart(32, "t"),
  });
  const server = await startSessionHttpServer(runtimeSessions);

  return {
    db,
    sessions,
    runtimeSessions,
    endpoint: server.endpoint,
    actor: { actorId: registration.user.id, teamId, roles: ["owner" as const] },
    task,
    project,
    agent,
    runtime,
    runnerId,
    workspace,
    async close() {
      await server.close();
      await db.close();
      rmSync(directory, { recursive: true, force: true });
    },
  };
}

async function startSessionHttpServer(service: RuntimeSessionService): Promise<{
  endpoint: string;
  close(): Promise<void>;
}> {
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? "/", "http://localhost");
      if (request.method === "POST" && url.pathname === "/api/runner/sessions/claim") {
        const runtimeId = header(request.headers["x-mystra-runtime-id"]);
        const assignment = await service.claim({ runtimeId, request: await readJson(request) });
        if (!assignment) {
          response.writeHead(204).end();
          return;
        }
        json(response, 200, { assignment });
        return;
      }
      const eventMatch = url.pathname.match(/^\/api\/runner\/sessions\/([^/]+)\/events$/u);
      if (request.method === "POST" && eventMatch) {
        const leaseToken = header(request.headers["x-mystra-lease-token"]);
        const teamId = header(request.headers["x-mystra-team-id"]);
        const result = await service.appendEvents({
          sessionId: decodeURIComponent(eventMatch[1]!),
          teamId,
          leaseToken,
          batch: await readJson(request),
        });
        json(response, 200, result);
        return;
      }
      json(response, 404, { error: { code: "not_found" } });
    } catch {
      json(response, 409, { error: { code: "session_request_failed" } });
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Session E2E server did not bind TCP");
  return {
    endpoint: `http://127.0.0.1:${address.port}`,
    close: () => closeServer(server),
  };
}

function header(value: string | string[] | undefined): string {
  if (typeof value !== "string" || value.length === 0) throw new Error("Required header is missing");
  return value;
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function json(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}
