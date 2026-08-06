import { mkdtemp, rm } from "node:fs/promises";
import { generateKeyPairSync } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getDb, resetDbForTests } from "@/lib/db";
import { resetGitHubAppServiceForTests } from "@/lib/integrations/github-app";
import { POST as dispatchIntegrationIssue } from "./integrations/[integration]/issues/[identifier]/dispatch/route";
import { POST as callMcp } from "./mcp/route";
import { POST as postProject } from "./projects/route";
import { GET as getRunner } from "./runners/[id]/route";
import { GET as listRunners } from "./runners/route";
import { POST as heartbeatRunner } from "./runner/heartbeat/route";
import { POST as registerRunner } from "./runner/register/route";
import { POST as appendSessionEvent } from "./runner/sessions/[id]/events/route";
import { POST as completeSession } from "./runner/sessions/[id]/result/route";
import { GET as inspectAssignedSession } from "./runner/sessions/[id]/route";
import { POST as getRepositoryCredential } from "./runner/sessions/[id]/repository-credential/route";
import { POST as claimSession } from "./runner/sessions/route";
import { POST as cancelSession } from "./sessions/[id]/cancel/route";
import { GET as getSession } from "./sessions/[id]/route";
import { GET as getSessionSummary } from "./sessions/[id]/summary/route";
import { GET as getTask } from "./tasks/[id]/route";
import { GET as listTaskSessions, POST as postTaskSession } from "./tasks/[id]/sessions/route";
import { GET as listTasks, POST as postTask } from "./tasks/route";

let tempDir: string;
const { privateKey: githubAppPrivateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });

function jsonRequest(url: string, body: unknown, authorization?: string): Request {
  return new Request(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(authorization ? { authorization: `Bearer ${authorization}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

async function json<T>(response: Response): Promise<T> {
  return await response.json() as T;
}

const githubRepositoryPayload = {
  id: 42,
  full_name: "arcadia/mystra-fixture",
  html_url: "https://github.com/arcadia/mystra-fixture",
  clone_url: "https://github.com/arcadia/mystra-fixture.git",
  default_branch: "main",
  visibility: "private",
  archived: false,
};

const linearIssuePayload = {
  id: "linear-issue-101",
  identifier: "MYS-101",
  title: "Ship the demo",
  description: "Complete the vertical slice.",
  url: "https://linear.app/mystra/issue/MYS-101",
  priority: 2,
  priorityLabel: "High",
  state: { id: "state-todo", name: "Todo", type: "unstarted" },
  assignee: null,
  labels: { nodes: [] },
  createdAt: "2026-07-23T01:00:00.000Z",
  updatedAt: "2026-07-23T02:00:00.000Z",
};

const githubConnectionActivation = {
  integration: "github",
  provider: "github",
  externalId: "18492",
  account: { externalId: "42", login: "arcadia", type: "User" },
  repositorySelection: "selected",
  permissions: { contents: "write", pull_requests: "write" },
} as const;

function repositoryConnectionId(): string {
  return getDb().getActiveIntegrationConnection("github")?.id
    ?? getDb().activateIntegrationConnection(githubConnectionActivation).id;
}

function projectPayload(slug = "local-fixture") {
  return {
    name: "Local Fixture",
    slug,
    repository: {
      integration: "github",
      connectionId: repositoryConnectionId(),
      identifier: "arcadia/mystra-fixture",
    },
    baseBranch: "main",
    defaultAgent: "codex",
    runtime: {
      provider: "docker",
      image: "mystra-runner:local",
      contextBundleRefs: [],
      mounts: [],
      exposedPorts: [],
      cache: { coldStartAllowed: true, entries: [] },
      secretRefs: [],
      overridePolicy: {
        allowImageOverride: false,
        allowContextBundleAdditions: false,
        allowedContextBundleSlugs: [],
      },
      metadata: {},
    },
    prewarmConfig: {},
    metadata: {},
  };
}

async function createProject(slug = "local-fixture") {
  const response = await postProject(jsonRequest("http://localhost/api/projects", projectPayload(slug)));
  expect(response.status).toBe(201);
  return (await json<{ project: { id: string } }>(response)).project;
}

async function createTask(projectId: string) {
  const response = await postTask(jsonRequest("http://localhost/api/tasks", {
    projectId,
    source: "api",
    objective: "Implement the management model",
    metadata: {},
  }));
  expect(response.status).toBe(201);
  return (await json<{ task: { id: string } }>(response)).task;
}

async function createSession(taskId: string, branch = "codex/task-session") {
  const response = await postTaskSession(jsonRequest(`http://localhost/api/tasks/${taskId}/sessions`, {
    title: "Implement API slice",
    objective: "Add Task and Session endpoints",
    agent: "codex",
    branch,
  }), { params: Promise.resolve({ id: taskId }) });
  expect(response.status).toBe(201);
  return (await json<{ session: { id: string; state: string } }>(response)).session;
}

