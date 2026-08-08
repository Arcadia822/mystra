import { readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { getDb, resetDbForTests } from "@/lib/db";
import { hashSessionToken } from "@/lib/auth";
import { GET as getAgent, PATCH as patchAgent } from "./agents/[id]/route";
import { POST as archiveAgent } from "./agents/[id]/archive/route";
import { GET as listAgents, POST as postAgent } from "./agents/route";
import { POST as callMcp } from "./mcp/route";
import { POST as postProject } from "./projects/route";
import { GET as getTask } from "./tasks/[id]/route";
import { GET as listTasks, POST as postTask } from "./tasks/route";

let tempDir: string;
let projectId: string;
let teamId: string;
const migrations = [
  "20260806182000_init",
  "20260806210000_secret_envelopes",
  "20260807150000_identity_team_rbac",
  "20260808180000_agent_definition",
].map((directory) => readFileSync(
  path.join(process.cwd(), `prisma/sqlite/migrations/${directory}/migration.sql`),
  "utf8",
));

const sessionToken = "route-test-session-token";

function jsonRequest(url: string, body: unknown, method = "POST"): Request {
  return new Request(url, {
    method,
    headers: {
      authorization: `Bearer ${sessionToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

beforeEach(async () => {
  await resetDbForTests();
  tempDir = await mkdtemp(path.join(tmpdir(), "mystra-core-routes-"));
  process.env.MYSTRA_DB_PATH = path.join(tempDir, "mystra.db");
  const database = new Database(process.env.MYSTRA_DB_PATH);
  for (const migration of migrations) database.exec(migration);
  database.close();

  const db = await getDb();
  const tenant = await db.registerLocalUser({
    username: "route_test_user",
    passwordHash: "scrypt$v1$hash",
    passwordSalt: "salt",
    passwordParams: "N=16384,r=8,p=1",
    initialTeamDisplayName: "Route Test Team",
    tokenHash: hashSessionToken(sessionToken),
    expiresAt: "2027-08-06T00:00:00.000Z",
  });
  teamId = tenant.initialTeam.id;
  const connection = await db.upsertIntegrationConnection({
    id: "00000000-0000-4000-8000-000000000041",
    teamId,
    integration: "github",
    provider: "github",
    authMethod: "personal-access-token",
    providerExternalId: "pat:route-test",
    providerSubject: { externalId: "42", login: "arcadia", type: "User" },
    capabilities: {
      repositories: {
        state: "enabled",
        config: { selection: "token" },
        permissions: {},
        accessSummary: {},
        verifiedAt: null,
      },
    },
    credentialState: "ready",
  });
  const projectResponse = await postProject(jsonRequest("http://localhost/api/projects", {
    teamId,
    name: "Local Fixture",
    slug: "local-fixture",
    repositoryConnectionId: connection.id,
    repositoryExternalId: "42",
    repositoryBaseBranch: "main",
    metadata: { repositoryFullName: "arcadia/mystra-fixture" },
  }));
  expect(projectResponse.status).toBe(201);
  projectId = (await projectResponse.json() as { project: { id: string } }).project.id;
});

afterEach(async () => {
  await resetDbForTests();
  delete process.env.MYSTRA_DB_PATH;
  await rm(tempDir, { force: true, recursive: true });
});

describe("active Task routes", () => {
  it("creates, lists, and reads a durable Task without Session projections", async () => {
    const created = await postTask(jsonRequest("http://localhost/api/tasks", {
      teamId,
      projectId,
      metadata: { title: "Verify the Prisma control plane" },
    }));
    expect(created.status).toBe(201);
    const task = (await created.json() as { task: { id: string } }).task;

    const listed = await listTasks(new Request("http://localhost/api/tasks", {
      headers: { authorization: `Bearer ${sessionToken}` },
    }));
    expect(await listed.json()).toEqual({ tasks: [expect.objectContaining({ id: task.id, projectId })] });

    const detail = await getTask(new Request(`http://localhost/api/tasks/${task.id}`, {
      headers: { authorization: `Bearer ${sessionToken}` },
    }), {
      params: Promise.resolve({ id: task.id }),
    });
    const payload = await detail.json();
    expect(payload).toEqual({ task: expect.objectContaining({ id: task.id, projectId }) });
    expect(payload).not.toHaveProperty("sessionSummary");
  });
});

