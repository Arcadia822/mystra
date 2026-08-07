import { readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { getDb, resetDbForTests } from "@/lib/db";
import { POST as callMcp } from "./mcp/route";
import { POST as postProject } from "./projects/route";
import { GET as getTask } from "./tasks/[id]/route";
import { GET as listTasks, POST as postTask } from "./tasks/route";

let tempDir: string;
let projectId: string;
const migrations = [
  "20260806182000_init",
  "20260806210000_secret_envelopes",
].map((directory) => readFileSync(
  path.join(process.cwd(), `prisma/sqlite/migrations/${directory}/migration.sql`),
  "utf8",
));

function jsonRequest(url: string, body: unknown): Request {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
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
  const connection = await db.upsertIntegrationConnection({
    id: "00000000-0000-4000-8000-000000000041",
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
      projectId,
      metadata: { title: "Verify the Prisma control plane" },
    }));
    expect(created.status).toBe(201);
    const task = (await created.json() as { task: { id: string } }).task;

    const listed = await listTasks();
    expect(await listed.json()).toEqual({ tasks: [expect.objectContaining({ id: task.id, projectId })] });

    const detail = await getTask(new Request(`http://localhost/api/tasks/${task.id}`), {
      params: Promise.resolve({ id: task.id }),
    });
    const payload = await detail.json();
    expect(payload).toEqual({ task: expect.objectContaining({ id: task.id, projectId }) });
    expect(payload).not.toHaveProperty("sessionSummary");
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
      "mystra_create_task",
      "mystra_list_tasks",
      "mystra_get_task",
      "mystra_health",
    ]);
    expect(names.some((name) => /session|runner|context/i.test(name))).toBe(false);
  });
});