async function enrollRunner(runnerName = "runner-a") {
  const response = await registerRunner(jsonRequest("http://localhost/api/runner/register", {
    runnerName,
    capabilities: {
      agents: ["codex", "copilot"],
      executor: "docker",
      providers: ["docker"],
      contextBundleModes: ["read-only", "session-scoped"],
      mountKinds: ["workspace", "gitMirror", "cache", "contextBundle", "secret"],
      portExposure: { supportsDynamicHostPorts: true },
      secretInjectionModes: ["env", "file"],
    },
    maxConcurrency: 2,
  }, process.env.MYSTRA_RUNNER_REGISTRATION_SECRET));
  expect(response.status).toBe(200);
  return await json<{ runner: { id: string; name: string }; credential: string }>(response);
}

beforeEach(async () => {
  tempDir = await mkdtemp(path.join(tmpdir(), "mystra-routes-"));
  process.env.MYSTRA_DB_PATH = path.join(tempDir, "mystra.db");
  process.env.MYSTRA_GITHUB_APP_ID = "12345";
  process.env.MYSTRA_GITHUB_APP_CLIENT_ID = "Iv1.fixture";
  process.env.MYSTRA_GITHUB_APP_CLIENT_SECRET = "client-secret";
  process.env.MYSTRA_GITHUB_APP_SLUG = "mystra-fixture";
  process.env.MYSTRA_GITHUB_APP_PRIVATE_KEY = githubAppPrivateKey.export({ type: "pkcs8", format: "pem" }).toString();
  process.env.MYSTRA_GITHUB_APP_CALLBACK_URL = "http://localhost/api/integration-connections/github/oauth/callback";
  process.env.MYSTRA_RUNNER_REGISTRATION_SECRET = "enroll-test-secret";
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const body = url.includes("api.linear.app")
      ? { data: { issue: linearIssuePayload } }
      : url.includes("/access_tokens")
        ? { token: "ghs_route_test", expires_at: "2099-08-05T09:00:00.000Z" }
        : githubRepositoryPayload;
    return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
  }));
  process.env.LINEAR_API_KEY = "linear-route-test-key";
  resetDbForTests();
  resetGitHubAppServiceForTests();
});

afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  resetDbForTests();
  resetGitHubAppServiceForTests();
  delete process.env.MYSTRA_DB_PATH;
  for (const key of Object.keys(process.env).filter((key) => key.startsWith("MYSTRA_GITHUB_APP_"))) delete process.env[key];
  delete process.env.MYSTRA_RUNNER_REGISTRATION_SECRET;
  delete process.env.LINEAR_API_KEY;
  await rm(tempDir, { force: true, recursive: true });
});

describe("MCP Task, Session, and Runner tools", () => {
  it("discovers only canonical business objects and calls the same provider surface", async () => {
    const project = await createProject("mcp-fixture");
    const listed = await callMcp(jsonRequest("http://localhost/api/mcp", {
      jsonrpc: "2.0",
      id: 1,
      method: "tools/list",
    }));
    const toolPayload = await json<{ result: { tools: Array<{ name: string }> } }>(listed);
    const names = toolPayload.result.tools.map((tool) => tool.name);
    expect(names).toEqual(expect.arrayContaining([
      "mystra_create_task",
      "mystra_create_session",
      "mystra_get_session_summary",
      "mystra_list_runners",
    ]));
    expect(names).toHaveLength(11);

    const created = await callMcp(jsonRequest("http://localhost/api/mcp", {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: {
        name: "mystra_create_task",
        arguments: { projectId: project.id, source: "mcp", objective: "Create through MCP" },
      },
    }));
    const createdPayload = await json<{ result: { content: Array<{ text: string }> } }>(created);
    const task = JSON.parse(createdPayload.result.content[0]!.text) as { task: { id: string } };
    expect(getDb().getTask(task.task.id)?.source).toBe("mcp");
  });

  it("does not expose the removed execution-object tool", async () => {
    // legacy-term-audit: allow
    const removedName = ["mystra", "list", "runs"].join("_");
    const response = await callMcp(jsonRequest("http://localhost/api/mcp", {
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: removedName, arguments: {} },
    }));
    expect(await json(response)).toMatchObject({ error: { code: -32601 } });
  });
});