describe("active Agent routes", () => {
  it("creates, lists, updates, archives, and reads a Team-owned Agent", async () => {
    const createdResponse = await postAgent(jsonRequest("http://localhost/api/agents", {
      name: "Reviewer",
      systemPrompt: "Review the submitted evidence.",
    }));
    expect(createdResponse.status).toBe(201);
    const created = (await createdResponse.json() as { agent: { id: string; teamId: string; revision: number } }).agent;
    expect(created).toMatchObject({ teamId, revision: 1 });

    const listedResponse = await listAgents(new Request("http://localhost/api/agents?limit=1", {
      headers: { authorization: `Bearer ${sessionToken}` },
    }));
    expect(await listedResponse.json()).toEqual({ agents: [expect.objectContaining({ id: created.id })], nextCursor: null });

    const updatedResponse = await patchAgent(jsonRequest(`http://localhost/api/agents/${created.id}`, {
      expectedRevision: 1,
      systemPrompt: "Reject unsupported claims.",
    }, "PATCH"), { params: Promise.resolve({ id: created.id }) });
    expect(updatedResponse.status).toBe(200);
    expect(await updatedResponse.json()).toEqual({
      agent: expect.objectContaining({ id: created.id, revision: 2, systemPrompt: "Reject unsupported claims." }),
    });

    const staleResponse = await patchAgent(jsonRequest(`http://localhost/api/agents/${created.id}`, {
      expectedRevision: 1,
      name: "Stale rename",
    }, "PATCH"), { params: Promise.resolve({ id: created.id }) });
    expect(staleResponse.status).toBe(409);
    expect(await staleResponse.json()).toMatchObject({ error: { code: "AGENT_REVISION_CONFLICT" } });

    const archivedResponse = await archiveAgent(jsonRequest(`http://localhost/api/agents/${created.id}/archive`, {
      expectedRevision: 2,
    }), { params: Promise.resolve({ id: created.id }) });
    expect(archivedResponse.status).toBe(200);
    expect(await archivedResponse.json()).toEqual({ agent: expect.objectContaining({ status: "archived" }) });

    const detailResponse = await getAgent(new Request(`http://localhost/api/agents/${created.id}`, {
      headers: { authorization: `Bearer ${sessionToken}` },
    }), { params: Promise.resolve({ id: created.id }) });
    expect(detailResponse.status).toBe(200);
    expect(await detailResponse.json()).toEqual({ agent: expect.objectContaining({ id: created.id, status: "archived" }) });

    const defaultList = await listAgents(new Request("http://localhost/api/agents", {
      headers: { authorization: `Bearer ${sessionToken}` },
    }));
    expect(await defaultList.json()).toEqual({ agents: [], nextCursor: null });
    const archivedList = await listAgents(new Request("http://localhost/api/agents?includeArchived=true", {
      headers: { authorization: `Bearer ${sessionToken}` },
    }));
    expect(await archivedList.json()).toEqual({ agents: [expect.objectContaining({ id: created.id })], nextCursor: null });
  });

  it("rejects hidden Agent configuration fields", async () => {
    const response = await postAgent(jsonRequest("http://localhost/api/agents", {
      name: "Invalid",
      systemPrompt: "Prompt",
      projectId,
      provider: "codex",
    }));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: "INVALID_AGENT" } });
  });

  it("allows Team members to read Agents but denies Agent mutation", async () => {
    const db = await getDb();
    const memberToken = "route-test-member-session-token";
    const member = await db.registerLocalUser({
      username: "route_test_member",
      passwordHash: "scrypt$v1$hash",
      passwordSalt: "salt",
      passwordParams: "N=16384,r=8,p=1",
      initialTeamDisplayName: "Member Personal Team",
      tokenHash: hashSessionToken(memberToken),
      expiresAt: "2027-08-06T00:00:00.000Z",
    });
    await db.addMemberByUsername(teamId, member.user.username);
    await db.setActiveTeam(member.session.id, teamId);

    const readResponse = await listAgents(new Request("http://localhost/api/agents", {
      headers: { authorization: `Bearer ${memberToken}` },
    }));
    expect(readResponse.status).toBe(200);

    const writeResponse = await postAgent(new Request("http://localhost/api/agents", {
      method: "POST",
      headers: {
        authorization: `Bearer ${memberToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ name: "Forbidden", systemPrompt: "No." }),
    }));
    expect(writeResponse.status).toBe(403);
    expect(await writeResponse.json()).toMatchObject({ error: { code: "forbidden" } });
  });
});

describe("active MCP surface", () => {
  it("exposes Task tools and omits temporarily removed persistence surfaces", async () => {
    const response = await callMcp(jsonRequest("http://localhost/api/mcp", {
      jsonrpc: "2.0",
      id: 1,
      method: "tools/list",
    }));
    const payload = await response.json() as { result: { tools: Array<{ name: string }> } };
    const names = payload.result.tools.map((tool) => tool.name);

    expect(names).toEqual([
      "mystra_create_agent",
      "mystra_list_agents",
      "mystra_get_agent",
      "mystra_update_agent",
      "mystra_archive_agent",
      "mystra_create_task",
      "mystra_list_tasks",
      "mystra_get_task",
      "mystra_health",
    ]);
    expect(names.some((name) => /session|runner|context/i.test(name))).toBe(false);
  });
});