describe("Task routes", () => {
  it("creates, lists and reads a Task with zero Sessions and no lifecycle state", async () => {
    const project = await createProject();
    const task = await createTask(project.id);

    const listed = await json<{ tasks: Array<Record<string, unknown>> }>(await listTasks());
    expect(listed.tasks).toHaveLength(1);
    expect(listed.tasks[0]).toMatchObject({ id: task.id, sessionCount: 0, activeSessionCount: 0 });
    expect(listed.tasks[0]).not.toHaveProperty("state");
    expect(listed.tasks[0]).not.toHaveProperty("result");

    const detail = await getTask(new Request(`http://localhost/api/tasks/${task.id}`), {
      params: Promise.resolve({ id: task.id }),
    });
    expect(detail.status).toBe(200);
    expect(await json(detail)).toEqual(expect.objectContaining({
      task: expect.objectContaining({ id: task.id }),
      sessionSummary: { sessionCount: 0, activeSessionCount: 0 },
    }));
  });

  it("rejects execution ownership fields on Task creation", async () => {
    const project = await createProject();
    const response = await postTask(jsonRequest("http://localhost/api/tasks", {
      projectId: project.id,
      source: "api",
      objective: "Invalid Task",
      branch: "codex/forbidden",
    }));
    expect(response.status).toBe(400);
    expect((await json<{ error: { code: string } }>(response)).error.code).toBe("INVALID_TASK");
  });
});

describe("Session routes", () => {
  it("creates independent siblings, lists and inspects one without public events", async () => {
    const task = await createTask((await createProject()).id);
    const first = await createSession(task.id, "codex/session-one");
    const second = await createSession(task.id, "codex/session-two");

    const listed = await listTaskSessions(new Request(`http://localhost/api/tasks/${task.id}/sessions`), {
      params: Promise.resolve({ id: task.id }),
    });
    expect((await json<{ sessions: unknown[] }>(listed)).sessions).toHaveLength(2);

    const detail = await getSession(new Request(`http://localhost/api/sessions/${first.id}`), {
      params: Promise.resolve({ id: first.id }),
    });
    const payload = await json<Record<string, unknown>>(detail);
    expect(payload).toMatchObject({ session: { id: first.id }, task: { id: task.id } });
    expect(payload).not.toHaveProperty("events");
    expect(getDb().getSession(second.id)?.state).toBe("queued");
  });

  it("cancels only the selected Session and returns a compact summary", async () => {
    const task = await createTask((await createProject()).id);
    const target = await createSession(task.id, "codex/cancel-target");
    const sibling = await createSession(task.id, "codex/cancel-sibling");
    const canceled = await cancelSession(jsonRequest(`http://localhost/api/sessions/${target.id}/cancel`, {
      reason: "No longer needed",
      requestedBy: "operator",
    }), { params: Promise.resolve({ id: target.id }) });
    expect(await json(canceled)).toEqual(expect.objectContaining({
      outcome: "canceled",
      session: expect.objectContaining({ id: target.id, state: "canceled" }),
    }));
    expect(getDb().getSession(sibling.id)?.state).toBe("queued");

    const summary = await getSessionSummary(new Request(`http://localhost/api/sessions/${target.id}/summary`), {
      params: Promise.resolve({ id: target.id }),
    });
    expect(await json(summary)).toEqual(expect.objectContaining({
      summary: expect.objectContaining({ sessionId: target.id, phase: "terminal" }),
    }));
  });

  it("rejects Project and Repository overrides on child creation", async () => {
    const project = await createProject();
    const task = await createTask(project.id);
    const response = await postTaskSession(jsonRequest(`http://localhost/api/tasks/${task.id}/sessions`, {
      title: "Invalid child",
      objective: "Override context",
      branch: "codex/invalid-child",
      projectId: project.id,
    }), { params: Promise.resolve({ id: task.id }) });
    expect(response.status).toBe(400);
  });
});

describe("Issue dispatch", () => {
  it("atomically creates and reuses one Task/initial Session pair", async () => {
    const project = await createProject("issue-dispatch");
    const dispatch = (branch = "codex/mys-101") => dispatchIntegrationIssue(
      jsonRequest("http://localhost/api/integrations/linear/issues/MYS-101/dispatch", {
        projectId: project.id,
        agent: "copilot",
        branch,
      }),
      { params: Promise.resolve({ integration: "linear", identifier: "MYS-101" }) },
    );
    const firstResponse = await dispatch();
    const first = await json<{ task: { id: string }; session: { id: string }; created: boolean }>(firstResponse);
    expect(firstResponse.status).toBe(201);
    expect(first.created).toBe(true);

    const repeatedResponse = await dispatch();
    const repeated = await json<typeof first>(repeatedResponse);
    expect(repeatedResponse.status).toBe(200);
    expect(repeated).toEqual({ ...first, created: false });
    expect(getDb().listTasks()).toHaveLength(1);
    expect(getDb().listSessions(first.task.id)).toHaveLength(1);

    const conflict = await dispatch("codex/different-branch");
    expect(conflict.status).toBe(409);
  });
});

describe("stable Runner protocol and management routes", () => {
  it("rejects anonymous enrollment and preserves stable identity while rotating credentials", async () => {
    const unauthorized = await registerRunner(jsonRequest("http://localhost/api/runner/register", {
      runnerName: "runner-a",
      capabilities: { agents: ["codex"], executor: "fake" },
    }));
    expect(unauthorized.status).toBe(401);

    const first = await enrollRunner();
    const second = await enrollRunner();
    expect(second.runner.id).toBe(first.runner.id);
    expect(second.credential).not.toBe(first.credential);

    const staleCredential = await heartbeatRunner(jsonRequest("http://localhost/api/runner/heartbeat", {
      runnerId: first.runner.id,
      activeSessionIds: [],
    }, first.credential));
    expect(staleCredential.status).toBe(401);
    const heartbeat = await heartbeatRunner(jsonRequest("http://localhost/api/runner/heartbeat", {
      runnerId: second.runner.id,
      activeSessionIds: [],
    }, second.credential));
    expect(heartbeat.status).toBe(200);
  });

  it("claims, inspects, observes and completes a Session with stable Runner identity", async () => {
    const task = await createTask((await createProject()).id);
    const session = await createSession(task.id, "codex/runner-session");
    const registration = await enrollRunner();

    const claim = await claimSession(jsonRequest("http://localhost/api/runner/sessions", {
      runnerId: registration.runner.id,
      maxSessions: 1,
    }, registration.credential));
    expect(claim.status).toBe(200);
    expect(await json(claim)).toEqual(expect.objectContaining({
      task: expect.objectContaining({ id: task.id }),
      session: expect.objectContaining({ id: session.id, assignedRunnerId: registration.runner.id }),
    }));

    const inspected = await inspectAssignedSession(
      new Request(`http://localhost/api/runner/sessions/${session.id}`, {
        headers: { authorization: `Bearer ${registration.credential}` },
      }),
      { params: Promise.resolve({ id: session.id }) },
    );
    expect(inspected.status).toBe(200);

    const credentialResponse = await getRepositoryCredential(jsonRequest(
      `http://localhost/api/runner/sessions/${session.id}/repository-credential`,
      { purpose: "clone" },
      registration.credential,
    ), { params: Promise.resolve({ id: session.id }) });
    expect(credentialResponse.status).toBe(200);
    expect(credentialResponse.headers.get("cache-control")).toBe("no-store, private");
    expect(await json(credentialResponse)).toEqual({
      credential: {
        provider: "github",
        username: "x-access-token",
        secret: "ghs_route_test",
        expiresAt: "2099-08-05T09:00:00.000Z",
      },
    });

    const observed = await appendSessionEvent(jsonRequest(
      `http://localhost/api/runner/sessions/${session.id}/events`,
      { type: "execution.started", severity: "info", data: {} },
      registration.credential,
    ), { params: Promise.resolve({ id: session.id }) });
    expect(observed.status).toBe(200);
    expect(await json(observed)).toEqual({ accepted: true });

    const completed = await completeSession(jsonRequest(
      `http://localhost/api/runner/sessions/${session.id}/result`,
      { status: "succeeded", summary: "Completed the requested change", branch: "codex/runner-session" },
      registration.credential,
    ), { params: Promise.resolve({ id: session.id }) });
    expect(await json(completed)).toEqual(expect.objectContaining({
      session: expect.objectContaining({ id: session.id, state: "succeeded" }),
    }));

    const runners = await json<{ runners: Array<{ id: string; activeSessionCount: number }> }>(await listRunners());
    expect(runners.runners[0]).toMatchObject({ id: registration.runner.id, activeSessionCount: 0 });
    const runnerDetail = await getRunner(new Request(`http://localhost/api/runners/${registration.runner.id}`), {
      params: Promise.resolve({ id: registration.runner.id }),
    });
    expect(await json(runnerDetail)).toEqual({ runner: expect.objectContaining({ name: "runner-a" }) });
  });
});
